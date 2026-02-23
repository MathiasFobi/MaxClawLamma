# Tools

## Web Search (Brave)

Add a Brave Search API key to enable web search for the agent:

```json
{
  "tools": {
    "web": {
      "search": { "apiKey": "YOUR_BRAVE_KEY", "maxResults": 5 }
    }
  }
}
```

## Command Execution (exec)

Allow the agent to run shell commands:

```json
{
  "tools": {
    "exec": { "timeout": 60 }
  },
  "restrictToWorkspace": false
}
```

- `timeout`: max seconds per command
- `restrictToWorkspace`: if `true`, commands are restricted to the agent workspace directory
