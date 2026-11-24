window.__ModuleLoader__.load({
  id: '@local/dsh-git-backup',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NAME = '快照'
    const TEXT = {
      viewLabel: NAME,
      viewTitle: '快照与版本',
      viewSubtitle: 'GitHub 自动备份 · 版本回滚 · 工作区 · 配置',
      tokenButton: '设置 token',
      tokenLabel: 'GitHub token',
      tokenPlaceholder: 'ghp_… 或 github_pat_…',
      tokenHint: '需要 repo 权限，会保存到 %USERPROFILE%\\.dsh\\.env，不写入对话记录',
      tokenSaved: 'token 已保存并验证，自动备份已开始',
      tokenEmpty: '先粘贴 token',
      tokenConfigured: (days) =>
        days === null || days === undefined ? '已配置' : days >= 0 ? `还有 ${days} 天过期` : '已过期',
      tokenMissing: '未配置',
      chipAuto: (poll) => `自动同步 · 每 ${poll}s`,
      chipRepo: (repo) => `仓库 · ${repo}`,
      chipRepoAuto: (name) => `仓库 · 自动建仓（${name}）`,
      chipBranch: (branch) => `分支 · ${branch}`,
      chipLayout: (layout) => (layout === 'root' ? '布局 · 仓库根' : '布局 · workspaces/'),
      versions: '版本回滚',
      workspaces: '工作区',
      config: '配置',
      refresh: '刷新',
      undo: '撤销回滚',
      rollbackRef: '版本号或提交号',
      rollback: '回滚',
      preview: '预览',
      detail: '详情',
      onlyThis: '仅恢复',
      confirmAll: '全部回滚',
      previewTitle: '回滚预览',
      detailTitle: '版本详情',
      close: '关闭',
      cancel: '取消',
      save: '保存',
      saveToken: '保存 token',
      noFiles: '没有文件变更。',
      hintRollback: '回滚会先恢复本地 .dsh（自动备份当前改动），再推一个新提交。',
      noVersions: '还没有历史版本，改动 .dsh 后会自动出现。',
      noWorkspaces: '还没有发现工作区。',
      addPath: '工作区绝对路径',
      add: '添加',
      enable: '启用',
      disable: '停用',
      files: '个文件',
      failed: '失败',
      noSession: '没有活动会话',
      disabledBadge: '已停用',
      noMessage: '(无说明)',
      repoLabel: '仓库',
      repoPlaceholder: 'owner/name（留空自动建）',
      branchLabel: '分支',
      pollLabel: '轮询秒数',
      layoutLabel: '远端布局',
      layoutWorkspaces: 'workspaces/',
      layoutRoot: '仓库根',
      autoNote: (poll) => `自动同步始终默认开启：每 ${poll}s 扫描、静默后自动提交，无需手动操作。`,
      configHint: '保存会写入 profile 配置，插件行会重启一次以应用。',
      configSaved: '配置已保存，插件正在重启…',
      nothingToSave: '没有需要保存的改动。',
      bannerTokenMissing: '还没有配置 GitHub token，自动备份尚未开始。',
      bannerExpiring: (days) =>
        days >= 0 ? `GitHub token 还有 ${days} 天过期，记得续期。` : 'GitHub token 已过期，请重新保存。',
      bannerFailing: (names) => `自动同步失败：${names.join('、')}`,
      sent: '已发送，结果显示在对话里',
      loading: '加载中…',
      identical: '与当前内容一致，无需回滚。',
    }

    const STYLES = `
.dshgb-view { box-sizing:border-box; width:100%; height:100%; overflow:auto; padding:26px 32px 48px; font-size:13px; line-height:1.6; color:var(--dsw-alias-label-secondary); }
.dshgb-inner { display:flex; flex-direction:column; gap:16px; max-width:980px; margin:0 auto; }

/* header */
.dshgb-head { display:flex; flex-direction:column; gap:12px; padding:2px 2px 4px; }
.dshgb-titlerow { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.dshgb-mark { flex:none; width:34px; height:34px; border-radius:10px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); display:flex; align-items:center; justify-content:center; color:var(--dsw-alias-brand-primary); }
.dshgb-titles { display:flex; flex-direction:column; gap:1px; min-width:0; }
.dshgb-title { margin:0; font-size:18px; font-weight:650; letter-spacing:.01em; color:var(--dsw-alias-label-primary); }
.dshgb-subtitle { margin:0; font-size:12px; }
.dshgb-headactions { margin-left:auto; display:flex; align-items:center; gap:8px; }
.dshgb-chips { display:flex; flex-wrap:wrap; gap:6px; }
.dshgb-chip { display:inline-flex; align-items:center; gap:6px; height:24px; padding:0 10px; border-radius:999px; border:1px solid var(--dsw-alias-border-l1); font-size:11px; color:var(--dsw-alias-label-secondary); white-space:nowrap; }
.dshgb-chip--warn { color:var(--dsw-alias-state-warn-primary); }
.dshgb-chip--err { color:var(--dsw-alias-state-error-primary); }
.dshgb-dot { width:6px; height:6px; border-radius:50%; background:var(--dsw-alias-state-success-primary); }
.dshgb-dot--warn { background:var(--dsw-alias-state-warn-primary); }
.dshgb-dot--err { background:var(--dsw-alias-state-error-primary); }
.dshgb-dot--pulse { animation:dshgb-pulse 2.4s ease-in-out infinite; }

/* cards */
.dshgb-card { display:flex; flex-direction:column; gap:10px; padding:14px 16px 12px; border:1px solid var(--dsw-alias-border-l1); border-radius:14px; background:var(--dsw-alias-bg-layer-1); animation:dshgb-rise .2s ease-out both; }
.dshgb-cardhead { display:flex; align-items:center; gap:10px; padding-bottom:10px; border-bottom:1px solid var(--dsw-alias-border-l1); }
.dshgb-cardtitle { display:inline-flex; align-items:center; gap:8px; margin:0; font-size:13px; font-weight:600; color:var(--dsw-alias-label-primary); }
.dshgb-cardtitle svg { color:var(--dsw-alias-label-secondary); }
.dshgb-count { min-width:20px; height:20px; padding:0 6px; border-radius:999px; border:1px solid var(--dsw-alias-border-l1); font-size:11px; line-height:18px; text-align:center; color:var(--dsw-alias-label-secondary); font-variant-numeric:tabular-nums; }
.dshgb-cardactions { display:flex; align-items:center; gap:6px; margin-left:auto; }

/* buttons */
.dshgb-btn { appearance:none; font:inherit; font-size:12px; line-height:1.4; min-height:29px; padding:4px 11px; border-radius:8px; cursor:pointer; white-space:nowrap; transition:background-color .15s ease, border-color .15s ease, color .15s ease, transform .15s ease; }
.dshgb-btn:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
.dshgb-btn:disabled { opacity:.45; cursor:default; }
.dshgb-btn--primary { border:1px solid var(--dsw-alias-brand-primary); background:transparent; color:var(--dsw-alias-brand-primary); }
.dshgb-btn--primary:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-2); transform:translateY(-1px); }
.dshgb-btn--secondary { border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); }
.dshgb-btn--secondary:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-2); transform:translateY(-1px); }
.dshgb-btn--soft { border:1px solid transparent; background:transparent; color:var(--dsw-alias-label-secondary); }
.dshgb-btn--soft:hover:not(:disabled) { border-color:var(--dsw-alias-border-l1); color:var(--dsw-alias-label-primary); transform:translateY(-1px); }

/* version rows */
.dshgb-rows { display:flex; flex-direction:column; }
.dshgb-row { display:grid; grid-template-columns:32px 128px minmax(0,1fr) auto; align-items:center; gap:12px; padding:10px 8px; border-top:1px solid var(--dsw-alias-border-l1); border-radius:10px; transition:background-color .16s ease, transform .16s ease; }
.dshgb-row:first-child { border-top:0; }
.dshgb-row:hover { background:var(--dsw-alias-bg-base); transform:translateX(2px); }
.dshgb-row--latest { box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary); }
.dshgb-idx { text-align:right; font-size:11px; color:var(--dsw-alias-state-idle-primary); font-variant-numeric:tabular-nums; }
.dshgb-metacol { display:flex; flex-direction:column; gap:1px; min-width:0; }
.dshgb-sha { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:11px; color:var(--dsw-alias-label-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dshgb-time { font-size:11px; color:var(--dsw-alias-label-secondary); }
.dshgb-msg { display:flex; align-items:center; gap:8px; min-width:0; }
.dshgb-msgtick { flex:none; width:6px; height:6px; border-radius:50%; background:transparent; }
.dshgb-row--latest .dshgb-msgtick { background:var(--dsw-alias-brand-primary); }
.dshgb-msgtext { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); }
.dshgb-row--latest .dshgb-msgtext { font-weight:600; }
.dshgb-rowactions { display:flex; align-items:center; gap:4px; }
.dshgb-rowactions .dshgb-btn { min-height:27px; padding:2px 9px; }

/* fields */
.dshgb-footrow { display:flex; align-items:center; gap:8px; padding-top:10px; border-top:1px solid var(--dsw-alias-border-l1); }
.dshgb-field { flex:1 1 240px; min-width:150px; height:34px; box-sizing:border-box; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font:inherit; font-size:12.5px; padding:0 11px; transition:border-color .15s ease, box-shadow .15s ease; }
.dshgb-field::placeholder { color:var(--dsw-alias-state-idle-primary); }
.dshgb-field:hover:not(:disabled) { border-color:var(--dsw-alias-brand-primary); }
.dshgb-field:focus { outline:none; border-color:var(--dsw-alias-brand-primary); box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-2); }
.dshgb-field:disabled { opacity:.6; }

/* nested cards */
.dshgb-subcard { display:flex; flex-direction:column; gap:8px; padding:12px 14px; border:1px solid var(--dsw-alias-border-l1); border-radius:12px; background:var(--dsw-alias-bg-base); animation:dshgb-rise .2s ease-out both; }
.dshgb-subhead { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.dshgb-subtitle2 { color:var(--dsw-alias-label-primary); font-weight:600; font-size:12.5px; }
.dshgb-meta { font-size:11px; color:var(--dsw-alias-label-secondary); font-variant-numeric:tabular-nums; }
.dshgb-sublactions { margin-left:auto; display:flex; gap:4px; }
.dshgb-file { display:flex; align-items:center; gap:10px; padding:5px 6px; border-radius:7px; font-size:12px; transition:background-color .15s ease; }
.dshgb-file:hover { background:var(--dsw-alias-bg-layer-1); }
.dshgb-filepath { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); }
.dshgb-filediff { flex:none; font-size:11px; font-variant-numeric:tabular-nums; }
.dshgb-add { color:var(--dsw-alias-state-success-primary); }
.dshgb-del { color:var(--dsw-alias-state-error-primary); }

/* config */
.dshgb-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px 16px; padding-top:2px; }
.dshgb-group { display:flex; flex-direction:column; gap:5px; min-width:0; }
.dshgb-grouplabel { font-size:11px; font-weight:500; color:var(--dsw-alias-label-secondary); }
.dshgb-helper { font-size:11px; color:var(--dsw-alias-label-secondary); min-height:16px; }
.dshgb-seg { display:inline-flex; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; overflow:hidden; width:fit-content; }
.dshgb-segbtn { appearance:none; border:0; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; padding:5px 11px; min-height:32px; cursor:pointer; transition:background-color .15s ease, color .15s ease; }
.dshgb-segbtn:hover { color:var(--dsw-alias-label-primary); }
.dshgb-segbtn--active { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); font-weight:500; }
.dshgb-segbtn:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:-2px; }
.dshgb-info { display:flex; align-items:center; gap:8px; margin-top:2px; padding:9px 11px; border:1px solid var(--dsw-alias-border-l1); border-radius:9px; background:var(--dsw-alias-bg-base); font-size:11.5px; }
.dshgb-cardfoot { font-size:11px; color:var(--dsw-alias-label-secondary); padding-top:2px; }

/* workspace rows */
.dshgb-wsrow { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; padding:9px 8px; border-top:1px solid var(--dsw-alias-border-l1); border-radius:10px; transition:background-color .16s ease, transform .16s ease; }
.dshgb-wsrow:first-child { border-top:0; }
.dshgb-wsrow:hover { background:var(--dsw-alias-bg-base); transform:translateX(2px); }
.dshgb-wsmain { display:flex; flex-direction:column; gap:1px; min-width:0; }
.dshgb-wsname { display:flex; align-items:center; gap:8px; color:var(--dsw-alias-label-primary); font-size:13px; }
.dshgb-badge { height:18px; padding:0 7px; border-radius:999px; border:1px solid var(--dsw-alias-border-l1); font-size:10.5px; line-height:16px; color:var(--dsw-alias-state-warn-primary); }
.dshgb-wspath { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:11px; color:var(--dsw-alias-label-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* misc */
.dshgb-hint { font-size:11px; color:var(--dsw-alias-label-secondary); }
.dshgb-status { font-size:11px; animation:dshgb-rise .2s ease-out both; }
.dshgb-status--ok { color:var(--dsw-alias-state-success-primary); }
.dshgb-status--err { color:var(--dsw-alias-state-error-primary); }
.dshgb-banner { display:flex; gap:10px; align-items:flex-start; padding:11px 13px; border:1px solid var(--dsw-alias-border-l1); border-radius:12px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-state-warn-primary); font-size:12px; animation:dshgb-rise .2s ease-out both; }
.dshgb-banner--err { color:var(--dsw-alias-state-error-primary); }
.dshgb-empty { padding:14px 8px; font-size:12px; color:var(--dsw-alias-label-secondary); }
.dshgb-skeleton { height:11px; border-radius:6px; background:linear-gradient(90deg, var(--dsw-alias-bg-layer-2) 25%, var(--dsw-alias-bg-layer-1) 37%, var(--dsw-alias-bg-layer-2) 63%); background-size:200% 100%; animation:dshgb-shimmer 1.3s linear infinite; }
.dshgb-skeletonrow { display:grid; grid-template-columns:32px 128px minmax(0,1fr); gap:12px; align-items:center; padding:12px 8px; border-top:1px solid var(--dsw-alias-border-l1); }
.dshgb-skeletonrow:first-child { border-top:0; }

@keyframes dshgb-rise { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
@keyframes dshgb-shimmer { from { background-position:200% 0; } to { background-position:-200% 0; } }
@keyframes dshgb-pulse { 0%,100% { opacity:1; } 50% { opacity:.35; } }
@media (prefers-reduced-motion: reduce) {
  .dshgb-card, .dshgb-subcard, .dshgb-banner, .dshgb-status { animation:none !important; }
  .dshgb-skeleton { animation:none !important; }
  .dshgb-row, .dshgb-wsrow, .dshgb-btn, .dshgb-field, .dshgb-file, .dshgb-segbtn { transition:none !important; }
  .dshgb-row:hover, .dshgb-wsrow:hover, .dshgb-btn:hover:not(:disabled) { transform:none !important; }
  .dshgb-dot--pulse { animation:none !important; }
}
`

    function icon(kind) {
      const common = { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true }
      if (kind === 'cloud') {
        return h('svg', common, [
          h('path', { key: 'a', d: 'M5.2 11.8h5.9a2.5 2.5 0 0 0 .3-4.98 3.4 3.4 0 0 0-6.52-.62A2.35 2.35 0 0 0 5.2 11.8Z', stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round' }),
          h('path', { key: 'b', d: 'M8 12.2V8.6M8 8.6 6.7 9.9M8 8.6l1.3 1.3', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        ])
      }
      if (kind === 'history') {
        return h('svg', common, [
          h('path', { key: 'a', d: 'M2.6 8a5.4 5.4 0 1 0 1.7-3.9', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
          h('path', { key: 'b', d: 'M2.2 3.2v2.9h2.9', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' }),
          h('path', { key: 'c', d: 'M8 5.6V8l1.9 1.4', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        ])
      }
      if (kind === 'folder') {
        return h('svg', common, [
          h('path', { key: 'a', d: 'M2.4 4.6c0-.6.5-1.1 1.1-1.1h2.6c.3 0 .6.1.8.4l.6.6c.2.2.5.4.8.4h3.3c.6 0 1.1.5 1.1 1.1v6.2c0 .6-.5 1.1-1.1 1.1H3.5c-.6 0-1.1-.5-1.1-1.1Z', stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round' }),
        ])
      }
      return h('svg', common, [
        h('path', { key: 'a', d: 'M2.2 4.6h5.1M11.2 4.6h2.6M2.2 11.4h2.4M7.2 11.4h6.6', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
        h('circle', { key: 'b', cx: 9.4, cy: 4.6, r: 1.5, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('circle', { key: 'c', cx: 5.5, cy: 11.4, r: 1.5, stroke: 'currentColor', strokeWidth: 1.3 }),
      ])
    }

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
        const date = new Date(value)
        const diff = Date.now() - date.getTime()
        if (diff >= 0 && diff < 60_000) return '刚刚'
        if (diff >= 0 && diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
        if (diff >= 0 && diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
        return date.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
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

        const [versionsLoaded, setVersionsLoaded] = React.useState(false)
        const [workspacesLoaded, setWorkspacesLoaded] = React.useState(false)
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
          if (!hasSession) return
          setVersionBusy(true)
          run(TEXT.refresh, '/dsh-backup history 8', {
            done: () => {
              setVersionBusy(false)
              setVersionsLoaded(true)
            },
          })
        }

        const refreshWorkspaces = () => {
          if (!hasSession) return
          setWorkspaceBusy(true)
          run(TEXT.refresh, '/dsh-backup workspaces', {
            done: () => {
              setWorkspaceBusy(false)
              setWorkspacesLoaded(true)
            },
          })
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
            okText: `${TEXT.rollback} · ${TEXT.sent}`,
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
              setStatus({ kind: 'ok', text: `${TEXT.add} ${target} · ${TEXT.sent}` })
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

        const btn = (key, label, onClick, options = {}) =>
          h(
            'button',
            {
              key,
              type: 'button',
              className: `dshgb-btn dshgb-btn--${options.variant ?? 'soft'}`,
              disabled: options.disabled === true,
              title: options.title ?? label,
              'aria-label': options.ariaLabel ?? options.title ?? label,
              onClick,
            },
            label,
          )

        const configValues = config ?? {}
        const poll = configValues.pollSeconds ?? 15
        const tokenState = statusInfo?.token
        const tokenLabel = tokenState?.present
          ? TEXT.tokenConfigured(tokenState.daysLeft)
          : tokenState === null || tokenState === undefined
            ? ''
            : TEXT.tokenMissing
        const repoChip = configValues.repo
          ? TEXT.chipRepo(configValues.repo)
          : TEXT.chipRepoAuto(configValues.repoName ?? 'dsh-backup')
        const failing = statusInfo?.failingRoots ?? []
        const bannerMessages = []
        let bannerLevel = 'warn'
        if (statusInfo) {
          if (!tokenState?.present) {
            bannerMessages.push(TEXT.bannerTokenMissing)
            bannerLevel = 'err'
          } else if (tokenState?.daysLeft !== null && tokenState?.daysLeft !== undefined && tokenState.daysLeft <= 14) {
            bannerMessages.push(TEXT.bannerExpiring(tokenState.daysLeft))
            if (tokenState.daysLeft < 0) bannerLevel = 'err'
          }
          if (failing.length > 0) {
            bannerMessages.push(TEXT.bannerFailing(failing))
            bannerLevel = 'err'
          }
        }

        const chip = (key, text, tone) =>
          h(
            'span',
            { key, className: `dshgb-chip${tone === 'warn' ? ' dshgb-chip--warn' : tone === 'err' ? ' dshgb-chip--err' : ''}` },
            [h('span', { key: 'dot', className: `dshgb-dot${tone === 'warn' ? ' dshgb-dot--warn' : tone === 'err' ? ' dshgb-dot--err' : ''}` }), text],
          )

        const tokenPanel = tokenOpen
          ? h('div', { key: 'token', className: 'dshgb-subcard', role: 'group', 'aria-label': TEXT.tokenButton }, [
              h('div', { key: 'head', className: 'dshgb-subhead' }, [
                h('span', { key: 'title', className: 'dshgb-subtitle2' }, TEXT.tokenLabel),
                tokenLabel ? h('span', { key: 'state', className: 'dshgb-meta' }, tokenLabel) : null,
                h('div', { key: 'actions', className: 'dshgb-sublactions' }, [
                  btn('close', TEXT.close, () => {
                    setTokenTouched(true)
                    setTokenOpen(false)
                  }),
                ]),
              ]),
              h('div', { key: 'row', className: 'dshgb-row-inline', style: { display: 'flex', gap: '8px' } }, [
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
                btn('save-token', tokenBusy ? '…' : TEXT.saveToken, saveToken, { variant: 'primary', disabled: tokenBusy }),
              ]),
              h('span', { key: 'hint', className: 'dshgb-hint' }, TEXT.tokenHint),
            ])
          : null

        const skeletonRows = (count) =>
          Array.from({ length: count }, (_, index) =>
            h('div', { key: `skeleton-${index}`, className: 'dshgb-skeletonrow' }, [
              h('div', { key: 'a', className: 'dshgb-skeleton', style: { width: '18px' } }),
              h('div', { key: 'b', className: 'dshgb-skeleton' }),
              h('div', { key: 'c', className: 'dshgb-skeleton', style: { maxWidth: '70%' } }),
            ]),
          )

        const versionRows = !versionsLoaded && versions.length === 0
          ? skeletonRows(3)
          : versions.length === 0
            ? [h('div', { key: 'empty', className: 'dshgb-empty' }, TEXT.noVersions)]
            : versions.map((item, index) =>
                h(
                  'div',
                  {
                    key: item.sha ?? item.n,
                    className: `dshgb-row${index === 0 ? ' dshgb-row--latest' : ''}`,
                  },
                  [
                    h('span', { key: 'idx', className: 'dshgb-idx' }, `${item.n ?? index + 1}`),
                    h('div', { key: 'meta', className: 'dshgb-metacol' }, [
                      h('span', { key: 'sha', className: 'dshgb-sha', title: item.sha ?? '' }, item.short ?? ''),
                      h('span', { key: 'time', className: 'dshgb-time' }, formatWhen(item.date)),
                    ]),
                    h(
                      'div',
                      { key: 'msg', className: 'dshgb-msg' },
                      [
                        h('span', { key: 'tick', className: 'dshgb-msgtick' }),
                        h('span', { key: 'text', className: 'dshgb-msgtext', title: item.message ?? '' }, item.message || TEXT.noMessage),
                      ],
                    ),
                    h('div', { key: 'actions', className: 'dshgb-rowactions' }, [
                      btn('detail', TEXT.detail, () => openDetail(item.sha), { disabled: versionBusy }),
                      btn('preview', TEXT.preview, () => openPreview(item.sha), { disabled: versionBusy }),
                      btn('rollback', TEXT.rollback, () => rollbackTo(item.sha), { variant: 'primary', disabled: versionBusy }),
                    ]),
                  ],
                ),
              )

        const workspaceRows = !workspacesLoaded && workspaces.length === 0
          ? skeletonRows(2)
          : workspaces.length === 0
            ? [h('div', { key: 'empty', className: 'dshgb-empty' }, TEXT.noWorkspaces)]
            : workspaces.map((entry) =>
                h('div', { key: entry.root, className: 'dshgb-wsrow' }, [
                  h('div', { key: 'main', className: 'dshgb-wsmain' }, [
                    h('div', { key: 'name', className: 'dshgb-wsname' }, [
                      entry.name,
                      entry.disabled ? h('span', { key: 'badge', className: 'dshgb-badge' }, TEXT.disabledBadge) : null,
                      h('span', { key: 'files', className: 'dshgb-meta' }, `${entry.files ?? 0} ${TEXT.files}`),
                    ]),
                    h('div', { key: 'path', className: 'dshgb-wspath', title: entry.root }, entry.root),
                  ]),
                  h('div', { key: 'actions', className: 'dshgb-rowactions' }, [
                    btn('toggle', entry.disabled ? TEXT.enable : TEXT.disable, () => switchWorkspace(entry), {
                      variant: entry.disabled ? 'secondary' : 'soft',
                      disabled: workspaceBusy,
                    }),
                  ]),
                ]),
              )

        const detailBox = detail && Array.isArray(detail.files) && !detailHidden
          ? h('div', { key: 'detail', className: 'dshgb-subcard' }, [
              h('div', { key: 'head', className: 'dshgb-subhead' }, [
                h('span', { key: 'title', className: 'dshgb-subtitle2' }, `${TEXT.detailTitle} · ${detail.short ?? ''}`),
                h('span', { key: 'meta', className: 'dshgb-meta' }, `${detail.files.length} ${TEXT.files}`),
                h('div', { key: 'actions', className: 'dshgb-sublactions' }, [btn('close', TEXT.close, () => setDetailHidden(true))]),
              ]),
              detail.files.length === 0
                ? h('div', { key: 'empty', className: 'dshgb-hint' }, TEXT.noFiles)
                : h('div', { key: 'files' }, detail.files.slice(0, 40).map((file) =>
                    h('div', { key: file.path, className: 'dshgb-file' }, [
                      h('span', { key: 'path', className: 'dshgb-filepath', title: file.path }, file.path),
                      h('span', { key: 'diff', className: 'dshgb-filediff' }, [
                        h('span', { key: 'add', className: 'dshgb-add' }, `+${file.additions}`),
                        ' ',
                        h('span', { key: 'del', className: 'dshgb-del' }, `−${file.deletions}`),
                      ]),
                      btn('only', TEXT.onlyThis, () => rollbackTo(detail.sha, [file.path]), { variant: 'primary', disabled: versionBusy }),
                    ]),
                  )),
            ])
          : null

        const previewBox = preview && !previewHidden
          ? h('div', { key: 'preview', className: 'dshgb-subcard' }, [
              h('div', { key: 'head', className: 'dshgb-subhead' }, [
                h('span', { key: 'title', className: 'dshgb-subtitle2' }, `${TEXT.previewTitle} · ${preview.short ?? ''}`),
                h(
                  'span',
                  { key: 'meta', className: 'dshgb-meta' },
                  `写入 ${preview.write?.length ?? 0} · 删除 ${preview.remove?.length ?? 0} · 不变 ${preview.unchanged ?? 0}`,
                ),
                h('div', { key: 'actions', className: 'dshgb-sublactions' }, [
                  btn('confirm', TEXT.confirmAll, () => rollbackTo(preview.sha), { variant: 'primary', disabled: versionBusy }),
                  btn('cancel', TEXT.cancel, () => setPreviewHidden(true)),
                ]),
              ]),
              ...(preview.write ?? []).slice(0, 20).map((path) =>
                h('div', { key: `w-${path}`, className: 'dshgb-file' }, [
                  h('span', { key: 'path', className: 'dshgb-filepath', title: path }, path),
                  h('span', { key: 'diff', className: 'dshgb-filediff dshgb-add' }, '写入'),
                  btn('only', TEXT.onlyThis, () => rollbackTo(preview.sha, [path]), { variant: 'primary', disabled: versionBusy }),
                ]),
              ),
              ...(preview.remove ?? []).slice(0, 20).map((path) =>
                h('div', { key: `r-${path}`, className: 'dshgb-file' }, [
                  h('span', { key: 'path', className: 'dshgb-filepath', title: path }, path),
                  h('span', { key: 'diff', className: 'dshgb-filediff dshgb-del' }, '删除'),
                ]),
              ),
              !preview.write?.length && !preview.remove?.length
                ? h('div', { key: 'empty', className: 'dshgb-hint' }, TEXT.identical)
                : null,
            ])
          : null

        const versionFooter = h('div', { key: 'foot', className: 'dshgb-footrow' }, [
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
          btn('preview', TEXT.preview, () => rollbackRef.trim() && openPreview(rollbackRef.trim()), { disabled: versionBusy }),
          btn('rollback', TEXT.rollback, () => rollbackRef.trim() && rollbackTo(rollbackRef.trim()), {
            variant: 'primary',
            disabled: versionBusy,
          }),
        ])

        const workspaceFooter = h('div', { key: 'foot', className: 'dshgb-footrow' }, [
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
          btn('add', TEXT.add, addWorkspace, { variant: 'primary', disabled: workspaceBusy }),
        ])

        const configCard = h('section', { key: 'config', className: 'dshgb-card', 'aria-label': TEXT.config }, [
          h('div', { key: 'head', className: 'dshgb-cardhead' }, [
            h('h3', { key: 'title', className: 'dshgb-cardtitle' }, [icon('sliders'), TEXT.config]),
            h('div', { key: 'actions', className: 'dshgb-cardactions' }, [
              btn('save', TEXT.save, saveConfig, { variant: 'secondary' }),
              btn('reload', TEXT.refresh, loadConfig),
            ]),
          ]),
          h('div', { key: 'grid', className: 'dshgb-grid' }, [
            h('label', { key: 'repo', className: 'dshgb-group' }, [
              h('span', { key: 'label', className: 'dshgb-grouplabel' }, TEXT.repoLabel),
              h('input', {
                key: 'input',
                className: 'dshgb-field',
                type: 'text',
                value: configDraft.repo,
                placeholder: TEXT.repoPlaceholder,
                spellCheck: false,
                onChange: (event) => setConfigDraft((current) => ({ ...current, repo: event.target.value })),
              }),
              h('span', { key: 'helper', className: 'dshgb-helper' }, `当前：${configValues.repo || `自动建仓（${configValues.repoName ?? 'dsh-backup'}）`}`),
            ]),
            h('label', { key: 'branch', className: 'dshgb-group' }, [
              h('span', { key: 'label', className: 'dshgb-grouplabel' }, TEXT.branchLabel),
              h('input', {
                key: 'input',
                className: 'dshgb-field',
                type: 'text',
                value: configDraft.branch,
                placeholder: TEXT.branchLabel,
                spellCheck: false,
                onChange: (event) => setConfigDraft((current) => ({ ...current, branch: event.target.value })),
              }),
              h('span', { key: 'helper', className: 'dshgb-helper' }, `当前：${configValues.branch ?? 'main'}`),
            ]),
            h('label', { key: 'poll', className: 'dshgb-group' }, [
              h('span', { key: 'label', className: 'dshgb-grouplabel' }, TEXT.pollLabel),
              h('input', {
                key: 'input',
                className: 'dshgb-field',
                type: 'text',
                value: configDraft.pollSeconds,
                placeholder: String(poll),
                spellCheck: false,
                onChange: (event) => setConfigDraft((current) => ({ ...current, pollSeconds: event.target.value })),
              }),
              h('span', { key: 'helper', className: 'dshgb-helper' }, `当前：${poll}s`),
            ]),
            h('div', { key: 'layout', className: 'dshgb-group' }, [
              h('span', { key: 'label', className: 'dshgb-grouplabel' }, TEXT.layoutLabel),
              h('div', { key: 'seg', className: 'dshgb-seg', role: 'group', 'aria-label': TEXT.layoutLabel }, [
                h(
                  'button',
                  {
                    key: 'ws',
                    type: 'button',
                    className: `dshgb-segbtn${configValues.layout === 'workspaces' ? ' dshgb-segbtn--active' : ''}`,
                    'aria-pressed': configValues.layout === 'workspaces',
                    onClick: () => setLayout('workspaces'),
                  },
                  TEXT.layoutWorkspaces,
                ),
                h(
                  'button',
                  {
                    key: 'root',
                    type: 'button',
                    className: `dshgb-segbtn${configValues.layout === 'root' ? ' dshgb-segbtn--active' : ''}`,
                    'aria-pressed': configValues.layout === 'root',
                    onClick: () => setLayout('root'),
                  },
                  TEXT.layoutRoot,
                ),
              ]),
              h('span', { key: 'helper', className: 'dshgb-helper' }, `当前：${configValues.layout === 'root' ? '仓库根' : 'workspaces/'}`),
            ]),
          ]),
          h('div', { key: 'auto', className: 'dshgb-info' }, [
            h('span', { key: 'dot', className: 'dshgb-dot dshgb-dot--pulse' }),
            h('span', { key: 'text' }, TEXT.autoNote(poll)),
          ]),
          h('span', { key: 'hint', className: 'dshgb-cardfoot' }, TEXT.configHint),
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

        return h('div', { className: 'dshgb-view', 'aria-label': TEXT.viewTitle }, [
          h('style', { key: 'style' }, STYLES),
          h('div', { key: 'inner', className: 'dshgb-inner' }, [
            h('header', { key: 'head', className: 'dshgb-head' }, [
              h('div', { key: 'titlerow', className: 'dshgb-titlerow' }, [
                h('span', { key: 'mark', className: 'dshgb-mark' }, icon('cloud')),
                h('div', { key: 'titles', className: 'dshgb-titles' }, [
                  h('h2', { key: 'title', className: 'dshgb-title' }, TEXT.viewTitle),
                  h('p', { key: 'subtitle', className: 'dshgb-subtitle' }, TEXT.viewSubtitle),
                ]),
                h('div', { key: 'actions', className: 'dshgb-headactions' }, [
                  btn(
                    'token',
                    tokenOpen ? TEXT.close : TEXT.tokenButton,
                    () => {
                      setTokenTouched(true)
                      setTokenOpen((open) => !open)
                    },
                    { variant: tokenState?.present && !tokenOpen ? 'secondary' : 'primary' },
                  ),
                ]),
              ]),
              h('div', { key: 'chips', className: 'dshgb-chips' }, [
                chip('auto', TEXT.chipAuto(poll), 'ok'),
                chip('repo', repoChip),
                chip('branch', TEXT.chipBranch(configValues.branch ?? 'main')),
                chip('layout', TEXT.chipLayout(configValues.layout ?? 'workspaces')),
                tokenState?.present
                  ? chip('token', `token · ${tokenLabel}`, tokenState.daysLeft !== null && tokenState.daysLeft <= 14 ? 'warn' : 'ok')
                  : tokenState === null || tokenState === undefined
                    ? null
                    : chip('token', `token · ${TEXT.tokenMissing}`, 'err'),
              ]),
            ]),
            bannerMessages.length > 0
              ? h(
                  'div',
                  { key: 'banner', className: `dshgb-banner${bannerLevel === 'err' ? ' dshgb-banner--err' : ''}` },
                  [h('span', { key: 'dot', className: `dshgb-dot${bannerLevel === 'err' ? ' dshgb-dot--err' : ' dshgb-dot--warn'} dshgb-dot--pulse` }), bannerMessages.join(' ')],
                )
              : null,
            tokenPanel,
            h('section', { key: 'versions', className: 'dshgb-card', 'aria-label': TEXT.versions }, [
              h('div', { key: 'head', className: 'dshgb-cardhead' }, [
                h('h3', { key: 'title', className: 'dshgb-cardtitle' }, [icon('history'), TEXT.versions]),
                h('span', { key: 'count', className: 'dshgb-count' }, `${versions.length}`),
                h('div', { key: 'actions', className: 'dshgb-cardactions' }, [
                  btn('undo', TEXT.undo, undoRollback, { disabled: versionBusy }),
                  btn('refresh', versionBusy ? TEXT.loading : TEXT.refresh, refreshVersions, { variant: 'secondary', disabled: versionBusy }),
                ]),
              ]),
              h('div', { key: 'rows', className: 'dshgb-rows' }, versionRows),
              detailBox,
              previewBox,
              versionFooter,
              h('span', { key: 'hint', className: 'dshgb-cardfoot' }, TEXT.hintRollback),
            ]),
            h('section', { key: 'workspaces', className: 'dshgb-card', 'aria-label': TEXT.workspaces }, [
              h('div', { key: 'head', className: 'dshgb-cardhead' }, [
                h('h3', { key: 'title', className: 'dshgb-cardtitle' }, [icon('folder'), TEXT.workspaces]),
                h('span', { key: 'count', className: 'dshgb-count' }, `${workspaces.length}`),
                h('div', { key: 'actions', className: 'dshgb-cardactions' }, [
                  btn('refresh', workspaceBusy ? TEXT.loading : TEXT.refresh, refreshWorkspaces, { variant: 'secondary', disabled: workspaceBusy }),
                ]),
              ]),
              h('div', { key: 'rows', className: 'dshgb-rows' }, workspaceRows),
              workspaceFooter,
            ]),
            configCard,
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
