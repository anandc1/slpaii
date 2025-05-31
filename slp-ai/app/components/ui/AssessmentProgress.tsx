import React from 'react';

interface AssessmentProgressProps {
  totalQuestions: number;
  currentQuestion: number;
  onSave: () => void;
}

const AssessmentProgress: React.FC<AssessmentProgressProps> = ({
  totalQuestions,
  currentQuestion,
  onSave
}) => {
  const progress = (currentQuestion / totalQuestions) * 100;

  return (
    <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50">
      <nav className="h-16 border-b">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center space-x-12">
            <span className="text-[#171717] font-medium">Assessment Progress</span>
            <div className="flex items-center space-x-4">
              <div className="w-48 h-2 bg-gray-100 rounded-full">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm text-gray-600">
                {currentQuestion}/{totalQuestions}
              </span>
            </div>
          </div>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
          >
            Save Progress
          </button>
        </div>
      </nav>
    </div>
  );
};

export default AssessmentProgress; 