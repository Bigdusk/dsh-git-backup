import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCommand } from '../lib/commands.js'

const payloadOf = (text) => {
  const match = /⟦dshb:(.+?)⟧/s.exec(String(text))
  return match ? JSON.parse(match[1]) : null
}

function fakeEngine(overrides = {}) {
  const engine = {
    cfg: {
      repo: '',
      repoName: 'dsh-backup',
      branch: 'main',
      layout: 'workspaces',
      remoteRoot: '',
      pollSeconds: 15,
      debounceSeconds: 4,
      autoSync: true,
    },
    rootState: () => ({}),
    history: async () => ({ items: [] }),
    detail: async () => ({ commit: { sha: 'abc123' }, files: [] }),
    diff: async () => ({
      commit: { sha: 'abc1234567' },
      requested: 'a.md',
      files: [{ path: 'a.md', additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-old\n+new' }],
    }),
    health: async () => ({
      repository: 'o/r',
      private: true,
      repoSizeKb: 1024,
      branch: 'main',
      head: 'abc1234567',
      remoteCount: 2,
      localCount: 2,
      same: 2,
      mismatch: [],
      missing: [],
      extra: [],
    }),
    setAutoSync(value) {
      engine.cfg.autoSync = value
      return value
    },
    clearToken: () => ({ removed: true, envFile: 'C:/home/.env', envVar: 'GITHUB_TOKEN' }),
    saveToken: async () => ({ login: 'tester', envFile: 'C:/home/.env', envVar: 'GITHUB_TOKEN' }),
    push: async () => ({ added: 1, removed: 0, repo: 'o/r', branch: 'main', commitUrl: 'https://x' }),
    ...overrides,
  }
  return engine
}

function makeCommand(engine) {
  const configWrites = []
  const command = createCommand({
    engine,
    get: () => null,
    trackedRoots: () => [],
    manageableEntries: () => [],
    describeWorkspaces: () => '',
    pollOnce: () => {},
    readConfig: () => engine.cfg,
    setConfig: async (key, value) => {
      configWrites.push([key, value])
      engine.cfg[key] = value
    },
  })
  return { command, configWrites }
}

test('auto on/off toggles runtime state without config writes', async () => {
  const engine = fakeEngine()
  const { command, configWrites } = makeCommand(engine)
  const off = await command.handler({ rawInput: 'auto off' })
  assert.equal(off.kind, 'success')
  assert.match(off.text, /关闭/)
  assert.equal(engine.cfg.autoSync, false)
  assert.deepEqual(configWrites, [])

  const on = await command.handler({ rawInput: 'auto on' })
  assert.match(on.text, /开启/)
  assert.equal(engine.cfg.autoSync, true)
})

test('token clear removes persisted token', async () => {
  const engine = fakeEngine()
  const { command } = makeCommand(engine)
  const result = await command.handler({ rawInput: 'token clear' })
  assert.equal(result.kind, 'success')
  assert.match(result.text, /已从 .* 删除 GITHUB_TOKEN/)
})

test('token save reports the verified account', async () => {
  const engine = fakeEngine()
  const { command } = makeCommand(engine)
  const result = await command.handler({ rawInput: 'token ghp_example_token_123456' })
  assert.equal(result.kind, 'success')
  assert.match(result.text, /tester/)
})

test('diff returns a patch and a structured payload', async () => {
  const engine = fakeEngine()
  const { command } = makeCommand(engine)
  const result = await command.handler({ rawInput: 'diff abc123 a.md' })
  assert.equal(result.kind, 'success')
  assert.match(result.text, /@@ -1 \+1 @@/)
  const payload = payloadOf(result.text)
  assert.equal(payload.kind, 'diff')
  assert.equal(payload.files[0].path, 'a.md')
  assert.ok(payload.files[0].patch.includes('+new'))
})

test('health reports consistency counts', async () => {
  const engine = fakeEngine()
  const { command } = makeCommand(engine)
  const result = await command.handler({ rawInput: 'health' })
  assert.equal(result.kind, 'success')
  assert.match(result.text, /一致 2/)
  const payload = payloadOf(result.text)
  assert.equal(payload.kind, 'health')
  assert.equal(payload.repoSizeKb, 1024)
})

test('unknown action prints usage', async () => {
  const engine = fakeEngine()
  const { command } = makeCommand(engine)
  const result = await command.handler({ rawInput: 'nope' })
  assert.equal(result.kind, 'error')
  assert.match(result.text, /用法/)
})

test('config set writes through the injected editor', async () => {
  const engine = fakeEngine()
  const { command, configWrites } = makeCommand(engine)
  const result = await command.handler({ rawInput: 'config set branch dev' })
  assert.equal(result.kind, 'success')
  assert.deepEqual(configWrites, [['branch', 'dev']])
})

test('remote lists backed-up workspaces and emits a payload', async () => {
  const engine = fakeEngine({
    remoteWorkspaces: async () => ({
      repo: 'o/r',
      branch: 'main',
      headCommit: 'abc1234567',
      items: [
        { prefix: 'workspaces/old', name: 'old', files: 2, last: { short: 'aaa1111111', date: '2026-01-01T00:00:00Z', message: 'backup(old)' } },
      ],
    }),
  })
  const { command } = makeCommand(engine)
  const result = await command.handler({ rawInput: 'remote' })
  assert.equal(result.kind, 'success')
  assert.match(result.text, /workspaces\/old/)
  const payload = payloadOf(result.text)
  assert.equal(payload.kind, 'remotes')
  assert.equal(payload.items[0].files, 2)
})

test('pull forwards --from and --prune to the engine', async () => {
  let seen = null
  const engine = fakeEngine({
    pull: async (root, options) => {
      seen = options
      return {
        repo: 'o/r',
        branch: 'main',
        prefix: 'workspaces/old',
        folder: `${root}/.dsh`,
        total: 1,
        written: ['a.md'],
        wouldWrite: ['a.md'],
        same: [],
        excluded: [],
        pruned: ['b.md'],
        failures: [],
        autoPrefix: true,
        dryRun: false,
      }
    },
  })
  const { command } = makeCommand(engine)
  const result = await command.handler({ rawInput: 'pull --from workspaces/old --prune' })
  assert.equal(result.kind, 'success')
  assert.equal(seen.remoteRoot, 'workspaces/old')
  assert.equal(seen.prune, true)
  assert.match(result.text, /自动选用/)
})

test('pull-workspace creates a folder, registers it, then pulls', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'dshgb-cmd-'))
  const pulls = []
  const registered = []
  const engine = fakeEngine({
    pull: async (root, options) => {
      pulls.push({ root, options })
      return {
        repo: 'o/r',
        branch: 'main',
        prefix: options.remoteRoot,
        headCommit: 'abc1234567',
        total: 2,
        written: ['SKILL.md', 'sub/a.md'],
        wouldWrite: [],
        same: [],
        excluded: [],
        pruned: [],
        failures: [],
        dryRun: false,
        folder: path.join(root, '.dsh'),
      }
    },
  })
  const command = createCommand({
    engine,
    get: (name) =>
      name === 'workspaceRegistry'
        ? {
            create: async (dir, title) => {
              registered.push([dir, title])
              return { id: 'ws_1' }
            },
          }
        : null,
    trackedRoots: () => [],
    manageableEntries: () => [],
    describeWorkspaces: () => '',
    pollOnce: () => {},
    readConfig: () => engine.cfg,
    setConfig: async () => {},
  })
  const result = await command.handler({ rawInput: `pull-workspace workspaces/old-machine --dir ${parent}` })
  assert.equal(result.kind, 'success')
  assert.match(result.text, /并注册为 DeepSeek Harness 工作区/)
  assert.deepEqual(registered, [[path.join(parent, 'old-machine'), 'old-machine']])
  assert.equal(pulls[0].options.remoteRoot, 'workspaces/old-machine')
  const payload = payloadOf(result.text)
  assert.equal(payload.kind, 'pulled')
  assert.equal(payload.registered, true)
  assert.equal(payload.written, 2)
  assert.equal(fs.existsSync(path.join(parent, 'old-machine')), true)
  fs.rmSync(parent, { recursive: true, force: true })
})
