window.__ModuleLoader__.load({
  id: '@local/dsh-git-backup',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    // Copy is fixed to Chinese for this installation.
    const TEXT = {
      viewLabel: '备份',
      viewTitle: '备份与回滚',
      viewHint: '所有同步都是自动的：改动会静默提交，这里只用来查看历史、回滚和调整配置。',
      versions: '版本回滚',
      workspaces: '工作区',
      config: '配置',
      refresh: '刷新',
      rollbackRef: '输入版本号或提交号',
      rollback: '回滚',
      preview: '预览',
      detail: '详情',
      undo: '撤销回滚',
      onlyThis: '仅恢复',
      confirmAll: '全部回滚',
      previewTitle: '回滚预览',
      detailTitle: '版本详情',
      close: '关闭',
      cancel: '取消',
      save: '保存',
      noFiles: '没有文件变更。',
      rollbackHint: '回滚会先把本地 .dsh 恢复到该版本（自动备份当前改动），再推一个新提交；结果同时出现在「对话」里。',
      noVersions: '暂无版本记录。',
      noWorkspaces: '暂无工作区记录。',
      addPath: '输入工作区绝对路径',
      add: '添加',
      enable: '启用',
      disable: '停用',
      files: '个文件',
      failed: '失败',
      noSession: '没有活动会话',
      loading: '加载中…',
      disabledBadge: '已停用',
      noMessage: '(无说明)',
      repoLabel: '仓库（owner/name，留空自动建）',
      branchLabel: '分支',
      pollLabel: '轮询秒数',
      layoutLabel: '远端布局',
      autoLabel: '自动同步',
      tokenLabel: 'GitHub token',
      tokenButton: '设置 token',
      tokenPlaceholder: 'ghp_… 或 github_pat_…',
      tokenHint: '需要 repo 权限 · 保存到 %USERPROFILE%\\.dsh\\.env · 不写入对话记录',
      tokenSaved: 'token 已保存并验证',
      tokenEmpty: '先粘贴 token',
      tokenConfigured: (days) =>
        days === null || days === undefined ? '已配置' : days >= 0 ? `已配置，还有 ${days} 天过期` : '已配置但已过期',
      tokenMissing: '未配置',
      on: '开',
      off: '关',
      configHint: '保存会写入 profile 配置，插件行会重启一次以应用。',
      configSaved: '配置已保存，插件正在重启…',
      nothingToSave: '没有需要保存的改动。',
      bannerTokenMissing: '还没有配置 GitHub token，在下方「配置」里粘贴保存后自动备份才会开始。',
      bannerExpiring: (days) =>
        days >= 0 ? `GitHub token 还有 ${days} 天过期，记得续期。` : 'GitHub token 已过期，请重新保存。',
      bannerFailing: (names) => `自动同步失败：${names.join('、')}（点「状态」或让 agent 查 dsh_backup_status）`,
      statusOk: '已发送，结果显示在对话里',
    }

    const STYLES = `
.dshgb-view { box-sizing:border-box; width:100%; height:100%; overflow:auto; padding:32px 40px 48px; font-size:12.5px; line-height:1.55; color:var(--dsw-alias-label-secondary); }
.dshgb-viewinner { display:flex; flex-direction:column; gap:28px; max-width:900px; margin:0 auto; }
.dshgb-viewhead { display:flex; flex-direction:column; gap:6px; }
.dshgb-viewtitlerow { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.dshgb-viewactions { display:flex; align-items:center; gap:8px; margin-left:auto; }
.dshgb-viewtitle { margin:0; font-size:17px; font-weight:600; letter-spacing:.01em; color:var(--dsw-alias-label-primary); }
.dshgb-viewhint { margin:0; max-width:64ch; }
.dshgb-banner { display:flex; gap:8px; align-items:flex-start; padding:10px 12px; border-radius:10px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-state-warn-primary); }
.dshgb-banner--err { color:var(--dsw-alias-state-error-primary); }
.dshgb-section { display:flex; flex-direction:column; gap:2px; }
.dshgb-sectionhead { display:flex; align-items:center; gap:10px; padding:0 2px 8px; border-bottom:1px solid var(--dsw-alias-border-l1); }
.dshgb-sectiontitle { margin:0; font-size:11px; font-weight:600; letter-spacing:.08em; color:var(--dsw-alias-label-secondary); }
.dshgb-count { font-size:11px; color:var(--dsw-alias-state-idle-primary); font-variant-numeric:tabular-nums; }
.dshgb-sectionactions { display:flex; align-items:center; gap:2px; margin-left:auto; }
.dshgb-rows { display:flex; flex-direction:column; }
.dshgb-item { display:flex; align-items:center; gap:12px; padding:9px 8px; border-radius:8px; transition:background-color .12s ease; }
.dshgb-item:hover, .dshgb-item:focus-within { background:var(--dsw-alias-bg-layer-1); }
.dshgb-index { flex:0 0 1.4em; text-align:right; font-size:11px; color:var(--dsw-alias-state-idle-primary); font-variant-numeric:tabular-nums; }
.dshgb-main { display:flex; flex-direction:column; gap:1px; flex:1 1 auto; min-width:0; }
.dshgb-name { color:var(--dsw-alias-label-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dshgb-meta { font-size:11px; color:var(--dsw-alias-label-secondary); font-variant-numeric:tabular-nums; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dshgb-badge { margin-left:6px; color:var(--dsw-alias-state-warn-primary); }
.dshgb-actions { display:flex; align-items:center; gap:0; flex:0 0 auto; }
.dshgb-textbtn { appearance:none; border:0; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; line-height:1.5; padding:4px 9px; border-radius:6px; cursor:pointer; transition:background-color .12s ease, color .12s ease; }
.dshgb-textbtn:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.dshgb-textbtn:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:1px; }
.dshgb-textbtn:disabled { opacity:.4; cursor:default; }
.dshgb-textbtn--accent { color:var(--dsw-alias-brand-primary); }
.dshgb-textbtn--accent:hover:not(:disabled) { color:var(--dsw-alias-brand-primary); background:var(--dsw-alias-bg-layer-2); }
.dshgb-fieldrow { display:flex; align-items:center; gap:8px; padding:10px 8px 0; }
.dshgb-field { flex:1 1 260px; min-width:160px; height:32px; box-sizing:border-box; border:0; border-radius:8px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; padding:0 11px; transition:box-shadow .12s ease, background-color .12s ease; }
.dshgb-field::placeholder { color:var(--dsw-alias-state-idle-primary); }
.dshgb-field:focus { outline:none; background:var(--dsw-alias-bg-layer-2); box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary); }
.dshgb-field:disabled { opacity:.6; }
.dshgb-empty { padding:16px 8px; color:var(--dsw-alias-label-secondary); }
.dshgb-hint { font-size:11px; color:var(--dsw-alias-label-secondary); }
.dshgb-status { font-size:11px; color:var(--dsw-alias-label-secondary); }
.dshgb-status--ok { color:var(--dsw-alias-state-success-primary); }
.dshgb-status--err { color:var(--dsw-alias-state-error-primary); }
.dshgb-box { display:flex; flex-direction:column; gap:8px; margin:6px 8px 10px; padding:12px 14px; border-radius:10px; background:var(--dsw-alias-bg-layer-1); }
.dshgb-boxhead { display:flex; align-items:center; gap:8px; }
.dshgb-boxtitle { color:var(--dsw-alias-label-primary); font-weight:600; }
.dshgb-boxactions { display:flex; align-items:center; gap:2px; margin-left:auto; }
.dshgb-file { display:flex; align-items:center; gap:10px; padding:2px 0; font-size:11.5px; }
.dshgb-filepath { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); font-variant-numeric:tabular-nums; }
.dshgb-filediff { white-space:nowrap; color:var(--dsw-alias-label-secondary); font-variant-numeric:tabular-nums; }
.dshgb-configgrid { display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:12px 18px; padding:6px 8px 0; }
.dshgb-fieldgroup { display:flex; flex-direction:column; gap:4px; min-width:0; }
.dshgb-fieldlabel { font-size:11px; color:var(--dsw-alias-label-secondary); }
.dshgb-row { display:flex; align-items:center; gap:2px; flex-wrap:wrap; }
`

    const UI_MARKER = /⟦dshb:(.+?)⟧/s

    function parseUiPayload(text) {
      const match = UI_MARKER.exec(String(text ?? ''))
      if (!match) return null
      try {
        return JSON.parse(match[1])
      } catch {
        return null
      }
    }

    function formatWhen(value) {
      try {
        if (!value) return ''
        return new Date(value).toLocaleString('zh-CN', {
          hour12: false,
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch {
        return ''
      }
    }

    function createDispatcher(ctx) {
      return (sessionId) => (line) => {
        if (!sessionId) return Promise.reject(new Error(TEXT.noSession))
        const sessions = ctx.get('sessions')
        if (typeof sessions?.using !== 'function') return Promise.reject(new Error('会话服务不可用'))
        return sessions
          .using(sessionId, { source: 'gateway' }, (reference) => reference.binding.session.command(line))
          .then((result) => {
            if (result && result.ok === false) throw new Error(result.error?.message ?? '命令执行失败')
            if (result && result.value && result.value.matched === false) throw new Error('命令未注册')
            return result
          })
      }
    }

    /** Follow this plugin's command results in the session log. */
    function usePluginPayloads(ctx, sessionId) {
      const [payloads, setPayloads] = React.useState({
        versions: [],
        workspaces: [],
        status: null,
        detail: null,
        preview: null,
        config: null,
      })
      React.useEffect(() => {
        const sessions = ctx.get('sessions')
        if (!sessionId || typeof sessions?.retain !== 'function') return undefined
        let reference = null
        let unsubscribe = null
        let cancelled = false
        const consume = (text) => {
          const payload = parseUiPayload(text)
          if (!payload) return
          if (payload.kind === 'versions' && Array.isArray(payload.items)) {
            setPayloads((current) => ({ ...current, versions: payload.items }))
          } else if (payload.kind === 'workspaces' && Array.isArray(payload.items)) {
            setPayloads((current) => ({ ...current, workspaces: payload.items }))
          } else if (payload.kind === 'status') {
            setPayloads((current) => ({ ...current, status: payload }))
          } else if (payload.kind === 'detail') {
            setPayloads((current) => ({ ...current, detail: payload }))
          } else if (payload.kind === 'preview') {
            setPayloads((current) => ({ ...current, preview: payload }))
          } else if (payload.kind === 'config') {
            setPayloads((current) => ({ ...current, config: payload.values }))
          }
        }
        const readWindow = () => {
          try {
            const snapshot = reference?.binding?.eventSource?.getSnapshot?.()
            for (const entry of snapshot?.entries ?? []) {
              if (entry?.event?.type === 'command/done') consume(entry.event.data?.text)
            }
          } catch {
            /* window not ready yet */
          }
        }
        try {
          reference = sessions.retain(sessionId, { source: 'gateway' })
          Promise.resolve(reference?.ready)
            .then(() => {
              if (cancelled || !reference) return
              readWindow()
              unsubscribe = reference.binding.eventSource.subscribe(readWindow)
            })
            .catch(() => {})
        } catch {
          reference = null
        }
        return () => {
          cancelled = true
          try {
            if (typeof unsubscribe === 'function') unsubscribe()
          } catch {
            /* ignore */
          }
          try {
            if (typeof reference?.release === 'function') reference.release()
          } catch {
            /* ignore */
          }
        }
      }, [sessionId])
      return payloads
    }

    function makeView(ctx) {
      const dispatchFor = createDispatcher(ctx)

      return function BackupView(props) {
        const payloads = usePluginPayloads(ctx, props?.sessionId)
        const versions = payloads.versions ?? []
        const workspaces = payloads.workspaces ?? []
        const statusInfo = payloads.status ?? null
        const detail = payloads.detail ?? null
        const preview = payloads.preview ?? null
        const config = payloads.config ?? null

        const [versionBusy, setVersionBusy] = React.useState(false)
        const [workspaceBusy, setWorkspaceBusy] = React.useState(false)
        const [tokenBusy, setTokenBusy] = React.useState(false)
        const [rollbackRef, setRollbackRef] = React.useState('')
        const [workspacePathDraft, setWorkspacePathDraft] = React.useState('')
        const [configDraft, setConfigDraft] = React.useState({ repo: '', branch: '', pollSeconds: '' })
        const [tokenDraft, setTokenDraft] = React.useState('')
        const [tokenOpen, setTokenOpen] = React.useState(false)
        const [tokenTouched, setTokenTouched] = React.useState(false)
        const [status, setStatus] = React.useState(null)
        const [detailHidden, setDetailHidden] = React.useState(false)
        const [previewHidden, setPreviewHidden] = React.useState(false)

        const dispatch = dispatchFor(props?.sessionId)
        const hasSession = Boolean(props?.sessionId)

        const run = (label, line, options = {}) =>
          dispatch(line)
            .then((result) => {
              if (options.okText) setStatus({ kind: 'ok', text: options.okText })
              return result
            })
            .catch((error) => {
              setStatus({ kind: 'err', text: `${label} · ${TEXT.failed}: ${error?.message ?? String(error)}` })
              return null
            })
            .finally(() => {
              if (options.done) options.done()
            })

        const refreshVersions = () => {
          if (versionBusy || !hasSession) return
          setVersionBusy(true)
          run(TEXT.refresh, '/dsh-backup history 8', { busy: versionBusy, done: () => setVersionBusy(false) })
        }

        const refreshWorkspaces = () => {
          if (workspaceBusy || !hasSession) return
          setWorkspaceBusy(true)
          run(TEXT.refresh, '/dsh-backup workspaces', { busy: workspaceBusy, done: () => setWorkspaceBusy(false) })
        }

        const refreshStatus = () => {
          if (!hasSession) return
          run('状态', '/dsh-backup status')
        }

        const loadConfig = () => {
          if (!hasSession) return
          run(TEXT.config, '/dsh-backup config')
        }

        const openDetail = (sha) => {
          if (!hasSession) return
          setDetailHidden(false)
          run(TEXT.detail, `/dsh-backup detail ${sha}`)
        }

        const openPreview = (sha) => {
          if (!hasSession) return
          setPreviewHidden(false)
          run(TEXT.preview, `/dsh-backup preview ${sha}`)
        }

        const rollbackTo = (sha, paths) => {
          if (!hasSession) return
          setPreviewHidden(true)
          const only = Array.isArray(paths) && paths.length > 0 ? ` --only ${paths.join(' ')}` : ''
          run(TEXT.rollback, `/dsh-backup rollback ${sha}${only}`, {
            okText: `${TEXT.rollback} · ${TEXT.statusOk}`,
            done: () => {
              refreshVersions()
              refreshStatus()
            },
          })
        }

        const undoRollback = () => {
          if (!hasSession) return
          run(TEXT.undo, '/dsh-backup undo', {
            okText: TEXT.undo,
            done: () => {
              refreshVersions()
              refreshStatus()
            },
          })
        }

        const switchWorkspace = (entry) => {
          if (workspaceBusy || !hasSession) return
          setWorkspaceBusy(true)
          const operation = entry.disabled ? 'enable' : 'disable'
          run(TEXT.failed, `/dsh-backup workspace ${operation} ${entry.root}`, {
            busy: workspaceBusy,
            done: () => {
              setWorkspaceBusy(false)
              refreshWorkspaces()
            },
          })
        }

        const addWorkspace = () => {
          const target = workspacePathDraft.trim()
          if (target === '' || workspaceBusy || !hasSession) return
          setWorkspaceBusy(true)
          dispatch(`/dsh-backup workspace add ${target}`)
            .then(() => {
              setWorkspacePathDraft('')
              setStatus({ kind: 'ok', text: `${TEXT.add} ${target} · ${TEXT.statusOk}` })
              return dispatch('/dsh-backup workspaces').catch(() => {})
            })
            .catch((error) => setStatus({ kind: 'err', text: `${TEXT.failed}: ${error?.message ?? String(error)}` }))
            .finally(() => setWorkspaceBusy(false))
        }

        const saveToken = () => {
          const value = tokenDraft.trim()
          if (value === '') {
            setStatus({ kind: 'err', text: TEXT.tokenEmpty })
            return
          }
          setTokenBusy(true)
          setStatus(null)
          dispatch(`/dsh-backup token ${value}`)
            .then(() => {
              setTokenDraft('')
              setTokenTouched(true)
              setTokenOpen(false)
              setStatus({ kind: 'ok', text: TEXT.tokenSaved })
              return dispatch('/dsh-backup status').catch(() => {})
            })
            .catch((error) => setStatus({ kind: 'err', text: `${TEXT.save} · ${TEXT.failed}: ${error?.message ?? String(error)}` }))
            .finally(() => setTokenBusy(false))
        }

        const saveConfig = () => {
          if (!hasSession) return
          const current = config ?? {}
          const writes = []
          if (configDraft.repo !== '' && configDraft.repo !== String(current.repo ?? '')) writes.push(['repo', configDraft.repo])
          if (configDraft.branch !== '' && configDraft.branch !== String(current.branch ?? '')) writes.push(['branch', configDraft.branch])
          if (configDraft.pollSeconds !== '' && String(configDraft.pollSeconds) !== String(current.pollSeconds ?? '')) {
            writes.push(['pollSeconds', configDraft.pollSeconds])
          }
          if (writes.length === 0) {
            setStatus({ kind: 'ok', text: TEXT.nothingToSave })
            return
          }
          let chain = Promise.resolve()
          for (const [key, value] of writes) {
            chain = chain.then(() => dispatch(`/dsh-backup config set ${key} ${value}`))
          }
          chain
            .then(() => {
              setStatus({ kind: 'ok', text: TEXT.configSaved })
              setConfigDraft({ repo: '', branch: '', pollSeconds: '' })
            })
            .catch((error) => setStatus({ kind: 'err', text: `${TEXT.save} · ${TEXT.failed}: ${error?.message ?? String(error)}` }))
        }

        const setLayout = (layout) => {
          if (!hasSession) return
          dispatch(`/dsh-backup config set layout ${layout}`)
            .then(() => setStatus({ kind: 'ok', text: TEXT.configSaved }))
            .catch((error) => setStatus({ kind: 'err', text: `${TEXT.failed}: ${error?.message ?? String(error)}` }))
        }

        // Open the token form automatically while no token is configured.
        React.useEffect(() => {
          if (tokenTouched || tokenOpen) return
          if (statusInfo?.token && statusInfo.token.present === false) setTokenOpen(true)
        }, [statusInfo?.token?.present, tokenTouched, tokenOpen])

        React.useEffect(() => {
          if (!props?.sessionId) return
          refreshVersions()
          refreshWorkspaces()
          refreshStatus()
          loadConfig()
        }, [props?.sessionId])

        const textButton = (key, label, onClick, options = {}) =>
          h(
            'button',
            {
              key,
              type: 'button',
              className: `dshgb-textbtn${options.accent ? ' dshgb-textbtn--accent' : ''}`,
              disabled: options.disabled === true,
              title: options.title ?? label,
              onClick,
            },
            label,
          )

        const banner = (() => {
          const messages = []
          let level = 'warn'
          if (statusInfo) {
            if (!statusInfo.token?.present) {
              messages.push(TEXT.bannerTokenMissing)
              level = 'err'
            } else if (statusInfo.token?.daysLeft !== null && statusInfo.token?.daysLeft !== undefined && statusInfo.token.daysLeft <= 14) {
              messages.push(TEXT.bannerExpiring(statusInfo.token.daysLeft))
              if (statusInfo.token.daysLeft < 0) level = 'err'
            }
            if (Array.isArray(statusInfo.failingRoots) && statusInfo.failingRoots.length > 0) {
              messages.push(TEXT.bannerFailing(statusInfo.failingRoots))
              level = 'err'
            }
          }
          if (messages.length === 0) return null
          return h(
            'div',
            { key: 'banner', className: `dshgb-banner${level === 'err' ? ' dshgb-banner--err' : ''}` },
            messages.join(' '),
          )
        })()

        const versionRows =
          versions.length === 0
            ? [h('div', { key: 'empty', className: 'dshgb-empty' }, versionBusy ? TEXT.loading : TEXT.noVersions)]
            : versions.map((item) =>
                h('div', { key: item.sha ?? item.n, className: 'dshgb-item' }, [
                  h('span', { key: 'index', className: 'dshgb-index' }, `${item.n ?? ''}`),
                  h('div', { key: 'main', className: 'dshgb-main' }, [
                    h('span', { key: 'name', className: 'dshgb-name', title: item.message ?? '' }, item.message || TEXT.noMessage),
                    h(
                      'span',
                      { key: 'meta', className: 'dshgb-meta' },
                      [item.short, formatWhen(item.date)].filter(Boolean).join(' · '),
                    ),
                  ]),
                  h('div', { key: 'actions', className: 'dshgb-actions' }, [
                    textButton('detail', TEXT.detail, () => openDetail(item.sha), { disabled: versionBusy }),
                    textButton('preview', TEXT.preview, () => openPreview(item.sha), { disabled: versionBusy }),
                    textButton('rollback', TEXT.rollback, () => rollbackTo(item.sha), { accent: true, disabled: versionBusy }),
                  ]),
                ]),
              )

        const workspaceRows =
          workspaces.length === 0
            ? [h('div', { key: 'empty', className: 'dshgb-empty' }, workspaceBusy ? TEXT.loading : TEXT.noWorkspaces)]
            : workspaces.map((entry) =>
                h('div', { key: entry.root, className: 'dshgb-item' }, [
                  h('div', { key: 'main', className: 'dshgb-main' }, [
                    h('span', { key: 'name', className: 'dshgb-name', title: entry.root }, [
                      entry.name,
                      entry.disabled ? h('span', { key: 'badge', className: 'dshgb-badge' }, TEXT.disabledBadge) : null,
                    ]),
                    h('span', { key: 'meta', className: 'dshgb-meta' }, `${entry.files ?? 0} ${TEXT.files}`),
                  ]),
                  h('div', { key: 'actions', className: 'dshgb-actions' }, [
                    textButton('toggle', entry.disabled ? TEXT.enable : TEXT.disable, () => switchWorkspace(entry), {
                      accent: !entry.disabled,
                      disabled: workspaceBusy,
                    }),
                  ]),
                ]),
              )

        const detailBox =
          detail && Array.isArray(detail.files) && !detailHidden
            ? h('div', { key: 'detail', className: 'dshgb-box' }, [
                h('div', { key: 'head', className: 'dshgb-boxhead' }, [
                  h('span', { key: 'title', className: 'dshgb-boxtitle' }, `${TEXT.detailTitle} · ${detail.short ?? ''}`),
                  h('span', { key: 'meta', className: 'dshgb-meta' }, `${detail.files.length} ${TEXT.files}`),
                  h('div', { key: 'actions', className: 'dshgb-boxactions' }, [
                    textButton('close', TEXT.close, () => setDetailHidden(true)),
                  ]),
                ]),
                detail.files.length === 0
                  ? h('div', { key: 'empty', className: 'dshgb-empty' }, TEXT.noFiles)
                  : h(
                      'div',
                      { key: 'files' },
                      detail.files.slice(0, 40).map((file) =>
                        h('div', { key: file.path, className: 'dshgb-file' }, [
                          h('span', { key: 'path', className: 'dshgb-filepath', title: file.path }, file.path),
                          h('span', { key: 'diff', className: 'dshgb-filediff' }, `+${file.additions} −${file.deletions}`),
                          textButton('only', TEXT.onlyThis, () => rollbackTo(detail.sha, [file.path]), {
                            accent: true,
                            disabled: versionBusy,
                          }),
                        ]),
                      ),
                    ),
              ])
            : null

        const previewBox = preview && !previewHidden
          ? h('div', { key: 'preview', className: 'dshgb-box' }, [
              h('div', { key: 'head', className: 'dshgb-boxhead' }, [
                h('span', { key: 'title', className: 'dshgb-boxtitle' }, `${TEXT.previewTitle} · ${preview.short ?? ''}`),
                h(
                  'span',
                  { key: 'meta', className: 'dshgb-meta' },
                  `写入 ${preview.write?.length ?? 0} · 删除 ${preview.remove?.length ?? 0} · 不变 ${preview.unchanged ?? 0}`,
                ),
                h('div', { key: 'actions', className: 'dshgb-boxactions' }, [
                  textButton('confirm', TEXT.confirmAll, () => rollbackTo(preview.sha), { accent: true, disabled: versionBusy }),
                  textButton('cancel', TEXT.cancel, () => setPreviewHidden(true)),
                ]),
              ]),
              ...(preview.write ?? []).slice(0, 20).map((path) =>
                h('div', { key: `w-${path}`, className: 'dshgb-file' }, [
                  h('span', { key: 'path', className: 'dshgb-filepath', title: path }, path),
                  textButton('only', TEXT.onlyThis, () => rollbackTo(preview.sha, [path]), { accent: true, disabled: versionBusy }),
                ]),
              ),
              ...(preview.remove ?? []).slice(0, 20).map((path) =>
                h('div', { key: `r-${path}`, className: 'dshgb-file' }, [
                  h('span', { key: 'path', className: 'dshgb-filepath', title: path }, path),
                  h('span', { key: 'diff', className: 'dshgb-filediff' }, '将删除'),
                ]),
              ),
              !preview.write?.length && !preview.remove?.length
                ? h('div', { key: 'empty', className: 'dshgb-empty' }, '与当前内容一致，无需回滚。')
                : null,
            ])
          : null

        const configValues = config ?? {}
        const tokenState = statusInfo?.token
        const tokenLabel = tokenState?.present
          ? TEXT.tokenConfigured(tokenState.daysLeft)
          : tokenState === null || tokenState === undefined
            ? ''
            : TEXT.tokenMissing

        const tokenPanel = tokenOpen
          ? h('div', { key: 'token', className: 'dshgb-box', role: 'group', 'aria-label': TEXT.tokenButton }, [
              h('div', { key: 'head', className: 'dshgb-boxhead' }, [
                h('span', { key: 'title', className: 'dshgb-boxtitle' }, TEXT.tokenLabel),
                tokenLabel ? h('span', { key: 'state', className: 'dshgb-meta' }, tokenLabel) : null,
                h('div', { key: 'actions', className: 'dshgb-boxactions' }, [
                  textButton('close', TEXT.close, () => {
                    setTokenTouched(true)
                    setTokenOpen(false)
                  }),
                ]),
              ]),
              h('div', { key: 'row', className: 'dshgb-row' }, [
                h('input', {
                  key: 'input',
                  className: 'dshgb-field',
                  type: 'password',
                  value: tokenDraft,
                  placeholder: TEXT.tokenPlaceholder,
                  autoComplete: 'off',
                  autoCorrect: 'off',
                  spellCheck: false,
                  autoFocus: true,
                  'aria-label': TEXT.tokenLabel,
                  disabled: tokenBusy,
                  onChange: (event) => setTokenDraft(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      saveToken()
                    }
                  },
                }),
                textButton('save-token', tokenBusy ? '…' : '保存 token', saveToken, { accent: true, disabled: tokenBusy }),
              ]),
              h('span', { key: 'hint', className: 'dshgb-hint' }, TEXT.tokenHint),
            ])
          : null

        const configSection = h('section', { key: 'config', className: 'dshgb-section', 'aria-label': TEXT.config }, [
          h('div', { key: 'head', className: 'dshgb-sectionhead' }, [
            h('h3', { key: 'title', className: 'dshgb-sectiontitle' }, TEXT.config),
            h('div', { key: 'actions', className: 'dshgb-sectionactions' }, [
              textButton('save', TEXT.save, saveConfig),
              textButton('reload', TEXT.refresh, loadConfig),
            ]),
          ]),
          h('div', { key: 'grid', className: 'dshgb-configgrid' }, [
            h('label', { key: 'repo', className: 'dshgb-fieldgroup' }, [
              h('span', { key: 'label', className: 'dshgb-fieldlabel' }, TEXT.repoLabel),
              h('input', {
                key: 'input',
                className: 'dshgb-field',
                type: 'text',
                value: configDraft.repo,
                placeholder: String(configValues.repo ?? '') || '(空)',
                spellCheck: false,
                onChange: (event) => setConfigDraft((current) => ({ ...current, repo: event.target.value })),
              }),
            ]),
            h('label', { key: 'branch', className: 'dshgb-fieldgroup' }, [
              h('span', { key: 'label', className: 'dshgb-fieldlabel' }, TEXT.branchLabel),
              h('input', {
                key: 'input',
                className: 'dshgb-field',
                type: 'text',
                value: configDraft.branch,
                placeholder: String(configValues.branch ?? 'main'),
                spellCheck: false,
                onChange: (event) => setConfigDraft((current) => ({ ...current, branch: event.target.value })),
              }),
            ]),
            h('label', { key: 'poll', className: 'dshgb-fieldgroup' }, [
              h('span', { key: 'label', className: 'dshgb-fieldlabel' }, TEXT.pollLabel),
              h('input', {
                key: 'input',
                className: 'dshgb-field',
                type: 'text',
                value: configDraft.pollSeconds,
                placeholder: String(configValues.pollSeconds ?? '15'),
                spellCheck: false,
                onChange: (event) => setConfigDraft((current) => ({ ...current, pollSeconds: event.target.value })),
              }),
            ]),
            h('div', { key: 'layout', className: 'dshgb-fieldgroup' }, [
              h('span', { key: 'label', className: 'dshgb-fieldlabel' }, TEXT.layoutLabel),
              h('div', { key: 'row', className: 'dshgb-row' }, [
                textButton('ws', 'workspaces/', () => setLayout('workspaces'), {
                  accent: configValues.layout === 'workspaces',
                }),
                textButton('root', '仓库根', () => setLayout('root'), { accent: configValues.layout === 'root' }),
              ]),
            ]),
          ]),
          h(
            'span',
            { key: 'auto', className: 'dshgb-hint' },
            `${TEXT.autoLabel}：开（默认，每 ${configValues.pollSeconds ?? 15} 秒检查一次；需要临时关闭可用 /dsh-backup auto off）`,
          ),
          h('span', { key: 'hint', className: 'dshgb-hint' }, TEXT.configHint),
        ])

        const versionFooter = h('div', { key: 'foot', className: 'dshgb-fieldrow' }, [
          h('input', {
            key: 'input',
            className: 'dshgb-field',
            type: 'text',
            value: rollbackRef,
            placeholder: TEXT.rollbackRef,
            spellCheck: false,
            'aria-label': TEXT.rollbackRef,
            disabled: versionBusy,
            onChange: (event) => setRollbackRef(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (rollbackRef.trim()) rollbackTo(rollbackRef.trim())
              }
            },
          }),
          textButton('preview', TEXT.preview, () => rollbackRef.trim() && openPreview(rollbackRef.trim()), {
            disabled: versionBusy,
          }),
          textButton('rollback', TEXT.rollback, () => rollbackRef.trim() && rollbackTo(rollbackRef.trim()), {
            accent: true,
            disabled: versionBusy,
          }),
        ])

        const workspaceFooter = h('div', { key: 'foot', className: 'dshgb-fieldrow' }, [
          h('input', {
            key: 'input',
            className: 'dshgb-field',
            type: 'text',
            value: workspacePathDraft,
            placeholder: TEXT.addPath,
            spellCheck: false,
            'aria-label': TEXT.addPath,
            disabled: workspaceBusy,
            onChange: (event) => setWorkspacePathDraft(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addWorkspace()
              }
            },
          }),
          textButton('add', TEXT.add, addWorkspace, { accent: true, disabled: workspaceBusy }),
        ])

        const statusNode = status
          ? h(
              'div',
              {
                key: 'status',
                className: `dshgb-status ${status.kind === 'ok' ? 'dshgb-status--ok' : 'dshgb-status--err'}`,
                title: status.text,
              },
              status.text,
            )
          : null

        const section = (key, title, count, actions, children) =>
          h('section', { key, className: 'dshgb-section', 'aria-label': title }, [
            h('div', { key: 'head', className: 'dshgb-sectionhead' }, [
              h('h3', { key: 'title', className: 'dshgb-sectiontitle' }, title),
              typeof count === 'number' ? h('span', { key: 'count', className: 'dshgb-count' }, `${count}`) : null,
              h('div', { key: 'actions', className: 'dshgb-sectionactions' }, actions),
            ]),
            h('div', { key: 'body', className: 'dshgb-rows' }, children),
          ])

        return h('div', { className: 'dshgb-view', 'aria-label': TEXT.viewTitle }, [
          h('style', { key: 'style' }, STYLES),
          h('div', { key: 'inner', className: 'dshgb-viewinner' }, [
            h('header', { key: 'head', className: 'dshgb-viewhead' }, [
              h('div', { key: 'titlerow', className: 'dshgb-viewtitlerow' }, [
                h('h2', { key: 'title', className: 'dshgb-viewtitle' }, TEXT.viewTitle),
                h('div', { key: 'actions', className: 'dshgb-viewactions' }, [
                  tokenLabel ? h('span', { key: 'state', className: 'dshgb-hint' }, tokenLabel) : null,
                  textButton(
                    'token',
                    tokenOpen ? TEXT.close : TEXT.tokenButton,
                    () => {
                      setTokenTouched(true)
                      setTokenOpen((open) => !open)
                    },
                    { accent: !tokenState?.present || tokenOpen },
                  ),
                ]),
              ]),
              h('p', { key: 'hint', className: 'dshgb-viewhint' }, TEXT.viewHint),
            ]),
            tokenPanel,
            banner,
            section(
              'versions',
              TEXT.versions.toUpperCase(),
              versions.length,
              [
                textButton('undo', TEXT.undo, undoRollback, { disabled: versionBusy }),
                textButton('refresh', versionBusy ? TEXT.loading : TEXT.refresh, refreshVersions, { disabled: versionBusy }),
              ],
              [...versionRows, versionFooter],
            ),
            detailBox,
            previewBox,
            section(
              'workspaces',
              TEXT.workspaces,
              workspaces.length,
              [
                textButton('refresh', workspaceBusy ? TEXT.loading : TEXT.refresh, refreshWorkspaces, {
                  disabled: workspaceBusy,
                }),
              ],
              [...workspaceRows, workspaceFooter],
            ),
            configSection,
            h('div', { key: 'rollback-hint', className: 'dshgb-hint' }, TEXT.rollbackHint),
            statusNode,
          ]),
        ])
      }
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const BackupView = makeView(ctx)
        ctx.slots.inject('conversation.view', () =>
          ctx.slots.register(
            { name: 'conversation.view', id: 'dsh-git-backup', order: 20, label: () => TEXT.viewLabel },
            BackupView,
          ),
        )
      },
    }
  },
})
