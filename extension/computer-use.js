// Computer Use Module
// Full CDP mouse, keyboard, and viewport control
// Inspired by Claude Extension's computer_20250124 tool

// CDP modifier bitmask
const MODIFIERS = {
  alt: 1,
  ctrl: 2,
  control: 2,
  meta: 4,
  command: 4,
  cmd: 4,
  shift: 8
};

class ComputerUse {
  constructor() {
    this.attachedTargets = new Set();
    this.scalingContext = null; // For coordinate mapping after screenshot resize
  }

  /**
   * Click at pixel coordinates via CDP
   * Does NOT require CSS selector or ref — works on canvas, maps, charts
   */
  async click(tabId, x, y, options = {}) {
    const { button = 'left', clickCount = 1, modifiers = [] } = options;

    const wasAttached = this.attachedTargets.has(tabId);
    try {
      if (!wasAttached) await this.attach(tabId);

      const modBitmask = this.getModifierBitmask(modifiers);
      const cdpButton = button === 'right' ? 'right' : button === 'middle' ? 'middle' : 'left';

      // mousePressed
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x, y,
        button: cdpButton,
        clickCount,
        modifiers: modBitmask
      });

      // mouseReleased
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x, y,
        button: cdpButton,
        clickCount,
        modifiers: modBitmask
      });

      return { action: 'click', x, y, button: cdpButton, clickCount };
    } finally {
      if (!wasAttached) await this.detach(tabId);
    }
  }

  /**
   * Double click at coordinates
   */
  async doubleClick(tabId, x, y, modifiers = []) {
    return await this.click(tabId, x, y, { clickCount: 2, modifiers });
  }

  /**
   * Hover over coordinates (mouseMoved)
   */
  async hover(tabId, x, y) {
    const wasAttached = this.attachedTargets.has(tabId);
    try {
      if (!wasAttached) await this.attach(tabId);

      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x, y
      });

      return { action: 'hover', x, y };
    } finally {
      if (!wasAttached) await this.detach(tabId);
    }
  }

  /**
   * Drag from (x1,y1) to (x2,y2) with interpolated mouse moves
   */
  async drag(tabId, x1, y1, x2, y2, options = {}) {
    const { steps = 10, duration = 300 } = options;

    const wasAttached = this.attachedTargets.has(tabId);
    try {
      if (!wasAttached) await this.attach(tabId);

      // mousePressed at start
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: x1, y: y1,
        button: 'left'
      });

      // Interpolated mouseMoved events
      const stepDelay = duration / steps;
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const cx = Math.round(x1 + (x2 - x1) * progress);
        const cy = Math.round(y1 + (y2 - y1) * progress);

        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: cx, y: cy,
          button: 'left'
        });

        if (stepDelay > 0) {
          await new Promise(r => setTimeout(r, stepDelay));
        }
      }

      // mouseReleased at end
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: x2, y: y2,
        button: 'left'
      });

      return { action: 'drag', from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, steps };
    } finally {
      if (!wasAttached) await this.detach(tabId);
    }
  }

  /**
   * Scroll via CDP mouseWheel (native scroll, not JS scrollBy)
   */
  async scroll(tabId, x, y, deltaX = 0, deltaY = 0) {
    const wasAttached = this.attachedTargets.has(tabId);
    try {
      if (!wasAttached) await this.attach(tabId);

      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x, y,
        deltaX,
        deltaY
      });

      return { action: 'scroll', x, y, deltaX, deltaY };
    } finally {
      if (!wasAttached) await this.detach(tabId);
    }
  }

  /**
   * Type text character by character via CDP
   * Supports special keys and modifiers
   */
  async type(tabId, text) {
    const wasAttached = this.attachedTargets.has(tabId);
    try {
      if (!wasAttached) await this.attach(tabId);

      for (const char of text) {
        // Use insertText for regular characters
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'char',
          text: char
        });
      }

      return { action: 'type', text, length: text.length };
    } finally {
      if (!wasAttached) await this.detach(tabId);
    }
  }

  /**
   * Press a key with optional modifiers
   * Examples: 'Enter', 'Tab', 'Escape', 'ArrowDown', 'a', 'Backspace'
   */
  async key(tabId, key, modifiers = []) {
    const wasAttached = this.attachedTargets.has(tabId);
    try {
      if (!wasAttached) await this.attach(tabId);

      const modBitmask = this.getModifierBitmask(modifiers);
      const keyInfo = this.getKeyInfo(key);

      // Press modifier keys first
      for (const mod of modifiers) {
        const modKey = this.getKeyInfo(mod);
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: modKey.key,
          code: modKey.code,
          windowsVirtualKeyCode: modKey.keyCode
        });
      }

      // keyDown
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: keyInfo.key,
        code: keyInfo.code,
        windowsVirtualKeyCode: keyInfo.keyCode,
        modifiers: modBitmask
      });

      // For printable characters, also send char event
      if (keyInfo.text) {
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'char',
          text: keyInfo.text,
          modifiers: modBitmask
        });
      }

      // keyUp
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: keyInfo.key,
        code: keyInfo.code,
        windowsVirtualKeyCode: keyInfo.keyCode,
        modifiers: modBitmask
      });

      // Release modifier keys
      for (const mod of modifiers.reverse()) {
        const modKey = this.getKeyInfo(mod);
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: modKey.key,
          code: modKey.code,
          windowsVirtualKeyCode: modKey.keyCode
        });
      }

      return { action: 'key', key, modifiers };
    } finally {
      if (!wasAttached) await this.detach(tabId);
    }
  }

  /**
   * Screenshot a specific element by ref or selector via CDP
   */
  async screenshotElement(tabId, options = {}) {
    const { ref, selector, padding = 0 } = options;

    const wasAttached = this.attachedTargets.has(tabId);
    try {
      if (!wasAttached) await this.attach(tabId);

      let rect;

      if (ref) {
        // Get bounding rect via ref
        const result = await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: (refId) => {
            const map = window.__agentElementMap;
            if (!map || !map[refId]) return { error: `Ref not found: ${refId}` };
            const weakRef = map[refId];
            const el = weakRef.deref ? weakRef.deref() : weakRef;
            if (!el) return { error: `Element garbage collected: ${refId}` };
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return { error: `Element has zero dimensions: ${refId}` };
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          },
          args: [ref]
        });
        rect = result[0].result;
      } else if (selector) {
        // Get bounding rect via CSS selector
        const result = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel) => {
            const el = document.querySelector(sel);
            if (!el) return { error: `Element not found: ${sel}` };
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return { error: `Element has zero dimensions: ${sel}` };
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          },
          args: [selector]
        });
        rect = result[0].result;
      } else {
        throw new Error('Either ref or selector is required for element screenshot');
      }

      // Check for errors from injected script
      if (!rect || rect.error) {
        throw new Error(rect?.error || 'Failed to get element bounds');
      }

      // Apply padding
      const clip = {
        x: Math.max(0, rect.x - padding),
        y: Math.max(0, rect.y - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        scale: 1
      };

      const screenshot = await chrome.debugger.sendCommand({ tabId }, 'Page.captureScreenshot', {
        format: 'png',
        clip,
        fromSurface: true
      });

      return {
        screenshot: `data:image/png;base64,${screenshot.data}`,
        element: ref || selector,
        clip,
        method: 'cdp-element'
      };
    } finally {
      if (!wasAttached) await this.detach(tabId);
    }
  }

  /**
   * Take responsive screenshots at multiple viewport sizes
   */
  async screenshotResponsive(tabId, viewports) {
    const defaultViewports = [
      { name: 'mobile', width: 375, height: 812 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1440, height: 900 }
    ];

    const targets = viewports || defaultViewports;
    const wasAttached = this.attachedTargets.has(tabId);

    try {
      if (!wasAttached) await this.attach(tabId);

      const results = [];

      for (const vp of targets) {
        // Override viewport
        await chrome.debugger.sendCommand({ tabId }, 'Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.width < 768
        });

        // Wait for layout
        await new Promise(r => setTimeout(r, 500));

        // Capture
        const screenshot = await chrome.debugger.sendCommand({ tabId }, 'Page.captureScreenshot', {
          format: 'png',
          fromSurface: true
        });

        results.push({
          name: vp.name,
          width: vp.width,
          height: vp.height,
          screenshot: `data:image/png;base64,${screenshot.data}`
        });
      }

      // Reset viewport
      await chrome.debugger.sendCommand({ tabId }, 'Emulation.clearDeviceMetricsOverride', {});

      return { viewports: results, count: results.length };
    } finally {
      if (!wasAttached) await this.detach(tabId);
    }
  }

  // --- Helpers ---

  getModifierBitmask(modifiers) {
    let bitmask = 0;
    for (const mod of modifiers) {
      bitmask |= MODIFIERS[mod.toLowerCase()] || 0;
    }
    return bitmask;
  }

  getKeyInfo(key) {
    const keyMap = {
      'Enter': { key: 'Enter', code: 'Enter', keyCode: 13 },
      'Tab': { key: 'Tab', code: 'Tab', keyCode: 9 },
      'Escape': { key: 'Escape', code: 'Escape', keyCode: 27 },
      'Backspace': { key: 'Backspace', code: 'Backspace', keyCode: 8 },
      'Delete': { key: 'Delete', code: 'Delete', keyCode: 46 },
      'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
      'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
      'ArrowLeft': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
      'ArrowRight': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
      'Home': { key: 'Home', code: 'Home', keyCode: 36 },
      'End': { key: 'End', code: 'End', keyCode: 35 },
      'PageUp': { key: 'PageUp', code: 'PageUp', keyCode: 33 },
      'PageDown': { key: 'PageDown', code: 'PageDown', keyCode: 34 },
      'Space': { key: ' ', code: 'Space', keyCode: 32, text: ' ' },
      'F1': { key: 'F1', code: 'F1', keyCode: 112 },
      'F2': { key: 'F2', code: 'F2', keyCode: 113 },
      'F5': { key: 'F5', code: 'F5', keyCode: 116 },
      'F12': { key: 'F12', code: 'F12', keyCode: 123 },
      // Modifiers
      'alt': { key: 'Alt', code: 'AltLeft', keyCode: 18 },
      'ctrl': { key: 'Control', code: 'ControlLeft', keyCode: 17 },
      'control': { key: 'Control', code: 'ControlLeft', keyCode: 17 },
      'meta': { key: 'Meta', code: 'MetaLeft', keyCode: 91 },
      'command': { key: 'Meta', code: 'MetaLeft', keyCode: 91 },
      'cmd': { key: 'Meta', code: 'MetaLeft', keyCode: 91 },
      'shift': { key: 'Shift', code: 'ShiftLeft', keyCode: 16 }
    };

    if (keyMap[key]) return keyMap[key];

    // Single character
    if (key.length === 1) {
      const code = key.toUpperCase().charCodeAt(0);
      return {
        key,
        code: `Key${key.toUpperCase()}`,
        keyCode: code,
        text: key
      };
    }

    return { key, code: key, keyCode: 0 };
  }

  async attach(tabId) {
    try {
      await chrome.debugger.attach({ tabId }, '1.3');
      this.attachedTargets.add(tabId);
    } catch (error) {
      if (error.message?.includes('Already attached')) {
        this.attachedTargets.add(tabId);
      } else {
        throw error;
      }
    }
  }

  async detach(tabId) {
    try {
      await chrome.debugger.detach({ tabId });
      this.attachedTargets.delete(tabId);
    } catch {
      this.attachedTargets.delete(tabId);
    }
  }
}

// Export singleton
const computerUse = new ComputerUse();