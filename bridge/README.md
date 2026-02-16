# Browser Agent - WebSocket Bridge Server

**Connects Chrome Extension with MCP Server**

## Overview

The Bridge Server acts as a communication hub between:
- **Chrome Extensions** (via WebSocket on port 18792)
- **MCP Server** (via HTTP API on port 18793)

## Architecture

```
Chrome Extension 1 ──┐
Chrome Extension 2 ──┼──> WebSocket (18792) ──> Bridge Server ──> HTTP API (18793) ──> MCP Server
Chrome Extension N ──┘
```

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

**Keep this running!** Bridge must be active for Browser Agent to work.

## Development

```bash
npm run dev  # Auto-restart on changes (Node 20+)
```

## Configuration

- **WebSocket Port:** 18792 (hardcoded in Extension)
- **HTTP API Port:** 18793 (configured in MCP Server)
- **CORS:** Restricted to localhost
- **Auth:** Internal tokens from Extensions

## API Endpoints

### HTTP API (for MCP Server)

#### POST /execute
Execute command on browser profile.

**Request:**
```json
{
  "command": {
    "type": "navigate",
    "params": { "url": "https://google.com" }
  },
  "profileId": "chrome-work-123" // optional
}
```

**Response:**
```json
{
  "success": true,
  "result": { "url": "https://google.com", "status": "loaded" }
}
```

#### GET /profiles
List all connected profiles.

**Response:**
```json
{
  "success": true,
  "profiles": [
    {
      "id": "chrome-work-123",
      "browserInfo": { "name": "chrome", "version": "..." },
      "isActive": true,
      "isConnected": true,
      "lastSeen": 1739707200000
    }
  ]
}
```

#### GET /health
Health check.

**Response:**
```json
{
  "status": "ok",
  "uptime": 123.45,
  "profiles": 2,
  "activeProfile": "chrome-work-123"
}
```

### WebSocket API (for Chrome Extensions)

#### Register Profile
Extensions send on connection:

```json
{
  "type": "register",
  "profileId": "chrome-work-123",
  "authToken": "abc123...",
  "browserInfo": { "name": "chrome", "version": "..." }
}
```

Bridge responds:
```json
{
  "type": "registered",
  "success": true,
  "profileId": "chrome-work-123"
}
```

#### Command Execution
Bridge sends command:
```json
{
  "id": "cmd_123",
  "type": "navigate",
  "params": { "url": "https://google.com" }
}
```

Extension responds:
```json
{
  "id": "cmd_123",
  "success": true,
  "result": { "url": "https://google.com", "status": "loaded" }
}
```

## Profile Management

The Bridge Server manages multiple browser profiles simultaneously:

- **Registration:** Extensions auto-register on connection
- **Active Profile:** First connected profile, or manually set
- **Disconnection:** Profiles unregistered on WebSocket close
- **Command Routing:** Routes commands to specific profile or active profile

## Security

- **Origin Validation:** Only localhost connections accepted
- **Auth Tokens:** Extensions must provide valid token
- **CORS:** Restricted to localhost
- **No External Access:** All communication local-only

## Troubleshooting

### "EADDRINUSE" error

Port 18792 or 18793 already in use.

**Solution:**
```bash
# Windows
netstat -ano | findstr :18792
taskkill /PID <pid> /F

# Or change ports in code
```

### Extensions not connecting

**Check:**
1. Bridge Server is running
2. Port 18792 not blocked by firewall
3. Extension console for errors

### Commands timing out

**Check:**
1. Extension is connected (green ✓)
2. Profile is registered (`GET /profiles`)
3. Browser page is responsive

## Logs

All operations logged to console:
- WebSocket connections/disconnections
- Profile registrations
- Command executions
- Errors

## Performance

- **Lightweight:** ~10MB RAM per profile
- **Fast:** <10ms command routing
- **Scalable:** Supports 10+ simultaneous profiles

---

**Part of Browser Agent for WS Workspace**
