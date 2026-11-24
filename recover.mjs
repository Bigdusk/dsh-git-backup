#!/usr/bin/env node
// Disaster recovery for the GitHub .dsh backup: restore a workspace without DSH.
//
//   node recover.mjs --repo owner/dsh-backup --target "C:\Users\me\Desktop\T"
//   node recover.mjs --repo owner/dsh-backup --list
//
// Token: --token-env (default GITHUB_TOKEN) from the environment, otherwise
// <dsh-home>/.env (default %USERPROFILE%\.dsh\.env).

import path from 'node:path'
import os from 'node:os'
import { BackupEngine } from './lib/engine.js'

function parseArgs(argv) {
  const args = { branch: 'main', tokenEnv: 'GITHUB_TOKEN', dryRun: false, prune: false, force: false }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[index + 1]
    if (key === 'list' || key === 'dry-run' || key === 'prune' || key === 'force') {
      args[key === 'dry-run' ? 'dryRun' : key] = true
      continue
    }
    if (next === undefined || next.startsWith('--')) throw new Error(`--${key} 需要一个值`)
    args[key] = next
    index += 1
  }
  return args
}

function usage() {
  console.log(`用法：
  node recover.mjs --repo owner/repo --list
  node recover.mjs --repo owner/repo --target <工作区目录> [--remote-root workspaces/名字] [--branch main] [--dry-run] [--prune] [--force]
环境：
  默认从 %USERPROFILE%\\.dsh\\.env 读 GITHUB_TOKEN；可用 --token-env 换变量名，或用 --home 指定 DSH_HOME。`)
}

const args = parseArgs(process.argv.slice(2))
if (!args.repo) {
  usage()
  process.exit(2)
}

const home = args.home ?? process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
const engine = new BackupEngine({
  config: { repo: args.repo, branch: args.branch, autoSync: false, tokenEnv: args['token-env'] ?? 'GITHUB_TOKEN' },
  home,
})

try {
  const { token, source } = engine.resolveToken()
  console.log(`token：${source}`)
  const client = engine.client(token)
  const repository = await client.resolveRepository({ repo: args.repo, autoCreate: false })
  console.log(`仓库：${repository.fullName}（分支 ${args.branch}）`)

  if (args.list) {
    const ref = await client.getRef(repository, args.branch)
    if (!ref) {
      console.log('该分支还没有提交。')
      process.exit(0)
    }
    const commit = await client.getCommit(repository, ref.commitSha)
    const tree = await client.getTree(repository, commit.treeSha)
    const groups = new Map()
    for (const remotePath of tree.files.keys()) {
      const segments = remotePath.split('/')
      const key = segments.length > 1 ? `${segments[0]}/${segments[1]}` : segments[0]
      groups.set(key, (groups.get(key) ?? 0) + 1)
    }
    console.log(`HEAD ${ref.commitSha.slice(0, 10)}，共 ${tree.files.size} 个文件：`)
    for (const [group, count] of [...groups.entries()].sort()) console.log(`- ${group}（${count} 个文件）`)
    process.exit(0)
  }

  if (!args.target) {
    usage()
    process.exit(2)
  }

  const target = path.resolve(args.target)
  const remoteRoot = args['remote-root'] ?? args.remoteRoot ?? engine.remotePrefix(target)
  console.log(`恢复到：${path.join(target, '.dsh')}`)
  console.log(`远端目录：${remoteRoot || '(仓库根)'}${args.dryRun ? '（预览）' : ''}`)

  const result = await engine.pull(target, {
    remoteRoot,
    prune: args.prune,
    dryRun: args.dryRun,
    force: true,
    protect: false,
  })
  console.log(
    `${args.dryRun ? '将写入' : '已写入'} ${(args.dryRun ? result.wouldWrite : result.written).length} 个文件，相同 ${result.same.length} 个，排除 ${result.excluded.length} 个${
      result.pruned.length ? `，删除 ${result.pruned.length} 个` : ''
    }。`,
  )
  if (result.failures.length) {
    console.log(`失败 ${result.failures.length} 个：${result.failures.slice(0, 5).map((item) => item.rel).join('、')}`)
    process.exitCode = 1
  }
} catch (error) {
  console.error(`恢复失败：${error?.message ?? error}`)
  if (String(error?.message ?? '').includes('token')) {
    console.error(`提示：把 GITHUB_TOKEN 写进 ${path.join(home, '.env')}，或用 --token-env 指定其它变量名。`)
  }
  process.exitCode = 1
}
