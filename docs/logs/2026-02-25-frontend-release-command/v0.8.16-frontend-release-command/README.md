# 2026-02-25 v0.8.16-frontend-release-command

## 迭代完成说明（改了什么）

- 新增 `pnpm release:frontend`：前端一键发布（自动创建 UI changeset + 版本号 + 发布）。
- 补充发布文档说明 UI-only shortcut。
- 指令索引同步：`commands/commands.md` 与 `AGENTS.md`。

## 测试 / 验证 / 验收方式

- 本次为发布流程脚本与文档更新，不涉及运行时代码。
- 未单独执行 `build/lint/tsc`；`release:frontend` 内部仍会执行 `release:publish`，包含完整 `release:check`。

## 发布 / 部署方式

- 使用 `pnpm release:frontend` 一键发布前端：
  1. 自动生成 `@nextclaw/ui` + `nextclaw` 的 changeset
  2. 执行 `pnpm release:version`
  3. 执行 `pnpm release:publish`

## 用户 / 产品视角验收步骤

1. 仅修改前端后，运行 `pnpm release:frontend`。
2. 观察输出包含 changeset 生成、version、publish、tag。
3. 验证 NPM 上 `@nextclaw/ui` 与 `nextclaw` 版本已更新。
