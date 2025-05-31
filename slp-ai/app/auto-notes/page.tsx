'use client';

import { useState, useEffect } from 'react';
import Anthropic from '@anthropic-ai/sdk';

interface SavedSection {
  category: string;
  data: {
    title: string;
    fields: any[];
    content: string;
  };
  timestamp: string;
  url: string;
}

export default function AutoNotes() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [savedSections, setSavedSections] = useState<SavedSection[]>([]);

  useEffect(() => {
    // In a real implementation, this would fetch from your backend
    // For now, we'll use mock data
    const mockSavedSections: SavedSection[] = [
      {
        category: 'patient-info',
        data: {
          title: 'Patient Demographics',
          fields: [],
          content: 'Sample patient information'
        },
        timestamp: new Date().toISOString(),
        url: 'https://example.com'
      }
    ];
    setSavedSections(mockSavedSections);
  }, []);

  const handleGenerateNotes = async () => {
    setLoading(true);
    try {
      const anthropic = new Anthropic({
        apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const message = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1000,
        temperature: 0,
        system: "You are an expert at generating clinical notes. Please be precise and professional.",
        messages: [
          {
            role: "user",
            content: "Generate a sample clinical note."
          }
        ]
      });

      if (message.content[0].type === 'text') {
        setResult(message.content[0].text);
      }
    } catch (error) {
      console.error('Error generating notes:', error);
      setResult('Error generating notes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'patient-info': 'bg-blue-100 border-blue-200',
      'assessment': 'bg-green-100 border-green-200',
      'treatment': 'bg-purple-100 border-purple-200',
      'progress': 'bg-yellow-100 border-yellow-200',
      'goals': 'bg-pink-100 border-pink-200',
      'other': 'bg-gray-100 border-gray-200'
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Auto Notes Generator</h1>
          <button
            onClick={handleGenerateNotes}
            disabled={loading}
            className="flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            {loading ? 'Generating...' : 'Generate Notes'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {savedSections.map((section, index) => (
            <div
              key={index}
              className={`rounded-lg border p-6 ${getCategoryColor(section.category)} transition-all hover:shadow-md`}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{section.data.title}</h3>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-white text-gray-600">
                  {section.category}
                </span>
              </div>
              <p className="text-gray-600 mb-4 line-clamp-3">{section.data.content}</p>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>{new Date(section.timestamp).toLocaleDateString()}</span>
                <button className="text-indigo-600 hover:text-indigo-800">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>

        {result && (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <pre className="whitespace-pre-wrap">{result}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 