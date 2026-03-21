# Browser Agent v2.0 - Setup Guide

**Complete installation guide for WS Agency team**

## What's New in v2.0

- **Tab Group Isolation** — Agent works in "🤖 Agent" group, never touches your tabs
- **CDP Screenshots** — No more browser focus hijacking
- **Accessibility Tree** — Read pages as documents with ref IDs (38 tools total)
- **Side Panel** — Live status, plan tracking, action log
- **Design Extraction** — Colors, typography → Tailwind config
- **Recording → Skills** — Record actions, generate reusable SKILL.md

> **Important:** Make sure you're on the `v2.0-dev` branch: `git checkout v2.0-dev`

## Prerequisites

- ✅ Node.js 18+ installed
- ✅ Chrome or Chromium-based browser (Comet)
- ✅ WS Workspace installed
- ✅ Administrator access (for extension installation)

## Installation Steps

### Step 1: Install Dependencies

Open terminal in `browser-agent` directory:

```bash
# Install Bridge Server dependencies
cd bridge
npm install

# Install MCP Server dependencies
cd ../mcp-server
npm install

# Build MCP Server
npm run build
```

**Expected output:**
```
added 45 packages
Successfully compiled TypeScript
```

### Step 2: Start Bridge Server

**Important:** Keep this terminal open!

```bash
cd bridge
npm start
```

**Expected output:**
```
[Bridge] WebSocket Server listening on ws://localhost:18792
[Bridge] HTTP API listening on http://localhost:18793
[Bridge] Ready to accept connections
```

### Step 3: Install Chrome Extension

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Navigate to and select the `extension/` folder:
   - **Windows:** `D:\Claude\sources\browser-agent\extension\`
   - **macOS:** `~/browser-agent/extension/`
6. Extension appears as "Browser Agent for WS Workspace" v2.0.0

**Verify:**
- Extension shows green badge ✓
- Click extension icon → **Side Panel** opens (not popup)
- Side Panel shows "Connected" with green dot
- Side Panel shows version v2.0

**New in v2.0:** Clicking the extension icon opens a Side Panel instead of a popup. The panel stays open while you browse.

### Step 4: Install in Multiple Profiles (Optional)

If you use multiple Chrome profiles:

1. Switch to **Chrome Work** profile
2. Repeat Step 3
3. Switch to **Comet Ads** profile
4. Repeat Step 3
5. Etc.

Each profile registers automatically with Bridge Server.

### Step 5: Verify Setup

**Test Bridge Server:**
```bash
curl http://localhost:18793/health
```

**Expected response:**
```json
{
  "status": "ok",
  "uptime": 12.34,
  "profiles": 1,
  "activeProfile": "chrome-1234..."
}
```

**Test Extension:**
- Click extension icon
- Should show green "Connected" status
- Should show Profile ID

### Step 6: Configure WS Workspace

Source is already configured! Just restart WS Workspace to activate.

**Verify in WS Workspace:**
1. Check sources list
2. "Browser Agent" should be listed
3. Status: Connected ✅

### Step 7: Test End-to-End

In WS Workspace, try:

```
"Navigate to google.com and take a screenshot"
```

**Expected:**
1. Browser opens google.com
2. WS Workspace shows screenshot
3. Success! 🎉

## Post-Installation

### Auto-Start Bridge Server (Recommended)

**Option 1: Windows Task Scheduler**

1. Open Task Scheduler
2. Create Basic Task
3. Name: "Browser Agent Bridge"
4. Trigger: At log on
5. Action: Start a program
   - Program: `node`
   - Arguments: `D:\Claude\sources\browser-agent\bridge\server.js`
   - Start in: `D:\Claude\sources\browser-agent\bridge\`
6. Finish

**Option 2: npm run script**

Add to your system startup or create a shortcut.

### Extension Stays Installed

Once installed, the extension persists across browser restarts. No need to reinstall unless you update it.

## Team Installation

Share this setup guide with team members:

1. Clone/copy `browser-agent` directory
2. Follow Steps 1-7
3. Done!

**Per-machine setup time:** ~5 minutes

## Updating

### Update Extension

1. Make changes to `extension/` files
2. Go to `chrome://extensions/`
3. Click reload icon ↻ for Browser Agent
4. Done

### Update Bridge Server

1. Stop Bridge Server (Ctrl+C)
2. Make changes
3. Restart: `npm start`

### Update MCP Server

1. Make changes to `mcp-server/src/` files
2. Rebuild: `npm run build`
3. Restart WS Workspace

## Troubleshooting

### Extension shows red ✗

**Problem:** Cannot connect to Bridge Server

**Solution:**
1. Check Bridge Server is running
2. Check port 18792 not blocked
3. Restart Bridge Server
4. Reload extension

### "No active profile found" error

**Problem:** Extension not connected

**Solution:**
1. Install Chrome Extension
2. Check extension enabled in `chrome://extensions/`
3. Click extension icon to verify status

### WS Workspace doesn't see tools

**Problem:** MCP Server not built or configured

**Solution:**
1. `cd mcp-server && npm run build`
2. Check `config.json` path is correct
3. Restart WS Workspace

### Bridge Server won't start

**Problem:** Port already in use

**Solution:**
```bash
# Windows - find process using port
netstat -ano | findstr :18792

# Kill process
taskkill /PID <pid> /F

# Restart Bridge
npm start
```

## Uninstallation

### Remove Extension

1. Go to `chrome://extensions/`
2. Click Remove on "Browser Agent"
3. Done

### Stop Bridge Server

1. Go to terminal running Bridge
2. Press Ctrl+C
3. Done

### Remove from WS Workspace

1. Delete source config:
   ```
   C:\Users\alexa\.craft-agent\workspaces\my-workspace\sources\browser-agent\
   ```
2. Restart WS Workspace

## Support

Problems? Check:

1. **Bridge Server logs** - Terminal output shows all activity
2. **Extension console** - `chrome://extensions/` → Details → Inspect service worker
3. **MCP Server logs** - WS Workspace stderr output
4. **This guide** - Re-read relevant section

Still stuck? Ask team for help!

## Next Steps

Once installed:

- ✅ Try automation examples from `README.md`
- ✅ Create custom workflows
- ✅ Integrate with other WS Workspace sources
- ✅ Explore advanced features

## Quick Reference

**Start Bridge Server:**
```bash
cd D:\Claude\sources\browser-agent\bridge
npm start
```

**Rebuild MCP Server:**
```bash
cd D:\Claude\sources\browser-agent\mcp-server
npm run build
```

**Test Health:**
```bash
curl http://localhost:18793/health
```

**Extension Location:**
```
chrome://extensions/ → "Browser Agent for WS Workspace"
```

---

**Setup complete!** You now have full browser automation integrated with WS Workspace. 🚀

Welcome to the future of browser automation - local, free, and powerful.
