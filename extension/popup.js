// Browser Agent Popup UI Script

document.addEventListener('DOMContentLoaded', async () => {
  // Request status from background script
  const response = await chrome.runtime.sendMessage({ action: 'getStatus' });

  updateUI(response);

  // Setup alias input handler
  const saveButton = document.getElementById('saveAlias');
  const aliasInput = document.getElementById('aliasInput');

  // Load current alias if exists
  if (response.alias) {
    aliasInput.value = response.alias;
  }

  // Save alias on button click
  saveButton.addEventListener('click', async () => {
    const alias = aliasInput.value.trim();

    if (!alias) {
      showAliasStatus('Alias cannot be empty', 'error');
      return;
    }

    // Validate alias format (lowercase alphanumeric + hyphens)
    if (!/^[a-z0-9-]+$/.test(alias)) {
      showAliasStatus('Use only lowercase letters, numbers, and hyphens', 'error');
      return;
    }

    saveButton.disabled = true;
    showAliasStatus('Saving...', '');

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'setAlias',
        alias: alias
      });

      if (result.success) {
        showAliasStatus(`✓ Alias "${alias}" saved successfully`, 'success');
      } else {
        showAliasStatus(`✗ ${result.error || 'Failed to save alias'}`, 'error');
      }
    } catch (error) {
      showAliasStatus(`✗ ${error.message}`, 'error');
    } finally {
      saveButton.disabled = false;
    }
  });

  // Save on Enter key
  aliasInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveButton.click();
    }
  });
});

function updateUI(status) {
  const statusDiv = document.getElementById('status');
  const indicator = statusDiv.querySelector('.indicator');
  const statusText = statusDiv.querySelector('span');
  const profileIdSpan = document.getElementById('profileId');

  if (status.connected) {
    statusDiv.className = 'status connected';
    indicator.className = 'indicator connected';
    statusText.textContent = 'Connected to WS Workspace';
  } else {
    statusDiv.className = 'status disconnected';
    indicator.className = 'indicator disconnected';
    statusText.textContent = 'Disconnected';
  }

  // Show profile ID (shortened) or alias if available
  if (status.profileId) {
    const displayText = status.alias || status.profileId.substring(0, 16) + '...';
    profileIdSpan.textContent = displayText;
    profileIdSpan.title = status.profileId;
  }
}

function showAliasStatus(message, type) {
  const statusDiv = document.getElementById('aliasStatus');
  statusDiv.textContent = message;
  statusDiv.className = `alias-status ${type}`;

  // Clear success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = 'alias-status';
    }, 3000);
  }
}
