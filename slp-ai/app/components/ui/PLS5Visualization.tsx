'use client';

import React from 'react';

interface PLS5Score {
  label: string;
  value: string | number;
}

interface PLS5Data {
  formType: string;
  patientInfo?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    sex?: string;
    grade?: string;
    [key: string]: any;
  };
  childInfo?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    sex?: string;
    grade?: string;
    [key: string]: any;
  };
  testDate?: string;
  birthDate?: string;
  chronologicalAge?: {
    years: number;
    months: number;
  };
  scores: {
    rawScores?: Record<string, any>;
    standardScores?: Record<string, any>;
    percentiles?: Record<string, any>;
    confidenceIntervals?: Record<string, any>;
    compositeScores?: Record<string, any>;
    [key: string]: any;
  };
  otherFields?: Record<string, any>;
}

interface PLS5VisualizationProps {
  data: PLS5Data | { data: PLS5Data };
}

const PLS5Visualization: React.FC<PLS5VisualizationProps> = ({ data }) => {
  // Add diagnostic logging
  console.log('PLS5Visualization received data:', data);

  if (!data) {
    return <div className="p-4 text-red-500">No data available</div>;
  }

  // Handle different possible data structures
  // If data.data exists (nested structure from API), use that
  const assessmentData = 'data' in data ? data.data : data;
  
  if (!assessmentData.formType && !assessmentData.childInfo && !assessmentData.scores) {
    console.error('Invalid PLS-5 data structure:', assessmentData);
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <h3 className="text-lg font-medium text-red-700">Invalid Data Format</h3>
        <p className="text-red-600 mt-1">The data doesn't appear to be in the expected PLS-5 format.</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-red-700">View Raw Data</summary>
          <pre className="mt-2 text-xs overflow-x-auto bg-white p-2 rounded">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  // Ensure scores object exists
  const scores = assessmentData.scores || {};
  
  // Create safer accessors for data properties with fallbacks
  // Support both patientInfo (new format) and childInfo (old format)
  const childInfo = assessmentData.patientInfo || assessmentData.childInfo || {};

  return (
    <div className="bg-white shadow-md rounded-lg p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6 text-purple-700">
        {assessmentData.formType || 'PLS-5'} Assessment Results
      </h2>
      
      {/* Debug information - remove in production */}
      <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-black">
        <p>Data format: {typeof assessmentData === 'object' ? 'Object' : typeof assessmentData}</p>
        <p>Has scores: {scores ? 'Yes' : 'No'}</p>
        <p>Has childInfo: {childInfo ? 'Yes' : 'No'}</p>
      </div>
      
      {/* Client Information */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2 text-purple-600">Child Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-black">
          <InfoCard label="Name" value={childInfo?.name || 'N/A'} />
          <InfoCard label="Age" value={childInfo?.age || 'N/A'} />
          <InfoCard label="Sex" value={childInfo?.sex || 'N/A'} />
          <InfoCard label="Grade" value={childInfo?.grade || 'N/A'} />
        </div>
      </div>
      
      {/* Test Information */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2 text-purple-600">Test Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-black">
          <InfoCard label="Test Date" value={assessmentData.testDate || 'N/A'} />
          <InfoCard label="Birth Date" value={assessmentData.birthDate || 'N/A'} />
          <InfoCard label="Chronological Age" value={assessmentData.chronologicalAge ? `${assessmentData.chronologicalAge.years} years, ${assessmentData.chronologicalAge.months} months` : 'N/A'} />
        </div>
      </div>
      
      {/* Score Summary */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2 text-purple-600">Score Summary</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr className="bg-purple-100 text-black">
                <th className="py-2 px-4 border-b border-gray-300 text-left">Measure</th>
                <th className="py-2 px-4 border-b border-gray-300 text-center">Raw Score</th>
                <th className="py-2 px-4 border-b border-gray-300 text-center">Standard Score</th>
                <th className="py-2 px-4 border-b border-gray-300 text-center">Percentile</th>
                <th className="py-2 px-4 border-b border-gray-300 text-center">Confidence Interval</th>
              </tr>
            </thead>
            <tbody>
              <ScoreRow 
                label="Auditory Comprehension (AC)" 
                rawScore={findScore(scores.rawScores, 'AC Raw Score', 'AC', 'Auditory')}
                standardScore={findScore(scores.standardScores, 'AC Standard Score', 'AC', 'Auditory')}
                percentile={findScore(scores.percentiles, 'AC Percentile', 'AC', 'Auditory')}
                confidenceInterval={findScore(scores.confidenceIntervals, 'AC Confidence', 'AC', 'Auditory')}
              />
              <ScoreRow 
                label="Expressive Communication (EC)" 
                rawScore={findScore(scores.rawScores, 'EC Raw Score', 'EC', 'Expressive')}
                standardScore={findScore(scores.standardScores, 'EC Standard Score', 'EC', 'Expressive')}
                percentile={findScore(scores.percentiles, 'EC Percentile', 'EC', 'Expressive')}
                confidenceInterval={findScore(scores.confidenceIntervals, 'EC Confidence', 'EC', 'Expressive')}
              />
              <ScoreRow 
                label="Total Language Score" 
                rawScore={findScore(scores.compositeScores, 'Total Raw', 'Total', 'Language')}
                standardScore={findScore(scores.compositeScores, 'Standard Score Total', 'Total Standard', 'Language')}
                percentile={findScore(scores.compositeScores, 'Total Percentile', 'Total', 'Language')}
                confidenceInterval={findScore(scores.confidenceIntervals, 'Total Confidence', 'Total', 'Language')}
                isHighlighted
              />
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Raw Data Display */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-2 text-purple-600">All Extracted Data</h3>
        <div className="bg-gray-100 p-4 rounded-md">
          <details>
            <summary className="cursor-pointer font-medium text-purple-700">View Raw Data</summary>
            <pre className="mt-2 text-xs overflow-x-auto text-black">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
};

interface InfoCardProps {
  label: string;
  value: string | number;
}

const InfoCard: React.FC<InfoCardProps> = ({ label, value }) => (
  <div className="bg-gray-50 p-3 rounded border border-gray-200">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="font-medium">{value}</p>
  </div>
);

interface ScoreRowProps {
  label: string;
  rawScore?: string | number;
  standardScore?: string | number;
  percentile?: string | number;
  confidenceInterval?: string | number;
  isHighlighted?: boolean;
}

const ScoreRow: React.FC<ScoreRowProps> = ({ 
  label, 
  rawScore, 
  standardScore, 
  percentile, 
  confidenceInterval,
  isHighlighted = false 
}) => (
  <tr className={isHighlighted ? "bg-purple-50" : ""}>
    <td className="py-2 px-4 border-b border-gray-300 font-medium text-black">{label}</td>
    <td className="py-2 px-4 border-b border-gray-300 text-center text-black">{rawScore || 'N/A'}</td>
    <td className="py-2 px-4 border-b border-gray-300 text-center text-black">{standardScore || 'N/A'}</td>
    <td className="py-2 px-4 border-b border-gray-300 text-center text-black">{percentile || 'N/A'}</td>
    <td className="py-2 px-4 border-b border-gray-300 text-center text-black">{confidenceInterval || 'N/A'}</td>
  </tr>
);

// Helper function to find a score by searching through multiple possible keys
function findScore(scoreObj: Record<string, any> = {}, ...possibleKeys: string[]): string | number | undefined {
  // Guard against undefined or null
  if (!scoreObj) return undefined;
  
  // If scoreObj is directly a string or number, return it
  if (typeof scoreObj === 'string' || typeof scoreObj === 'number') {
    return scoreObj;
  }
  
  for (const key of possibleKeys) {
    // Try exact match
    if (scoreObj[key] !== undefined) return scoreObj[key];
    
    // Try key that contains the search term (case insensitive)
    try {
      const matchingKey = Object.keys(scoreObj).find(k => 
        k.toLowerCase().includes(key.toLowerCase())
      );
      
      if (matchingKey) return scoreObj[matchingKey];
    } catch (e) {
      console.error(`Error searching for key ${key} in`, scoreObj, e);
    }
  }
  
  // Look for any key that might contain relevant terms
  try {
    // For raw scores
    if (possibleKeys.some(k => k.toLowerCase().includes('raw'))) {
      const rawKey = Object.keys(scoreObj).find(k => 
        k.toLowerCase().includes('raw')
      );
      if (rawKey) return scoreObj[rawKey];
    }
    
    // For standard scores
    if (possibleKeys.some(k => k.toLowerCase().includes('standard'))) {
      const standardKey = Object.keys(scoreObj).find(k => 
        k.toLowerCase().includes('standard') || k.toLowerCase().includes('ss')
      );
      if (standardKey) return scoreObj[standardKey];
    }
    
    // For percentiles
    if (possibleKeys.some(k => k.toLowerCase().includes('percentile'))) {
      const percentileKey = Object.keys(scoreObj).find(k => 
        k.toLowerCase().includes('percentile') || k.toLowerCase().includes('pr') || k.toLowerCase().includes('rank')
      );
      if (percentileKey) return scoreObj[percentileKey];
    }
  } catch (e) {
    console.error('Error in extended search:', e);
  }
  
  return undefined;
}

export default PLS5Visualization; 