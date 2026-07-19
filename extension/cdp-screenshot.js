// CDP Screenshot Module
// Takes screenshots via Chrome DevTools Protocol without stealing focus
// No more chrome.tabs.update(tabId, { active: true }) hijacking!

class CDPScreenshot {
  constructor() {
    this.attachedTargets = new Set();
  }

  /**
   * Take screenshot of a tab using CDP
   * Does NOT require the tab to be active/focused
   */
  async capture(tabId, options = {}) {
    const { format = 'png', quality = 80, fullPage = false } = options;

    let wasAttached = this.attachedTargets.has(tabId);

    try {
      // Attach debugger if not already attached
      if (!wasAttached) {
        await this.attach(tabId);
      }

      // For full page: get full document dimensions first
      if (fullPage) {
        return await this.captureFullPage(tabId, format, quality);
      }

      // Standard viewport screenshot via CDP
      const result = await chrome.debugger.sendCommand(
        { tabId },
        'Page.captureScreenshot',
        {
          format,
          quality: format === 'png' ? undefined : quality,
          fromSurface: true
        }
      );

      return {
        screenshot: `data:image/${format};base64,${result.data}`,
        fullPage: false,
        method: 'cdp'
      };

    } finally {
      // Detach if we attached
      if (!wasAttached) {
        await this.detach(tabId);
      }
    }
  }

  /**
   * Full page screenshot via CDP
   */
  async captureFullPage(tabId, format, quality) {
    // Get page dimensions
    const layoutMetrics = await chrome.debugger.sendCommand(
      { tabId },
      'Page.getLayoutMetrics',
      {}
    );

    const { contentSize } = layoutMetrics;

    // Set clip to full page
    const result = await chrome.debugger.sendCommand(
      { tabId },
      'Page.captureScreenshot',
      {
        format,
        quality: format === 'png' ? undefined : quality,
        clip: {
          x: 0,
          y: 0,
          width: contentSize.width,
          height: Math.min(contentSize.height, 16384), // Chrome max height
          scale: 1
        },
        fromSurface: true,
        captureBeyondViewport: true
      }
    );

    return {
      screenshot: `data:image/${format};base64,${result.data}`,
      fullPage: true,
      dimensions: {
        width: contentSize.width,
        height: contentSize.height
      },
      method: 'cdp'
    };
  }

  /**
   * Optimized screenshot for LLM consumption
   * Downscales to reduce token cost (inspired by Claude Extension)
   */
  async captureForLLM(tabId, options = {}) {
    const { maxWidth = 1568, pxPerToken = 28 } = options;

    let wasAttached = this.attachedTargets.has(tabId);

    try {
      if (!wasAttached) {
        await this.attach(tabId);
      }

      // Get viewport size
      const layoutMetrics = await chrome.debugger.sendCommand(
        { tabId },
        'Page.getLayoutMetrics',
        {}
      );

      const viewportWidth = layoutMetrics.visualViewport?.clientWidth || 1280;
      const viewportHeight = layoutMetrics.visualViewport?.clientHeight || 720;

      // Calculate scale to optimize for tokens
      const scale = Math.min(1, maxWidth / viewportWidth);

      // Override device metrics for downscaled capture
      if (scale < 1) {
        await chrome.debugger.sendCommand(
          { tabId },
          'Emulation.setDeviceMetricsOverride',
          {
            width: Math.round(viewportWidth * scale),
            height: Math.round(viewportHeight * scale),
            deviceScaleFactor: 1,
            mobile: false
          }
        );
      }

      const result = await chrome.debugger.sendCommand(
        { tabId },
        'Page.captureScreenshot',
        {
          format: 'png',
          fromSurface: true
        }
      );

      // Reset device metrics
      if (scale < 1) {
        await chrome.debugger.sendCommand(
          { tabId },
          'Emulation.clearDeviceMetricsOverride',
          {}
        );
      }

      const estimatedTokens = Math.ceil(
        (viewportWidth * scale * viewportHeight * scale) / (pxPerToken * pxPerToken)
      );

      return {
        screenshot: `data:image/png;base64,${result.data}`,
        scale,
        estimatedTokens,
        method: 'cdp-optimized'
      };

    } finally {
      if (!wasAttached) {
        await this.detach(tabId);
      }
    }
  }

  /**
   * Attach Chrome Debugger to tab
   */
  async attach(tabId) {
    try {
      await chrome.debugger.attach({ tabId }, '1.3');
      this.attachedTargets.add(tabId);
    } catch (error) {
      if (error.message?.includes('Already attached')) {
        this.attachedTargets.add(tabId);
      } else if (error.message?.includes('Another debugger')) {
        throw new Error(`Cannot attach to tab ${tabId}: Chrome DevTools is open. Close DevTools (F12) and retry.`);
      } else {
        throw new Error(`Cannot attach debugger to tab ${tabId}: ${error.message}`);
      }
    }
  }

  /**
   * Detach Chrome Debugger from tab
   */
  async detach(tabId) {
    try {
      await chrome.debugger.detach({ tabId });
      this.attachedTargets.delete(tabId);
    } catch {
      // Already detached
      this.attachedTargets.delete(tabId);
    }
  }

  /**
   * Cleanup attached targets. Pass a Set of tabIds to detach only those
   * (session-scoped cleanup must not detach another session's in-flight
   * capture — review 🟡2); omit to detach everything.
   */
  async cleanup(onlyTabIds) {
    for (const tabId of [...this.attachedTargets]) {
      if (onlyTabIds && !onlyTabIds.has(tabId)) continue;
      await this.detach(tabId);
    }
  }
}

// Export singleton
const cdpScreenshot = new CDPScreenshot();