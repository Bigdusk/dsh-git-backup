import { formatBytes } from './util.js'
import { pullIntoNewWorkspace, forgetWorkspace } from './restore.js'

/** Human-readable workspace list shared by the tool and the slash command. */
export function describeWorkspaces(entries) {
  if (entries.length === 0) return '没有找到任何带 .dsh 目录的工作区。'
  const lines = ['工作区（启用 = 参与自动备份）：']
  for (const entry of entries) {
    const parts = [`${entry.name} · ${entry.root}`]
    if (entry.exists) parts.push(`${entry.files} 个文件 / ${formatBytes(entry.bytes)}`)
    else parts.push('缺少 .dsh 目录')
    parts.push(entry.disabled ? '已停用' : '启用')
    if (entry.extra) parts.push('手动添加')
    parts.push(`远端 ${entry.remotePrefix || '(仓库根)'}`)
    lines.push(`- ${parts.join('；')}`)
  }
  return lines.join('\n')
}

export const uiPayload = (payload) => {
  try {
    return `\n⟦dshb:${JSON.stringify(payload)}⟧`
  } catch {
    return ''
  }
}

export const workspaceItems = (entries) =>
  entries.map((entry) => ({
    name: entry.name,
    root: entry.root,
    files: entry.files,
    bytes: entry.bytes,
    disabled: entry.disabled,
    extra: entry.extra,
    exists: entry.exists,
  }))

const USAGE =
  '用法：/dsh-backup status | push | pull [--from <前缀>] [--prune] [--dry-run] | pull-workspace <前缀> [--dir <父目录>] [--name <文件夹名>] [--prune] [--dry-run] | remote | history [n] | detail <ref> | diff <ref> [路径] | preview <ref> | rollback <ref> [--local] [--only <路径>] [--from <前缀>] | undo | workspaces | workspace <add|remove|enable|disable|forget> <路径> | auto [on|off] | token <token|clear> | health | config [set <键> <值>]'

/** Split repeated `--flag value` pairs and bare positionals out of a command tail. */
function parseFlagArgs(words) {
  const rest = []
  const flags = new Map()
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]
    if (word === '--dir' || word === '--name' || word === '--from') {
      const value = words[index + 1]
      if (value !== undefined && !value.startsWith('--')) {
        flags.set(word, value)
        index += 1
      }
      continue
    }
    if (word.startsWith('--')) continue
    rest.push(word)
  }
  return { rest, flags }
}

const CONFIG_KEYS = {
  repo: 'string',
  repoName: 'string',
  branch: 'string',
  layout: 'layout',
  remoteRoot: 'string',
  pollSeconds: 'number',
  debounceSeconds: 'number',
  autoSync: 'boolean',
}

function coerceConfig(key, raw) {
  const kind = CONFIG_KEYS[key]
  const value = String(raw ?? '').trim()
  if (kind === 'number') {
    const number = Number(value)
    if (!Number.isFinite(number)) throw new Error(`${key} 需要一个数字`)
    return Math.round(number)
  }
  if (kind === 'boolean') {
    if (['true', 'on', '1', '开'].includes(value.toLowerCase())) return true
    if (['false', 'off', '0', '关'].includes(value.toLowerCase())) return false
    throw new Error(`${key} 需要 true/false`)
  }
  if (kind === 'layout') {
    if (value !== 'workspaces' && value !== 'root') throw new Error('layout 只能是 workspaces 或 root')
    return value
  }
  return value
}

/** Build the single `/dsh-backup` human command. */
export function createCommand(deps) {
  const { engine, get, trackedRoots, manageableEntries, pollOnce } = deps
  const describe = typeof deps.describeWorkspaces === 'function' ? deps.describeWorkspaces : describeWorkspaces
  const setConfig = typeof deps.setConfig === 'function' ? deps.setConfig : null
  const readConfig = typeof deps.readConfig === 'function' ? deps.readConfig : () => engine.cfg

  async function resolveRoot(invocation) {
    try {
      const workingDirectory = get('workingDirectory')
      if (invocation?.agent && typeof workingDirectory?.ensure === 'function') {
        return await workingDirectory.ensure(invocation.agent, invocation.signal)
      }
    } catch {
      /* fall back */
    }
    return process.cwd()
  }

  const configView = () => {
    const cfg = readConfig() ?? engine.cfg
    return {
      repo: cfg.repo ?? '',
      repoName: cfg.repoName ?? '',
      branch: cfg.branch ?? '',
      layout: cfg.layout ?? 'workspaces',
      remoteRoot: cfg.remoteRoot ?? '',
      pollSeconds: cfg.pollSeconds ?? 15,
      debounceSeconds: cfg.debounceSeconds ?? 4,
      autoSync: cfg.autoSync !== false,
    }
  }

  const describeConfig = () => {
    const values = configView()
    return [
      '当前配置（可用 /dsh-backup config set <键> <值> 修改，保存后插件行会重启一次）：',
      `- repo：${values.repo || '(空，使用 token 账号 + repoName)'}`,
      `- repoName：${values.repoName}`,
      `- branch：${values.branch}`,
      `- layout：${values.layout}（remoteRoot：${values.remoteRoot || '(空)'}）`,
      `- 轮询：每 ${values.pollSeconds}s 检查，静默 ${values.debounceSeconds}s 后推送`,
      `- 自动同步：${values.autoSync ? '开' : '关'}`,
    ].join('\n')
  }

  return {
    name: 'dsh-backup',
    description: '备份、预览/回滚、配置当前工作区 .dsh，并管理参与备份的工作区',
    input: { hint: 'push | pull | pull-workspace | remote | status | history | detail | diff | preview | rollback | undo | workspaces | workspace | auto | token | health | config' },
    recordInput: false,
    async handler(invocation) {
      const words = String(invocation?.rawInput ?? '').trim().split(/\s+/).filter(Boolean)
      const action = words[0] || 'status'
      const signal = invocation?.signal
      const root = await resolveRoot(invocation)

      try {
        if (action === 'status') {
          const status = await engine.status({ roots: trackedRoots(), checkRemote: true, signal })
          return {
            kind: 'success',
            text:
              engine.describeStatus(status) +
              uiPayload({
                kind: 'status',
                autoSync: status.autoSync,
                token: { present: status.token.present, daysLeft: status.token.daysLeft, envFile: status.token.envFile },
                failingRoots: status.attention?.failingRoots ?? [],
                roots: (status.roots ?? []).map((entry) => ({
                  name: entry.name,
                  files: entry.files,
                  lastError: entry.lastError,
                  changed: entry.changedSinceLastPush,
                })),
              }),
          }
        }
        if (action === 'push') {
          const result = await engine.push(root, { signal, source: 'manual', kind: 'manual' })
          return {
            kind: 'success',
            text: result.upToDate
              ? `${root} 与远端一致，没有产生提交。`
              : `已推送 ${result.added} 个更新、${result.removed} 个删除到 ${result.repo}@${result.branch}：${result.commitUrl}`,
          }
        }
        if (action === 'pull') {
          const fromIndex = words.indexOf('--from')
          const remoteRoot = fromIndex >= 0 ? words.slice(fromIndex + 1).find((word) => !word.startsWith('--')) : undefined
          const result = await engine.pull(root, {
            signal,
            remoteRoot,
            prune: words.includes('--prune'),
            dryRun: words.includes('--dry-run'),
          })
          const lines = [
            result.dryRun
              ? `预览（未写入）：将从 ${result.repo}@${result.branch} 的 ${result.prefix} 写入 ${result.wouldWrite.length} 个文件到 ${result.folder}。`
              : `已从 ${result.repo}@${result.branch} 的 ${result.prefix} 拉取到 ${result.folder}：写入 ${result.written.length} 个，相同 ${result.same.length} 个${
                  result.pruned.length ? `，删除 ${result.pruned.length} 个` : ''
                }${result.failures.length ? `，失败 ${result.failures.length} 个` : ''}。`,
          ]
          if (result.autoPrefix) lines.push('当前工作区名在远端没有对应目录，已自动选用远端唯一的工作区。')
          if (result.protectedCommit) lines.push(`拉取前已把本地改动备份为提交：${result.protectedCommit}`)
          return { kind: 'success', text: lines.join('\n') }
        }
        if (action === 'pull-workspace' || action === 'pullto' || action === 'restore') {
          const { rest, flags } = parseFlagArgs(words.slice(1))
          const prefix = rest[0] ?? flags.get('--from')
          if (!prefix) {
            return {
              kind: 'error',
              text: '用法：/dsh-backup pull-workspace <远端前缀> [--dir <父目录>] [--name <文件夹名>] [--prune] [--dry-run]（前缀形如 workspaces/T）',
            }
          }
          const outcome = await pullIntoNewWorkspace({
            engine,
            get,
            prefix,
            parentDir: flags.get('--dir'),
            name: flags.get('--name'),
            prune: words.includes('--prune'),
            dryRun: words.includes('--dry-run'),
            signal,
          })
          const summary = outcome.result
          const lines = []
          if (outcome.dryRun) {
            lines.push(`预览（未创建目录、未注册工作区）：将把 ${summary.prefix} 的 ${summary.wouldWrite.length} 个文件写入 ${outcome.target}`)
          } else {
            lines.push(
              `已在 ${outcome.parent} 新建文件夹 ${outcome.target}${
                outcome.registered ? '，并注册为 DeepSeek Harness 工作区' : ''
              }`,
            )
            lines.push(
              `已从 ${summary.repo}@${summary.branch} 的 ${summary.prefix} 拉取：写入 ${summary.written.length} 个，相同 ${summary.same.length} 个${
                summary.pruned.length ? `，删除 ${summary.pruned.length} 个` : ''
              }${summary.failures.length ? `，失败 ${summary.failures.length} 个` : ''}。`,
            )
            if (outcome.registered) lines.push('左侧栏已经能看到这个工作区，打开即可使用；它的 .dsh 会继续自动备份。')
            else lines.push(`⚠ 目录已就绪，但没能注册为工作区：${outcome.registerError ?? '原因未知'}。可以手动把它加为工作区。`)
          }
          return {
            kind: 'success',
            text:
              lines.join('\n') +
              uiPayload({
                kind: 'pulled',
                path: outcome.target,
                name: outcome.name,
                prefix: summary.prefix,
                written: summary.written.length,
                wouldWrite: summary.wouldWrite.length,
                registered: outcome.registered,
                dryRun: outcome.dryRun,
              }),
          }
        }
        if (action === 'remote' || action === 'remotes') {
          const remote = await engine.remoteWorkspaces({ signal })
          const lines =
            remote.items.length === 0
              ? [`${remote.repo}@${remote.branch} 里还没有任何工作区备份。`]
              : [
                  `${remote.repo}@${remote.branch} 里的工作区备份（HEAD ${String(remote.headCommit ?? '').slice(0, 10)}）：`,
                  ...remote.items.map((item, index) => {
                    const when = item.last?.date
                      ? new Date(item.last.date).toLocaleString('zh-CN', { hour12: false })
                      : '时间未知'
                    return `${index + 1}. ${item.prefix} · ${item.files} 个文件 · ${when} · ${item.last?.message ?? '(无说明)'}`
                  }),
                  '点「拉取工作区」会先在桌面新建文件夹、注册为工作区，再把备份拉进去；也可以 /dsh-backup pull-workspace <前缀>。',
                ]
          return {
            kind: 'success',
            text:
              lines.join('\n') +
              uiPayload({
                kind: 'remotes',
                repository: remote.repo,
                branch: remote.branch,
                items: remote.items.map((item) => ({
                  prefix: item.prefix,
                  name: item.name,
                  files: item.files,
                  last: item.last ?? null,
                })),
              }),
          }
        }
        if (action === 'token') {
          const token = words.slice(1).join(' ').trim()
          if (token === '') return { kind: 'error', text: '用法：/dsh-backup token <GITHUB_TOKEN>，或 token clear 删除已保存的 token' }
          if (token === 'clear') {
            const cleared = engine.clearToken()
            return {
              kind: 'success',
              text: cleared.removed
                ? `已从 ${cleared.envFile} 删除 ${cleared.envVar}。`
                : `${cleared.envFile} 里没有 ${cleared.envVar}，无需删除。`,
            }
          }
          try {
            const saved = await engine.saveToken(token, { signal })
            return {
              kind: 'success',
              text: `token 已保存并验证（账号 ${saved.login}），写入 ${saved.envFile} 的 ${saved.envVar}。${
                engine.cfg.autoSync ? '已安排一次自动备份。' : '自动同步当前关闭，需要时点「立即提交」。'
              }`,
            }
          } catch (error) {
            return { kind: 'error', text: `token 保存失败：${error?.message ?? String(error)}` }
          }
        }
        if (action === 'auto') {
          const desired = words[1]
          const enabled = desired === 'on' ? true : desired === 'off' ? false : !engine.cfg.autoSync
          engine.setAutoSync(enabled)
          if (enabled) pollOnce()
          return {
            kind: 'success',
            text: `自动同步已${enabled ? '开启' : '关闭'}（立即生效，无需重启；偏好写入 $DSH_HOME/dsh-git-backup/prefs.json）。${
              enabled ? '' : '之后需要手动点「立即提交」。'
            }`,
          }
        }
        if (action === 'diff') {
          const ref = words[1]
          if (!ref) return { kind: 'error', text: '用法：/dsh-backup diff <版本号|提交号> [路径片段]' }
          const detail = await engine.diff(root, ref, { signal, path: words.slice(2).join(' ') })
          const files = detail.files ?? []
          const lines = files.length === 0 ? ['没有匹配的文件改动。'] : []
          for (const file of files.slice(0, 5)) {
            lines.push(`${file.path}  +${file.additions} −${file.deletions}`)
            const patch = String(file.patch ?? '')
              .split('\n')
              .slice(0, 40)
              .join('\n')
            if (patch) lines.push(patch)
            lines.push('')
          }
          if (files.length > 5) lines.push(`… 还有 ${files.length - 5} 个文件`)
          return {
            kind: 'success',
            text:
              lines.join('\n') +
              uiPayload({
                kind: 'diff',
                sha: detail.commit.sha,
                short: detail.commit.sha.slice(0, 10),
                requested: detail.requested,
                files: files.slice(0, 20).map((file) => ({
                  path: file.path,
                  additions: file.additions,
                  deletions: file.deletions,
                  patch: typeof file.patch === 'string' ? file.patch.slice(0, 8000) : null,
                })),
              }),
          }
        }
        if (action === 'health') {
          const report = await engine.health(root, { signal })
          const lines = [
            `仓库 ${report.repository}（${report.private ? '私有' : '公开'}，约 ${report.repoSizeKb ?? '?'} KB）`,
            `分支 ${report.branch} · HEAD ${report.head ? report.head.slice(0, 10) : '(空)'} · 远端 ${report.remoteCount} 个文件 / 本地 ${report.localCount} 个`,
            `一致 ${report.same} 个${report.mismatch.length ? `，内容不一致 ${report.mismatch.length} 个` : ''}${
              report.missing.length ? `，本地未备份 ${report.missing.length} 个` : ''
            }${report.extra.length ? `，远端多出 ${report.extra.length} 个` : ''}`,
          ]
          if (report.mismatch.length) lines.push(`不一致：${report.mismatch.slice(0, 5).join('、')}`)
          if (report.missing.length) lines.push(`未备份：${report.missing.slice(0, 5).join('、')}`)
          return {
            kind: 'success',
            text:
              lines.join('\n') +
              uiPayload({
                kind: 'health',
                repository: report.repository,
                repoSizeKb: report.repoSizeKb,
                remoteCount: report.remoteCount,
                localCount: report.localCount,
                same: report.same,
                mismatch: report.mismatch.slice(0, 20),
                missing: report.missing.slice(0, 20),
                extra: report.extra.slice(0, 20),
                head: report.head,
              }),
          }
        }
        if (action === 'history') {
          const limit = Math.max(1, Math.min(30, Number(words[1]) || 8))
          const history = await engine.history(root, limit, { signal })
          const lines = [
            `${history.prefix || '/'} 最近 ${history.items.length} 个版本（${history.repository}@${history.branch}）：`,
          ]
          if (history.items.length === 0) lines.push('(还没有备份提交)')
          history.items.forEach((item, index) => {
            const when = item.date ? new Date(item.date).toLocaleString('zh-CN', { hour12: false }) : '时间未知'
            lines.push(`${index + 1}. ${item.short} · ${when} · ${item.message || '(无说明)'}`)
          })
          lines.push('点「预览」看会改哪些文件；点「回滚」直接恢复。')
          return {
            kind: 'success',
            text:
              lines.join('\n') +
              uiPayload({
                kind: 'versions',
                repository: history.repository,
                branch: history.branch,
                prefix: history.prefix,
                items: history.items.map((item, index) => ({
                  n: index + 1,
                  sha: item.sha,
                  short: item.short,
                  date: item.date,
                  message: item.message,
                })),
              }),
          }
        }
        if (action === 'detail') {
          const ref = words[1]
          if (!ref) return { kind: 'error', text: '用法：/dsh-backup detail <版本号|提交号>' }
          const detail = await engine.detail(root, ref, { signal })
          const files = detail.commit.files ?? []
          const lines = [
            `${detail.commit.sha.slice(0, 10)} · ${detail.commit.message || '(无说明)'}`,
            `改动 ${files.length} 个文件${
              detail.commit.additions !== null ? `，+${detail.commit.additions} / -${detail.commit.deletions}` : ''
            }`,
            ...files.slice(0, 20).map((file) => `- ${file.path}  +${file.additions} -${file.deletions}`),
          ]
          if (files.length > 20) lines.push(`… 还有 ${files.length - 20} 个文件`)
          return {
            kind: 'success',
            text:
              lines.join('\n') +
              uiPayload({
                kind: 'detail',
                sha: detail.commit.sha,
                short: detail.commit.sha.slice(0, 10),
                message: detail.commit.message,
                additions: detail.commit.additions,
                deletions: detail.commit.deletions,
                files: files.slice(0, 60),
              }),
          }
        }
        if (action === 'preview') {
          const ref = words[1]
          if (!ref) return { kind: 'error', text: '用法：/dsh-backup preview <版本号|提交号>' }
          const result = await engine.rollback(root, ref, { signal, dryRun: true })
          const lines = [
            `预览：${result.commit.short}（${result.commit.message || '无说明'}）`,
            `将写入 ${result.wouldWrite.length} 个、删除 ${result.wouldRemove.length} 个、不变 ${result.same.length} 个。`,
          ]
          if (result.wouldWrite.length) lines.push(`写入：${result.wouldWrite.slice(0, 10).join('、')}`)
          if (result.wouldRemove.length) lines.push(`删除：${result.wouldRemove.slice(0, 10).join('、')}`)
          return {
            kind: 'success',
            text:
              lines.join('\n') +
              uiPayload({
                kind: 'preview',
                sha: result.commit.sha,
                short: result.commit.short,
                message: result.commit.message,
                write: result.wouldWrite.slice(0, 60),
                remove: result.wouldRemove.slice(0, 60),
                unchanged: result.same.length,
              }),
          }
        }
        if (action === 'rollback') {
          const ref = words[1]
          if (!ref) return { kind: 'error', text: '用法：/dsh-backup rollback <版本号|提交号> [--local] [--only <路径>]' }
          const localOnly = words.includes('--local')
          const onlyIndex = words.indexOf('--only')
          const onlyPaths =
            onlyIndex >= 0
              ? words
                  .slice(onlyIndex + 1)
                  .filter((word) => !word.startsWith('--'))
                  .join(' ')
                  .split('||')
                  .map((item) => item.trim())
                  .filter(Boolean)
              : []
          const fromIndex = words.indexOf('--from')
          const remoteRoot = fromIndex >= 0 ? words.slice(fromIndex + 1).find((word) => !word.startsWith('--')) : undefined
          const result = await engine.rollback(root, ref, {
            signal,
            push: !localOnly,
            remoteRoot,
            paths: onlyPaths.length > 0 ? onlyPaths : undefined,
          })
          const lines = [
            `已回滚到 ${result.commit.short}（${result.commit.message || '无说明'}）${
              result.paths.length > 0 ? `，范围：${result.paths.join('、')}` : ''
            }：写入 ${result.written.length}、删除 ${result.removed.length}、未变 ${result.same.length} 个文件。`,
          ]
          if (result.failures.length > 0) lines.push(`失败 ${result.failures.length} 个文件。`)
          if (result.protectedCommit) lines.push(`回滚前已把本地改动备份为提交：${result.protectedCommit}`)
          if (result.pushed?.commitUrl) lines.push(`已作为新提交推送：${result.pushed.commitUrl}`)
          else if (result.restoredFresh) lines.push('目标工作区原本没有 .dsh：已恢复到你指定的版本，远端的较新版本保持不动。')
          else if (localOnly) lines.push('只改了本地，未推送（远端仍保留较新版本）。')
          lines.push('可用 /dsh-backup undo 撤销这次回滚。')
          return {
            kind: 'success',
            text:
              lines.join('\n') +
              uiPayload({ kind: 'rollback', ok: result.failures.length === 0, sha: result.commit.sha, undo: Boolean(result.undoCommit) }),
          }
        }
        if (action === 'undo') {
          const result = await engine.undoRollback(root, { signal })
          return {
            kind: 'success',
            text: `已撤销上一次回滚，恢复到 ${result.commit.short}（${result.commit.message || '无说明'}）：写入 ${
              result.written.length
            }、删除 ${result.removed.length} 个文件。${result.pushed?.commitUrl ? `已推送：${result.pushed.commitUrl}` : ''}`,
          }
        }
        if (action === 'workspaces' || (action === 'workspace' && !words[1])) {
          const entries = manageableEntries()
          return { kind: 'success', text: describe(entries) + uiPayload({ kind: 'workspaces', items: workspaceItems(entries) }) }
        }
        if (action === 'workspace') {
          const operation = words[1]
          const target = words.slice(2).join(' ').trim()
          if (!operation || target === '') {
            return { kind: 'error', text: '用法：/dsh-backup workspace <add|remove|enable|disable|forget> <绝对路径>' }
          }
          if (operation === 'forget') {
            try {
              const forgotten = await forgetWorkspace({ get, path: target })
              const entries = manageableEntries()
              return {
                kind: 'success',
                text:
                  (forgotten.removed
                    ? `已从 DSH 工作区列表移除：${forgotten.title ?? forgotten.path}（目录和文件都保留）`
                    : `这个目录没有登记为工作区：${forgotten.path}`) +
                  '\n\n' +
                  describe(entries) +
                  uiPayload({ kind: 'workspaces', items: workspaceItems(entries) }),
              }
            } catch (error) {
              return { kind: 'error', text: `移除工作区失败：${error?.message ?? String(error)}` }
            }
          }
          let done = ''
          try {
            if (operation === 'add') done = `已添加工作区：${engine.workspaceAdd(target)}`
            else if (operation === 'remove') done = `已移出备份：${engine.workspaceRemove(target)}`
            else if (operation === 'enable') done = `已启用：${engine.workspaceSetEnabled(target, true)}`
            else if (operation === 'disable') done = `已停用：${engine.workspaceSetEnabled(target, false)}`
            else return { kind: 'error', text: '未知操作，支持 add / remove / enable / disable / forget' }
          } catch (error) {
            return { kind: 'error', text: `工作区操作失败：${error?.message ?? String(error)}` }
          }
          pollOnce()
          const entries = manageableEntries()
          return {
            kind: 'success',
            text:
              `${done}\n\n` +
              describe(entries) +
              uiPayload({ kind: 'workspaces', items: workspaceItems(entries) }),
          }
        }
        if (action === 'config') {
          const operation = words[1]
          if (!operation) {
            return {
              kind: 'success',
              text: describeConfig() + uiPayload({ kind: 'config', values: configView(), wrote: false }),
            }
          }
          if (operation !== 'set') {
            return { kind: 'error', text: '用法：/dsh-backup config [set <键> <值>]' }
          }
          const key = words[2]
          const raw = words.slice(3).join(' ').trim()
          if (!key || !Object.prototype.hasOwnProperty.call(CONFIG_KEYS, key)) {
            return { kind: 'error', text: `可配置键：${Object.keys(CONFIG_KEYS).join('、')}` }
          }
          if (raw === '') return { kind: 'error', text: `用法：/dsh-backup config set ${key} <值>` }
          if (!setConfig) return { kind: 'error', text: '当前 profile 无法保存配置（缺少 configEditor）' }
          try {
            const value = coerceConfig(key, raw)
            await setConfig(key, value)
            engine.cfg[key] = value
            const values = configView()
            return {
              kind: 'success',
              text: `已保存 ${key} = ${JSON.stringify(value)}。配置写入 profile，插件行会重启一次以应用。\n\n${describeConfig()}` +
                uiPayload({ kind: 'config', values, wrote: true }),
            }
          } catch (error) {
            return { kind: 'error', text: `配置保存失败：${error?.message ?? String(error)}` }
          }
        }
        return { kind: 'error', text: USAGE }
      } catch (error) {
        return { kind: 'error', text: error?.message ?? String(error) }
      }
    },
  }
}
