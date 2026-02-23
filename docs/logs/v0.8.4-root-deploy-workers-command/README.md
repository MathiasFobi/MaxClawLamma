# v0.8.4-root-deploy-workers-command

## 迭代完成说明（改了什么）

本次迭代在仓库根目录新增了一键部署 Worker 的统一命令：

- 根脚本新增：`deploy:workers`
- 命令内容：`pnpm -r --filter "./workers/*" run deploy`
- 作用：按 workspace 过滤 `workers/*` 下所有 Worker，并顺序执行各自 `deploy` 脚本。

变更文件：
- `package.json`

## 测试 / 验证 / 验收方式

### 工程验证（本次执行）

- `pnpm -C workers/marketplace-api build`
- `pnpm -C workers/marketplace-api lint`
- `pnpm -C workers/marketplace-api tsc`

结果：全部通过。

### 命令可用性验证（本次执行）

- `pnpm deploy:workers`

结果：
- 根命令可正确触发 `workers/*` 下 Worker 的部署脚本。
- 本次线上部署地址：`https://nextclaw-marketplace-api.15353764479037.workers.dev`
- 本次 Version ID：`45fa8d78-b64a-4127-af11-5e7bd84c4d29`

## 发布 / 部署方式

后续统一使用根命令进行 Worker 发布：

```bash
pnpm deploy:workers
```

如只发布单个 Worker，可继续用原命令：

```bash
pnpm -C workers/marketplace-api run deploy
```

## 用户/产品视角的验收步骤

1. 在仓库根目录执行：`pnpm deploy:workers`。
2. 确认输出出现 `workers/*` 下各 Worker 的部署日志。
3. 打开对应 Worker 线上地址进行健康检查（如 `/health`）。
4. 验收通过标准：可通过一条根命令完成所有 Worker 的部署触发。
