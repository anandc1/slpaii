import OpenAI from 'openai';

export async function generateReport(template: string, inputData: string) {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        template, 
        inputData,
        timestamp: Date.now()
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate report');
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error('Error in generateReport:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate report');
  }
} 