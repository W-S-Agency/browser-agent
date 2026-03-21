/**
 * Browser Agent MCP Tools v2.0
 * Tab Group Isolation + CDP Screenshots + Smart Input
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BridgeClient } from './bridge-client.js';

export function createTools(): Tool[] {
  return [
    // === Navigation ===
    {
      name: 'browser_navigate',
      description: 'Navigate to a URL. Opens in agent tab group (isolated from user tabs). Creates a new agent tab if none exists.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to navigate to' },
          tabId: { type: 'number', description: 'Specific agent tab ID (optional, uses active agent tab)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional, uses active profile)' },
        },
        required: ['url'],
      },
    },

    {
      name: 'browser_go_back',
      description: 'Go back in browser history',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_go_forward',
      description: 'Go forward in browser history',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    // === Interaction ===
    {
      name: 'browser_click',
      description: 'Click an element on the page by CSS selector',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for the element to click' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['selector'],
      },
    },

    {
      name: 'browser_type',
      description: 'Type text into an input field. Smart detection: handles text inputs, textareas, selects, checkboxes, and radio buttons automatically.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for the input element' },
          text: { type: 'string', description: 'Text to type (for select: option value or text; for checkbox/radio: true/false)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['selector', 'text'],
      },
    },

    // === Screenshot (CDP — no focus hijack) ===
    {
      name: 'browser_screenshot',
      description: 'Take a screenshot using CDP (does NOT steal browser focus). Supports fullPage and optimized mode for LLM token efficiency.',
      inputSchema: {
        type: 'object',
        properties: {
          fullPage: { type: 'boolean', description: 'Capture full page scroll height (default: false)' },
          optimized: { type: 'boolean', description: 'Downscale for LLM token efficiency (default: false)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    // === Scroll ===
    {
      name: 'browser_scroll',
      description: 'Scroll the page up or down',
      inputSchema: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction (default: down)' },
          amount: { type: 'number', description: 'Scroll amount in pixels (default: 500)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    // === JavaScript ===
    {
      name: 'browser_execute_js',
      description: 'Execute JavaScript code on the page (runs in page context)',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript code to execute' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['code'],
      },
    },

    // === Data Extraction ===
    {
      name: 'browser_extract',
      description: 'Extract structured data from elements matching a CSS selector (text, html, attributes)',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for elements to extract' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['selector'],
      },
    },

    {
      name: 'browser_get_text',
      description: 'Get text content of an element by CSS selector',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for the element' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['selector'],
      },
    },

    // === Tab Management (Agent Group) ===
    {
      name: 'browser_list_tabs',
      description: 'List agent tabs only (tabs in the 🤖 Agent group). Does NOT show user tabs.',
      inputSchema: {
        type: 'object',
        properties: {
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_list_all_tabs',
      description: 'List ALL tabs (agent + user). Agent tabs are marked with isAgentTab: true.',
      inputSchema: {
        type: 'object',
        properties: {
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_new_tab',
      description: 'Open a new tab in the agent tab group (isolated from user tabs)',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to open (optional, defaults to blank)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_close_tab',
      description: 'Close an agent tab. Cannot close user tabs (safety).',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'number', description: 'Agent tab ID to close' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['tabId'],
      },
    },

    {
      name: 'browser_switch_tab',
      description: 'Switch to a specific agent tab (makes it active)',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'number', description: 'Agent tab ID to switch to' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['tabId'],
      },
    },

    // === Profile Management ===
    {
      name: 'browser_list_profiles',
      description: 'List all connected browser profiles with aliases',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    // === Cleanup ===
    {
      name: 'browser_cleanup',
      description: 'Close all agent tabs and clean up resources. Use when done with browser automation.',
      inputSchema: {
        type: 'object',
        properties: {
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },
  ];
}

/**
 * Execute tool call
 */
export async function executeToolCall(
  toolName: string,
  args: any,
  bridgeClient: BridgeClient
): Promise<any> {
  const { profileId, ...params } = args;

  switch (toolName) {
    // Navigation
    case 'browser_navigate':
      return await bridgeClient.executeCommand(
        { type: 'navigate', params: { url: params.url, tabId: params.tabId } },
        profileId
      );

    case 'browser_go_back':
      return await bridgeClient.executeCommand(
        { type: 'go_back', params: { tabId: params.tabId } },
        profileId
      );

    case 'browser_go_forward':
      return await bridgeClient.executeCommand(
        { type: 'go_forward', params: { tabId: params.tabId } },
        profileId
      );

    // Interaction
    case 'browser_click':
      return await bridgeClient.executeCommand(
        { type: 'click', params: { selector: params.selector, tabId: params.tabId } },
        profileId
      );

    case 'browser_type':
      return await bridgeClient.executeCommand(
        { type: 'type', params: { selector: params.selector, text: params.text, tabId: params.tabId } },
        profileId
      );

    // Screenshot (CDP)
    case 'browser_screenshot':
      return await bridgeClient.executeCommand(
        { type: 'screenshot', params: { fullPage: params.fullPage, optimized: params.optimized, tabId: params.tabId } },
        profileId
      );

    // Scroll
    case 'browser_scroll':
      return await bridgeClient.executeCommand(
        { type: 'scroll', params: { direction: params.direction, amount: params.amount, tabId: params.tabId } },
        profileId
      );

    // JavaScript
    case 'browser_execute_js':
      return await bridgeClient.executeCommand(
        { type: 'execute_js', params: { code: params.code, tabId: params.tabId } },
        profileId
      );

    // Data extraction
    case 'browser_extract':
      return await bridgeClient.executeCommand(
        { type: 'extract', params: { selector: params.selector, tabId: params.tabId } },
        profileId
      );

    case 'browser_get_text':
      return await bridgeClient.executeCommand(
        { type: 'get_text', params: { selector: params.selector, tabId: params.tabId } },
        profileId
      );

    // Tab management
    case 'browser_list_tabs':
      return await bridgeClient.executeCommand({ type: 'list_tabs', params: {} }, profileId);

    case 'browser_list_all_tabs':
      return await bridgeClient.executeCommand({ type: 'list_all_tabs', params: {} }, profileId);

    case 'browser_new_tab':
      return await bridgeClient.executeCommand(
        { type: 'new_tab', params: { url: params.url } },
        profileId
      );

    case 'browser_close_tab':
      return await bridgeClient.executeCommand(
        { type: 'close_tab', params: { tabId: params.tabId } },
        profileId
      );

    case 'browser_switch_tab':
      return await bridgeClient.executeCommand(
        { type: 'switch_tab', params: { tabId: params.tabId } },
        profileId
      );

    // Profile management
    case 'browser_list_profiles':
      return await bridgeClient.listProfiles();

    // Cleanup
    case 'browser_cleanup':
      return await bridgeClient.executeCommand({ type: 'cleanup', params: {} }, profileId);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
