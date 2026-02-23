# v0.8.2-marketplace-real-data-installed-domain

## 迭代完成说明（改了什么）

本次迭代聚焦把 Marketplace / Installed 做到“可安装、可管理、无假数据、对齐 NextClaw 管理域”。

1. **数据源职责落地**
- `marketplace`：继续来自 Cloudflare Worker（Server 代理 `/api/v1/items` / `/api/v1/recommendations`）。
- `installed`：来自 NextClaw 本地真实状态：
  - 插件：`buildPluginStatusReport + config.plugins.installs/entries`。
  - 技能：`SkillsLoader`（workspace + builtin 可见域）。

2. **禁止假数据 + 兼容过滤**
- Server 代理层剥离 Worker 返回中的 `metrics`，UI 不接触安装量等伪指标。
- 对 Worker 数据增加 **NextClaw 兼容过滤**：
  - plugin 仅保留 `@nextclaw/channel-plugin-*`（`install.kind = npm`）。
  - skill 仅保留 `install.kind = builtin` 且在 NextClaw 可识别技能集合中的项。
- 解决了旧 catalog 中 `@nextclaw/openclaw-compat` / `@nextclaw/channel-runtime` 这类“可展示但不可安装”问题。

3. **Installed 视图与 VSCode 风格状态对齐**
- Installed 不再只看当前 marketplace 页面，而是以本地记录为准渲染。
- 记录包含并展示 `enabled` / `runtimeStatus`。
- 插件按 `id` 去重，解决同一插件多来源重复导致的状态错乱。
- `source` 信息不再默认展示，仅保留 hover/title 提示。

4. **管理能力补齐（UI + API）**
- 新增并打通 `POST /api/marketplace/manage`：
  - plugin：`enable` / `disable` / `uninstall`
  - skill：`uninstall`
- UI Installed 卡片新增操作按钮；内置/bundled 插件默认不展示卸载（仅可 enable/disable），避免无效卸载操作。
- `install` 请求携带 `kind`，支持 builtin 技能安装路径。

5. **内置 skill 安装健壮性修复**
- 当技能已在 workspace（即使 builtin 被同名 workspace 覆盖）时，`skills install` 返回“已安装”而非报错 `Builtin skill not found`。

## 测试 / 验证 / 验收方式

### 工程验证（本次执行）

- `pnpm -C packages/nextclaw-server build`
- `pnpm -C packages/nextclaw-server lint`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-ui build`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw build`
- `pnpm -C packages/nextclaw lint`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C workers/marketplace-api build`
- `pnpm -C workers/marketplace-api lint`
- `pnpm -C workers/marketplace-api tsc`

> 结果：全部通过；存在历史 `max-lines` lint warning（非本次引入）。

### 冒烟验证（本次执行）

在隔离目录执行，避免写入仓库目录：

1. 启动本地 Worker（模拟 Cloudflare 数据源）
- `pnpm -C workers/marketplace-api dev --port 18931`

2. 启动 NextClaw（隔离 HOME）
- `NEXTCLAW_HOME=/tmp/nextclaw-market-smoke-xxxxxx NEXTCLAW_MARKETPLACE_API_BASE=http://127.0.0.1:18931 pnpm -C packages/nextclaw dev:build serve --ui-port 18905`

3. 关键 API 验证
- `GET /api/marketplace/items?page=1&pageSize=20`
  - 结果：`total=11`，包含 6 个 channel-plugin + 5 个 builtin skill。
  - 结果：不包含 `@nextclaw/openclaw-compat` / `@nextclaw/channel-runtime`。
- `POST /api/marketplace/install`（plugin）成功。
- `POST /api/marketplace/manage`（plugin disable/enable/uninstall）全部成功。
- `GET /api/marketplace/installed` 返回记录含 `enabled` / `runtimeStatus`。
- `POST /api/marketplace/install`（builtin skill）在已存在时返回“Installed skill: weather”（幂等）。
- `POST /api/marketplace/manage`（skill uninstall）成功。

4. 兼容兜底验证（默认远端 worker）
- 在未设置 `NEXTCLAW_MARKETPLACE_API_BASE` 时，旧远端 catalog 中不兼容项会被过滤，不再展示假插件。

## 发布 / 部署方式

本次变更涉及 `marketplace-api worker + nextclaw-server + nextclaw-ui + nextclaw`，建议按以下闭环执行：

1. 部署 Worker（确保线上 catalog 为本次已修正内容）。
2. 发布 `@nextclaw/server`、`@nextclaw/ui`、`nextclaw`。
3. 发布后线上冒烟：
- `/api/marketplace/items`：仅展示可安装的 nextclaw skills/plugins。
- `/api/marketplace/install`：随机 1 个插件安装成功。
- `/api/marketplace/manage`：disable/enable/uninstall 生效。

## 用户/产品视角验收步骤

1. 打开 `/marketplace`：
- 不再出现下载量/安装量等伪指标。
- 不应出现 `openclaw-compat` 这类非插件包。

2. 在 Marketplace 页面执行安装：
- 点击安装应成功（至少 1 个插件实测通过）。

3. 切换到 Installed：
- 本地已安装项完整可见（不依赖当前 catalog 页）。
- 每个项可看到启用状态（Enabled/Disabled）与运行状态。

4. 执行管理动作：
- 插件可 `Disable/Enable`；非 bundled 插件可 `Uninstall`。
- skill 可 `Uninstall`。

5. 验收通过标准：
- Marketplace 仅展示 NextClaw 可安装项。
- Installed 与本地真实状态一致。
- install/manage 全链路可用且验证通过。
