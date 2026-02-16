// Browser Agent Background Service Worker
// Handles WebSocket connection to Bridge Server and command execution

const BRIDGE_URL = 'ws://localhost:18792';
const RECONNECT_DELAY_MIN = 1000; // 1 second
const RECONNECT_DELAY_MAX = 30000; // 30 seconds
const RECONNECT_BACKOFF_MULTIPLIER = 1.5;

let websocket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let profileId = null;
let authToken = null;

// Keep Service Worker alive
let keepAliveInterval = null;

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    // Send empty message to keep worker alive
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000); // Every 20 seconds
}

// Initialize on extension install/startup
chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);

// Start immediately
init();

async function init() {
  console.log('[Browser Agent] Initializing...');

  // Load stored profile ID
  const stored = await chrome.storage.local.get(['profileId']);
  profileId = stored.profileId || generateProfileId();

  // Save profile ID to storage
  await chrome.storage.local.set({ profileId });

  console.log('[Browser Agent] Profile ID:', profileId);

  // Fetch auth token from Bridge Server
  await fetchAuthToken();

  // Start keep-alive to prevent service worker from stopping
  startKeepAlive();

  // Connect to Bridge Server
  connectToBridge();
}

function generateProfileId() {
  // Auto-detect browser type and create unique ID
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
      console.log('[Browser Agent] Auth token received from Bridge Server');
    } else {
      console.error('[Browser Agent] Failed to fetch auth token:', data.error);
    }
  } catch (error) {
    console.error('[Browser Agent] Error fetching auth token:', error);
  }
}

function connectToBridge() {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    console.log('[Browser Agent] Already connected');
    return;
  }

  console.log('[Browser Agent] Connecting to Bridge Server...');

  // Include auth token in WebSocket URL
  if (!authToken) {
    console.error('[Browser Agent] Cannot connect: No auth token available');
    scheduleReconnect();
    return;
  }

  const wsUrl = `${BRIDGE_URL}?token=${authToken}`;

  try {
    websocket = new WebSocket(wsUrl);

    websocket.onopen = handleConnect;
    websocket.onmessage = handleMessage;
    websocket.onerror = handleError;
    websocket.onclose = handleClose;
  } catch (error) {
    console.error('[Browser Agent] Connection failed:', error);
    scheduleReconnect();
  }
}

function handleConnect() {
  console.log('[Browser Agent] Connected to Bridge Server');

  // Reset reconnect attempts on successful connection
  reconnectAttempts = 0;

  // Clear reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Register with Bridge
  sendMessage({
    type: 'register',
    profileId,
    authToken,
    browserInfo: {
      name: 'chrome',
      version: navigator.userAgent
    }
  });

  // Update badge
  chrome.action.setBadgeText({ text: '✓' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
}

async function handleMessage(event) {
  let message;
  try {
    message = JSON.parse(event.data);
    console.log('[Browser Agent] Received:', message.type);

    // Ignore non-command messages (like "registered")
    if (!message.id) {
      console.log('[Browser Agent] Ignoring non-command message:', message.type);
      return;
    }

    // Handle command
    const result = await executeCommand(message);

    // Send response
    sendMessage({
      id: message.id,
      success: true,
      result
    });
  } catch (error) {
    console.error('[Browser Agent] Command failed:', error);

    sendMessage({
      id: message?.id,
      success: false,
      error: error.message
    });
  }
}

async function executeCommand(command) {
  const { type, params, tabId } = command;

  // Commands that don't require a target tab
  const noTabCommands = ['list_tabs', 'new_tab', 'switch_tab', 'close_tab'];

  // Get target tab only if needed
  let targetTabId = tabId;
  if (!noTabCommands.includes(type) && !targetTabId) {
    const activeTab = await getActiveTab();
    if (!activeTab) {
      throw new Error('No active tab found. Please specify tabId or open a tab.');
    }
    targetTabId = activeTab.id;
  }

  switch (type) {
    case 'navigate':
      return await navigate(targetTabId, params.url);

    case 'click':
      return await clickElement(targetTabId, params.selector);

    case 'type':
      return await typeText(targetTabId, params.selector, params.text);

    case 'screenshot':
      return await takeScreenshot(targetTabId, params.fullPage);

    case 'execute_js':
      return await executeJS(targetTabId, params.code);

    case 'extract':
      return await extractData(targetTabId, params.selector);

    case 'get_text':
      return await getText(targetTabId, params.selector);

    case 'list_tabs':
      return await listTabs();

    case 'switch_tab':
      return await switchTab(params.tabId);

    case 'close_tab':
      return await closeTab(params.tabId);

    case 'new_tab':
      return await newTab(params.url);

    default:
      throw new Error(`Unknown command type: ${type}`);
  }
}

// Navigation
async function navigate(tabId, url) {
  await chrome.tabs.update(tabId, { url });

  // Wait for load
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve({ url, status: 'loaded' });
      }
    });
  });
}

// Click element
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

// Type text
async function typeText(tabId, selector, text) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel, txt) => {
      const element = document.querySelector(sel);
      if (!element) throw new Error(`Element not found: ${sel}`);

      element.focus();
      element.value = txt;

      // Trigger input events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      return { typed: true, selector: sel, text: txt };
    },
    args: [selector, text]
  });

  return result[0].result;
}

// Screenshot
async function takeScreenshot(tabId, fullPage = false) {
  // Switch to tab first
  await chrome.tabs.update(tabId, { active: true });

  // Capture visible tab
  const dataUrl = await chrome.tabs.captureVisibleTab(null, {
    format: 'png'
  });

  return { screenshot: dataUrl, fullPage };
}

// Execute JavaScript
async function executeJS(tabId, code) {
  console.log('[Browser Agent] executeJS called with code:', code);
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',  // Execute in page context, not isolated world
      func: (codeString) => {
        // Use eval in page context - simpler and more reliable
        return eval(codeString);
      },
      args: [code]
    });

    console.log('[Browser Agent] executeScript raw result:', result);
    console.log('[Browser Agent] result[0]:', result?.[0]);
    console.log('[Browser Agent] result[0].result:', result?.[0]?.result);
    const finalResult = result && result[0] ? result[0].result : null;
    console.log('[Browser Agent] executeJS returning:', finalResult);
    return finalResult;
  } catch (error) {
    console.error('[Browser Agent] executeJS error:', error);
    return null;
  }
}

// Extract data
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

// Get text
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

// Tab management
function isSystemPage(url) {
  if (!url) return true;
  const systemPrefixes = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'browser://'];
  return systemPrefixes.some(prefix => url.startsWith(prefix));
}

async function getActiveTab() {
  console.log('[Browser Agent] getActiveTab called');

  // Try to get active tab in any window
  let activeTabs = await chrome.tabs.query({ active: true });
  console.log('[Browser Agent] Active tabs:', activeTabs.length, activeTabs.map(t => t.url));

  // If active tab is not a system page, use it
  if (activeTabs.length > 0 && !isSystemPage(activeTabs[0].url)) {
    console.log('[Browser Agent] Using active tab:', activeTabs[0].id, activeTabs[0].url);
    return activeTabs[0];
  }

  console.log('[Browser Agent] Active tab is system page, looking for accessible tabs...');

  // Otherwise, get ALL tabs and filter out system pages
  const allTabs = await chrome.tabs.query({});
  console.log('[Browser Agent] All tabs:', allTabs.length);

  const accessibleTabs = allTabs.filter(tab => !isSystemPage(tab.url));
  console.log('[Browser Agent] Accessible tabs after filtering:', accessibleTabs.length, accessibleTabs.slice(0, 3).map(t => t.url));

  if (accessibleTabs.length === 0) {
    throw new Error('No accessible web pages found. All tabs are system pages (chrome://, chrome-extension://).');
  }

  // Sort by last accessed and return most recent
  const sortedTabs = accessibleTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  const selectedTab = sortedTabs[0];
  console.log('[Browser Agent] Selected tab:', selectedTab.id, selectedTab.url);

  return selectedTab;
}

async function listTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.map(tab => ({
    id: tab.id,
    url: tab.url,
    title: tab.title,
    active: tab.active
  }));
}

async function switchTab(tabId) {
  await chrome.tabs.update(tabId, { active: true });
  return { tabId, active: true };
}

async function closeTab(tabId) {
  await chrome.tabs.remove(tabId);
  return { tabId, closed: true };
}

async function newTab(url) {
  const tab = await chrome.tabs.create({ url });
  return { tabId: tab.id, url: tab.url };
}

// WebSocket helpers
function sendMessage(message) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify(message));
  } else {
    console.warn('[Browser Agent] Cannot send message, not connected');
  }
}

function handleError(error) {
  console.error('[Browser Agent] WebSocket error:', error);
  updateBadgeDisconnected();
}

function handleClose() {
  console.log('[Browser Agent] Disconnected from Bridge Server');
  updateBadgeDisconnected();
  scheduleReconnect();
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectAttempts++;

  // Calculate delay with exponential backoff
  const delay = Math.min(
    RECONNECT_DELAY_MIN * Math.pow(RECONNECT_BACKOFF_MULTIPLIER, reconnectAttempts - 1),
    RECONNECT_DELAY_MAX
  );

  console.log(`[Browser Agent] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts})...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    // Refresh auth token before reconnecting
    fetchAuthToken().then(() => {
      connectToBridge();
    }).catch((error) => {
      console.error('[Browser Agent] Failed to refresh auth token:', error);
      // Try to reconnect anyway
      connectToBridge();
    });
  }, delay);
}

function updateBadgeDisconnected() {
  chrome.action.setBadgeText({ text: '✗' });
  chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    sendResponse({
      connected: websocket && websocket.readyState === WebSocket.OPEN,
      profileId
    });
  }
  return true;
});
