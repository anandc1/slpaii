import React, { useState } from 'react';

interface ReportQuestionProps {
  section: string;
  questionId: string;
  questionNumber: string;
  score: string;
  onScoreChange: (score: string) => void;
  onAnswerChange: (response: string) => void;
  Ages: string;
  Section: string;
  Question: string;
  Answers_Choices?: string;
  'Materials:'?: string;
  Instructions?: string;
  Note?: string;
}

const ReportQuestion: React.FC<ReportQuestionProps> = ({
  section,
  questionId,
  questionNumber,
  score,
  onScoreChange,
  onAnswerChange,
  Ages,
  Section,
  Question,
  Answers_Choices,
  'Materials:': materials,
  Instructions,
  Note,
}) => {
  const [methodScore, setMethodScore] = useState<string>('');
  const [valueScore, setValueScore] = useState<string>('');

  const cleanQuestion = Question?.includes('.')
    ? Question.split('.').slice(1).join('.').trim()
    : Question?.trim() || '';

  const hasTextInput = Boolean(Answers_Choices?.includes('_____'));
  
  const choices = Answers_Choices
    ? Answers_Choices.split('\n').filter(choice => 
        choice.trim().startsWith('a.') || 
        choice.trim().startsWith('b.') || 
        choice.trim().startsWith('c.') || 
        choice.trim().startsWith('d.')
      )
    : [];

  const textInputs = hasTextInput && Answers_Choices
    ? Answers_Choices.split('\n').filter(line => line.includes('_____'))
    : [];

  const handleMethodScoreClick = (scoreOption: string) => {
    setMethodScore(prev => {
      // If clicking the same method, deselect it
      const newScore = prev === scoreOption ? '' : scoreOption;
      
      // Update the combined score
      onScoreChange([newScore, valueScore].filter(Boolean).join(' '));
      return newScore;
    });
  };

  const handleValueScoreClick = (scoreOption: string) => {
    setValueScore(prev => {
      // If clicking the same value, deselect it
      const newScore = prev === scoreOption ? '' : scoreOption;
      
      // Update the combined score
      onScoreChange([methodScore, newScore].filter(Boolean).join(' '));
      return newScore;
    });
  };

  return (
    <div className="p-4 bg-purple-50 rounded-lg">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-grow">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-base font-bold text-gray-900">{questionNumber}.</span>
            <span className="text-base font-bold text-gray-900">{cleanQuestion}</span>
          </div>
          
          {materials && (
            <div className="mt-2 text-sm text-gray-700 bg-white p-2 rounded">
              <span className="font-semibold">Materials:</span> {materials}
            </div>
          )}

          {Instructions && (
            <div className="mt-2 text-sm text-gray-700 bg-white p-2 rounded">
              <span className="font-semibold">Instructions:</span> {Instructions}
            </div>
          )}

          {Note && (
            <div className="mt-2 text-sm text-gray-600 bg-white p-2 rounded">
              <span className="font-semibold">Note:</span> <em>{Note}</em>
            </div>
          )}

          <div className="mt-4">
            {choices.length > 0 ? (
              <div className="space-y-2 bg-white p-3 rounded">
                {choices.map((choice, index) => (
                  <label key={index} className="flex items-center space-x-2 hover:bg-purple-50 p-2 rounded cursor-pointer">
                    <input
                      type="radio"
                      name={`question-${questionId}`}
                      value={choice}
                      onChange={(e) => onAnswerChange(e.target.value)}
                      className="form-radio text-purple-600"
                    />
                    <span className="text-sm text-gray-900">{choice}</span>
                  </label>
                ))}
              </div>
            ) : hasTextInput ? (
              <div className="space-y-2">
                {textInputs.map((line, index) => (
                  <div key={index} className="bg-white p-3 rounded">
                    <label className="block text-sm text-gray-700 mb-1 font-medium">
                      {line.replace('_____', '')}
                    </label>
                    <input
                      type="text"
                      placeholder="Enter your response..."
                      onChange={(e) => onAnswerChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 placeholder-gray-500"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* Method Scores (CR, O, E) */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700 mb-1">Method:</p>
            {['CR', 'O', 'E'].map((scoreOption) => (
              <button
                key={scoreOption}
                onClick={() => handleMethodScoreClick(scoreOption)}
                className={`w-full px-3 py-1.5 text-sm rounded-md font-medium transition-colors
                  ${methodScore === scoreOption
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-purple-100'
                  }`}
              >
                {scoreOption}
              </button>
            ))}
          </div>

          {/* Value Scores (1, 0) */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700 mb-1">Score:</p>
            {['1', '0'].map((scoreOption) => (
              <button
                key={scoreOption}
                onClick={() => handleValueScoreClick(scoreOption)}
                className={`w-full px-3 py-1.5 text-sm rounded-md font-medium transition-colors
                  ${valueScore === scoreOption
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-purple-100'
                  }`}
              >
                {scoreOption}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportQuestion; 