# dsh-git-backup

[![CI](https://github.com/Bigdusk/dsh-git-backup/actions/workflows/ci.yml/badge.svg)](https://github.com/Bigdusk/dsh-git-backup/actions/workflows/ci.yml)

> DeepSeek Harness 插件：把工作区的 `.dsh` 目录自动备份到 GitHub，并支持**预览 / 单文件回滚 / 撤销回滚**、参与备份的工作区管理与**不依赖 DSH 的灾难恢复脚本**。

`.dsh` 是 DSH 工作区里的技能/插件目录。这个插件把它当作版本化数据来管理：改动静默几秒后自动提交，随时可以挑一个历史版本恢复，也可以在新机器上一条命令拉回来。

- 不依赖本机 `git`：全部走 GitHub REST API（Windows 上也不需要装 git）。
- 增量提交：按 Git blob SHA 逐文件比对，只上传变化的文件，一次同步通常 1 个 commit。
- 覆盖前保护：拉取/回滚会先自动把当前改动推成 `autosave-before-restore` 提交，不删远端文件，不会丢未备份的改动。

## 功能

| 能力 | 说明 |
|---|---|
| 自动备份 | 每 15s 扫描工作区 `.dsh` 指纹，变化后静默 4s 再推送；自动创建私有仓库/分支 |
| 版本预览 | 回滚前先算「将写入 N / 将删除 M / 不变 K」并列出文件，不动磁盘 |
| 单文件恢复 | 从任意历史版本只恢复某个 `SKILL.md` 或某个目录 |
| 撤销回滚 | 一键回到上一次回滚之前的状态 |
| 版本详情 | 每个版本改动了哪些文件、增删多少行 |
| 工作区管理 | 启用/停用/添加工作区；停用后不参与自动同步但保留历史 |
| 冲突保护 | 远端 HEAD 被其他设备改动时自动提交会中止并提示，避免静默覆盖；push/pull/rollback 同一工作区串行 |
| 内容改动 | 按版本/单文件查看 unified patch（绿加红删），回滚前能看清具体改了什么 |
| 仓库体检 | 仓库大小、远端/本地文件数、逐文件一致性（不一致 / 未备份 / 远端多出） |
| 可视化配置 | 仓库、分支、轮询间隔、远端布局、自动同步都能在界面里改 |
| token 续期提醒 | 读取 GitHub 响应里的过期时间，剩余 14 天内提示 |
| 灾难恢复 | `recover.mjs` 用普通 Node 直接把备份拉回任意目录，不需要 DSH 运行时 |

## 界面

- **自动同步默认开启，可关闭**：默认静默自动提交；配置卡的拨杆**立即生效、无需重启**（偏好存 `prefs.json`）。关掉后头部「立即提交 / 拉取」按钮用来手动同步，页面会提示"自动同步已暂停"。
- **「快照」视图**：位于「对话」「轨迹」同一排页签（这个名字指版本快照，备份本身是后台自动行为）。整页是一块 **Web3 深色玻璃面板**：霓虹渐变光斑背景、渐变主按钮、玻璃卡片、渐变标题；顶部有 4 个指标块（历史版本 / 工作区 / 轮询 / token 状态）与状态胶囊，版本行固定四列网格对齐、最新行有渐变光条，加载时显示 shimmer 骨架。动效兼容 `prefers-reduced-motion`。

## 安装

在 DSH 里从本地目录安装（插件会链接到当前 profile）：

1. 打开 **Plugins → Add plugin**，选择本目录；或让 agent 用 `plugin_manager` 的 `install_bundle` 安装该绝对路径。
2. 打开「快照」页，点右上角 **「设置 token」**，粘贴 token 保存；或手工写进 `%USERPROFILE%\.dsh\.env`：

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxx
```

token 需要 `repo` 权限（classic），或 fine-grained 的 Contents: Read and write + Administration: Read and write（用来自动建仓）。

## 快速开始

1. 保存 token 后自动开始首次全量备份（仓库默认 `dsh-backup`，私有，自动创建）。
2. 之后编辑 `.dsh` 下的文件，插件会自动提交。
3. 需要回退时打开「快照」页 → 选版本 → 预览 → 回滚（或只恢复其中某个文件）。
4. 换机器：`node recover.mjs --repo <owner>/dsh-backup --target <工作区目录>`。

## 命令与工具

斜杠命令（不经模型，「快照」视图调用的就是它；日常同步不需要手动执行）：

```
/dsh-backup status | push | pull
/dsh-backup history [n] | detail <ref> | preview <ref>
/dsh-backup rollback <序号|提交号> [--local] [--only <路径>] | undo
/dsh-backup workspaces | workspace <add|remove|enable|disable> <路径>
/dsh-backup auto [on|off] | token <token> | config [set <键> <值>]
```

模型工具：`dsh_backup_status`、`dsh_backup_push`、`dsh_backup_pull`、`dsh_backup_history`、`dsh_backup_rollback`、`dsh_backup_workspaces`、`dsh_backup_set_token`、`dsh_backup_auto`。

## 灾难恢复（不依赖 DSH）

```powershell
# 看仓库里有哪些工作区备份
node recover.mjs --repo Bigdusk/dsh-backup --list

# 恢复到某个目录（默认前缀 workspaces/<目录名>）
node recover.mjs --repo Bigdusk/dsh-backup --target "C:\Users\me\Desktop\T"

# 其它前缀 / 只看不写 / 顺带删除远端已不存在的文件
node recover.mjs --repo owner/name --target D:\work\proj --remote-root workspaces/T --dry-run --prune
```

token 默认从 `%USERPROFILE%\.dsh\.env` 读 `GITHUB_TOKEN`，可用 `--token-env`、`--home` 覆盖。

## 配置

默认值写在 [`cordis.patch.yml`](./cordis.patch.yml)（仓库、分支、轮询间隔、包含/排除规则、单文件上限等）。界面里的「仓库配置」区会把这些写回 profile 配置，保存后插件行重启一次生效。

常用项：`repo`、`repoName`、`branch`、`layout`（`workspaces` / `root`）、`remoteRoot`、`pollSeconds`、`debounceSeconds`、`autoSync`、`exclude`、`maxFileBytes`。

## 安全

- token 只存在 `$DSH_HOME/.env`（或环境变量），不进插件配置、不进会话日志：`/dsh-backup token` 以 `recordInput: false` 注册，界面输入框是密码框且保存后立即清空。
- 只备份 `<工作区>/.dsh`，**不备份** `$DSH_HOME`（那里有 `.credentials.yaml`、会话存档）；默认排除 `.env`、`.credentials*`、`sessions/`、`storages/`、`node_modules/`。
- 回滚/拉取前自动保留现场，失败默认中止。

## 开发与发布

```powershell
# 零依赖测试套件（node:test，无需 npm install）
node --test test

# 把当前工作树发布到 GitHub（首次会建仓，之后重复运行即更新）
node scripts/publish.mjs --repo Bigdusk/dsh-git-backup
```

CI 在 `.github/workflows/ci.yml`：Linux/Windows × Node 20/22 跑同一套 `node --test test`。

目录结构：

```
index.js           插件装配（轮询、工具、命令、配置写入）
client.js          「快照」视图（React，无构建步骤；含手动提交与自动同步开关）
lib/engine.js      Git Data API 同步、回滚、工作区注册表、哈希缓存、串行锁
lib/github.js      GitHub REST 客户端（重试、token 过期头）
lib/commands.js    /dsh-backup 命令
lib/tools.js       模型工具
recover.mjs        独立灾难恢复脚本
test/              node:test 套件（engine / commands / client / util）
cordis.patch.yml   bundle patch 与默认配置
docs/DETAIL.md     完整设计与行为说明
```

### 性能与并发

- **哈希缓存**：`$DSH_HOME/dsh-git-backup/blob-cache.json` 记录 `mtime + size → git blob sha`；未变化的文件不再读盘，只在上传/比对失败时读取。
- **注册表并发保护**：`workspaces.json` 的读改写走跨进程锁文件 + 原子替换，多个实例同时改不会互相覆盖；30 秒以上的陈旧锁会被回收。
- **串行锁**：同一工作区的 push / pull / rollback 串行执行，不同工作区并行。

## 许可证

[MIT](./LICENSE)
