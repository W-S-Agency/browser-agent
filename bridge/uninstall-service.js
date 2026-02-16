// Uninstall Browser Agent Bridge Server Windows Service
// Run with Administrator privileges: node uninstall-service.js

import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a new service object
const svc = new Service({
  name: 'BrowserAgentBridge',
  script: path.join(__dirname, 'server.js')
});

// Listen for the "uninstall" event
svc.on('uninstall', () => {
  console.log('✅ Browser Agent Bridge Server uninstalled successfully!');
  console.log('');
  console.log('The service has been removed from Windows Services.');
  console.log('');
  console.log('To reinstall:');
  console.log('  node install-service.js');
  console.log('');
});

svc.on('error', (err) => {
  console.error('❌ Uninstall error:', err);
});

svc.on('doesnotexist', () => {
  console.log('⚠️  Service is not installed.');
  console.log('');
  console.log('Nothing to uninstall.');
  console.log('');
});

// Uninstall the service
console.log('Uninstalling Browser Agent Bridge Server Windows Service...');
console.log('');
svc.uninstall();
