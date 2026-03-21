// Browser Agent v2.0 Background Service Worker
// Tab Group Isolation + CDP Screenshots + Accessibility Tree + computer_use + Design Extraction

// Import modules (Manifest V3 Service Worker)
importScripts(
  'tab-group-manager.js',
  'cdp-screenshot.js',
  'accessibility-tree.js',
  'computer-use.js',
  'design-extractor.js'
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

// Keep Service Worker alive
let keepAliveInterval = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000);
}

// Initialize on extension install/startup
chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);

// Clean up agent tabs on tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  tabGroupManager.onTabRemoved(tabId);
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
      agentVersion: '2.0.0'
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
    case 'execute_js': return (p.code || '').substring(0, 40);
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

    // --- JavaScript ---
    case 'execute_js':
      return await executeJS(await resolveAgentTabId(params.tabId), params.code);

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

    // --- Cleanup ---
    case 'cleanup':
      await tabGroupManager.cleanup();
      await cdpScreenshot.cleanup();
      return { cleaned: true };

    default:
      throw new Error(`Unknown command type: ${type}`);
  }
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
async function executeJS(tabId, code) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (codeString) => eval(codeString),
      args: [code]
    });
    return result?.[0]?.result ?? null;
  } catch (error) {
    console.error('[Browser Agent v2] executeJS error:', error);
    return { error: error.message };
  }
}

// --- Data Extraction ---
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
      if (!element) throw new Error(`Element not found: ${sel}`);
      return element.textContent.trim();
    },
    args: [selector]
  });
  return result[0].result;
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
        version: '2.0.0',
        agentTabs: agentTabs.length,
        agentTabsList: agentTabs,
        groupId: tabGroupManager.groupId
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
