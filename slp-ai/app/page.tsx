"use client";

import { useAuth } from "./contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Handle initial mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle authentication check - if already logged in, go to dashboard
  useEffect(() => {
    if (mounted && user) {
      router.replace("/dashboard");
    }
  }, [mounted, user, router]);

  // Show nothing during initial render
  if (!mounted) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='animate-pulse text-lg text-gray-600'>Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Background Image with Text */}
      <div className="hidden md:flex md:w-1/2 bg-[#1a1a1a] relative">
        <Image
          src="/login-image.JPG"
          alt="Speech language therapist working with a child"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/60 z-10"></div>
        <div className="relative w-full h-full">
          <div className="absolute top-8 left-8 text-white text-2xl font-bold z-20">
            SLP-AI
          </div>
          <div className="absolute bottom-16 left-8 right-8 text-white z-20">
            <h1 className="text-5xl font-bold mb-6">
              Everything you need,<br />
              to make anything you want.
            </h1>
            <p className="text-lg opacity-90">
              Dozens of creative tools to ideate, generate and edit<br />
              content like never before
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Login / Sign up options */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-6">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">Create an account</h2>
            <p className="text-gray-600">
              Already have an account? <Link href="/login" className="text-blue-600 hover:text-blue-800">Log in</Link>
            </p>
          </div>
            
          <div className="mt-10 space-y-4">
            <Link href="/signup">
              <button className="w-full py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-black text-white hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Sign up with Email
              </button>
            </Link>
              
            <div className="flex items-center my-4">
              <div className="flex-grow h-px bg-gray-300"></div>
              <p className="mx-4 text-sm text-gray-500">OR</p>
              <div className="flex-grow h-px bg-gray-300"></div>
            </div>
              
            <button className="w-full py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center">
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032 s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2 C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                  fill="currentColor"
                />
              </svg>
              Continue with Google
            </button>
              
            <button className="w-full py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center">
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path
                  d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
                  fill="currentColor"
                />
              </svg>
              Continue with Apple
            </button>
              
            <button className="w-full py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Use Single Sign-On (SSO)
            </button>
          </div>
            
          <div className="mt-6 text-center text-xs text-gray-500">
            By clicking "Sign up" you agree to our Terms of Use and acknowledge our Privacy Policy
          </div>
        </div>
      </div>
    </div>
  );
}
