# Browser Agent for WS Workspace

Production-ready browser automation system with authentication, logging, auto-restart, and cross-platform support.

## 🎯 Features

- ✅ **WebSocket Authentication** - Token-based security
- ✅ **File Logging with Rotation** - 14-day retention for logs, 30-day for errors
- ✅ **Auto-Reconnect** - Exponential backoff (1s → 30s max)
- ✅ **Auto-Start** - Windows Service / macOS LaunchAgent
- ✅ **Multiple Profiles** - Chrome, Comet, Arc, Brave - different user profiles
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
- 12 browser automation tools
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

```javascript
// Navigation
browser_navigate({ url: "https://example.com" })

// JavaScript execution
browser_execute_js({ code: "document.title" })

// Element interaction
browser_click({ selector: ".button" })
browser_type({ selector: "#input", text: "Hello" })

// Screenshots
browser_screenshot({ fullPage: true })

// Data extraction
browser_extract({ selector: ".product" })
browser_get_text({ selector: "h1" })

// Tab management
browser_list_tabs()
browser_switch_tab({ tabId: 12345 })
browser_new_tab({ url: "https://example.com" })
browser_close_tab({ tabId: 12345 })

// Profile management
browser_list_profiles()
```

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

**Version:** 1.0.0 (February 2026)
