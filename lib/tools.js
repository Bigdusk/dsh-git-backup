import path from 'node:path'
import { summarizeList } from './util.js'

function textBlocks(text) {
  return [{ type: 'text', text: String(text ?? '') }]
}

const summarySchema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    summary: { type: 'string' },
  },
  required: ['ok', 'summary'],
  additionalProperties: true,
}

const output = { schema: summarySchema, render: (_args, value) => textBlocks(value?.summary) }

function describeHistory(history) {
  if (history.items.length === 0) {
    return `${history.repository}@${history.branch} 的 ${history.prefix || '/'} 下还没有备份提交。`
  }
  return [
    `备份版本（${history.repository}@${history.branch} · ${history.prefix || '/'}）：`,
    ...history.items.map(
      (item, index) =>
        `${index + 1}. ${item.short} · ${
          item.date ? new Date(item.date).toLocaleString('zh-CN', { hour12: false }) : '时间未知'
        } · ${item.message || '(无说明)'}`,
    ),
  ].join('\n')
}

/** Build every model-facing tool of this plugin. */
export function createTools(deps) {
  const { engine, trackedRoots, manageableEntries, rootForAgent, describeWorkspaces, formatBytes } = deps

  const resolveRoot = async (args, exec) =>
    args?.root ? path.resolve(args.root) : await rootForAgent(exec)

  return [
    {
      name: 'dsh_backup_status',
      description:
        '查看当前工作区 .dsh 的 GitHub 备份状态：目标仓库与分支、token 是否可用、每个工作区的待推送改动、最近一次提交与最近错误。',
      parameters: {
        type: 'object',
        properties: {
          checkRemote: { type: 'boolean', description: '同时读取远端分支 HEAD（额外消耗几次 GitHub API 调用）' },
        },
        additionalProperties: false,
      },
      output,
      async execute(args, exec) {
        const status = await engine.status({
          roots: trackedRoots(),
          checkRemote: args?.checkRemote === true,
          signal: exec?.signal,
        })
        return { ok: true, summary: engine.describeStatus(status), status }
      },
    },
    {
      name: 'dsh_backup_push',
      description:
        '立即把当前工作区的 .dsh 文件夹推送到 GitHub 备份仓库（自动创建分支/仓库、只上传有变化的文件、删除远端多余文件）。dryRun 只报告将要发生的变更，不创建仓库也不写入。',
      parameters: {
        type: 'object',
        properties: {
          root: { type: 'string', description: '工作区绝对路径，默认使用当前会话的工作目录' },
          message: { type: 'string', description: '提交信息，默认自动生成' },
          dryRun: { type: 'boolean', description: '只预览变更，不上传、不创建仓库' },
        },
        additionalProperties: false,
      },
      output,
      async execute(args, exec) {
        const root = await resolveRoot(args, exec)
        const result = await engine.push(root, {
          message: args?.message,
          dryRun: args?.dryRun === true,
          signal: exec?.signal,
        })
        const lines = [
          result.dryRun ? '预览结果（未写入）' : '推送完成',
          `仓库：${result.repo}@${result.branch}（远端目录 ${result.prefix || '/'}）`,
          `文件：共 ${result.files} 个（${formatBytes(result.bytes)}），本次更新 ${result.added}、删除 ${result.removed}、未变 ${result.unchanged}`,
        ]
        if (result.changedPaths?.length) lines.push(`变更：${summarizeList(result.changedPaths, 10)}`)
        if (result.removedPaths?.length) lines.push(`删除：${summarizeList(result.removedPaths, 10)}`)
        if (result.skipped?.length) lines.push(`跳过（超过单文件上限）：${summarizeList(result.skipped, 5)}`)
        if (result.upToDate) lines.push('远端已是最新，没有产生提交。')
        if (result.commitUrl) lines.push(`提交：${result.commitUrl}`)
        if (result.createdRepository) lines.push('已为你新建该私有仓库。')
        return { ok: true, summary: lines.join('\n'), result }
      },
    },
    {
      name: 'dsh_backup_pull',
      description:
        '把 GitHub 备份仓库里的 .dsh 拉回当前工作区（只重写内容不同的文件）。dryRun 只报告会写哪些文件；prune 会删除远端已不存在的本地文件。',
      parameters: {
        type: 'object',
        properties: {
          root: { type: 'string', description: '工作区绝对路径，默认使用当前会话的工作目录' },
          remoteRoot: { type: 'string', description: '远端目录前缀，默认按插件配置推导' },
          prune: { type: 'boolean', description: '同时删除远端已不存在的本地文件' },
          dryRun: { type: 'boolean', description: '只报告会写入哪些文件，不落盘' },
        },
        additionalProperties: false,
      },
      output,
      async execute(args, exec) {
        const root = await resolveRoot(args, exec)
        const result = await engine.pull(root, {
          remoteRoot: args?.remoteRoot,
          prune: args?.prune === true,
          dryRun: args?.dryRun === true,
          signal: exec?.signal,
        })
        const pending = result.dryRun ? result.wouldWrite : result.written
        const lines = [
          result.dryRun ? '预览结果（未写入）' : '拉取完成',
          `仓库：${result.repo}@${result.branch}（远端目录 ${result.prefix || '/'}，HEAD ${String(result.headCommit).slice(0, 10)}）`,
          `文件：远端 ${result.total} 个，${result.dryRun ? '将写入' : '已写入'} ${pending.length}、相同 ${result.same.length}、排除 ${result.excluded.length}${
            result.pruned.length > 0 ? `、删除 ${result.pruned.length}` : ''
          }`,
          `目标目录：${result.folder}`,
        ]
        if (pending.length) lines.push(`写入：${summarizeList(pending, 10)}`)
        if (result.pruned.length) lines.push(`删除：${summarizeList(result.pruned, 10)}`)
        if (result.failures.length) {
          lines.push(`失败 ${result.failures.length} 个：${summarizeList(result.failures.map((item) => item.rel), 5)}`)
        }
        return { ok: result.failures.length === 0, summary: lines.join('\n'), result }
      },
    },
    {
      name: 'dsh_backup_set_token',
      description:
        '校验并保存 GitHub Personal Access Token（需要 repo 权限）到 DSH_HOME 的 .env 文件，随后自动同步即可使用。token 不会出现在返回值或日志里。',
      parameters: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'GitHub token，形如 ghp_… 或 github_pat_…' },
          envVar: { type: 'string', description: '写入 .env 的变量名，默认使用插件配置的 tokenEnv' },
        },
        required: ['token'],
        additionalProperties: false,
      },
      output,
      async execute(args, exec) {
        const saved = await engine.saveToken(args?.token, { envVar: args?.envVar, signal: exec?.signal })
        return {
          ok: true,
          summary: `token 已保存并验证（账号 ${saved.login}）\n写入 ${saved.envVar} → ${saved.envFile}\n已安排一次自动备份。`,
          saved: { login: saved.login, envFile: saved.envFile, envVar: saved.envVar },
        }
      },
    },
    {
      name: 'dsh_backup_auto',
      description: '临时开启或关闭本进程的自动同步（不写入配置文件；重启后回到插件配置里的 autoSync）。',
      parameters: {
        type: 'object',
        properties: { enabled: { type: 'boolean', description: '是否开启自动同步' } },
        required: ['enabled'],
        additionalProperties: false,
      },
      output,
      async execute(args) {
        engine.cfg.autoSync = args?.enabled !== false
        return {
          ok: true,
          summary: `自动同步已${engine.cfg.autoSync ? '开启' : '关闭'}（每 ${engine.cfg.pollSeconds}s 检查一次）`,
        }
      },
    },
    {
      name: 'dsh_backup_history',
      description:
        '列出当前工作区 .dsh 的 GitHub 备份版本（最近的提交）：序号、短提交号、时间、提交说明。传 version 时改为列出该版本改动了哪些文件。回滚时用序号或提交号。',
      parameters: {
        type: 'object',
        properties: {
          root: { type: 'string', description: '工作区绝对路径，默认使用当前会话的工作目录' },
          limit: { type: 'number', description: '返回多少个版本，默认 10，最大 30' },
          version: { type: 'string', description: '查看该版本的文件改动（序号、提交号或分支/标签）' },
        },
        additionalProperties: false,
      },
      output,
      async execute(args, exec) {
        const root = await resolveRoot(args, exec)
        if (args?.version) {
          const detail = await engine.detail(root, String(args.version), { signal: exec?.signal })
          const files = detail.commit.files ?? []
          const lines = [
            `${detail.commit.sha.slice(0, 10)} · ${detail.commit.message || '(无说明)'}`,
            `改动 ${files.length} 个文件${
              detail.commit.additions !== null ? `，+${detail.commit.additions} / -${detail.commit.deletions}` : ''
            }`,
            ...files.slice(0, 20).map((file) => `- ${file.path}  +${file.additions} -${file.deletions}`),
          ]
          if (files.length > 20) lines.push(`… 还有 ${files.length - 20} 个文件`)
          return { ok: true, summary: lines.join('\n'), detail }
        }
        const history = await engine.history(root, Number(args?.limit) || 10, { signal: exec?.signal })
        return { ok: true, summary: describeHistory(history), history }
      },
    },
    {
      name: 'dsh_backup_rollback',
      description:
        '把当前工作区的 .dsh 回滚到某个备份版本：接受 history 里的序号（1 起）、提交号（可缩写）、分支或标签。默认回滚后立刻推一个新提交，local=true 只改本地不推送，paths 只恢复指定文件/目录，undo=true 撤销本进程内上一次回滚。',
      parameters: {
        type: 'object',
        properties: {
          version: { type: 'string', description: '序号（如 "3"）、提交号或分支/标签名（undo=true 时可省略）' },
          root: { type: 'string', description: '工作区绝对路径，默认使用当前会话的工作目录' },
          local: { type: 'boolean', description: '只恢复本地文件，不推送到 GitHub' },
          dryRun: { type: 'boolean', description: '只报告会写哪些文件' },
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: '只恢复这些相对路径（文件或目录前缀），例如 ["skills/foo/SKILL.md"]',
          },
          undo: { type: 'boolean', description: '撤销本进程内上一次回滚' },
        },
        additionalProperties: false,
      },
      output,
      async execute(args, exec) {
        const root = await resolveRoot(args, exec)
        if (args?.undo === true) {
          const undo = await engine.undoRollback(root, { signal: exec?.signal })
          return {
            ok: true,
            summary: `已撤销上一次回滚，恢复到 ${undo.commit.short}：写入 ${undo.written.length}、删除 ${undo.removed.length} 个文件${
              undo.pushed?.commitUrl ? `\n已推送：${undo.pushed.commitUrl}` : ''
            }`,
            result: undo,
          }
        }
        if (!args?.version) throw new Error('缺少 version（或用 undo: true 撤销上一次回滚）')
        const result = await engine.rollback(root, args.version, {
          signal: exec?.signal,
          push: args?.local !== true,
          dryRun: args?.dryRun === true,
          paths: Array.isArray(args?.paths) && args.paths.length > 0 ? args.paths : undefined,
        })
        const pendingWrites = result.dryRun ? result.wouldWrite : result.written
        const pendingRemoves = result.dryRun ? result.wouldRemove : result.removed
        const lines = [
          result.dryRun ? '回滚预览（未写入）' : '回滚完成',
          `版本：${result.commit.short} · ${result.commit.message || '(无说明)'}${
            result.paths.length > 0 ? `（范围：${result.paths.join('、')}）` : ''
          }`,
          `文件：目标 ${result.total} 个，${result.dryRun ? '将写入' : '写入'} ${pendingWrites.length}、删除 ${pendingRemoves.length}、未变 ${result.same.length}`,
        ]
        if (pendingWrites.length) lines.push(`写入：${summarizeList(pendingWrites, 8)}`)
        if (pendingRemoves.length) lines.push(`删除：${summarizeList(pendingRemoves, 8)}`)
        if (result.failures.length) lines.push(`失败：${result.failures.length} 个`)
        if (result.protectedCommit) lines.push(`回滚前已把本地改动备份为提交：${result.protectedCommit}`)
        if (result.pushed?.commitUrl) lines.push(`已推送：${result.pushed.commitUrl}`)
        else if (!result.dryRun && args?.local === true) lines.push('只改了本地，远端仍保留较新版本。')
        return { ok: result.failures.length === 0, summary: lines.join('\n'), result }
      },
    },
    {
      name: 'dsh_backup_workspaces',
      description:
        '查看和管理参与备份的工作区：list 列出全部工作区及状态；add/remove 增删目录；enable/disable 启停某个工作区（停用后不参与自动备份）。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'add', 'remove', 'enable', 'disable'], description: '要执行的操作' },
          path: { type: 'string', description: '工作区绝对路径，add/remove/enable/disable 必填' },
        },
        required: ['action'],
        additionalProperties: false,
      },
      output,
      async execute(args) {
        const action = String(args?.action ?? 'list')
        const target = String(args?.path ?? '').trim()
        let prefix = ''
        if (action === 'add') prefix = `已添加工作区：${engine.workspaceAdd(target)}`
        else if (action === 'remove') prefix = `已移出备份：${engine.workspaceRemove(target)}`
        else if (action === 'enable' || action === 'disable') {
          prefix = `已${action === 'enable' ? '启用' : '停用'}：${engine.workspaceSetEnabled(target, action === 'enable')}`
        } else if (action !== 'list') throw new Error(`未知操作 ${action}`)
        const entries = manageableEntries()
        return { ok: true, summary: (prefix ? `${prefix}\n\n` : '') + describeWorkspaces(entries), workspaces: entries }
      },
    },
  ]
}
