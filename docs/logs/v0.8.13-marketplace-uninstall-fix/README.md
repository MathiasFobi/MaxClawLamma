# 2026-02-23 v0.8.13-marketplace-uninstall-fix

## 背景 / 问题

- Marketplace 点击 Uninstall 时返回 `MANAGE_FAILED`，报错 `Plugin not found`。
- 触发条件：请求 `id` 与真实插件 ID 不一致（例如 unscoped id），但 `spec` 是正确的 npm 规范名。

## 迭代完成说明（改了什么）

- `packages/nextclaw-server/src/ui/router.ts`
  - `resolvePluginManageTargetId` 新增 `spec` 兜底匹配：当 `id` 无法解析时，使用 `spec` 映射到真实插件 ID。
- `packages/nextclaw-server/src/ui/router.marketplace-manage.test.ts`
  - 新增用例：当 `id` 不可解析但 `spec` 正确时，仍可正确映射并执行 disable。

## 测试 / 验证 / 验收方式

执行命令：

```bash
pnpm build
pnpm lint
pnpm tsc
```

API 冒烟（在临时目录，不写仓库）：

```bash
TMP_HOME=$(mktemp -d /tmp/nextclaw-market-uninstall.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" pnpm -C packages/nextclaw dev:build serve --ui-port 18999

# 观察点：禁用/卸载请求不会因为 id 解析失败而报错
curl -sf http://127.0.0.1:18999/api/marketplace/installed
curl -sf -X POST http://127.0.0.1:18999/api/marketplace/manage \
  -H 'content-type: application/json' \
  -d '{"type":"plugin","action":"disable","id":"channel-plugin-discord","spec":"@nextclaw/channel-plugin-discord"}'

rm -rf "$TMP_HOME"
```

## 发布 / 部署方式

- 若需发布，按流程执行：
  1. `pnpm changeset`
  2. `pnpm release:version`
  3. `pnpm release:publish`
- 本次不涉及数据库变更，无 migration 需求。

## 用户 / 产品视角的验收步骤

1. 进入 UI 的 Marketplace 页面。
2. 对存在 `id`/`spec` 不一致的插件执行 `Uninstall`。
3. 确认不再出现 `Plugin not found`/`Failed to fetch`，卸载成功。

## 影响范围 / 风险

- 影响范围：`@nextclaw/server`、`nextclaw`。
- Breaking change：否。
- 风险：仅增加解析兜底逻辑，风险低。
