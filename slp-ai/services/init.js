// Initialize OpenAI Service
window.initializeOpenAI = async function() {
    if (!window.OpenAIService) {
        throw new Error('OpenAI Service not loaded');
    }
    return await OpenAIService.initialize();
}; 