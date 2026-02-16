# Browser Agent - Production Setup

Production-ready browser automation system for WS Workspace with authentication, logging, auto-restart, and Windows Service support.

## 🎯 Features

- ✅ **WebSocket Authentication** - Token-based security
- ✅ **File Logging with Rotation** - 14-day retention for logs, 30-day for errors
- ✅ **Auto-Reconnect** - Exponential backoff (1s → 30s max)
- ✅ **Windows Service** - Auto-start on system boot
- ✅ **Multiple Profiles** - Chrome, Comet, different user profiles
- ✅ **Production Stability** - Crash recovery, health checks

## 📦 Installation

### 1. Install Dependencies

```bash
cd D:\Claude\sources\browser-agent\bridge
npm install
```

### 2. Install Windows Service (Administrator)

**Option A: Run as Administrator from PowerShell**
```powershell
# Right-click PowerShell → "Run as Administrator"
cd D:\Claude\sources\browser-agent\bridge
node install-service.js
```

**Option B: Manual Service Setup**
```bash
# Install service
node install-service.js

# Start service (if not auto-started)
sc start BrowserAgentBridge

# Check status
sc query BrowserAgentBridge
```

### 3. Install Chrome Extension

1. Open **Comet/Chrome** → `chrome://extensions/`
2. Enable **"Developer mode"** (top-right toggle)
3. Click **"Load unpacked"**
4. Select folder: `D:\Claude\sources\browser-agent\extension`
5. Extension auto-connects to Bridge Server
6. Verify: Click extension icon → Should show "Connected to WS Workspace" ✅

### 4. Verify Installation

```bash
# Check service status
sc query BrowserAgentBridge

# Test health endpoint
curl http://localhost:18793/health

# View logs
cat D:\Claude\sources\browser-agent\bridge\logs\browser-agent-*.log
```

## 🔧 Service Management

### Start Service
```bash
sc start BrowserAgentBridge
# OR use Services.msc GUI
```

### Stop Service
```bash
sc stop BrowserAgentBridge
```

### Restart Service
```bash
sc stop BrowserAgentBridge
sc start BrowserAgentBridge
```

### Uninstall Service
```bash
# Run as Administrator
node uninstall-service.js
```

## 📊 Monitoring

### Log Files
```
D:\Claude\sources\browser-agent\bridge\logs\
├── browser-agent-YYYY-MM-DD.log      # All logs (14-day retention)
├── browser-agent-error-YYYY-MM-DD.log # Errors only (30-day retention)
├── browser-agent-exceptions-*.log     # Uncaught exceptions
└── browser-agent-rejections-*.log     # Unhandled promise rejections
```

### Health Check
```bash
curl http://localhost:18793/health
```

Response:
```json
{
  "status": "ok",
  "uptime": 3600.5,
  "profiles": 2,
  "activeProfile": "chrome-1771246123525-ezd05p"
}
```

### List Profiles
```bash
curl http://localhost:18793/profiles
```

## 🔒 Security

### Authentication Token
- Auto-generated on first start
- Stored in: `D:\Claude\sources\browser-agent\bridge\.auth-token`
- Extensions fetch token via HTTP endpoint (localhost only)
- WebSocket requires token: `ws://localhost:18792?token=xxx`

### Token Management
```bash
# View current token
cat D:\Claude\sources\browser-agent\bridge\.auth-token

# Regenerate token (restart required)
rm D:\Claude\sources\browser-agent\bridge\.auth-token
sc restart BrowserAgentBridge
```

## 🌐 Multiple Profiles

### Install Extension in Multiple Profiles

1. **Chrome Work Profile:**
   - Open Chrome Work → `chrome://extensions/`
   - Load extension from `D:\Claude\sources\browser-agent\extension`

2. **Chrome Personal Profile:**
   - Open Chrome Personal → `chrome://extensions/`
   - Load extension (same folder)

3. **Comet Ads Profile:**
   - Open Comet → `chrome://extensions/`
   - Load extension (same folder)

Each profile gets a unique ID (e.g., `chrome-xxx-work`).

### Use Specific Profile

```javascript
// Execute on specific profile
browser_execute_js({
  profileId: "chrome-1771246123525-ezd05p",
  code: "document.title"
})

// Use active profile (default)
browser_execute_js({
  code: "document.title"
})
```

## 🛠️ Troubleshooting

### Extension Not Connecting

1. Check Bridge Server status:
   ```bash
   sc query BrowserAgentBridge
   ```

2. Check logs:
   ```bash
   tail -f D:\Claude\sources\browser-agent\bridge\logs\browser-agent-*.log
   ```

3. Verify ports:
   ```bash
   netstat -ano | grep "18792\|18793"
   ```

4. Reload extension:
   - `chrome://extensions/` → Click 🔄 (reload button)

### Service Won't Start

1. Check Windows Event Viewer:
   - Windows Logs → Application → Filter by "BrowserAgentBridge"

2. Run manually for debugging:
   ```bash
   cd D:\Claude\sources\browser-agent\bridge
   node server.js
   ```

3. Check for port conflicts:
   ```bash
   netstat -ano | findstr ":18792 :18793"
   ```

### Authentication Failures

1. Check auth token exists:
   ```bash
   cat D:\Claude\sources\browser-agent\bridge\.auth-token
   ```

2. Verify extension can fetch token:
   ```bash
   curl http://localhost:18793/auth/token
   ```

3. Reload extension to refresh token:
   - `chrome://extensions/` → Click 🔄

## 📝 Development vs Production

| Feature | Development | Production |
|---------|-------------|-----------|
| **Startup** | Manual `node server.js` | Auto-start Windows Service |
| **Logging** | Console only | Files + Console (rotation) |
| **Auth** | Not enforced | Token required |
| **Reconnect** | Fixed 3s delay | Exponential backoff (1s → 30s) |
| **Crash Recovery** | Manual restart | Auto-restart (max 10 times) |

## 🔄 Update Process

1. Stop service:
   ```bash
   sc stop BrowserAgentBridge
   ```

2. Pull updates:
   ```bash
   cd D:\Claude\sources\browser-agent
   git pull
   ```

3. Reinstall dependencies (if needed):
   ```bash
   cd bridge
   npm install
   ```

4. Restart service:
   ```bash
   sc start BrowserAgentBridge
   ```

5. Reload Chrome Extension:
   - `chrome://extensions/` → Click 🔄

## 📞 Support

For issues or questions:
1. Check logs: `D:\Claude\sources\browser-agent\bridge\logs\`
2. Verify health: `curl http://localhost:18793/health`
3. Check service: `sc query BrowserAgentBridge`

---

**Status:** Production-ready для внутреннего использования ✅
