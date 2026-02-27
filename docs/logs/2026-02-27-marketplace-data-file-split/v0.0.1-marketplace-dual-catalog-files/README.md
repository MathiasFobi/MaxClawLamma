# 2026-02-27 v0.0.1-marketplace-dual-catalog-files

## 迭代完成说明（改了什么）

- Marketplace 数据文件从单文件 `catalog.json` 拆分为两个独立业务文件：
  - `workers/marketplace-api/data/plugins-catalog.json`
  - `workers/marketplace-api/data/skills-catalog.json`
- Worker 数据加载逻辑调整为分别读取两份 catalog 并在运行时组装快照。
- catalog 校验脚本调整为双文件校验，并保留跨文件唯一性检查（id/slug/install spec）。
- CI 触发条件与部署文档同步更新为双 catalog 文件。
- 删除旧文件 `workers/marketplace-api/data/catalog.json`，避免回退为混合存储。

## 测试 / 验证 / 验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api validate:catalog`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api tsc`
- 冒烟（本地 wrangler）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api dev --port 8790`
  - `curl -fsS http://localhost:8790/health`
  - `curl -fsS 'http://localhost:8790/api/v1/plugins/items?page=1&pageSize=2'`
  - `curl -fsS 'http://localhost:8790/api/v1/skills/items?page=1&pageSize=2'`

## 发布 / 部署方式

- 本次仅 Marketplace worker 数据文件与读取逻辑调整，不涉及数据库 migration。
- 通过既有流程发布：`validate:catalog -> build/lint/tsc -> wrangler deploy`。
- GitHub Actions 会在双 catalog 文件变更时自动触发同步部署。

## 用户 / 产品视角的验收步骤

1. 在仓库确认数据已拆分为 `plugins-catalog.json` 与 `skills-catalog.json` 两份文件。
2. 启动 worker 后访问插件列表接口，确认返回插件数据。
3. 访问技能列表接口，确认返回技能数据。
4. 修改其中一个 catalog 文件并重新校验，确认仅影响对应业务域数据。
