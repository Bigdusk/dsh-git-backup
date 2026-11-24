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
  '.github',
  '.gitignore',
  'LICENSE',
  'README.md',
  'client.js',
  'cordis.patch.yml',
  'docs',
  'icon.svg',
  'index.js',
  'lib',
  'test',
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

const RELEASE_NOTES = `## dsh-git-backup v1.9.1

### 深色主题修复

- 主按钮 / 品牌图标 / 分段控件选中项的前景色由固定白色改为 「--dsw-alias-bg-base」：浅色主题下仍是白字，深色主题下自动变成深色字，不会再出现“白底白字/按钮消失”。
- 自动同步开关选中状态的滑块同样改用 「--dsw-alias-bg-base」，深色主题下在亮色品牌轨道上清晰可见。

## dsh-git-backup v1.9.0

### 主题：深色 → 浅色 + 自适应

- 整页改为**浅色、跟随宿主主题**：背景 / 卡片 / 文字 / 边框 / 状态色全部使用 \`--dsw-alias-*\` 令牌，浅色下白底卡片 + 品牌色点缀，切到深色主题自动适配，不再有独立的深色面板与霓虹光斑。
- 品牌色用于主按钮、图标、最新行标记、sha、分段控件与链接，浅色下对比清晰。
- 输入框改为白底 + 描边，聚焦有品牌色光晕。

### 弹窗展示

- 详情、预览、改动、体检不再内嵌在页面里，改为**居中弹窗**：遮罩 + 淡入 + 轻微缩放，\`role="dialog"\` / \`aria-modal\`，头部固定、正文滚动。
- 关闭方式：右上「关闭」、点击遮罩、按 Esc。
- 预览弹窗底部保留「全部回滚 / 取消」，单文件仍可「仅恢复」；详情弹窗内可对单个文件点「改动」查看 patch。

### 自适应与动效

- \`@media (max-width:720px)\`：隐藏序号与元信息列、收窄内边距、弹窗高度 88vh。
- 保留卡片淡入、骨架 shimmer、行悬停、状态点呼吸；\`prefers-reduced-motion\` 全部关闭。

### 测试

- 客户端测试补充弹窗流程（打开 / 关闭 / patch 渲染 / 体检）与主题令牌断言，共 22 个用例全部通过。$DSH_HOME/dsh-git-backup/blob-cache.json\` 保存 \`mtime + size → git blob sha\`；未变化的文件不再读盘，只有真正要上传或比对失败时才读取。缓存上限 20000 条，改文件后自动失效，重启后复用。

### 并发安全

- **工作区注册表跨进程锁**：\`workspaces.json\` 的读改写通过 \`workspaces.lock\` 独占锁 + 原子替换完成；30 秒以上的陈旧锁自动回收，多个 DSH 实例同时增删工作区不会互相覆盖。

### 测试与 CI

- 新增 \`test/\`：**22 个用例**，\`node --test test\` 零依赖运行。
  - \`engine.test.mjs\`：偏好持久化、同/跨工作区锁、哈希缓存复用与失效、注册表并发写与陈旧锁、冲突保护、token 清理。
  - \`commands.test.mjs\`：auto 开关不写配置、token 保存/清除、diff/health 与结构化 payload、config 写入、未知命令用法。
  - \`client.test.mjs\`：视图外壳、提交分类徽章、diff 着色、体检卡、自动同步开关即时生效。
  - \`util.test.mjs\`：git blob sha 向量、dotenv 往返、过滤规则、扫描与快照哈希。
- \`.github/workflows/ci.yml\`：Linux/Windows × Node 20/22 跑同一套测试。

### 未完成

- UI 数据仍走命令日志里的结构化 payload（"文本通道"），尚未改为 session projection / 正式 RPC。`

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
      try {
        await client.request('POST', `${tagPath}/git/refs`, {
          body: { ref: `refs/tags/${tagName}`, sha: ref.commitSha },
        })
      } catch (error) {
        // GitHub occasionally 500s on ref creation; the release call below still
        // creates the tag at target_commitish.
        console.warn(`直接创建标签失败（继续创建 Release）：${error?.message ?? error}`)
      }
      await client.request('POST', `${tagPath}/releases`, {
        body: {
          tag_name: tagName,
          target_commitish: ref.commitSha,
          name: tagName,
          body: RELEASE_NOTES,
          draft: false,
          prerelease: false,
        },
      })
      console.log(`已创建标签与 Release：${tagName}`)
    }
  } catch (error) {
    console.warn(`Release 创建失败（代码已发布）：${error?.message ?? error}`)
  }
}

console.log(`\n发布完成：https://github.com/${repository.fullName}`)
console.log(`分支 ${branch} HEAD ${ref.commitSha.slice(0, 10)}，远端 ${tree.files.size} 个文件`)
