document.addEventListener('DOMContentLoaded', () => {
  // Load saved API key
  chrome.storage.sync.get(['openaiApiKey'], (result) => {
    if (result.openaiApiKey) {
      document.getElementById('apiKey').value = result.openaiApiKey;
    }
  });

  // Handle save button click
  document.getElementById('save').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const statusMessage = document.getElementById('status-message');
    
    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      showStatus('Invalid API key format. OpenAI keys should start with "sk-"', 'error');
      return;
    }

    try {
      // Validate the API key with OpenAI
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Invalid API key');
      }

      // Save the valid API key
      await chrome.storage.sync.set({ openaiApiKey: apiKey });
      showStatus('API key saved successfully!', 'success');
      
      // Notify the content script that the API key has been updated
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'apiKeyUpdated' });
      });

    } catch (error) {
      showStatus('Failed to validate API key. Please check if it\'s correct.', 'error');
    }
  });
});

function showStatus(message, type) {
  const statusMessage = document.getElementById('status-message');
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
  
  // Clear status after 3 seconds
  setTimeout(() => {
    statusMessage.textContent = '';
    statusMessage.className = 'status';
  }, 3000);
} 