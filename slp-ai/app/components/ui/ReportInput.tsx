import React from 'react';

interface ReportInputProps {
  title: string;
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  isLoading: boolean;
}

const ReportInput: React.FC<ReportInputProps> = ({ 
  title, 
  suggestions, 
  value, 
  onChange,
  onSubmit,
  isLoading 
}) => {
  const handleSuggestionClick = (suggestion: string) => {
    const newValue = value ? `${value}\n${suggestion}` : suggestion;
    onChange(newValue);
  };

  return (
    <div className="flex gap-4">
      <div className="flex-1 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onSubmit}
            disabled={isLoading}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            Generate
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-y bg-white text-black"
          placeholder={`Enter ${title.toLowerCase()}`}
        />
      </div>
      <div className="w-48 flex flex-col gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => handleSuggestionClick(suggestion)}
            className="text-sm px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors text-left"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ReportInput;
