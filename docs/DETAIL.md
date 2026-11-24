# GitHub .dsh 备份

把每个工作区的 `.dsh` 文件夹（也就是该项目的技能包）备份到 GitHub，并在检测到变化时自动推送；需要时再一键拉回当前工作区。

插件在 Host 进程里默认自动完成全部同步（可在界面关闭），并在 Web 端注册一个会话视图「快照」：能力通过八个模型工具、一个斜杠命令和这个视图暴露；视图内提供手动「立即提交 / 拉取」与自动同步开关。

## 界面

### 顶部视图页签「快照」

版本回滚、工作区管理与配置注册成会话的第三个 Conversation View（`conversation.view`），和「对话」「轨迹」同一排页签。取名「快照」而不是「备份」，是因为这一页主要在做**版本快照的浏览与恢复**，备份本身是后台自动行为。

页面整体是**浅色、跟随宿主主题**的面板：背景、卡片、文字、边框、状态色全部取自 `--dsw-alias-*` 令牌，浅色主题下是白底卡片 + 品牌色点缀，切到深色主题时自动变深，无需单独维护两套皮肤。

- **头部**：品牌色渐变图标 + 标题「快照与版本」+ 副标题；右上角「立即提交 / 拉取 / 设置 token」按钮（已配置 token 时为次级描边、未配置时品牌色实心）。下面一排状态胶囊（自动同步 / 仓库 / 分支 / 布局 / token），用小圆点表达状态。
- **指标条**：4 个统计块 —— 历史版本数（附"最近 N 分钟前"）、参与备份的工作区数、轮询间隔、token 状态。
- **版本回滚卡**：卡头有图标、标题、数量徽章和一句说明；数据行是**固定四列网格** `序号 | 短 sha + 相对时间 | 提交说明 | 操作`；最新一条有品牌色左侧竖条和浅色底；sha 用品牌色等宽字体；操作按钮常驻（详情/预览/改动为轻量描边，回滚为品牌色实心）。加载中显示 shimmer 骨架行。
- **弹窗详情**：详情、预览、改动、体检不再堆在页面里，而是打开**居中弹窗**（遮罩 + 淡入 + 缩放动画，`role="dialog" aria-modal="true"`）：
  - 详情：文件搜索框 + 文件列表，每行「改动」（看该文件 patch）和「仅恢复」；
  - 预览：写入 / 删除 / 不变计数与文件列表，底部「全部回滚 / 取消」，单文件仍可「仅恢复」；
  - 改动：按文件展示 unified patch，绿加红删、`@@` 品牌色，`max-height` 内部滚动；
  - 体检：仓库大小、远端/本地文件数、一致性统计与差异路径。
  弹窗支持**关闭按钮、点击遮罩关闭、Esc 关闭**，头部固定、正文滚动。打开弹窗时会先清空该类数据的旧缓存，只有收到与请求版本 SHA（或请求路径）匹配的结果才渲染，等待期间显示骨架行——因此不会出现"点新版本却先看到上一个版本内容"的问题。
- **工作区卡**：名称 + 停用徽章 + 文件数 + 等宽路径，右侧启停按钮。
- **配置卡**：仓库 / 分支 / 轮询三列（每列下方「当前：…」说明）+ 远端布局分段控件；底部一行「自动同步」开关（默认开，可关），提示关闭后需手动提交。

### 设计要点与动效

- **输入框**：`width:100%` + 固定 38px 高、白底 + 描边，聚焦时品牌色描边 + 3px 光晕。
- **按钮**：品牌色实心主按钮（回滚 / 保存 token / 仅恢复 / 立即提交）、描边次级（刷新 / 保存 / 停用）、轻量文字（详情 / 预览 / 改动）。
- **动效**：卡片淡入上浮、弹窗淡入 + 轻微缩放、行悬停右移、骨架 shimmer、状态点呼吸；`prefers-reduced-motion` 下全部关闭。
- **自适应**：`@media (max-width:720px)` 下隐藏序号/元信息列、收窄内边距、弹窗改为 88vh，小窗口也能操作。
- **信息去噪**：自动提交信息里重复的 `@ 2026-…` ISO 时间戳会被剥掉，只保留相对时间。
- **无障碍**：对比度来自宿主令牌；分段控件带 `role="group"` + `aria-pressed`，弹窗带 `aria-modal`，按钮都有 `aria-label`。

### 版本行的三个动作

- **详情**：列出这个版本改动的文件与增删行数；每个文件后面有「仅恢复」，只把该文件恢复到这个版本。
- **预览**：先算一遍「将写入 N / 将删除 M / 不变 K」并列出文件，**不动磁盘**；预览框里可以「全部回滚」，也可以对单个文件点「仅恢复」。
- **回滚**：直接恢复整个 `.dsh`（也会先自动备份当前改动）。
- 版本区右上角还有 **撤销回滚**：把工作区恢复到上一次回滚之前的状态。

点某行「回滚」＝执行 `/dsh-backup rollback <提交号>`：先把本地 `.dsh` 恢复成那个提交的内容（写入变更文件、删除该版本里没有的本地文件），再推一个新提交，本地与远端保持同步，随后自动刷新列表。

### 自动同步（默认开启，可关闭）+ 手动提交

- **默认自动**：每 `pollSeconds` 秒扫描工作区 `.dsh`，变化后静默 `debounceSeconds` 秒自动提交。
- **可关闭**：「配置」卡里有「自动同步」开关（默认开）。切换**立即生效、不重启**，偏好写入 `$DSH_HOME/dsh-git-backup/prefs.json`；关闭后页面顶部会出现「自动同步已暂停，记得手动提交」的提示条。
- **手动提交**：头部常驻 **「立即提交」** 与 **「拉取」** 两个按钮，分别执行 `/dsh-backup push` 与 `/dsh-backup pull`；关闭自动同步后就是靠它们记录改动。
- 斜杠命令与 agent 工具仍然可用（`/dsh-backup push|pull|status`、`dsh_backup_push` 等）。

样式以组件内的 `<style>` 元素渲染（单例 class 前缀 `dshgb-`），卸载时随之移除；配色与边框全部使用宿主 `--dsw-alias-*` 令牌，浅色/深色主题自动跟随。

视图数据都来自命令产生的会话日志：把 Host 返回的结构化结果（`⟦dshb:{…}⟧` 标记）从 `command/done` 事件里解析出来渲染，所以这些结果同时也会作为命令记录出现在「对话」里——这正是「会话日志是唯一真相」的代价，不做额外隐藏通道。

### 性能与并发

- **哈希缓存**：`$DSH_HOME/dsh-git-backup/blob-cache.json` 记录 `mtime + size → git blob sha`，未变化文件不再读盘；缓存条目上限 20000，文件内容变化后自动失效。
- **注册表锁**：`workspaces.json` 的读改写走跨进程锁文件（`workspaces.lock`）+ 原子替换，30 秒以上的陈旧锁自动回收。
- **测试与 CI**：`node --test test`（零依赖）覆盖 engine（锁、哈希缓存、冲突保护、注册表并发、token）、commands、客户端渲染与工具函数；`.github/workflows/ci.yml` 在 Linux/Windows × Node 20/22 上运行。

### 本地保护（覆盖前先保存）
拉取和回滚都会重写本地文件。执行前插件会先做一次 **不删除远端文件的自动保存提交**（`autosave-before-restore`）：

- 本地为空或没有差异时完全跳过，不会凭空产生提交；
- 有未推送改动时会先推一个 autosave 提交，所以被覆盖的内容仍能在历史里找回；
- 保存失败时默认中止操作并报错；确实要覆盖可以显式传 `force`（命令里没有强制开关，只有工具/脚本能传，避免误操作）。

### 仓库配置（界面可改）

「快照」页第三个区是仓库配置：仓库 `owner/name`、分支、轮询秒数可以在输入框里改，远端布局（`workspaces/<名字>` 或仓库根）用按钮切换，保存后写入 profile 配置并让插件行重启一次生效。自动同步不提供开关（默认始终开启）。对应的命令是 `/dsh-backup config` 与 `/dsh-backup config set <键> <值>`，可配置键：`repo`、`repoName`、`branch`、`layout`、`remoteRoot`、`pollSeconds`、`debounceSeconds`、`autoSync`。

### 灾难恢复（不依赖 DSH）

仓库根目录带一个独立脚本 `recover.mjs`，用普通 Node 运行即可，不需要启动 DSH：

```powershell
# 看仓库里有哪些工作区备份
node recover.mjs --repo Bigdusk/dsh-backup --list

# 恢复到某个目录（默认前缀 workspaces/<目录名>）
node recover.mjs --repo Bigdusk/dsh-backup --target "C:\Users\me\Desktop\T"

# 其它机器/其它前缀
node recover.mjs --repo owner/name --target D:\work\proj --remote-root workspaces/T --dry-run
```

token 默认从 `%USERPROFILE%\.dsh\.env` 读 `GITHUB_TOKEN`，可用 `--token-env`、`--home` 覆盖；`--dry-run` 只预览，`--prune` 顺带删除远端已不存在的文件。

### token 过期与失败可见

配置了 token 时，插件会读取 GitHub 响应里的过期头，token 剩余 14 天内会在「快照」页顶部出现提示条；自动同步失败的也汇总在同一处提示条（并保留在每个工作区的「上次错误」里）。

### 在「快照」页里配置 token 与仓库

- **GitHub token**：视图右上角常驻「设置 token」按钮（未配置 token 时表单会自动展开）。点开是一个卡片：密码输入框 + 「保存 token」+ 当前状态（未配置 / 已配置 / 还有 N 天过期）+ 「保存到 `%USERPROFILE%\.dsh\.env`」说明。保存时把 token 通过 `/dsh-backup token <token>` 交给 Host，Host 先向 GitHub 校验账号再写入 `.env`，随后自动开始备份。该命令以 `recordInput: false` 注册，所以 token **不会**进入会话日志、对话流或命令记录的界面文本；保存成功后收起面板并清空输入框。
- **仓库 / 分支 / 轮询 / 远端布局**：在「配置」区里改，保存后写入 profile 配置并让插件行重启一次生效。
- **自动同步开关**：「配置」卡底部的拨杆，默认开启；切换**立即生效、不重启**，偏好写入 `$DSH_HOME/dsh-git-backup/prefs.json`，插件启动时读取。关闭后页面顶部提示需要手动提交。

### 冲突检测与串行锁

- 每次成功同步后记录远端 HEAD。下一次自动提交前若发现远端 HEAD 已变化（另一台机器或 GitHub 网页上有人写入），**自动提交会中止并报错**，避免静默覆盖对方工作；确认要覆盖时手动点「立即提交」即可（工具可传 `allowOverwrite`）。
- `push` / `pull` / `rollback` 对同一工作区共用一把串行锁，恢复过程中不会再插入自动提交，杜绝「半回滚」的中间态提交；不同工作区仍可并行。

### 内容改动、体检与 token 管理

- **内容改动**：版本行「改动」与详情里的单文件「改动」执行 `/dsh-backup diff <ref> [路径]`，返回 unified patch（绿加红删、`@@` 青色），界面里直接在卡片中渲染。
- **仓库体检**：配置卡「体检」→ `/dsh-backup health`，给出仓库大小、远端/本地文件数、逐文件一致性（内容不一致 / 本地未备份 / 远端多出），只读。
- **移除 token**：配置卡「移除 token」→ `/dsh-backup token clear`，从 `$DSH_HOME/.env` 删除该行并清理进程环境变量。
- **搜索**：版本卡按提交说明或 sha 过滤；详情/预览按文件路径过滤。

界面文案固定为中文：即使应用语言是英文，视图也显示中文（`locale/en.json` 的插件标题与描述同样是中文，保证任何语言下 Plugins 列表里也是中文）。如需恢复按语言切换，改 `client.js` 顶部的 `TEXT` 表并读 `ctx.get('locale').getLocale().active`。

## 它做什么

- **自动推送**：每 `pollSeconds` 秒扫描一次工作区里的 `.dsh`（路径、大小指纹），发现变化后等 `debounceSeconds` 秒（避免连续编辑产生一堆提交）再推送。
- **增量提交**：用 GitHub Git Data API 逐文件比对 Git blob SHA，只上传真正变化的文件，并删除远端已不存在的文件；一次同步通常只有 1 个 commit。
- **自动建仓**：`repo` 为空时，用 token 对应的账号创建（或复用）`repoName` 指定的私有仓库。
- **一键拉取**：把远端 `.dsh` 写回当前工作区，只重写内容不同的文件。
- **无需 git CLI**：不依赖本机安装 git，直接走 GitHub REST API，所以 Windows 上也能用。

## 工具

| 工具 | 作用 |
|---|---|
| `dsh_backup_status` | 仓库/分支、token 是否可用、每个工作区是否有待推送改动、最近提交与错误。`checkRemote: true` 会额外读取远端 HEAD。 |
| `dsh_backup_push` | 立即推送当前工作区的 `.dsh`。`dryRun: true` 只预览变更（不建仓、不上传），`message` 可自定义提交信息。 |
| `dsh_backup_pull` | 把远端备份拉回当前工作区。`dryRun: true` 只预览；`prune: true` 删除远端已不存在的本地文件。 |
| `dsh_backup_set_token` | 校验 token 并写入 `$DSH_HOME/.env`，随后安排一次自动备份。token 不会出现在返回值或日志中。 |
| `dsh_backup_auto` | 临时开关本进程的自动同步（不持久化）。 |
| `dsh_backup_history` | 列出某个工作区 `.dsh` 的备份版本：序号、短提交号、时间、说明。`limit` 默认 10；传 `version` 改为列出该版本改动的文件与增删行数。 |
| `dsh_backup_rollback` | 回滚到某个版本：`version` 接受序号、提交号（可缩写）、分支或标签；`paths` 只恢复指定文件/目录，`undo: true` 撤销上一次回滚，`local: true` 只改本地，`dryRun: true` 只预览。 |
| `dsh_backup_workspaces` | 工作区管理：`action` 为 list / add / remove / enable / disable，`path` 为工作区绝对路径。 |
| `dsh_backup_health` | 体检备份仓库：大小、远端/本地文件数、逐文件一致性（只读）。 |
| `dsh_backup_diff` | 查看某版本的内容改动（unified patch），可用 `path` 过滤。 |

斜杠命令：`/dsh-backup status | push | pull | history [n] | detail <ref> | diff <ref> [路径] | preview <ref> | rollback <ref> [--local] [--only <路径>] | undo | workspaces | workspace <add|remove|enable|disable> <路径> | auto [on|off] | token <token|clear> | health | config [set <键> <值>]`，不经模型直接执行，控制条按钮和「快照」页调用的就是它。

## 版本回滚

- 版本来源是该工作区远端目录（`workspaces/<工作区名>/`）下的提交历史，所以只有真正改动过这个工作区 `.dsh` 的提交才会出现在列表里。
- 回滚是「恢复到旧版本 + 推一个新提交」，history 本身不可变：你可以随时再回滚到回滚之前那个版本。
- 回滚时按配置的 `exclude` 过滤文件；被排除的本地文件（如 `.credentials*`、`.env`）不会被删除。
- 只想暂时看一眼旧版本、不想动远端时用 `local: true` / `--local`，此时远端保留较新版本，后续任何改动仍会正常推送。

## 工作区管理

参与备份的工作区 = DSH 已登记的工作区里带 `.dsh` 目录的那些，加上手动 `add` 的路径；`disable` 的工作区保留历史但不参与扫描和自动推送。

- 注册表文件：`$DSH_HOME/dsh-git-backup/workspaces.json`，结构为 `{ "disabled": [绝对路径], "extra": [绝对路径] }`，可手工编辑，插件每次读盘。
- 远端前缀：默认 `workspaces/<工作区名>`（来自 `layout`/`remoteRoot` 配置），面板里每个工作区都会显示自己的前缀，避免多工作区互相覆盖。
- `remove` 对「手动添加」的路径是删除注册项；对 DSH 自动发现的工作区等价于「停用」，因为它下次扫描还会被发现。

## Token

GitHub Personal Access Token 需要 `repo` 权限（fine-grained token 需要 Contents: Read and write）。

**在界面里设置（推荐）**：「快照」页右上角「设置 token」→ 密码框粘贴 → 「保存 token」。Host 会先向 GitHub 校验账号，通过后写入 `$DSH_HOME/.env` 的 `GITHUB_TOKEN`，并自动开始备份。

也可以手工写入 `%USERPROFILE%\.dsh\.env`（`DSH_HOME` 默认是 `%USERPROFILE%\.dsh`）：

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxx
```

查找顺序（命中即用）：

1. 环境变量：插件配置 `tokenEnv` 指定的名字（默认 `GITHUB_TOKEN`），其次 `GITHUB_TOKEN`、`GH_TOKEN`；
2. `$DSH_HOME/.env` 里的同名变量（界面保存的就是这一处）。

## 配置

配置写在 bundle 的 `cordis.patch.yml`（或配置该插件行）里，常用项：

| 项 | 默认值 | 说明 |
|---|---|---|
| `repo` | `''` | `owner/repo`。留空则用 token 账号 + `repoName` |
| `repoName` | `dsh-backup` | 自动创建/复用的仓库名 |
| `private` | `true` | 自动建仓时是否私有 |
| `branch` | `main` | 备份分支 |
| `subdir` | `.dsh` | 每个工作区里被备份的目录 |
| `autoSync` | `true` | 是否自动推送 |
| `pollSeconds` | `15` | 指纹轮询间隔 |
| `debounceSeconds` | `4` | 变化后静默多久再推送 |
| `layout` | `workspaces` | `workspaces` → `workspaces/<工作区名>/…`；`root` → 仓库根目录 |
| `remoteRoot` | `''` | 非空时固定远端前缀，覆盖 `layout` |
| `exclude` | 见 patch | 相对 `.dsh` 的排除 glob；默认排除 `sessions/`、`storages/`、`.credentials*`、`node_modules/` 等 |
| `maxFileBytes` | 25 MiB | 单文件上限，超过则跳过并在结果里列出 |
| `roots` | `[]` | 额外要监视的绝对路径 |

## 使用与限制

1. 写好 token（或调用 `dsh_backup_set_token`）。
2. 让 agent 调 `dsh_backup_push`，或直接用 `/dsh-backup push` 做第一次全量备份。
3. 之后编辑 `.dsh` 下的文件，插件会在静默期后自动提交。
4. 换机器或删了本地技能时，用 `dsh_backup_pull`（必要时加 `prune`）恢复。

限制：

- 只备份工作区里的 `<工作区>/.dsh`，不含 `$DSH_HOME`（那里有 `.credentials.yaml`、会话存档等敏感/易变内容）。
- 自动同步失败只记录在状态里，不会主动打断对话；用 `dsh_backup_status` 或 `/dsh-backup status` 查看。
- 首次全量推送按文件数消耗 GitHub API 请求（每个文件 1 次 blob 上传）。之后的同步只处理变化文件。
- `dsh_backup_auto` 的开关在 Host 进程重启后回到配置值。
