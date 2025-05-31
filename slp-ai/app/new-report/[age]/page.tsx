'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ReportQuestion from '@/app/components/ui/ReportQuestion';
import AssessmentProgress from '@/app/components/ui/AssessmentProgress';

interface Question {
  age: string;
  section: string;
  question: string;
  answerChoices?: string;
  materials?: string;
  instructions?: string;
}

interface Answer {
  score: string;
  response: string;
}

export default function AgeReport() {
  const params = useParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch(`/api/questions?age=${params.age}`);
        const data = await response.json();
        setQuestions(data);
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [params.age]);

  const handleScoreChange = (questionId: string, score: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        score
      }
    }));
  };

  const handleAnswerChange = (questionId: string, response: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        response
      }
    }));
  };

  const handleSave = async () => {
    console.log('Saving answers:', answers);
  };

  // Group questions by age range
  const groupedQuestions = questions.reduce((acc, question) => {
    const age = question.age;
    if (!acc[age]) {
      acc[age] = {
        auditory: [],
        expressive: []
      };
    }
    if (question.section === 'Auditory Comprehension') {
      acc[age].auditory.push(question);
    } else {
      acc[age].expressive.push(question);
    }
    return acc;
  }, {} as Record<string, { auditory: Question[], expressive: Question[] }>);

  const ageRanges = Object.keys(groupedQuestions);
  const currentAgeIndex = ageRanges.indexOf(params.age as string);
  
  const navigateToAge = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentAgeIndex - 1 : currentAgeIndex + 1;
    if (newIndex >= 0 && newIndex < ageRanges.length) {
      const element = document.getElementById(`age-${ageRanges[newIndex]}`);
      element?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Fixed Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <AssessmentProgress
          totalQuestions={questions.length}
          currentQuestion={Object.keys(answers).length}
          onSave={handleSave}
        />
        
        {/* Age Navigation */}
        <div className="px-4 md:px-6 py-2 flex items-center justify-between">
          <button
            onClick={() => navigateToAge('prev')}
            disabled={currentAgeIndex <= 0}
            className={`p-2 rounded-full ${
              currentAgeIndex <= 0 
                ? 'text-gray-300' 
                : 'text-purple-600 hover:bg-purple-50'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide">
            {ageRanges.map((ageRange) => (
              <button
                key={ageRange}
                onClick={() => {
                  const element = document.getElementById(`age-${ageRange}`);
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
                  ageRange === params.age
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                Age {ageRange}
              </button>
            ))}
          </div>

          <button
            onClick={() => navigateToAge('next')}
            disabled={currentAgeIndex >= ageRanges.length - 1}
            className={`p-2 rounded-full ${
              currentAgeIndex >= ageRanges.length - 1 
                ? 'text-gray-300' 
                : 'text-purple-600 hover:bg-purple-50'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {Object.entries(groupedQuestions).map(([ageRange, sections]) => (
          <div 
            key={ageRange} 
            id={`age-${ageRange}`}
            className="mb-12 age-section bg-white rounded-lg shadow-sm border border-gray-100 p-4 md:p-6"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-6 border-b pb-3">
              Age Range: {ageRange}
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              {/* Auditory Section */}
              <div>
                <h3 className="text-lg font-medium mb-4 border-l-4 border-purple-600 pl-3 text-gray-900">
                  Auditory Comprehension
                </h3>
                <div className="space-y-4">
                  {sections.auditory.map((question, index) => (
                    <div key={`${ageRange}-${question.section}-${index}`} className="bg-purple-50 rounded-lg">
                      <ReportQuestion
                        Ages={question.age}
                        Section={question.section}
                        Question={question.question}
                        section={question.section.toLowerCase()}
                        questionId={`${ageRange}-${question.section}-${question.question.split('.')[0]}`}
                        questionNumber={question.question.split('.')[0]}
                        score={answers[`${ageRange}-${question.section}-${question.question.split('.')[0]}`]?.score || ''}
                        onScoreChange={(score) => handleScoreChange(`${ageRange}-${question.section}-${question.question.split('.')[0]}`, score)}
                        onAnswerChange={(response) => handleAnswerChange(`${ageRange}-${question.section}-${question.question.split('.')[0]}`, response)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Expressive Section */}
              <div>
                <h3 className="text-lg font-medium mb-4 border-l-4 border-purple-600 pl-3 text-gray-900">
                  Expressive Communication
                </h3>
                <div className="space-y-4">
                  {sections.expressive.map((question, index) => (
                    <div key={`${ageRange}-${question.section}-${index}`} className="bg-purple-50 rounded-lg">
                      <ReportQuestion
                        Ages={question.age}
                        Section={question.section}
                        Question={question.question}
                        section={question.section.toLowerCase()}
                        questionId={`${ageRange}-${question.section}-${question.question.split('.')[0]}`}
                        questionNumber={question.question.split('.')[0]}
                        score={answers[`${ageRange}-${question.section}-${question.question.split('.')[0]}`]?.score || ''}
                        onScoreChange={(score) => handleScoreChange(`${ageRange}-${question.section}-${question.question.split('.')[0]}`, score)}
                        onAnswerChange={(response) => handleAnswerChange(`${ageRange}-${question.section}-${question.question.split('.')[0]}`, response)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fixed Bottom Navigation (Mobile) */}
      <div className="lg:hidden fixed bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="p-3 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      </div>
    </div>
  );
} 