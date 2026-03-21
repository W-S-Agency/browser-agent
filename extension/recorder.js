// Recorder Module
// Records browser actions and generates reusable Skills (SKILL.md)
// Phase 4: Recording → Skills Pipeline

class Recorder {
  constructor() {
    this.isRecording = false;
    this.currentRecording = null;
    this.recordings = []; // Saved recordings
  }

  /**
   * Start recording actions
   */
  start(name) {
    if (this.isRecording) {
      throw new Error('Already recording. Stop current recording first.');
    }

    this.isRecording = true;
    this.currentRecording = {
      name: name || `recording-${Date.now()}`,
      startedAt: Date.now(),
      actions: [],
      metadata: {
        startUrl: null,
        profile: null
      }
    };

    return {
      recording: true,
      name: this.currentRecording.name,
      startedAt: this.currentRecording.startedAt
    };
  }

  /**
   * Record an action (called from executeCommand)
   */
  recordAction(type, params, result) {
    if (!this.isRecording || !this.currentRecording) return;

    const action = {
      type,
      params: this.sanitizeParams(params),
      timestamp: Date.now(),
      elapsed: Date.now() - this.currentRecording.startedAt
    };

    // Capture start URL from first navigate
    if (type === 'navigate' && !this.currentRecording.metadata.startUrl) {
      this.currentRecording.metadata.startUrl = params.url;
    }

    // Don't record read-only actions (they don't need replay)
    const skipTypes = ['read_page', 'find', 'screenshot', 'screenshot_element',
      'screenshot_responsive', 'extract', 'get_text', 'extract_design',
      'extract_palette', 'extract_section', 'extract_seo', 'list_tabs',
      'list_all_tabs', 'mouse_hover'];

    if (skipTypes.includes(type)) return;

    this.currentRecording.actions.push(action);
  }

  /**
   * Stop recording and return the recording
   */
  stop() {
    if (!this.isRecording) {
      throw new Error('Not recording.');
    }

    this.isRecording = false;
    const recording = {
      ...this.currentRecording,
      stoppedAt: Date.now(),
      duration: Date.now() - this.currentRecording.startedAt,
      actionCount: this.currentRecording.actions.length
    };

    this.recordings.push(recording);
    this.currentRecording = null;

    return recording;
  }

  /**
   * Get current recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      currentName: this.currentRecording?.name || null,
      actionCount: this.currentRecording?.actions?.length || 0,
      duration: this.currentRecording ? Date.now() - this.currentRecording.startedAt : 0,
      savedRecordings: this.recordings.length
    };
  }

  /**
   * List all saved recordings
   */
  listRecordings() {
    return this.recordings.map(r => ({
      name: r.name,
      startedAt: r.startedAt,
      duration: r.duration,
      actionCount: r.actionCount,
      startUrl: r.metadata?.startUrl
    }));
  }

  /**
   * Get a specific recording by name
   */
  getRecording(name) {
    return this.recordings.find(r => r.name === name) || null;
  }

  /**
   * Generate a SKILL.md from a recording
   */
  generateSkill(recordingName, options = {}) {
    const recording = this.getRecording(recordingName);
    if (!recording) {
      throw new Error(`Recording not found: ${recordingName}`);
    }

    const {
      skillName = recording.name,
      description = `Browser automation recorded on ${new Date(recording.startedAt).toISOString().split('T')[0]}`,
      parameterize = true
    } = options;

    // Detect parameters (repeated values that should be configurable)
    const detectedParams = parameterize ? this.detectParameters(recording) : [];

    // Generate steps
    const steps = this.generateSteps(recording, detectedParams);

    // Generate SKILL.md content
    const skillMd = this.formatSkillMd({
      name: skillName,
      description,
      params: detectedParams,
      steps,
      startUrl: recording.metadata.startUrl,
      actionCount: recording.actionCount,
      recordedAt: recording.startedAt
    });

    return {
      skillName,
      skillMd,
      params: detectedParams,
      steps: steps.length,
      recording: recordingName
    };
  }

  /**
   * Detect parameters from recorded actions
   * Looks for typed text that could be parameterized
   */
  detectParameters(recording) {
    const params = [];
    const textValues = new Map(); // value → count

    for (const action of recording.actions) {
      if (action.type === 'type' || action.type === 'form_input' || action.type === 'keyboard_type') {
        const text = action.params.text || action.params.value || '';
        if (text.length > 0 && text.length < 200) {
          textValues.set(text, (textValues.get(text) || 0) + 1);
        }
      }
    }

    // Each unique text input becomes a potential parameter
    let paramIndex = 1;
    for (const [value, count] of textValues) {
      // Skip very short values (likely not meaningful)
      if (value.length < 2) continue;

      const paramName = this.suggestParamName(value, paramIndex);
      params.push({
        name: paramName,
        defaultValue: value,
        description: `Input value (recorded: "${value.substring(0, 50)}")`,
        usedInActions: count
      });
      paramIndex++;
    }

    // Also detect URLs that might be parameterized
    for (const action of recording.actions) {
      if (action.type === 'navigate' && action.params.url) {
        const url = action.params.url;
        // Skip if it's the start URL (likely not a parameter)
        if (url !== recording.metadata.startUrl) {
          params.push({
            name: 'target_url',
            defaultValue: url,
            description: `Navigation target URL`,
            usedInActions: 1
          });
        }
      }
    }

    return params;
  }

  /**
   * Suggest a parameter name based on value content
   */
  suggestParamName(value, index) {
    // Try to infer from content
    if (value.includes('@') && value.includes('.')) return 'email';
    if (/^\+?\d[\d\s-]{6,}$/.test(value)) return 'phone';
    if (/^\d{4,5}$/.test(value)) return 'zip_code';
    if (/^\d+([.,]\d{1,2})?$/.test(value)) return 'amount';
    if (/^https?:\/\//.test(value)) return 'url';
    if (value.length > 50) return 'message';
    return `input_${index}`;
  }

  /**
   * Generate step descriptions from recorded actions
   */
  generateSteps(recording, params) {
    const steps = [];

    for (const action of recording.actions) {
      const step = this.formatStep(action, params);
      if (step) steps.push(step);
    }

    return steps;
  }

  /**
   * Format a single step
   */
  formatStep(action, params) {
    const p = action.params;

    // Replace values with parameter references
    const replaceWithParam = (value) => {
      if (!value) return value;
      const param = params.find(p => p.defaultValue === value);
      return param ? `{{${param.name}}}` : value;
    };

    switch (action.type) {
      case 'navigate':
        return {
          tool: 'browser_navigate',
          args: { url: replaceWithParam(p.url) },
          description: `Navigate to ${p.url}`
        };

      case 'click':
        return {
          tool: 'browser_click',
          args: { selector: p.selector },
          description: `Click "${p.selector}"`
        };

      case 'click_ref':
        return {
          tool: 'browser_click_ref',
          args: { ref: p.ref },
          description: `Click element ${p.ref}`
        };

      case 'type':
        return {
          tool: 'browser_type',
          args: { selector: p.selector, text: replaceWithParam(p.text) },
          description: `Type "${replaceWithParam(p.text)}" into ${p.selector}`
        };

      case 'form_input':
        return {
          tool: 'browser_form_input',
          args: { ref: p.ref, value: replaceWithParam(p.value) },
          description: `Set ${p.ref} to "${replaceWithParam(p.value)}"`
        };

      case 'keyboard_type':
        return {
          tool: 'browser_keyboard',
          args: { action: 'type', text: replaceWithParam(p.text) },
          description: `Type "${replaceWithParam(p.text)}"`
        };

      case 'keyboard_key':
        return {
          tool: 'browser_keyboard',
          args: { action: 'key', key: p.key, modifiers: p.modifiers },
          description: `Press ${p.modifiers?.length ? p.modifiers.join('+') + '+' : ''}${p.key}`
        };

      case 'mouse_click':
        return {
          tool: 'browser_mouse',
          args: { action: 'click', x: p.x, y: p.y },
          description: `Click at (${p.x}, ${p.y})`
        };

      case 'mouse_drag':
        return {
          tool: 'browser_drag',
          args: { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 },
          description: `Drag from (${p.x1},${p.y1}) to (${p.x2},${p.y2})`
        };

      case 'scroll':
        return {
          tool: 'browser_scroll',
          args: { direction: p.direction, amount: p.amount },
          description: `Scroll ${p.direction} ${p.amount}px`
        };

      case 'scroll_to':
        return {
          tool: 'browser_scroll_to',
          args: { ref: p.ref },
          description: `Scroll to ${p.ref}`
        };

      case 'new_tab':
        return {
          tool: 'browser_new_tab',
          args: { url: replaceWithParam(p.url) },
          description: `Open new tab: ${p.url || 'blank'}`
        };

      case 'go_back':
        return { tool: 'browser_go_back', args: {}, description: 'Go back' };

      case 'go_forward':
        return { tool: 'browser_go_forward', args: {}, description: 'Go forward' };

      default:
        return null;
    }
  }

  /**
   * Format as SKILL.md
   */
  formatSkillMd({ name, description, params, steps, startUrl, actionCount, recordedAt }) {
    let md = `# ${name}\n\n`;
    md += `${description}\n\n`;
    md += `> Recorded: ${new Date(recordedAt).toISOString().split('T')[0]} | ${actionCount} actions | Start: ${startUrl || 'N/A'}\n\n`;

    // Parameters
    if (params.length > 0) {
      md += `## Parameters\n\n`;
      md += `| Parameter | Default | Description |\n`;
      md += `|---|---|---|\n`;
      for (const p of params) {
        md += `| \`{{${p.name}}}\` | \`${p.defaultValue.substring(0, 40)}\` | ${p.description} |\n`;
      }
      md += `\n`;
    }

    // Steps
    md += `## Steps\n\n`;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      md += `### ${i + 1}. ${step.description}\n\n`;
      md += `\`\`\`json\n`;
      md += `${JSON.stringify({ tool: step.tool, args: step.args }, null, 2)}\n`;
      md += `\`\`\`\n\n`;
    }

    // Usage
    md += `## Usage\n\n`;
    md += `Call this skill with:\n`;
    md += `\`\`\`\n`;
    md += `[skill:${name.toLowerCase().replace(/\s+/g, '-')}]`;
    if (params.length > 0) {
      md += ` with ${params.map(p => `${p.name}="..."`).join(', ')}`;
    }
    md += `\n\`\`\`\n`;

    return md;
  }

  /**
   * Remove sensitive data from params before recording
   */
  sanitizeParams(params) {
    if (!params) return {};
    const clean = { ...params };
    // Remove potentially sensitive data
    delete clean.authToken;
    return clean;
  }
}

// Export singleton
const recorder = new Recorder();