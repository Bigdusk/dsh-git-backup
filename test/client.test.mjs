import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const entry = path.join(root, 'client.js')

let captured = null
globalThis.window = { __ModuleLoader__: { load: (spec) => (captured = spec) } }
await import(pathToFileURL(entry).href)

let active = null
let currentRender = () => {}
const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity).filter((c) => c != null) }),
  useState(initial) {
    const index = active.cursor++
    if (!(index in active.hooks)) active.hooks[index] = typeof initial === 'function' ? initial() : initial
    return [
      active.hooks[index],
      (next) => {
        active.hooks[index] = typeof next === 'function' ? next(active.hooks[index]) : next
        currentRender()
      },
    ]
  },
  useEffect(fn, deps) {
    const index = active.cursor++
    const previous = active.deps[index]
    const changed = !previous || !deps || deps.some((value, position) => !Object.is(value, previous[position]))
    if (changed) {
      active.deps[index] = deps ?? []
      fn()
    }
  },
}

function createHarness() {
  const store = { hooks: [], deps: [], cursor: 0, component: null }
  const calls = []
  const listeners = new Set()
  let entries = []
  const ctx = {
    get: (name) =>
      name !== 'sessions'
        ? undefined
        : {
            using: async (_id, _options, operation) =>
              operation({
                binding: {
                  session: {
                    command: async (line) => {
                      calls.push(line)
                      return { ok: true, value: { matched: true } }
                    },
                  },
                },
              }),
            retain: () => ({
              ready: Promise.resolve(),
              binding: {
                eventSource: {
                  getSnapshot: () => ({ entries }),
                  subscribe: (fn) => {
                    listeners.add(fn)
                    return () => listeners.delete(fn)
                  },
                },
              },
              release: () => {},
            }),
          },
    slots: { inject: (_key, callback) => callback(), register: (_options, component) => (store.component = component) },
  }
  captured.factory((name) => (name === 'react' ? React : undefined)).apply(ctx)
  function render() {
    /* defined below */
    active = store
    store.cursor = 0
    store.tree = store.component({ sessionId: 's' })
    return store.tree
  }
  currentRender = render
  const flat = (node, out = []) => {
    if (node == null || node === false) return out
    if (Array.isArray(node)) {
      for (const child of node) flat(child, out)
      return out
    }
    if (typeof node === 'string' || typeof node === 'number') {
      out.push({ text: String(node) })
      return out
    }
    if (typeof node === 'object') {
      out.push({ element: node })
      for (const child of node.children ?? []) flat(child, out)
    }
    return out
  }
  const nodes = () => flat(store.tree)
  const elements = () => nodes().filter((item) => item.element).map((item) => item.element)
  const text = () => nodes().filter((item) => item.text).map((item) => item.text).join(' ')
  const byClass = (name) => elements().filter((element) => String(element.props.className ?? '').includes(name))
  const buttons = () => elements().filter((element) => element.type === 'button')
  const byText = (label) => buttons().find((button) => flat(button).some((item) => item.text === label))
  const emit = (payload) => {
    entries = [...entries, { type: 'event', event: { type: 'command/done', data: { text: `⟦dshb:${JSON.stringify(payload)}⟧` } } }]
    for (const listener of listeners) listener()
    render()
  }
  return { render, text, elements, byClass, byText, emit, calls }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

test('client renders the snapshot view shell', async () => {
  const ui = createHarness()
  ui.render()
  assert.ok(ui.byClass('dshgb-skeleton').length > 0, 'skeleton rows while loading')
  await settle()
  ui.render()
  assert.equal(ui.byClass('dshgb-shell').length, 1)
  assert.ok(ui.text().includes('快照与版本'))
  assert.ok(ui.byText('立即提交'))
  assert.ok(ui.byText('拉取'))
  assert.ok(ui.byText('设置 token'))
})

test('client shows commit badges, diff and health', async () => {
  const ui = createHarness()
  ui.render()
  assert.ok(ui.byClass('dshgb-skeleton').length > 0, 'skeleton rows while loading')
  await settle()
  ui.render()
  ui.emit({ kind: 'status', autoSync: true, token: { present: true, daysLeft: 20 }, failingRoots: [], roots: [] })
  ui.emit({ kind: 'config', values: { repo: 'o/r', repoName: 'r', branch: 'main', layout: 'workspaces', pollSeconds: 15, autoSync: true } })
  ui.emit({
    kind: 'versions',
    items: [
      { n: 1, sha: 'aaa1111111', short: 'aaa1111111', date: new Date().toISOString(), message: 'backup(T): 2 个文件更新 @ 2026-01-01T00:00:00Z' },
      { n: 2, sha: 'bbb2222222', short: 'bbb2222222', date: new Date().toISOString(), message: 'manual(T): 1 个文件更新' },
      { n: 3, sha: 'ccc3333333', short: 'ccc3333333', date: new Date().toISOString(), message: 'rollback(T): restore aaa1111111' },
    ],
  })
  assert.ok(['自动', '手动', '回滚'].every((label) => ui.text().includes(label)))
  assert.ok(!ui.text().includes('2026-01-01T00:00:00Z'))

  ui.emit({ kind: 'diff', short: 'aaa1111111', files: [{ path: 'skills/a.md', additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-old\n+new' }] })
  assert.ok(ui.text().includes('new'))
  assert.ok(ui.byClass('dshgb-diffline--add').length >= 1)
  assert.ok(ui.byClass('dshgb-diffline--del').length >= 1)

  ui.emit({ kind: 'health', repository: 'o/r', repoSizeKb: 2048, remoteCount: 3, localCount: 3, same: 2, mismatch: ['x.md'], missing: [], extra: [] })
  assert.ok(ui.text().includes('仓库体检'))
  assert.ok(ui.text().includes('内容不一致 1'))
})

test('auto-sync switch dispatches the instant runtime command', async () => {
  const ui = createHarness()
  ui.render()
  assert.ok(ui.byClass('dshgb-skeleton').length > 0, 'skeleton rows while loading')
  await settle()
  ui.render()
  ui.emit({ kind: 'status', autoSync: true, token: { present: true, daysLeft: 20 }, failingRoots: [], roots: [] })
  const toggle = ui.elements().find((element) => element.props.role === 'switch')
  assert.ok(toggle)
  assert.equal(toggle.props['aria-checked'], true)
  toggle.props.onClick()
  ui.render()
  await settle()
  assert.ok(ui.calls.includes('/dsh-backup auto off'))
  assert.ok(!ui.calls.some((line) => line.includes('config set autoSync')))
})
