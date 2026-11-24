import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { BackupEngine } from '../lib/engine.js'

const tempHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-test-home-'))
const tempWorkspace = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-test-ws-'))
  fs.mkdirSync(path.join(dir, '.dsh'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.dsh', 'a.md'), '# a\n')
  return dir
}

test('auto-sync preference persists without touching config', () => {
  const home = tempHome()
  try {
    const engine = new BackupEngine({ config: { autoSync: true }, home })
    assert.equal(engine.cfg.autoSync, true)
    engine.setAutoSync(false)
    assert.equal(engine.cfg.autoSync, false)
    assert.ok(fs.existsSync(engine.prefsPath()))

    const restarted = new BackupEngine({ config: { autoSync: true }, home })
    restarted.applyPrefs()
    assert.equal(restarted.cfg.autoSync, false)
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('operations on one workspace serialize, different workspaces stay parallel', async () => {
  const home = tempHome()
  const engine = new BackupEngine({ config: {}, home })
  try {
    const order = []
    const first = engine.withLock('C:/tmp/one', async () => {
      order.push('a-start')
      await new Promise((resolve) => setTimeout(resolve, 20))
      order.push('a-end')
    })
    await engine.withLock('C:/tmp/one', async () => order.push('b'))
    await first
    assert.deepEqual(order, ['a-start', 'a-end', 'b'])

    const parallel = []
    await Promise.all([
      engine.withLock('C:/tmp/x', async () => {
        await new Promise((resolve) => setTimeout(resolve, 15))
        parallel.push('x')
      }),
      engine.withLock('C:/tmp/y', async () => parallel.push('y')),
    ])
    assert.equal(parallel.length, 2)
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('blob sha cache reuses hashes and invalidates on file change', () => {
  const home = tempHome()
  const workspace = tempWorkspace()
  try {
    const file = path.join(workspace, '.dsh', 'a.md')
    const engine = new BackupEngine({ config: {}, home })
    const first = engine.blobShaFor(file)
    assert.equal(typeof first, 'string')
    assert.equal(engine.blobShaFor(file), first)
    assert.ok(engine.blobCacheDirty)

    engine.saveBlobCache()
    const restarted = new BackupEngine({ config: {}, home })
    assert.equal(restarted.blobCache.get(file)?.sha, first)

    fs.writeFileSync(file, '# changed\n')
    const changed = restarted.blobShaFor(file)
    assert.notEqual(changed, first)
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
    fs.rmSync(workspace, { recursive: true, force: true })
  }
})

test('registry writes are locked and atomic', async () => {
  const home = tempHome()
  try {
    const one = new BackupEngine({ config: {}, home })
    const two = new BackupEngine({ config: {}, home })
    await Promise.all([
      Promise.resolve().then(() => one.updateRegistry((registry) => ({ ...registry, extra: ['C:/a'] }))),
      Promise.resolve().then(() => two.updateRegistry((registry) => ({ ...registry, extra: [...registry.extra, 'C:/b'] }))),
    ])
    const final = one.loadRegistry()
    assert.deepEqual([...final.extra].sort(), ['C:/a', 'C:/b'])
    assert.equal(fs.existsSync(one.registryLockPath()), false)

    // A stale lock (crashed writer) must not block new writes forever.
    fs.mkdirSync(path.dirname(one.registryLockPath()), { recursive: true })
    fs.writeFileSync(one.registryLockPath(), '99999')
    const old = new Date(Date.now() - 60_000)
    fs.utimesSync(one.registryLockPath(), old, old)
    const updated = one.updateRegistry((registry) => ({ ...registry, extra: [...registry.extra, 'C:/c'] }))
    assert.ok(updated.extra.includes('C:/c'))
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('auto push aborts when remote head moved, manual push overwrites', async () => {
  const home = tempHome()
  const workspace = tempWorkspace()
  process.env.GITHUB_TOKEN = 'ghp_test_token_for_suite_123456'
  const stubClient = () => ({
    resolveRepository: async () => ({ owner: 'o', name: 'r', fullName: 'o/r', branch: 'main' }),
    getRef: async () => ({ commitSha: 'remotehead0001' }),
    getCommit: async () => ({ commitSha: 'remotehead0001', treeSha: 'tree1', message: 'x' }),
    getTree: async () => ({ files: new Map(), truncated: false }),
    createBlob: async () => 'blob1',
    createTree: async () => 'tree2',
    createCommit: async () => ({ commitSha: 'commit1' }),
    createRef: async () => {},
    updateRef: async () => {},
  })
  try {
    const engine = new BackupEngine({ config: { repo: 'o/r' }, home })
    engine.client = stubClient
    engine.rootState(workspace).lastRemoteHead = 'previoushead001'
    await assert.rejects(() => engine.push(workspace, { source: 'auto', kind: 'backup' }), /远端有新提交/)

    const manual = new BackupEngine({ config: { repo: 'o/r' }, home })
    manual.client = stubClient
    manual.rootState(workspace).lastRemoteHead = 'previoushead001'
    const result = await manual.push(workspace, { source: 'manual', kind: 'manual' })
    assert.ok(result.commitSha || result.commitUrl || result.upToDate !== undefined)

    const matching = new BackupEngine({ config: { repo: 'o/r' }, home })
    matching.client = stubClient
    matching.rootState(workspace).lastRemoteHead = 'remotehead0001'
    await matching.push(workspace, { source: 'auto', kind: 'backup' })
  } finally {
    delete process.env.GITHUB_TOKEN
    fs.rmSync(home, { recursive: true, force: true })
    fs.rmSync(workspace, { recursive: true, force: true })
  }
})

test('clearToken removes only the token line', () => {
  const home = tempHome()
  try {
    const engine = new BackupEngine({ config: {}, home })
    fs.writeFileSync(path.join(home, '.env'), 'GITHUB_TOKEN=ghp_secret\nOTHER=1\n')
    const result = engine.clearToken()
    assert.equal(result.removed, true)
    const text = fs.readFileSync(path.join(home, '.env'), 'utf8')
    assert.ok(!text.includes('ghp_secret'))
    assert.ok(text.includes('OTHER=1'))
    assert.equal(engine.clearToken().removed, false)
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})
