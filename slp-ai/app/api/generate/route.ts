import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { template, inputData } = await request.json();

    if (!template || !inputData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional speech-language pathologist writing detailed report sections."
        },
        {
          role: "user",
          content: `${template}\n\nObservations:\n${inputData}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const content = completion.choices[0].message.content;

    if (!content) {
      throw new Error('No content generated');
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate report' },
      { status: 500 }
    );
  }
} 