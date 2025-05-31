import config from '../config.js';

// OpenAI Service for handling API calls
const OpenAIService = {
  async getApiKey() {
    const result = await chrome.storage.sync.get(['openaiApiKey']);
    if (!result.openaiApiKey) {
      throw new Error('OpenAI API key not found. Please set it in the extension options.');
    }
    return result.openaiApiKey;
  },

  async generateResponse(prompt, options = {}) {
    try {
      const apiKey = await this.getApiKey();
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that generates professional responses for form fields."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API error');
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI Service Error:', error);
      throw error;
    }
  },
  // Other methods...
};

// Make it available globally
window.OpenAIService = OpenAIService; 