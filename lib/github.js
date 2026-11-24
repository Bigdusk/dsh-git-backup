import { delay } from './util.js'

export class GitHubError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'GitHubError'
    this.status = options.status
    this.code = options.code ?? 'failed'
  }
}

function encodeBranch(branch) {
  return String(branch).split('/').map((part) => encodeURIComponent(part)).join('/')
}

function combineSignal(signal, timeoutMs) {
  const timeout = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined
  if (!signal) return timeout
  if (!timeout) return signal
  return typeof AbortSignal?.any === 'function' ? AbortSignal.any([signal, timeout]) : signal
}

/**
 * A small GitHub REST client covering exactly what the backup needs:
 * repository resolution, the Git Data API, and the token probe.
 */
export class GitHubClient {
  constructor(options) {
    this.token = options.token
    this.apiBase = String(options.apiBase ?? 'https://api.github.com').replace(/\/+$/, '')
    this.userAgent = options.userAgent ?? 'dsh-git-backup'
    this.maxAttempts = Number(options.maxAttempts) > 0 ? Number(options.maxAttempts) : 3
    this.timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 45_000
    this.requestCount = 0
    /** Fine-grained tokens report their expiry in a response header. */
    this.tokenExpiration = null
  }

  async request(method, pathname, options = {}) {
    const { body, signal } = options
    const url = `${this.apiBase}${pathname}`
    const headers = {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${this.token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': this.userAgent,
    }
    let payload
    if (body !== undefined) {
      headers['content-type'] = 'application/json'
      payload = JSON.stringify(body)
    }

    let attempt = 0
    for (;;) {
      attempt += 1
      this.requestCount += 1
      let response
      try {
        response = await fetch(url, { method, headers, body: payload, signal: combineSignal(signal, this.timeoutMs) })
      } catch (error) {
        if (signal?.aborted) throw error
        if (attempt >= this.maxAttempts) {
          throw new GitHubError(`无法连接 GitHub API：${error?.message ?? error}`, { code: 'network' })
        }
        await delay(400 * attempt)
        continue
      }

      if (response.status === 204) return null
      const expires = response.headers.get('github-authentication-token-expiration')
      if (expires) this.tokenExpiration = expires
      const text = await response.text()
      if (response.ok) {
        if (!text) return null
        try {
          return JSON.parse(text)
        } catch {
          throw new GitHubError('GitHub API 返回了无法解析的响应', { code: 'protocol' })
        }
      }

      let message = text
      try {
        const parsed = JSON.parse(text)
        if (parsed?.message) message = parsed.message
        if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
          message += ` (${parsed.errors.map((item) => item?.message ?? String(item)).join('; ')})`
        }
      } catch {
        /* keep the raw body */
      }

      const retryable = response.status === 429 || response.status >= 500
      if (retryable && attempt < this.maxAttempts) {
        await delay(Math.min(5000, 500 * attempt * attempt))
        continue
      }

      const code =
        response.status === 401
          ? 'unauthenticated'
          : response.status === 403
            ? /rate limit/i.test(String(message))
              ? 'rate-limit'
              : 'forbidden'
            : response.status === 404
              ? 'not-found'
              : response.status === 409 || response.status === 422
                ? 'conflict'
                : 'failed'
      throw new GitHubError(`GitHub API ${response.status}: ${message || response.statusText}`, {
        status: response.status,
        code,
      })
    }
  }

  async user(signal) {
    const value = await this.request('GET', '/user', { signal })
    if (!value?.login) throw new GitHubError('无法读取 token 对应的 GitHub 账号', { code: 'protocol' })
    return value
  }

  /**
   * Resolve the target repository, creating it when `autoCreate` is allowed.
   * `repo` may be `owner/name`; `repoName` is used when only a name is given.
   */
  async resolveRepository(options = {}, signal) {
    const configured = String(options.repo ?? '').trim()
    if (configured.includes('/')) {
      const [owner, name] = configured.split('/')
      let info
      try {
        info = await this.request('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, { signal })
      } catch (error) {
        if (error?.code === 'not-found') {
          throw new GitHubError(`仓库 ${configured} 不存在，或 token 无权访问它`, { code: 'not-found' })
        }
        throw error
      }
      return {
        owner: info.owner?.login ?? owner,
        name: info.name ?? name,
        fullName: info.full_name ?? `${owner}/${name}`,
        defaultBranch: info.default_branch ?? 'main',
        created: false,
        private: Boolean(info.private),
      }
    }

    const account = await this.user(signal)
    const name = (configured || String(options.repoName ?? 'dsh-backup')).trim()
    try {
      const info = await this.request('GET', `/repos/${encodeURIComponent(account.login)}/${encodeURIComponent(name)}`, {
        signal,
      })
      return {
        owner: info.owner?.login ?? account.login,
        name: info.name ?? name,
        fullName: info.full_name ?? `${account.login}/${name}`,
        defaultBranch: info.default_branch ?? 'main',
        created: false,
        private: Boolean(info.private),
      }
    } catch (error) {
      if (error?.code !== 'not-found') throw error
    }

    if (options.autoCreate === false) {
      throw new GitHubError(`仓库 ${account.login}/${name} 不存在，且自动创建已关闭`, { code: 'not-found' })
    }
    const created = await this.request('POST', '/user/repos', {
      signal,
      body: {
        name,
        private: options.private !== false,
        auto_init: true,
        description: options.description ?? 'DeepSeek Harness .dsh backup',
      },
    })
    return {
      owner: created.owner?.login ?? account.login,
      name: created.name ?? name,
      fullName: created.full_name ?? `${account.login}/${name}`,
      defaultBranch: created.default_branch ?? 'main',
      created: true,
      private: Boolean(created.private),
    }
  }

  /** `{ commitSha }` for a branch head, or null when the branch does not exist. */
  async getRef(repository, branch, signal) {    try {
      const value = await this.request(
        'GET',
        `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/git/ref/heads/${encodeBranch(branch)}`,
        { signal },
      )
      const commitSha = value?.object?.sha
      if (!commitSha) return null
      return { commitSha }
    } catch (error) {
      if (error?.code === 'not-found' || error?.code === 'conflict') return null
      throw error
    }
  }

  async createRef(repository, branch, commitSha, signal) {
    return this.request('POST', `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/git/refs`, {
      signal,
      body: { ref: `refs/heads/${branch}`, sha: commitSha },
    })
  }

  async updateRef(repository, branch, commitSha, signal) {
    return this.request(
      'PATCH',
      `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/git/refs/heads/${encodeBranch(branch)}`,
      { signal, body: { sha: commitSha, force: false } },
    )
  }

  async getCommit(repository, commitSha, signal) {
    const value = await this.request(
      'GET',
      `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/git/commits/${commitSha}`,
      { signal },
    )
    return { commitSha: value.sha, treeSha: value.tree?.sha, message: value.message }
  }

  /** Recent commits touching a path prefix, newest first. */
  async listCommits(repository, options = {}, signal) {
    const params = new URLSearchParams()
    params.set('per_page', String(options.perPage ?? 10))
    if (options.branch) params.set('sha', options.branch)
    if (options.path) params.set('path', options.path)
    const value = await this.request(
      'GET',
      `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/commits?${params.toString()}`,
      { signal },
    )
    return (Array.isArray(value) ? value : []).map((item) => ({
      sha: item.sha,
      message: String(item.commit?.message ?? '').split('\n')[0],
      date: item.commit?.author?.date ?? item.commit?.committer?.date ?? null,
      author: item.commit?.author?.name ?? null,
      url: item.html_url ?? null,
    }))
  }

  /** Resolve a branch name, tag, full or abbreviated SHA to one commit. */
  async getCommitByRef(repository, ref, signal) {
    const value = await this.request(
      'GET',
      `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/commits/${encodeURIComponent(ref)}`,
      { signal },
    )
    return {
      sha: value.sha,
      treeSha: value.commit?.tree?.sha,
      message: String(value.commit?.message ?? '').split('\n')[0],
      date: value.commit?.author?.date ?? null,
      author: value.commit?.author?.name ?? null,
      additions: value.stats?.additions ?? null,
      deletions: value.stats?.deletions ?? null,
      files: (Array.isArray(value.files) ? value.files : []).map((file) => ({
        path: file.filename,
        status: file.status,
        additions: file.additions ?? 0,
        deletions: file.deletions ?? 0,
      })),
    }
  }

  /** Map of POSIX path -> blob sha for every blob in the tree. */
  async getTree(repository, treeSha, signal) {
    const value = await this.request(
      'GET',
      `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/git/trees/${treeSha}?recursive=1`,
      { signal },
    )
    const files = new Map()
    for (const entry of value?.tree ?? []) {
      if (entry?.type !== 'blob' || !entry.path) continue
      files.set(entry.path, entry.sha)
    }
    return { files, truncated: Boolean(value?.truncated) }
  }

  async createBlob(repository, buffer, signal) {
    const value = await this.request('POST', `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/git/blobs`, {
      signal,
      body: { content: buffer.toString('base64'), encoding: 'base64' },
    })
    return value.sha
  }

  async getBlob(repository, blobSha, signal) {
    const value = await this.request(
      'GET',
      `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/git/blobs/${blobSha}`,
      { signal },
    )
    if (value?.encoding !== 'base64' || typeof value?.content !== 'string') {
      throw new GitHubError('GitHub 返回的 blob 不是 base64 编码', { code: 'protocol' })
    }
    return Buffer.from(value.content, 'base64')
  }

  async createTree(repository, baseTree, entries, signal) {
    const body = { tree: entries }
    if (baseTree) body.base_tree = baseTree
    const value = await this.request(
      'POST',
      `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/git/trees`,
      { signal, body },
    )
    return value.sha
  }

  async createCommit(repository, options, signal) {
    const body = { message: options.message, tree: options.tree, parents: options.parents ?? [] }
    if (options.author) body.author = options.author
    const value = await this.request(
      'POST',
      `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/git/commits`,
      { signal, body },
    )
    return { commitSha: value.sha, treeSha: value.tree?.sha }
  }
}
