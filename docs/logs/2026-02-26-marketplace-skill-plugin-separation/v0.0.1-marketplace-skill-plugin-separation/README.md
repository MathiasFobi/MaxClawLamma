# 2026-02-26 v0.0.1-marketplace-skill-plugin-separation

## 迭代完成说明（改了什么）

- Marketplace 页面将 `Plugins / Skills` 提升为一级入口，并与路由绑定：
- `/marketplace/plugins`
- `/marketplace/skills`
- 访问 `/marketplace` 自动重定向到 `/marketplace/plugins`。
- 移除类型 `all` 视图，避免 skill 与 plugin 在同一列表混排。
- 列表查询与已安装列表均按当前路由类型严格过滤，仅显示对应类型数据。
- `Marketplace / Installed` 保留为该类型下的二级范围切换。
- 核心文件：
- `packages/nextclaw-ui/src/App.tsx`
- `packages/nextclaw-ui/src/components/marketplace/MarketplacePage.tsx`

## 测试 / 验证 / 验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- 全量校验（按规则）：
- `PATH=/opt/homebrew/bin:$PATH pnpm build`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm tsc`

## 发布 / 部署方式

- 本次为前端 UI 行为调整，无后端/数据库 schema 变更。
- 远程 migration：不适用。
- 按既有发布流程发布 `nextclaw` 包，或在测试环境更新 UI 产物后重启服务。

## 用户 / 产品视角的验收步骤

1. 打开 `/marketplace/plugins`，确认展示插件列表且 URL 保持该路径。
2. 切换到 `Skills` 一级 Tab，确认 URL 变为 `/marketplace/skills` 且列表只显示 skill。
3. 直接访问 `/marketplace`，确认自动重定向到 `/marketplace/plugins`。
4. 在 `Installed` 二级范围下分别查看 `Plugins/Skills`，确认已安装列表按类型严格分离。
5. 搜索与分页在当前类型路由下生效，不跨类型混合显示。
