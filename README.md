# Browser Agent for WS Workspace

Production-ready browser automation system with authentication, logging, auto-restart, and cross-platform support.

## 🎯 Features

- ✅ **WebSocket Authentication** - Token-based security
- ✅ **File Logging with Rotation** - 14-day retention for logs, 30-day for errors
- ✅ **Auto-Reconnect** - Exponential backoff (1s → 30s max)
- ✅ **Auto-Start** - Windows Service / macOS LaunchAgent
- ✅ **Multiple Profiles** - Chrome, Comet, Arc, Brave - different user profiles
- ✅ **Profile Aliases** - Use friendly names like "work", "personal" instead of IDs
- ✅ **Cross-Platform** - Windows & macOS support
- ✅ **Production Stability** - Crash recovery, health checks

## 📦 Quick Start

### Choose Your Platform:

#### Windows
**👉 [Windows Setup Guide](PRODUCTION-README.md)**

```powershell
# Install as Windows Service
cd D:\Claude\sources\browser-agent\bridge
node install-service.js
```

#### macOS
**👉 [macOS Setup Guide](MACOS-SETUP.md)**

```bash
# Option A: Automatic (node-mac)
node install-service-mac.js

# Option B: Manual (launchd)
chmod +x install-launchd.sh
./install-launchd.sh
```

## 🏗️ Architecture

```
┌─────────────────────┐
│  WS Workspace       │
│  (MCP Client)       │
└──────────┬──────────┘
           │ stdio
           ▼
┌─────────────────────┐
│  MCP Server         │
│  (TypeScript)       │
└──────────┬──────────┘
           │ HTTP
           ▼
┌─────────────────────┐
│  Bridge Server      │
│  (Node.js)          │
│  - Auth Token       │
│  - Winston Logs     │
│  - Profile Manager  │
└──────────┬──────────┘
           │ WebSocket
           ▼
┌─────────────────────┐
│  Chrome Extension   │
│  (Service Worker)   │
│  - Auto-reconnect   │
│  - Keep-alive       │
└─────────────────────┘
```

## 🔧 Components

### 1. MCP Server (`mcp-server/`)
- 55 browser automation tools in 21 categories (v2.5.0)
- stdio transport for WS Workspace
- TypeScript with @modelcontextprotocol/sdk

### 2. Bridge Server (`bridge/`)
- WebSocket server (port 18792)
- HTTP API (port 18793)
- Token-based authentication
- Winston logging with rotation
- Profile management

### 3. Chrome Extension (`extension/`)
- Manifest V3 Service Worker
- Auto-reconnect with exponential backoff
- Token-based WebSocket auth
- Keep-alive to prevent sleep

## 🌐 Browser Support

| Browser | Extension Support | Tested |
|---------|-------------------|--------|
| **Chrome** | ✅ Full | ✅ Yes |
| **Comet** | ✅ Full | ✅ Yes |
| **Arc** | ✅ Full | ⏳ Not yet |
| **Brave** | ✅ Full | ⏳ Not yet |
| **Edge** | ✅ Full | ⏳ Not yet |

All Chromium-based browsers supported via Chrome Extension API.

## 📊 Available Tools

> 📖 **Full reference:** [`TOOLS.md`](./TOOLS.md) — all 55 tools with parameters, auto-generated from `mcp-server/src/tools.ts` (`npm run docs:tools`).

All tools support **profile aliases** - use friendly names like "work" or "personal" instead of full profile IDs.

```javascript
// Navigation (with alias)
browser_navigate({ profileId: "work", url: "https://example.com" })

// JavaScript execution (with alias)
browser_execute_js({ profileId: "work", code: "document.title" })

// Element interaction
browser_click({ profileId: "work", selector: ".button" })
browser_type({ profileId: "work", selector: "#input", text: "Hello" })

// Screenshots
browser_screenshot({ profileId: "work", fullPage: true })

// Data extraction
browser_extract({ profileId: "work", selector: ".product" })
browser_get_text({ profileId: "work", selector: "h1" })

// Tab management
browser_list_tabs({ profileId: "work" })
browser_switch_tab({ profileId: "work", tabId: 12345 })
browser_new_tab({ profileId: "work", url: "https://example.com" })
browser_close_tab({ profileId: "work", tabId: 12345 })

// Profile management
browser_list_profiles()
```

### New since v2.1.0 (highlights — full list in TOOLS.md)

- **v2.5.0 — Session-scoped tab groups:** each MCP session works in its OWN tab group (`🤖 Agent · {id}`, own color); parallel sessions on one profile cannot touch each other's tabs.
- **v2.4.0 — `browser_batch`:** run N tools in one LLM round-trip.
- **v2.3.0 — Safety v0:** loopback-only bridge + auth, policy.json (allow/confirm/deny per origin×command), `browser_confirm`, unattended playbook runner.
- **v2.2.0 — Sprint 6 + performance-passive:** `fill_form`, `extract_validated`, `handle_dialog`; `browser_performance {activate:true}` measures FCP/LCP without stealing focus.

### v2.1.0 (Sprints 1–5)

```javascript
// JS / iframe — top-level return & await; run inside an iframe (cross-origin too)
browser_execute_js({ code: "return document.title" })
browser_execute_js({ code: "return location.host", frameSelector: "iframe.editor" })

// Debugging — network + console
browser_read_network({ filter: "collect", onlyFailed: false })
browser_read_console({ level: "error" })

// SPA timing
browser_wait_for({ selector: "#result", timeout: 5000 })

// Session / files
browser_set_cookies({ cookies: [{ name: "x", value: "1", domain: "example.com", path: "/" }] })
browser_download({ url: "https://.../file.pdf" })          // returns saved path
browser_upload_file({ selector: "input[type=file]", files: ["C:\\path\\file.pdf"] })

// Self-healing action — survives site redesigns (cache → semantic find → re-cache)
browser_act({ description: "Submit button", action: "click" })

// Performance — Core Web Vitals, no PageSpeed quota
browser_performance({ activate: true })                    // activate: foreground for FCP/LCP

// Observe — ranked interactive elements ("what can I do here")
browser_observe({ filter: "search", limit: 20 })

// Design system — DESIGN.md + W3C DTCG + Tailwind v4/v3 + CSS vars + brand
browser_extract_design_system({ selector: "body" })
```

**👉 See [ALIASES.md](ALIASES.md) for full profile alias documentation**

## 🔒 Security

### Authentication
- **Token Generation**: Auto-generated on first start (64-char hex)
- **Token Storage**: `.auth-token` file (localhost-only HTTP access)
- **WebSocket Auth**: `ws://localhost:18792?token=xxx`
- **Extension Auth**: Fetches token from HTTP endpoint

### Localhost-Only
- Bridge Server: `localhost:18792` (WebSocket)
- HTTP API: `localhost:18793` (localhost-only)
- Auth endpoint: `/auth/token` (localhost-only)

## 📖 Documentation

- **[Windows Setup](PRODUCTION-README.md)** - Full Windows installation guide
- **[macOS Setup](MACOS-SETUP.md)** - Full macOS installation guide
- **[Profile Aliases](ALIASES.md)** - Using friendly names for profiles (work, personal, etc.)

## 🧪 Testing

```bash
# Health check
curl http://localhost:18793/health

# Auth token
curl http://localhost:18793/auth/token

# List profiles
curl http://localhost:18793/profiles
```

## 🛠️ Development

```bash
# Run Bridge Server (development)
cd bridge
npm install
node server.js

# Run MCP Server (development)
cd mcp-server
npm install
npm run build
node dist/index.js

# Load Extension (development)
# chrome://extensions/ → Load unpacked → Select extension/
```

## 📝 Logs

### Winston Logs (Both Platforms)
```
bridge/logs/
├── browser-agent-YYYY-MM-DD.log      # All logs
├── browser-agent-error-YYYY-MM-DD.log # Errors only
├── browser-agent-exceptions-*.log     # Uncaught exceptions
└── browser-agent-rejections-*.log     # Unhandled rejections
```

### Platform-Specific Logs

**Windows:**
- Check Windows Event Viewer → Application → BrowserAgentBridge

**macOS:**
```
bridge/logs/
├── launchd-stdout.log  # Service output
└── launchd-stderr.log  # Service errors
```

## 🔄 Update Process

### Windows
```powershell
sc stop BrowserAgentBridge
git pull
cd bridge && npm install
sc start BrowserAgentBridge
```

### macOS
```bash
launchctl unload ~/Library/LaunchAgents/com.browseragent.bridge.plist
git pull
cd bridge && npm install
launchctl load ~/Library/LaunchAgents/com.browseragent.bridge.plist
```

### Extension (All Platforms)
```
chrome://extensions/ → Click 🔄 (Reload)
```

## 🤝 Team Deployment

1. **Clone repository:**
   ```bash
   git clone <repo-url>
   cd browser-agent/bridge
   npm install
   ```

2. **Install service** (per platform):
   - Windows: `node install-service.js`
   - macOS: `node install-service-mac.js` or `./install-launchd.sh`

3. **Install extension** (per browser profile):
   - Load unpacked from `extension/` folder

4. **Verify:**
   ```bash
   curl http://localhost:18793/health
   ```

## 📞 Support

- **Windows Issues:** See [PRODUCTION-README.md](PRODUCTION-README.md#troubleshooting)
- **macOS Issues:** See [MACOS-SETUP.md](MACOS-SETUP.md#troubleshooting)
- **Extension Issues:** Check Service Worker console (`chrome://extensions/`)

## 📄 License

Internal use only - WS Workspace Team

---

**Status:** ✅ Production-ready для Windows & macOS

**Version:** 2.5.0 (July 2026) — see [Releases](https://github.com/W-S-Agency/browser-agent/releases) and [TOOLS.md](./TOOLS.md)
