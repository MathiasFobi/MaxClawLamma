# 2026-02-26 v0.8.20-dev-docs-command

## 迭代完成说明（改了什么）

- 在根 `package.json` 新增命令：
  - `pnpm dev:docs` -> `pnpm --filter @nextclaw/docs dev`
- 目标：从仓库根目录一键启动 docs 开发服务，减少记忆成本与目录切换。

## 测试 / 验证 / 验收方式

- 冒烟测试（用户可见）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm dev:docs -- --host 127.0.0.1 --port 4176`
  - 观察点：VitePress dev server 启动，输出可访问地址（本次为 `http://localhost:5176/`）
- 全仓验证（按规则）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm tsc`

## 发布 / 部署方式

- 本次为脚本命令增强，无后端/数据库变更：
  - 远程 migration：不适用
- 如需发布，按现有流程执行：
  1. `pnpm changeset`
  2. `pnpm release:version`
  3. `pnpm release:publish`

## 用户 / 产品视角的验收步骤

1. 在仓库根目录执行 `pnpm dev:docs`。
2. 打开终端输出地址（默认 VitePress 地址）。
3. 访问文档页面并确认可热更新。

