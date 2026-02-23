# Cron & Heartbeat

## Cron Jobs

Schedule one-off or recurring tasks. The agent receives the message at the scheduled time.

### List Jobs

```bash
nextclaw cron list
```

### Add a One-Time Job

```bash
nextclaw cron add -n "reminder" -m "Stand up and stretch" --at "2026-02-15T09:00:00"
```

### Add a Recurring Job

```bash
nextclaw cron add -n "daily-summary" -m "Summarize yesterday" -c "0 9 * * *"
```

### Manage Jobs

```bash
nextclaw cron remove <jobId>
nextclaw cron enable <jobId>
nextclaw cron enable <jobId> --disable
nextclaw cron run <jobId>          # Run once now
nextclaw cron run <jobId> --force  # Run even if disabled
```

## Heartbeat

When the gateway is running, `HEARTBEAT.md` in the workspace is checked every 30 minutes. If it contains actionable tasks, the agent will process them.

Keep the file empty (or with only comments) to skip heartbeat API calls.
