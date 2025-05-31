'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAssessment } from '@/app/lib/assessmentModel';
import Image from 'next/image';

interface Assessment {
  id: string;
  userId: string;
  templateId: string;
  formType: string;
  imageUrl?: string;
  tokenId?: string;
  dateCreated: string;
}

export default function ResultsClient({
  assessmentId,
  isMock,
}: {
  assessmentId: string;
  isMock: boolean;
}) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAssessment() {
      try {
        if (isMock) {
          // Load from localStorage for mock assessments
          const mockAssessments = JSON.parse(localStorage.getItem('mockAssessments') || '[]');
          const mockAssessment = mockAssessments.find((a: Assessment) => a.id === assessmentId);
          
          if (mockAssessment) {
            console.log('Loaded mock assessment:', mockAssessment);
            setAssessment(mockAssessment);
          } else {
            // If not found, use a default mock assessment
            console.log('Mock assessment not found, using default');
            setAssessment({
              id: assessmentId,
              userId: 'anonymous',
              templateId: 'auto-detect',
              formType: 'PLS-5',
              imageUrl: 'https://www.pearsonassessments.com/content/dam/school/global/clinical/us/assets/pls5/pls-5-sample.jpg',
              dateCreated: new Date().toISOString()
            });
          }
        } else {
          // Load from Firestore for regular assessments
          const result = await getAssessment(assessmentId);
          if (result) {
            console.log('Loaded assessment from Firestore:', result);
            setAssessment({
              id: assessmentId,
              userId: result.patientUID || 'anonymous',
              templateId: result.templateId || 'auto-detect',
              formType: result.type || 'unknown',
              imageUrl: result.imageUrl,
              tokenId: result.tokenId,
              dateCreated: result.dateCreated ? new Date(result.dateCreated.seconds * 1000).toISOString() : new Date().toISOString()
            });
          } else {
            // If not found in Firestore, try localStorage as fallback
            const mockAssessments = JSON.parse(localStorage.getItem('mockAssessments') || '[]');
            const fallbackAssessment = mockAssessments.find((a: Assessment) => a.id === assessmentId);
            
            if (fallbackAssessment) {
              console.log('Assessment not found in Firestore, using localStorage fallback');
              setAssessment(fallbackAssessment);
            } else {
              setError('Assessment not found');
            }
          }
        }
      } catch (err) {
        console.error('Error loading assessment:', err);
        setError('Error loading assessment. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadAssessment();
  }, [assessmentId, isMock]);

  const handleProcessAssessment = () => {
    // This would be where you trigger the AI processing
    alert('AI processing would start here. Using the image URL: ' + assessment?.imageUrl);
  };

  const handleGoBack = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-md p-6 mb-6">
          <h2 className="text-xl font-bold text-red-700 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={handleGoBack}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 mb-6">
          <h2 className="text-xl font-bold text-yellow-700 mb-2">Assessment Not Found</h2>
          <p className="text-yellow-600">The assessment you're looking for could not be found.</p>
          <button
            onClick={handleGoBack}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Assessment Results</h1>
            {isMock && (
              <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                Mock Mode
              </div>
            )}
          </div>
          
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Assessment Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-md">
              <div>
                <p className="text-sm text-gray-500">Assessment ID</p>
                <p className="font-medium">{assessment.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Template</p>
                <p className="font-medium">{assessment.formType || assessment.templateId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date Created</p>
                <p className="font-medium">{new Date(assessment.dateCreated).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium">Ready for Processing</p>
              </div>
            </div>
          </div>
          
          {assessment.imageUrl && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Assessment Image</h2>
              <div className="bg-gray-50 p-4 rounded-md flex justify-center">
                <img
                  src={assessment.imageUrl}
                  alt="Assessment"
                  className="max-h-96 object-contain"
                />
              </div>
              {isMock && (
                <p className="text-sm text-gray-500 mt-2 italic">
                  This is a sample image being used because Firebase Storage is unavailable.
                </p>
              )}
            </div>
          )}
          
          <div className="flex justify-between mt-8">
            <button
              onClick={handleGoBack}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded"
            >
              Back
            </button>
            <button
              onClick={handleProcessAssessment}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Process with AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
