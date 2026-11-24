// Publish this plugin's source to a GitHub repository through the REST API.
//
//   node scripts/publish.mjs --repo Bigdusk/dsh-git-backup
//   node scripts/publish.mjs --repo Bigdusk/dsh-git-backup --private
//
// Token: GITHUB_TOKEN from the environment, otherwise <dsh-home>/.env.
// Re-running updates the repository with the current working tree.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GitHubClient } from '../lib/github.js'
import { BackupEngine } from '../lib/engine.js'
import { gitBlobSha, toPosix } from '../lib/util.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(here, '..')

const SKIP_DIRECTORIES = new Set(['node_modules', '.git', '.plugin-manager', 'dist', 'coverage'])
const SKIP_FILES = new Set(['.env', 'package-lock.json', 'pnpm-lock.yaml'])
const ALLOWED_TOP_LEVEL = new Set([
  '.gitignore',
  'LICENSE',
  'README.md',
  'client.js',
  'cordis.patch.yml',
  'docs',
  'icon.svg',
  'index.js',
  'lib',
  'locale',
  'package.json',
  'recover.mjs',
  'scripts',
])

function parseArguments(argv) {
  const args = { name: '', branch: 'main', private: false, message: '', tag: '' }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--private') {
      args.private = true
      continue
    }
    if (!token.startsWith('--')) continue
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`--${token.slice(2)} 需要一个值`)
    args[token.slice(2)] = value
    index += 1
  }
  return args
}

const RELEASE_NOTES = `## dsh-git-backup v1.2.1

### 变更

- **恢复「设置 token」按钮**：「备份」视图右上角常驻该按钮，点开是 GitHub token 密码框 + 「保存 token」；未配置 token 时表单自动展开，标签处显示「未配置 / 已配置 / 还有 N 天过期」。
- **自动同步回归纯默认**：「配置」区不再有开/关切换，只显示「自动同步：开（默认，每 N 秒检查）」；需要临时关闭用 \`/dsh-backup auto off\`。
- 仓库 / 分支 / 轮询 / 远端布局仍在「配置」区可改。

### 不变的默认行为

- 每 15s 扫描工作区 \`.dsh\`，静默 4s 后自动提交；首次有 token 即自动全量备份并自动建私有仓库。
- 所有带 \`.dsh\` 的工作区默认参与备份（可在「工作区」区停用）。
- 拉取/回滚前自动 \`autosave-before-restore\`；版本预览、单文件恢复、撤销回滚、版本详情、灾难恢复脚本 \`recover.mjs\` 均保留。`

function collectFiles(directory, prefix = '') {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (!prefix && !ALLOWED_TOP_LEVEL.has(entry.name)) continue
    if (SKIP_FILES.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue
      files.push(...collectFiles(absolute, relative))
      continue
    }
    if (!entry.isFile()) continue
    files.push({ rel: toPosix(relative), absolute, size: fs.statSync(absolute).size })
  }
  return files.sort((left, right) => (left.rel < right.rel ? -1 : 1))
}

const args = parseArguments(process.argv.slice(2))
if (!args.repo) {
  console.error('用法：node scripts/publish.mjs --repo owner/name [--private] [--branch main] [--message "..."]')
  process.exit(2)
}

const home = args.home ?? process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
const engine = new BackupEngine({ config: { autoCreate: true, autoSync: false }, home })
const { token, source } = engine.resolveToken()
console.log(`token：${source}`)

const client = engine.client(token)
const [ownerArg, nameArg] = String(args.repo).split('/')
const repository = await client.resolveRepository({
  repo: args.repo,
  repoName: nameArg,
  private: args.private,
  description: 'DeepSeek Harness 插件：把工作区 .dsh 自动备份到 GitHub，支持预览/单文件回滚、工作区管理与灾难恢复脚本',
  autoCreate: true,
})
console.log(`仓库：${repository.fullName}（${repository.private ? '私有' : '公开'}${repository.created ? '，已新建' : ''}）`)

const branch = args.branch
let baseRef = await client.getRef(repository, branch)
let fallbackRef = null
if (!baseRef && repository.defaultBranch && repository.defaultBranch !== branch) {
  fallbackRef = await client.getRef(repository, repository.defaultBranch)
}
let baseCommit = null
let baseTree = null
if (baseRef) {
  const commit = await client.getCommit(repository, baseRef.commitSha)
  baseCommit = baseRef.commitSha
  baseTree = commit.treeSha
} else if (fallbackRef) {
  const commit = await client.getCommit(repository, fallbackRef.commitSha)
  baseCommit = fallbackRef.commitSha
  baseTree = commit.treeSha
}

const remoteFiles = new Map()
if (baseTree) {
  const tree = await client.getTree(repository, baseTree)
  for (const [remotePath, sha] of tree.files) remoteFiles.set(remotePath, sha)
}

const files = collectFiles(packageRoot)
if (files.length === 0) throw new Error('没有可发布的文件')
console.log(`本地文件：${files.length} 个`)

const entries = []
let uploaded = 0
let unchanged = 0
for (const file of files) {
  const buffer = fs.readFileSync(file.absolute)
  const sha = gitBlobSha(buffer)
  if (remoteFiles.get(file.rel) === sha) {
    unchanged += 1
    continue
  }
  const blobSha = await client.createBlob(repository, buffer)
  entries.push({ path: file.rel, mode: '100644', type: 'blob', sha: blobSha })
  uploaded += 1
  console.log(`  上传 ${file.rel}`)
}
const localPaths = new Set(files.map((file) => file.rel))
for (const remotePath of remoteFiles.keys()) {
  if (!localPaths.has(remotePath)) {
    entries.push({ path: remotePath, mode: '100644', type: 'blob', sha: null })
    console.log(`  删除 ${remotePath}`)
  }
}

if (entries.length === 0) {
  console.log('远端已是最新，没有产生提交。')
} else {
  const treeSha = await client.createTree(repository, baseTree, entries)
  const message =
    String(args.message ?? '').trim() ||
    `release: ${nameArg} ${new Date().toISOString().slice(0, 10)}（${files.length} 个文件）`
  const commit = await client.createCommit(repository, {
    message,
    tree: treeSha,
    parents: baseCommit ? [baseCommit] : [],
    author: { name: 'dsh-git-backup', email: 'dsh-git-backup@users.noreply.github.com' },
  })
  if (baseRef) await client.updateRef(repository, branch, commit.commitSha)
  else await client.createRef(repository, branch, commit.commitSha)
  console.log(`提交：https://github.com/${repository.fullName}/commit/${commit.commitSha}`)
}

// Repository metadata: description and topics.
try {
  await client.request('PATCH', `/repos/${repository.owner}/${repository.name}`, {
    body: {
      description:
        'DeepSeek Harness 插件：把工作区 .dsh 自动备份到 GitHub，支持预览/单文件回滚、工作区管理与灾难恢复脚本',
      has_wiki: false,
      has_projects: false,
    },
  })
  await client.request('PUT', `/repos/${repository.owner}/${repository.name}/topics`, {
    body: { names: ['deepseek-harness', 'dsh', 'dsh-plugin', 'backup', 'github', 'rollback'] },
  })
  console.log('已设置仓库描述与 topics。')
} catch (error) {
  console.warn(`仓库元数据设置失败（不影响代码发布）：${error?.message ?? error}`)
}

const ref = await client.getRef(repository, branch)
const finalCommit = await client.getCommit(repository, ref.commitSha)
const tree = await client.getTree(repository, finalCommit.treeSha)

if (args.tag) {
  const tagName = String(args.tag)
  const tagPath = `/repos/${repository.owner}/${repository.name}`
  try {
    let exists = false
    try {
      await client.request('GET', `${tagPath}/git/ref/tags/${encodeURIComponent(tagName)}`)
      exists = true
    } catch (error) {
      if (error?.code !== 'not-found') throw error
    }
    if (exists) {
      console.log(`标签 ${tagName} 已存在，跳过 Release。`)
    } else {
      await client.request('POST', `${tagPath}/git/refs`, {
        body: { ref: `refs/tags/${tagName}`, sha: ref.commitSha },
      })
      await client.request('POST', `${tagPath}/releases`, {
        body: { tag_name: tagName, name: tagName, body: RELEASE_NOTES, draft: false, prerelease: false },
      })
      console.log(`已创建标签与 Release：${tagName}`)
    }
  } catch (error) {
    console.warn(`Release 创建失败（代码已发布）：${error?.message ?? error}`)
  }
}

console.log(`\n发布完成：https://github.com/${repository.fullName}`)
console.log(`分支 ${branch} HEAD ${ref.commitSha.slice(0, 10)}，远端 ${tree.files.size} 个文件`)
