// Tab Group Manager
// Isolates agent tabs from user tabs using Chrome Tab Groups API
// Agent works in its own group — never touches user's tabs
//
// v2.5: SESSION-SCOPED. One TabGroupManager per MCP session (sessionId travels
// inside every command). Each session gets its OWN tab group with a unique
// title — two parallel Claude sessions on the same profile no longer share a
// group or hijack each other's tabs. Commands without a sessionId (older MCP
// server, playbook-runner) fall back to the shared 'default' manager, which
// behaves exactly like the pre-2.5 singleton.

const AGENT_GROUP_TITLE = '🤖 Agent';
// Chrome's full tab-group palette; per-session color picked by stable hash.
const GROUP_COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

class TabGroupManager {
  constructor(sessionKey = 'default') {
    this.sessionKey = sessionKey;
    // Default (legacy) sessions keep the exact pre-2.5 title so an updated
    // extension adopts groups created before the update.
    this.title = sessionKey === 'default'
      ? AGENT_GROUP_TITLE
      : `${AGENT_GROUP_TITLE} · ${sessionKey.slice(0, 6)}`;
    // Default pinned to pre-2.5 'blue' explicitly (review 🟢4: do not rely on
    // the hash landing on blue — palette reorder would silently change legacy)
    this.color = sessionKey === 'default'
      ? 'blue'
      : GROUP_COLORS[TabGroupManager.hashKey(sessionKey) % GROUP_COLORS.length];
    this.groupId = null;
    this.agentTabIds = new Set();
  }

  // Stable non-negative hash for color selection
  static hashKey(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return h >>> 0;
  }

  /**
   * Get or create the agent tab group in the specified window
   * Returns the group ID
   */
  async ensureGroup(windowId) {
    // Check if our group still exists
    if (this.groupId !== null) {
      try {
        const group = await chrome.tabGroups.get(this.groupId);
        if (group) return this.groupId;
      } catch {
        // Group was closed/removed, reset
        this.groupId = null;
      }
    }

    // Look for THIS SESSION's group (exact title match). After a Service
    // Worker restart the in-memory state is gone but the group survives in
    // the window — re-adopt it instead of creating a duplicate. The title is
    // unique per session, so this can never capture another session's group
    // (the pre-2.5 bug: query({title:'🤖 Agent'}) + groups[0] grabbed ANY
    // agent group, including one belonging to a parallel session).
    const groups = (await chrome.tabGroups.query({ title: this.title }))
      .filter(g => g.title === this.title);
    if (groups.length > 0) {
      this.groupId = groups[0].id;
      // Sync existing tabs in this group
      const tabs = await chrome.tabs.query({ groupId: this.groupId });
      tabs.forEach(tab => this.agentTabIds.add(tab.id));
      return this.groupId;
    }

    // No group exists — will be created when first tab is added
    return null;
  }

  /**
   * Create a new tab inside the agent group
   * This is the ONLY way the agent should open tabs
   */
  async createTab(url, windowId) {
    // Create tab (initially ungrouped)
    const tab = await chrome.tabs.create({
      url: url || 'about:blank',
      active: false, // Don't steal focus from user!
      windowId
    });

    // Add to agent group
    await this.addTabToGroup(tab.id, tab.windowId);
    this.agentTabIds.add(tab.id);

    return tab;
  }

  /**
   * Add an existing tab to the agent group
   */
  async addTabToGroup(tabId, windowId) {
    // Re-adopt this session's surviving group first (SW restart case)
    if (this.groupId === null) {
      await this.ensureGroup(windowId).catch(() => { /* fall through to create */ });
    }

    if (this.groupId !== null) {
      try {
        await chrome.tabs.group({ tabIds: [tabId], groupId: this.groupId });
        return this.groupId;
      } catch {
        // Group might have been removed
        this.groupId = null;
      }
    }

    // Create new group with this tab
    this.groupId = await chrome.tabs.group({ tabIds: [tabId] });

    // Style the group (per-session title + color)
    await chrome.tabGroups.update(this.groupId, {
      title: this.title,
      color: this.color,
      collapsed: false
    });

    // Move group to leftmost position (after pinned tabs)
    try {
      const pinnedTabs = await chrome.tabs.query({ pinned: true });
      const insertIndex = pinnedTabs.length;
      await chrome.tabGroups.move(this.groupId, { index: insertIndex });
    } catch {
      // If move fails, group stays where it was created — acceptable
    }

    return this.groupId;
  }

  /**
   * Navigate an agent tab to a URL
   * If no agent tabs exist, creates one
   */
  async navigate(url, tabId) {
    // If specific tabId provided and it's an agent tab, use it
    if (tabId && this.agentTabIds.has(tabId)) {
      await chrome.tabs.update(tabId, { url });
      return this.waitForLoad(tabId, url);
    }

    // Use the most recent agent tab, or create one
    let targetTab = await this.getActiveAgentTab();
    if (!targetTab) {
      targetTab = await this.createTab(url);
      return this.waitForLoad(targetTab.id, url);
    }

    await chrome.tabs.update(targetTab.id, { url });
    return this.waitForLoad(targetTab.id, url);
  }

  /**
   * Wait for tab to finish loading
   */
  waitForLoad(tabId, url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve({ tabId, url, status: 'timeout' });
      }, 30000);

      function listener(updatedTabId, info) {
        if (updatedTabId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          resolve({ tabId, url, status: 'loaded' });
        }
      }

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * Get the most recently accessed agent tab
   */
  async getActiveAgentTab() {
    if (this.agentTabIds.size === 0) return null;

    // Get all agent tabs and sort by lastAccessed
    const tabs = await chrome.tabs.query({});
    const agentTabs = tabs
      .filter(t => this.agentTabIds.has(t.id))
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

    return agentTabs[0] || null;
  }

  /**
   * Get a specific agent tab, or the active one
   * Returns null if the tab is NOT an agent tab (protection!)
   */
  async getAgentTab(tabId) {
    if (tabId) {
      if (!this.agentTabIds.has(tabId)) {
        throw new Error(
          `Tab ${tabId} is not an agent tab. Use browser_list_tabs to see agent tabs, ` +
          `or browser_new_tab to create one in the agent group.`
        );
      }
      return chrome.tabs.get(tabId);
    }
    return this.getActiveAgentTab();
  }

  /**
   * List only agent tabs (not user's tabs)
   */
  async listAgentTabs() {
    if (this.agentTabIds.size === 0) return [];

    const tabs = await chrome.tabs.query({});
    return tabs
      .filter(t => this.agentTabIds.has(t.id))
      .map(t => ({
        id: t.id,
        url: t.url,
        title: t.title,
        active: t.active,
        groupId: t.groupId
      }));
  }

  /**
   * List ALL tabs (for reference, but clearly marked)
   */
  async listAllTabs() {
    const tabs = await chrome.tabs.query({});
    return tabs.map(t => ({
      id: t.id,
      url: t.url,
      title: t.title,
      active: t.active,
      groupId: t.groupId,
      isAgentTab: this.agentTabIds.has(t.id)
    }));
  }

  /**
   * Close an agent tab
   */
  async closeTab(tabId) {
    if (!this.agentTabIds.has(tabId)) {
      throw new Error(`Tab ${tabId} is not an agent tab of this session. Cannot close user tabs or another session's tabs.`);
    }

    await chrome.tabs.remove(tabId);
    this.agentTabIds.delete(tabId);

    return { tabId, closed: true };
  }

  /**
   * Handle tab removal (cleanup)
   */
  onTabRemoved(tabId) {
    this.agentTabIds.delete(tabId);
  }

  /**
   * Cleanup — remove all agent tabs and group
   */
  async cleanup() {
    for (const tabId of this.agentTabIds) {
      try {
        await chrome.tabs.remove(tabId);
      } catch { /* tab already closed */ }
    }
    this.agentTabIds.clear();
    this.groupId = null;
  }
}

// === Session-scoped registry (v2.5) ===
// One manager (→ one tab group) per MCP session. Commands carry sessionId;
// missing/empty sessionId (older MCP server, bridge playbook-runner) maps to
// the shared 'default' manager — exact pre-2.5 behavior, fully backward
// compatible. v1: no auto-reaper — a session's manager lives until
// browser_cleanup for that session or SW restart (empty groups are cheap and
// visible; explicit cleanup removes them).
const sessionManagers = new Map(); // sessionKey -> TabGroupManager

function managerFor(sessionId) {
  const key = (typeof sessionId === 'string' && sessionId.trim()) ? sessionId.trim() : 'default';
  let m = sessionManagers.get(key);
  if (!m) {
    m = new TabGroupManager(key);
    sessionManagers.set(key, m);
  }
  return m;
}

// Which session (manager) owns a given tab — for global listeners
// (onCreated child-tab adoption) and cross-session tab marking.
function ownerOfTab(tabId) {
  for (const m of sessionManagers.values()) {
    if (m.agentTabIds.has(tabId)) return m;
  }
  return null;
}