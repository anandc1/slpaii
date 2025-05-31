'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get('id');
  
  useEffect(() => {
    // This will close the tab after 5 seconds
    const timer = setTimeout(() => {
      window.close();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md text-center">
        <svg
          className="mx-auto h-12 w-12 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        
        <h1 className="mt-3 text-2xl font-bold">Assessment Uploaded Successfully!</h1>
        <p className="mt-2 text-gray-600">
          Your assessment has been processed and saved. You can now return to the SLP Assistant extension.
        </p>
        <p className="mt-4 text-sm text-gray-500">
          This window will close automatically in 5 seconds.
        </p>
      </div>
    </div>
  );
}
