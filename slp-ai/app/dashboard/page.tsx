"use client";

import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

export default function Dashboard() {
  const { user, userData, logout } = useAuth();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle initial mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle authentication check
  useEffect(() => {
    if (mounted && !user) {
      router.replace("/login");
    }
  }, [mounted, user, router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (mounted) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [mounted]);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setIsDropdownOpen(false);
      await logout();
      router.replace("/login");
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  // Show nothing during initial render
  if (!mounted) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='animate-pulse text-lg text-gray-600'>Loading...</div>
      </div>
    );
  }

  // Show nothing if not authenticated
  if (!user) {
    return null;
  }

  const displayName = user.displayName || '';
  const [firstName, lastName] = displayName.split(" ") || ["", ""];

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header with Profile */}
      <header className='bg-white shadow-sm'>
        <div className='max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center'>
          <h1 className='text-2xl font-bold text-gray-900'>
            Welcome to SLP AI
          </h1>

          <div ref={dropdownRef} className='relative'>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className='flex items-center justify-center w-10 h-10 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors'
            >
              {firstName[0]}
              {lastName[0]}
            </button>

            {isDropdownOpen && (
              <div className='absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10'>
                <div className='p-3 border-b border-gray-100'>
                  <div className='font-medium text-gray-900'>
                    {user.displayName}
                  </div>
                  <div className='text-sm text-gray-500'>{user.email}</div>
                </div>
                <div className='py-1'>
                  <button
                    onClick={handleLogout}
                    className='w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {/* New Assessment Card */}
          <Link
            href='/new-report'
            className='group relative bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200 flex flex-col'
          >
            <div className='flex items-center mb-4'>
              <div className='p-3 rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors'>
                <svg
                  className='w-6 h-6 text-purple-600'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 4v16m8-8H4'
                  />
                </svg>
              </div>
              <h2 className='ml-4 text-xl font-semibold text-gray-900'>
                New Assessment
              </h2>
            </div>
            <p className='text-gray-600'>
              Start a new PLS-5 assessment for a patient
            </p>
          </Link>

          {/* View Reports Card */}
          <Link
            href='/past-reports'
            className='group relative bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200 flex flex-col'
          >
            <div className='flex items-center mb-4'>
              <div className='p-3 rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors'>
                <svg
                  className='w-6 h-6 text-blue-600'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                  />
                </svg>
              </div>
              <h2 className='ml-4 text-xl font-semibold text-gray-900'>
                View Reports
              </h2>
            </div>
            <p className='text-gray-600'>
              Access and review previous assessment reports
            </p>
          </Link>

          {/* AI Report Generation Card */}
          <Link
            href='/auto-fill-report'
            className='group relative bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200 flex flex-col'
          >
            <div className='flex items-center mb-4'>
              <div className='p-3 rounded-lg bg-green-100 group-hover:bg-green-200 transition-colors'>
                <svg
                  className='w-6 h-6 text-green-600'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M13 10V3L4 14h7v7l9-11h-7z'
                  />
                </svg>
              </div>
              <h2 className='ml-4 text-xl font-semibold text-gray-900'>
                AI Report Generation
              </h2>
            </div>
            <p className='text-gray-600'>
              Generate comprehensive reports using AI assistance
            </p>
          </Link>

          {/* Scoring Tools Card */}
          <Link
            href='/scoring'
            className='group relative bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200 flex flex-col'
          >
            <div className='flex items-center mb-4'>
              <div className='p-3 rounded-lg bg-indigo-100 group-hover:bg-indigo-200 transition-colors'>
                <svg
                  className='w-6 h-6 text-indigo-600'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'
                  />
                </svg>
              </div>
              <h2 className='ml-4 text-xl font-semibold text-gray-900'>
                Scoring Tools
              </h2>
            </div>
            <p className='text-gray-600'>
              Access scoring calculators for PLS-5, REEL-4, CLEF-4, and GFTA
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
} 