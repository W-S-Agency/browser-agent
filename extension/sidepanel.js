// Browser Agent Side Panel
// Live monitoring: connection status, agent tabs, action log

let actionLog = [];
let updateInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  updateStatus();
  // Poll for updates every 2 seconds
  updateInterval = setInterval(updateStatus, 2000);

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'actionLog') {
      addLogEntry(message.entry);
    }
    if (message.type === 'statusUpdate') {
      renderStatus(message.status);
    }
    if (message.type === 'planUpdate') {
      renderPlan(message.plan);
    }
  });
});

async function updateStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ action: 'getStatus' });
    renderStatus(status);

    // Also request action log
    const log = await chrome.runtime.sendMessage({ action: 'getActionLog' });
    if (log && log.entries) {
      renderLog(log.entries);
    }
  } catch {
    // Extension might be reloading
  }
}

function renderStatus(status) {
  if (!status) return;

  const statusBar = document.getElementById('statusBar');
  const statusDot = statusBar.querySelector('.status-dot');
  const statusLabel = statusBar.querySelector('.status-label');
  const statusDetail = document.getElementById('statusDetail');
  const profileName = document.getElementById('profileName');
  const tabCount = document.getElementById('tabCount');

  if (status.connected) {
    statusBar.className = 'status-bar connected';
    statusDot.className = 'status-dot connected';
    statusLabel.textContent = 'Connected';
    statusDetail.textContent = status.alias || status.profileId?.substring(0, 20) + '...';
  } else {
    statusBar.className = 'status-bar disconnected';
    statusDot.className = 'status-dot disconnected';
    statusLabel.textContent = 'Disconnected';
    statusDetail.textContent = 'Bridge Server not reachable';
  }

  profileName.textContent = status.alias || status.profileId?.substring(0, 16) || '—';
  tabCount.textContent = (status.agentTabs || 0).toString();

  // Recording status
  const recordingBar = document.getElementById('recordingBar');
  const recordingName = document.getElementById('recordingName');
  const recordingActions = document.getElementById('recordingActions');
  if (status.recording?.isRecording) {
    recordingBar.style.display = 'block';
    recordingName.textContent = status.recording.currentName || '';
    recordingActions.textContent = `${status.recording.actionCount} actions`;
  } else {
    recordingBar.style.display = 'none';
  }

  // Render plan
  if (status.plan) {
    renderPlan(status.plan);
  }

  // Render agent tabs
  if (status.agentTabsList) {
    renderTabs(status.agentTabsList);
  }
}

function renderTabs(tabs) {
  const tabList = document.getElementById('tabList');

  if (!tabs || tabs.length === 0) {
    tabList.innerHTML = '<div class="tab-empty">No agent tabs open</div>';
    return;
  }

  tabList.innerHTML = tabs.map(tab => {
    const domain = tab.url ? new URL(tab.url).hostname.replace('www.', '') : 'blank';
    const initial = domain.charAt(0).toUpperCase();
    const title = tab.title || tab.url || 'New Tab';

    return `
      <div class="tab-item" title="${tab.url || ''}">
        <div class="tab-favicon">${initial}</div>
        <div class="tab-title">${escapeHtml(title)}</div>
      </div>
    `;
  }).join('');
}

function renderLog(entries) {
  const logContainer = document.getElementById('logContainer');
  const logCount = document.getElementById('logCount');
  const logEmpty = document.getElementById('logEmpty');

  if (!entries || entries.length === 0) {
    if (logEmpty) logEmpty.style.display = 'block';
    logCount.textContent = '0';
    return;
  }

  if (logEmpty) logEmpty.style.display = 'none';
  logCount.textContent = entries.length.toString();

  logContainer.innerHTML = entries.map(entry => {
    const icon = entry.status === 'success' ? '✓'
      : entry.status === 'error' ? '✗'
      : entry.status === 'running' ? '►'
      : '•';

    const time = new Date(entry.timestamp).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    return `
      <div class="log-entry ${entry.status}">
        <span class="log-icon">${icon}</span>
        <div class="log-content">
          <div class="log-action">${escapeHtml(entry.action)}</div>
          ${entry.detail ? `<div class="log-detail">${escapeHtml(entry.detail)}</div>` : ''}
        </div>
        <span class="log-time">${time}</span>
      </div>
    `;
  }).join('');

  // Auto-scroll to bottom
  logContainer.scrollTop = logContainer.scrollHeight;
}

function addLogEntry(entry) {
  const logContainer = document.getElementById('logContainer');
  const logCount = document.getElementById('logCount');
  const logEmpty = document.getElementById('logEmpty');

  if (logEmpty) logEmpty.style.display = 'none';

  const icon = entry.status === 'success' ? '✓'
    : entry.status === 'error' ? '✗'
    : entry.status === 'running' ? '►'
    : '•';

  const time = new Date(entry.timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const html = `
    <div class="log-entry ${entry.status}">
      <span class="log-icon">${icon}</span>
      <div class="log-content">
        <div class="log-action">${escapeHtml(entry.action)}</div>
        ${entry.detail ? `<div class="log-detail">${escapeHtml(entry.detail)}</div>` : ''}
      </div>
      <span class="log-time">${time}</span>
    </div>
  `;

  logContainer.insertAdjacentHTML('beforeend', html);
  logContainer.scrollTop = logContainer.scrollHeight;

  // Update count
  const currentCount = parseInt(logCount.textContent || '0');
  logCount.textContent = (currentCount + 1).toString();
}

function renderPlan(plan) {
  const planSection = document.getElementById('planSection');
  const planList = document.getElementById('planList');
  const planProgress = document.getElementById('planProgress');

  if (!plan || !plan.steps || plan.steps.length === 0) {
    planSection.style.display = 'none';
    return;
  }

  planSection.style.display = 'block';

  const completed = plan.steps.filter(s => s.status === 'completed' || s.status === 'done').length;
  planProgress.textContent = `${completed}/${plan.steps.length}`;

  planList.innerHTML = plan.steps.map((step, i) => {
    const icon = step.status === 'completed' || step.status === 'done' ? '&#10003;'
      : step.status === 'in_progress' ? '&#9654;'
      : '&#9675;';

    return `
      <div class="plan-step ${step.status}">
        <span class="plan-icon">${icon}</span>
        <span class="plan-text">${escapeHtml(step.text)}</span>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
