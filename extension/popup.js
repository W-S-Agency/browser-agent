// Browser Agent Popup UI Script

document.addEventListener('DOMContentLoaded', async () => {
  // Request status from background script
  const response = await chrome.runtime.sendMessage({ action: 'getStatus' });

  updateUI(response);
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

  // Show profile ID (shortened)
  if (status.profileId) {
    const shortId = status.profileId.substring(0, 16) + '...';
    profileIdSpan.textContent = shortId;
    profileIdSpan.title = status.profileId;
  }
}
