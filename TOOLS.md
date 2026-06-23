# Browser Agent — MCP Tools Reference

> ⚙️ **Auto-generated — do not edit by hand.** Regenerate with `npm run docs:tools` (from `mcp-server/`).
> Source of truth: `mcp-server/src/tools.ts`. Package `@ws-workspace/browser-agent-mcp` v2.1.0 · **50 tools** in 18 categories.

## Categories

- [Navigation](#navigation) — 3
- [Interaction](#interaction) — 2
- [Screenshot (CDP — no focus hijack)](#screenshot-cdp-no-focus-hijack) — 1
- [Scroll](#scroll) — 1
- [JavaScript](#javascript) — 1
- [Data Extraction](#data-extraction) — 2
- [Tab Management (Agent Group)](#tab-management-agent-group) — 5
- [Profile Management](#profile-management) — 1
- [Accessibility Tree (Phase 2)](#accessibility-tree-phase-2) — 5
- [computer_use (Phase 2)](#computer-use-phase-2) — 5
- [Design Extraction (Phase 2)](#design-extraction-phase-2) — 4
- [Plan Tracking](#plan-tracking) — 3
- [Recording → Skills (Phase 4)](#recording-skills-phase-4) — 5
- [Session / Cookies](#session-cookies) — 2
- [Debugging](#debugging) — 2
- [Network / Files (Sprint 2)](#network-files-sprint-2) — 3
- [Self-healing action + Performance (Sprint 3)](#self-healing-action-performance-sprint-3) — 4
- [Cleanup](#cleanup) — 1

## Navigation

### `browser_navigate`

Navigate to a URL. Opens in agent tab group (isolated from user tabs). Creates a new agent tab if none exists.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | yes | The URL to navigate to |
| `tabId` | number | no | Specific agent tab ID (optional, uses active agent tab) |
| `profileId` | string | no | Profile ID or alias (optional, uses active profile) |

### `browser_go_back`

Go back in browser history

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_go_forward`

Go forward in browser history

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## Interaction

### `browser_click`

Click an element on the page by CSS selector

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `selector` | string | yes | CSS selector for the element to click |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_type`

Type text into an input field. Smart detection: handles text inputs, textareas, selects, checkboxes, and radio buttons automatically.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `selector` | string | yes | CSS selector for the input element |
| `text` | string | yes | Text to type (for select: option value or text; for checkbox/radio: true/false) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## Screenshot (CDP — no focus hijack)

### `browser_screenshot`

Take a screenshot using CDP (does NOT steal browser focus). Supports fullPage and optimized mode for LLM token efficiency.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fullPage` | boolean | no | Capture full page scroll height (default: false) |
| `optimized` | boolean | no | Downscale for LLM token efficiency (default: false) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## Scroll

### `browser_scroll`

Scroll the page up or down

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `direction` | enum(up \| down) | no | Scroll direction (default: down) |
| `amount` | number | no | Scroll amount in pixels (default: 500) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## JavaScript

### `browser_execute_js`

Execute JavaScript code on the page (runs in page context). Top-level `return` and `await` are supported. Pass frameSelector to run the code INSIDE an iframe (works for same- and cross-origin frames) — e.g. for editors embedded in an iframe.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | yes | JavaScript code to execute |
| `frameSelector` | string | no | Optional CSS selector of an <iframe> — code runs inside that frame instead of the top document. |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## Data Extraction

### `browser_extract`

Extract structured data from elements matching a CSS selector (text, html, attributes)

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `selector` | string | yes | CSS selector for elements to extract |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_get_text`

Get text content of an element by CSS selector

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `selector` | string | yes | CSS selector for the element |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## Tab Management (Agent Group)

### `browser_list_tabs`

List agent tabs only (tabs in the 🤖 Agent group). Does NOT show user tabs.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_list_all_tabs`

List ALL tabs (agent + user). Agent tabs are marked with isAgentTab: true.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_new_tab`

Open a new tab in the agent tab group (isolated from user tabs)

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | no | URL to open (optional, defaults to blank) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_close_tab`

Close an agent tab. Cannot close user tabs (safety).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tabId` | number | yes | Agent tab ID to close |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_switch_tab`

Switch to a specific agent tab (makes it active)

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tabId` | number | yes | Agent tab ID to switch to |
| `profileId` | string | no | Profile ID or alias (optional) |

## Profile Management

### `browser_list_profiles`

List all connected browser profiles with aliases

_No parameters._

## Accessibility Tree (Phase 2)

### `browser_read_page`

Read the page as a structured accessibility tree with ref IDs. Returns semantic roles (button, link, textbox, heading, etc.) instead of raw HTML. Use refs with browser_click_ref, browser_form_input, browser_scroll_to.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `interactiveOnly` | boolean | no | Only return interactive elements like buttons, inputs, links (default: false) |
| `maxDepth` | number | no | Max tree depth (default: 15) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_find`

Find elements on the page by text query. Searches through accessibility tree (roles, names, values, descriptions). Returns matching refs.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | yes | Text to search for (e.g., "Сохранить", "email", "Submit") |
| `maxResults` | number | no | Max results (default: 10) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_form_input`

Smart form input by ref. Auto-detects element type: text/textarea (sets value), select (finds option by value or text), checkbox (toggle), radio (select), date/time/number/range/color (format-aware). Dispatches input+change+blur events for framework reactivity.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `ref` | string | yes | Element ref from browser_read_page or browser_find (e.g., "ref_5") |
| `value` | string | yes | Value to set (for checkbox: "true"/"false", for select: option value or text) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_click_ref`

Click an element by ref (from browser_read_page or browser_find). Scrolls element into view first.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `ref` | string | yes | Element ref (e.g., "ref_12") |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_scroll_to`

Scroll to an element by ref. Brings the element into center of viewport.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `ref` | string | yes | Element ref (e.g., "ref_8") |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## computer_use (Phase 2)

### `browser_mouse`

CDP mouse control: click at coordinates, hover, double-click. Works on canvas, maps, charts where CSS selectors fail.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | enum(click \| doubleclick \| hover) | yes | Mouse action |
| `x` | number | yes | X coordinate (pixels) |
| `y` | number | yes | Y coordinate (pixels) |
| `button` | enum(left \| right \| middle) | no | Mouse button (default: left) |
| `modifiers` | array | no | Modifier keys: alt, ctrl, meta, shift |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_drag`

Drag from (x1,y1) to (x2,y2) with interpolated mouse moves. For charts, sliders, drag-and-drop.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `x1` | number | yes | Start X |
| `y1` | number | yes | Start Y |
| `x2` | number | yes | End X |
| `y2` | number | yes | End Y |
| `steps` | number | no | Interpolation steps (default: 10) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_keyboard`

CDP keyboard: type text character-by-character or press keys with modifiers. Examples: key="Enter", key="a" modifiers=["ctrl"] for Ctrl+A.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | enum(type \| key) | yes | "type" for text input, "key" for single key press |
| `text` | string | no | Text to type (for action="type") |
| `key` | string | no | Key name (for action="key"): Enter, Tab, Escape, ArrowDown, Backspace, a-z, F1-F12 |
| `modifiers` | array | no | Modifier keys: alt, ctrl, meta, shift |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_screenshot_element`

Screenshot a specific element by ref or CSS selector. Clips to element bounds with optional padding.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `ref` | string | no | Element ref (from browser_read_page) |
| `selector` | string | no | CSS selector (alternative to ref) |
| `padding` | number | no | Padding around element in pixels (default: 0) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_screenshot_responsive`

Take screenshots at multiple viewport sizes (mobile, tablet, desktop). Uses CDP viewport override.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `viewports` | array | no | Custom viewports. Default: mobile(375x812), tablet(768x1024), desktop(1440x900) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## Design Extraction (Phase 2)

### `browser_extract_design`

Extract design tokens from a page section: colors (text, background), typography (fonts, weights, sizes), spacing, border radius. For 2P Builder pipeline. Note: on canvas-based apps (Figma, Google Sheets) this extracts UI chrome colors, not canvas content.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `selector` | string | no | CSS selector for section to analyze (default: body = full page) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_extract_palette`

Extract full color palette from a page. Returns categorized colors (primary, secondary, accent, neutral) + ready-to-use Tailwind config fragment. Note: on canvas-based apps (Figma) extracts UI colors, not design file colors — use Figma API for design tokens.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_extract_section`

Extract a section for reproduction: HTML, computed styles, images, links, structure. For recreating sections in new projects.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `selector` | string | yes | CSS selector for the section |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_extract_seo`

SEO audit: title, meta description, Open Graph, Twitter cards, JSON-LD structured data, heading structure (H1-H6), image alts, internal/external links count.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## Plan Tracking

### `browser_set_plan`

Set a plan with steps to display in the Side Panel. Shows progress to the user as you work through steps. Call browser_update_plan_step to mark steps as completed.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | Plan name (e.g., "SEO Audit for 2penguins.de") |
| `steps` | array | yes | List of step descriptions |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_update_plan_step`

Update a plan step status. Marks current step as completed and auto-advances to next step.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `step` | number | no | Step index (0-based). If omitted, updates current step. |
| `status` | enum(completed \| in_progress \| error \| pending) | no | New status (default: completed) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_clear_plan`

Clear the current plan from Side Panel.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `profileId` | string | no | Profile ID or alias (optional) |

## Recording → Skills (Phase 4)

### `browser_start_recording`

Start recording browser actions for skill generation. All subsequent actions (navigate, click, type, etc.) will be captured. Use browser_stop_recording when done.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | Recording name (e.g., "create-deal-bitrix24") |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_stop_recording`

Stop recording and return the recorded actions. Use browser_generate_skill to convert to a reusable SKILL.md.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_recording_status`

Check if recording is active and how many actions have been captured.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_list_recordings`

List all saved recordings with names, duration, and action counts.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_generate_skill`

Generate a SKILL.md file from a recording. Auto-detects parameters (text inputs, URLs) and creates a parameterized, reusable skill.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `recordingName` | string | yes | Name of the recording to convert |
| `skillName` | string | no | Name for the generated skill (optional, defaults to recording name) |
| `description` | string | no | Skill description (optional) |
| `parameterize` | boolean | no | Auto-detect and parameterize inputs (default: true) |
| `profileId` | string | no | Profile ID or alias (optional) |

## Session / Cookies

### `browser_get_cookies`

Get cookies from the browser via CDP. Useful for extracting auth tokens from logged-in sessions (Bitrix24, Google, Facebook Ads, etc.) to use in API calls. Returns all cookies or filtered by domain.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | string | no | Filter cookies by domain (e.g. "facebook.com", "bitrix24.de"). Optional — omit to get all cookies. |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_set_cookies`

Set cookies in the browser via CDP. Useful for restoring an auth session or injecting tokens. Pass an array of cookie objects ({name, value, domain, path?, secure?, httpOnly?, expires?}).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `cookies` | array | yes | Array of cookie objects to set (CDP Network.CookieParam format: name, value, domain, url, path, secure, httpOnly, sameSite, expires). |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## Debugging

### `browser_read_console`

Read console output (log/info/warn/error) and uncaught errors captured from the page. Capture begins at page load — navigate or reload if you expected output that happened earlier. Useful for debugging forms, SPAs, and failed API calls.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `level` | enum(log \| info \| warn \| error \| debug) | no | Filter by level (optional, default all) |
| `clear` | boolean | no | Clear the buffer after reading (default false) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_wait_for`

Wait until a CSS selector appears/disappears, or specific text appears on the page, or a fixed delay elapses. Returns when the condition is met or on timeout. Use for SPA timing instead of guessing.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `selector` | string | no | CSS selector to wait for (optional) |
| `text` | string | no | Text to wait for in page body (optional) |
| `state` | enum(visible \| hidden) | no | Wait for selector/text to be visible or hidden (default visible) |
| `timeout` | number | no | Max wait in ms (default 10000). With no selector/text, waits exactly this long. |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## Network / Files (Sprint 2)

### `browser_read_network`

Read buffered network requests for the tab (URL, method, status, type, timing). Captured via webRequest from page load — navigate/reload if you expected earlier traffic. Metadata only: response BODIES are not captured (re-fetch the URL via execute_js if you need a body). Useful for debugging forms, failed API calls, redirects.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `filter` | string | no | Substring to match in the request URL (optional) |
| `status` | number | no | Filter by exact HTTP status code (optional) |
| `onlyFailed` | boolean | no | Only requests that failed (status 0 or >= 400) |
| `clear` | boolean | no | Clear the buffer after reading (default false) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_download`

Download a file from a URL via the browser (logged-in session), wait for completion, and return the saved path. Use this instead of navigating to a download URL (which falsely reports a navigation timeout).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | yes | URL of the file to download |
| `filename` | string | no | Optional target filename (relative to the Downloads folder) |
| `timeout` | number | no | Max wait for completion in ms (default 60000) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_upload_file`

Set local file(s) on a <input type=file> element (CDP DOM.setFileInputFiles), so the page treats them as user-selected. Files must be absolute paths on the machine running the browser.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `selector` | string | yes | CSS selector for the <input type=file> element |
| `files` | array | yes | Absolute file path(s) to set on the input |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## Self-healing action + Performance (Sprint 3)

### `browser_act`

Self-healing action by natural-language description. Caches a CSS selector per (site, action, description); next time it tries the cached selector first (fast), and if the page changed it auto-falls back to semantic find() and re-caches. Ideal for recurring playbooks that must survive site redesigns. Actions: click, type (needs value), get_text.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | yes | What to act on, in words (matched against accessible name/role/value), e.g. "Senden button", "email field". |
| `action` | enum(click \| type \| get_text) | no | Action to perform (default click) |
| `value` | string | no | Text to type (for action=type) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_performance`

Read performance metrics for the current page: Core Web Vitals (LCP, CLS, FCP) + navigation timing (TTFB, DOMContentLoaded, load) + resource count/bytes. Lab data from the real logged-in Chrome session — no PageSpeed API quota. NOTE: FCP/LCP require a VISIBLE tab; agent tabs are backgrounded, so pass activate:true to foreground+reload the tab and capture them (this briefly takes focus).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `activate` | boolean | no | Foreground the tab and reload to capture FCP/LCP (paint timing needs a visible tab). Briefly steals focus. Default false. |
| `timeout` | number | no | Max wait for reload when activate=true (ms, default 15000) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_observe`

Survey what you can act on: returns a ranked list of interactive elements (buttons, links, inputs, …) from the accessibility tree — named elements first, then by role. No LLM. Use before acting to discover targets, then act via browser_act (by name) or click_ref/form_input (by ref). Optional filter narrows by text/role.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `filter` | string | no | Narrow to elements whose name/role/value contains this text (optional) |
| `limit` | number | no | Max elements to return (default 30) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

### `browser_extract_design_system`

Extract a full design system from the current page in one call and return ready-to-use artifacts: DESIGN.md (AI/human design-system doc), W3C DTCG tokens (Figma via Tokens Studio), Tailwind v4 @theme CSS + v3 config, and framework-agnostic CSS :root variables — plus brand logo/favicon. Built for 2p-builder / figma-handoff. Save the returned strings to files in your project.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `selector` | string | no | Scope the design extraction to a CSS selector (default: body) |
| `tabId` | number | no | Agent tab ID (optional) |
| `profileId` | string | no | Profile ID or alias (optional) |

## Cleanup

### `browser_cleanup`

Close all agent tabs and clean up resources. Use when done with browser automation.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `profileId` | string | no | Profile ID or alias (optional) |
