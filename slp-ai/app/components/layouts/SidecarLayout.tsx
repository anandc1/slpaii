'use client';

import { useState } from 'react';
import Sidecar from '../ui/Sidecar';

interface SidecarLayoutProps {
  children: React.ReactNode;
}

const SidecarLayout: React.FC<SidecarLayoutProps> = ({ children }) => {
  const [isSidecarOpen, setIsSidecarOpen] = useState(false);
  const [pageContent, setPageContent] = useState<string>('');

  const handleInspectPage = () => {
    // Get the current page content
    const content = document.documentElement.outerHTML;
    setPageContent(content);
    setIsSidecarOpen(true);
  };

  return (
    <div className="relative">
      {/* Main content */}
      <div className={`transition-all duration-300 ${isSidecarOpen ? 'mr-[400px]' : ''}`}>
        {children}
      </div>

      {/* Floating button */}
      <button
        onClick={handleInspectPage}
        className="fixed bottom-4 right-4 p-3 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 z-50"
        title="Open AI Assistant"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Sidecar */}
      <Sidecar isOpen={isSidecarOpen} onClose={() => setIsSidecarOpen(false)}>
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Page HTML</h3>
            <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
              {pageContent}
            </pre>
          </div>
          {/* Add more AI assistant features here */}
        </div>
      </Sidecar>
    </div>
  );
};

export default SidecarLayout; 