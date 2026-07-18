// Policy layer (Safety v0, part 2): per-site / per-command rules for commands
// that drive REAL logged-in browsers.
//
// The bridge is the policy SOURCE (this module + policy.json next to it);
// ENFORCEMENT lives in the extension — the only component that knows the
// target tab's URL. Deterministic chokepoint by design: an LLM agent cannot
// talk its way past code.
//
// policy.json shape (user-editable, hot-reloaded on every read):
//   defaults.action            — fallback: allow | confirm | deny
//   commandDefaults[type]      — per-command fallback (e.g. set_cookies: confirm)
//   rules[]                    — first match wins: { origin, commands, action, note }
//     origin:   exact host ("crm.example.de") or wildcard ("*.example.de" —
//               matches the domain and any subdomain)
//     commands: "*" or array of command types
//   unattended.confirmBecomes  — how "confirm" degrades when no human is in
//                                the loop (part 3 playbook-runner): deny
//
// KNOWN v0 CEILINGS (deliberate, documented): the gate judges the moment of
// the call — in-page effects (JS fetch/redirects after an allowed call,
// clicks that lead off-site, cross-origin iframes via frameSelector) are out
// of scope; the confirm flow guards an honest agent, not a malicious one
// (hard human-in-the-loop UI in the extension = part 3). "commands" use
// EXTENSION command types (mouse_click / keyboard_type / form_input — NOT
// MCP tool names); browser_fill_form arrives as form_input. IDN domains must
// be written in punycode (URL.hostname compares punycode). origin "*" is
// supported. Unknown/typo'd action values fail to CONFIRM, never to allow.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POLICY_FILE = path.join(__dirname, 'policy.json');

const DEFAULT_POLICY = {
  version: 1,
  note: 'browser-agent Safety v0 policy. action: allow | confirm | deny. Порядок: rules (первое совпадение) → commandDefaults → defaults. Файл можно править на лету — расширение перечитывает его периодически и при переподключении.',
  defaults: { action: 'allow' },
  commandDefaults: {
    set_cookies: 'confirm',
    upload_file: 'confirm'
  },
  rules: [
    {
      origin: 'accounts.google.com',
      commands: ['execute_js', 'form_input', 'type', 'set_cookies', 'keyboard_type', 'keyboard_key', 'mouse_click'],
      action: 'confirm',
      note: 'Запись в Google-аккаунт — только с подтверждением'
    },
    {
      origin: '*.paypal.com',
      commands: '*',
      action: 'deny',
      note: 'Платёжные провайдеры — запрещено (правь при осознанной необходимости)'
    }
  ],
  unattended: { confirmBecomes: 'deny' }
};

export function loadPolicy() {
  try {
    if (!fs.existsSync(POLICY_FILE)) {
      fs.writeFileSync(POLICY_FILE, JSON.stringify(DEFAULT_POLICY, null, 2), 'utf8');
      logger.info('[Policy] Created default policy.json', { file: POLICY_FILE });
      return DEFAULT_POLICY;
    }
    const parsed = JSON.parse(fs.readFileSync(POLICY_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !parsed.defaults) {
      throw new Error('policy.json has no defaults section');
    }
    return parsed;
  } catch (error) {
    // Fail SAFE: broken config serves the built-in default (which still
    // confirms high-risk commands) — never an implicit allow-everything.
    logger.error('[Policy] Failed to load policy.json — serving built-in default', { error: error.message });
    return DEFAULT_POLICY;
  }
}

export function getPolicyPath() {
  return POLICY_FILE;
}
