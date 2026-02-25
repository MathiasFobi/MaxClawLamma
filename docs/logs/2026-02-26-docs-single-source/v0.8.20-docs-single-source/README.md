# 2026-02-26 v0.8.20-docs-single-source

## 迭代完成说明（改了什么）

- 采用“极简单一来源”方案，彻底移除双维护中间层：
  - 删除 `docs/ROADMAP.md`
  - 删除 alias/sync 脚本（不再生成镜像文档）
- 明确目录职责：
  - 公开文档唯一来源：`apps/docs/**`
  - 内部工程文档：`docs/**`（logs/workflows/designs/prd/metrics）
- 统一入口链接：
  - `README.md` 的 Roadmap 链接改为 `https://docs.nextclaw.io/guide/roadmap`
- 更新机制文档：
  - `docs/workflows/docs-single-source.md` 明确“禁止 docs 与 apps/docs 重复维护”

## 测试 / 验证 / 验收方式

- 文档构建冒烟（用户可见）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/docs build`
  - 观察点：构建成功，且 `guide/roadmap` 页面正常产出
- 全仓验证（按规则）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm tsc`

## 发布 / 部署方式

- 本次为文档结构治理改动，无后端/数据库变更：
  - 远程 migration：不适用（无后端/DB schema 变更）
- 常规发布流程：
  1. `pnpm changeset`
  2. `pnpm release:version`
  3. `pnpm release:publish`
- 文档站部署：
  - `pnpm deploy:docs`

## 用户 / 产品视角的验收步骤

1. 打开 `apps/docs/guide/roadmap.md`，确认这是唯一 Roadmap 内容源。
2. 打开仓库根 `README.md`，确认 Roadmap 链接直达 docs 站点。
3. 执行 `pnpm --filter @nextclaw/docs build`，确认文档站可正常构建。
4. 打开 `https://docs.nextclaw.io/guide/roadmap`，确认用户访问内容完整一致。
