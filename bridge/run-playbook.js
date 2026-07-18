#!/usr/bin/env node
// CLI for the bridge playbook runner (Safety v0 part 3 — unattended leg).
// Runs a deterministic command list in a REAL logged-in profile WITHOUT an
// LLM in the loop (Hermes cron / CI). Policy applies in unattended mode:
// "confirm" degrades to deny.
//
// Usage:
//   node run-playbook.js <playbook.json> [--profile <alias>] [--continue-on-error] [--bridge <url>]
//
// Playbook file: [{ "type": "navigate", "params": { "url": "https://…" }, "timeout": 30000 }, …]
// Exit code: 0 = all steps succeeded, 1 = any failure.
//
// LIMIT: the whole playbook must finish within ~4 minutes (client fetch header
// timeout is 5 min; the bridge also rejects playbooks whose summed timeouts
// exceed 240s). A client-side timeout error does NOT stop server-side
// execution of the current step — keep playbooks short.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const OPTS_WITH_VALUE = new Set(['--profile', '--bridge']);
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (OPTS_WITH_VALUE.has(args[i])) { i++; continue; }
  if (!args[i].startsWith('--')) positional.push(args[i]);
}
const file = positional[0];
const getOpt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const profileId = getOpt('--profile');
const bridge = getOpt('--bridge') || 'http://localhost:18793';
const stopOnError = !args.includes('--continue-on-error');

if (!file) {
  console.error('Usage: node run-playbook.js <playbook.json> [--profile <alias>] [--continue-on-error] [--bridge <url>]');
  process.exit(1);
}

let playbook;
try {
  playbook = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error(e.code === 'ENOENT' ? `Playbook file not found: ${file}` : `Invalid JSON in ${file}: ${e.message}`);
  process.exit(1);
}

let token;
try {
  token = fs.readFileSync(path.join(__dirname, '.auth-token'), 'utf8').trim();
} catch (_) {
  console.error('.auth-token not found next to this script — start the bridge once first (node bridge/server.js).');
  process.exit(1);
}

let data;
try {
  const res = await fetch(`${bridge}/run-playbook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
    body: JSON.stringify({ playbook, profileId, stopOnError }),
  });
  data = await res.json();
} catch (e) {
  console.error(`Bridge unreachable at ${bridge} — is it running? (${e.message})`);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
process.exit(data.success ? 0 : 1);
