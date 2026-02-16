#!/bin/bash
# Manual uninstallation script for macOS LaunchAgent
# Usage: ./uninstall-launchd.sh

set -e

echo "🗑️  Uninstalling Browser Agent Bridge Server LaunchAgent..."
echo ""

PLIST_DEST="$HOME/Library/LaunchAgents/com.browseragent.bridge.plist"

# Check if service is installed
if [ ! -f "$PLIST_DEST" ]; then
    echo "⚠️  Service is not installed."
    echo ""
    exit 0
fi

# Unload the service (ignore errors if not loaded)
launchctl unload "$PLIST_DEST" 2>/dev/null || true
echo "✓ Service unloaded"

# Remove the plist
rm "$PLIST_DEST"
echo "✓ LaunchAgent plist removed"

echo ""
echo "✅ Browser Agent Bridge Server uninstalled successfully!"
echo ""
echo "To reinstall:"
echo "  ./install-launchd.sh"
echo ""
