/**
 * Browser Agent MCP Tools
 * Defines all available tools for browser automation
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BridgeClient } from './bridge-client.js';

/**
 * Create all available tools
 */
export function createTools(): Tool[] {
  return [
    // Navigation
    {
      name: 'browser_navigate',
      description: 'Navigate to a URL in the browser',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to',
          },
          profileId: {
            type: 'string',
            description: 'Optional profile ID (uses active profile if not specified)',
          },
        },
        required: ['url'],
      },
    },

    // Interaction
    {
      name: 'browser_click',
      description: 'Click an element on the page',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to click',
          },
          profileId: {
            type: 'string',
            description: 'Optional profile ID',
          },
        },
        required: ['selector'],
      },
    },

    {
      name: 'browser_type',
      description: 'Type text into an input field',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the input element',
          },
          text: {
            type: 'string',
            description: 'Text to type',
          },
          profileId: {
            type: 'string',
            description: 'Optional profile ID',
          },
        },
        required: ['selector', 'text'],
      },
    },

    // Screenshot
    {
      name: 'browser_screenshot',
      description: 'Take a screenshot of the current page',
      inputSchema: {
        type: 'object',
        properties: {
          fullPage: {
            type: 'boolean',
            description: 'Capture full page (default: false)',
          },
          profileId: {
            type: 'string',
            description: 'Optional profile ID',
          },
        },
      },
    },

    // JavaScript execution
    {
      name: 'browser_execute_js',
      description: 'Execute JavaScript code on the page',
      inputSchema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'JavaScript code to execute',
          },
          profileId: {
            type: 'string',
            description: 'Optional profile ID',
          },
        },
        required: ['code'],
      },
    },

    // Data extraction
    {
      name: 'browser_extract',
      description: 'Extract data from elements matching a selector',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for elements to extract',
          },
          profileId: {
            type: 'string',
            description: 'Optional profile ID',
          },
        },
        required: ['selector'],
      },
    },

    {
      name: 'browser_get_text',
      description: 'Get text content of an element',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element',
          },
          profileId: {
            type: 'string',
            description: 'Optional profile ID',
          },
        },
        required: ['selector'],
      },
    },

    // Tab management
    {
      name: 'browser_list_tabs',
      description: 'List all open tabs',
      inputSchema: {
        type: 'object',
        properties: {
          profileId: {
            type: 'string',
            description: 'Optional profile ID',
          },
        },
      },
    },

    {
      name: 'browser_switch_tab',
      description: 'Switch to a specific tab',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Tab ID to switch to',
          },
        },
        required: ['tabId'],
      },
    },

    {
      name: 'browser_new_tab',
      description: 'Open a new tab',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to open in new tab (optional)',
          },
          profileId: {
            type: 'string',
            description: 'Optional profile ID',
          },
        },
      },
    },

    {
      name: 'browser_close_tab',
      description: 'Close a specific tab',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: {
            type: 'number',
            description: 'Tab ID to close',
          },
        },
        required: ['tabId'],
      },
    },

    // Profile management
    {
      name: 'browser_list_profiles',
      description: 'List all connected browser profiles',
      inputSchema: {
        type: 'object',
        properties: {},
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
        { type: 'navigate', params: { url: params.url } },
        profileId
      );

    // Interaction
    case 'browser_click':
      return await bridgeClient.executeCommand(
        { type: 'click', params: { selector: params.selector } },
        profileId
      );

    case 'browser_type':
      return await bridgeClient.executeCommand(
        { type: 'type', params: { selector: params.selector, text: params.text } },
        profileId
      );

    // Screenshot
    case 'browser_screenshot':
      return await bridgeClient.executeCommand(
        { type: 'screenshot', params: { fullPage: params.fullPage || false } },
        profileId
      );

    // JavaScript execution
    case 'browser_execute_js':
      return await bridgeClient.executeCommand(
        { type: 'execute_js', params: { code: params.code } },
        profileId
      );

    // Data extraction
    case 'browser_extract':
      return await bridgeClient.executeCommand(
        { type: 'extract', params: { selector: params.selector } },
        profileId
      );

    case 'browser_get_text':
      return await bridgeClient.executeCommand(
        { type: 'get_text', params: { selector: params.selector } },
        profileId
      );

    // Tab management
    case 'browser_list_tabs':
      return await bridgeClient.executeCommand({ type: 'list_tabs', params: {} }, profileId);

    case 'browser_switch_tab':
      return await bridgeClient.executeCommand(
        { type: 'switch_tab', params: { tabId: params.tabId } },
        profileId
      );

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

    // Profile management
    case 'browser_list_profiles':
      return await bridgeClient.listProfiles();

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
