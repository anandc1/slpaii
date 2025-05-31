import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { parse } from 'csv-parse/sync';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const age = searchParams.get('age');

  if (!age) {
    return NextResponse.json({ error: 'Age parameter is required' }, { status: 400 });
  }

  try {
    // Read the CSV file
    const filePath = path.join(process.cwd(), 'public/resources/SLP-AI-Dataset.csv');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    // Parse CSV data
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Filter questions for the specified age range
    const filteredQuestions = records.filter((record: any) => record.Ages === age);
    
    // Sort questions by their number
    filteredQuestions.sort((a: any, b: any) => {
      const aNum = parseInt(a.Question.split('.')[0]);
      const bNum = parseInt(b.Question.split('.')[0]);
      return aNum - bNum;
    });

    return NextResponse.json(filteredQuestions);
  } catch (error) {
    console.error('Error reading questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' }, 
      { status: 500 }
    );
  }
} 