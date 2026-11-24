import test from 'node:test'
import assert from 'node:assert/strict'
import { gitBlobSha, sanitizeSegment, parseEnvFile, upsertEnvFile, compileGlobs } from '../lib/util.js'
import { createFilter, snapshotHash, scanTree } from '../lib/files.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

test('gitBlobSha matches git object ids', () => {
  assert.equal(gitBlobSha(Buffer.from('')), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
  assert.equal(gitBlobSha(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a')
  assert.equal(gitBlobSha(Buffer.from('hello')), 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0')
})

test('sanitizeSegment keeps remote paths safe', () => {
  assert.equal(sanitizeSegment('My Workspace!'), 'My-Workspace')
  assert.equal(sanitizeSegment(''), 'workspace')
})

test('dotenv round trip keeps unrelated lines', () => {
  const text = 'A=1\nB=2\n'
  const updated = upsertEnvFile(text, 'GITHUB_TOKEN', 'ghp_x')
  assert.match(updated, /GITHUB_TOKEN=ghp_x/)
  assert.equal(parseEnvFile(updated).get('A'), '1')
  assert.equal(parseEnvFile(updated).get('B'), '2')
})

test('filter excludes git internals and secrets', () => {
  const filter = createFilter({ exclude: ['.git/**', '**/*.zstd', '.env'], include: [] })
  assert.equal(filter('.git/config'), false)
  assert.equal(filter('sessions/x.zstd'), false)
  assert.equal(filter('.env'), false)
  assert.equal(filter('skills/a/SKILL.md'), true)
})

test('globs compile with ** semantics', () => {
  const filter = createFilter({ exclude: ['node_modules/**'], include: [] })
  assert.equal(filter('node_modules/x/y.js'), false)
  assert.equal(filter('node_modulesx/y.js'), true)
})

test('scanTree + snapshotHash are deterministic and skip .git', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-test-scan-'))
  try {
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true })
    fs.writeFileSync(path.join(dir, '.git', 'config'), 'x')
    fs.mkdirSync(path.join(dir, 'skills'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'skills', 'a.md'), '# a\n')
    const first = scanTree(dir, { filter: () => true })
    const second = scanTree(dir, { filter: () => true })
    assert.deepEqual(first.files.map((file) => file.rel), ['skills/a.md'])
    assert.equal(snapshotHash(first.files), snapshotHash(second.files))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
