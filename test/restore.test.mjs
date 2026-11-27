import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  desktopCandidates,
  forgetWorkspace,
  pullIntoNewWorkspace,
  remoteWorkspaceName,
  resolveDesktop,
  safeFolderName,
  uniqueTarget,
} from '../lib/restore.js'

const tempDir = (label) => fs.mkdtempSync(path.join(os.tmpdir(), `dshgb-${label}-`))

test('safeFolderName keeps Chinese names but strips Windows-illegal characters', () => {
  assert.equal(safeFolderName('我的项目'), '我的项目')
  assert.equal(safeFolderName('a/b:c*d?'), 'a-b-c-d-')
  assert.equal(safeFolderName('  ..name.. '), 'name')
  assert.equal(safeFolderName('', 'fallback'), 'fallback')
  assert.equal(safeFolderName('CON'), 'CON-backup')
})

test('remoteWorkspaceName takes the last segment of a prefix', () => {
  assert.equal(remoteWorkspaceName('workspaces/T'), 'T')
  assert.equal(remoteWorkspaceName('workspaces/AI-video/'), 'AI-video')
  assert.equal(remoteWorkspaceName('default-workspace'), 'default-workspace')
  assert.equal(remoteWorkspaceName(''), '')
})

test('desktopCandidates prefers a redirected OneDrive Desktop and de-duplicates', () => {
  const env = { OneDrive: 'C:\\Users\\me\\OneDrive', USERPROFILE: 'C:\\Users\\me' }
  const list = desktopCandidates(env, 'C:\\Users\\me')
  assert.equal(list[0].toLowerCase(), 'c:\\users\\me\\onedrive\\desktop')
  assert.ok(list.includes(path.resolve('C:\\Users\\me\\Desktop')))
  assert.equal(new Set(list.map((item) => item.toLowerCase())).size, list.length)
})

test('resolveDesktop returns an existing candidate or null', () => {
  const root = tempDir('desktop')
  const desktop = path.join(root, 'Desktop')
  fs.mkdirSync(desktop)
  assert.equal(resolveDesktop({ USERPROFILE: root }, root), path.resolve(desktop))
  assert.equal(resolveDesktop({ USERPROFILE: path.join(root, 'nope') }, path.join(root, 'nope')), null)
})

test('uniqueTarget never reuses a non-empty folder and reuses an empty one', () => {
  const parent = tempDir('unique')
  const empty = path.join(parent, 'T')
  fs.mkdirSync(empty)
  assert.equal(uniqueTarget(parent, 'T'), empty)

  fs.writeFileSync(path.join(empty, 'SKILL.md'), 'x')
  assert.equal(uniqueTarget(parent, 'T'), path.join(parent, 'T-2'))

  fs.mkdirSync(path.join(parent, 'T-2'))
  fs.writeFileSync(path.join(parent, 'T-2', 'a'), 'x')
  assert.equal(uniqueTarget(parent, 'T'), path.join(parent, 'T-3'))
})

function stubEngine(overrides = {}) {
  const calls = []
  return {
    calls,
    async pull(root, options) {
      calls.push({ root, options })
      return {
        repo: 'owner/dsh-backup',
        branch: 'main',
        prefix: options.remoteRoot,
        headCommit: 'abc123',
        total: 1,
        written: options.dryRun ? [] : ['SKILL.md'],
        wouldWrite: options.dryRun ? ['SKILL.md'] : [],
        same: [],
        excluded: [],
        pruned: [],
        failures: [],
        dryRun: Boolean(options.dryRun),
        folder: path.join(root, '.dsh'),
        ...overrides,
      }
    },
  }
}

test('pullIntoNewWorkspace creates the folder, registers it, then pulls', async () => {
  const parent = tempDir('restore')
  const engine = stubEngine()
  const registered = []
  const outcome = await pullIntoNewWorkspace({
    engine,
    prefix: 'workspaces/T',
    parentDir: parent,
    get: (name) => (name === 'workspaceRegistry' ? { create: async (dir, title) => registered.push({ dir, title }) && { id: 'ws_1' } } : undefined),
  })
  assert.equal(outcome.target, path.join(parent, 'T'))
  assert.ok(fs.statSync(outcome.target).isDirectory())
  assert.deepEqual(registered, [{ dir: path.join(parent, 'T'), title: 'T' }])
  assert.equal(outcome.registered, true)
  assert.equal(outcome.workspaceId, 'ws_1')
  assert.equal(engine.calls.length, 1)
  assert.deepEqual(engine.calls[0].options.remoteRoot, 'workspaces/T')
  assert.equal(engine.calls[0].options.prune, false)
  assert.deepEqual(outcome.result.written, ['SKILL.md'])
})

test('pullIntoNewWorkspace honours a custom name and prune', async () => {
  const parent = tempDir('named')
  const engine = stubEngine()
  const outcome = await pullIntoNewWorkspace({
    engine,
    prefix: 'workspaces/T',
    parentDir: parent,
    name: '我的恢复',
    prune: true,
    get: () => undefined,
  })
  assert.equal(outcome.target, path.join(parent, '我的恢复'))
  assert.equal(engine.calls[0].options.prune, true)
  assert.equal(outcome.registered, false)
  assert.match(outcome.registerError, /workspaceRegistry/)
})

test('pullIntoNewWorkspace dryRun writes nothing and registers nothing', async () => {
  const parent = tempDir('dry')
  const engine = stubEngine()
  const outcome = await pullIntoNewWorkspace({
    engine,
    prefix: 'workspaces/T',
    parentDir: parent,
    dryRun: true,
    get: () => {
      throw new Error('registry must not be touched during a preview')
    },
  })
  assert.equal(outcome.dryRun, true)
  assert.equal(outcome.created, false)
  assert.equal(fs.existsSync(path.join(parent, 'T')), false)
  assert.deepEqual(outcome.result.wouldWrite, ['SKILL.md'])
})

test('pullIntoNewWorkspace requires a prefix', async () => {
  await assert.rejects(() => pullIntoNewWorkspace({ engine: stubEngine(), prefix: '   ' }), /缺少远端工作区前缀/)
})

test('forgetWorkspace drops only the registration', async () => {
  const dir = tempDir('forget')
  const deleted = []
  const registry = {
    async resolveByPath(target) {
      assert.equal(target, path.resolve(dir))
      return { id: 'ws_9', path: dir, title: 'T' }
    },
    async delete(id) {
      deleted.push(id)
    },
  }
  const outcome = await forgetWorkspace({ registry, path: dir })
  assert.deepEqual(outcome, { removed: true, path: dir, title: 'T' })
  assert.deepEqual(deleted, ['ws_9'])
  assert.ok(fs.statSync(dir).isDirectory(), 'the directory is kept')

  const unknown = await forgetWorkspace({ registry: { ...registry, resolveByPath: async () => undefined }, path: dir })
  assert.equal(unknown.removed, false)
})
