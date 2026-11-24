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
      pushNow: '立即提交',
      pullNow: '拉取',
      autoSyncLabel: '自动同步',
      autoSyncOn: '已开启',
      autoSyncOff: '已关闭',
      autoSyncNote: (poll) => `开启时每 ${poll}s 扫描、静默后自动提交；关闭后需要手动点「立即提交」。`,
      autoSyncPaused: '自动同步已暂停，改动不会自动提交，记得手动点「立即提交」。',
      autoSyncSaved: '自动同步设置已保存，插件正在重启…',
      pushed: '已提交',
      pulled: '已拉取',
      tokenButton: '设置 token',
      tokenLabel: 'GitHub token',
      tokenPlaceholder: 'ghp_… 或 github_pat_…',
      tokenHint: '需要 repo 权限，保存到 %USERPROFILE%\\.dsh\\.env，不写入对话记录',
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
      statVersions: '历史版本',
      statWorkspaces: '参与备份的工作区',
      statPoll: '轮询间隔',
      statToken: 'token 状态',
      statUnitVersions: '个快照',
      statUnitWorkspaces: '个目录',
      statUnitPoll: '秒',
      descVersions: '选一个历史快照预览或恢复；最新一条高亮显示。',
      descWorkspaces: '这里列出的目录会参与自动备份，可随时停用。',
      descConfig: '仓库、分支与同步节奏；保存后插件会重启一次。',
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

    // Web3-style dark glass dashboard: self-contained palette so the panel keeps
    // its identity under both host light and dark themes.
    const STYLES = `
.dshgb-wrap { box-sizing:border-box; width:100%; height:100%; overflow:auto; padding:24px; font-size:13px; line-height:1.6; }
.dshgb-shell {
  position:relative; box-sizing:border-box; max-width:1060px; margin:0 auto; padding:24px 24px 22px; border-radius:24px;
  background:
    radial-gradient(900px 380px at 100% -10%, rgba(124,92,255,.28), transparent 60%),
    radial-gradient(700px 320px at -10% 110%, rgba(34,211,238,.16), transparent 60%),
    linear-gradient(165deg, #0d1020 0%, #0a0c16 45%, #070810 100%);
  border:1px solid rgba(255,255,255,.09);
  box-shadow:0 30px 80px -40px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.07);
  color:#a7b0d6; overflow:hidden; isolation:isolate;
}
.dshgb-shell::before {
  content:''; position:absolute; inset:0; pointer-events:none; z-index:0;
  background-image:linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
  background-size:28px 28px;
  -webkit-mask-image:radial-gradient(85% 65% at 50% 0%, #000 30%, transparent 100%);
  mask-image:radial-gradient(85% 65% at 50% 0%, #000 30%, transparent 100%);
}
.dshgb-orb { position:absolute; border-radius:50%; filter:blur(60px); opacity:.55; pointer-events:none; z-index:0; }
.dshgb-orb--a { width:260px; height:260px; top:-120px; right:-40px; background:#6d4bff; animation:dshgb-float 14s ease-in-out infinite; }
.dshgb-orb--b { width:220px; height:220px; bottom:-140px; left:-60px; background:#0ea5b7; opacity:.35; animation:dshgb-float 18s ease-in-out infinite reverse; }
.dshgb-inner { position:relative; z-index:1; display:flex; flex-direction:column; gap:16px; }

/* header */
.dshgb-head { display:flex; flex-direction:column; gap:14px; }
.dshgb-titlerow { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.dshgb-mark {
  flex:none; width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#fff;
  background:linear-gradient(135deg, #7c5cff 0%, #4f8cff 55%, #22d3ee 100%);
  box-shadow:0 8px 24px -8px rgba(124,92,255,.9), inset 0 1px 0 rgba(255,255,255,.35);
}
.dshgb-titles { display:flex; flex-direction:column; gap:0; min-width:0; }
.dshgb-title {
  margin:0; font-size:20px; font-weight:700; letter-spacing:.01em;
  background:linear-gradient(92deg, #ffffff 0%, #d7d2ff 55%, #8be9fd 100%);
  -webkit-background-clip:text; background-clip:text; color:transparent;
}
.dshgb-subtitle { margin:0; font-size:12px; color:#818aae; }
.dshgb-headactions { margin-left:auto; display:flex; gap:8px; align-items:center; }
.dshgb-chips { display:flex; flex-wrap:wrap; gap:8px; }
.dshgb-chip {
  display:inline-flex; align-items:center; gap:7px; height:26px; padding:0 11px; border-radius:999px; font-size:11px; color:#aab3d6;
  background:rgba(255,255,255,.045); border:1px solid rgba(255,255,255,.10); backdrop-filter:blur(8px); white-space:nowrap;
}
.dshgb-chip--warn { color:#fbbf24; border-color:rgba(251,191,36,.35); }
.dshgb-chip--err { color:#fb7185; border-color:rgba(251,113,133,.4); }
.dshgb-dot { width:6px; height:6px; border-radius:50%; background:#34d399; box-shadow:0 0 10px rgba(52,211,153,.9); }
.dshgb-dot--warn { background:#fbbf24; box-shadow:0 0 10px rgba(251,191,36,.9); }
.dshgb-dot--err { background:#fb7185; box-shadow:0 0 10px rgba(251,113,133,.9); }
.dshgb-dot--pulse { animation:dshgb-pulse 2.2s ease-in-out infinite; }

/* stat tiles */
.dshgb-stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; }
.dshgb-stat {
  position:relative; display:flex; flex-direction:column; gap:2px; padding:12px 14px; border-radius:14px;
  background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.08); overflow:hidden;
}
.dshgb-stat::after { content:''; position:absolute; inset:auto 0 0 0; height:1px; background:linear-gradient(90deg, transparent, rgba(124,92,255,.8), transparent); opacity:.7; }
.dshgb-statlabel { font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:#6f789c; }
.dshgb-statvalue { font-size:22px; font-weight:700; color:#eef1ff; font-variant-numeric:tabular-nums; line-height:1.2; }
.dshgb-statunit { font-size:11px; color:#7d86a8; margin-left:4px; font-weight:500; }
.dshgb-statmeta { font-size:11px; color:#8b93b8; }

/* buttons */
.dshgb-btn { appearance:none; font:inherit; font-size:12px; line-height:1.4; min-height:32px; padding:5px 13px; border-radius:10px; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; gap:6px; transition:transform .16s ease, box-shadow .16s ease, background-color .16s ease, border-color .16s ease, color .16s ease; }
.dshgb-btn:focus-visible { outline:2px solid #8be9fd; outline-offset:2px; }
.dshgb-btn:disabled { opacity:.45; cursor:default; }
.dshgb-btn--primary {
  border:1px solid rgba(255,255,255,.18); color:#fff;
  background:linear-gradient(135deg, #7c5cff 0%, #5b7cff 55%, #22d3ee 140%);
  box-shadow:0 8px 22px -10px rgba(124,92,255,.95), inset 0 1px 0 rgba(255,255,255,.32);
}
.dshgb-btn--primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 12px 28px -10px rgba(124,92,255,1), inset 0 1px 0 rgba(255,255,255,.4); }
.dshgb-btn--secondary { border:1px solid rgba(255,255,255,.16); color:#dfe4ff; background:rgba(255,255,255,.055); backdrop-filter:blur(6px); }
.dshgb-btn--secondary:hover:not(:disabled) { background:rgba(255,255,255,.10); transform:translateY(-1px); }
.dshgb-btn--soft { border:1px solid transparent; color:#9aa3c7; background:transparent; }
.dshgb-btn--soft:hover:not(:disabled) { color:#e6eaff; background:rgba(255,255,255,.06); border-color:rgba(255,255,255,.10); }
.dshgb-btn--tiny { min-height:28px; padding:3px 10px; font-size:11.5px; border-radius:8px; }

/* cards */
.dshgb-card {
  display:flex; flex-direction:column; gap:12px; padding:16px 18px 14px; border-radius:18px;
  background:linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.02));
  border:1px solid rgba(255,255,255,.09);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  animation:dshgb-rise .24s ease-out both;
}
.dshgb-cardhead { display:flex; align-items:flex-start; gap:12px; }
.dshgb-cardtitle { display:flex; flex-direction:column; gap:1px; min-width:0; }
.dshgb-cardname { display:inline-flex; align-items:center; gap:8px; font-size:13.5px; font-weight:650; color:#eef1ff; }
.dshgb-cardname svg { color:#8be9fd; }
.dshgb-carddesc { font-size:11px; color:#7d86a8; }
.dshgb-count { min-width:22px; height:22px; padding:0 7px; border-radius:999px; font-size:11px; line-height:20px; text-align:center; color:#c9d2ff; background:rgba(124,92,255,.18); border:1px solid rgba(124,92,255,.35); font-variant-numeric:tabular-nums; }
.dshgb-cardactions { display:flex; align-items:center; gap:6px; margin-left:auto; flex-wrap:wrap; }

/* version rows */
.dshgb-rows { display:flex; flex-direction:column; }
.dshgb-row {
  position:relative; display:grid; grid-template-columns:30px 132px minmax(0,1fr) auto; align-items:center; gap:14px;
  padding:11px 10px; border-top:1px solid rgba(255,255,255,.06); border-radius:12px;
  transition:background-color .16s ease, transform .16s ease;
}
.dshgb-row:first-child { border-top:0; }
.dshgb-row:hover { background:rgba(255,255,255,.05); transform:translateX(2px); }
.dshgb-row--latest { background:linear-gradient(90deg, rgba(124,92,255,.16), rgba(124,92,255,0) 45%); }
.dshgb-row--latest::before { content:''; position:absolute; left:0; top:10px; bottom:10px; width:2px; border-radius:2px; background:linear-gradient(180deg,#7c5cff,#22d3ee); box-shadow:0 0 12px rgba(124,92,255,.9); }
.dshgb-idx { text-align:right; font-size:11px; color:#5f688a; font-variant-numeric:tabular-nums; }
.dshgb-metacol { display:flex; flex-direction:column; gap:1px; min-width:0; }
.dshgb-sha { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:11px; color:#8be9fd; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dshgb-time { font-size:11px; color:#7d86a8; }
.dshgb-msg { display:flex; align-items:center; gap:9px; min-width:0; }
.dshgb-msgtick { flex:none; width:5px; height:5px; border-radius:50%; background:rgba(255,255,255,.16); }
.dshgb-row--latest .dshgb-msgtick { background:#22d3ee; box-shadow:0 0 10px rgba(34,211,238,.95); }
.dshgb-msgtext { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#dfe4ff; }
.dshgb-row--latest .dshgb-msgtext { color:#ffffff; font-weight:600; }
.dshgb-rowactions { display:flex; align-items:center; gap:4px; }

/* workspaces */
.dshgb-wsrow { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:14px; padding:10px; border-top:1px solid rgba(255,255,255,.06); border-radius:12px; transition:background-color .16s ease, transform .16s ease; }
.dshgb-wsrow:first-child { border-top:0; }
.dshgb-wsrow:hover { background:rgba(255,255,255,.05); transform:translateX(2px); }
.dshgb-wsmain { display:flex; flex-direction:column; gap:2px; min-width:0; }
.dshgb-wsname { display:flex; align-items:center; gap:8px; color:#eef1ff; font-size:13px; font-weight:600; }
.dshgb-badge { height:18px; padding:0 7px; border-radius:999px; border:1px solid rgba(251,191,36,.4); background:rgba(251,191,36,.12); color:#fbbf24; font-size:10.5px; line-height:16px; }
.dshgb-wspath { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:11px; color:#7d86a8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dshgb-meta { font-size:11px; color:#8b93b8; font-variant-numeric:tabular-nums; }

/* fields */
.dshgb-field {
  display:block; width:100%; box-sizing:border-box; height:38px; border-radius:11px; padding:0 12px;
  border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.05); color:#eef1ff;
  font:inherit; font-size:12.5px; transition:border-color .16s ease, box-shadow .16s ease, background-color .16s ease;
}
.dshgb-field::placeholder { color:#5f688a; }
.dshgb-field:hover:not(:disabled) { border-color:rgba(124,92,255,.55); }
.dshgb-field:focus { outline:none; border-color:#7c5cff; box-shadow:0 0 0 3px rgba(124,92,255,.22); background:rgba(255,255,255,.07); }
.dshgb-field:disabled { opacity:.6; }
.dshgb-footrow { display:flex; align-items:center; gap:8px; padding-top:12px; border-top:1px solid rgba(255,255,255,.06); }
.dshgb-footrow .dshgb-field { flex:1 1 auto; width:auto; }
.dshgb-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px 16px; }
.dshgb-group { display:flex; flex-direction:column; gap:6px; min-width:0; }
.dshgb-grouplabel { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:#6f789c; }
.dshgb-helper { font-size:11px; color:#7d86a8; min-height:16px; }
.dshgb-seg { display:inline-flex; border:1px solid rgba(255,255,255,.14); border-radius:11px; overflow:hidden; width:fit-content; background:rgba(255,255,255,.04); }
.dshgb-segbtn { appearance:none; border:0; background:transparent; color:#9aa3c7; font:inherit; font-size:12px; padding:6px 13px; min-height:36px; cursor:pointer; transition:background-color .16s ease, color .16s ease; }
.dshgb-segbtn:hover { color:#e6eaff; }
.dshgb-segbtn--active { background:linear-gradient(135deg, rgba(124,92,255,.95), rgba(79,140,255,.95)); color:#fff; box-shadow:0 4px 14px -6px rgba(124,92,255,.9); }
.dshgb-segbtn:focus-visible { outline:2px solid #8be9fd; outline-offset:-2px; }
.dshgb-info { display:flex; align-items:center; gap:9px; padding:10px 12px; border-radius:11px; background:rgba(124,92,255,.08); border:1px solid rgba(124,92,255,.22); font-size:11.5px; color:#b7bff0; }
.dshgb-autorow { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:12px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10); }
.dshgb-autotext { display:flex; flex-direction:column; gap:1px; min-width:0; }
.dshgb-autotitle { display:inline-flex; align-items:center; gap:8px; font-size:12.5px; font-weight:600; color:#eef1ff; }
.dshgb-switch {
  appearance:none; flex:none; width:46px; height:26px; border-radius:999px; cursor:pointer; position:relative; margin-left:auto;
  border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.08); transition:background-color .18s ease, border-color .18s ease;
}
.dshgb-switch:focus-visible { outline:2px solid #8be9fd; outline-offset:2px; }
.dshgb-switch::after {
  content:''; position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#c7cdf0;
  transition:transform .18s ease, background-color .18s ease, box-shadow .18s ease;
}
.dshgb-switch--on { border-color:rgba(124,92,255,.6); background:linear-gradient(135deg, rgba(124,92,255,.95), rgba(34,211,238,.85)); box-shadow:0 0 18px -4px rgba(124,92,255,.85); }
.dshgb-switch--on::after { transform:translateX(20px); background:#ffffff; box-shadow:0 0 10px rgba(255,255,255,.8); }
.dshgb-switch:disabled { opacity:.5; cursor:default; }

/* nested sub-cards */
.dshgb-subcard {
  display:flex; flex-direction:column; gap:8px; padding:13px 15px; border-radius:14px;
  background:rgba(8,10,20,.55); border:1px solid rgba(139,233,253,.18); backdrop-filter:blur(6px);
  animation:dshgb-rise .2s ease-out both;
}
.dshgb-subhead { display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
.dshgb-subname { font-size:12.5px; font-weight:650; color:#eef1ff; }
.dshgb-sublactions { margin-left:auto; display:flex; gap:4px; }
.dshgb-file { display:flex; align-items:center; gap:10px; padding:6px 8px; border-radius:9px; font-size:12px; transition:background-color .15s ease; }
.dshgb-file:hover { background:rgba(255,255,255,.05); }
.dshgb-filepath { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#dfe4ff; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:11.5px; }
.dshgb-filediff { flex:none; font-size:11px; font-variant-numeric:tabular-nums; }
.dshgb-add { color:#34d399; }
.dshgb-del { color:#fb7185; }

/* misc */
.dshgb-hint { font-size:11px; color:#7d86a8; }
.dshgb-status { font-size:11.5px; animation:dshgb-rise .2s ease-out both; }
.dshgb-status--ok { color:#34d399; }
.dshgb-status--err { color:#fb7185; }
.dshgb-banner { display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border-radius:14px; font-size:12px; color:#fbbf24; background:rgba(251,191,36,.08); border:1px solid rgba(251,191,36,.28); animation:dshgb-rise .2s ease-out both; }
.dshgb-banner--err { color:#fb7185; background:rgba(251,113,133,.08); border-color:rgba(251,113,133,.3); }
.dshgb-empty { padding:16px 10px; font-size:12px; color:#7d86a8; }
.dshgb-skeleton { height:11px; border-radius:6px; background:linear-gradient(90deg, rgba(255,255,255,.05) 25%, rgba(255,255,255,.12) 37%, rgba(255,255,255,.05) 63%); background-size:200% 100%; animation:dshgb-shimmer 1.3s linear infinite; }
.dshgb-skeletonrow { display:grid; grid-template-columns:30px 132px minmax(0,1fr); gap:14px; align-items:center; padding:13px 10px; border-top:1px solid rgba(255,255,255,.06); }
.dshgb-skeletonrow:first-child { border-top:0; }

@keyframes dshgb-rise { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
@keyframes dshgb-shimmer { from { background-position:200% 0; } to { background-position:-200% 0; } }
@keyframes dshgb-pulse { 0%,100% { opacity:1; } 50% { opacity:.35; } }
@keyframes dshgb-float { 0%,100% { transform:translate3d(0,0,0); } 50% { transform:translate3d(-14px,18px,0); } }
@media (prefers-reduced-motion: reduce) {
  .dshgb-card, .dshgb-subcard, .dshgb-banner, .dshgb-status { animation:none !important; }
  .dshgb-skeleton { animation:none !important; }
  .dshgb-orb { animation:none !important; }
  .dshgb-row, .dshgb-wsrow, .dshgb-btn, .dshgb-field, .dshgb-file, .dshgb-segbtn { transition:none !important; }
  .dshgb-row:hover, .dshgb-wsrow:hover, .dshgb-btn:hover:not(:disabled) { transform:none !important; }
  .dshgb-dot--pulse { animation:none !important; }
}
`

    function icon(kind) {
      const common = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true }
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

    // Auto-commit messages embed an ISO timestamp that duplicates the relative time.
    function cleanMessage(message) {
      return String(message ?? '')
        .replace(/\s*@\s*\d{4}-\d{2}-\d{2}T[^\s]*/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
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
        const [autoOptimistic, setAutoOptimistic] = React.useState(null)
        const [status, setStatus] = React.useState(null)
        const [detailHidden, setDetailHidden] = React.useState(false)
        const [previewHidden, setPreviewHidden] = React.useState(false)

        const dispatch = dispatchFor(props?.sessionId)
        const hasSession = Boolean(props?.sessionId)
        const autoOn = autoOptimistic === null ? statusInfo?.autoSync !== false : autoOptimistic

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

        const manualPush = () => {
          if (!hasSession) return
          run(TEXT.pushNow, '/dsh-backup push', {
            okText: `${TEXT.pushed} · ${TEXT.sent}`,
            done: () => {
              refreshVersions()
              refreshStatus()
            },
          })
        }

        const manualPull = () => {
          if (!hasSession) return
          run(TEXT.pullNow, '/dsh-backup pull', {
            okText: `${TEXT.pulled} · ${TEXT.sent}`,
            done: () => {
              refreshVersions()
              refreshStatus()
            },
          })
        }

        const toggleAutoSync = () => {
          if (!hasSession) return
          const next = !autoOn
          setAutoOptimistic(next)
          dispatch(`/dsh-backup config set autoSync ${next ? 'true' : 'false'}`)
            .then(() => {
              setStatus({ kind: 'ok', text: TEXT.autoSyncSaved })
              return dispatch('/dsh-backup status').catch(() => {})
            })
            .catch((error) => {
              setAutoOptimistic(null)
              setStatus({ kind: 'err', text: `${TEXT.failed}: ${error?.message ?? String(error)}` })
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
              className: `dshgb-btn dshgb-btn--${options.variant ?? 'soft'}${options.tiny ? ' dshgb-btn--tiny' : ''}`,
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
          if (statusInfo.autoSync === false) {
            bannerMessages.push(TEXT.autoSyncPaused)
            if (bannerLevel !== 'err') bannerLevel = 'warn'
          }
        }

        const chip = (key, text, tone) =>
          h(
            'span',
            { key, className: `dshgb-chip${tone === 'warn' ? ' dshgb-chip--warn' : tone === 'err' ? ' dshgb-chip--err' : ''}` },
            [h('span', { key: 'dot', className: `dshgb-dot${tone === 'warn' ? ' dshgb-dot--warn' : tone === 'err' ? ' dshgb-dot--err' : ''}` }), text],
          )

        const stat = (key, label, value, unit, meta) =>
          h('div', { key, className: 'dshgb-stat' }, [
            h('span', { key: 'label', className: 'dshgb-statlabel' }, label),
            h('span', { key: 'value', className: 'dshgb-statvalue' }, [String(value), unit ? h('span', { key: 'u', className: 'dshgb-statunit' }, unit) : null]),
            meta ? h('span', { key: 'meta', className: 'dshgb-statmeta' }, meta) : null,
          ])

        const tokenPanel = tokenOpen
          ? h('div', { key: 'token', className: 'dshgb-subcard', role: 'group', 'aria-label': TEXT.tokenButton }, [
              h('div', { key: 'head', className: 'dshgb-subhead' }, [
                h('span', { key: 'title', className: 'dshgb-subname' }, TEXT.tokenLabel),
                tokenLabel ? h('span', { key: 'state', className: 'dshgb-meta' }, tokenLabel) : null,
                h('div', { key: 'actions', className: 'dshgb-sublactions' }, [
                  btn('close', TEXT.close, () => {
                    setTokenTouched(true)
                    setTokenOpen(false)
                  }),
                ]),
              ]),
              h('div', { key: 'row', style: { display: 'flex', gap: '8px' } }, [
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
                    h('div', { key: 'msg', className: 'dshgb-msg' }, [
                      h('span', { key: 'tick', className: 'dshgb-msgtick' }),
                      h('span', { key: 'text', className: 'dshgb-msgtext', title: item.message ?? '' }, cleanMessage(item.message) || TEXT.noMessage),
                    ]),
                    h('div', { key: 'actions', className: 'dshgb-rowactions' }, [
                      btn('detail', TEXT.detail, () => openDetail(item.sha), { tiny: true, disabled: versionBusy }),
                      btn('preview', TEXT.preview, () => openPreview(item.sha), { tiny: true, disabled: versionBusy }),
                      btn('rollback', TEXT.rollback, () => rollbackTo(item.sha), { variant: 'primary', tiny: true, disabled: versionBusy }),
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
                      tiny: true,
                      disabled: workspaceBusy,
                    }),
                  ]),
                ]),
              )

        const detailBox = detail && Array.isArray(detail.files) && !detailHidden
          ? h('div', { key: 'detail', className: 'dshgb-subcard' }, [
              h('div', { key: 'head', className: 'dshgb-subhead' }, [
                h('span', { key: 'title', className: 'dshgb-subname' }, `${TEXT.detailTitle} · ${detail.short ?? ''}`),
                h('span', { key: 'meta', className: 'dshgb-meta' }, `${detail.files.length} ${TEXT.files}`),
                h('div', { key: 'actions', className: 'dshgb-sublactions' }, [btn('close', TEXT.close, () => setDetailHidden(true), { tiny: true })]),
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
                      btn('only', TEXT.onlyThis, () => rollbackTo(detail.sha, [file.path]), { variant: 'primary', tiny: true, disabled: versionBusy }),
                    ]),
                  )),
            ])
          : null

        const previewBox = preview && !previewHidden
          ? h('div', { key: 'preview', className: 'dshgb-subcard' }, [
              h('div', { key: 'head', className: 'dshgb-subhead' }, [
                h('span', { key: 'title', className: 'dshgb-subname' }, `${TEXT.previewTitle} · ${preview.short ?? ''}`),
                h(
                  'span',
                  { key: 'meta', className: 'dshgb-meta' },
                  `写入 ${preview.write?.length ?? 0} · 删除 ${preview.remove?.length ?? 0} · 不变 ${preview.unchanged ?? 0}`,
                ),
                h('div', { key: 'actions', className: 'dshgb-sublactions' }, [
                  btn('confirm', TEXT.confirmAll, () => rollbackTo(preview.sha), { variant: 'primary', tiny: true, disabled: versionBusy }),
                  btn('cancel', TEXT.cancel, () => setPreviewHidden(true), { tiny: true }),
                ]),
              ]),
              ...(preview.write ?? []).slice(0, 20).map((path) =>
                h('div', { key: `w-${path}`, className: 'dshgb-file' }, [
                  h('span', { key: 'path', className: 'dshgb-filepath', title: path }, path),
                  h('span', { key: 'diff', className: 'dshgb-filediff dshgb-add' }, '写入'),
                  btn('only', TEXT.onlyThis, () => rollbackTo(preview.sha, [path]), { variant: 'primary', tiny: true, disabled: versionBusy }),
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
            h('div', { key: 'title', className: 'dshgb-cardtitle' }, [
              h('span', { key: 'name', className: 'dshgb-cardname' }, [icon('sliders'), TEXT.config]),
              h('span', { key: 'desc', className: 'dshgb-carddesc' }, TEXT.descConfig),
            ]),
            h('div', { key: 'actions', className: 'dshgb-cardactions' }, [
              btn('save', TEXT.save, saveConfig, { variant: 'primary' }),
              btn('reload', TEXT.refresh, loadConfig, { variant: 'secondary' }),
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
          h('div', { key: 'auto', className: 'dshgb-autorow' }, [
            h('div', { key: 'text', className: 'dshgb-autotext' }, [
              h('span', { key: 'title', className: 'dshgb-autotitle' }, [
                h('span', { key: 'dot', className: `dshgb-dot${autoOn ? ' dshgb-dot--pulse' : ' dshgb-dot--warn'}` }),
                TEXT.autoSyncLabel,
                h('span', { key: 'state', className: 'dshgb-meta' }, autoOn ? TEXT.autoSyncOn : TEXT.autoSyncOff),
              ]),
              h('span', { key: 'hint', className: 'dshgb-hint' }, TEXT.autoSyncNote(poll)),
            ]),
            h('button', {
              key: 'switch',
              type: 'button',
              role: 'switch',
              className: `dshgb-switch${autoOn ? ' dshgb-switch--on' : ''}`,
              'aria-checked': autoOn,
              'aria-label': TEXT.autoSyncLabel,
              disabled: !hasSession,
              onClick: toggleAutoSync,
            }),
          ]),
          h('span', { key: 'hint', className: 'dshgb-hint' }, TEXT.configHint),
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

        return h('div', { className: 'dshgb-wrap' }, [
          h('style', { key: 'style' }, STYLES),
          h('div', { key: 'shell', className: 'dshgb-shell', 'aria-label': TEXT.viewTitle }, [
            h('span', { key: 'orb-a', className: 'dshgb-orb dshgb-orb--a', 'aria-hidden': true }),
            h('span', { key: 'orb-b', className: 'dshgb-orb dshgb-orb--b', 'aria-hidden': true }),
            h('div', { key: 'inner', className: 'dshgb-inner' }, [
              h('header', { key: 'head', className: 'dshgb-head' }, [
                h('div', { key: 'titlerow', className: 'dshgb-titlerow' }, [
                  h('span', { key: 'mark', className: 'dshgb-mark' }, icon('cloud')),
                  h('div', { key: 'titles', className: 'dshgb-titles' }, [
                    h('h2', { key: 'title', className: 'dshgb-title' }, TEXT.viewTitle),
                    h('p', { key: 'subtitle', className: 'dshgb-subtitle' }, TEXT.viewSubtitle),
                  ]),
                  h('div', { key: 'actions', className: 'dshgb-headactions' }, [
                    btn('push', TEXT.pushNow, manualPush, { variant: 'secondary' }),
                    btn('pull', TEXT.pullNow, manualPull, { variant: 'secondary' }),
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
                h('div', { key: 'stats', className: 'dshgb-stats' }, [
                  stat('versions', TEXT.statVersions, versions.length, TEXT.statUnitVersions, formatWhen(versions[0]?.date) ? `最近 ${formatWhen(versions[0]?.date)}` : '等待首次提交'),
                  stat('workspaces', TEXT.statWorkspaces, workspaces.length, TEXT.statUnitWorkspaces, '可在下方停用'),
                  stat('poll', TEXT.statPoll, poll, TEXT.statUnitPoll, '自动扫描周期'),
                  stat('token', TEXT.statToken, tokenState?.present ? '正常' : tokenState === undefined ? '—' : '缺失', '', tokenLabel || '尚未配置'),
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
                  h('div', { key: 'title', className: 'dshgb-cardtitle' }, [
                    h('span', { key: 'name', className: 'dshgb-cardname' }, [icon('history'), TEXT.versions, h('span', { key: 'count', className: 'dshgb-count' }, `${versions.length}`)]),
                    h('span', { key: 'desc', className: 'dshgb-carddesc' }, TEXT.descVersions),
                  ]),
                  h('div', { key: 'actions', className: 'dshgb-cardactions' }, [
                    btn('undo', TEXT.undo, undoRollback, { variant: 'secondary', disabled: versionBusy }),
                    btn('refresh', versionBusy ? TEXT.loading : TEXT.refresh, refreshVersions, { variant: 'secondary', disabled: versionBusy }),
                  ]),
                ]),
                h('div', { key: 'rows', className: 'dshgb-rows' }, versionRows),
                detailBox,
                previewBox,
                versionFooter,
                h('span', { key: 'hint', className: 'dshgb-hint' }, TEXT.hintRollback),
              ]),
              h('section', { key: 'workspaces', className: 'dshgb-card', 'aria-label': TEXT.workspaces }, [
                h('div', { key: 'head', className: 'dshgb-cardhead' }, [
                  h('div', { key: 'title', className: 'dshgb-cardtitle' }, [
                    h('span', { key: 'name', className: 'dshgb-cardname' }, [icon('folder'), TEXT.workspaces, h('span', { key: 'count', className: 'dshgb-count' }, `${workspaces.length}`)]),
                    h('span', { key: 'desc', className: 'dshgb-carddesc' }, TEXT.descWorkspaces),
                  ]),
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
