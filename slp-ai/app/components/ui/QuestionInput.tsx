import React from 'react';

interface QuestionInputProps {
  question: string;
  type: 'text' | 'radio' | 'score';
  choices?: string[];
  value: string;
  onChange: (value: string) => void;
  instructions?: string;
  materials?: string;
}

const QuestionInput: React.FC<QuestionInputProps> = ({
  question,
  type,
  choices,
  value,
  onChange,
  instructions,
  materials
}) => {
  return (
    <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">{question}</h3>
        {instructions && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            Instructions: {instructions}
          </p>
        )}
        {materials && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Materials: {materials}
          </p>
        )}
      </div>

      {type === 'text' && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Enter response..."
        />
      )}

      {type === 'radio' && choices && (
        <div className="space-y-2">
          {choices.map((choice, index) => (
            <label key={index} className="flex items-center space-x-2">
              <input
                type="radio"
                value={choice}
                checked={value === choice}
                onChange={(e) => onChange(e.target.value)}
                className="form-radio text-blue-600"
              />
              <span>{choice}</span>
            </label>
          ))}
        </div>
      )}

      {type === 'score' && (
        <div className="flex space-x-2">
          {['CR', 'O', 'E', '1', '0'].map((score) => (
            <button
              key={score}
              onClick={() => onChange(score)}
              className={`px-4 py-2 rounded-md ${
                value === score
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {score}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionInput; 