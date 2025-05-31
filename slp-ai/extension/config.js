const config = {
  apiKey: '', // Will be set from extension storage
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-3.5-turbo'
};

// Load API key from extension storage
chrome.storage.sync.get(['openaiApiKey'], (result) => {
  if (result.openaiApiKey) {
    config.apiKey = result.openaiApiKey;
  }
});

export default config; 