// Browser Agent v2.0 Background Service Worker
// Tab Group Isolation + CDP Screenshots + Accessibility Tree + computer_use + Design Extraction

// Import modules (Manifest V3 Service Worker)
importScripts(
  'tab-group-manager.js',
  'cdp-screenshot.js',
  'accessibility-tree.js',
  'computer-use.js',
  'design-extractor.js',
  'recorder.js'
);

const BRIDGE_URL = 'ws://localhost:18792';
const RECONNECT_DELAY_MIN = 1000;
const RECONNECT_DELAY_MAX = 30000;
const RECONNECT_BACKOFF_MULTIPLIER = 1.5;

let websocket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let profileId = null;
let profileAlias = null;
let authToken = null;

// === Action Log (for Side Panel) ===
const MAX_LOG_ENTRIES = 50;
let actionLog = [];

// === Plan Tracking (for Side Panel) ===
let currentPlan = null; // { name, steps: [{text, status}], currentStep }

// === Network capture (webRequest ring-buffer, per tab) ===
// No CDP attach → no conflict with the transient debugger used for cookies.
// Captures request/response metadata (NOT bodies — re-fetch via execute_js if a body is needed).
const NET_MAX = 200;                       // ring-buffer size per tab
const networkBuffers = new Map();          // tabId -> [{url, method, status, type, fromCache, ts, error}]
function _netPush(tabId, entry) {
  if (tabId == null || tabId < 0) return;
  let buf = networkBuffers.get(tabId);
  if (!buf) { buf = []; networkBuffers.set(tabId, buf); }
  buf.push(entry);
  if (buf.length > NET_MAX) buf.splice(0, buf.length - NET_MAX);
}
if (chrome.webRequest) {
  chrome.webRequest.onCompleted.addListener(
    (d) => _netPush(d.tabId, { url: d.url, method: d.method, status: d.statusCode, type: d.type, fromCache: d.fromCache, ts: d.timeStamp }),
    { urls: ['<all_urls>'] }
  );
  chrome.webRequest.onErrorOccurred.addListener(
    (d) => _netPush(d.tabId, { url: d.url, method: d.method, status: 0, type: d.type, error: d.error, ts: d.timeStamp }),
    { urls: ['<all_urls>'] }
  );
}


// Keep Service Worker alive
let keepAliveInterval = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  // Keep Service Worker alive more aggressively (every 15s instead of 20s)
  // Also check WebSocket health on each tick
  keepAliveInterval = setInterval(async () => {
    chrome.runtime.getPlatformInfo(() => {});

    // If WebSocket died silently, reconnect
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      console.log('[Browser Agent v2] Keep-alive detected dead WebSocket, reconnecting...');
      if (!reconnectTimer) {
        await fetchAuthToken();
        connectToBridge();
      }
    }
  }, 15000);
}

// Initialize on extension install/startup
chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);

// Clean up agent tabs on tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  tabGroupManager.onTabRemoved(tabId);
  networkBuffers.delete(tabId);
});

// Intercept new tabs opened by agent tabs (window.open, target="_blank")
// Add them to the agent group automatically
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.openerTabId) return;
  // If the opener is an agent tab, add the new tab to agent group
  if (tabGroupManager.agentTabIds.has(tab.openerTabId)) {
    try {
      await tabGroupManager.addTabToGroup(tab.id, tab.windowId);
      tabGroupManager.agentTabIds.add(tab.id);
      console.log('[Browser Agent v2] Auto-added child tab to agent group:', tab.id);
    } catch (error) {
      console.error('[Browser Agent v2] Failed to add child tab to group:', error);
    }
  }
});

// Start immediately
init();

async function init() {
  console.log('[Browser Agent v2] Initializing...');

  // Load stored profile ID and alias
  const stored = await chrome.storage.local.get(['profileId', 'profileAlias']);
  profileId = stored.profileId || generateProfileId();
  profileAlias = stored.profileAlias || null;

  await chrome.storage.local.set({ profileId });

  console.log('[Browser Agent v2] Profile ID:', profileId);
  if (profileAlias) {
    console.log('[Browser Agent v2] Profile Alias:', profileAlias);
  }

  await fetchAuthToken();
  startKeepAlive();
  connectToBridge();
}

function generateProfileId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `chrome-${timestamp}-${random}`;
}

async function fetchAuthToken() {
  try {
    const response = await fetch('http://localhost:18793/auth/token');
    const data = await response.json();
    if (data.success && data.token) {
      authToken = data.token;
      console.log('[Browser Agent v2] Auth token received');
    } else {
      console.error('[Browser Agent v2] Failed to fetch auth token:', data.error);
    }
  } catch (error) {
    console.error('[Browser Agent v2] Error fetching auth token:', error);
  }
}

// === WebSocket Connection ===

function connectToBridge() {
  if (websocket && websocket.readyState === WebSocket.OPEN) return;

  if (!authToken) {
    console.error('[Browser Agent v2] Cannot connect: No auth token');
    scheduleReconnect();
    return;
  }

  try {
    websocket = new WebSocket(`${BRIDGE_URL}?token=${authToken}`);
    websocket.onopen = handleConnect;
    websocket.onmessage = handleMessage;
    websocket.onerror = handleError;
    websocket.onclose = handleClose;
  } catch (error) {
    console.error('[Browser Agent v2] Connection failed:', error);
    scheduleReconnect();
  }
}

function handleConnect() {
  console.log('[Browser Agent v2] Connected to Bridge Server');
  reconnectAttempts = 0;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  sendMessage({
    type: 'register',
    profileId,
    alias: profileAlias,
    authToken,
    browserInfo: {
      name: 'chrome',
      version: navigator.userAgent,
      agentVersion: '2.1.0'
    }
  });

  chrome.action.setBadgeText({ text: '✓' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
}

async function handleMessage(event) {
  let message;
  try {
    message = JSON.parse(event.data);
    if (!message.id) return; // Ignore non-command messages

    const commandType = message.type;
    const detail = formatCommandDetail(message);
    console.log('[Browser Agent v2] Command:', commandType);

    // Log: running
    logAction(commandType, 'running', detail);

    const result = await executeCommand(message);

    // Record action for skills pipeline
    recorder.recordAction(commandType, message.params || {}, result);

    // Log: success
    logAction(commandType, 'success', detail);

    sendMessage({ id: message.id, success: true, result });
  } catch (error) {
    console.error('[Browser Agent v2] Command failed:', error);

    // Log: error
    logAction(message?.type || 'unknown', 'error', error.message);

    sendMessage({ id: message?.id, success: false, error: error.message });
  }
}

function logAction(action, status, detail) {
  const entry = {
    action,
    status,
    detail: detail || '',
    timestamp: Date.now()
  };

  actionLog.push(entry);
  if (actionLog.length > MAX_LOG_ENTRIES) {
    actionLog = actionLog.slice(-MAX_LOG_ENTRIES);
  }

  // Broadcast to side panel
  chrome.runtime.sendMessage({ type: 'actionLog', entry }).catch(() => {});
}

function formatCommandDetail(command) {
  const p = command.params || {};
  switch (command.type) {
    case 'navigate': return p.url || '';
    case 'click': return p.selector || '';
    case 'click_ref': return p.ref || '';
    case 'type': return `${p.selector} = "${(p.text || '').substring(0, 30)}"`;
    case 'form_input': return `${p.ref} = "${(p.value || '').substring(0, 30)}"`;
    case 'find': return `"${p.query || ''}"`;
    case 'screenshot': return p.fullPage ? 'fullPage' : 'viewport';
    case 'screenshot_element': return p.ref || p.selector || '';
    case 'scroll': return `${p.direction || 'down'} ${p.amount || 500}px`;
    case 'scroll_to': return p.ref || '';
    case 'execute_js': return (p.frameSelector ? `[${p.frameSelector}] ` : '') + (p.code || '').substring(0, 40);
    case 'read_network': return p.filter || (p.onlyFailed ? 'failed' : 'all');
    case 'download': return p.url || '';
    case 'upload_file': return `${p.selector} ← ${((p.files||[p.file]).filter(Boolean)).length} file(s)`;
    case 'act': return `${p.action || 'click'}: "${(p.description || '').substring(0, 30)}"`;
    case 'performance': return 'CWV + timing';
    case 'observe': return p.filter || 'all interactive';
    case 'set_cookies': return `${(p.cookies || []).length} cookie(s)`;
    case 'read_console': return p.level || 'all';
    case 'wait_for': return p.selector || (p.text ? `"${p.text}"` : `${p.timeout || 10000}ms`);
    case 'extract_design': return p.selector || 'body';
    case 'extract_seo': return 'full audit';
    case 'mouse_click': return `(${p.x}, ${p.y})`;
    case 'keyboard_key': return p.key || '';
    case 'keyboard_type': return `"${(p.text || '').substring(0, 30)}"`;
    default: return '';
  }
}

// === Command Execution (v2: Tab Group Isolated) ===

async function executeCommand(command) {
  const { type, params = {} } = command;

  switch (type) {
    // --- Navigation ---
    case 'navigate':
      return await navigateAgent(params.url, params.tabId);

    // --- Interaction ---
    case 'click':
      return await clickElement(await resolveAgentTabId(params.tabId), params.selector);

    case 'type':
      return await typeText(await resolveAgentTabId(params.tabId), params.selector, params.text);

    // --- Screenshots (CDP — no focus hijack!) ---
    case 'screenshot':
      return await takeScreenshot(await resolveAgentTabId(params.tabId), params);

    // --- Cookies (CDP) ---
    case 'get_all_cookies': {
      const tabId = await resolveAgentTabId(params.tabId);
      try { await chrome.debugger.attach({tabId}, '1.3'); } catch (_) {}
      try {
        const result = await chrome.debugger.sendCommand({tabId}, 'Network.getAllCookies', {});
        const cookies = result.cookies || [];
        const domain = params.domain;
        return domain ? cookies.filter(c => c.domain.includes(domain)) : cookies;
      } finally {
        try { await chrome.debugger.detach({tabId}); } catch (_) {}
      }
    }

    // --- JavaScript ---
    case 'execute_js':
      return await executeJS(await resolveAgentTabId(params.tabId), params.code, params.frameSelector);

    // --- Data extraction ---
    case 'extract':
      return await extractData(await resolveAgentTabId(params.tabId), params.selector);

    case 'get_text':
      return await getText(await resolveAgentTabId(params.tabId), params.selector);

    // --- Scroll ---
    case 'scroll':
      return await scrollPage(await resolveAgentTabId(params.tabId), params.direction, params.amount);

    // --- History ---
    case 'go_back':
      return await goBack(await resolveAgentTabId(params.tabId));

    case 'go_forward':
      return await goForward(await resolveAgentTabId(params.tabId));

    // --- Tab management (agent group only) ---
    case 'list_tabs':
      return await tabGroupManager.listAgentTabs();

    case 'list_all_tabs':
      return await tabGroupManager.listAllTabs();

    case 'new_tab':
      return await createAgentTab(params.url);

    case 'close_tab':
      return await tabGroupManager.closeTab(params.tabId);

    case 'switch_tab':
      return await switchAgentTab(params.tabId);

    // --- Accessibility Tree (Phase 2) ---
    case 'read_page':
      return await accessibilityTree.readPage(
        await resolveAgentTabId(params.tabId),
        { maxDepth: params.maxDepth, interactiveOnly: params.interactiveOnly }
      );

    case 'find':
      return await accessibilityTree.find(
        await resolveAgentTabId(params.tabId),
        params.query,
        { maxResults: params.maxResults }
      );

    case 'form_input':
      return await accessibilityTree.formInput(
        await resolveAgentTabId(params.tabId),
        params.ref,
        params.value
      );

    case 'click_ref':
      return await accessibilityTree.clickRef(
        await resolveAgentTabId(params.tabId),
        params.ref
      );

    case 'scroll_to':
      return await accessibilityTree.scrollToRef(
        await resolveAgentTabId(params.tabId),
        params.ref
      );

    // --- computer_use (Phase 2) ---
    case 'mouse_click':
      return await computerUse.click(
        await resolveAgentTabId(params.tabId),
        params.x, params.y,
        { button: params.button, clickCount: params.clickCount, modifiers: params.modifiers }
      );

    case 'mouse_hover':
      return await computerUse.hover(
        await resolveAgentTabId(params.tabId),
        params.x, params.y
      );

    case 'mouse_drag':
      return await computerUse.drag(
        await resolveAgentTabId(params.tabId),
        params.x1, params.y1, params.x2, params.y2,
        { steps: params.steps }
      );

    case 'mouse_scroll':
      return await computerUse.scroll(
        await resolveAgentTabId(params.tabId),
        params.x || 0, params.y || 0,
        params.deltaX || 0, params.deltaY || 0
      );

    case 'keyboard_type':
      return await computerUse.type(
        await resolveAgentTabId(params.tabId),
        params.text
      );

    case 'keyboard_key':
      return await computerUse.key(
        await resolveAgentTabId(params.tabId),
        params.key,
        params.modifiers || []
      );

    case 'screenshot_element':
      return await computerUse.screenshotElement(
        await resolveAgentTabId(params.tabId),
        { ref: params.ref, selector: params.selector, padding: params.padding }
      );

    case 'screenshot_responsive':
      return await computerUse.screenshotResponsive(
        await resolveAgentTabId(params.tabId),
        params.viewports
      );

    // --- Design Extraction (Phase 2) ---
    case 'extract_design':
      return await designExtractor.extractDesign(
        await resolveAgentTabId(params.tabId),
        params.selector
      );

    case 'extract_palette':
      return await designExtractor.extractPalette(
        await resolveAgentTabId(params.tabId)
      );

    case 'extract_section':
      return await designExtractor.extractSection(
        await resolveAgentTabId(params.tabId),
        params.selector
      );

    case 'extract_seo':
      return await designExtractor.extractSEO(
        await resolveAgentTabId(params.tabId)
      );

    // --- Plan Tracking ---
    case 'set_plan':
      currentPlan = {
        name: params.name || 'Plan',
        steps: (params.steps || []).map(s => ({ text: s, status: 'pending' })),
        currentStep: 0
      };
      chrome.runtime.sendMessage({ type: 'planUpdate', plan: currentPlan }).catch(() => {});
      return { plan: currentPlan.name, steps: currentPlan.steps.length };

    case 'update_plan_step':
      if (!currentPlan) return { error: 'No active plan' };
      const stepIdx = params.step !== undefined ? params.step : currentPlan.currentStep;
      if (stepIdx >= 0 && stepIdx < currentPlan.steps.length) {
        currentPlan.steps[stepIdx].status = params.status || 'completed';
        // Auto-advance to next pending step
        if (params.status === 'completed' || params.status === 'done') {
          const next = currentPlan.steps.findIndex((s, i) => i > stepIdx && s.status === 'pending');
          if (next !== -1) {
            currentPlan.currentStep = next;
            currentPlan.steps[next].status = 'in_progress';
          }
        }
      }
      chrome.runtime.sendMessage({ type: 'planUpdate', plan: currentPlan }).catch(() => {});
      return currentPlan;

    case 'clear_plan':
      currentPlan = null;
      chrome.runtime.sendMessage({ type: 'planUpdate', plan: null }).catch(() => {});
      return { cleared: true };

    // --- Recording (Phase 4) ---
    case 'start_recording':
      return recorder.start(params.name);

    case 'stop_recording':
      return recorder.stop();

    case 'recording_status':
      return recorder.getStatus();

    case 'list_recordings':
      return recorder.listRecordings();

    case 'get_recording':
      return recorder.getRecording(params.name);

    case 'generate_skill':
      return recorder.generateSkill(params.recordingName, {
        skillName: params.skillName,
        description: params.description,
        parameterize: params.parameterize !== false
      });

    // --- Cookies: set (CDP) ---
    case 'set_cookies': {
      const tabId = await resolveAgentTabId(params.tabId);
      try { await chrome.debugger.attach({ tabId }, '1.3'); } catch (_) {}
      try {
        const cookies = params.cookies || [];
        await chrome.debugger.sendCommand({ tabId }, 'Network.setCookies', { cookies });
        return { set: cookies.length };
      } finally {
        try { await chrome.debugger.detach({ tabId }); } catch (_) {}
      }
    }

    // --- Console log reading (MAIN-world capture buffer) ---
    case 'read_console':
      return await readConsole(await resolveAgentTabId(params.tabId), params);

    // --- Wait for condition (selector / text / timeout) ---
    case 'wait_for':
      return await waitFor(await resolveAgentTabId(params.tabId), params);

    // --- Network request reading (webRequest buffer) ---
    case 'read_network':
      return await readNetwork(await resolveAgentTabId(params.tabId), params);

    // --- Download a file (chrome.downloads) ---
    case 'download':
      return await downloadFile(params);

    // --- Upload file(s) into a <input type=file> (CDP) ---
    case 'upload_file':
      return await uploadFile(await resolveAgentTabId(params.tabId), params);

    // --- Self-healing action (cache selector → fallback to semantic find) ---
    case 'act':
      return await selfHealAct(await resolveAgentTabId(params.tabId), params);

    // --- Performance metrics (Core Web Vitals + navigation timing) ---
    case 'performance':
      return await getPerformance(await resolveAgentTabId(params.tabId), params);

    // --- Observe: ranked interactive elements ("what can I do here") ---
    case 'observe':
      return await observePage(await resolveAgentTabId(params.tabId), params);

    // --- Native JS dialog handling (arm one-shot: alert/confirm/prompt) ---
    case 'handle_dialog':
      return await handleDialog(await resolveAgentTabId(params.tabId), params.accept !== false, params.promptText);

    // --- Cleanup ---
    case 'cleanup':
      await tabGroupManager.cleanup();
      await cdpScreenshot.cleanup();
      return { cleaned: true };

    default:
      throw new Error(`Unknown command type: ${type}`);
  }
}

// === Sprint 6: native JS dialog handling (CDP Page.handleJavaScriptDialog) ===
// Arms a one-shot auto-handler for the NEXT alert/confirm/prompt on a tab. Call
// handle_dialog JUST BEFORE the action that opens the dialog, then trigger it.
// Limitation: another CDP command that detaches the debugger mid-arm cancels the arm;
// beforeunload prompts are browser-native and not covered.
const _armedDialogs = new Map(); // tabId -> { accept, promptText, timer }
let _dialogListenerRegistered = false;

function _disarmDialog(tabId) {
  const armed = _armedDialogs.get(tabId);
  if (armed && armed.timer) clearTimeout(armed.timer);
  _armedDialogs.delete(tabId);
  try { chrome.debugger.detach({ tabId }); } catch (_) {}
}

function _ensureDialogListener() {
  if (_dialogListenerRegistered) return;
  _dialogListenerRegistered = true;
  chrome.debugger.onEvent.addListener(async (source, method) => {
    if (method !== 'Page.javascriptDialogOpening') return;
    const armed = _armedDialogs.get(source.tabId);
    if (!armed) return;
    const cmd = { accept: armed.accept };
    if (armed.promptText != null) cmd.promptText = String(armed.promptText);
    try {
      await chrome.debugger.sendCommand({ tabId: source.tabId }, 'Page.handleJavaScriptDialog', cmd);
    } catch (_) {}
    _disarmDialog(source.tabId);
  });
}

async function handleDialog(tabId, accept, promptText) {
  _ensureDialogListener();
  // Re-arm on the same tab: clear the prior timer so its stale 30s fire can't
  // disarm (and detach) this fresh arm.
  const prior = _armedDialogs.get(tabId);
  if (prior && prior.timer) clearTimeout(prior.timer);
  try {
    try { await chrome.debugger.attach({ tabId }, '1.3'); } catch (_) { /* already attached is fine */ }
    await chrome.debugger.sendCommand({ tabId }, 'Page.enable', {});
  } catch (e) {
    // Arm setup failed — clean up so we don't leak an attached debugger with no auto-disarm.
    _armedDialogs.delete(tabId);
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
    throw new Error(`handle_dialog: could not arm dialog handler (${e?.message || e}). Is DevTools open or another debugger attached to this tab?`);
  }
  const timer = setTimeout(() => _disarmDialog(tabId), 30000);
  _armedDialogs.set(tabId, { accept, promptText, timer });
  return { armed: true, tabId, accept, promptText: promptText ?? null };
}

/**
 * Resolve tab ID: if provided, verify it's an agent tab.
 * If not provided, get active agent tab or create one.
 */
async function resolveAgentTabId(tabId) {
  if (tabId) {
    const tab = await tabGroupManager.getAgentTab(tabId);
    return tab.id;
  }

  // Try to get existing agent tab (with a real URL, not about:blank)
  const agentTab = await tabGroupManager.getActiveAgentTab();
  if (agentTab && agentTab.url && agentTab.url !== 'about:blank') return agentTab.id;

  // If we have an about:blank tab, return it (navigate will fix it)
  if (agentTab) return agentTab.id;

  // No agent tabs exist — throw helpful error
  throw new Error('No agent tab available. Use browser_navigate to open a page first.');
}

// --- Navigation (creates tab in agent group if needed) ---
async function navigateAgent(url, tabId) {
  const result = await tabGroupManager.navigate(url, tabId);
  return { url, tabId: result.tabId, status: result.status };
}

// --- Click ---
async function clickElement(tabId, selector) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel) => {
      const element = document.querySelector(sel);
      if (!element) throw new Error(`Element not found: ${sel}`);
      element.click();
      return { clicked: true, selector: sel };
    },
    args: [selector]
  });
  return result[0].result;
}

// --- Type (smart event dispatch) ---
async function typeText(tabId, selector, text) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel, txt) => {
      const element = document.querySelector(sel);
      if (!element) throw new Error(`Element not found: ${sel}`);

      element.focus();

      // Smart input: detect element type
      const tagName = element.tagName.toLowerCase();
      const inputType = element.type?.toLowerCase();

      if (tagName === 'select') {
        // Select element: find matching option
        const option = Array.from(element.options).find(
          o => o.value === txt || o.textContent.trim() === txt
        );
        if (option) {
          element.value = option.value;
        } else {
          throw new Error(`Option not found: ${txt}`);
        }
      } else if (inputType === 'checkbox' || inputType === 'radio') {
        // Toggle checkbox/radio
        element.checked = txt === 'true' || txt === '1' || txt === 'on';
      } else {
        // Text input / textarea
        element.value = txt;
      }

      // Dispatch events for framework reactivity (React, Vue, Angular)
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));

      return { typed: true, selector: sel, text: txt, elementType: `${tagName}[${inputType || ''}]` };
    },
    args: [selector, text]
  });
  return result[0].result;
}

// --- Screenshot (CDP — no focus steal!) ---
async function takeScreenshot(tabId, params = {}) {
  const { fullPage = false, optimized = false } = params;

  if (optimized) {
    return await cdpScreenshot.captureForLLM(tabId);
  }
  return await cdpScreenshot.capture(tabId, { fullPage });
}

// --- JavaScript Execution ---
// Auto-wrap so top-level `return` / `await` work; runs in MAIN world.
const _JS_RUNNER = async (codeString) => {
  try {
    return await eval(codeString);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return await eval('(async () => {' + codeString + '})()');
    }
    throw e;
  }
};

async function executeJS(tabId, code, frameSelector) {
  try {
    const target = { tabId };
    // iframe targeting: resolve the iframe's frameId and run inside it
    // (works for same- AND cross-origin frames via chrome.scripting).
    if (frameSelector) {
      const frameId = await resolveFrameId(tabId, frameSelector);
      if (frameId == null) return { error: `iframe not found: ${frameSelector}` };
      target.frameIds = [frameId];
    }
    const result = await chrome.scripting.executeScript({
      target,
      world: 'MAIN',
      func: _JS_RUNNER,
      args: [code]
    });
    return result?.[0]?.result ?? null;
  } catch (error) {
    console.error('[Browser Agent v2] executeJS error:', error);
    return { error: error.message };
  }
}

// Map a CSS selector for an <iframe> to its chrome frameId (via src URL match).
async function resolveFrameId(tabId, frameSelector) {
  const srcRes = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel) => { const el = document.querySelector(sel); return el ? (el.src || '') : null; },
    args: [frameSelector]
  });
  const src = srcRes?.[0]?.result;
  if (src == null) return null;                 // iframe element not found
  const frames = await chrome.webNavigation.getAllFrames({ tabId });
  // exact src match first; fall back to first non-top frame if src is blank (srcdoc/about:blank)
  let f = frames.find(fr => fr.url === src && fr.frameId !== 0);
  if (!f && !src) f = frames.find(fr => fr.frameId !== 0);
  return f ? f.frameId : null;
}

// --- Data Extraction ---
// --- Read console buffer captured by console-capture.js (MAIN world) ---
async function readConsole(tabId, params = {}) {
  const level = params.level || null;   // 'log' | 'info' | 'warn' | 'error'
  const clear = params.clear === true;
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: (lvl, doClear) => {
      const buf = (window.__BA_CONSOLE__ && window.__BA_CONSOLE__.entries) || [];
      const out = lvl ? buf.filter((e) => e.level === lvl) : buf.slice();
      if (doClear && window.__BA_CONSOLE__) window.__BA_CONSOLE__.entries = [];
      return out;
    },
    args: [level, clear]
  });
  const entries = result?.[0]?.result || [];
  return {
    entries,
    count: entries.length,
    note: entries.length === 0
      ? 'No console entries buffered. Capture starts at page load; navigate/reload if you expected output.'
      : undefined
  };
}

// --- Wait for a selector/text to appear or disappear, or a fixed delay ---
async function waitFor(tabId, params = {}) {
  const { selector = null, text = null, state = 'visible', timeout = 10000 } = params;
  const interval = 250;
  const start = Date.now();

  // Plain delay if no condition given
  if (!selector && !text) {
    await new Promise((r) => setTimeout(r, timeout));
    return { ok: true, waited: timeout };
  }

  while (Date.now() - start < timeout) {
    const present = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (sel, txt) => {
        if (sel) {
          const el = document.querySelector(sel);
          if (!el) return false;
          return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        }
        return !!(document.body && document.body.innerText.includes(txt));
      },
      args: [selector, text]
    }).then((r) => r?.[0]?.result === true).catch(() => false);

    const satisfied = state === 'hidden' ? !present : present;
    if (satisfied) return { ok: true, waited: Date.now() - start };
    await new Promise((r) => setTimeout(r, interval));
  }
  return { ok: false, timedOut: true, waited: Date.now() - start };
}

// --- Read buffered network requests for a tab (webRequest, metadata only) ---
async function readNetwork(tabId, params = {}) {
  let entries = (networkBuffers.get(tabId) || []).slice();
  if (params.filter) {
    const needle = String(params.filter).toLowerCase();
    entries = entries.filter((e) => (e.url || '').toLowerCase().includes(needle));
  }
  if (params.status) entries = entries.filter((e) => e.status === params.status);
  if (params.onlyFailed) entries = entries.filter((e) => e.status === 0 || e.status >= 400);
  if (params.clear) networkBuffers.set(tabId, []);
  return {
    entries,
    count: entries.length,
    note: entries.length === 0
      ? 'No requests buffered for this tab. Capture starts at page load; navigate/reload. Bodies are not captured — re-fetch via execute_js if needed.'
      : 'Metadata only (no response bodies). For a body, re-fetch the URL via execute_js.'
  };
}

// --- Download a file via chrome.downloads, wait for completion, return path ---
async function downloadFile(params = {}) {
  const url = params.url;
  if (!url) return { error: 'url is required' };
  const id = await chrome.downloads.download({ url, filename: params.filename, saveAs: false });
  const timeout = params.timeout || 60000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const [item] = await chrome.downloads.search({ id });
    if (item && item.state === 'complete') {
      return { ok: true, id, path: item.filename, size: item.fileSize, mime: item.mime, url: item.finalUrl || item.url };
    }
    if (item && item.state === 'interrupted') {
      return { ok: false, id, error: item.error || 'interrupted', url };
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return { ok: false, id, error: 'download timeout', url };
}

// --- Upload local file(s) into a <input type=file> via CDP DOM.setFileInputFiles ---
async function uploadFile(tabId, params = {}) {
  const selector = params.selector;
  const files = params.files || (params.file ? [params.file] : []);
  if (!selector) return { error: 'selector is required (CSS for the <input type=file>)' };
  if (!files.length) return { error: 'files is required (array of absolute file paths)' };
  try { await chrome.debugger.attach({ tabId }, '1.3'); } catch (_) {}
  try {
    await chrome.debugger.sendCommand({ tabId }, 'DOM.enable', {});
    const { root } = await chrome.debugger.sendCommand({ tabId }, 'DOM.getDocument', { depth: 0 });
    const { nodeId } = await chrome.debugger.sendCommand({ tabId }, 'DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) return { ok: false, error: `file input not found: ${selector}` };
    await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', { nodeId, files });
    return { ok: true, selector, files };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
  }
}

// === Self-healing action (Sprint 3) =========================================
// Acts by natural-language description. Caches a stable CSS selector per
// (origin, action, description) in chrome.storage.local. Next call tries the
// cached selector first (fast, no AX scan); if it no longer resolves, falls
// back to the existing semantic find(), re-acts, and re-caches the new selector.
// This makes recurring playbooks survive site redesigns.

// Injected: perform an action on a given element + return a stable CSS selector.
function _BA_ACT_ON_ELEMENT(element, action, value) {
  function cssPath(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== 'html') {
      let sel = node.tagName.toLowerCase();
      const parent = node.parentNode;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(c => c.tagName === node.tagName);
        if (sameTag.length > 1) sel += ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')';
      }
      parts.unshift(sel);
      if (node.id) { parts[0] = '#' + CSS.escape(node.id); break; }
      node = parent;
    }
    return parts.join(' > ');
  }
  element.scrollIntoView({ block: 'center' });
  let result;
  if (action === 'click') {
    element.click();
    result = { clicked: true, text: (element.textContent || '').trim().slice(0, 100) };
  } else if (action === 'type') {
    element.focus();
    if (element.isContentEditable) element.textContent = value;
    else element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    result = { typed: value };
  } else if (action === 'get_text') {
    result = { text: (element.textContent || '').trim() };
  } else {
    throw new Error('Unknown act action: ' + action);
  }
  return { result, selector: cssPath(element) };
}

async function _origin(tabId) {
  const r = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', func: () => location.origin
  });
  return r?.[0]?.result || '';
}

async function _actViaSelector(tabId, selector, action, value) {
  const r = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN',
    func: (sel, act, val, fnSrc) => {
      const el = document.querySelector(sel);
      if (!el) return { found: false };
      const fn = eval('(' + fnSrc + ')');
      return { found: true, ...fn(el, act, val) };
    },
    args: [selector, action, value, _BA_ACT_ON_ELEMENT.toString()]
  });
  return r?.[0]?.result || { found: false };
}

async function _actViaRef(tabId, ref, action, value) {
  const r = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN',
    func: (refId, act, val, fnSrc) => {
      const map = window.__agentElementMap;
      const wr = map && map[refId];
      const el = wr ? (wr.deref ? wr.deref() : wr) : null;
      if (!el) return { found: false };
      const fn = eval('(' + fnSrc + ')');
      return { found: true, ...fn(el, act, val) };
    },
    args: [ref, action, value, _BA_ACT_ON_ELEMENT.toString()]
  });
  return r?.[0]?.result || { found: false };
}

async function selfHealAct(tabId, params = {}) {
  const description = params.description;
  const action = params.action || 'click';
  const value = params.value ?? null;   // undefined is unserializable for scripting args
  if (!description) return { error: 'description is required' };

  const origin = await _origin(tabId);
  const cacheKey = `act:${origin}:${action}:${description}`;
  const stored = await chrome.storage.local.get(cacheKey);
  const cachedSelector = stored[cacheKey];

  // 1) Fast path: try the cached selector
  if (cachedSelector) {
    const hit = await _actViaSelector(tabId, cachedSelector, action, value);
    if (hit.found) return { ...hit.result, via: 'cache', selector: cachedSelector };
  }

  // 2) Heal: semantic find → act by ref → (re)cache the resolved selector
  const found = await accessibilityTree.find(tabId, description, { maxResults: 1 });
  const match = found.matches && found.matches[0];
  if (!match) return { error: `not found: "${description}"`, via: 'find', healed: !!cachedSelector };
  const acted = await _actViaRef(tabId, match.ref, action, value);
  if (!acted.found) return { error: `ref stale for "${description}"`, via: 'find' };
  if (acted.selector) await chrome.storage.local.set({ [cacheKey]: acted.selector });
  return { ...acted.result, via: cachedSelector ? 'find(healed)' : 'find', selector: acted.selector, ref: match.ref };
}

// === Observe (Sprint 4) =====================================================
// Heuristic "what can I act on here": ranked interactive elements from the
// accessibility tree (no LLM). Complements find()/act() — survey before acting.
async function observePage(tabId, params = {}) {
  const page = await accessibilityTree.readPage(tabId, { interactiveOnly: true });
  const ROLE_RANK = {
    button: 6, link: 5, textbox: 5, searchbox: 5, combobox: 4, checkbox: 4,
    radio: 4, menuitem: 3, tab: 3, switch: 3, slider: 3, option: 2
  };
  const filter = params.filter ? String(params.filter).toLowerCase() : null;
  let nodes = (page.tree || []).filter((n) => n.ref);
  if (filter) {
    nodes = nodes.filter((n) =>
      `${n.name || ''} ${n.role || ''} ${n.value || ''}`.toLowerCase().includes(filter));
  }
  nodes = nodes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => {
      const na = a.n.name ? 1 : 0, nb = b.n.name ? 1 : 0;
      if (nb !== na) return nb - na;                                   // named elements first
      const ra = ROLE_RANK[a.n.role] || 1, rb = ROLE_RANK[b.n.role] || 1;
      if (rb !== ra) return rb - ra;                                   // role priority
      return a.i - b.i;                                                // DOM order
    })
    .map((x) => x.n);
  const limit = params.limit || 30;
  const elements = nodes.slice(0, limit).map((n) => ({
    ref: n.ref, role: n.role, name: n.name, value: n.value
  }));
  return {
    elements,
    shown: elements.length,
    total: nodes.length,
    pageTitle: page.summary?.pageTitle,
    url: page.summary?.pageUrl,
    note: 'Ranked interactive elements (named-first, by role). Act on one via browser_act (by name) or click_ref/form_input (by ref).'
  };
}

// === Performance metrics (Sprint 3) =========================================
// Core Web Vitals (LCP/CLS/FCP) from buffered PerformanceObserver entries +
// navigation timing (TTFB, DOMContentLoaded, load) + resource summary.
async function getPerformance(tabId, params = {}) {
  // FCP / LCP are only recorded for VISIBLE tabs. Agent tabs are usually
  // backgrounded (visibilityState=hidden) → those metrics come back null.
  // Paint timing needs VISIBILITY, not focus:
  //   activate:true → measure a FRESH load in a temporary UNFOCUSED popup
  //     window — no OS-focus steal, the user's active tab is untouched.
  //   focus:true → legacy escalation: foreground THIS tab + reload (steals
  //     focus). Only needed if the passive window came back occluded.
  const collector = async () => {
    // LCP / CLS / paint are observer-only entry types — getEntriesByType()
    // does NOT return them. Use buffered PerformanceObserver to read past entries.
    const acc = { fcp: null, lcp: null, cls: 0 };
    const observers = [];
    const watch = (type, cb) => {
      try {
        const o = new PerformanceObserver((list) => { for (const e of list.getEntries()) cb(e); });
        o.observe({ type, buffered: true });
        observers.push(o);
      } catch (_) { /* type unsupported */ }
    };
    watch('paint', (e) => { if (e.name === 'first-contentful-paint') acc.fcp = e.startTime; });
    watch('largest-contentful-paint', (e) => { acc.lcp = e.startTime || e.renderTime || e.loadTime; });
    watch('layout-shift', (e) => { if (!e.hadRecentInput) acc.cls += e.value; });
    await new Promise((res) => setTimeout(res, 500));   // let buffered entries flush
    observers.forEach((o) => o.disconnect());

    const nav = performance.getEntriesByType('navigation')[0] || {};
    const res = performance.getEntriesByType('resource') || [];
    const bytes = res.reduce((s, x) => s + (x.transferSize || 0), 0);
    const round = (v) => (v == null ? null : Math.round(v));
    return {
      url: location.href,
      ttfb_ms: round(nav.responseStart),
      domContentLoaded_ms: round(nav.domContentLoadedEventEnd),
      load_ms: round(nav.loadEventEnd),
      fcp_ms: round(acc.fcp),
      lcp_ms: round(acc.lcp),
      cls: Math.round(acc.cls * 1000) / 1000,
      resources: { count: res.length, transferBytes: bytes },
      visibility: document.visibilityState
    };
  };

  const settleAfterLoad = async (targetTabId) => {
    // Capped below the bridge's 30s command timeout so the result is never
    // lost to a transport timeout while the extension is still polling.
    const deadline = Date.now() + Math.min(params.timeout || 15000, 25000);
    while (Date.now() < deadline) {
      const tab = await chrome.tabs.get(targetTabId).catch(() => null);
      if (!tab) throw new Error('Measured tab disappeared before metrics could be read (window closed?). Re-run, or escalate with focus:true.');
      // tab.status, NOT an injected readyState probe: the initial about:blank
      // document reports readyState=complete before the real URL even commits.
      if (tab.status === 'complete' && !/^about:blank/i.test(tab.url || '')) break;
      await new Promise((res) => setTimeout(res, 300));
    }
    await new Promise((res) => setTimeout(res, 1200)); // let LCP settle after load
  };

  if (params.activate && !params.focus) {
    const tab = await chrome.tabs.get(tabId);
    if (!/^https?:/i.test(tab.url || '')) throw new Error(`Cannot measure "${tab.url}": passive window supports http(s) pages only`);
    let win = null;
    try {
      win = await chrome.windows.create({ url: tab.url, type: 'popup', focused: false, width: 1280, height: 800, left: 0, top: 0 });
      const measuredTabId = win.tabs?.[0]?.id;
      if (measuredTabId == null) throw new Error('Passive measurement window created without a tab');
      await settleAfterLoad(measuredTabId);
      const r = await chrome.scripting.executeScript({ target: { tabId: measuredTabId }, world: 'MAIN', func: collector });
      const out = r?.[0]?.result || { error: 'performance read failed' };
      out.measuredIn = 'passive-window';
      out.note = out.error
        ? 'Collector failed inside the measurement window — no metrics were read. Re-run, or escalate with focus:true.'
        : out.visibility === 'hidden'
          ? 'Passive window was fully occluded (visibility=hidden) — FCP/LCP may be missing. Free up some screen area, or escalate with focus:true (legacy foreground+reload, steals focus).'
          : 'Fresh load measured in a temporary unfocused window — no focus steal, user’s active tab untouched. INP not captured passively.';
      return out;
    } finally {
      if (win?.id != null) await chrome.windows.remove(win.id).catch(() => { /* window already gone */ });
    }
  }

  let activated = false;
  if (params.focus) {
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.windows.update(tab.windowId, { focused: true });
      await chrome.tabs.update(tabId, { active: true });
      await chrome.tabs.reload(tabId);
      await settleAfterLoad(tabId);
      activated = true;
    } catch (_) { /* fall through to measure anyway */ }
  }

  const r = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: collector });
  const out = r?.[0]?.result || { error: 'performance read failed' };
  out.activated = activated;
  out.measuredIn = activated ? 'foregrounded-tab' : 'in-place';
  out.note = (out.fcp_ms == null && !activated)
    ? 'FCP/LCP are null because the agent tab is backgrounded (paint timing needs a visible tab). Re-call with activate:true to measure a fresh load in a temporary unfocused window (no focus steal). INP not captured passively.'
    : 'CWV from buffered PerformanceObserver (lab). INP is interaction-based and not captured passively.';
  return out;
}

async function extractData(tabId, selector) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel) => {
      const elements = document.querySelectorAll(sel);
      return Array.from(elements).map(el => ({
        text: el.textContent.trim(),
        html: el.innerHTML,
        attributes: Object.fromEntries(
          Array.from(el.attributes).map(attr => [attr.name, attr.value])
        )
      }));
    },
    args: [selector]
  });
  return result[0].result;
}

// --- Get Text ---
async function getText(tabId, selector) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel) => {
      const element = document.querySelector(sel);
      if (!element) return { __missing: true };
      return element.textContent.trim();
    },
    args: [selector]
  });
  const value = result?.[0]?.result;

  // CDP-fallback: some sites (e.g. Notion) block raw textContent and return
  // empty / nothing. Fall back to the accessibility tree, which still works.
  const empty = value == null || value.__missing || (typeof value === 'string' && value.length === 0);
  if (empty) {
    try {
      const page = await accessibilityTree.readPage(tabId, { interactiveOnly: false });
      const text = typeof page === 'string' ? page : (page?.text || JSON.stringify(page));
      return { text, source: 'accessibility-tree', fallback: true };
    } catch (_) {
      if (value?.__missing) throw new Error(`Element not found: ${selector}`);
    }
  }
  return value;
}

// --- Scroll ---
async function scrollPage(tabId, direction = 'down', amount = 500) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: (dir, amt) => {
      const scrollAmount = dir === 'up' ? -amt : amt;
      window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      return {
        scrolled: true,
        direction: dir,
        amount: amt,
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight
      };
    },
    args: [direction, amount]
  });
  return result[0].result;
}

// --- History Navigation ---
async function goBack(tabId) {
  await chrome.tabs.goBack(tabId);
  return { action: 'back', tabId };
}

async function goForward(tabId) {
  await chrome.tabs.goForward(tabId);
  return { action: 'forward', tabId };
}

// --- Agent Tab Operations ---
async function createAgentTab(url) {
  const tab = await tabGroupManager.createTab(url);
  return { tabId: tab.id, url: tab.url || url, groupId: tabGroupManager.groupId };
}

async function switchAgentTab(tabId) {
  const tab = await tabGroupManager.getAgentTab(tabId);
  await chrome.tabs.update(tab.id, { active: true });
  return { tabId: tab.id, active: true };
}

// === WebSocket Helpers ===

function sendMessage(message) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify(message));
  }
}

function handleError(error) {
  console.error('[Browser Agent v2] WebSocket error:', error);
  chrome.action.setBadgeText({ text: '✗' });
  chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
}

function handleClose() {
  console.log('[Browser Agent v2] Disconnected');
  chrome.action.setBadgeText({ text: '✗' });
  chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
  scheduleReconnect();
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectAttempts++;
  const delay = Math.min(
    RECONNECT_DELAY_MIN * Math.pow(RECONNECT_BACKOFF_MULTIPLIER, reconnectAttempts - 1),
    RECONNECT_DELAY_MAX
  );
  console.log(`[Browser Agent v2] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts})`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    fetchAuthToken().then(() => connectToBridge()).catch(() => connectToBridge());
  }, delay);
}

// === Popup Communication ===

// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    (async () => {
      const agentTabs = await tabGroupManager.listAgentTabs();
      sendResponse({
        connected: websocket && websocket.readyState === WebSocket.OPEN,
        profileId,
        alias: profileAlias,
        version: '2.1.0',
        agentTabs: agentTabs.length,
        agentTabsList: agentTabs,
        groupId: tabGroupManager.groupId,
        recording: recorder.getStatus(),
        plan: currentPlan
      });
    })();
    return true;
  }

  if (request.action === 'getActionLog') {
    sendResponse({ entries: actionLog.slice(-30) });
    return true;
  }

  if (request.action === 'setAlias') {
    (async () => {
      try {
        const alias = request.alias;
        if (!/^[a-z0-9-]+$/.test(alias)) {
          sendResponse({ success: false, error: 'Alias must contain only lowercase letters, numbers, and hyphens' });
          return;
        }
        profileAlias = alias;
        await chrome.storage.local.set({ profileAlias: alias });
        if (websocket && websocket.readyState === WebSocket.OPEN) {
          sendMessage({ type: 'update_alias', profileId, alias });
        }
        sendResponse({ success: true, alias });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  return true;
});
