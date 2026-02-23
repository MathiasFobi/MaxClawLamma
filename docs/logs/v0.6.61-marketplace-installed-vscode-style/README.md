# v0.6.61-marketplace-installed-vscode-style

## 迭代完成说明（改了什么）

本次迭代将 Marketplace 体验向 VSCode 插件市场对齐，重点补齐“已安装视图”与“安装状态可见性”：

1. 后端新增已安装查询接口：
- `GET /api/marketplace/installed`
- 返回：
  - `pluginSpecs`（已安装插件标识集合）
  - `skillSpecs`（已安装 skill slug 集合）
  - `records`（结构化已安装记录）

2. 前端新增已安装数据链路：
- `src/api/marketplace.ts` 新增 `fetchMarketplaceInstalled`
- `src/hooks/useMarketplace.ts` 新增 `useMarketplaceInstalled`
- 安装成功后会 `invalidate marketplace-installed`，页面可自动刷新状态

3. Marketplace 页面升级为 VSCode 风格状态视图：
- 顶部 tabs：`Marketplace` / `Installed`
- 卡片展示 `Installed` 徽标
- 已安装项按钮显示 `Installed`（禁用）
- Installed 视图仅展示本页可识别为已安装的项

4. 后端路由结构重构：
- Marketplace 查询/安装逻辑拆分为独立函数（可维护性提升，降低耦合）

## 测试 / 验证 / 验收方式

### 工程验证（已执行）

- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-server lint`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui lint`

说明：UI 包现存历史 lint warning（max-lines），本次未新增 error。

### 冒烟验证（已执行，隔离环境）

使用临时 `NEXTCLAW_HOME=/tmp/...` 启动：

- `NEXTCLAW_HOME=/tmp/... pnpm -C packages/nextclaw dev:build ui --port 18892`

验证步骤：

1. `GET /api/marketplace/installed`
- 初始返回 skill 安装列表与空 pluginSpecs（符合临时环境预期）

2. 构造临时本地插件包并调用安装接口：
- `POST /api/marketplace/install`
- 返回 `ok: true`，且包含 CLI 安装输出

3. 再次 `GET /api/marketplace/installed`
- `pluginSpecs` 出现新增插件标识，证明“安装 -> 状态可见”链路生效

4. 测试完成后清理临时目录与文件。

## 发布 / 部署方式

- 本次改动为本地 UI/API 接入与状态增强，无需单独发布 Worker。
- 若需要发布，按项目既有发布流程执行。
- Worker 地址仍支持环境变量覆盖：
  - `NEXTCLAW_MARKETPLACE_API_BASE`

## 用户/产品视角验收步骤

1. 启动 UI：`nextclaw ui --port 18891`
2. 打开 `http://127.0.0.1:18891/marketplace`
3. 观察：
- 顶部有 `Marketplace / Installed` tabs
- 已安装项显示 `Installed` 徽标
- 已安装项按钮不可重复安装（显示 `Installed`）
4. 执行安装后确认：
- 卡片状态更新为已安装
- 切到 `Installed` tab 可看到对应条目（若 catalog 中存在该 spec）

验收通过标准：
- 用户可快速区分“可安装 / 已安装”
- 安装后状态可见且自动刷新
- 交互行为与 VSCode 插件市场核心心智一致
