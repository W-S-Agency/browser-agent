#!/bin/bash
# Manual installation script for macOS LaunchAgent
# Usage: ./install-launchd.sh

set -e

echo "🚀 Installing Browser Agent Bridge Server as macOS LaunchAgent..."
echo ""

# Get absolute path to bridge directory
BRIDGE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PLIST_SOURCE="$BRIDGE_DIR/com.browseragent.bridge.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.browseragent.bridge.plist"

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Install Node.js from: https://nodejs.org/"
    exit 1
fi

# Get node path
NODE_PATH=$(which node)
echo "✓ Node.js found at: $NODE_PATH"

# Create logs directory
mkdir -p "$BRIDGE_DIR/logs"
echo "✓ Logs directory created"

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$HOME/Library/LaunchAgents"

# Replace placeholder paths in plist
sed -e "s|REPLACE_WITH_ABSOLUTE_PATH|$BRIDGE_DIR|g" \
    -e "s|/usr/local/bin/node|$NODE_PATH|g" \
    "$PLIST_SOURCE" > "$PLIST_DEST"

echo "✓ LaunchAgent plist created at: $PLIST_DEST"

# Load the service
launchctl load "$PLIST_DEST"
echo "✓ Service loaded"

echo ""
echo "✅ Browser Agent Bridge Server installed successfully!"
echo ""
echo "Service name: com.browseragent.bridge"
echo "Status: Running"
echo ""
echo "Bridge Server is accessible at:"
echo "  - WebSocket: ws://localhost:18792"
echo "  - HTTP API: http://localhost:18793"
echo ""
echo "Logs location:"
echo "  - Winston logs: $BRIDGE_DIR/logs/"
echo "  - LaunchAgent logs: $BRIDGE_DIR/logs/launchd-*.log"
echo ""
echo "Management commands:"
echo "  Stop:      launchctl unload ~/Library/LaunchAgents/com.browseragent.bridge.plist"
echo "  Start:     launchctl load ~/Library/LaunchAgents/com.browseragent.bridge.plist"
echo "  Restart:   launchctl unload ~/Library/LaunchAgents/com.browseragent.bridge.plist && launchctl load ~/Library/LaunchAgents/com.browseragent.bridge.plist"
echo "  Uninstall: ./uninstall-launchd.sh"
echo ""
