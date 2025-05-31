class OpenAIService {
    static API_URL = 'https://api.openai.com/v1/chat/completions';
    static API_KEY = null; // Will be set from storage

    static async initialize() {
        try {
            const result = await chrome.storage.local.get(['openai_api_key']);
            this.API_KEY = result.openai_api_key;
            return !!this.API_KEY;
        } catch (error) {
            console.error('Failed to initialize OpenAI service:', error);
            return false;
        }
    }

    static async generateResponse(prompt) {
        if (!this.API_KEY) {
            const isInitialized = await this.initialize();
            if (!isInitialized) {
                throw new Error('OpenAI API key not found. Please set it in the extension settings.');
            }
        }

        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 150
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to generate response');
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error('OpenAI API Error:', error);
            throw error;
        }
    }
}

// Export the service
window.OpenAIService = OpenAIService; 