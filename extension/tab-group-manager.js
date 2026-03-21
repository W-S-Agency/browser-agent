// Tab Group Manager
// Isolates agent tabs from user tabs using Chrome Tab Groups API
// Agent works in its own group — never touches user's tabs

const AGENT_GROUP_TITLE = '🤖 Agent';
const AGENT_GROUP_COLOR = 'blue';

class TabGroupManager {
  constructor() {
    this.groupId = null;
    this.agentTabIds = new Set();
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

    // Look for existing agent group in any window
    const groups = await chrome.tabGroups.query({ title: AGENT_GROUP_TITLE });
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

    // Style the group
    await chrome.tabGroups.update(this.groupId, {
      title: AGENT_GROUP_TITLE,
      color: AGENT_GROUP_COLOR,
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
      throw new Error(`Tab ${tabId} is not an agent tab. Cannot close user tabs.`);
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

// Export singleton
const tabGroupManager = new TabGroupManager();