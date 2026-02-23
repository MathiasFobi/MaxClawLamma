# v0.6.60-marketplace-ui-worker-integration

## 迭代完成说明（改了什么）

本次迭代完成了前端 Marketplace 页面与只读 Worker 的接入，并打通“搜索/推荐/安装”闭环：

1. 后端 UI API（`@nextclaw/server`）新增 Marketplace 能力：
- 只读查询代理：
  - `GET /api/marketplace/items`
  - `GET /api/marketplace/items/:slug`
  - `GET /api/marketplace/recommendations`
- 安装接口：
  - `POST /api/marketplace/install`

2. 安装接口接入现有 CLI 能力（不重复实现安装逻辑）：
- 在 `nextclaw` 服务运行时，通过子进程调用现有 CLI 子命令：
  - `nextclaw plugins install <spec>`
  - `nextclaw skills install <slug>`
- API 层仅负责参数校验、错误透传与结果包装。

3. 前端 UI 新增 Marketplace 页面：
- 新增路由：`/marketplace`
- 侧边栏新增 Marketplace 导航入口
- 页面支持：
  - 关键词搜索
  - 类型过滤（plugin/skill）
  - 排序（relevance/updated/downloads）
  - 分页
  - 推荐区展示
  - 一键安装（调用本地 `/api/marketplace/install`）

4. 前端抽象：
- 新增 API 模块：`src/api/marketplace.ts`
- 新增 Hook 模块：`src/hooks/useMarketplace.ts`
- 新增类型定义（Marketplace 相关 API 类型）

## 测试 / 验证 / 验收方式

### 工程验证（已执行）

- 定向验证：
  - `pnpm -C packages/nextclaw-server tsc`
  - `pnpm -C packages/nextclaw-server lint`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm -C packages/nextclaw-ui lint`
  - `pnpm -C packages/nextclaw tsc`
  - `pnpm -C packages/nextclaw lint`

- 全仓验证：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`

说明：仓库存在历史 lint warning（max-lines 系列），非本次改动引入；本次新增文件已通过类型与语法校验。

### 冒烟验证（已执行）

为遵循“冒烟不写仓库目录”规则，使用临时 `NEXTCLAW_HOME=/tmp/...` 运行。

1. 启动本地 UI/API：
- `NEXTCLAW_HOME=/tmp/... pnpm -C packages/nextclaw dev:build ui --port 18891`

2. 查询验证：
- `GET /api/marketplace/items?page=1&pageSize=2&q=runtime` 返回 200 + 分页数据
- `GET /api/marketplace/recommendations?scene=default&limit=2` 返回 200 + 推荐数据

3. 安装链路验证：
- 使用临时本地插件包（含 `openclaw.extensions` + `openclaw.plugin.json`）调用：
  - `POST /api/marketplace/install`
- 返回 `ok: true`，并返回 CLI 安装输出，证明“前端按钮 -> 本地 API -> 现有 CLI 安装命令”链路可用。

4. 冒烟完成后已清理临时目录与测试文件。

## 发布 / 部署方式

- 本次改动主要为本地 UI/API 与前端接入，不需要额外发布 Cloudflare Worker（Worker 已在上一迭代发布）。
- 若需要发版，按项目既有发布流程执行；本次改动随 `nextclaw` 与 UI 版本发布生效。
- 线上 Worker 地址配置可通过环境变量覆盖：
  - `NEXTCLAW_MARKETPLACE_API_BASE`

## 用户/产品视角验收步骤

1. 启动 NextClaw UI（本地）：`nextclaw ui --port 18891`
2. 打开 `http://127.0.0.1:18891/marketplace`
3. 在页面执行：
- 输入关键词搜索（例如 `runtime`）
- 切换类型筛选（plugin/skill）
- 切换排序（relevance/updated/downloads）
- 翻页
4. 点击任意条目 `Install`：
- 观察成功 toast
- 可在返回输出中看到 CLI 安装日志
5. 验收通过标准：
- 页面可稳定查询/推荐/分页
- 安装按钮触发真实 CLI 安装流程
- 错误场景可返回明确错误信息（而不是静默失败）
