# Profile Aliases Guide

Profile aliases allow you to use friendly names like "work", "personal", "comet-ads" instead of long profile IDs like "chrome-1771246123525-ezd05p".

## Setting Aliases

### Method 1: Extension Popup UI (Easiest)

1. Click the Browser Agent extension icon
2. In the "Profile Alias" field, enter your desired alias (e.g., "work")
3. Click "Save"

**Rules:**
- Only lowercase letters, numbers, and hyphens
- Example: `work`, `personal`, `comet-ads`, `dev-profile`

### Method 2: HTTP API (Programmatic)

```bash
# Set alias for a profile
curl -X POST http://localhost:18793/profiles/chrome-1771246123525-ezd05p/alias \
  -H "Content-Type: application/json" \
  -d '{"alias": "work"}'

# Response:
{
  "success": true,
  "profile": {
    "id": "chrome-1771246123525-ezd05p",
    "alias": "work"
  }
}
```

## Using Aliases

### In WS Workspace / MCP Calls

Use the alias wherever you would use a profile ID:

```javascript
// ✅ With alias (new)
browser_execute_js({
  profileId: "work",
  code: "document.title"
})

// ✅ With full ID (still works)
browser_execute_js({
  profileId: "chrome-1771246123525-ezd05p",
  code: "document.title"
})
```

### All MCP Tools Support Aliases

Every browser tool accepts aliases in the `profileId` parameter:

```javascript
// Navigate
browser_navigate({ profileId: "work", url: "https://example.com" })

// Click
browser_click({ profileId: "personal", selector: ".button" })

// Screenshot
browser_screenshot({ profileId: "comet-ads", fullPage: true })

// Type
browser_type({ profileId: "work", selector: "#input", text: "Hello" })

// Execute JS
browser_execute_js({ profileId: "work", code: "document.title" })

// Extract data
browser_extract({ profileId: "personal", selector: ".product" })

// Get text
browser_get_text({ profileId: "work", selector: "h1" })

// Tab management
browser_switch_tab({ profileId: "work", tabId: 12345 })
browser_new_tab({ profileId: "work", url: "https://example.com" })
browser_close_tab({ profileId: "work", tabId: 12345 })
```

### List Profiles with Aliases

```javascript
// Get all profiles with their aliases
browser_list_profiles()

// Response:
{
  "profiles": [
    {
      "id": "chrome-1771246123525-ezd05p",
      "alias": "work",
      "browserInfo": {...},
      "isActive": true,
      "isConnected": true,
      "lastSeen": 1234567890
    },
    {
      "id": "chrome-1771246987654-abc123",
      "alias": "personal",
      "browserInfo": {...},
      "isActive": false,
      "isConnected": true,
      "lastSeen": 1234567890
    }
  ]
}
```

## Examples

### Common Workflow

```javascript
// 1. List profiles to see available aliases
const profiles = browser_list_profiles()
// Shows: work, personal, comet-ads

// 2. Execute command on specific profile by alias
browser_navigate({ profileId: "work", url: "https://semrush.com" })

// 3. Extract data from "work" profile
const data = browser_extract({
  profileId: "work",
  selector: ".serp-result"
})

// 4. Switch to "personal" profile and do something else
browser_navigate({ profileId: "personal", url: "https://gmail.com" })
```

### Multi-Profile Automation

```javascript
// Run parallel tasks on different profiles
await Promise.all([
  // Work profile: Check analytics
  browser_execute_js({
    profileId: "work",
    code: "document.querySelector('.analytics-value').textContent"
  }),

  // Personal profile: Check emails
  browser_execute_js({
    profileId: "personal",
    code: "document.querySelectorAll('.unread-email').length"
  }),

  // Comet Ads profile: Check ad performance
  browser_execute_js({
    profileId: "comet-ads",
    code: "document.querySelector('.ad-impressions').textContent"
  })
]);
```

## How It Works

1. **Extension stores alias locally** in `chrome.storage.local`
2. **Bridge Server resolves aliases** to profile IDs automatically
3. **MCP Server passes aliases transparently** to Bridge Server
4. **No changes needed** in your existing code - aliases work everywhere profile IDs work

## Benefits

✅ **Easier to remember**: "work" vs "chrome-1771246123525-ezd05p"
✅ **Self-documenting**: Code is more readable
✅ **Flexible**: Can change profile IDs without updating code
✅ **Backward compatible**: Old code with profile IDs still works

## Technical Details

### Storage
- **Extension**: `chrome.storage.local` (per browser profile)
- **Bridge Server**: In-memory `Map<alias, profileId>` (runtime only)
- **Persistence**: Alias survives extension reload, but Bridge Server restart clears mapping (extension re-registers on reconnect)

### Resolution Priority
1. Check if it's a valid profile ID → use directly
2. If not found, try resolving as alias → use resolved ID
3. If neither works → return error

### Validation
- Regex: `/^[a-z0-9-]+$/`
- Max length: 50 characters
- Only lowercase letters, numbers, hyphens

---

**Status:** ✅ Production-ready
**Version:** 1.1.0 (Profile Aliases)
