"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { validateToken, markTokenAsUsed } from "@/app/lib/tokenModel";
import { getTemplates, AssessmentTemplate } from "@/app/lib/templateModel";
import { createAssessment } from "@/app/lib/assessmentModel";
import { uploadAssessmentImage } from "@/app/lib/storageService";
import { useAuth } from "@/app/lib/auth";
import { getDatabase, ref, get, set, onValue } from "firebase/database";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyAO0jbpjUvIFJJGnvZHTIBOBSLbTqACuIA",
  authDomain: "slp-ai-27f1f.firebaseapp.com",
  projectId: "slp-ai-27f1f",
  storageBucket: "slp-ai-27f1f.firebasestorage.app",
  messagingSenderId: "828268211437",
  appId: "1:828268211437:web:d4cb3375bbb38d08f1f0e4",
  databaseURL: "https://slp-ai-27f1f-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

type ClientPageProps = {
  tokenId: string;
};

export default function AssessmentUploadPage({ tokenId }: ClientPageProps) {
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingTimeout, setProcessingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [tokenData, setTokenData] = useState<any>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [expired, setExpired] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scores, setScores] = useState({
    auditoryComprehension: "",
    expressiveCommunication: "",
    totalLanguage: "",
    percentileRank: ""
  });

  // Validate token on page load
  useEffect(() => {
    async function checkToken() {
      try {
        const { valid, token, error } = await validateToken(tokenId);

        if (!valid) {
          setError(error || "Invalid token");
          setLoading(false);
          return;
        }

        setTokenData(token);

        // Check if authentication is required
        if (token?.requiresAuth) {
          setRequiresAuth(true);
        }

        // Load templates
        const assessmentTemplates = await getTemplates();
        setTemplates(assessmentTemplates);

        // Set default selected template if specified in token
        if (token?.assessmentType) {
          const template = assessmentTemplates.find(
            (t) => t.name === token.assessmentType
          );
          if (template) {
            setSelectedTemplate(template.id);
          }
        }

        setLoading(false);
      } catch (err) {
        setError("Error validating token");
        setLoading(false);
      }
    }

    checkToken();
  }, [tokenId]);

  useEffect(() => {
    async function validateToken() {
      const tokenRef = ref(db, `/tokens/${tokenId}`);
      const snap = await get(tokenRef);
      if (!snap.exists()) {
        setExpired(true);
        setLoading(false);
        return;
      }
      const token = snap.val();
      if (token.used || Date.now() > token.expires) {
        setExpired(true);
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    validateToken();
  }, [tokenId]);

  // Handle template selection
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTemplate(e.target.value);
  };

  // Handle file selection (image or PDF)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);

      // Create preview
      if (file.type.startsWith('image/')) {
        // For images, create a preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        // For PDFs, use our PDF icon
        setImagePreview('/pdf-icon.svg');
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!image) {
      setError("Please upload an image or PDF");
      return;
    }

    if (requiresAuth && !user) {
      setError("Authentication required. Please sign in to continue.");
      return;
    }

    setProcessing(true);
    setError(null);
    
    // Check if we should use the fallback mode (bypass Firebase)
    // You can set this to true to always use the fallback
    const useFallbackMode = true;

    try {
      console.log("Starting assessment submission process...");
      const userId = user?.uid || tokenData?.userId || "anonymous";
      console.log("User ID:", userId);
      let imageUrl;
      let assessmentId;
      
      if (useFallbackMode) {
        console.log("Using fallback mode - bypassing Firebase Storage");
        // Use a hardcoded URL for PLS-5 assessment
        if (image && image.type === 'application/pdf') {
          imageUrl = '/pdf-icon.svg'; // Use our local PDF icon
        } else {
          // Use a PLS-5 sample image
          imageUrl = 'https://www.pearsonassessments.com/content/dam/school/global/clinical/us/assets/pls5/pls-5-sample.jpg';
        }
        console.log("Using fallback image URL:", imageUrl);
        
        // Generate a fake assessment ID
        assessmentId = `mock-${Math.random().toString(36).substring(2, 15)}`;
        console.log("Generated mock assessment ID:", assessmentId);
        
        // Store the assessment data in localStorage for the mock mode
        const mockAssessment = {
          id: assessmentId,
          userId: userId,
          templateId: selectedTemplate || "auto-detect",
          formType: selectedTemplate ? 
            templates.find((t) => t.id === selectedTemplate)?.name || 'unknown' : 
            'auto-detect',
          imageUrl: imageUrl,
          tokenId: tokenId,
          dateCreated: new Date().toISOString()
        };
        
        // Save to localStorage
        try {
          const existingAssessments = JSON.parse(localStorage.getItem('mockAssessments') || '[]');
          existingAssessments.push(mockAssessment);
          localStorage.setItem('mockAssessments', JSON.stringify(existingAssessments));
          console.log("Saved mock assessment to localStorage");
        } catch (localStorageErr) {
          console.error("Error saving to localStorage:", localStorageErr);
        }
        
        // Redirect to a special mock results page
        console.log("Redirecting to mock results page");
        router.push(`/assessment/results/${assessmentId}?mock=true`);
        return;
      }
      
      // Regular Firebase flow - only runs if useFallbackMode is false
      if (image) {
        console.log("Uploading image/PDF file:", image.name, image.type, image.size);
        try {
          // Generate a temporary ID for the file path
          const tempId = Math.random().toString(36).substring(2, 15);
          console.log("Generated temp ID for upload:", tempId);
          
          // Try to upload the image - our updated storage service will handle fallbacks
          // If Firebase storage fails, it will return a mock URL
          imageUrl = await uploadAssessmentImage(image, userId, tempId);
          console.log("File uploaded or mock URL generated:", imageUrl);
        } catch (uploadErr) {
          console.error("Error uploading file (even fallback failed):", uploadErr);
          // Set a fallback URL for PLS-5 assessment
          imageUrl = 'https://www.pearsonassessments.com/content/dam/school/global/clinical/us/assets/pls5/pls-5-sample.jpg';
          console.log("Using hardcoded fallback URL:", imageUrl);
        }
      } else {
        console.log("No image/PDF file to upload");
      }
      
      // Only run this if we're not in fallback mode
      // Create assessment with the image URL if available
      console.log("Creating assessment with template:", selectedTemplate || "auto-detect");
      const assessmentData = {
        userId: userId,
        templateId: selectedTemplate || "auto-detect", // Use auto-detect if no template selected
        data: {
          formType: selectedTemplate ? 
            templates.find((t) => t.id === selectedTemplate)?.name || 'unknown' : 
            'auto-detect',
          tokenId: tokenId, // Store the tokenId in the data object
        },
        imageUrl: imageUrl, // This will be undefined if upload failed or no image
      };
      console.log("Assessment data being submitted:", assessmentData);
      
      try {
        const result = await createAssessment(assessmentData);
        
        console.log("Assessment creation result:", result);
        if (!result.success) {
          console.error("Assessment creation failed:", result.error);
          throw new Error(result.error || "Error creating assessment");
        }
        
        // Mark token as used
        console.log("Marking token as used:", tokenId);
        try {
          await markTokenAsUsed(tokenId);
        } catch (tokenErr) {
          console.error("Error marking token as used (continuing anyway):", tokenErr);
          // Continue even if this fails - the assessment was created successfully
        }
        
        // Redirect to results page
        console.log("Redirecting to results page:", `/assessment/results/${result.assessmentId}`);
        router.push(`/assessment/results/${result.assessmentId}`);
      } catch (firestoreErr) {
        console.error("Firestore error, falling back to mock mode:", firestoreErr);
        
        // Generate a fake assessment ID for fallback
        const fallbackId = `fallback-${Math.random().toString(36).substring(2, 15)}`;
        
        // Store the assessment data in localStorage as fallback
        const fallbackAssessment = {
          id: fallbackId,
          userId: userId,
          templateId: selectedTemplate || "auto-detect",
          formType: assessmentData.data.formType,
          imageUrl: imageUrl,
          tokenId: tokenId,
          dateCreated: new Date().toISOString()
        };
        
        // Save to localStorage
        try {
          const existingAssessments = JSON.parse(localStorage.getItem('mockAssessments') || '[]');
          existingAssessments.push(fallbackAssessment);
          localStorage.setItem('mockAssessments', JSON.stringify(existingAssessments));
          console.log("Saved fallback assessment to localStorage");
        } catch (localStorageErr) {
          console.error("Error saving to localStorage:", localStorageErr);
        }
        
        // Redirect to the fallback results page
        console.log("Redirecting to fallback results page");
        router.push(`/assessment/results/${fallbackId}?mock=true`);
      }
    } catch (err) {
      console.error("Error submitting assessment:", err);
      
      // Show a more detailed error message
      const errorMessage = err instanceof Error ? 
        `Error: ${err.message}` : 
        "Error processing assessment. Please try again.";
      
      setError(errorMessage);
      setProcessing(false);
    }
  };

  // No cleanup needed anymore since we removed the timeout

  // Handle sign in
  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Error signing in:", err);
      setError("Error signing in. Please try again.");
    }
  };

  const handleChange = (e) => {
    setScores({ ...scores, [e.target.name]: e.target.value });
  };

  const handleSubmitScores = async (e) => {
    e.preventDefault();
    // Validate scores
    for (const key of Object.keys(scores)) {
      const val = parseInt(scores[key], 10);
      if (isNaN(val) || val < 50 || val > 150) {
        setError("All scores must be between 50 and 150.");
        return;
      }
    }
    setError("");
    // Save to Firebase
    const assessRef = ref(db, `/assessments/${tokenId}`);
    await set(assessRef, { ...scores, completed: true });
    // Mark token as used
    await set(ref(db, `/tokens/${tokenId}/used`), true);
    setSubmitted(true);
    setTimeout(() => window.close(), 2000);
  };

  if (loading || authLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (requiresAuth && !user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="mb-4">
            Please sign in to continue with the assessment upload.
          </p>
          <button
            onClick={handleSignIn}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-4">Token Expired or Invalid</h1>
          <p className="mb-4">
            The token you are trying to use is expired or invalid. Please try again later.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-4">Scores Submitted!</h1>
          <p className="mb-4">
            Your scores have been successfully submitted. You may close this page.
          </p>
          <button
            onClick={() => window.close()}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Close Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4">Upload Assessment</h1>
        <p className="mb-6">
          Please upload an image or PDF of your assessment. Selecting a template is optional - 
          if you don't select one, we'll try to auto-detect the assessment type.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Template Selection */}
          <div className="mb-4">
            <label
              htmlFor="template"
              className="block text-gray-700 font-bold mb-2"
            >
              Assessment Template
            </label>
            <select
              id="template"
              value={selectedTemplate}
              onChange={handleTemplateChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* Image Upload */}
          <div className="mb-6">
            <label
              htmlFor="image"
              className="block text-gray-700 font-bold mb-2"
            >
              Assessment Document (Image or PDF)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
              <input
                type="file"
                id="image"
                accept="image/*,.pdf"
                onChange={handleImageChange}
                className="hidden"
              />
              <label
                htmlFor="image"
                className="cursor-pointer block w-full h-full"
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Assessment Preview"
                    className="mx-auto max-h-64 object-contain"
                  />
                ) : (
                  <div className="py-8">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      ></path>
                    </svg>
                    <p className="mt-2 text-sm text-gray-600">
                      Click to upload or drag and drop
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      PNG, JPG, GIF, PDF up to 10MB
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Submit Button and Processing Indicator */}
          {processing ? (
            <div className="mt-4">
              <div className="flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                <span className="text-gray-700">Processing your assessment...</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (processingTimeout) {
                    clearTimeout(processingTimeout);
                  }
                  setProcessing(false);
                  setError("Processing cancelled. You can try again.");
                }}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Cancel
              </button>
              <p className="text-sm text-gray-500 mt-2">
                This may take a few moments. If it's taking too long, you can cancel and try again.
              </p>
            </div>
          ) : (
            <button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Upload Assessment
            </button>
          )}
        </form>

        <form onSubmit={handleSubmitScores} style={{ maxWidth: 400, margin: "auto", padding: 16 }}>
          <h2>PLS-5 Score Entry</h2>
          <label>Auditory Comprehension
            <input name="auditoryComprehension" value={scores.auditoryComprehension} onChange={handleChange} required min={50} max={150} type="number" />
          </label>
          <label>Expressive Communication
            <input name="expressiveCommunication" value={scores.expressiveCommunication} onChange={handleChange} required min={50} max={150} type="number" />
          </label>
          <label>Total Language
            <input name="totalLanguage" value={scores.totalLanguage} onChange={handleChange} required min={50} max={150} type="number" />
          </label>
          <label>Percentile Rank
            <input name="percentileRank" value={scores.percentileRank} onChange={handleChange} required min={1} max={99} type="number" />
          </label>
          {error && <div style={{ color: "red" }}>{error}</div>}
          <button type="submit">Submit Scores</button>
        </form>
      </div>
    </div>
  );
}
