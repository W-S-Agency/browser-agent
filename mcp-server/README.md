# Browser Agent - MCP Server

**Provides browser automation tools for WS Workspace**

## Overview

The MCP Server exposes browser automation capabilities as Model Context Protocol tools, enabling WS Workspace to control your browser through natural language.

## Installation

```bash
npm install
npm run build
```

## Running

### As Standalone Server (for testing)

```bash
npm start
```

### As WS Workspace Source (production)

Configured automatically in WS Workspace at:
```
C:\Users\alexa\.craft-agent\workspaces\my-workspace\sources\browser-agent\
```

WS Workspace runs it via stdio transport.

## Configuration

**Environment Variables:**
- `BRIDGE_URL` - WebSocket Bridge URL (default: `http://localhost:18793`)

## Available Tools

### Navigation
- `browser_navigate` - Navigate to URL

### Interaction
- `browser_click` - Click element by selector
- `browser_type` - Type text into input

### Data Extraction
- `browser_extract` - Extract data from elements
- `browser_get_text` - Get text content

### Screenshots
- `browser_screenshot` - Capture page

### JavaScript
- `browser_execute_js` - Execute JavaScript code

### Tab Management
- `browser_list_tabs` - List all tabs
- `browser_switch_tab` - Switch to tab
- `browser_new_tab` - Open new tab
- `browser_close_tab` - Close tab

### Profile Management
- `browser_list_profiles` - List connected profiles

## Tool Schema

All tools follow MCP specification with:
- **name** - Tool identifier
- **description** - What the tool does
- **inputSchema** - JSON Schema for parameters

Example:
```typescript
{
  name: 'browser_navigate',
  description: 'Navigate to a URL in the browser',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to navigate to',
      },
      profileId: {
        type: 'string',
        description: 'Optional profile ID',
      },
    },
    required: ['url'],
  },
}
```

## Communication Flow

```
WS Workspace
    ↓ (stdio MCP)
MCP Server
    ↓ (HTTP API)
WebSocket Bridge
    ↓ (WebSocket)
Chrome Extension
    ↓
Browser
```

## Adding New Tools

1. **Define tool in `src/tools.ts`:**

```typescript
export function createTools(): Tool[] {
  return [
    // ... existing tools
    {
      name: 'browser_my_new_tool',
      description: 'Does something cool',
      inputSchema: {
        type: 'object',
        properties: {
          param1: { type: 'string', description: '...' },
        },
        required: ['param1'],
      },
    },
  ];
}
```

2. **Add execution logic:**

```typescript
export async function executeToolCall(
  toolName: string,
  args: any,
  bridgeClient: BridgeClient
): Promise<any> {
  // ... existing cases
  case 'browser_my_new_tool':
    return await bridgeClient.executeCommand(
      { type: 'my_new_command', params: { param1: args.param1 } },
      args.profileId
    );
}
```

3. **Add command handler in Extension (`extension/background.js`):**

```javascript
async function executeCommand(command) {
  // ... existing cases
  case 'my_new_command':
    return await myNewFunction(targetTabId, params.param1);
}
```

4. **Rebuild:**

```bash
npm run build
```

## Development

### Watch Mode
```bash
npm run watch
```

### Testing Locally
```bash
# Start Bridge Server first
cd ../bridge
npm start

# Then test MCP Server
cd ../mcp-server
npm start
```

Input test commands via stdin (JSON):
```json
{"method":"tools/list"}
{"method":"tools/call","params":{"name":"browser_navigate","arguments":{"url":"https://google.com"}}}
```

## Error Handling

All errors are caught and returned as MCP tool responses:

```json
{
  "content": [{
    "type": "text",
    "text": "{\"error\": \"Error message here\"}"
  }],
  "isError": true
}
```

Common errors:
- **"No browser profile connected"** - Extension not installed/running
- **"Command timeout"** - Page slow to load or selector not found
- **"Bridge Server unreachable"** - Bridge not running on localhost:18793

## Security

- **Local Only** - Connects only to localhost Bridge
- **No External Calls** - All communication internal
- **stdio Transport** - Secure communication with WS Workspace

## Performance

- **Fast Startup** - <100ms initialization
- **Efficient** - Minimal overhead per command
- **Scalable** - Handles concurrent tool calls

## Logs

Logs output to **stderr** (not stdout, as stdout is used for MCP protocol):

```
[MCP] Starting Browser Agent MCP Server...
[MCP] Bridge URL: http://localhost:18793
[MCP] Bridge Server: ok (2 profiles connected)
[MCP] Browser Agent MCP Server ready
[MCP] Executing tool: browser_navigate
```

## Troubleshooting

### Bridge Server unreachable

**Check:**
1. Bridge Server running: `cd ../bridge && npm start`
2. Port 18793 accessible
3. BRIDGE_URL environment variable correct

### Tools not appearing in WS Workspace

**Check:**
1. MCP Server built: `npm run build`
2. WS Workspace source enabled
3. Restart WS Workspace

### Commands failing

**Check:**
1. Extension installed and connected
2. Browser page loaded and ready
3. Selectors correct (use DevTools)

---

**Part of Browser Agent for WS Workspace**
