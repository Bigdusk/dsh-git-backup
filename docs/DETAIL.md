# GitHub .dsh 备份

把每个工作区的 `.dsh` 文件夹（也就是该项目的技能包）备份到 GitHub，并在检测到变化时自动推送；需要时再一键拉回当前工作区。

插件在 Host 进程里自动完成全部同步，并在 Web 端注册一个会话视图：能力通过八个模型工具、一个斜杠命令和这个「备份」视图暴露；界面不提供手动同步按钮。

## 界面

### 顶部视图页签「备份」

版本回滚和工作区管理注册成会话的第三个 Conversation View（`conversation.view`），和「对话」「轨迹」同一排页签，点过去就是一整页管理界面：

- **版本回滚**区：「刷新」拉取该工作区最近 8 个备份提交，列表显示 `序号 · 短提交号 · 时间 · 提交说明`，每行右侧「回滚」；下方输入框支持版本号或提交号。切到该页签时两个区会自动加载一次。
- **工作区**区：「刷新」列出所有工作区的名称、文件数、启用状态；每行「停用 / 启用」；底部输入框粘贴绝对路径「添加」（等价 `/dsh-backup workspace add <路径>`）。
- 平面化布局：没有卡片边框和嵌套边框，只有「标题 + 一条细分隔线 + 行」；行本身无边框，悬停/聚焦时用 `bg-layer-1` 浮起；输入框是无边框填充色块，聚焦时才出现主色内描边；所有颜色都来自 `--dsw-alias-*` 令牌。

每个版本行右侧有 **详情 / 预览 / 回滚** 三个动作：

- **详情**：列出这个版本改动的文件与增删行数；每个文件后面有「仅恢复」，只把该文件恢复到这个版本。
- **预览**：先算一遍「将写入 N / 将删除 M / 不变 K」并列出文件，**不动磁盘**；预览框里可以「全部回滚」，也可以对单个文件点「仅恢复」。
- **回滚**：直接恢复整个 `.dsh`（也会先自动备份当前改动）。
- 版本区右上角还有 **撤销回滚**：把工作区恢复到上一次回滚之前的状态。

点某行「回滚」＝执行 `/dsh-backup rollback <提交号>`：先把本地 `.dsh` 恢复成那个提交的内容（写入变更文件、删除该版本里没有的本地文件），再推一个新提交，本地与远端保持同步，随后自动刷新列表。

### 同步是自动的（没有手动按钮）

插件默认所有同步都自动进行：每 `pollSeconds` 秒扫描工作区 `.dsh`，发现变化后静默 `debounceSeconds` 秒自动提交。界面上**不提供**「推送 / 拉取 / 自动同步」这类手动同步按钮 —— 「备份」页只负责查看历史、回滚和调整配置。

需要一次性手动操作时，用斜杠命令（`/dsh-backup push`、`/dsh-backup pull` 等）或让 agent 调工具即可，它们与控制条无关。

样式以组件内的 `<style>` 元素渲染（单例 class 前缀 `dshgb-`），卸载时随之移除；配色全部取自宿主主题令牌，明暗主题与字号跟随应用。

视图数据都来自命令产生的会话日志：把 Host 返回的结构化结果（`⟦dshb:{…}⟧` 标记）从 `command/done` 事件里解析出来渲染，所以这些结果同时也会作为命令记录出现在「对话」里——这正是「会话日志是唯一真相」的代价，不做额外隐藏通道。

### 本地保护（覆盖前先保存）

拉取和回滚都会重写本地文件。执行前插件会先做一次 **不删除远端文件的自动保存提交**（`autosave-before-restore`）：

- 本地为空或没有差异时完全跳过，不会凭空产生提交；
- 有未推送改动时会先推一个 autosave 提交，所以被覆盖的内容仍能在历史里找回；
- 保存失败时默认中止操作并报错；确实要覆盖可以显式传 `force`（命令里没有强制开关，只有工具/脚本能传，避免误操作）。

### 仓库配置（界面可改）

「备份」页第三个区是仓库配置：仓库 `owner/name`、分支、轮询秒数可以在输入框里改，远端布局（`workspaces/<名字>` 或仓库根）和自动同步用按钮切换，保存后写入 profile 配置并让插件行重启一次生效。对应的命令是 `/dsh-backup config` 与 `/dsh-backup config set <键> <值>`，可配置键：`repo`、`repoName`、`branch`、`layout`、`remoteRoot`、`pollSeconds`、`debounceSeconds`、`autoSync`。

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

配置了 token 时，插件会读取 GitHub 响应里的过期头，token 剩余 14 天内会在「备份」页顶部出现提示条；自动同步失败的也汇总在同一处提示条（并保留在每个工作区的「上次错误」里）。

### 在「备份」页里配置 token 与仓库

「备份」页第三个区「配置」同时承载凭据与仓库设置：

- **GitHub token**：密码输入框 + 「保存 token」，标签处显示当前状态（未配置 / 已配置 / 还有 N 天过期）。保存时把 token 通过 `/dsh-backup token <token>` 交给 Host，Host 先向 GitHub 校验账号再写入 `%USERPROFILE%\.dsh\.env`，随后自动安排一次备份。该命令以 `recordInput: false` 注册，所以 token **不会**进入会话日志、对话流或命令记录的界面文本；保存成功后清空输入框。
- **仓库 / 分支 / 轮询 / 布局 / 自动同步**：见下节。

因为没有手动同步按钮，也不需要常驻控制条，token 输入就放在这个配置区；设置页（「设置 → 插件」）没有会话上下文，无法安全地走会话命令通道保存凭据。

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

斜杠命令：`/dsh-backup status | push | pull | auto [on|off] | token <token> | history [n] | detail <ref> | preview <ref> | rollback <ref> [--local] [--only <路径>] | undo | workspaces | workspace <add|remove|enable|disable> <路径> | config [set <键> <值>]`，不经模型直接执行，控制条按钮和「备份」页调用的就是它。

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

**在界面里设置（推荐）**：「备份」页 → 「配置」区 → GitHub token 密码框粘贴 → 「保存 token」。Host 会先向 GitHub 校验账号，通过后写入 `$DSH_HOME/.env` 的 `GITHUB_TOKEN`，并自动开始备份。

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
- 自动同步失败只记录在状态里，不会弹窗；用 `dsh_backup_status` 或 `/dsh-backup status` 查看。
- 首次全量推送按文件数消耗 GitHub API 请求（每个文件 1 次 blob 上传）。之后的同步只处理变化文件。
- `dsh_backup_auto` 的开关在 Host 进程重启后回到配置值。
