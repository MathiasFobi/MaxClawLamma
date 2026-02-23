# Troubleshooting

## Common Issues

### Service won't start
- Run `nextclaw status --json` to check if a stale process is holding the port
- Use `nextclaw status --fix` to clear stale service state
- Check `~/.nextclaw/logs/service.log` for error details

### Config changes not taking effect
- Most config paths are hot-reloaded automatically (providers, channels, model, tools, plugins)
- UI port changes require `nextclaw restart`
- Check logs for `Config reload:` messages to confirm hot-reload

### Channel not connecting
- Run `nextclaw channels status` to check connection state
- Verify API tokens are correct
- For Telegram behind a firewall, set `"proxy": "http://localhost:7890"`

### Agent not responding
- Run `nextclaw doctor --json` for comprehensive diagnostics
- Verify at least one provider has a valid API key
- Check that the configured model is available on the provider

## Diagnostics

```bash
nextclaw status --json    # Machine-readable status (exit 0=healthy, 1=degraded, 2=stopped)
nextclaw status --verbose # Detailed output
nextclaw doctor --json    # Full diagnostics
nextclaw doctor --fix     # Auto-fix common issues
```

## Silent Reply Behavior

- If the model response contains `<noreply/>`, no channel reply is sent
- Empty/whitespace responses also result in no reply
