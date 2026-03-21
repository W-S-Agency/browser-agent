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

    // === Accessibility Tree (Phase 2) ===
    {
      name: 'browser_read_page',
      description: 'Read the page as a structured accessibility tree with ref IDs. Returns semantic roles (button, link, textbox, heading, etc.) instead of raw HTML. Use refs with browser_click_ref, browser_form_input, browser_scroll_to.',
      inputSchema: {
        type: 'object',
        properties: {
          interactiveOnly: { type: 'boolean', description: 'Only return interactive elements like buttons, inputs, links (default: false)' },
          maxDepth: { type: 'number', description: 'Max tree depth (default: 15)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_find',
      description: 'Find elements on the page by text query. Searches through accessibility tree (roles, names, values, descriptions). Returns matching refs.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search for (e.g., "Сохранить", "email", "Submit")' },
          maxResults: { type: 'number', description: 'Max results (default: 10)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['query'],
      },
    },

    {
      name: 'browser_form_input',
      description: 'Smart form input by ref. Auto-detects element type: text/textarea (sets value), select (finds option by value or text), checkbox (toggle), radio (select), date/time/number/range/color (format-aware). Dispatches input+change+blur events for framework reactivity.',
      inputSchema: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Element ref from browser_read_page or browser_find (e.g., "ref_5")' },
          value: { type: 'string', description: 'Value to set (for checkbox: "true"/"false", for select: option value or text)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['ref', 'value'],
      },
    },

    {
      name: 'browser_click_ref',
      description: 'Click an element by ref (from browser_read_page or browser_find). Scrolls element into view first.',
      inputSchema: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Element ref (e.g., "ref_12")' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['ref'],
      },
    },

    {
      name: 'browser_scroll_to',
      description: 'Scroll to an element by ref. Brings the element into center of viewport.',
      inputSchema: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Element ref (e.g., "ref_8")' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['ref'],
      },
    },

    // === computer_use (Phase 2) ===
    {
      name: 'browser_mouse',
      description: 'CDP mouse control: click at coordinates, hover, double-click. Works on canvas, maps, charts where CSS selectors fail.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['click', 'doubleclick', 'hover'], description: 'Mouse action' },
          x: { type: 'number', description: 'X coordinate (pixels)' },
          y: { type: 'number', description: 'Y coordinate (pixels)' },
          button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button (default: left)' },
          modifiers: { type: 'array', items: { type: 'string' }, description: 'Modifier keys: alt, ctrl, meta, shift' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['action', 'x', 'y'],
      },
    },

    {
      name: 'browser_drag',
      description: 'Drag from (x1,y1) to (x2,y2) with interpolated mouse moves. For charts, sliders, drag-and-drop.',
      inputSchema: {
        type: 'object',
        properties: {
          x1: { type: 'number', description: 'Start X' },
          y1: { type: 'number', description: 'Start Y' },
          x2: { type: 'number', description: 'End X' },
          y2: { type: 'number', description: 'End Y' },
          steps: { type: 'number', description: 'Interpolation steps (default: 10)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['x1', 'y1', 'x2', 'y2'],
      },
    },

    {
      name: 'browser_keyboard',
      description: 'CDP keyboard: type text character-by-character or press keys with modifiers. Examples: key="Enter", key="a" modifiers=["ctrl"] for Ctrl+A.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['type', 'key'], description: '"type" for text input, "key" for single key press' },
          text: { type: 'string', description: 'Text to type (for action="type")' },
          key: { type: 'string', description: 'Key name (for action="key"): Enter, Tab, Escape, ArrowDown, Backspace, a-z, F1-F12' },
          modifiers: { type: 'array', items: { type: 'string' }, description: 'Modifier keys: alt, ctrl, meta, shift' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['action'],
      },
    },

    {
      name: 'browser_screenshot_element',
      description: 'Screenshot a specific element by ref or CSS selector. Clips to element bounds with optional padding.',
      inputSchema: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Element ref (from browser_read_page)' },
          selector: { type: 'string', description: 'CSS selector (alternative to ref)' },
          padding: { type: 'number', description: 'Padding around element in pixels (default: 0)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_screenshot_responsive',
      description: 'Take screenshots at multiple viewport sizes (mobile, tablet, desktop). Uses CDP viewport override.',
      inputSchema: {
        type: 'object',
        properties: {
          viewports: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                width: { type: 'number' },
                height: { type: 'number' },
              },
            },
            description: 'Custom viewports. Default: mobile(375x812), tablet(768x1024), desktop(1440x900)',
          },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    // === Design Extraction (Phase 2) ===
    {
      name: 'browser_extract_design',
      description: 'Extract design tokens from a page section: colors (text, background), typography (fonts, weights, sizes), spacing, border radius. For 2P Builder pipeline.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for section to analyze (default: body = full page)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_extract_palette',
      description: 'Extract full color palette from a page. Returns categorized colors (primary, secondary, accent, neutral) + ready-to-use Tailwind config fragment.',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_extract_section',
      description: 'Extract a section for reproduction: HTML, computed styles, images, links, structure. For recreating sections in new projects.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for the section' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['selector'],
      },
    },

    {
      name: 'browser_extract_seo',
      description: 'SEO audit: title, meta description, Open Graph, Twitter cards, JSON-LD structured data, heading structure (H1-H6), image alts, internal/external links count.',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
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

    // === Accessibility Tree (Phase 2) ===
    case 'browser_read_page':
      return await bridgeClient.executeCommand(
        { type: 'read_page', params: { interactiveOnly: params.interactiveOnly, maxDepth: params.maxDepth, tabId: params.tabId } },
        profileId
      );

    case 'browser_find':
      return await bridgeClient.executeCommand(
        { type: 'find', params: { query: params.query, maxResults: params.maxResults, tabId: params.tabId } },
        profileId
      );

    case 'browser_form_input':
      return await bridgeClient.executeCommand(
        { type: 'form_input', params: { ref: params.ref, value: params.value, tabId: params.tabId } },
        profileId
      );

    case 'browser_click_ref':
      return await bridgeClient.executeCommand(
        { type: 'click_ref', params: { ref: params.ref, tabId: params.tabId } },
        profileId
      );

    case 'browser_scroll_to':
      return await bridgeClient.executeCommand(
        { type: 'scroll_to', params: { ref: params.ref, tabId: params.tabId } },
        profileId
      );

    // === computer_use (Phase 2) ===
    case 'browser_mouse': {
      const mouseAction = params.action;
      if (mouseAction === 'hover') {
        return await bridgeClient.executeCommand(
          { type: 'mouse_hover', params: { x: params.x, y: params.y, tabId: params.tabId } },
          profileId
        );
      }
      return await bridgeClient.executeCommand(
        { type: 'mouse_click', params: {
          x: params.x, y: params.y,
          button: params.button,
          clickCount: mouseAction === 'doubleclick' ? 2 : 1,
          modifiers: params.modifiers,
          tabId: params.tabId
        }},
        profileId
      );
    }

    case 'browser_drag':
      return await bridgeClient.executeCommand(
        { type: 'mouse_drag', params: {
          x1: params.x1, y1: params.y1, x2: params.x2, y2: params.y2,
          steps: params.steps, tabId: params.tabId
        }},
        profileId
      );

    case 'browser_keyboard': {
      if (params.action === 'type') {
        return await bridgeClient.executeCommand(
          { type: 'keyboard_type', params: { text: params.text, tabId: params.tabId } },
          profileId
        );
      }
      return await bridgeClient.executeCommand(
        { type: 'keyboard_key', params: { key: params.key, modifiers: params.modifiers, tabId: params.tabId } },
        profileId
      );
    }

    case 'browser_screenshot_element':
      return await bridgeClient.executeCommand(
        { type: 'screenshot_element', params: { ref: params.ref, selector: params.selector, padding: params.padding, tabId: params.tabId } },
        profileId
      );

    case 'browser_screenshot_responsive':
      return await bridgeClient.executeCommand(
        { type: 'screenshot_responsive', params: { viewports: params.viewports, tabId: params.tabId } },
        profileId
      );

    // === Design Extraction (Phase 2) ===
    case 'browser_extract_design':
      return await bridgeClient.executeCommand(
        { type: 'extract_design', params: { selector: params.selector, tabId: params.tabId } },
        profileId
      );

    case 'browser_extract_palette':
      return await bridgeClient.executeCommand(
        { type: 'extract_palette', params: { tabId: params.tabId } },
        profileId
      );

    case 'browser_extract_section':
      return await bridgeClient.executeCommand(
        { type: 'extract_section', params: { selector: params.selector, tabId: params.tabId } },
        profileId
      );

    case 'browser_extract_seo':
      return await bridgeClient.executeCommand(
        { type: 'extract_seo', params: { tabId: params.tabId } },
        profileId
      );

    // Cleanup
    case 'browser_cleanup':
      return await bridgeClient.executeCommand({ type: 'cleanup', params: {} }, profileId);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
