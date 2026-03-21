// Accessibility Tree Module
// Reads pages as structured documents using CDP Accessibility API
// Inspired by Claude Extension's read_page + WeakRef element map

class AccessibilityTree {
  constructor() {
    this.attachedTargets = new Set();
  }

  /**
   * Read the full accessibility tree of a page (including iframes)
   * Returns a structured, semantic representation (like a screen reader)
   *
   * @param {number} tabId - Tab to read
   * @param {object} options - { scopeRef, maxDepth, interactiveOnly }
   * @returns {object} { tree, refs, summary }
   */
  async readPage(tabId, options = {}) {
    const { maxDepth = 15, interactiveOnly = false } = options;

    let wasAttached = this.attachedTargets.has(tabId);

    try {
      if (!wasAttached) await this.attach(tabId);

      // Enable DOM for iframe detection
      await chrome.debugger.sendCommand({ tabId }, 'DOM.enable', {}).catch(() => {});

      // Step 1: Get the full accessibility tree via CDP
      const { nodes } = await chrome.debugger.sendCommand(
        { tabId },
        'Accessibility.getFullAXTree',
        { max_depth: maxDepth }
      );

      // Step 1b: Try to read iframe accessibility trees
      let iframeNodes = [];
      try {
        const { frameTree } = await chrome.debugger.sendCommand(
          { tabId },
          'Page.getFrameTree',
          {}
        );
        const iframeFrames = this.collectChildFrames(frameTree);

        for (const frame of iframeFrames) {
          try {
            const iframeResult = await chrome.debugger.sendCommand(
              { tabId },
              'Accessibility.getFullAXTree',
              { max_depth: maxDepth, frameId: frame.id }
            );
            if (iframeResult?.nodes) {
              // Mark iframe nodes with source frame
              for (const node of iframeResult.nodes) {
                node._iframeUrl = frame.url;
                node._iframeName = frame.name || frame.url?.split('/').pop() || 'iframe';
              }
              iframeNodes = iframeNodes.concat(iframeResult.nodes);
            }
          } catch {
            // Some frames may not support accessibility tree — skip
          }
        }
      } catch {
        // Page.getFrameTree may not be available — continue with main frame only
      }

      // Step 2: Inject element map into page for ref tracking
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          if (!window.__agentElementMap) {
            window.__agentElementMap = {};
            window.__agentRefCounter = 0;
          }
        }
      });

      // Step 3: Build DOM node index for mapping AX nodes to DOM elements
      const { root } = await chrome.debugger.sendCommand(
        { tabId },
        'DOM.getDocument',
        { depth: -1 }
      );

      // Step 4: Process AX tree into clean format + assign refs
      const allNodes = [...nodes, ...iframeNodes];
      const processed = await this.processTree(tabId, allNodes, interactiveOnly);

      return {
        tree: processed.tree,
        refs: processed.refs,
        summary: {
          totalNodes: allNodes.length,
          mainFrameNodes: nodes.length,
          iframeNodes: iframeNodes.length,
          interactiveNodes: processed.interactiveCount,
          refsAssigned: Object.keys(processed.refs).length,
          pageTitle: this.findPageTitle(nodes),
          pageUrl: (await chrome.tabs.get(tabId)).url,
          hasIframes: iframeNodes.length > 0
        }
      };

    } finally {
      if (!wasAttached) await this.detach(tabId);
    }
  }

  /**
   * Process AX tree nodes into clean format
   */
  async processTree(tabId, nodes, interactiveOnly) {
    const refs = {};
    let interactiveCount = 0;
    const tree = [];

    // Interactive roles we want to assign refs to
    const interactiveRoles = new Set([
      'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
      'listbox', 'option', 'menuitem', 'tab', 'switch', 'slider',
      'spinbutton', 'searchbox', 'select', 'menuitemcheckbox',
      'menuitemradio', 'treeitem'
    ]);

    // Important structural roles
    const structuralRoles = new Set([
      'heading', 'img', 'list', 'listitem', 'table', 'row', 'cell',
      'navigation', 'main', 'banner', 'contentinfo', 'region',
      'article', 'complementary', 'form', 'dialog', 'alert',
      'status', 'progressbar'
    ]);

    for (const node of nodes) {
      if (node.ignored) continue;

      const role = this.getProperty(node, 'role');
      if (!role || role === 'none' || role === 'generic' || role === 'InlineTextBox') continue;

      const name = this.getProperty(node, 'name');
      const value = this.getProperty(node, 'value');
      const description = this.getProperty(node, 'description');
      const isInteractive = interactiveRoles.has(role);
      const isStructural = structuralRoles.has(role);

      if (interactiveOnly && !isInteractive) continue;
      if (!isInteractive && !isStructural && !name) continue;

      if (isInteractive) interactiveCount++;

      // Build clean node representation
      const cleanNode = {
        role,
        name: name || undefined,
        value: value || undefined,
        description: description || undefined,
        backendDOMNodeId: node.backendDOMNodeId
      };

      // Extract additional properties
      if (node.properties) {
        for (const prop of node.properties) {
          if (prop.name === 'checked') cleanNode.checked = prop.value?.value;
          if (prop.name === 'expanded') cleanNode.expanded = prop.value?.value;
          if (prop.name === 'selected') cleanNode.selected = prop.value?.value;
          if (prop.name === 'disabled') cleanNode.disabled = prop.value?.value;
          if (prop.name === 'required') cleanNode.required = prop.value?.value;
          if (prop.name === 'level') cleanNode.level = prop.value?.value;
          if (prop.name === 'valuemin') cleanNode.valueMin = prop.value?.value;
          if (prop.name === 'valuemax') cleanNode.valueMax = prop.value?.value;
        }
      }

      // Assign ref for interactive + important structural elements
      if (isInteractive || isStructural) {
        const ref = await this.assignRef(tabId, node.backendDOMNodeId);
        if (ref) {
          cleanNode.ref = ref;
          refs[ref] = {
            role,
            name: name || '',
            backendDOMNodeId: node.backendDOMNodeId
          };
        }
      }

      tree.push(cleanNode);
    }

    return { tree, refs, interactiveCount };
  }

  /**
   * Assign a ref to a DOM element via content script
   */
  async assignRef(tabId, backendDOMNodeId) {
    if (!backendDOMNodeId) return null;

    try {
      // Resolve backend node to a JS object
      const { object } = await chrome.debugger.sendCommand(
        { tabId },
        'DOM.resolveNode',
        { backendNodeId: backendDOMNodeId }
      );

      if (!object?.objectId) return null;

      // Call function on the element to assign ref
      const result = await chrome.debugger.sendCommand(
        { tabId },
        'Runtime.callFunctionOn',
        {
          objectId: object.objectId,
          functionDeclaration: `function() {
            if (!window.__agentElementMap) {
              window.__agentElementMap = {};
              window.__agentRefCounter = 0;
            }
            // Check if element already has a ref
            for (const [ref, weakRef] of Object.entries(window.__agentElementMap)) {
              const el = weakRef.deref?.() || weakRef;
              if (el === this) return ref;
            }
            // Assign new ref
            const ref = 'ref_' + (++window.__agentRefCounter);
            try {
              window.__agentElementMap[ref] = new WeakRef(this);
            } catch(e) {
              window.__agentElementMap[ref] = this;
            }
            return ref;
          }`,
          returnByValue: true
        }
      );

      return result.result?.value || null;
    } catch {
      return null;
    }
  }

  /**
   * Find elements by text query in the accessibility tree
   */
  async find(tabId, query, options = {}) {
    const { maxResults = 10 } = options;
    const queryLower = query.toLowerCase();

    // Read the page first
    const page = await this.readPage(tabId, { interactiveOnly: false });

    // Search through tree nodes
    const matches = [];
    for (const node of page.tree) {
      if (!node.ref) continue;

      const searchText = [
        node.name || '',
        node.value || '',
        node.description || '',
        node.role || ''
      ].join(' ').toLowerCase();

      if (searchText.includes(queryLower)) {
        matches.push({
          ref: node.ref,
          role: node.role,
          name: node.name,
          value: node.value,
          description: node.description
        });

        if (matches.length >= maxResults) break;
      }
    }

    return {
      query,
      matches,
      total: matches.length
    };
  }

  /**
   * Smart form input by ref — auto-detects element type
   */
  async formInput(tabId, ref, value) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (refId, val) => {
        const map = window.__agentElementMap;
        if (!map || !map[refId]) throw new Error(`Ref not found: ${refId}`);

        const weakRef = map[refId];
        const element = weakRef.deref ? weakRef.deref() : weakRef;
        if (!element) throw new Error(`Element garbage collected: ${refId}`);

        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const tagName = element.tagName?.toLowerCase();
        const inputType = element.type?.toLowerCase();

        // Focus element
        element.focus();

        // Smart input based on element type
        if (tagName === 'select') {
          // Select: find matching option by value or text
          const option = Array.from(element.options).find(
            o => o.value === val || o.textContent.trim().toLowerCase() === val.toLowerCase()
          );
          if (!option) throw new Error(`Option not found: ${val}. Available: ${Array.from(element.options).map(o => o.textContent.trim()).join(', ')}`);
          element.value = option.value;
        } else if (inputType === 'checkbox') {
          element.checked = val === 'true' || val === '1' || val === 'on' || val === true;
        } else if (inputType === 'radio') {
          element.checked = true;
        } else if (inputType === 'date') {
          element.value = val; // expects YYYY-MM-DD
        } else if (inputType === 'time') {
          element.value = val; // expects HH:MM
        } else if (inputType === 'datetime-local') {
          element.value = val; // expects YYYY-MM-DDTHH:MM
        } else if (inputType === 'range' || inputType === 'number') {
          element.value = parseFloat(val);
        } else if (inputType === 'color') {
          element.value = val; // expects #RRGGBB
        } else if (inputType === 'file') {
          throw new Error('File inputs require browser_upload, not form_input');
        } else {
          // Text input, textarea, contenteditable
          if (element.isContentEditable) {
            element.textContent = val;
          } else {
            element.value = val;
          }
        }

        // Dispatch events for framework reactivity
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));

        return {
          ref: refId,
          elementType: `${tagName}[${inputType || ''}]`,
          value: val,
          success: true
        };
      },
      args: [ref, value]
    });

    return result[0].result;
  }

  /**
   * Click an element by ref
   */
  async clickRef(tabId, ref) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (refId) => {
        const map = window.__agentElementMap;
        if (!map || !map[refId]) throw new Error(`Ref not found: ${refId}`);

        const weakRef = map[refId];
        const element = weakRef.deref ? weakRef.deref() : weakRef;
        if (!element) throw new Error(`Element garbage collected: ${refId}`);

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Small delay to let scroll finish, then click
        element.click();

        return {
          ref: refId,
          role: element.getAttribute('role') || element.tagName.toLowerCase(),
          text: element.textContent?.trim()?.substring(0, 100),
          clicked: true
        };
      },
      args: [ref]
    });

    return result[0].result;
  }

  /**
   * Scroll to an element by ref
   */
  async scrollToRef(tabId, ref) {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (refId) => {
        const map = window.__agentElementMap;
        if (!map || !map[refId]) throw new Error(`Ref not found: ${refId}`);

        const weakRef = map[refId];
        const element = weakRef.deref ? weakRef.deref() : weakRef;
        if (!element) throw new Error(`Element garbage collected: ${refId}`);

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const rect = element.getBoundingClientRect();
        return {
          ref: refId,
          scrolledTo: true,
          position: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        };
      },
      args: [ref]
    });

    return result[0].result;
  }

  // --- Helpers ---

  /**
   * Recursively collect all child frame IDs from frame tree
   */
  collectChildFrames(frameTree) {
    const frames = [];
    if (frameTree.childFrames) {
      for (const child of frameTree.childFrames) {
        frames.push({
          id: child.frame.id,
          url: child.frame.url,
          name: child.frame.name
        });
        // Recurse into nested iframes
        frames.push(...this.collectChildFrames(child));
      }
    }
    return frames;
  }

  getProperty(node, name) {
    if (name === 'role') return node.role?.value;
    if (name === 'name') return node.name?.value;
    if (name === 'value') return node.value?.value;
    if (name === 'description') return node.description?.value;
    return null;
  }

  findPageTitle(nodes) {
    for (const node of nodes) {
      if (node.role?.value === 'RootWebArea') {
        return node.name?.value || '';
      }
    }
    return '';
  }

  async attach(tabId) {
    try {
      await chrome.debugger.attach({ tabId }, '1.3');
      this.attachedTargets.add(tabId);
    } catch (error) {
      if (error.message?.includes('Already attached')) {
        this.attachedTargets.add(tabId);
      } else if (error.message?.includes('Another debugger')) {
        throw new Error(
          `Cannot attach to tab ${tabId}: Chrome DevTools is open on this tab. ` +
          `Close DevTools (F12) and retry.`
        );
      } else {
        throw new Error(`Cannot attach debugger to tab ${tabId}: ${error.message}`);
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
const accessibilityTree = new AccessibilityTree();