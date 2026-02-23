# v0.8.3-worker-manual-deploy-no-github-actions

## 迭代完成说明（改了什么）

本次迭代针对 Worker 发布流程做了强约束调整，并完成人工部署闭环：

1. 移除 GitHub Actions 的 Worker 自动部署入口：
- 删除 `.github/workflows/deploy-marketplace-worker.yml`

2. 文档改为“仅手动部署”：
- 更新 `docs/workflows/marketplace-worker-deploy.md`
- 更新 `workers/marketplace-api/README.md`
- 明确禁止通过 GitHub Actions 发布 Worker

3. 由当前执行助手直接部署 Worker：
- 已执行 `pnpm -C workers/marketplace-api run deploy`
- 部署到 `https://nextclaw-marketplace-api.15353764479037.workers.dev`

## 测试 / 验证 / 验收方式

### 工程验证（本次执行）

- `pnpm -C workers/marketplace-api build`
- `pnpm -C workers/marketplace-api lint`
- `pnpm -C workers/marketplace-api tsc`

结果：全部通过。

### 线上冒烟（本次执行）

- `curl -sS https://nextclaw-marketplace-api.15353764479037.workers.dev/health`
- `curl -sS 'https://nextclaw-marketplace-api.15353764479037.workers.dev/api/v1/items?page=1&pageSize=20'`

观察点：
- `/health` 返回 `ok: true`。
- `/api/v1/items` 返回 `total=11`（6 个 `@nextclaw/channel-plugin-*` + 5 个 builtin skill）。
- 不包含 `@nextclaw/openclaw-compat` / `@nextclaw/channel-runtime`。

## 发布 / 部署方式

仅允许手动部署，不允许 GitHub Actions 自动部署：

1. 本地执行质量检查：
- `pnpm -C workers/marketplace-api build && pnpm -C workers/marketplace-api lint && pnpm -C workers/marketplace-api tsc`

2. 本地手动部署：
- `pnpm -C workers/marketplace-api run deploy`

3. 发布后线上冒烟：
- `/health`
- `/api/v1/items`

## 用户/产品视角验收步骤

1. 在仓库确认不存在 `.github/workflows/deploy-marketplace-worker.yml`。
2. 查阅部署文档，确认只保留手动部署命令。
3. 打开 Worker 线上地址并访问：
- `https://nextclaw-marketplace-api.15353764479037.workers.dev/health`
- `https://nextclaw-marketplace-api.15353764479037.workers.dev/api/v1/items?page=1&pageSize=20`
4. 验收标准：
- 不再存在自动部署入口。
- Worker 可正常响应并返回预期 marketplace 数据。
