import path from 'node:path'
import { BackupEngine } from './lib/engine.js'
import { createTools } from './lib/tools.js'
import { createCommand, describeWorkspaces } from './lib/commands.js'
import { formatBytes } from './lib/util.js'

export const inject = ['tools']

const PLUGIN = 'dsh-git-backup'

function buildLogger(ctx) {
  let logger
  try {
    logger = typeof ctx.logger === 'function' ? ctx.logger(PLUGIN) : undefined
  } catch {
    logger = undefined
  }
  return (level, message) => {
    try {
      if (logger && typeof logger[level] === 'function') logger[level](message)
      else if (level === 'error') console.error(`[${PLUGIN}] ${message}`)
      else console.log(`[${PLUGIN}] ${message}`)
    } catch {
      /* logging must never break a sync */
    }
  }
}

export function apply(ctx, config) {
  const write = buildLogger(ctx)
  const log = (message) => write('info', message)
  const logError = (message) => write('error', message)

  const engine = new BackupEngine({ config, home: process.env.DSH_HOME ?? '', log })
  const pendingTimers = new Map()
  let tokenSeen = false

  const get = (name) => {
    try {
      return ctx.get(name)
    } catch {
      return undefined
    }
  }

  function candidateRoots() {
    const roots = []
    try {
      const registry = get('workspaceRegistry')
      const list = typeof registry?.list === 'function' ? registry.list() : []
      for (const workspace of list) {
        if (typeof workspace?.path === 'string' && workspace.path !== '') roots.push(workspace.path)
      }
    } catch {
      /* registry is optional */
    }
    try {
      const workingDirectory = get('workingDirectory')
      if (typeof workingDirectory?.defaultDirectory === 'string') roots.push(workingDirectory.defaultDirectory)
    } catch {
      /* optional */
    }
    return roots
  }

  function trackedRoots() {
    try {
      return engine.discoverRoots(candidateRoots())
    } catch (error) {
      logError(`无法枚举工作区：${error?.message ?? error}`)
      return []
    }
  }

  function manageableEntries() {
    return engine.workspaceEntries(candidateRoots()).filter((entry) => entry.exists || entry.extra)
  }

  async function rootForAgent(exec) {
    const workingDirectory = get('workingDirectory')
    if (exec?.agent && typeof workingDirectory?.ensure === 'function') {
      try {
        return await workingDirectory.ensure(exec.agent, exec.signal)
      } catch {
        /* fall back below */
      }
    }
    const discovered = trackedRoots()
    if (discovered.length > 0) return discovered[0]
    return process.cwd()
  }

  function scheduleAutoPush(root) {
    if (!engine.cfg.autoSync) return
    const existing = pendingTimers.get(root)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      pendingTimers.delete(root)
      void runAutoPush(root)
    }, engine.cfg.debounceSeconds * 1000)
    if (typeof timer.unref === 'function') timer.unref()
    pendingTimers.set(root, timer)
  }

  async function runAutoPush(root) {
    if (!engine.cfg.autoSync) return
    const state = engine.rootState(root)
    if (state.busy) return
    try {
      const result = await engine.push(root, {})
      if (result.upToDate) log(`自动备份：${root} 与远端一致，无需提交`)
      else log(`自动备份完成：${result.commitUrl}`)
    } catch (error) {
      const message = error?.message ?? String(error)
      state.lastError = message
      logError(`自动备份失败：${message}`)
    }
  }

  function pollOnce() {
    const roots = trackedRoots()
    const tokenInfo = engine.resolveToken({ required: false })
    const tokenNow = Boolean(tokenInfo.token)
    // A workspace whose baseline was recorded while no token existed would never
    // push until its next edit; treat "token appeared" as work to verify.
    const tokenAppeared = tokenNow && !tokenSeen
    tokenSeen = tokenNow
    for (const root of roots) {
      let snapshot
      try {
        snapshot = engine.fingerprint(root)
      } catch {
        continue
      }
      if (snapshot.hash === null) continue
      const state = engine.rootState(root)
      if (state.hash === null) {
        // First observation in this process: verify against the remote once so a
        // restart does not lose an unsynced edit, then keep a baseline.
        if (engine.cfg.autoSync && tokenNow) {
          state.pending = true
          scheduleAutoPush(root)
        } else {
          state.hash = snapshot.hash
        }
        continue
      }
      if (state.hash !== snapshot.hash) {
        state.pending = true
        scheduleAutoPush(root)
      } else if (tokenAppeared && engine.cfg.autoSync) {
        state.pending = true
        scheduleAutoPush(root)
      } else {
        state.pending = false
      }
    }
  }

  ctx.effect(() => {
    const intervalMs = Math.max(5, engine.cfg.pollSeconds) * 1000
    const interval = setInterval(pollOnce, intervalMs)
    if (typeof interval.unref === 'function') interval.unref()
    const kick = setTimeout(pollOnce, 2_000)
    if (typeof kick.unref === 'function') kick.unref()
    return () => {
      clearInterval(interval)
      clearTimeout(kick)
      for (const timer of pendingTimers.values()) clearTimeout(timer)
      pendingTimers.clear()
    }
  })

  // ----------------------------------------------------------------- tools ---

  const tools = createTools({
    engine,
    ctx,
    trackedRoots,
    manageableEntries,
    rootForAgent,
    describeWorkspaces,
    formatBytes,
  })
  for (const definition of tools) {
    ctx.effect(() => ctx.tools.register(definition))
  }

  // --------------------------------------------------------------- command ---

  /** Persist one config key into the profile patch through the config editor. */
  async function setConfigValue(key, value) {
    const editor = get('configEditor')
    let entry
    try {
      entry = ctx.fiber?.entry ?? ctx.fiber?.config?.entry
    } catch {
      entry = undefined
    }
    if (!editor || typeof editor.edit !== 'function' || entry === undefined) {
      throw new Error('当前 profile 不支持保存配置（缺少 configEditor 或插件行）')
    }
    await editor.edit(entry, (current) => ({ ...(current ?? {}), [key]: value }))
  }

  const commands = get('commands')
  if (commands && typeof commands.register === 'function') {
    const definition = createCommand({
      engine,
      get,
      trackedRoots,
      manageableEntries,
      describeWorkspaces,
      pollOnce,
      setConfig: setConfigValue,
    })
    ctx.effect(() => commands.register(definition))
  }

  log(
    `已加载：仓库 ${engine.cfg.repo || engine.cfg.repoName}，分支 ${engine.cfg.branch}，自动同步${
      engine.cfg.autoSync ? `开（${engine.cfg.pollSeconds}s 轮询）` : '关'
    }`,
  )
}
