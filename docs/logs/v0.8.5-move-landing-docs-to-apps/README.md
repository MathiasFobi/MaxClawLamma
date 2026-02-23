# v0.8.5-move-landing-docs-to-apps

## 迭代完成说明（改了什么）

本次迭代将应用型项目从 `packages` 目录迁移到 `apps` 目录：

- 目录迁移：
  - `packages/landing` → `apps/landing`
  - `packages/docs` → `apps/docs`
- 工作区配置更新：
  - `pnpm-workspace.yaml` 新增 `apps/*`
  - 根 `package.json` 的 `workspaces` 新增 `apps/*`
- 部署脚本路径更新：
  - `deploy:pages` 输出目录改为 `apps/landing/dist`
  - `deploy:docs` 输出目录改为 `apps/docs/.vitepress/dist`
- 依赖锁文件同步：执行 `pnpm install` 以更新 `pnpm-lock.yaml` 中 importer 路径。

## 测试 / 验证 / 验收方式

### 工程验证（本次执行）

- `pnpm build`
- `pnpm lint`
- `pnpm tsc`

结果：全部通过（存在历史 lint warning，但无 error）。

### 冒烟验证（本次执行）

- `pnpm --filter @nextclaw/landing build`
- `pnpm --filter @nextclaw/docs build`

观察点：
- `@nextclaw/landing` 在新路径 `apps/landing` 下可正常构建并产出 `dist`。
- `@nextclaw/docs` 在新路径 `apps/docs` 下可正常执行 VitePress 构建。

## 发布 / 部署方式

后续 Cloudflare Pages 部署保持根脚本入口不变：

```bash
pnpm deploy:pages
pnpm deploy:docs
```

其中部署产物目录已切换到 `apps`：
- Landing：`apps/landing/dist`
- Docs：`apps/docs/.vitepress/dist`

## 用户/产品视角的验收步骤

1. 在仓库根目录执行 `pnpm --filter @nextclaw/landing build`，确认构建成功。
2. 在仓库根目录执行 `pnpm --filter @nextclaw/docs build`，确认文档站构建成功。
3. 执行 `pnpm deploy:pages` 与 `pnpm deploy:docs`（按需），确认部署命令无路径错误。
4. 验收通过标准：应用项目已归类到 `apps`，且构建与部署流程均可正常运行。
