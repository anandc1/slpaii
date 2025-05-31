'use client';

import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const scoringTypes = [
  { id: 'pls5', name: 'PLS-5' },
  { id: 'reel4', name: 'REEL-4' },
  { id: 'clef4', name: 'CLEF-4' },
  { id: 'gfta', name: 'GFTA' }
];

export default function ScoringPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('pls5');

  // Handle initial mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle authentication check
  useEffect(() => {
    if (mounted && !user) {
      router.replace('/login');
    }
  }, [mounted, user, router]);

  // Show nothing during initial render
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show nothing if not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Scoring Tools</h1>
            <Link href="/" className="text-purple-600 hover:text-purple-800 font-medium">
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white shadow-sm rounded-xl overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {scoringTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setActiveTab(type.id)}
                  className={`py-4 px-6 font-medium text-sm border-b-2 ${
                    activeTab === type.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {type.name}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Content Container */}
          <div className="p-6">
            {activeTab === 'pls5' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">PLS-5 Scoring</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <p className="text-gray-600">PLS-5 scoring calculator will be implemented here.</p>
                </div>
              </div>
            )}
            
            {activeTab === 'reel4' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">REEL-4 Scoring</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <p className="text-gray-600">REEL-4 scoring calculator will be implemented here.</p>
                </div>
              </div>
            )}
            
            {activeTab === 'clef4' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">CLEF-4 Scoring</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <p className="text-gray-600">CLEF-4 scoring calculator will be implemented here.</p>
                </div>
              </div>
            )}
            
            {activeTab === 'gfta' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">GFTA Scoring</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <p className="text-gray-600">GFTA scoring calculator will be implemented here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
