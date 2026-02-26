# 2026-02-26 v0.0.1-landing-i18n

## 迭代完成说明（改了什么）

- landing 国际化从“同 URL 运行时切换”升级为“路由级 i18n”：
- `/` 只做语言重定向（基于 `localStorage(nextclaw.landing.locale)` 和浏览器语言）
- `/en/`、`/zh/` 为独立可索引页面
- 新增多入口构建配置与页面入口：
- `apps/landing/vite.config.ts`
- `apps/landing/en/index.html`
- `apps/landing/zh/index.html`
- 语言切换改为路由跳转（`/en/` <-> `/zh/`），并保留语言持久化。
- 每个语言页面独立维护 SEO 元信息：
- `title`、`description`、`canonical`
- `hreflang`
- `og:*`、`twitter:*`
- `application/ld+json`
- 补齐站点索引与 AI 入口信息：
- `apps/landing/public/sitemap.xml` 增加 `/`、`/en/`、`/zh/` 与 hreflang
- `apps/landing/public/llm.txt` 增加中英文 landing/docs 入口

## 测试 / 验证 / 验收方式

- Landing 构建：
- `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/landing build`
- 全量验证（按规则）：
- `PATH=/opt/homebrew/bin:$PATH pnpm build`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- 冒烟验证（用户可见）：
- 本地预览：`pnpm --filter @nextclaw/landing preview --host 127.0.0.1 --port 4173`
- 访问 `/`，确认自动重定向到 `/en/` 或 `/zh/`
- 访问 `/en/` 与 `/zh/`，确认文案、按钮、docs 跳转与语言一致
- 切换语言后确认 URL 变化且刷新后保持当前语言

## 发布 / 部署方式

- 本次仅 landing 前端页面改动，无后端/数据库变更。
- 远程 migration：不适用。
- 发布命令：`PATH=/opt/homebrew/bin:$PATH pnpm deploy:landing`

## 用户 / 产品视角的验收步骤

1. 打开 `https://nextclaw.io/`，确认会自动进入 `/en/` 或 `/zh/`。
2. 在 `/en/` 页面检查英文文案、按钮与 docs 链接指向 `https://docs.nextclaw.io/en/`。
3. 切换为中文后确认跳转到 `/zh/`，并检查中文文案与 docs 链接指向 `https://docs.nextclaw.io/zh/`。
4. 刷新当前页面，确认语言保持不变（localStorage 生效）。
5. 回到根路径 `/`，确认仍按已保存语言重定向。
