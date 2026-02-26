# 2026-02-26 v0.0.1-docs-root-locale-redirect

## 迭代完成说明（改了什么）

- 文档站根路由 `/` 改为自动语言重定向，不再默认停留“选择语言”中间页。
- 重定向策略：
- 优先使用用户已访问语言（`localStorage: nextclaw.docs.locale`）。
- 其次使用浏览器语言（`zh*` -> `/zh/`，其它 -> `/en/`）。
- 无 JS 场景保留根页兜底手动链接（English / 简体中文）。
- 修改文件：
- `apps/docs/.vitepress/config.ts`
- `apps/docs/index.md`

## 测试 / 验证 / 验收方式

- Docs 构建验证：
- `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/docs build`
- 全量验证（按规则）：
- `PATH=/opt/homebrew/bin:$PATH pnpm build`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- 冒烟验证：
- 访问 `https://docs.nextclaw.io/`，确认自动跳转到语言站点（`/en/` 或 `/zh/`）。
- 访问 `https://docs.nextclaw.io/en/` 后再打开 `/`，确认优先回到 `/en/`。
- 访问 `https://docs.nextclaw.io/zh/` 后再打开 `/`，确认优先回到 `/zh/`。

## 发布 / 部署方式

- 本次仅 docs 前端行为改动，无后端/数据库变更：
- 远程 migration：不适用。
- 发布命令：
- `PATH=/opt/homebrew/bin:$PATH pnpm deploy:docs`

## 用户 / 产品视角的验收步骤

1. 打开 `https://docs.nextclaw.io/`，确认不再出现语言选择中间页，直接进入某个语言文档。
2. 在页面中切换语言后刷新根路径 `/`，确认会记住并进入最近使用语言。
3. 清空站点本地存储后再访问 `/`，确认按浏览器语言自动进入对应语言版本。
