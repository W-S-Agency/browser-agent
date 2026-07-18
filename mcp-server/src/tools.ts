/**
 * Browser Agent MCP Tools v2.0
 * Tab Group Isolation + CDP Screenshots + Smart Input
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import Ajv from 'ajv';
import { BridgeClient } from './bridge-client.js';
import { buildDesignSystem } from './design-tokens.js';

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
      description: 'Execute JavaScript code on the page (runs in page context). Top-level `return` and `await` are supported. Pass frameSelector to run the code INSIDE an iframe (works for same- and cross-origin frames) — e.g. for editors embedded in an iframe.',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript code to execute' },
          frameSelector: { type: 'string', description: 'Optional CSS selector of an <iframe> — code runs inside that frame instead of the top document.' },
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
      description: 'Extract design tokens from a page section: colors (text, background), typography (fonts, weights, sizes), spacing, border radius. For 2P Builder pipeline. Note: on canvas-based apps (Figma, Google Sheets) this extracts UI chrome colors, not canvas content.',
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
      description: 'Extract full color palette from a page. Returns categorized colors (primary, secondary, accent, neutral) + ready-to-use Tailwind config fragment. Note: on canvas-based apps (Figma) extracts UI colors, not design file colors — use Figma API for design tokens.',
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

    // === Plan Tracking ===
    {
      name: 'browser_set_plan',
      description: 'Set a plan with steps to display in the Side Panel. Shows progress to the user as you work through steps. Call browser_update_plan_step to mark steps as completed.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Plan name (e.g., "SEO Audit for 2penguins.de")' },
          steps: { type: 'array', items: { type: 'string' }, description: 'List of step descriptions' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['steps'],
      },
    },

    {
      name: 'browser_update_plan_step',
      description: 'Update a plan step status. Marks current step as completed and auto-advances to next step.',
      inputSchema: {
        type: 'object',
        properties: {
          step: { type: 'number', description: 'Step index (0-based). If omitted, updates current step.' },
          status: { type: 'string', enum: ['completed', 'in_progress', 'error', 'pending'], description: 'New status (default: completed)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_clear_plan',
      description: 'Clear the current plan from Side Panel.',
      inputSchema: {
        type: 'object',
        properties: {
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    // === Recording → Skills (Phase 4) ===
    {
      name: 'browser_start_recording',
      description: 'Start recording browser actions for skill generation. All subsequent actions (navigate, click, type, etc.) will be captured. Use browser_stop_recording when done.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Recording name (e.g., "create-deal-bitrix24")' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_stop_recording',
      description: 'Stop recording and return the recorded actions. Use browser_generate_skill to convert to a reusable SKILL.md.',
      inputSchema: {
        type: 'object',
        properties: {
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_recording_status',
      description: 'Check if recording is active and how many actions have been captured.',
      inputSchema: {
        type: 'object',
        properties: {
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_list_recordings',
      description: 'List all saved recordings with names, duration, and action counts.',
      inputSchema: {
        type: 'object',
        properties: {
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_generate_skill',
      description: 'Generate a SKILL.md file from a recording. Auto-detects parameters (text inputs, URLs) and creates a parameterized, reusable skill.',
      inputSchema: {
        type: 'object',
        properties: {
          recordingName: { type: 'string', description: 'Name of the recording to convert' },
          skillName: { type: 'string', description: 'Name for the generated skill (optional, defaults to recording name)' },
          description: { type: 'string', description: 'Skill description (optional)' },
          parameterize: { type: 'boolean', description: 'Auto-detect and parameterize inputs (default: true)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['recordingName'],
      },
    },

    // === Session / Cookies ===
    {
      name: 'browser_get_cookies',
      description: 'Get cookies from the browser via CDP. Useful for extracting auth tokens from logged-in sessions (Bitrix24, Google, Facebook Ads, etc.) to use in API calls. Returns all cookies or filtered by domain.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Filter cookies by domain (e.g. "facebook.com", "bitrix24.de"). Optional — omit to get all cookies.' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_set_cookies',
      description: 'Set cookies in the browser via CDP. Useful for restoring an auth session or injecting tokens. Pass an array of cookie objects ({name, value, domain, path?, secure?, httpOnly?, expires?}).',
      inputSchema: {
        type: 'object',
        properties: {
          cookies: {
            type: 'array',
            description: 'Array of cookie objects to set (CDP Network.CookieParam format: name, value, domain, url, path, secure, httpOnly, sameSite, expires).',
            items: { type: 'object' },
          },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['cookies'],
      },
    },

    // === Debugging ===
    {
      name: 'browser_read_console',
      description: 'Read console output (log/info/warn/error) and uncaught errors captured from the page. Capture begins at page load — navigate or reload if you expected output that happened earlier. Useful for debugging forms, SPAs, and failed API calls.',
      inputSchema: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: ['log', 'info', 'warn', 'error', 'debug'], description: 'Filter by level (optional, default all)' },
          clear: { type: 'boolean', description: 'Clear the buffer after reading (default false)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_wait_for',
      description: 'Wait until a CSS selector appears/disappears, or specific text appears on the page, or a fixed delay elapses. Returns when the condition is met or on timeout. Use for SPA timing instead of guessing.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector to wait for (optional)' },
          text: { type: 'string', description: 'Text to wait for in page body (optional)' },
          state: { type: 'string', enum: ['visible', 'hidden'], description: 'Wait for selector/text to be visible or hidden (default visible)' },
          timeout: { type: 'number', description: 'Max wait in ms (default 10000). With no selector/text, waits exactly this long.' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    // === Network / Files (Sprint 2) ===
    {
      name: 'browser_read_network',
      description: 'Read buffered network requests for the tab (URL, method, status, type, timing). Captured via webRequest from page load — navigate/reload if you expected earlier traffic. Metadata only: response BODIES are not captured (re-fetch the URL via execute_js if you need a body). Useful for debugging forms, failed API calls, redirects.',
      inputSchema: {
        type: 'object',
        properties: {
          filter: { type: 'string', description: 'Substring to match in the request URL (optional)' },
          status: { type: 'number', description: 'Filter by exact HTTP status code (optional)' },
          onlyFailed: { type: 'boolean', description: 'Only requests that failed (status 0 or >= 400)' },
          clear: { type: 'boolean', description: 'Clear the buffer after reading (default false)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_download',
      description: 'Download a file from a URL via the browser (logged-in session), wait for completion, and return the saved path. Use this instead of navigating to a download URL (which falsely reports a navigation timeout).',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL of the file to download' },
          filename: { type: 'string', description: 'Optional target filename (relative to the Downloads folder)' },
          timeout: { type: 'number', description: 'Max wait for completion in ms (default 60000)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['url'],
      },
    },

    {
      name: 'browser_upload_file',
      description: 'Set local file(s) on a <input type=file> element (CDP DOM.setFileInputFiles), so the page treats them as user-selected. Files must be absolute paths on the machine running the browser.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for the <input type=file> element' },
          files: { type: 'array', items: { type: 'string' }, description: 'Absolute file path(s) to set on the input' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['selector', 'files'],
      },
    },

    // === Self-healing action + Performance (Sprint 3) ===
    {
      name: 'browser_act',
      description: 'Self-healing action by natural-language description. Caches a CSS selector per (site, action, description); next time it tries the cached selector first (fast), and if the page changed it auto-falls back to semantic find() and re-caches. Ideal for recurring playbooks that must survive site redesigns. Actions: click, type (needs value), get_text.',
      inputSchema: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'What to act on, in words (matched against accessible name/role/value), e.g. "Senden button", "email field".' },
          action: { type: 'string', enum: ['click', 'type', 'get_text'], description: 'Action to perform (default click)' },
          value: { type: 'string', description: 'Text to type (for action=type)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['description'],
      },
    },

    {
      name: 'browser_performance',
      description: 'Read performance metrics for the current page: Core Web Vitals (LCP, CLS, FCP) + navigation timing (TTFB, DOMContentLoaded, load) + resource count/bytes. Lab data from the real logged-in Chrome session — no PageSpeed API quota. NOTE: FCP/LCP require a VISIBLE tab; agent tabs are backgrounded, so pass activate:true to measure a fresh load in a temporary UNFOCUSED window (paint is captured without stealing focus or switching the user’s active tab). If that window is fully occluded the result says so; focus:true is the legacy foreground+reload escalation.',
      inputSchema: {
        type: 'object',
        properties: {
          activate: { type: 'boolean', description: 'Measure a fresh GET load of the tab’s current URL in a temporary unfocused window to capture FCP/LCP (paint timing needs a visible tab). Does NOT steal focus or switch the user’s active tab. Note: state-dependent pages (POST results, one-time tokens) may render differently on a fresh GET. Default false.' },
          focus: { type: 'boolean', description: 'Legacy escalation: foreground THIS tab + reload (steals focus and switches the active tab). Use only if activate:true reported the passive window as occluded. If both are set, focus wins. Default false.' },
          timeout: { type: 'number', description: 'Max wait for the measured load when activate/focus is true (ms, default 15000, capped at 25000 to stay under the bridge command timeout)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_observe',
      description: 'Survey what you can act on: returns a ranked list of interactive elements (buttons, links, inputs, …) from the accessibility tree — named elements first, then by role. No LLM. Use before acting to discover targets, then act via browser_act (by name) or click_ref/form_input (by ref). Optional filter narrows by text/role.',
      inputSchema: {
        type: 'object',
        properties: {
          filter: { type: 'string', description: 'Narrow to elements whose name/role/value contains this text (optional)' },
          limit: { type: 'number', description: 'Max elements to return (default 30)' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
      },
    },

    {
      name: 'browser_extract_design_system',
      description: 'Extract a full design system from the current page in one call and return ready-to-use artifacts: DESIGN.md (AI/human design-system doc), W3C DTCG tokens (Figma via Tokens Studio), Tailwind v4 @theme CSS + v3 config, and framework-agnostic CSS :root variables — plus brand logo/favicon. Built for 2p-builder / figma-handoff. Save the returned strings to files in your project.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'Scope the design extraction to a CSS selector (default: body)' },
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

    // === Sprint 6: small parity (fill_form, extract_validated, handle_dialog) ===
    {
      name: 'browser_fill_form',
      description: 'Fill multiple form fields in one call. Pass an array of {ref, value} (refs from browser_read_page / browser_find). Each field goes through the same smart form_input (auto-detects text/select/checkbox/radio; dispatches input+change+blur for framework reactivity). Returns per-field results; a failed field does NOT abort the rest. Use after browser_observe/read_page to fill a whole form at once instead of many browser_form_input calls.',
      inputSchema: {
        type: 'object',
        properties: {
          fields: {
            type: 'array',
            description: 'Fields to fill, in order. Each item: {ref, value}.',
            items: {
              type: 'object',
              properties: {
                ref: { type: 'string', description: 'Element ref from browser_read_page / browser_find (e.g. "ref_5")' },
                value: { type: 'string', description: 'Value to set (checkbox: "true"/"false"; select: option value or text)' },
              },
              required: ['ref', 'value'],
            },
          },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['fields'],
      },
    },

    {
      name: 'browser_extract_validated',
      description: 'Extract data from the page and validate it against a JSON Schema (ajv) server-side. Provide either `code` (JavaScript that returns the data — top-level return/await supported) OR `selector` (extract element data). The result is validated against `schema`; returns {data, valid, errors}. Use when you need a guaranteed shape for downstream steps (e.g. scraping structured records) and want an explicit pass/fail instead of eyeballing the output.',
      inputSchema: {
        type: 'object',
        properties: {
          schema: { type: 'object', description: 'JSON Schema (draft-07) to validate the extracted data against.' },
          code: { type: 'string', description: 'JavaScript that returns the data to validate (alternative to selector). Runs in page context.' },
          selector: { type: 'string', description: 'CSS selector to extract data from (alternative to code).' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
          profileId: { type: 'string', description: 'Profile ID or alias (optional)' },
        },
        required: ['schema'],
      },
    },

    {
      name: 'browser_handle_dialog',
      description: 'Arm automatic handling of the NEXT native JS dialog (alert / confirm / prompt) on the tab, then perform the action that triggers it. accept:true confirms/accepts (default), accept:false dismisses/cancels; promptText fills a prompt(). Call this JUST BEFORE the click/action that opens the dialog, and do NOT run other browser tools on the same tab in between — a CDP-based tool (screenshot / cookies / upload) detaches the debugger and cancels the arm. One-shot (auto-disarms after one dialog or 30s). Note: browser beforeunload prompts are not covered.',
      inputSchema: {
        type: 'object',
        properties: {
          accept: { type: 'boolean', description: 'Accept/confirm the dialog (true, default) or dismiss/cancel it (false).' },
          promptText: { type: 'string', description: 'Text to enter into a prompt() dialog (optional).' },
          tabId: { type: 'number', description: 'Agent tab ID (optional)' },
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
        { type: 'execute_js', params: { code: params.code, frameSelector: params.frameSelector, tabId: params.tabId } },
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

    // === Plan Tracking ===
    case 'browser_set_plan':
      return await bridgeClient.executeCommand(
        { type: 'set_plan', params: { name: params.name, steps: params.steps } },
        profileId
      );

    case 'browser_update_plan_step':
      return await bridgeClient.executeCommand(
        { type: 'update_plan_step', params: { step: params.step, status: params.status || 'completed' } },
        profileId
      );

    case 'browser_clear_plan':
      return await bridgeClient.executeCommand(
        { type: 'clear_plan', params: {} },
        profileId
      );

    // === Recording → Skills (Phase 4) ===
    case 'browser_start_recording':
      return await bridgeClient.executeCommand(
        { type: 'start_recording', params: { name: params.name } },
        profileId
      );

    case 'browser_stop_recording':
      return await bridgeClient.executeCommand(
        { type: 'stop_recording', params: {} },
        profileId
      );

    case 'browser_recording_status':
      return await bridgeClient.executeCommand(
        { type: 'recording_status', params: {} },
        profileId
      );

    case 'browser_list_recordings':
      return await bridgeClient.executeCommand(
        { type: 'list_recordings', params: {} },
        profileId
      );

    case 'browser_generate_skill':
      return await bridgeClient.executeCommand(
        { type: 'generate_skill', params: {
          recordingName: params.recordingName,
          skillName: params.skillName,
          description: params.description,
          parameterize: params.parameterize
        }},
        profileId
      );

    // Cookies
    case 'browser_get_cookies':
      return await bridgeClient.executeCommand(
        { type: 'get_all_cookies', params: { domain: params.domain, tabId: params.tabId } },
        profileId
      );

    case 'browser_set_cookies':
      return await bridgeClient.executeCommand(
        { type: 'set_cookies', params: { cookies: params.cookies, tabId: params.tabId } },
        profileId
      );

    // Debugging
    case 'browser_read_console':
      return await bridgeClient.executeCommand(
        { type: 'read_console', params: { level: params.level, clear: params.clear, tabId: params.tabId } },
        profileId
      );

    case 'browser_wait_for':
      return await bridgeClient.executeCommand(
        { type: 'wait_for', params: {
          selector: params.selector, text: params.text,
          state: params.state, timeout: params.timeout, tabId: params.tabId
        }},
        profileId
      );

    // Network / Files (Sprint 2)
    case 'browser_read_network':
      return await bridgeClient.executeCommand(
        { type: 'read_network', params: {
          filter: params.filter, status: params.status,
          onlyFailed: params.onlyFailed, clear: params.clear, tabId: params.tabId
        }},
        profileId
      );

    case 'browser_download':
      return await bridgeClient.executeCommand(
        { type: 'download', params: { url: params.url, filename: params.filename, timeout: params.timeout } },
        profileId
      );

    case 'browser_upload_file':
      return await bridgeClient.executeCommand(
        { type: 'upload_file', params: { selector: params.selector, files: params.files, tabId: params.tabId } },
        profileId
      );

    // Self-healing + Performance (Sprint 3)
    case 'browser_act':
      return await bridgeClient.executeCommand(
        { type: 'act', params: { description: params.description, action: params.action, value: params.value, tabId: params.tabId } },
        profileId
      );

    case 'browser_performance':
      return await bridgeClient.executeCommand(
        { type: 'performance', params: { activate: params.activate, focus: params.focus, timeout: params.timeout, tabId: params.tabId } },
        profileId
      );

    case 'browser_observe':
      return await bridgeClient.executeCommand(
        { type: 'observe', params: { filter: params.filter, limit: params.limit, tabId: params.tabId } },
        profileId
      );

    // Design system (Sprint 5) — composes existing extract_design/palette/seo, formats server-side
    case 'browser_extract_design_system': {
      const design = await bridgeClient.executeCommand(
        { type: 'extract_design', params: { selector: params.selector, tabId: params.tabId } }, profileId);
      const palette = await bridgeClient.executeCommand(
        { type: 'extract_palette', params: { tabId: params.tabId } }, profileId);
      let logo: string | undefined, favicon: string | undefined, title: string | undefined, url: string | undefined;
      try {
        const seo = await bridgeClient.executeCommand(
          { type: 'extract_seo', params: { tabId: params.tabId } }, profileId);
        logo = seo?.openGraph?.image || seo?.structuredData?.[0]?.['@graph']?.find?.((x: any) => x?.logo)?.logo?.url;
        favicon = seo?.favicon;
        title = seo?.openGraph?.siteName || seo?.title;
        url = seo?.canonical || seo?.openGraph?.url;
      } catch (_) { /* SEO optional — design system still works without brand */ }
      return buildDesignSystem(design, palette, { url, title, logo, favicon });
    }

    // Cleanup
    case 'browser_cleanup':
      return await bridgeClient.executeCommand({ type: 'cleanup', params: {} }, profileId);

    // === Sprint 6: small parity ===
    // fill_form — server-side composition of form_input (extract_design_system precedent), no extension change.
    case 'browser_fill_form': {
      const fields = Array.isArray(params.fields) ? params.fields : [];
      const results: any[] = [];
      for (const f of fields) {
        try {
          const r = await bridgeClient.executeCommand(
            { type: 'form_input', params: { ref: f.ref, value: f.value, tabId: params.tabId } },
            profileId
          );
          // form_input returns {success:true,...} on success but swallows a not-found/GC'd ref
          // into a null result (the MAIN-world throw is not propagated by chrome.scripting),
          // so a null/failed result must count as NOT ok — otherwise `filled` lies.
          const ok = r != null && r.success !== false;
          results.push({ ref: f.ref, ok, result: r });
        } catch (e: any) {
          results.push({ ref: f.ref, ok: false, error: e?.message || String(e) });
        }
      }
      return { total: fields.length, filled: results.filter((r) => r.ok).length, results };
    }

    // extract_validated — extract (via code or selector) then ajv-validate server-side.
    case 'browser_extract_validated': {
      if (!params.code && !params.selector) {
        throw new Error('browser_extract_validated requires either `code` or `selector`');
      }
      const data = params.code
        ? await bridgeClient.executeCommand(
            { type: 'execute_js', params: { code: params.code, tabId: params.tabId } }, profileId)
        : await bridgeClient.executeCommand(
            { type: 'extract', params: { selector: params.selector, tabId: params.tabId } }, profileId);
      // execute_js/extract report failures as {error} instead of throwing — surface that
      // distinctly rather than validating an error object against the schema (misleading).
      if (data && typeof data === 'object' && (data as any).error) {
        return { data, valid: false, extractionError: (data as any).error };
      }
      const ajv = new Ajv({ allErrors: true, strict: false });
      try {
        const validate = ajv.compile(params.schema);
        const valid = !!validate(data);
        return { data, valid, errors: validate.errors || null };
      } catch (e: any) {
        // Bad schema — report rather than throw, so the extracted data is still returned.
        return { data, valid: false, schemaError: e?.message || String(e) };
      }
    }

    // handle_dialog — extension-backed (CDP Page.handleJavaScriptDialog).
    case 'browser_handle_dialog':
      return await bridgeClient.executeCommand(
        { type: 'handle_dialog', params: { accept: params.accept !== false, promptText: params.promptText, tabId: params.tabId } },
        profileId
      );

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
