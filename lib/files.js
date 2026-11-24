import fs from 'node:fs'
import path from 'node:path'
import { compileGlobs, gitBlobSha, sha256Hex, toPosix } from './util.js'

const PRUNED_DIRECTORIES = new Set(['.git', 'node_modules'])

/**
 * Build the file filter for one backup configuration.
 * `relative` is always a POSIX path below the backed-up folder.
 */
export function createFilter(config = {}) {
  const isExcluded = compileGlobs(config.exclude)
  const isIncluded = compileGlobs(config.include)
  const hasIncludes = Array.isArray(config.include) && config.include.some((item) => typeof item === 'string' && item.trim() !== '')
  return (relative) => {
    if (isExcluded(relative)) return false
    if (hasIncludes && !isIncluded(relative)) return false
    return true
  }
}

/**
 * Walk a folder and return the files that would be backed up.
 * Returns `{ files, skipped }`; `skipped` lists files over the size limit.
 */
export function scanTree(root, config = {}) {
  const filter = createFilter(config)
  const maxBytes = Number(config.maxFileBytes) > 0 ? Number(config.maxFileBytes) : Number.POSITIVE_INFINITY
  const files = []
  const skipped = []

  const walk = (directory, prefix) => {
    let entries
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolute = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (PRUNED_DIRECTORIES.has(entry.name)) continue
        walk(absolute, relative)
        continue
      }
      if (!entry.isFile()) continue
      if (!filter(relative)) continue
      let stat
      try {
        stat = fs.statSync(absolute)
      } catch {
        continue
      }
      if (stat.size > maxBytes) {
        skipped.push({ rel: relative, size: stat.size })
        continue
      }
      files.push({ rel: relative, abs: absolute, size: stat.size, mtimeMs: stat.mtimeMs })
    }
  }

  walk(root, '')
  files.sort((left, right) => (left.rel < right.rel ? -1 : left.rel > right.rel ? 1 : 0))
  return { files, skipped }
}

/**
 * A cheap change fingerprint: paths and sizes only, so a polling loop never
 * reads file bodies. Content identity is checked again during a push.
 */
export function snapshotHash(files) {
  const material = files.map((file) => `${file.rel}\t${file.size}`).join('\n')
  return sha256Hex(material)
}

/** Read the Git object name for one file without keeping its bytes around. */
export function fileBlobSha(absolute) {
  return gitBlobSha(fs.readFileSync(absolute))
}

/** Write a file, creating parent directories, through a temporary sibling. */
export function writeFileAtomic(absolute, buffer) {
  const directory = path.dirname(absolute)
  fs.mkdirSync(directory, { recursive: true })
  const temporary = path.join(directory, `.${path.basename(absolute)}.${process.pid}.dsh-backup.tmp`)
  fs.writeFileSync(temporary, buffer)
  try {
    fs.renameSync(temporary, absolute)
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true })
    } catch {
      /* best effort */
    }
    throw error
  }
}

/** POSIX path of `absolute` relative to `root`, or undefined when outside it. */
export function relativeInside(root, absolute) {
  const relative = path.relative(root, absolute)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return undefined
  return toPosix(relative)
}
