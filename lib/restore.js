import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Restore a remote workspace into a brand-new local folder: the folder is
 * created first, registered as a DeepSeek Harness workspace, and only then
 * filled from the GitHub backup. Pulling into the *current* workspace is the
 * old behaviour and no longer drives the remote-backup buttons, because a
 * freshly opened DSH usually has no matching workspace yet.
 */

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

/** A folder name that Windows, macOS and Linux all accept. */
export function safeFolderName(value, fallback = 'workspace') {
  const cleaned = String(value ?? '')
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '-')
    .replace(/^[\s.]+/, '')
    .replace(/[\s.]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 64)
    .trim()
  if (cleaned === '') return fallback
  return RESERVED.test(cleaned) ? `${cleaned}-backup` : cleaned
}

/** `workspaces/T` → `T`; a bare prefix also works. */
export function remoteWorkspaceName(prefix) {
  const text = String(prefix ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
  if (text === '') return ''
  const segment = text.split('/').filter(Boolean).pop() ?? ''
  return safeFolderName(segment, '')
}

/** Desktop directories, most likely first; Windows may redirect it to OneDrive. */
export function desktopCandidates(env = process.env, home = os.homedir()) {
  const seen = new Set()
  const list = []
  const push = (value) => {
    if (typeof value !== 'string' || value.trim() === '') return
    const resolved = path.resolve(value)
    const key = resolved.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    list.push(resolved)
  }
  const oneDrive = env?.OneDrive ?? env?.ONEDRIVE
  if (oneDrive) push(path.join(oneDrive, 'Desktop'))
  if (env?.USERPROFILE) {
    push(path.join(env.USERPROFILE, 'Desktop'))
    push(path.join(env.USERPROFILE, 'OneDrive', 'Desktop'))
    push(path.join(env.USERPROFILE, '桌面'))
  }
  if (env?.HOME) {
    push(path.join(env.HOME, 'Desktop'))
    push(path.join(env.HOME, '桌面'))
  }
  if (home) {
    push(path.join(home, 'Desktop'))
    push(path.join(home, '桌面'))
  }
  return list
}

/** The first existing Desktop candidate, or null when the machine has none. */
export function resolveDesktop(env = process.env, home = os.homedir()) {
  for (const candidate of desktopCandidates(env, home)) {
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate
    } catch {
      /* keep looking */
    }
  }
  return null
}

function isEmptyDirectory(target) {
  try {
    if (!fs.statSync(target).isDirectory()) return false
    return fs.readdirSync(target).length === 0
  } catch {
    return false
  }
}

/**
 * A target directory that does not exist yet (or is an empty directory we may
 * reuse), suffixing `-2`, `-3`, … so a restore never overwrites existing data.
 */
export function uniqueTarget(parentDir, baseName) {
  const parent = path.resolve(parentDir)
  const base = safeFolderName(baseName)
  const first = path.join(parent, base)
  if (!fs.existsSync(first) || isEmptyDirectory(first)) return first
  for (let index = 2; index < 1000; index += 1) {
    const candidate = path.join(parent, `${base}-${index}`)
    if (!fs.existsSync(candidate) || isEmptyDirectory(candidate)) return candidate
  }
  throw new Error(`${parent} 里 ${base} 的重名文件夹太多，请手动指定 --name`)
}

/**
 * Drop one Harness workspace registration, keeping the directory and every file
 * in it. Used to undo a restore the user does not want to keep.
 */
export async function forgetWorkspace(options = {}) {
  const get = typeof options.get === 'function' ? options.get : () => undefined
  const registry = options.registry ?? get('workspaceRegistry')
  if (!registry || typeof registry.delete !== 'function' || typeof registry.resolveByPath !== 'function') {
    throw new Error('宿主不支持移除工作区注册（workspaceRegistry）')
  }
  const raw = String(options.path ?? '').trim()
  if (raw === '') throw new Error('缺少工作区绝对路径')
  const target = path.resolve(raw)
  const workspace = await registry.resolveByPath(target)
  if (!workspace) return { removed: false, path: target, title: null }
  await registry.delete(workspace.id)
  return { removed: true, path: workspace.path, title: workspace.title }
}

/**
 * Create `<parent>/<name>`, register it as a Harness workspace, then pull the
 * remote prefix into it. Registration is best effort: when the Host has no
 * workspace registry the files are still restored and the reason is reported.
 */
export async function pullIntoNewWorkspace(options = {}) {
  const engine = options.engine
  if (!engine || typeof engine.pull !== 'function') throw new Error('备份引擎不可用')
  const prefix = String(options.prefix ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
  if (prefix === '') throw new Error('缺少远端工作区前缀，例如 workspaces/T')

  const explicitParent = String(options.parentDir ?? '').trim()
  const parent = explicitParent
    ? path.resolve(explicitParent)
    : resolveDesktop(options.env, options.home) ?? os.homedir()
  const requestedName = String(options.name ?? '').trim()
  const baseName = requestedName === '' ? remoteWorkspaceName(prefix) : safeFolderName(requestedName)
  if (baseName === '') throw new Error('无法从远端前缀推断文件夹名，请用 --name 指定')
  const target = uniqueTarget(parent, baseName)
  const folderName = path.basename(target)
  const dryRun = options.dryRun === true

  if (dryRun) {
    const preview = await engine.pull(target, { remoteRoot: prefix, dryRun: true, signal: options.signal })
    return {
      dryRun: true,
      parent,
      target,
      name: folderName,
      prefix,
      created: false,
      registered: false,
      workspaceId: null,
      registerError: null,
      result: preview,
    }
  }

  fs.mkdirSync(target, { recursive: true })

  const get = typeof options.get === 'function' ? options.get : () => undefined
  const registry = options.registry ?? get('workspaceRegistry')
  let workspace = null
  let registerError = null
  if (registry && typeof registry.create === 'function') {
    try {
      workspace = await registry.create(target, folderName)
    } catch (error) {
      registerError = error?.message ?? String(error)
    }
  } else {
    registerError = '宿主没有工作区注册服务（workspaceRegistry）'
  }

  const result = await engine.pull(target, {
    remoteRoot: prefix,
    prune: options.prune === true,
    signal: options.signal,
  })

  return {
    dryRun: false,
    parent,
    target,
    name: folderName,
    prefix,
    created: true,
    registered: Boolean(workspace),
    workspaceId: workspace?.id ?? null,
    registerError,
    result,
  }
}
