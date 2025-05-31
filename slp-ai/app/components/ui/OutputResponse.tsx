import React from 'react';
import { ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';

interface OutputResponseProps {
  content: string;
  isLoading: boolean;
  title: string;
}

const OutputResponse: React.FC<OutputResponseProps> = ({ content, isLoading, title }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <h3 className="font-semibold text-lg">{title}</h3>
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title="Copy to clipboard"
      >
        {copied ? (
          <CheckIcon className="h-5 w-5 text-green-500" />
        ) : (
          <ClipboardIcon className="h-5 w-5 text-gray-500" />
        )}
      </button>
      <pre className="whitespace-pre-wrap text-black dark:text-white font-sans">
        {content.replace(/\[NAME\]/g, '[NAME]')}
      </pre>
    </div>
  );
};

export default OutputResponse; 