# Docs Single Source Policy

## Goal

Prevent dual-maintenance between repository docs and docs-site pages.

## Source-of-truth split

- Public documentation pages: `apps/docs/**` (VitePress source).
- Internal engineering/process docs: `docs/**` (logs, workflows, designs, PRD, metrics, etc.).

## Hard rules

- Do not keep duplicated content across `docs/` and `apps/docs/`.
- If content is user-facing docs, only edit under `apps/docs/`.
- Repository README and other entry points should link directly to `https://docs.nextclaw.io/...` pages.
- `docs/` keeps only internal project artifacts, not mirrored public docs pages.

## Current canonical mapping

- Roadmap canonical source: `apps/docs/guide/roadmap.md`
- Public URL: `https://docs.nextclaw.io/guide/roadmap`

## Best-practice summary

- Keep one canonical source per document.
- Avoid mirror files and sync scripts unless absolutely necessary.
- Keep structure minimal: content in one place, links everywhere else.
