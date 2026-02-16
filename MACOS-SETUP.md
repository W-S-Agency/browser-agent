# Browser Agent - macOS Setup Guide

Production-ready browser automation for macOS with auto-start via LaunchAgent.

## 🍎 macOS Installation

### Prerequisites

```bash
# Install Node.js (if not installed)
brew install node

# Verify installation
node --version
npm --version
```

### Option A: Automatic Installation (node-mac)

**Best for:** Quick setup, automatic updates

```bash
# 1. Navigate to bridge directory
cd /path/to/browser-agent/bridge

# 2. Install dependencies (including node-mac)
npm install
npm install node-mac

# 3. Install as LaunchAgent
node install-service-mac.js
```

### Option B: Manual Installation (launchd)

**Best for:** Custom control, no additional dependencies

```bash
# 1. Navigate to bridge directory
cd /path/to/browser-agent/bridge

# 2. Install dependencies
npm install

# 3. Make scripts executable
chmod +x install-launchd.sh uninstall-launchd.sh

# 4. Run installation script
./install-launchd.sh
```

## 🔧 Service Management

### Using node-mac (Option A)

```bash
# Start service
launchctl load ~/Library/LaunchAgents/com.browseragent.bridge.plist

# Stop service
launchctl unload ~/Library/LaunchAgents/com.browseragent.bridge.plist

# Restart service
launchctl unload ~/Library/LaunchAgents/com.browseragent.bridge.plist
launchctl load ~/Library/LaunchAgents/com.browseragent.bridge.plist

# Uninstall service
node uninstall-service-mac.js
```

### Using launchd (Option B)

```bash
# Start service
launchctl load ~/Library/LaunchAgents/com.browseragent.bridge.plist

# Stop service
launchctl unload ~/Library/LaunchAgents/com.browseragent.bridge.plist

# Restart service
launchctl unload ~/Library/LaunchAgents/com.browseragent.bridge.plist && \
launchctl load ~/Library/LaunchAgents/com.browseragent.bridge.plist

# Check status
launchctl list | grep browseragent

# Uninstall service
./uninstall-launchd.sh
```

## 📦 Chrome Extension Installation

Same as Windows:

1. Open **Chrome/Brave/Arc** → `chrome://extensions/`
2. Enable **"Developer mode"** (top-right toggle)
3. Click **"Load unpacked"**
4. Select folder: `/path/to/browser-agent/extension`
5. Extension auto-connects to Bridge Server
6. Verify: Click extension icon → Should show "Connected to WS Workspace" ✅

## 🔒 Security & Authentication

### Auth Token Location
```bash
/path/to/browser-agent/bridge/.auth-token
```

### View Token
```bash
cat /path/to/browser-agent/bridge/.auth-token
```

### Regenerate Token
```bash
# Remove old token
rm /path/to/browser-agent/bridge/.auth-token

# Restart service (generates new token)
launchctl unload ~/Library/LaunchAgents/com.browseragent.bridge.plist
launchctl load ~/Library/LaunchAgents/com.browseragent.bridge.plist
```

## 📊 Logs & Monitoring

### Log Files
```bash
/path/to/browser-agent/bridge/logs/
├── browser-agent-YYYY-MM-DD.log      # All logs (14-day retention)
├── browser-agent-error-YYYY-MM-DD.log # Errors only (30-day retention)
├── launchd-stdout.log                 # LaunchAgent stdout
└── launchd-stderr.log                 # LaunchAgent stderr
```

### View Logs
```bash
# Real-time logs
tail -f /path/to/browser-agent/bridge/logs/browser-agent-*.log

# LaunchAgent logs
tail -f /path/to/browser-agent/bridge/logs/launchd-*.log

# Check for errors
cat /path/to/browser-agent/bridge/logs/browser-agent-error-*.log
```

### Health Check
```bash
curl http://localhost:18793/health
```

## 🛠️ Troubleshooting

### Service Won't Start

1. **Check if port is already in use:**
   ```bash
   lsof -i :18792
   lsof -i :18793
   ```

2. **Kill existing process:**
   ```bash
   lsof -ti :18792 | xargs kill -9
   lsof -ti :18793 | xargs kill -9
   ```

3. **Check LaunchAgent logs:**
   ```bash
   tail -50 /path/to/browser-agent/bridge/logs/launchd-stderr.log
   ```

4. **Manually run to debug:**
   ```bash
   cd /path/to/browser-agent/bridge
   node server.js
   ```

### Extension Not Connecting

1. **Verify Bridge Server is running:**
   ```bash
   curl http://localhost:18793/health
   ```

2. **Check auth token:**
   ```bash
   curl http://localhost:18793/auth/token
   ```

3. **Reload extension:**
   - `chrome://extensions/` → Click 🔄

4. **Check extension console:**
   - `chrome://extensions/` → Click "Service Worker" (DevTools)

### Permission Issues

```bash
# Fix script permissions
chmod +x /path/to/browser-agent/bridge/*.sh

# Fix plist permissions
chmod 644 ~/Library/LaunchAgents/com.browseragent.bridge.plist
```

## 🔄 Update Process

```bash
# 1. Stop service
launchctl unload ~/Library/LaunchAgents/com.browseragent.bridge.plist

# 2. Update code
cd /path/to/browser-agent
git pull

# 3. Update dependencies
cd bridge
npm install

# 4. Restart service
launchctl load ~/Library/LaunchAgents/com.browseragent.bridge.plist

# 5. Reload Chrome Extension
# chrome://extensions/ → Click 🔄
```

## 📝 Development vs Production

| Feature | Development | Production (LaunchAgent) |
|---------|-------------|--------------------------|
| **Startup** | Manual `node server.js` | Auto-start on login |
| **Logging** | Console only | Files + LaunchAgent logs |
| **Auth** | Not enforced | Token required |
| **Reconnect** | Fixed 3s delay | Exponential backoff |
| **Crash Recovery** | Manual restart | Auto-restart (KeepAlive) |

## 🌐 Multiple Profiles (macOS-specific)

### Chrome Profiles
```bash
# Each Chrome profile shows in chrome://extensions/
# Install extension in each profile separately
```

### Arc Browser
```bash
# Arc uses Chrome extension API
# Install extension same way as Chrome
```

### Brave Browser
```bash
# Brave uses Chrome extension API
# Install extension same way as Chrome
```

Each profile gets unique ID (e.g., `chrome-xxx-macbook-pro`).

## 💡 Pro Tips

1. **Check service on boot:**
   ```bash
   # After restart, verify service started
   launchctl list | grep browseragent
   ```

2. **Monitor logs continuously:**
   ```bash
   tail -f /path/to/browser-agent/bridge/logs/*.log
   ```

3. **Clean old logs:**
   ```bash
   find /path/to/browser-agent/bridge/logs -name "*.log" -mtime +30 -delete
   ```

4. **Profile-specific automation:**
   ```javascript
   // Use specific Chrome profile
   browser_execute_js({
     profileId: "chrome-xxx-macbook",
     code: "document.title"
   })
   ```

## 📞 Support

- Check logs: `/path/to/browser-agent/bridge/logs/`
- Health check: `curl http://localhost:18793/health`
- Service status: `launchctl list | grep browseragent`

---

**Status:** Production-ready для macOS ✅
