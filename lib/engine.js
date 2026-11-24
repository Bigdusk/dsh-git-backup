import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { GitHubClient, GitHubError } from './github.js'
import { createFilter, scanTree, snapshotHash, writeFileAtomic } from './files.js'
import {
  formatBytes,
  gitBlobSha,
  isDirectory,
  parseEnvFile,
  sanitizeSegment,
  upsertEnvFile,
} from './util.js'

const DEFAULT_EXCLUDES = [
  '.git/**',
  'node_modules/**',
  '**/node_modules/**',
  'sessions/**',
  'storages/**',
  '**/*.zstd',
  '**/*.tmp',
  '**/~$*',
  '**/.DS_Store',
  '**/Thumbs.db',
  '.credentials*',
  '**/.credentials*',
  '.env',
  '**/.env',
]

const DEFAULTS = {
  repo: '',
  repoName: 'dsh-backup',
  private: true,
  branch: 'main',
  subdir: '.dsh',
  autoSync: true,
  pollSeconds: 15,
  debounceSeconds: 4,
  layout: 'workspaces',
  remoteRoot: '',
  roots: [],
  include: [],
  exclude: DEFAULT_EXCLUDES,
  maxFileBytes: 26_214_400,
  tokenEnv: 'GITHUB_TOKEN',
  envFile: '',
  apiBase: 'https://api.github.com',
  commitAuthorName: 'dsh-backup',
  commitAuthorEmail: 'dsh-backup@users.noreply.github.com',
}

export function normalizeConfig(config) {
  const input = config && typeof config === 'object' ? config : {}
  const merged = { ...DEFAULTS, ...input }
  return {
    ...merged,
    repo: String(merged.repo ?? '').trim(),
    repoName: String(merged.repoName ?? DEFAULTS.repoName).trim() || DEFAULTS.repoName,
    private: merged.private !== false,
    branch: String(merged.branch ?? DEFAULTS.branch).trim() || DEFAULTS.branch,
    subdir: String(merged.subdir ?? DEFAULTS.subdir).trim() || DEFAULTS.subdir,
    autoSync: merged.autoSync !== false,
    pollSeconds: clampNumber(merged.pollSeconds, 5, 3600, DEFAULTS.pollSeconds),
    debounceSeconds: clampNumber(merged.debounceSeconds, 1, 600, DEFAULTS.debounceSeconds),
    layout: merged.layout === 'root' ? 'root' : 'workspaces',
    remoteRoot: String(merged.remoteRoot ?? '').replace(/^\/+|\/+$/g, ''),
    roots: (Array.isArray(merged.roots) ? merged.roots : []).filter((item) => typeof item === 'string' && item.trim() !== ''),
    include: Array.isArray(merged.include) ? merged.include : [],
    exclude: Array.isArray(merged.exclude) ? merged.exclude : DEFAULT_EXCLUDES,
    maxFileBytes: clampNumber(merged.maxFileBytes, 1024, 95 * 1024 * 1024, DEFAULTS.maxFileBytes),
    tokenEnv: String(merged.tokenEnv ?? DEFAULTS.tokenEnv).trim() || DEFAULTS.tokenEnv,
    envFile: String(merged.envFile ?? '').trim(),
    apiBase: String(merged.apiBase ?? DEFAULTS.apiBase).replace(/\/+$/, '') || DEFAULTS.apiBase,
    commitAuthorName: String(merged.commitAuthorName ?? DEFAULTS.commitAuthorName),
    commitAuthorEmail: String(merged.commitAuthorEmail ?? DEFAULTS.commitAuthorEmail),
  }
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.round(number)))
}

function isFile(target) {
  try {
    return fs.statSync(target).isFile()
  } catch {
    return false
  }
}

/** Run an async mapper over items with bounded concurrency, preserving order. */
async function mapLimit(items, limit, mapper, signal) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = new Array(Math.max(1, Math.min(limit, items.length))).fill(null).map(async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      if (signal?.aborted) return
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

function describeError(error) {
  if (error instanceof GitHubError) return error.message
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * Owns the GitHub side of a `.dsh` backup and the per-workspace sync state.
 * The plugin owns timers and tool registration; this class stays transport-free.
 */
export class BackupEngine {
  constructor(options) {
    this.cfg = normalizeConfig(options?.config)
    this.home = options?.home ?? ''
    this.log = options?.log ?? (() => {})
    this.state = new Map()
    this.locks = new Map()
    this.blobCache = new Map()
    this.blobCacheDirty = false
    this.loadBlobCache()
  }

  /** Persistent mtime+size -> git blob sha cache, so pushes stop re-reading files. */
  blobCachePath() {
    const home = this.home || process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
    return path.join(home, 'dsh-git-backup', 'blob-cache.json')
  }

  loadBlobCache() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.blobCachePath(), 'utf8'))
      for (const [file, value] of Object.entries(raw?.entries ?? {})) {
        if (value && typeof value.sha === 'string') {
          this.blobCache.set(file, { size: Number(value.s) || 0, mtimeMs: Number(value.m) || 0, sha: value.sha })
        }
      }
    } catch {
      /* no cache yet */
    }
  }

  saveBlobCache() {
    if (!this.blobCacheDirty) return
    try {
      const entries = {}
      let count = 0
      for (const [file, value] of this.blobCache) {
        if (count >= 20000) break
        entries[file] = { s: value.size, m: value.mtimeMs, sha: value.sha }
        count += 1
      }
      const file = this.blobCachePath()
      fs.mkdirSync(path.dirname(file), { recursive: true })
      writeFileAtomic(file, Buffer.from(JSON.stringify({ version: 1, entries }), 'utf8'))
      this.blobCacheDirty = false
    } catch {
      /* cache is an optimization only */
    }
  }

  /** Git blob sha for one file, reusing the cache while mtime and size match. */
  blobShaFor(absolute, stat) {
    let info = stat
    if (!info) {
      try {
        info = fs.statSync(absolute)
      } catch {
        return null
      }
    }
    const cached = this.blobCache.get(absolute)
    if (cached && cached.size === info.size && cached.mtimeMs === info.mtimeMs) return cached.sha
    let sha
    try {
      sha = gitBlobSha(fs.readFileSync(absolute))
    } catch {
      return null
    }
    this.blobCache.set(absolute, { size: info.size, mtimeMs: info.mtimeMs, sha })
    this.blobCacheDirty = true
    return sha
  }

  /** Cross-process mutex for the workspace registry file. */
  registryLockPath() {
    return this.registryPath().replace(/workspaces\.json$/, 'workspaces.lock')
  }

  withRegistryLock(operation) {
    const lockFile = this.registryLockPath()
    fs.mkdirSync(path.dirname(lockFile), { recursive: true })
    const deadline = Date.now() + 3000
    let handle = null
    while (handle === null && Date.now() < deadline) {
      try {
        handle = fs.openSync(lockFile, 'wx')
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error
        try {
          const stat = fs.statSync(lockFile)
          if (Date.now() - stat.mtimeMs > 30_000) fs.rmSync(lockFile, { force: true })
        } catch {
          /* another writer released it */
        }
        const pauseUntil = Date.now() + 20
        while (Date.now() < pauseUntil) {
          /* short spin, registry writes are tiny */
        }
      }
    }
    if (handle === null) throw new Error('工作区注册表被其他进程占用，请稍后再试')
    try {
      fs.writeSync(handle, `${process.pid}`)
      return operation()
    } finally {
      try {
        fs.closeSync(handle)
      } catch {
        /* ignore */
      }
      try {
        fs.rmSync(lockFile, { force: true })
      } catch {
        /* ignore */
      }
    }
  }

  /** Serialize every restore/push on one workspace so commits are never torn. */
  withLock(root, operation) {
    const key = path.resolve(root)
    const previous = this.locks.get(key) ?? Promise.resolve()
    const next = previous.then(() => operation())
    this.locks.set(
      key,
      next.then(
        () => undefined,
        () => undefined,
      ),
    )
    return next
  }

  /** Plugin-owned UI preferences (no profile write, no plugin restart). */
  prefsPath() {
    const home = this.home || process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
    return path.join(home, 'dsh-git-backup', 'prefs.json')
  }

  loadPrefs() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.prefsPath(), 'utf8'))
      return raw && typeof raw === 'object' ? raw : {}
    } catch {
      return {}
    }
  }

  savePrefs(prefs) {
    const file = this.prefsPath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(prefs, null, 2), 'utf8')
    return prefs
  }

  applyPrefs() {
    const prefs = this.loadPrefs()
    if (typeof prefs.autoSync === 'boolean') this.cfg.autoSync = prefs.autoSync
    return prefs
  }

  /** Runtime + persisted auto-sync switch (no config edit, no restart). */
  setAutoSync(enabled, options = {}) {
    const prefs = this.loadPrefs()
    if (options.persist !== false) {
      prefs.autoSync = enabled !== false
      this.savePrefs(prefs)
    }
    this.cfg.autoSync = enabled !== false
    return this.cfg.autoSync
  }

  /** Integrity + repository health for one workspace. */
  async health(rootDir, options = {}) {
    const cfg = this.cfg
    const signal = options.signal
    const { token } = this.resolveToken()
    const client = this.client(token)
    const repository = await client.resolveRepository(
      { repo: cfg.repo, repoName: cfg.repoName, private: cfg.private, autoCreate: false },
      signal,
    )
    const info = await client.request(
      'GET',
      `/repos/${repository.owner}/${repository.name}`,
      { signal },
    )
    const ref = await client.getRef(repository, cfg.branch, signal)
    const remoteFiles = new Map()
    if (ref) {
      const commit = await client.getCommit(repository, ref.commitSha, signal)
      const tree = await client.getTree(repository, commit.treeSha, signal)
      for (const [remotePath, sha] of tree.files) remoteFiles.set(remotePath, sha)
    }
    const prefix = String(options.remoteRoot ?? '').trim() || this.remotePrefix(rootDir)
    const prefixKey = prefix ? `${prefix.replace(/\/+$/, '')}/` : ''
    const under = new Map()
    for (const [remotePath, sha] of remoteFiles) {
      if (!prefixKey) under.set(remotePath, sha)
      else if (remotePath.startsWith(prefixKey)) under.set(remotePath.slice(prefixKey.length), sha)
    }
    const local = this.fingerprint(rootDir).files
    const localMap = new Map(local.map((file) => [file.rel, file]))
    let same = 0
    const mismatch = []
    const missing = []
    for (const file of local) {
      const remoteSha = under.get(file.rel)
      if (!remoteSha) {
        missing.push(file.rel)
        continue
      }
      try {
        if (this.blobShaFor(file.abs) === remoteSha) same += 1
        else mismatch.push(file.rel)
      } catch {
        mismatch.push(file.rel)
      }
    }
    const extra = [...under.keys()].filter((rel) => !localMap.has(rel))
    this.saveBlobCache()
    return {
      repository: repository.fullName,
      private: Boolean(info?.private),
      repoSizeKb: typeof info?.size === 'number' ? info.size : null,
      branch: cfg.branch,
      prefix,
      head: ref?.commitSha ?? null,
      remoteCount: under.size,
      localCount: local.length,
      same,
      mismatch,
      missing,
      extra,
    }
  }

  /** Commit patch for one version, optionally filtered by a path fragment. */
  async diff(rootDir, ref, options = {}) {
    const detail = await this.detail(rootDir, ref, options)
    const only = String(options.path ?? '').trim()
    const files = (detail.commit.files ?? []).filter((file) => !only || file.path.includes(only))
    return { ...detail, requested: only, files }
  }

  /** Remove the persisted token from the dotenv file (and the live env). */
  clearToken(envVar) {
    const name = String(envVar ?? '').trim() || this.cfg.tokenEnv || 'GITHUB_TOKEN'
    const envFile = this.envFilePath()
    let existing = ''
    try {
      existing = fs.readFileSync(envFile, 'utf8')
    } catch {
      return { envFile, envVar: name, removed: false }
    }
    const pattern = new RegExp(`^\\s*(?:export\\s+)?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`)
    const lines = existing.split(/\r?\n/)
    const matched = lines.some((line) => pattern.test(line))
    if (!matched) return { envFile, envVar: name, removed: false }
    fs.writeFileSync(envFile, `${lines.filter((line) => !pattern.test(line)).join('\n').replace(/\n+$/, '')}\n`, 'utf8')
    delete process.env[name]
    return { envFile, envVar: name, removed: true }
  }

  /** Mutable runtime view of one workspace's sync state. */
  rootState(rootDir) {
    const key = path.resolve(rootDir)
    let state = this.state.get(key)
    if (!state) {
      state = {
        root: key,
        hash: null,
        pending: false,
        busy: false,
        lastPushAt: null,
        lastPushSummary: null,
        lastCommit: null,
        lastVerifyAt: null,
        lastError: null,
        lastStatus: null,
        lastRollback: null,
      }
      this.state.set(key, state)
    }
    return state
  }

  localFolder(rootDir) {
    return path.join(path.resolve(rootDir), this.cfg.subdir)
  }

  /** Remote path prefix this workspace maps to inside the repository. */
  remotePrefix(rootDir) {
    if (this.cfg.remoteRoot) return this.cfg.remoteRoot
    if (this.cfg.layout === 'root') return ''
    return `workspaces/${sanitizeSegment(path.basename(path.resolve(rootDir)))}`
  }

  envFilePath() {
    if (this.cfg.envFile) return this.cfg.envFile
    const home = this.home || process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
    return path.join(home, '.env')
  }

  /** Resolve a token without persisting it anywhere. */
  resolveToken(options = {}) {
    const names = [this.cfg.tokenEnv, 'GITHUB_TOKEN', 'GH_TOKEN'].filter(
      (name, index, list) => typeof name === 'string' && name !== '' && list.indexOf(name) === index,
    )
    for (const name of names) {
      const value = process.env[name]
      if (typeof value === 'string' && value.trim() !== '') {
        return { token: value.trim(), source: `环境变量 ${name}` }
      }
    }
    const envFile = this.envFilePath()
    if (isFile(envFile)) {
      let values
      try {
        values = parseEnvFile(fs.readFileSync(envFile, 'utf8'))
      } catch {
        values = new Map()
      }
      for (const name of names) {
        const value = values.get(name)
        if (typeof value === 'string' && value.trim() !== '') {
          const token = value.trim()
          process.env[name] = token
          return { token, source: `${envFile} 中的 ${name}` }
        }
      }
    }
    if (options.required === false) return { token: null, source: null }
    throw new Error(
      `没有找到 GitHub token。请把 ${this.cfg.tokenEnv}=ghp_xxx 写进 ${envFile}，或调用 dsh_backup_set_token 工具保存。`,
    )
  }

  client(token) {
    return new GitHubClient({
      token,
      apiBase: this.cfg.apiBase,
      userAgent: `dsh-git-backup/1.0.0 (+${os.platform()})`,
    })
  }

  /** Validate a token and persist it into the DSH_HOME dotenv file. */
  async saveToken(token, options = {}) {
    const value = String(token ?? '').trim()
    if (!/^(gh[pousr]_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,})$/.test(value)) {
      throw new Error('这看起来不是 GitHub token：应以 ghp_ / gho_ / ghu_ / ghs_ / ghr_ 或 github_pat_ 开头')
    }
    const account = await this.client(value).user(options.signal)
    const envVar = String(options.envVar ?? '').trim() || this.cfg.tokenEnv
    const envFile = this.envFilePath()
    let existing = ''
    try {
      existing = fs.readFileSync(envFile, 'utf8')
    } catch {
      existing = ''
    }
    fs.mkdirSync(path.dirname(envFile), { recursive: true })
    fs.writeFileSync(envFile, upsertEnvFile(existing, envVar, value), { encoding: 'utf8', mode: 0o600 })
    process.env[envVar] = value
    return { login: account.login, envFile, envVar }
  }

  /** Cheap fingerprint of one workspace's backed-up folder. */
  fingerprint(rootDir) {
    const folder = this.localFolder(rootDir)
    if (!isDirectory(folder)) {
      return { folder, exists: false, files: [], skipped: [], hash: null, bytes: 0 }
    }
    const { files, skipped } = scanTree(folder, this.cfg)
    return {
      folder,
      exists: true,
      files,
      skipped,
      hash: snapshotHash(files),
      bytes: files.reduce((total, file) => total + file.size, 0),
    }
  }

  /** Path of the plugin-owned workspace registry file. */
  registryPath() {
    const home = this.home || process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
    return path.join(home, 'dsh-git-backup', 'workspaces.json')
  }

  loadRegistry() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.registryPath(), 'utf8'))
      return {
        disabled: (Array.isArray(raw?.disabled) ? raw.disabled : []).filter((item) => typeof item === 'string'),
        extra: (Array.isArray(raw?.extra) ? raw.extra : []).filter((item) => typeof item === 'string'),
      }
    } catch {
      return { disabled: [], extra: [] }
    }
  }

  saveRegistry(registry) {
    const file = this.registryPath()
    const body = JSON.stringify(
      { disabled: [...new Set(registry.disabled)], extra: [...new Set(registry.extra)] },
      null,
      2,
    )
    return this.withRegistryLock(() => {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      writeFileAtomic(file, Buffer.from(body, 'utf8'))
      return this.loadRegistry()
    })
  }

  updateRegistry(mutate) {
    return this.withRegistryLock(() => {
      const current = this.loadRegistry()
      const next = mutate({ disabled: [...current.disabled], extra: [...current.extra] }) ?? current
      const merged = {
        disabled: [...new Set(next.disabled ?? [])],
        extra: [...new Set(next.extra ?? [])],
      }
      const file = this.registryPath()
      fs.mkdirSync(path.dirname(file), { recursive: true })
      writeFileAtomic(file, Buffer.from(JSON.stringify(merged, null, 2), 'utf8'))
      return merged
    })
  }

  /** Every known workspace with its backup state, including disabled/added ones. */
  workspaceEntries(candidates = []) {
    const registry = this.loadRegistry()
    const roots = new Set()
    for (const candidate of [
      ...(Array.isArray(candidates) ? candidates : []),
      ...this.cfg.roots,
      ...registry.extra,
    ]) {
      if (typeof candidate !== 'string' || candidate.trim() === '') continue
      try {
        roots.add(path.resolve(candidate))
      } catch {
        /* ignore malformed paths */
      }
    }
    const entries = []
    for (const root of roots) {
      const folder = this.localFolder(root)
      const exists = isDirectory(folder)
      let files = 0
      let bytes = 0
      if (exists) {
        try {
          const snapshot = this.fingerprint(root)
          files = snapshot.files.length
          bytes = snapshot.bytes
        } catch {
          /* keep zeroes */
        }
      }
      entries.push({
        root,
        name: path.basename(root),
        folder,
        exists,
        files,
        bytes,
        remotePrefix: this.remotePrefix(root),
        disabled: registry.disabled.includes(root),
        extra: registry.extra.includes(root),
      })
    }
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    return entries
  }

  /** Workspace directories that are actively backed up. */
  discoverRoots(candidates = []) {
    return this.workspaceEntries(candidates)
      .filter((entry) => entry.exists && !entry.disabled)
      .map((entry) => entry.root)
  }

  /** Add an existing workspace directory to the backup set. */
  workspaceAdd(pathArg) {
    const resolved = path.resolve(String(pathArg ?? '').trim())
    if (!isDirectory(this.localFolder(resolved))) {
      throw new Error(`没有找到 ${path.join(resolved, this.cfg.subdir)}`)
    }
    this.updateRegistry((registry) => ({
      disabled: registry.disabled.filter((item) => item !== resolved),
      extra: [...registry.extra, resolved],
    }))
    return resolved
  }

  /** Stop backing up a workspace: drop an explicit entry, otherwise disable it. */
  workspaceRemove(pathArg) {
    const resolved = path.resolve(String(pathArg ?? '').trim())
    const registry = this.loadRegistry()
    if (registry.extra.includes(resolved)) {
      this.updateRegistry((current) => ({
        disabled: current.disabled.filter((item) => item !== resolved),
        extra: current.extra.filter((item) => item !== resolved),
      }))
    } else {
      this.updateRegistry((current) => ({
        disabled: [...new Set([...current.disabled, resolved])],
        extra: current.extra.filter((item) => item !== resolved),
      }))
    }
    return resolved
  }

  /** Enable or disable one workspace without removing its backup history. */
  workspaceSetEnabled(pathArg, enabled) {
    const resolved = path.resolve(String(pathArg ?? '').trim())
    this.updateRegistry((registry) => ({
      disabled: enabled
        ? registry.disabled.filter((item) => item !== resolved)
        : [...new Set([...registry.disabled, resolved])],
      extra: registry.extra,
    }))
    return resolved
  }

  /** Recent backup commits that touched this workspace's remote folder. */
  async history(rootDir, limit = 10, options = {}) {
    const cfg = this.cfg
    const signal = options.signal
    const { token } = this.resolveToken()
    const client = this.client(token)
    const repository = await client.resolveRepository(
      { repo: cfg.repo, repoName: cfg.repoName, private: cfg.private, autoCreate: false },
      signal,
    )
    const prefix = String(options.remoteRoot ?? '').trim() || this.remotePrefix(rootDir)
    const prefixKey = prefix ? `${prefix.replace(/\/+$/, '')}/` : ''
    const items = await client.listCommits(
      repository,
      { branch: cfg.branch, path: prefixKey || undefined, perPage: clampNumber(limit, 1, 100, 10) },
      signal,
    )
    return {
      repository: repository.fullName,
      branch: cfg.branch,
      prefix,
      items: items.map((item) => ({
        sha: item.sha,
        short: item.sha.slice(0, 10),
        date: item.date,
        message: item.message,
        author: item.author,
        url: item.url ?? `https://github.com/${repository.fullName}/commit/${item.sha}`,
      })),
    }
  }

  /**
   * Restore the workspace's `.dsh` folder from a past commit. Accepts a full or
   * abbreviated SHA, a branch/tag name, or a 1-based version number from
   * `history`. With `push` (default true) the restored content becomes a new
   * commit, so local and remote stay in step.
   */
  async rollback(rootDir, ref, options = {}) {
    const root = path.resolve(rootDir)
    if (!options.skipLock) {
      return this.withLock(root, () => this.rollback(root, ref, { ...options, skipLock: true }).finally(() => this.saveBlobCache()))
    }
    const cfg = this.cfg
    const signal = options.signal
    const folder = this.localFolder(root)
    if (!isDirectory(folder)) throw new Error(`没有找到 ${folder}`)
    let target = String(ref ?? '').trim()
    if (target === '') throw new Error('缺少版本号或提交号')
    const onlyPaths = (Array.isArray(options.paths) ? options.paths : [])
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
    const selected = (relative) =>
      onlyPaths.length === 0 ||
      onlyPaths.some((prefix) => relative === prefix || relative.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))

    const { token } = this.resolveToken()
    const client = this.client(token)
    const repository = await client.resolveRepository(
      { repo: cfg.repo, repoName: cfg.repoName, private: cfg.private, autoCreate: false },
      signal,
    )
    const prefix = String(options.remoteRoot ?? '').trim() || this.remotePrefix(root)
    const prefixKey = prefix ? `${prefix.replace(/\/+$/, '')}/` : ''

    if (/^\d+$/.test(target)) {
      const index = Number(target)
      const list = await this.history(root, Math.max(index, 10), { signal, remoteRoot: prefix })
      const item = list.items[index - 1]
      if (!item) throw new Error(`没有第 ${index} 个版本（共 ${list.items.length} 个）`)
      target = item.sha
    }

    const commit = await client.getCommitByRef(repository, target, signal)
    if (!commit?.sha) throw new Error(`无法解析版本 ${target}`)
    const tree = await client.getTree(repository, commit.treeSha, signal)
    const entries = new Map()
    for (const [remotePath, sha] of tree.files) {
      if (!prefixKey) entries.set(remotePath, sha)
      else if (remotePath.startsWith(prefixKey)) entries.set(remotePath.slice(prefixKey.length), sha)
    }
    if (entries.size === 0) {
      throw new Error(`版本 ${commit.sha.slice(0, 10)} 里没有 ${prefix || '(仓库根目录)'} 下的文件`)
    }
    if (onlyPaths.length > 0) {
      for (const relative of [...entries.keys()]) {
        if (!selected(relative)) entries.delete(relative)
      }
      if (entries.size === 0) throw new Error(`这个版本里没有匹配 ${onlyPaths.join(', ')} 的文件`)
    }

    let headBefore = null
    if (!options.dryRun) {
      try {
        headBefore = (await client.getRef(repository, cfg.branch, signal))?.commitSha ?? null
      } catch {
        headBefore = null
      }
    }
    const protectedPush = await this.protectLocalChanges(root, { ...options, remoteRoot: prefix })
    const undoCommit = protectedPush && !protectedPush.upToDate ? protectedPush.commitSha ?? headBefore : headBefore

    const filter = createFilter(cfg)
    const results = await mapLimit(
      [...entries],
      4,
      async ([rel, blobSha]) => {
        if (!filter(rel)) return { rel, state: 'excluded' }
        const absolute = path.join(folder, ...rel.split('/'))
        if (isFile(absolute)) {
          try {
            if (this.blobShaFor(absolute) === blobSha) return { rel, state: 'same' }
          } catch {
            /* rewrite below */
          }
        }
        if (options.dryRun) return { rel, state: 'would-write' }
        try {
          const buffer = await client.getBlob(repository, blobSha, signal)
          writeFileAtomic(absolute, buffer)
          return { rel, state: 'written' }
        } catch (error) {
          return { rel, state: 'failed', error: describeError(error) }
        }
      },
      signal,
    )

    const written = results.filter((item) => item?.state === 'written').map((item) => item.rel)
    const wouldWrite = results.filter((item) => item?.state === 'would-write').map((item) => item.rel)
    const same = results.filter((item) => item?.state === 'same').map((item) => item.rel)
    const failures = results.filter((item) => item?.state === 'failed')
    const removed = []
    const wouldRemove = []
    if (options.dryRun) {
      for (const file of scanTree(folder, cfg).files) {
        if (selected(file.rel) && !entries.has(file.rel)) wouldRemove.push(file.rel)
      }
    } else {
      for (const file of scanTree(folder, cfg).files) {
        if (!selected(file.rel) || entries.has(file.rel)) continue
        try {
          fs.rmSync(file.abs, { force: true })
          removed.push(file.rel)
        } catch {
          /* best effort */
        }
      }
    }

    let committed = null
    const state = this.rootState(root)
    if (!options.dryRun) {
      if (options.push === false) {
        state.hash = this.fingerprint(root).hash
        state.pending = false
        state.lastError = null
      } else {
        committed = await this.push(root, {
          skipLock: true,
          source: 'manual',
          kind: 'rollback',
          message:
            String(options.message ?? '').trim() ||
            `rollback(${sanitizeSegment(path.basename(root))}): restore ${commit.sha.slice(0, 10)} (${commit.message})`,
          signal,
        })
      }
    }

    if (!options.dryRun) {
      state.lastRollback = { fromSha: undoCommit, toSha: commit.sha, prefix, paths: onlyPaths, at: Date.now() }
    }

    return {
      repository: repository.fullName,
      branch: cfg.branch,
      prefix,
      paths: onlyPaths,
      undoCommit,
      protectedCommit: protectedPush && !protectedPush.upToDate ? protectedPush.commitUrl ?? null : null,
      commit: { sha: commit.sha, short: commit.sha.slice(0, 10), message: commit.message, date: commit.date },
      total: entries.size,
      written,
      wouldWrite,
      same,
      removed,
      wouldRemove,
      failures,
      dryRun: Boolean(options.dryRun),
      pushed: committed && !committed.upToDate ? committed : null,
      folder,
    }
  }

  async push(rootDir, options = {}) {
    const root = path.resolve(rootDir)
    if (!options.skipLock) {
      return this.withLock(root, () => this.push(root, { ...options, skipLock: true }).finally(() => this.saveBlobCache()))
    }
    const state = this.rootState(root)
    if (state.busy && !options.force) throw new Error('这个工作区正在同步，等这次完成再试')
    state.busy = true
    try {
      let attempt = 0
      for (;;) {
        try {
          return await this.pushOnce(root, state, options)
        } catch (error) {
          const retryable = error instanceof GitHubError && (error.code === 'conflict' || error.status === 409)
          attempt += 1
          if (!retryable || attempt > 1 || options.dryRun) throw error
          this.log('push 遇到引用冲突，重试一次')
        }
      }
    } finally {
      state.busy = false
    }
  }

  async pushOnce(root, state, options) {
    const cfg = this.cfg
    const signal = options.signal
    const snapshot = this.fingerprint(root)
    if (!snapshot.exists) throw new Error(`没有找到 ${snapshot.folder}`)
    if (snapshot.files.length === 0) throw new Error(`${snapshot.folder} 里没有可备份的文件`)

    const { token } = this.resolveToken()
    const client = this.client(token)
    const repository = await client.resolveRepository(
      {
        repo: cfg.repo,
        repoName: cfg.repoName,
        private: cfg.private,
        description: 'DeepSeek Harness .dsh backup',
        autoCreate: options.dryRun !== true,
      },
      signal,
    )
    const prefix = String(options.remoteRoot ?? '').trim().replace(/^\/+|\/+$/g, '') || this.remotePrefix(root)
    const prefixKey = prefix ? `${prefix}/` : ''

    let baseRef = await client.getRef(repository, cfg.branch, signal)
    let fallbackRef = null
    if (!baseRef && repository.defaultBranch && repository.defaultBranch !== cfg.branch) {
      fallbackRef = await client.getRef(repository, repository.defaultBranch, signal)
    }
    let baseCommit = null
    let baseTree = null
    if (baseRef) {
      const commit = await client.getCommit(repository, baseRef.commitSha, signal)
      baseCommit = baseRef.commitSha
      baseTree = commit.treeSha
    } else if (fallbackRef) {
      const commit = await client.getCommit(repository, fallbackRef.commitSha, signal)
      baseCommit = fallbackRef.commitSha
      baseTree = commit.treeSha
    }

    // Remote moved since our last sync: another machine or the GitHub UI wrote.
    // Automatic runs stop instead of silently overwriting that work.
    if (
      baseRef &&
      state.lastRemoteHead &&
      baseRef.commitSha !== state.lastRemoteHead &&
      options.source !== 'manual' &&
      options.noDelete !== true &&
      options.allowOverwrite !== true
    ) {
      state.lastError = `远端有新提交（${baseRef.commitSha.slice(0, 10)}），疑似其他设备写入，已暂停自动提交`
      throw new Error(`${state.lastError}。确认要以本地覆盖请手动点「立即提交」（或传 allowOverwrite）。`)
    }

    const remoteUnderPrefix = new Map()
    if (baseTree) {
      const tree = await client.getTree(repository, baseTree, signal)
      for (const [remotePath, sha] of tree.files) {
        if (!prefixKey) remoteUnderPrefix.set(remotePath, sha)
        else if (remotePath.startsWith(prefixKey)) remoteUnderPrefix.set(remotePath.slice(prefixKey.length), sha)
      }
    }

    const localPaths = new Set(snapshot.files.map((file) => file.rel))
    const changed = []
    const unchanged = []
    for (const file of snapshot.files) {
      const localSha = this.blobShaFor(file.abs)
      if (remoteUnderPrefix.get(file.rel) === localSha) {
        unchanged.push(file.rel)
      } else {
        changed.push({ file, buffer: fs.readFileSync(file.abs) })
      }
    }
    const removed =
      options.noDelete === true ? [] : [...remoteUnderPrefix.keys()].filter((rel) => !localPaths.has(rel))
    const summary = {
      repo: repository.fullName,
      branch: cfg.branch,
      prefix,
      added: changed.length,
      unchanged: unchanged.length,
      removed: removed.length,
      skipped: snapshot.skipped.map((item) => item.rel),
      files: snapshot.files.length,
      bytes: snapshot.bytes,
      dryRun: false,
    }

    if (changed.length === 0 && removed.length === 0) {
      state.hash = snapshot.hash
      state.pending = false
      state.lastError = null
      state.lastVerifyAt = Date.now()
      state.lastRemoteHead = baseRef?.commitSha ?? baseCommit ?? null
      return { ...summary, upToDate: true, changedPaths: [], removedPaths: [] }
    }
    if (options.dryRun) {
      return { ...summary, dryRun: true, changedPaths: changed.map((item) => item.file.rel), removedPaths: removed }
    }

    const blobShas = await mapLimit(
      changed,
      4,
      async (item) => client.createBlob(repository, item.buffer, signal),
      signal,
    )
    if (signal?.aborted) throw new Error('同步已取消')
    const entries = changed.map((item, index) => ({
      path: `${prefixKey}${item.file.rel}`,
      mode: '100644',
      type: 'blob',
      sha: blobShas[index],
    }))
    for (const rel of removed) entries.push({ path: `${prefixKey}${rel}`, mode: '100644', type: 'blob', sha: null })

    const treeSha = await client.createTree(repository, baseTree, entries, signal)
    const kind = options.kind ?? 'backup'
    const examples = changed.slice(0, 3).map((item) => path.basename(item.file.rel)).join('、')
    const message =
      String(options.message ?? '').trim() ||
      `${kind}(${sanitizeSegment(path.basename(root))}): ${changed.length} 个文件更新${
        removed.length > 0 ? `，${removed.length} 个删除` : ''
      }${examples ? ` · ${examples}` : ''} @ ${new Date().toISOString()}`
    const commit = await client.createCommit(
      repository,
      {
        message,
        tree: treeSha,
        parents: baseCommit ? [baseCommit] : [],
        author: { name: cfg.commitAuthorName, email: cfg.commitAuthorEmail },
      },
      signal,
    )
    if (baseRef) await client.updateRef(repository, cfg.branch, commit.commitSha, signal)
    else await client.createRef(repository, cfg.branch, commit.commitSha, signal)

    const after = this.fingerprint(root)
    state.hash = after.hash
    state.lastRemoteHead = commit.commitSha
    state.pending = false
    state.lastError = null
    state.lastPushAt = Date.now()
    state.lastPushSummary = summary
    state.lastCommit = {
      sha: commit.commitSha,
      url: `https://github.com/${repository.fullName}/commit/${commit.commitSha}`,
      message,
      changed: changed.length,
      removed: removed.length,
      at: Date.now(),
    }
    return {
      ...summary,
      createdRepository: repository.created,
      commitSha: commit.commitSha,
      commitUrl: state.lastCommit.url,
      message,
      changedPaths: changed.map((item) => item.file.rel),
      removedPaths: removed,
    }
  }

  /** One version's changed files and line counts. */
  async detail(rootDir, ref, options = {}) {
    const cfg = this.cfg
    const signal = options.signal
    const { token } = this.resolveToken()
    const client = this.client(token)
    const repository = await client.resolveRepository(
      { repo: cfg.repo, repoName: cfg.repoName, private: cfg.private, autoCreate: false },
      signal,
    )
    let target = String(ref ?? '').trim()
    if (target === '') throw new Error('缺少版本号或提交号')
    if (/^\d+$/.test(target)) {
      const index = Number(target)
      const list = await this.history(rootDir, Math.max(index, 10), { signal })
      const item = list.items[index - 1]
      if (!item) throw new Error(`没有第 ${index} 个版本（共 ${list.items.length} 个）`)
      target = item.sha
    }
    const commit = await client.getCommitByRef(repository, target, signal)
    return {
      repository: repository.fullName,
      branch: cfg.branch,
      prefix: String(options.remoteRoot ?? '').trim() || this.remotePrefix(rootDir),
      commit,
    }
  }

  /**
   * Save unsynced local content before a restore overwrites it. The push never
   * deletes remote-only files, so an empty or partial local folder can never
   * wipe the backup.
   */
  async protectLocalChanges(rootDir, options = {}) {
    if (options.dryRun || options.protect === false) return null
    const root = path.resolve(rootDir)
    const snapshot = this.fingerprint(root)
    if (!snapshot.exists || snapshot.files.length === 0) return null
    try {
      return await this.push(root, {
        skipLock: true,
        noDelete: true,
        source: 'manual',
        kind: 'autosave',
        remoteRoot: options.remoteRoot,
        message: `autosave-before-restore(${sanitizeSegment(path.basename(root))}): ${snapshot.files.length} 个文件 @ ${new Date().toISOString()}`,
      })
    } catch (error) {
      if (options.force === true) return null
      throw new Error(`恢复前无法先保存当前改动：${error?.message ?? String(error)}（确认要覆盖请传 force: true）`)
    }
  }

  /** Revert the most recent rollback by restoring the pre-rollback commit. */
  async undoRollback(rootDir, options = {}) {
    const root = path.resolve(rootDir)
    const state = this.rootState(root)
    const last = state.lastRollback
    if (!last || !last.fromSha) throw new Error('没有可撤销的回滚（本进程内还没有回滚记录）')
    const result = await this.rollback(root, last.fromSha, {
      signal: options.signal,
      push: options.push,
      force: true,
      protect: options.protect,
      remoteRoot: last.prefix,
      message: `undo-rollback(${sanitizeSegment(path.basename(root))}): 回到 ${String(last.fromSha).slice(0, 10)}`,
    })
    state.lastRollback = null
    return result
  }

  async pull(rootDir, options = {}) {
    const root = path.resolve(rootDir)
    if (!options.skipLock) return this.withLock(root, () => this.pull(root, { ...options, skipLock: true }))
    const cfg = this.cfg
    const signal = options.signal
    const folder = this.localFolder(root)
    const { token } = this.resolveToken()
    const client = this.client(token)
    const repository = await client.resolveRepository(
      { repo: cfg.repo, repoName: cfg.repoName, private: cfg.private, autoCreate: false },
      signal,
    )
    const ref = await client.getRef(repository, cfg.branch, signal)
    if (!ref) throw new Error(`仓库 ${repository.fullName} 的 ${cfg.branch} 分支还没有备份内容`)
    const commit = await client.getCommit(repository, ref.commitSha, signal)
    const tree = await client.getTree(repository, commit.treeSha, signal)

    const prefix = String(options.remoteRoot ?? '').trim() || this.remotePrefix(root)
    const prefixKey = prefix ? `${prefix.replace(/\/+$/, '')}/` : ''
    const entries = new Map()
    for (const [remotePath, sha] of tree.files) {
      if (!prefixKey) entries.set(remotePath, sha)
      else if (remotePath.startsWith(prefixKey)) entries.set(remotePath.slice(prefixKey.length), sha)
    }
    if (entries.size === 0) throw new Error(`仓库 ${repository.fullName} 里没有 ${prefix || '(根目录)'} 下的文件`)

    const filter = createFilter(cfg)
    const protectedPush = await this.protectLocalChanges(root, { ...options, remoteRoot: prefix })
    const results = await mapLimit(
      [...entries],
      4,
      async ([rel, blobSha]) => {
        if (!filter(rel)) return { rel, state: 'excluded' }
        const target = path.join(folder, ...rel.split('/'))
        if (isFile(target)) {
          try {
            if (this.blobShaFor(target) === blobSha) return { rel, state: 'same' }
          } catch {
            /* fall through and rewrite */
          }
        }
        if (options.dryRun) return { rel, state: 'would-write' }
        try {
          const buffer = await client.getBlob(repository, blobSha, signal)
          writeFileAtomic(target, buffer)
          return { rel, state: 'written' }
        } catch (error) {
          return { rel, state: 'failed', error: describeError(error) }
        }
      },
      signal,
    )

    const written = results.filter((item) => item?.state === 'written').map((item) => item.rel)
    const wouldWrite = results.filter((item) => item?.state === 'would-write').map((item) => item.rel)
    const same = results.filter((item) => item?.state === 'same').map((item) => item.rel)
    const excluded = results.filter((item) => item?.state === 'excluded').map((item) => item.rel)
    const failures = results.filter((item) => item?.state === 'failed')

    let pruned = []
    if (options.prune && !options.dryRun) {
      const local = scanTree(folder, cfg).files
      for (const file of local) {
        if (!entries.has(file.rel)) {
          try {
            fs.rmSync(file.abs, { force: true })
            pruned.push(file.rel)
          } catch {
            /* best effort */
          }
        }
      }
    }

    const summary = {
      repo: repository.fullName,
      branch: cfg.branch,
      prefix,
      protectedCommit: protectedPush && !protectedPush.upToDate ? protectedPush.commitUrl ?? null : null,
      headCommit: ref.commitSha,
      total: entries.size,
      written,
      wouldWrite,
      same,
      excluded,
      pruned,
      failures,
      dryRun: Boolean(options.dryRun),
      folder,
    }
    const state = this.rootState(root)
    if (!options.dryRun) {
      const after = this.fingerprint(root)
      state.hash = after.hash
      state.pending = false
      state.lastRemoteHead = ref.commitSha
      state.lastError = failures.length > 0 ? `${failures.length} 个文件拉取失败` : null
    }
    this.saveBlobCache()
    return summary
  }

  async status(options = {}) {
    const cfg = this.cfg
    const tokenInfo = this.resolveToken({ required: false })
    let tokenExpiry = null
    const roots = (options.roots ?? []).map((root) => {
      const state = this.rootState(root)
      const snapshot = this.fingerprint(root)
      return {
        root: path.resolve(root),
        name: path.basename(path.resolve(root)),
        folder: snapshot.folder,
        exists: snapshot.exists,
        remotePrefix: this.remotePrefix(root),
        files: snapshot.files.length,
        bytes: snapshot.bytes,
        readable: `${snapshot.files.length} 个文件 / ${formatBytes(snapshot.bytes)}`,
        trackedHash: state.hash,
        changedSinceLastPush: state.hash !== null && state.hash !== snapshot.hash,
        pending: state.pending,
        busy: state.busy,
        lastPushAt: state.lastPushAt,
        lastPushSummary: state.lastPushSummary,
        lastCommit: state.lastCommit,
        lastVerifyAt: state.lastVerifyAt,
        lastError: state.lastError,
      }
    })

    let remote = null
    if (options.checkRemote) {
      if (!tokenInfo.token) {
        remote = { ok: false, error: '没有可用的 GitHub token' }
      } else {
        try {
          const client = this.client(tokenInfo.token)
          const repository = await client.resolveRepository(
            { repo: cfg.repo, repoName: cfg.repoName, private: cfg.private, autoCreate: false },
            options.signal,
          )
          const ref = await client.getRef(repository, cfg.branch, options.signal)
          let files = 0
          let truncated = false
          let treeSha = null
          if (ref) {
            const commit = await client.getCommit(repository, ref.commitSha, options.signal)
            treeSha = commit.treeSha
            const tree = await client.getTree(repository, commit.treeSha, options.signal)
            truncated = tree.truncated
            for (const remotePath of tree.files.keys()) {
              const prefixes = new Set(roots.map((entry) => entry.remotePrefix))
              for (const prefix of prefixes) {
                if (!prefix) files += 1
                else if (remotePath.startsWith(`${prefix}/`)) files += 1
              }
            }
          }
          tokenExpiry = client.tokenExpiration
          remote = {
            ok: true,
            repository: repository.fullName,
            branch: cfg.branch,
            headCommit: ref?.commitSha ?? null,
            headUrl: ref ? `https://github.com/${repository.fullName}/commit/${ref.commitSha}` : null,
            repositoryUrl: `https://github.com/${repository.fullName}`,
            files,
            truncated,
            treeSha,
            requests: client.requestCount,
          }
        } catch (error) {
          remote = { ok: false, error: describeError(error) }
        }
      }
    }

    const expiryDate = tokenExpiry ? new Date(tokenExpiry) : null
    const daysLeft =
      expiryDate && !Number.isNaN(expiryDate.getTime())
        ? Math.round((expiryDate.getTime() - Date.now()) / 86_400_000)
        : null

    return {
      configured: Boolean(cfg.repo || cfg.repoName),
      repository: cfg.repo || `(token 账号)/${cfg.repoName}`,
      branch: cfg.branch,
      layout: cfg.layout,
      autoSync: cfg.autoSync,
      pollSeconds: cfg.pollSeconds,
      debounceSeconds: cfg.debounceSeconds,
      subdir: cfg.subdir,
      token: {
        present: Boolean(tokenInfo.token),
        source: tokenInfo.source,
        envFile: this.envFilePath(),
        expiresAt: tokenExpiry,
        daysLeft,
      },
      attention: {
        tokenMissing: !tokenInfo.token,
        tokenExpiring: daysLeft !== null && daysLeft <= 14,
        failingRoots: roots.filter((root) => root.lastError).map((root) => root.name),
      },
      roots,
      remote,
    }
  }

  /** Human-readable one-screen status used by tools and the slash command. */
  describeStatus(status) {
    const lines = [
      `仓库：${status.repository}（分支 ${status.branch}）`,
      `Token：${
        status.token.present
          ? `已配置（${status.token.source}${
              status.token.daysLeft !== null
                ? status.token.daysLeft >= 0
                  ? `，${status.token.daysLeft} 天后过期`
                  : '，已过期'
                : ''
            }）`
          : `未配置 —— 写进 ${status.token.envFile} 或调用 dsh_backup_set_token`
      }`,
      `自动同步：${status.autoSync ? `开，每 ${status.pollSeconds}s 检查、静默 ${status.debounceSeconds}s 后推送` : '关'}`,
      `仓库布局：${status.layout === 'root' ? '.dsh 内容放在仓库根目录' : 'workspaces/<工作区名>/'}`,
    ]
    for (const root of status.roots) {
      const parts = [`${root.root} → ${root.remotePrefix || '(仓库根)'}`]
      if (!root.exists) parts.push('缺少 .dsh 目录')
      else parts.push(root.readable)
      if (root.changedSinceLastPush) parts.push('有未推送的改动')
      else if (root.lastCommit) parts.push('与上次推送一致')
      else if (root.lastVerifyAt) parts.push(`已与远端核验一致（${new Date(root.lastVerifyAt).toLocaleTimeString('zh-CN')}）`)
      else if (root.trackedHash) parts.push('本次进程尚无提交')
      if (root.busy) parts.push('正在同步')
      if (root.lastError) parts.push(`上次错误：${root.lastError}`)
      if (root.lastCommit?.url) parts.push(`最近提交：${root.lastCommit.url}`)
      if (root.lastPushAt) parts.push(`上次推送：${new Date(root.lastPushAt).toLocaleString('zh-CN')}`)
      lines.push(`- ${parts.join('；')}`)
    }
    if (status.attention?.failingRoots?.length > 0) {
      lines.push(`⚠ 自动同步失败：${status.attention.failingRoots.join('、')}（见各工作区的「上次错误」）`)
    }
    if (status.remote) {
      if (status.remote.ok) {
        lines.push(
          `远端：${status.remote.repository}@${status.remote.branch} ${
            status.remote.headCommit ? status.remote.headCommit.slice(0, 10) : '(空)'
          }，备份文件 ${status.remote.files} 个 ${status.remote.headUrl ? `→ ${status.remote.headUrl}` : ''}`,
        )
      } else {
        lines.push(`远端检查失败：${status.remote.error}`)
      }
    }
    return lines.join('\n')
  }
}
