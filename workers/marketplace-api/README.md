# Marketplace API Worker (Read-only)

Cloudflare Worker + Hono 的只读 Marketplace API，用于插件与 Skill 的列表、分页搜索、详情与推荐查询。

## 本地开发

```bash
pnpm -C workers/marketplace-api install
pnpm -C workers/marketplace-api dev
```

## 质量检查

```bash
pnpm -C workers/marketplace-api build
pnpm -C workers/marketplace-api lint
pnpm -C workers/marketplace-api tsc
```

## 部署（仅手动）

> 禁止通过 GitHub Actions 自动部署本 Worker。

```bash
pnpm -C workers/marketplace-api run deploy
```

## 凭证

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

或使用本地 wrangler 登录态。

## 数据来源

- 当前数据文件：`workers/marketplace-api/data/catalog.json`
- 当前模式：数据随 Worker 代码一起发布（手动部署）
