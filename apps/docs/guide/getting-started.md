# Quick Start

## Installation

```bash
npm i -g nextclaw
```

## Start the Service

Start the gateway + config UI in the background:

```bash
nextclaw start
```

## Open the UI

Open **http://127.0.0.1:18791** in your browser. Set a provider (e.g. OpenRouter) and model in the UI.

## Initialize Workspace

Optionally run `nextclaw init` to create a workspace with agent templates, or chat from the CLI:

```bash
nextclaw agent -m "Hello!"
```

## Stop the Service

```bash
nextclaw stop
```

## What's Next?

- [Configuration](/guide/configuration) — Set up providers, models, and workspace
- [Channels](/guide/channels) — Connect to Discord, Telegram, Slack, and more
- [Commands](/guide/commands) — Full CLI reference
