# 2026-02-26 v0.0.1-docs-nav-ia-adjust

## 迭代完成说明（改了什么）

- 调整文档站顶部导航信息架构，解决“选择奇怪/不完整”问题。
- 英文导航更新为：
- `Getting Started`
- `Configuration`
- `Channels`
- `Commands`
- `Roadmap`
- 中文导航更新为：
- `快速开始`
- `配置`
- `渠道`
- `命令`
- `路线图`
- 目标：与文档内容层级（快速开始、功能、参考、项目）保持一致，入口完整且可预期。
- 修改文件：`apps/docs/.vitepress/config.ts`。

## 测试 / 验证 / 验收方式

- Docs 构建：
- `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/docs build`
- 全量验证（按规则）：
- `PATH=/opt/homebrew/bin:$PATH pnpm build`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- 冒烟验证（用户可见）：
- 打开英文/中文任意文档页，确认顶部导航包含上述五个主入口且可正常跳转。

## 发布 / 部署方式

- 本次仅 docs 导航结构改动，无后端/数据库变更：
- 远程 migration：不适用。
- 发布命令：
- `PATH=/opt/homebrew/bin:$PATH pnpm deploy:docs`

## 用户 / 产品视角的验收步骤

1. 访问 `https://docs.nextclaw.io/en/guide/getting-started`，确认顶部显示 `Getting Started / Configuration / Channels / Commands / Roadmap`。
2. 访问 `https://docs.nextclaw.io/zh/guide/getting-started`，确认顶部显示 `快速开始 / 配置 / 渠道 / 命令 / 路线图`。
3. 点击各入口，确认跳转到对应页面，语言下拉与 GitHub 图标仍正常。
