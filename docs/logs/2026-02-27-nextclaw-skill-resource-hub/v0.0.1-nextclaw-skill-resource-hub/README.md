# 2026-02-27 v0.0.1-nextclaw-skill-resource-hub

## 迭代完成说明（改了什么）

- 新增内置 skill：`nextclaw-skill-resource-hub`。
- 目标从“仅 OpenClaw 资源”调整为“NextClaw 资源主导 + OpenClaw 与社区扩展资源”。
- 新增资源索引文件：
  - `packages/nextclaw-core/src/agent/skills/nextclaw-skill-resource-hub/references/source-map.md`
- 同步更新内置技能清单：
  - `packages/nextclaw-core/src/agent/skills/README.md`

## 测试 / 验证 / 验收方式

- 构建：`PATH=/opt/homebrew/bin:$PATH pnpm build`
- Lint：`PATH=/opt/homebrew/bin:$PATH pnpm lint`
- 类型检查：`PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- 冒烟（验证 skill 被内置加载器识别）：
  - `cd /tmp && PATH=/opt/homebrew/bin:$PATH node -e "import('file:///Users/peiwang/Projects/nextbot/packages/nextclaw-core/dist/index.js').then(({SkillsLoader})=>{const l=new SkillsLoader('/tmp/nextclaw-skill-smoke');const ok=l.listSkills(false).some(s=>s.name==='nextclaw-skill-resource-hub'&&s.source==='builtin');console.log(ok?'smoke-ok':'smoke-fail');}).catch((e)=>{console.error(e);process.exit(1);})"`
- 观察点：输出 `smoke-ok`。

## 发布 / 部署方式

1. 合并代码。
2. 若随 npm 包发布，按项目发布流程执行：`changeset -> release:version -> release:publish`。
3. 本次仅 skill 资源补充，不涉及数据库或后端 migration。

## 用户 / 产品视角的验收步骤

1. 在 NextClaw 会话中请求“给我 NextClaw 相关 skill 资源清单”。
2. 观察返回内容优先包含 NextClaw 官方资源。
3. 观察返回内容包含 OpenClaw 官方资源与社区资源（如 awesome-openclaw-skills、skills.sh）。
4. 输出应包含可执行建议：直接复用、适配、仅参考三类建议。
