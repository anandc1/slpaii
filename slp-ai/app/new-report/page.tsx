'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QuestionInput from '../components/ui/QuestionInput';
import AssessmentProgress from '../components/ui/AssessmentProgress';
import ReportQuestion from '../components/ui/ReportQuestion';

interface Question {
  Ages: string;
  Section: string;
  Question: string;
  Answers_Choices?: string;
  'Materials:'?: string;
  Instructions?: string;
  Note?: string;
}

interface PatientInfo {
  name: string;
  birthdate: string;
  assessmentDate: string;
}

export default function NewReport() {
  const router = useRouter();
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: '',
    birthdate: '',
    assessmentDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  const [selectedAge, setSelectedAge] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<'auditory' | 'expressive'>('auditory');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, { score: string; response: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ageRanges = [
    '1.0-1.5', '1.6-1.11', '2.0-2.5', '2.6-2.11',
    '3.0-3.5', '3.6-3.11', '4.0-4.5', '4.6-4.11',
    '5.0-5.5', '5.6-5.11', '6.0-6.11'
  ];

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!selectedAge) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/questions?age=${selectedAge}`);
        if (!response.ok) {
          throw new Error('Failed to fetch questions');
        }
        const data = await response.json();
        setQuestions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load questions');
        console.error('Error fetching questions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [selectedAge]);

  const handleScoreChange = (questionId: string, score: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], score }
    }));
  };

  const handleAnswerChange = (questionId: string, response: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], response }
    }));
  };

  const filteredQuestions = questions.filter(q => 
    q.Ages === selectedAge && 
    (currentSection === 'auditory' ? 
      q.Section === 'Auditory Comprehension' : 
      q.Section === 'Expressive Communication')
  );

  const handleSectionComplete = () => {
    if (currentSection === 'auditory') {
      setCurrentSection('expressive');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // When completing the assessment, navigate to auto-fill-report
      // We can later add the answers and patient info as query params or state
      router.push('/auto-fill-report');
    }
  };

  const handleStartAssessment = () => {
    if (!patientInfo.name || !patientInfo.birthdate || !selectedAge) {
      alert('Please fill in all required fields');
      return;
    }
    localStorage.setItem('patientInfo', JSON.stringify(patientInfo));
    router.push(`/new-report/${encodeURIComponent(selectedAge)}`);
  };

  const handleSave = async () => {
    // Implement save logic
  };

  return (
    <div className="min-h-screen bg-[#fcf8f8]">
      {/* Back to Home Button */}
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <Link 
          href="/"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 transition-colors"
        >
          <svg 
            className="w-5 h-5 mr-2" 
            fill="none" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Patient Info Section */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-medium text-gray-900 mb-6 pb-2 border-b">
              Patient Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={patientInfo.name}
                  onChange={(e) => setPatientInfo({ ...patientInfo, name: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={patientInfo.birthdate}
                  onChange={(e) => setPatientInfo({ ...patientInfo, birthdate: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assessment Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={patientInfo.assessmentDate}
                  onChange={(e) => setPatientInfo({ ...patientInfo, assessmentDate: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Assessment Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-medium text-gray-900 mb-6 pb-2 border-b">
            Assessment
          </h2>
          
          {/* Age Range Pills */}
          <div className="flex flex-wrap gap-2 mb-8">
            {ageRanges.map((range) => (
              <button
                key={range}
                onClick={() => {
                  setSelectedAge(range);
                  setCurrentSection('auditory');
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${selectedAge === range
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                  }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Questions Section */}
          {selectedAge && !isLoading && !error && filteredQuestions.length > 0 && (
            <div>
              {/* Section Header */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {currentSection === 'auditory' ? 'Auditory Comprehension' : 'Expressive Communication'}
                </h3>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all"
                    style={{ width: currentSection === 'auditory' ? '50%' : '100%' }}
                  />
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-6">
                {filteredQuestions.map((question) => (
                  <ReportQuestion
                    key={`${question.Ages}-${question.Section}-${question.Question}`}
                    questionId={`${question.Ages}-${question.Section}-${question.Question.split('.')[0]}`}
                    questionNumber={question.Question.split('.')[0]}
                    section={question.Section}
                    {...question}
                    score={answers[`${question.Ages}-${question.Section}-${question.Question.split('.')[0]}`]?.score || ''}
                    onScoreChange={(score) => handleScoreChange(`${question.Ages}-${question.Section}-${question.Question.split('.')[0]}`, score)}
                    onAnswerChange={(response) => handleAnswerChange(`${question.Ages}-${question.Section}-${question.Question.split('.')[0]}`, response)}
                  />
                ))}

                {/* Navigation Buttons */}
                <div className="flex justify-end gap-4 pt-6">
                  {currentSection === 'expressive' && (
                    <button
                      onClick={() => {
                        setCurrentSection('auditory');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="px-6 py-2 bg-white text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
                    >
                      Back to Auditory
                    </button>
                  )}
                  <button
                    onClick={handleSectionComplete}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    {currentSection === 'auditory' ? 
                      'Continue to Expressive Communication' : 
                      'Complete Assessment'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* No Questions Found */}
          {selectedAge && !isLoading && !error && filteredQuestions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No questions found for this age range and section.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}