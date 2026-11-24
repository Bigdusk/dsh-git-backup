import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** Lowercase hex SHA-256 of a Buffer or string. */
export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

/** The object name Git itself computes for a file's content. */
export function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8')
  return createHash('sha1').update(header).update(buffer).digest('hex')
}

/** Normalize a Windows or POSIX path to forward slashes. */
export function toPosix(value) {
  return String(value).split(path.sep).join('/').split('\\').join('/')
}

/** A repository-safe path segment derived from a folder name. */
export function sanitizeSegment(value, fallback = 'workspace') {
  const cleaned = String(value ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+/, '')
    .replace(/[-.]+$/, '')
    .slice(0, 60)
  return cleaned || fallback
}

/** Show only the shape of a secret. */
export function maskSecret(value) {
  const text = String(value ?? '')
  if (text.length <= 8) return '***'
  return `${text.slice(0, 4)}…${text.slice(-4)}`
}

export function formatBytes(bytes) {
  const size = Number(bytes) || 0
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory()
  } catch {
    return false
  }
}

/** Compile one glob (supports **, *, ?) into a RegExp over POSIX paths. */
export function globToRegExp(pattern) {
  const source = String(pattern ?? '').replace(/\\/g, '/').replace(/^\.\//, '')
  const parts = source.split('/')
  let out = ''
  for (let index = 0; index < parts.length; index += 1) {
    const segment = parts[index]
    const last = index === parts.length - 1
    if (segment === '**') {
      out += last ? '.*' : '(?:[^/]+/)*'
      continue
    }
    out += segment
      .split('')
      .map((character) => {
        if (character === '*') return '[^/]*'
        if (character === '?') return '[^/]'
        return character.replace(/[.+^${}()|[\]\\]/g, '\\$&')
      })
      .join('')
    if (!last) out += '/'
  }
  return new RegExp(`^${out}$`)
}

/** Build a predicate over POSIX relative paths; empty patterns match nothing. */
export function compileGlobs(patterns) {
  const list = (Array.isArray(patterns) ? patterns : []).filter((item) => typeof item === 'string' && item.trim() !== '')
  const expressions = list.map(globToRegExp)
  return (relative) => expressions.some((expression) => expression.test(relative))
}

/** Parse `KEY=VALUE` lines from a dotenv-style file body. */
export function parseEnvFile(text) {
  const values = new Map()
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values.set(match[1], value)
  }
  return values
}

/** Replace or append one key in a dotenv-style file body, returning the new body. */
export function upsertEnvFile(text, key, value) {
  const lines = String(text ?? '').split(/\r?\n/)
  const pattern = new RegExp(`^(\\s*(?:export\\s+)?${key}\\s*=)`)
  let replaced = false
  const next = lines.map((line) => {
    if (replaced) return line
    if (pattern.test(line)) {
      replaced = true
      return `${key}=${value}`
    }
    return line
  })
  if (!replaced) {
    while (next.length > 0 && next[next.length - 1].trim() === '') next.pop()
    next.push(`${key}=${value}`)
  }
  return `${next.join('\n')}\n`
}

/** A bounded, human-readable list for tool summaries. */
export function summarizeList(items, limit = 8) {
  const list = Array.from(items)
  if (list.length <= limit) return list.join('、')
  return `${list.slice(0, limit).join('、')} 等 ${list.length} 项`
}
