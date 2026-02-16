// Install Browser Agent Bridge Server as macOS LaunchAgent
// Run on macOS: node install-service-mac.js

import { Service } from 'node-mac';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a new service object
const svc = new Service({
  name: 'BrowserAgentBridge',
  description: 'Browser Agent Bridge Server - WebSocket server for browser automation',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: 'NODE_ENV',
      value: 'production'
    },
    {
      name: 'LOG_LEVEL',
      value: 'info'
    }
  ],
  // Restart if crashes
  maxRestarts: 10,
  maxRetries: 5,
  wait: 2,
  grow: 0.25
});

// Listen for the "install" event
svc.on('install', () => {
  console.log('✅ Browser Agent Bridge Server installed as macOS LaunchAgent!');
  console.log('');
  console.log('Service name: BrowserAgentBridge');
  console.log('Status: Installed');
  console.log('');
  console.log('To start the service:');
  console.log('  launchctl load ~/Library/LaunchAgents/com.browseragent.bridge.plist');
  console.log('');
  console.log('To stop the service:');
  console.log('  launchctl unload ~/Library/LaunchAgents/com.browseragent.bridge.plist');
  console.log('');
  console.log('To uninstall the service:');
  console.log('  node uninstall-service-mac.js');
  console.log('');

  // Start the service
  svc.start();
});

svc.on('start', () => {
  console.log('✅ Service started successfully!');
  console.log('');
  console.log('Bridge Server is now running:');
  console.log('  - WebSocket: ws://localhost:18792');
  console.log('  - HTTP API: http://localhost:18793');
  console.log('');
  console.log('Logs location:');
  console.log(`  ${path.join(__dirname, 'logs')}`);
  console.log('');
});

svc.on('error', (err) => {
  console.error('❌ Service error:', err);
});

svc.on('alreadyinstalled', () => {
  console.log('⚠️  Service is already installed!');
  console.log('');
  console.log('To reinstall:');
  console.log('  1. Run: node uninstall-service-mac.js');
  console.log('  2. Run: node install-service-mac.js');
  console.log('');
});

// Install the service
console.log('Installing Browser Agent Bridge Server as macOS LaunchAgent...');
console.log('');
svc.install();
