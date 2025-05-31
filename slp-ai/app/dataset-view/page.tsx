'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

interface DatasetEntry {
  Ages: string;
  Section: string;
  Question: string;
  'Answers_Choices': string;
  'Materials:': string;
  'Score:': string;
  'Score 2:': string;
  Note: string;
  'Other Instructions': string;
  Instructions: string;
}

export default function DatasetView() {
  const [data, setData] = useState<DatasetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const response = await fetch('/api/dataset');
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error fetching dataset:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-8 text-center">SLP AI Dataset</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ages</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Section</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Question</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Answers</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Materials</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Score 2</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Note</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Other Instructions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Instructions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((entry, index) => (
              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{entry.Ages}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{entry.Section}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{entry.Question}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{entry.Answers_Choices}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{entry['Materials:']}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{entry['Score:']}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{entry['Score 2:']}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{entry.Note}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{entry['Other Instructions']}</td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{entry.Instructions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 