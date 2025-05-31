'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';
import ReportInput from '../components/ui/ReportInput';
import OutputResponse from '../components/ui/OutputResponse';
import PLS5Visualization from '../components/ui/PLS5Visualization';
import { generateReport } from '../lib/openai';
import { buildPrompt } from '../lib/promptBuilder';
import { 
  AssessmentType, 
  BaseAssessmentData, 
  identifyAssessmentType, 
  normalizeAssessmentData, 
  processAndSaveAssessment 
} from '../lib/assessmentModel';
import { collection, query, where, getDocs, addDoc, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface GeneratedContent {
  section: string;
  content: string;
}

// Document detection states
type DocumentStatus = 'none' | 'detecting' | 'detected' | 'not_detected' | 'text_extracted' | 'pls5_detected';

// Interface for assessment data (using the standardized interface from assessmentModel)
// We'll keep this for backward compatibility but use BaseAssessmentData throughout
interface PLS5Data extends BaseAssessmentData {}

// Add CSS for tab transitions and text visibility at the top of the file after imports
const customStyles = `
  .tab-content {
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  
  .tab-content.active {
    opacity: 1;
    transform: translateY(0);
  }

  /* Ensure text is visible with good contrast */
  .assessment-results-container {
    color: #000000; /* Force black text */
  }
  
  .assessment-results-container p, 
  .assessment-results-container span, 
  .assessment-results-container h2, 
  .assessment-results-container h3, 
  .assessment-results-container table,
  .assessment-results-container th,
  .assessment-results-container td {
    color: #000000 !important; /* Ensure all text elements are black */
  }
  
  .assessment-results-container .text-blue-700,
  .assessment-results-container .text-blue-800 {
    color: #1d4ed8 !important; /* Dark blue for headers - ensures visibility */
  }
  
  .assessment-results-container .text-gray-500 {
    color: #6b7280 !important; /* Dark enough gray for labels */
  }
  
  .assessment-results-container input {
    color: #000000 !important; /* Ensure input text is black */
    background-color: #ffffff !important; /* Ensure input background is white */
  }
`;

// Helper function to find a score by searching through multiple possible keys
function findScore(scoreObj: Record<string, any> = {}, ...possibleKeys: string[]): string | number | undefined {
  // Guard against undefined or null
  if (!scoreObj) return undefined;
  
  // If scoreObj is directly a string or number, return it
  if (typeof scoreObj === 'string' || typeof scoreObj === 'number') {
    return scoreObj;
  }
  
  // Log the keys we're searching for
  console.log('Finding score:', { possibleKeys, availableKeys: Object.keys(scoreObj) });
  
  // First try direct key matches
  for (const key of possibleKeys) {
    // Try exact match
    if (scoreObj[key] !== undefined) {
      console.log(`Found exact match for ${key}:`, scoreObj[key]);
      return scoreObj[key];
    }
  }
  
  // Then try partial matches (case insensitive)
  for (const key of possibleKeys) {
    try {
      // Find a key that contains the search term (case insensitive)
      const matchingKey = Object.keys(scoreObj).find(k => 
        k.toLowerCase().includes(key.toLowerCase())
      );
      
      if (matchingKey) {
        console.log(`Found partial match for ${key} via ${matchingKey}:`, scoreObj[matchingKey]);
        return scoreObj[matchingKey];
      }
    } catch (e) {
      console.error(`Error searching for key ${key} in`, scoreObj, e);
    }
  }
  
  // Finally try to find any matching keys based on patterns
  try {
    // For AC
    if (possibleKeys.some(k => k.toLowerCase().includes('ac') || k.toLowerCase().includes('auditory'))) {
      const acKey = Object.keys(scoreObj).find(k => 
        k.toLowerCase().includes('ac') || k.toLowerCase().includes('auditory')
      );
      if (acKey) {
        console.log(`Found AC-related key ${acKey}:`, scoreObj[acKey]);
        return scoreObj[acKey];
      }
    }
    
    // For EC
    if (possibleKeys.some(k => k.toLowerCase().includes('ec') || k.toLowerCase().includes('expressive'))) {
      const ecKey = Object.keys(scoreObj).find(k => 
        k.toLowerCase().includes('ec') || k.toLowerCase().includes('expressive')
      );
      if (ecKey) {
        console.log(`Found EC-related key ${ecKey}:`, scoreObj[ecKey]);
        return scoreObj[ecKey];
      }
    }
    
    // For Total
    if (possibleKeys.some(k => k.toLowerCase().includes('total'))) {
      const totalKey = Object.keys(scoreObj).find(k => 
        k.toLowerCase().includes('total') || k.toLowerCase().includes('composite')
      );
      if (totalKey) {
        console.log(`Found Total-related key ${totalKey}:`, scoreObj[totalKey]);
        return scoreObj[totalKey];
      }
    }
    
    // For raw scores
    if (possibleKeys.some(k => k.toLowerCase().includes('raw'))) {
      const rawKey = Object.keys(scoreObj).find(k => 
        k.toLowerCase().includes('raw')
      );
      if (rawKey) {
        console.log(`Found Raw Score key ${rawKey}:`, scoreObj[rawKey]);
        return scoreObj[rawKey];
      }
    }
    
    // For standard scores
    if (possibleKeys.some(k => k.toLowerCase().includes('standard'))) {
      const standardKey = Object.keys(scoreObj).find(k => 
        k.toLowerCase().includes('standard') || k.toLowerCase().includes('ss')
      );
      if (standardKey) {
        console.log(`Found Standard Score key ${standardKey}:`, scoreObj[standardKey]);
        return scoreObj[standardKey];
      }
    }
    
    // For percentiles
    if (possibleKeys.some(k => k.toLowerCase().includes('percentile'))) {
      const percentileKey = Object.keys(scoreObj).find(k => 
        k.toLowerCase().includes('percentile') || k.toLowerCase().includes('pr') || k.toLowerCase().includes('rank')
      );
      if (percentileKey) {
        console.log(`Found Percentile key ${percentileKey}:`, scoreObj[percentileKey]);
        return scoreObj[percentileKey];
      }
    }
    
    // For confidence intervals
    if (possibleKeys.some(k => k.toLowerCase().includes('confidence') || k.toLowerCase().includes('interval'))) {
      const confidenceKey = Object.keys(scoreObj).find(k => 
        k.toLowerCase().includes('confidence') || k.toLowerCase().includes('interval') || k.toLowerCase().includes('ci')
      );
      if (confidenceKey) {
        console.log(`Found Confidence Interval key ${confidenceKey}:`, scoreObj[confidenceKey]);
        return scoreObj[confidenceKey];
      }
    }
  } catch (e) {
    console.error('Error in extended search:', e);
  }
  
  console.log('No match found for', possibleKeys);
  return undefined;
}

export default function AutoFillReport() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('camera');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([]);
  const [reportData, setReportData] = useState({
    summary: '',
    strengths: '',
    areasOfEmergence: '',
    weaknesses: '',
    hearing: '',
  });
  
  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  
  // Document detection state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus>('none');
  const [extractedText, setExtractedText] = useState<string>('');
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  // PLS-5 specific state
  const [pls5Data, setPls5Data] = useState<PLS5Data | null>(null);
  const [editedPls5Data, setEditedPls5Data] = useState<PLS5Data | null>(null);
  
  // State to track which fields are in edit mode
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  
  // Camera tab state
  const [cameraTab, setCameraTab] = useState(true);
  
  // Add state for the patient confirmation modal
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [patientMatches, setPatientMatches] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  
  // Add a debug state - default to true temporarily while debugging
  const [debugMode, setDebugMode] = useState(true);
  
  // Add state for composite query support detection
  const [compositeQuerySupported, setCompositeQuerySupported] = useState<boolean | null>(null);
  
  // Create a function to generate mock PLS-5 data
  const generateMockPLS5Data = (variant: number = 1): BaseAssessmentData => {
    // Default data (Harry S.)
    if (variant === 1) {
      return {
        formType: "PLS-5",
        patientInfo: {
          name: "Harry S.",
          firstName: "Harry",
          lastName: "S.",
          sex: "M",
          grade: "Pre-K"
        },
        testDate: "2024-07-07",
        birthDate: "2020-07-07",
        chronologicalAge: {
          years: 4,
          months: 0
        },
        scores: {
          rawScores: {
            "AC Raw Score": 36,
            "EC Raw Score": 27
          },
          standardScores: {
            "AC Standard Score": 75,
            "EC Standard Score": 62
          },
          percentiles: {
            "AC Percentile": 5,
            "EC Percentile": 1
          },
          confidenceIntervals: {
            "AC Confidence": "71-85",
            "EC Confidence": "59-70" 
          },
          compositeScores: {
            "Standard Score Total": 137
          }
        },
        otherFields: {
          notes: "Child was cooperative during assessment."
        }
      };
    } 
    // Alternate data (Sarah Johnson)
    else {
      return {
        formType: "PLS-5",
        patientInfo: {
          name: "Sarah Johnson",
          firstName: "Sarah",
          lastName: "Johnson",
          sex: "F",
          grade: "Kindergarten"
        },
        testDate: "2024-06-15",
        birthDate: "2019-03-10",
        chronologicalAge: {
          years: 5,
          months: 3
        },
        scores: {
          rawScores: {
            "AC Raw Score": 42,
            "EC Raw Score": 39
          },
          standardScores: {
            "AC Standard Score": 84,
            "EC Standard Score": 78
          },
          percentiles: {
            "AC Percentile": 14,
            "EC Percentile": 7
          },
          confidenceIntervals: {
            "AC Confidence": "80-88",
            "EC Confidence": "74-82" 
          },
          compositeScores: {
            "Standard Score Total": 162
          }
        },
        otherFields: {
          notes: "Child showed good attention throughout assessment."
        }
      };
    }
  };
  
  // Function to load mock data
  const loadMockData = (variant: number = 1) => {
    const mockData = generateMockPLS5Data(variant);
    console.log(`Loading mock PLS-5 data (variant ${variant}):`, mockData);
    
    // Set the document as detected and data as loaded
    setDocumentStatus('pls5_detected');
    setPls5Data(mockData);
    
    // Switch to results tab
    setActiveTab('results');
  };
  
  // Add function to test composite query support
  const testCompositeQuerySupport = async () => {
    try {
      console.log('DEBUG - Testing composite query support...');
      // Try a simple composite query
      const testQuery = query(
        collection(db, 'patients'),
        where('firstName', '==', 'TestUser'),
        where('lastName', '==', 'TestLastName'),
        limit(1)
      );
      
      await getDocs(testQuery);
      console.log('DEBUG - Composite queries are supported!');
      setCompositeQuerySupported(true);
      return true;
    } catch (error: any) {
      console.error('DEBUG - Composite query test failed:', error);
      
      // Check if this is the specific "missing index" error
      const errorMessage = error?.message || '';
      const isIndexError = errorMessage.includes('index') && errorMessage.includes('Firestore');
      
      if (isIndexError) {
        console.log('DEBUG - This appears to be an index error, composite queries may work with proper indexes');
        setCompositeQuerySupported(false);
      } else {
        console.log('DEBUG - This is likely a permissions error, not an index error');
        setCompositeQuerySupported(false);
      }
      
      return false;
    }
  };
  
  // Check for composite query support on component mount
  useEffect(() => {
    // Only run this check if the user is authenticated
    if (user?.uid) {
      testCompositeQuerySupport();
    }
  }, [user?.uid]);
  
  // Add function to check Firebase query capabilities
  const testFirebaseQuery = async () => {
    if (!user?.uid) {
      console.error('DEBUG - Not authenticated');
      return;
    }
    
    console.log('DEBUG - Starting Firebase query tests');
    console.log('DEBUG - Current user:', user.uid);
    
    try {
      // Test 1: Simple limit query
      console.log('DEBUG - Test 1: Simple limit query');
      try {
        const testQuery1 = query(
          collection(db, 'patients'),
          limit(1)
        );
        const snapshot1 = await getDocs(testQuery1);
        console.log('DEBUG - Test 1 success. Documents:', snapshot1.size);
        snapshot1.forEach(doc => {
          console.log('DEBUG - Test 1 document:', {
            id: doc.id,
            data: doc.data()
          });
        });
      } catch (error) {
        console.error('DEBUG - Test 1 failed:', error);
      }
      
      // Test 2: Query with a single where clause
      console.log('DEBUG - Test 2: Single where clause');
      try {
        const testQuery2 = query(
          collection(db, 'patients'),
          where('firstName', '==', 'Test'),
          limit(5)
        );
        const snapshot2 = await getDocs(testQuery2);
        console.log('DEBUG - Test 2 success. Documents:', snapshot2.size);
      } catch (error) {
        console.error('DEBUG - Test 2 failed:', error);
      }
      
      // Test 3: Composite query
      console.log('DEBUG - Test 3: Composite query');
      try {
        const testQuery3 = query(
          collection(db, 'patients'),
          where('firstName', '==', 'Test'),
          where('lastName', '==', 'Patient'),
          limit(5)
        );
        const snapshot3 = await getDocs(testQuery3);
        console.log('DEBUG - Test 3 success. Documents:', snapshot3.size);
      } catch (error) {
        console.error('DEBUG - Test 3 failed:', error);
      }
      
      // Test 4: Query to test user's provider status
      console.log('DEBUG - Test 4: Check provider role');
      try {
        const roleQuery = query(
          collection(db, 'roles'),
          where('isProvider', '==', true)
        );
        const roleSnapshot = await getDocs(roleQuery);
        console.log('DEBUG - Test 4 success. Provider roles found:', roleSnapshot.size);
      } catch (error) {
        console.error('DEBUG - Test 4 failed:', error);
      }
      
      console.log('DEBUG - All tests completed');
    } catch (error) {
      console.error('DEBUG - Testing failed with error:', error);
    }
  };
  
  // Handle initial mounting
  useEffect(() => {
    setMounted(true);
    // Check for camera capability
    if (navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices) {
      setHasCamera(true);
    }
    
    // Add keyboard listener for debug mode (Ctrl+Shift+D)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setDebugMode(prev => !prev);
        console.log('Debug mode toggled:', !debugMode);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [debugMode]);

  // Handle authentication check
  useEffect(() => {
    if (mounted && !user) {
      router.replace('/login');
    }
  }, [mounted, user, router]);
  
  // Handle camera initialization and cleanup
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      if (!videoRef.current || !hasCamera || !cameraActive) return;
      
      try {
        const constraints = {
          video: { facingMode: 'environment' }
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraPermission(true);
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setCameraPermission(false);
      }
    };
    
    if (cameraActive && activeTab === 'camera') {
      startCamera();
    }
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraActive, activeTab, hasCamera]);
  
  const handleStartCamera = async () => {
    setCameraActive(true);
    setDocumentStatus('none');
    setCapturedImage(null);
    setExtractedText('');
    setProcessingError(null);
    setActiveTab('camera');
    setCameraTab(true);
  };
  
  const handleCaptureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the video frame to the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to data URL - explicitly setting format to image/jpeg
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9); // 0.9 quality
    
    console.log('Captured image data URL format check:', 
      imageDataUrl.substring(0, 30) + '...',
      `Length: ${imageDataUrl.length}`
    );
    
    // Validate the data URL format before proceeding
    if (!imageDataUrl.startsWith('data:image/jpeg')) {
      console.error('Invalid image data URL format:', imageDataUrl.substring(0, 50));
      setProcessingError('Failed to capture image in the correct format. Please try again.');
      return;
    }
    
    setCapturedImage(imageDataUrl);
    
    // Stop the camera
    if (video.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
    
    // Start document detection
    detectDocument(imageDataUrl);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Reset states
    setCameraActive(false);
    setDocumentStatus('none');
    setExtractedText('');
    setProcessingError(null);
    
    // Check if the file is an image
    if (!file.type.startsWith('image/')) {
      setProcessingError('Please select an image file.');
      return;
    }
    
    // Read the file as a data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageDataUrl = e.target?.result as string;
      
      // Validate the data URL
      if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
        setProcessingError('Invalid image format. Please try another image.');
        return;
      }
      
      console.log('Uploaded image data URL format check:', 
        imageDataUrl.substring(0, 30) + '...',
        `Length: ${imageDataUrl.length}`
      );
      
      setCapturedImage(imageDataUrl);
      
      // Process the image
      detectDocument(imageDataUrl);
    };
    
    reader.onerror = () => {
      setProcessingError('Failed to read the image file. Please try again.');
    };
    
    reader.readAsDataURL(file);
    
    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };
  
  const handleFileSelectClick = () => {
    // Programmatically click the hidden file input
    fileInputRef.current?.click();
  };
  
  // Add a utility function to help debug data structures
  const logDataStructure = (label: string, data: any) => {
    console.log(`${label}:`, JSON.stringify(data, null, 2));
  };

  const detectDocument = async (imageDataUrl: string) => {
    setDocumentStatus('detecting');
    setIsLoading('Analyzing document...');
    
    try {
      console.log('Starting document detection...');
      
      // Call our OpenAI-based document detection API
      const response = await fetch('/api/detect-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          imageUrl: imageDataUrl
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', errorText);
        throw new Error(`Failed to detect document: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Document detection API response received');
      logDataStructure('Document detection result', responseData);
      
      // Use our assessment model to identify and process the form
      let assessmentType: AssessmentType | null = null;
      
      if (responseData.isDocument && responseData.documentType) {
        switch (responseData.documentType) {
          case 'PLS-5':
            assessmentType = AssessmentType.PLS5;
        setDocumentStatus('pls5_detected');
            break;
          case 'REEL-4':
            assessmentType = AssessmentType.REEL4;
            setDocumentStatus('detected');
            break; 
          case 'CELF-5':
            assessmentType = AssessmentType.CELF5;
            setDocumentStatus('detected');
            break;
          case 'GFTA-3':
            assessmentType = AssessmentType.GFTA3;
            setDocumentStatus('detected');
            break;
          default:
            // Try to identify from the text content
            if (responseData.text) {
              assessmentType = identifyAssessmentType(responseData.text);
            }
            if (assessmentType) {
              setDocumentStatus('detected');
            } else {
              setDocumentStatus('text_extracted');
            }
        }
      } else if (responseData.text) {
        // If document type wasn't identified, but we have text
        setDocumentStatus('text_extracted');
        setExtractedText(responseData.text);
      } else {
        setDocumentStatus('not_detected');
        setProcessingError('No document detected in the image. Please try again with a clearer image.');
        return;
      }
      
      // If we have a detected assessment, normalize the data
      if (assessmentType) {
        // Process and normalize the data using our assessment model
        const processedData = normalizeAssessmentData(responseData.data || {}, assessmentType);
        
        // Set the data for display
        setPls5Data(processedData);
        
        // Extract data for report
        if (processedData.patientInfo) {
          // Build a summary from the assessment data
          const childName = processedData.patientInfo.name || 'The client';
          const age = processedData.patientInfo.ageYears ? 
            `${processedData.patientInfo.ageYears}-${processedData.patientInfo.ageMonth || '0'}` : 
            '';
          const scores = processedData.scores || {};
          
          // Find AC and EC standard scores
          const acStandardScore = findScore(scores.standardScores, 'AC Standard Score', 'AC', 'Auditory') || 'N/A';
          const ecStandardScore = findScore(scores.standardScores, 'EC Standard Score', 'EC', 'Expressive') || 'N/A';
          const totalScore = findScore(scores.standardScores, 'Standard Score Total', 'Total Standard', 'Language') || 'N/A';
          
          // Find percentile ranks
          const acPercentile = findScore(scores.percentiles, 'AC Percentile', 'AC', 'Auditory') || 'N/A';
          const ecPercentile = findScore(scores.percentiles, 'EC Percentile', 'EC', 'Expressive') || 'N/A';
          
          // Create a summary based on the data
          const summary = `${childName} (${age}) was administered the Preschool Language Scale, Fifth Edition (PLS-5). 
          ${childName} obtained a standard score of ${acStandardScore} (${acPercentile}th percentile) on the Auditory Comprehension subtest 
          and a standard score of ${ecStandardScore} (${ecPercentile}th percentile) on the Expressive Communication subtest. 
          ${childName}'s Total Language standard score was ${totalScore}.`;
          
          // Update the report data with the extracted information
          setReportData(prev => ({
            ...prev,
            summary: summary.trim()
          }));
        }

        // If user is authenticated, potentially save this assessment to Firebase
        if (user && user.uid) {
          // Note: In a real implementation, you would ask for the patientUID here
          // For now, we're just logging that we would save the assessment:
          console.log('User authenticated, assessment could be saved to Firebase');
          
          // Example of how you would save the assessment:
          // const patientUID = "patient-id-would-be-selected-here";
          // const { documentId } = await processAndSaveAssessment(
          //   processedData,
          //   patientUID,
          //   user.uid
          // );
          // console.log('Assessment saved with ID:', documentId);
        }
        
        // Set the active tab to results after successful detection
          setActiveTab('results');
      } else if (responseData.text) {
        // If no assessment detected but we got text, show it for manual processing
        setExtractedText(responseData.text);
      } else {
        // No document or text detected
        setDocumentStatus('not_detected');
        setProcessingError('No document detected in the image. Please try again with a clearer image.');
      }
    } catch (error) {
      console.error('Error detecting document:', error);
      setDocumentStatus('not_detected');
      setProcessingError(error instanceof Error ? error.message : 'Failed to process the image. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };
  
  const handleUseExtractedText = (section: keyof typeof reportData) => {
    if (!extractedText) return;
    
    setReportData(prev => ({
      ...prev,
      [section]: extractedText
    }));
    
    setActiveTab('sections');
  };

  const handleGenerateReport = async (section: keyof typeof reportData) => {
    if (isLoading) return;
    
    setIsLoading(section);

    try {
      const inputText = reportData[section];
      
      if (!inputText.trim()) {
        throw new Error('Please enter some text before generating');
      }

      const prompt = buildPrompt('3-4', section);
      const generatedText = await generateReport(prompt, inputText);
      
      if (!generatedText) {
        throw new Error('No content was generated');
      }

      setGeneratedContents(prev => [...prev, {
        section: section,
        content: generatedText
      }]);
    } catch (error) {
      console.error('Error generating report:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to generate report. Please try again.';
      alert(errorMessage);
    } finally {
      setIsLoading(null);
    }
  };

  // After a PLS-5 form is processed, set the edited data to match the original data
  useEffect(() => {
    if (pls5Data && !editedPls5Data) {
      console.log('Setting edited PLS5 data from detected data:', pls5Data);
      setEditedPls5Data(JSON.parse(JSON.stringify(pls5Data)));
    }
  }, [pls5Data, editedPls5Data]);
  
  // Debug effect to log when document status or active tab changes
  useEffect(() => {
    console.log('Document status changed:', documentStatus, 'Active tab:', activeTab);
    
    // If we have PLS-5 data detected but we're not on the results tab, show a notification
    if (documentStatus === 'pls5_detected' && activeTab !== 'results') {
      console.log('PLS-5 data detected, results tab available');
    }
  }, [documentStatus, activeTab]);

  const handleScoreChange = (category: string, scoreType: string, key: string, value: string | number) => {
    if (!editedPls5Data) return;
    
    setEditedPls5Data(prev => {
      if (!prev) return prev;
      
      const newData = { ...prev };
      if (!newData.scores[category]) {
        newData.scores[category] = {};
      }
      
      newData.scores[category][key] = value;
      
      // If we're changing a standard score or percentile, update the summary
      if (category === 'standardScores' || category === 'percentiles') {
        const scores = newData.scores || {};
        const patientInfo = newData.patientInfo || {};
        const childName = patientInfo.name || 'The client';
        const age = patientInfo.ageYears ? 
          `${patientInfo.ageYears}-${patientInfo.ageMonth || '0'}` : 
          '';
        
        // Find AC and EC standard scores
        const acStandardScore = findScore(scores.standardScores, 'AC Standard Score', 'AC', 'Auditory') || 'N/A';
        const ecStandardScore = findScore(scores.standardScores, 'EC Standard Score', 'EC', 'Expressive') || 'N/A';
        const totalScore = findScore(scores.compositeScores, 'Standard Score Total', 'Total Standard', 'Language') || 'N/A';
        
        // Find percentile ranks
        const acPercentile = findScore(scores.percentiles, 'AC Percentile', 'AC', 'Auditory') || 'N/A';
        const ecPercentile = findScore(scores.percentiles, 'EC Percentile', 'EC', 'Expressive') || 'N/A';
        
        // Create a summary based on the data
        const summary = `${childName} (${age}) was administered the Preschool Language Scale, Fifth Edition (PLS-5). 
        ${childName} obtained a standard score of ${acStandardScore} (${acPercentile}th percentile) on the Auditory Comprehension subtest 
        and a standard score of ${ecStandardScore} (${ecPercentile}th percentile) on the Expressive Communication subtest. 
        ${childName}'s Total Language standard score was ${totalScore}.`;
        
        // Update the report data with the edited information
        setReportData(prev => ({
          ...prev,
          summary: summary.trim()
        }));
      }
      
      return newData;
    });
  };

  const handlePatientInfoChange = (field: string, value: string) => {
    if (!pls5Data) return;
    
    const updatedData = {
      ...pls5Data,
      patientInfo: {
        ...pls5Data.patientInfo,
        [field]: value
      }
    };
    
    setPls5Data(updatedData);
  };

  // Updated to handle provider info instead of examiner info
  const handleProviderInfoChange = (field: string, value: string) => {
    if (!pls5Data) return;
    
    // Since we're no longer storing examiner info, this might be used for other provider-related fields
    console.log(`Provider info change: ${field} = ${value}`);
    // Implement if needed later
  };

  // Updated to handle date fields directly at the top level
  const handleDateChange = (field: string, value: string) => {
    if (!pls5Data) return;
    
    if (field === 'chronologicalAge') {
      // Parse the string value into the chronologicalAge object
      const ageMatch = value.match(/(\d+)[-\s]*(\d+)/);
      if (ageMatch) {
        const updatedData = {
          ...pls5Data,
          chronologicalAge: {
            years: parseInt(ageMatch[1], 10),
            months: parseInt(ageMatch[2], 10)
          }
        };
        setPls5Data(updatedData);
      }
    } else {
      // Handle direct fields like testDate and birthDate
      const updatedData = {
        ...pls5Data,
        [field]: value
      };
      setPls5Data(updatedData);
    }
  };

  const toggleEditMode = (fieldId: string) => {
    setEditMode(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }));
  };
  
  // Function to export data as JSON
  const exportDataAsJson = () => {
    if (!pls5Data) return;
    
    // Clone to avoid modifying the original data
    const exportData = { ...pls5Data };
    
    // Generate a filename with the assessment type and date
    const exportName = `${exportData.formType?.toLowerCase() || 'assessment'}_${new Date().toISOString().slice(0, 10)}.json`;
    
    // Create a download link
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", exportName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Alternative approach to find patients that might work around security rule limitations
  const findPatientsByNameAlternative = async (firstName: string, lastName: string, birthDate: string) => {
    setIsSearchingPatient(true);
    try {
      console.log('DEBUG - Using alternative patient search approach');
      
      // Try a simpler query - just get a limited number of patients
      // and then filter client-side
      const simpleQuery = query(
        collection(db, 'patients'),
        limit(100) // Get a reasonable number of patients
      );
      
      const querySnapshot = await getDocs(simpleQuery);
      console.log('DEBUG - Alternative query returned documents:', querySnapshot.size);
      
      const matches: any[] = [];
      
      // Helper function to convert Timestamp to date string if needed
      const formatTimestampIfNeeded = (value: any): string => {
        // If it's a Firebase Timestamp
        if (value && typeof value === 'object' && 'seconds' in value) {
          const date = new Date(value.seconds * 1000);
          return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        }
        return value;
      };
      
      // Filter client-side
      querySnapshot.forEach(doc => {
        const patientData = doc.data();
        
        // Case-insensitive comparison
        const firstNameMatches = patientData.firstName?.toLowerCase() === firstName.toLowerCase();
        const lastNameMatches = patientData.lastName?.toLowerCase() === lastName.toLowerCase();
        
        // Format timestamp to string for comparison if needed
        const formattedBirthDate = formatTimestampIfNeeded(patientData.birthDate);
        
        console.log('DEBUG - Alternative search examining patient:', {
          id: doc.id,
          firstName: patientData.firstName, 
          lastName: patientData.lastName,
          birthDate: patientData.birthDate,
          formattedBirthDate
        });
        
        // If both name parts match, check birth date if provided
        if (firstNameMatches && lastNameMatches) {
          // For birthDate comparison, try both the original and formatted values
          const birthDateMatches = !birthDate || 
                                  patientData.birthDate === birthDate || 
                                  formattedBirthDate === birthDate;
                                  
          if (birthDateMatches) {
            // Add providerUID if missing (will be needed for saving)
            const patientWithDefaults = {
              id: doc.id,
              ...patientData,
              // Add providerUID if it doesn't exist
              providerUID: patientData.providerUID || [user?.uid]
            };
            
            matches.push(patientWithDefaults);
            console.log('DEBUG - Alternative search matched patient:', patientWithDefaults);
          }
        }
      });
      
      console.log('DEBUG - Alternative search found matches:', matches.length);
      
      // Set matches for modal
      setPatientMatches(matches);
      return matches;
    } catch (error) {
      console.error('DEBUG - Error in alternative patient search:', error);
      return [];
    } finally {
      setIsSearchingPatient(false);
    }
  };

  // Modify the saveToFirebase function to use the alternative search if the regular one fails
  const saveToFirebase = async () => {
    if (!pls5Data || !user?.uid) {
      console.error('Cannot save to Firebase: Missing data or user not authenticated');
      return;
    }
    
    setIsLoading('Preparing to save assessment...');
    
    try {
      // Extract and process patient name
      let firstName = '';
      let lastName = '';
      
      // Get patient name from the data
      const patientName = pls5Data.patientInfo?.name || '';
      
      // Split name if it's a single field (from handwritten form)
      if (patientName && !pls5Data.patientInfo.firstName && !pls5Data.patientInfo.lastName) {
        const nameParts = splitName(patientName);
        firstName = nameParts.firstName;
        lastName = nameParts.lastName;
        
        // Update the PLS5 data with split name
        const updatedData = {
          ...pls5Data,
          patientInfo: {
            ...pls5Data.patientInfo,
            firstName,
            lastName
          }
        };
        
        setPls5Data(updatedData);
      } else {
        // Use existing firstName and lastName fields if available
        firstName = pls5Data.patientInfo.firstName || '';
        lastName = pls5Data.patientInfo.lastName || '';
      }
      
      // Extract birth date from the data
      const birthDate = pls5Data.birthDate || '';
      
      // Look up patient by name and birth date
      try {
        console.log('DEBUG - Trying standard patient search first');
        const matches = await findPatientsByNameAndBirth(firstName, lastName, birthDate);
        
        // If no matches found or error occurred, try alternative approach
        if (matches.length === 0) {
          console.log('DEBUG - Standard search returned no results, trying alternative search');
          await findPatientsByNameAlternative(firstName, lastName, birthDate);
        }
      } catch (error) {
        console.error('DEBUG - Standard search failed, falling back to alternative:', error);
        await findPatientsByNameAlternative(firstName, lastName, birthDate);
      }
      
      // Automatically set the first match if available
      if (patientMatches.length === 1) {
        setSelectedPatient(patientMatches[0]);
      }
      
      // Show confirmation modal regardless of match count
      setShowPatientModal(true);
      setIsLoading(null);
    } catch (error) {
      console.error('Error preparing to save assessment:', error);
      setIsLoading(null);
      setProcessingError(error instanceof Error ? error.message : 'Failed to prepare assessment for saving');
    }
  };

  // Add function to split full name into first and last name
  const splitName = (fullName: string): { firstName: string, lastName: string } => {
    if (!fullName) return { firstName: '', lastName: '' };
    
    // Trim and normalize the name
    const cleanName = fullName.trim().replace(/\s+/g, ' ');
    
    // If there are no spaces, treat as just a first name
    if (!cleanName.includes(' ')) {
      return { firstName: cleanName, lastName: '' };
    }
    
    // Special handling for names with periods like "Harry S."
    const nameParts = cleanName.split(' ');
    
    // If there are only two parts and the last one is an initial with period
    if (nameParts.length === 2 && /^[A-Z]\.$/.test(nameParts[1])) {
      return { firstName: nameParts[0], lastName: nameParts[1] };
    }
    
    // Standard case: last part is last name, everything before is first name
    const lastName = nameParts.pop() || '';
    const firstName = nameParts.join(' ');
    
    return { firstName, lastName };
  };

  // Add function to find patients by name and birth date
  const findPatientsByNameAndBirth = async (firstName: string, lastName: string, birthDate: string) => {
    setIsSearchingPatient(true);
    try {
      console.log('DEBUG - Searching for patient with:', { firstName, lastName, birthDate });
      
      // First try a test query to check permissions
      console.log('DEBUG - Testing query permissions with limit(1)...');
      try {
        const testQuery = query(
          collection(db, 'patients'),
          limit(1)
        );
        const testSnapshot = await getDocs(testQuery);
        console.log('DEBUG - Test query successful, retrieved docs:', testSnapshot.size);
      } catch (error) {
        console.error('DEBUG - Test query failed:', error);
      }
      
      // Query patients collection by firstName and lastName
      console.log('DEBUG - Creating query for firstName and lastName...');
      
      const nameQuery = query(
        collection(db, 'patients'),
        where('firstName', '==', firstName),
        where('lastName', '==', lastName),
        limit(20) // Add limit to match security rules
      );
      
      console.log('DEBUG - Executing query...');
      
      // Get results
      const querySnapshot = await getDocs(nameQuery);
      
      console.log('DEBUG - Query returned documents:', querySnapshot.size);
      
      const matches: any[] = [];
      
      // Process birthDate to consistent format for comparison
      let inputBirthDate: Date | null = null;
      if (birthDate) {
        try {
          // Try to parse input birthDate to a Date object for comparison
          // Handle common formats
          const formats = [
            // MM/DD/YYYY
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            // YYYY-MM-DD
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
            // MM-DD-YYYY
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/
          ];
          
          for (const format of formats) {
            const match = birthDate.match(format);
            if (match) {
              if (format === formats[0] || format === formats[2]) {
                // MM/DD/YYYY or MM-DD-YYYY
                const month = parseInt(match[1], 10) - 1; // 0-based month
                const day = parseInt(match[2], 10);
                const year = parseInt(match[3], 10);
                inputBirthDate = new Date(year, month, day);
              } else if (format === formats[1]) {
                // YYYY-MM-DD
                const year = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1; // 0-based month
                const day = parseInt(match[3], 10);
                inputBirthDate = new Date(year, month, day);
              }
              break;
            }
          }
          
          // If we couldn't parse with regexes, try Date constructor
          if (!inputBirthDate) {
            inputBirthDate = new Date(birthDate);
            // Normalize to midnight (remove time component)
            inputBirthDate = new Date(inputBirthDate.getFullYear(), inputBirthDate.getMonth(), inputBirthDate.getDate());
            
            // Check if valid
            if (isNaN(inputBirthDate.getTime())) {
              inputBirthDate = null;
            }
          }
        } catch (e) {
          console.error('DEBUG - Error parsing birthDate:', e);
          inputBirthDate = null;
        }
      }
      
      console.log('DEBUG - Parsed input birthDate:', inputBirthDate);
      
      // Helper function to normalize dates for comparison
      const normalizeDateForComparison = (value: any): Date | null => {
        // If it's a Firebase Timestamp
        if (value && typeof value === 'object' && 'seconds' in value) {
          const date = new Date(value.seconds * 1000);
          // Remove time component
          return new Date(date.getFullYear(), date.getMonth(), date.getDate());
        } 
        // If it's a Date object
        else if (value instanceof Date) {
          // Remove time component
          return new Date(value.getFullYear(), value.getMonth(), value.getDate());
        }
        // If it's a string, try to parse
        else if (typeof value === 'string') {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              // Remove time component
              return new Date(date.getFullYear(), date.getMonth(), date.getDate());
            }
          } catch (e) {
            console.error('Error parsing date string:', e);
          }
        }
        return null;
      };
      
      // Helper function to format date for display
      const formatDateForDisplay = (value: any): string => {
        const date = normalizeDateForComparison(value);
        if (date) {
          return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        }
        return value?.toString() || '';
      };
      
      // Filter results by birth date if provided
      querySnapshot.forEach(doc => {
        const patientData = doc.data();
        
        // Normalize birthDate for comparison
        const patientBirthDate = normalizeDateForComparison(patientData.birthDate);
        const formattedBirthDate = formatDateForDisplay(patientData.birthDate);
        
        console.log('DEBUG - Retrieved patient:', {
          id: doc.id,
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          birthDate: patientData.birthDate,
          normalizedPatientBirthDate: patientBirthDate,
          formattedBirthDate,
          inputBirthDate,
          hasProviderUidField: !!patientData.providerUID,
          providerUidIsArray: Array.isArray(patientData.providerUID),
          currentUserInProviderUid: Array.isArray(patientData.providerUID) && patientData.providerUID.includes(user?.uid)
        });
        
        // Match by birthdate if one was provided
        let birthDateMatches = !birthDate; // If no birthDate provided, consider it a match
        
        if (birthDate && patientBirthDate && inputBirthDate) {
          // Compare dates by year, month, and day
          birthDateMatches = 
            patientBirthDate.getFullYear() === inputBirthDate.getFullYear() &&
            patientBirthDate.getMonth() === inputBirthDate.getMonth() &&
            patientBirthDate.getDate() === inputBirthDate.getDate();
        } else if (birthDate) {
          // Fallback to string comparison
          birthDateMatches = formattedBirthDate === birthDate;
        }
        
        // Log comparison details
        console.log('DEBUG - BirthDate comparison:', {
          patientBirthDate,
          inputBirthDate,
          formattedBirthDate,
          birthDate,
          birthDateMatches
        });
        
        if (birthDateMatches) {
          // Add providerUID if missing (will be needed for saving)
          const patientWithDefaults = {
            id: doc.id,
            ...patientData,
            // Add providerUID if it doesn't exist
            providerUID: patientData.providerUID || [user?.uid]
          };
          
          matches.push(patientWithDefaults);
          console.log('DEBUG - Patient matched!', patientWithDefaults);
        }
      });
      
      console.log('DEBUG - Final matches after birthDate filtering:', matches.length);
      
      // Set matches for modal
      setPatientMatches(matches);
      return matches;
    } catch (error) {
      console.error('DEBUG - Error finding patients:', error);
      console.error('DEBUG - Error details:', JSON.stringify(error, null, 2));
      return [];
    } finally {
      setIsSearchingPatient(false);
    }
  };

  // New function to complete the save after patient confirmation
  const completeAssessmentSave = async () => {
    if (!pls5Data || !user?.uid || !selectedPatient) {
      console.error('Cannot save to Firebase: Missing data, user not authenticated, or no patient selected');
      return;
    }
    
    setIsLoading('Saving assessment to database...');
    setShowPatientModal(false);
    
    try {
      console.log('DEBUG - Saving assessment with selected patient:', selectedPatient);
      
      // Ensure patient has providerUID to prevent errors
      if (!selectedPatient.providerUID) {
        console.log('DEBUG - Adding missing providerUID to patient');
        selectedPatient.providerUID = [user.uid];
      } else if (!Array.isArray(selectedPatient.providerUID)) {
        console.log('DEBUG - Converting providerUID to array');
        selectedPatient.providerUID = [selectedPatient.providerUID];
      }
      
      // If current user is not in providerUID, add them
      if (Array.isArray(selectedPatient.providerUID) && !selectedPatient.providerUID.includes(user.uid)) {
        console.log('DEBUG - Adding current user to providerUID');
        selectedPatient.providerUID.push(user.uid);
      }
      
      // Update pls5Data with confirmed patient information
      const updatedData = {
        ...pls5Data,
        patientInfo: {
          ...pls5Data.patientInfo,
          firstName: selectedPatient.firstName,
          lastName: selectedPatient.lastName,
          // Keep other patient info fields if they exist
          name: selectedPatient.firstName + ' ' + selectedPatient.lastName,
          patientUID: selectedPatient.id // Store the patient UID
        },
        // Update birth date if it's available in the selected patient record
        birthDate: selectedPatient.birthDate ? 
                  (typeof selectedPatient.birthDate === 'object' && 'seconds' in selectedPatient.birthDate) ?
                  new Date(selectedPatient.birthDate.seconds * 1000).toLocaleDateString() : 
                  selectedPatient.birthDate 
                  : pls5Data.birthDate
      };
      
      setPls5Data(updatedData);
      
      console.log('DEBUG - Prepared assessment data for saving:', updatedData);
      
      // Use our assessment model to save the data with the selected patient's ID
      const { data, documentId } = await processAndSaveAssessment(
        updatedData,
        selectedPatient.id,
        user.uid
      );
      
      if (documentId) {
        console.log('DEBUG - Assessment saved successfully with ID:', documentId);
        setIsLoading(null);
        alert(`Assessment saved successfully with ID: ${documentId}`);
      } else {
        throw new Error('Failed to save assessment');
      }
    } catch (error) {
      console.error('Error saving to Firebase:', error);
      setIsLoading(null);
      setProcessingError(error instanceof Error ? error.message : 'Failed to save assessment to database');
    }
  };

  // Create a new patient record and then save the assessment
  const createPatientAndSave = async (patientData: any) => {
    if (!pls5Data || !user?.uid) {
      console.error('Cannot save to Firebase: Missing data or user not authenticated');
      setProcessingError('Missing data or user not authenticated');
      return;
    }
    
    setIsLoading('Creating new patient record...');
    
    try {
      console.log('DEBUG - Creating new patient with data:', patientData);
      
      // Convert birthDate to Timestamp if it's a string
      let birthDateTimestamp = null;
      if (patientData.birthDate) {
        // Import the dateStringToTimestamp function from assessmentModel
        // This ensures consistent date handling across the application
        const { dateStringToTimestamp } = await import('../lib/assessmentModel');
        birthDateTimestamp = dateStringToTimestamp(patientData.birthDate, false);
      }
      
      // Create the patient with a serverTimestamp for creation date
      const patientRef = await addDoc(collection(db, 'patients'), {
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        birthDate: birthDateTimestamp,
        createdAt: serverTimestamp(),
        providerUID: [user.uid]
      });
      
      console.log('DEBUG - Created new patient:', patientRef.id);
      
      // Set as selected patient
      const createdPatient = {
        id: patientRef.id,
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        birthDate: birthDateTimestamp
      };
      
      setSelectedPatient(createdPatient);
      
      // Format birthDate if needed for display in the assessment
      let formattedBirthDate = patientData.birthDate;
      
      // Update assessment data with the new patient information
      const updatedData = {
        ...pls5Data,
        patientInfo: {
          ...pls5Data.patientInfo,
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          name: patientData.firstName + ' ' + patientData.lastName,
          patientUID: patientRef.id // Store the patient UID
        },
        // Update birthDate at the top level
        birthDate: formattedBirthDate || pls5Data.birthDate
      };
      
      setPls5Data(updatedData);
      
      console.log('DEBUG - Prepared assessment data with new patient:', updatedData);
      
      // Use our assessment model to save the data with the new patient's ID
      const { data, documentId } = await processAndSaveAssessment(
        updatedData,
        patientRef.id,
        user.uid
      );
      
      console.log('DEBUG - Saved assessment:', { data, documentId });
      
      if (documentId) {
        // Success!
        setShowPatientModal(false);
        setIsLoading(null);
        
        // Success message
        alert('Patient created and assessment saved successfully!');
      } else {
        throw new Error('Failed to save assessment');
      }
    } catch (error) {
      console.error('ERROR - Failed to create patient and save assessment:', error);
      setIsLoading(null);
      setProcessingError(error instanceof Error ? error.message : 'Failed to create patient record');
    }
  };

  // Add a function to render PLS-5 visualization with improved UI
  const renderPLS5Visualization = () => {
    console.log('Rendering PLS5Visualization with data:', pls5Data, 'Edited data:', editedPls5Data);
    
    if (!pls5Data) {
      console.error('No PLS-5 data available to render');
      return (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-center mb-4 text-red-500">
            No PLS-5 Assessment Data Available
          </h2>
          <p className="text-center">
            There was a problem loading the assessment data. Please try scanning the document again.
          </p>
        </div>
      );
    }
    
    // Use the edited data if available, otherwise use the original data
    const displayData = editedPls5Data || pls5Data;
    
    // Return the PLS5Visualization component
    return <PLS5Visualization data={displayData} />;
  };

  const renderReportForm = () => {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Generate Report</h2>
        
        {/* Report form */}
        <div className="space-y-6">
          <ReportInput 
            title="Summary" 
            suggestions={['Provide a brief overview', 'Highlight key findings']}
            value={reportData.summary} 
            onChange={(text) => setReportData(prev => ({ ...prev, summary: text }))}
            onSubmit={() => handleGenerateReport('summary')}
            isLoading={isLoading === 'summary'}
          />
          
          <ReportInput 
            title="Strengths" 
            suggestions={['List client strengths', 'Include positive attributes']}
            value={reportData.strengths} 
            onChange={(text) => setReportData(prev => ({ ...prev, strengths: text }))}
            onSubmit={() => handleGenerateReport('strengths')}
            isLoading={isLoading === 'strengths'}
          />
          
          <ReportInput 
            title="Areas of Emergence" 
            suggestions={['Identify emerging skills', 'Note areas showing progress']}
            value={reportData.areasOfEmergence} 
            onChange={(text) => setReportData(prev => ({ ...prev, areasOfEmergence: text }))}
            onSubmit={() => handleGenerateReport('areasOfEmergence')}
            isLoading={isLoading === 'areasOfEmergence'}
          />
          
          <ReportInput 
            title="Weaknesses" 
            suggestions={['Describe challenging areas', 'Note areas needing improvement']}
            value={reportData.weaknesses} 
            onChange={(text) => setReportData(prev => ({ ...prev, weaknesses: text }))}
            onSubmit={() => handleGenerateReport('weaknesses')}
            isLoading={isLoading === 'weaknesses'}
          />
          
          <ReportInput 
            title="Hearing" 
            suggestions={['Note hearing status', 'Include hearing test results']}
            value={reportData.hearing} 
            onChange={(text) => setReportData(prev => ({ ...prev, hearing: text }))}
            onSubmit={() => handleGenerateReport('hearing')}
            isLoading={isLoading === 'hearing'}
          />
        </div>
        
        {/* Generated content */}
        {generatedContents.length > 0 && (
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium mb-4">Generated Content</h3>
            <div className="space-y-4">
              {generatedContents.map((content, index) => (
                <OutputResponse 
                  key={index}
                  title={content.section.charAt(0).toUpperCase() + content.section.slice(1)}
                  content={content.content}
                  isLoading={false}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="mt-6 flex justify-end">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            disabled={Object.values(reportData).every(value => !value.trim())}
          >
            Save Report
          </button>
        </div>
      </div>
    );
  };

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

  // Add a utility function to safely display timestamps or any other values in JSX
  const formatForDisplay = (value: any): string => {
    // Handle null or undefined
    if (value == null) return '';
    
    // Handle Firebase Timestamp objects
    if (typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
      const date = new Date(value.seconds * 1000);
      return date.toLocaleDateString();
    }
    
    // Handle Date objects
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    
    // Convert other values to string
    return String(value);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Add styles for tab transitions and text visibility */}
      <style jsx>{customStyles}</style>

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Auto-Fill Report</h1>
        </div>
      </header>

      {/* Add debugging info banner */}
      {debugMode && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">
                <strong>Debug Mode Active</strong>
              </p>
              <p className="text-sm mt-1">
                Composite query support: {compositeQuerySupported === null ? 'Testing...' : 
                  compositeQuerySupported ? 'Supported ✅' : 'Not supported ❌'}
              </p>
              {compositeQuerySupported === false && (
                <p className="text-sm mt-1">
                  Please update your Firestore security rules to allow simple queries and use the alternative
                  patient search method. 
                  <button 
                    className="ml-2 text-blue-600 underline"
                    onClick={() => findPatientsByNameAlternative('', '', '')}
                  >
                    Test alternative search
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Main content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Tab navigation */}
        <div className="mb-6 bg-white shadow rounded-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('camera')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'camera'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Document Scanner
              </button>
              {documentStatus === 'pls5_detected' && (
                <button
                  onClick={() => setActiveTab('results')}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm relative ${
                    activeTab === 'results'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Assessment Results
                  {/* Show a notification dot if we have new results */}
                  {documentStatus === 'pls5_detected' && activeTab !== 'results' && (
                    <span className="absolute top-3 right-2 h-2 w-2 bg-green-500 rounded-full"></span>
                  )}
                </button>
              )}
              <button
                onClick={() => setActiveTab('report')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm relative ${
                  activeTab === 'report'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Report Form
                {/* Show a notification dot if report data is available */}
                {reportData.summary && activeTab !== 'report' && (
                  <span className="absolute top-3 right-2 h-2 w-2 bg-green-500 rounded-full"></span>
                )}
              </button>
              
              {/* Add mock data button in the tab navigation */}
              <div className="ml-auto flex items-center pr-4">
                <div className="relative inline-block text-left">
                  <div>
                    <button
                      onClick={() => loadMockData(1)}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded-l-md hover:bg-green-700 transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Harry S.
                    </button>
                    <button
                      onClick={() => loadMockData(2)}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded-r-md hover:bg-green-700 transition-colors border-l border-green-700"
                    >
                      Sarah J.
                    </button>
                  </div>
                </div>
              </div>
            </nav>
          </div>
        </div>
        
        {/* If PLS-5 detected, show a notification */}
        {documentStatus === 'pls5_detected' && activeTab === 'camera' && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                PLS-5 assessment detected! View the 
                <button 
                  onClick={() => setActiveTab('results')} 
                  className="ml-1 font-bold underline"
                >
                  Assessment Results
                </button>
              </p>
            </div>
          </div>
        )}
        
        {/* Document Scanner Tab Content */}
        <div className={`tab-content ${activeTab === 'camera' ? 'active' : ''}`} 
             style={{ display: activeTab === 'camera' ? 'block' : 'none' }}>
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Upload Assessment Document</h2>
            
            {/* Camera/Upload sub-tabs */}
            <div className="border-b border-gray-200 mb-4">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setCameraTab(true)}
                  className={`mr-8 py-2 px-1 ${
                    cameraTab
                      ? 'border-blue-500 text-blue-600 border-b-2 font-medium'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Camera
                </button>
                <button
                  onClick={() => setCameraTab(false)}
                  className={`py-2 px-1 ${
                    !cameraTab
                      ? 'border-blue-500 text-blue-600 border-b-2 font-medium'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Upload File
                </button>
              </nav>
            </div>
            
            {/* Camera interface */}
            {cameraTab && (
              <div>
                {!cameraActive && !capturedImage && (
                  <div className="flex justify-center mb-4">
                    <button
                      onClick={handleStartCamera}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      disabled={!hasCamera}
                    >
                      {hasCamera ? 'Start Camera' : 'Camera Not Available'}
                    </button>
                  </div>
                )}
                
                {cameraActive && (
                  <div className="mb-4">
                    <div className="relative mb-4 bg-black rounded overflow-hidden">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full max-h-96 object-contain"
                      />
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={handleCaptureImage}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Capture Image
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* File upload interface */}
            {!cameraTab && (
              <div>
                <div
                  onClick={handleFileSelectClick}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
                >
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H4m32-12l-3.172-3.172a4 4 0 00-5.656 0L28 24m0 0l-4 4m4-4v12"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
                    Click to upload a document or drag and drop
                  </p>
                  <p className="mt-1 text-xs text-gray-500">PNG, JPG, JPEG up to 10MB</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
              </div>
            )}
            
            {/* Status and progress */}
            {isLoading && (
              <div className="mt-4 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                <p className="text-gray-600">{isLoading}</p>
              </div>
            )}
            
            {/* Error message */}
            {processingError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                <p className="font-medium">Error</p>
                <p className="text-sm">{processingError}</p>
              </div>
            )}
            
            {/* Captured image preview */}
            {capturedImage && !isLoading && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Captured Image</h3>
                <div className="bg-gray-100 p-2 rounded">
                  <img
                    src={capturedImage}
                    alt="Captured document"
                    className="max-h-96 mx-auto"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Assessment Results Tab Content */}
        <div className={`tab-content ${activeTab === 'results' ? 'active' : ''}`}
             style={{ display: activeTab === 'results' ? 'block' : 'none' }}>
          {documentStatus === 'pls5_detected' && pls5Data ? (
            renderPLS5Visualization()
          ) : (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No assessment data</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload or scan a PLS-5 assessment form to view results.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setActiveTab('camera')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  Scan Document
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Report Form Tab Content */}
        <div className={`tab-content ${activeTab === 'report' ? 'active' : ''}`}
             style={{ display: activeTab === 'report' ? 'block' : 'none' }}>
          {renderReportForm()}
        </div>
      </main>
      
      {/* Patient Confirmation Modal */}
      {showPatientModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 text-black">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              {patientMatches.length > 0 ? 'Confirm Patient Identity' : 'Create New Patient'}
            </h2>
            
            {debugMode && (
              <div className="mb-4 p-2 bg-blue-50 text-blue-800 text-sm rounded border border-blue-200">
                <p>Debug Info: Found {patientMatches.length} patient match(es)</p>
                {patientMatches.length > 0 && (
                  <pre className="mt-1 text-xs overflow-auto max-h-20">
                    {JSON.stringify(patientMatches.map(p => ({
                      id: p.id, 
                      name: `${p.firstName} ${p.lastName}`,
                      birthDate: formatForDisplay(p.birthDate)
                    })), null, 2)}
                  </pre>
                )}
              </div>
            )}
            
            {isSearchingPatient ? (
              <div className="text-center p-4 text-gray-800">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                <p>Searching for matching patients...</p>
              </div>
            ) : (
              <>
                {patientMatches.length > 0 ? (
                  <div>
                    <p className="text-gray-800 mb-4">
                      {patientMatches.length === 1 
                        ? 'We found a matching patient record. Please confirm this is the correct patient:'
                        : 'We found multiple matching patient records. Please select the correct patient:'}
                    </p>
                    
                    <div className="max-h-60 overflow-y-auto mb-4 border rounded">
                      {patientMatches.map((patient) => (
                        <div 
                          key={patient.id}
                          className={`p-3 cursor-pointer hover:bg-gray-100 border-b ${selectedPatient?.id === patient.id ? 'bg-blue-50 border-blue-500' : ''}`}
                          onClick={() => setSelectedPatient(patient)}
                        >
                          <div className="font-medium text-gray-900">{patient.firstName} {patient.lastName}</div>
                          <div className="text-sm text-gray-700">DOB: {formatForDisplay(patient.birthDate)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mb-4">
                    <p className="text-gray-800 mb-4">
                      No matching patients found. Please confirm patient details to create a new record:
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-800">First Name</label>
                        <input 
                          type="text" 
                          value={pls5Data?.patientInfo?.firstName || ''} 
                          onChange={(e) => handlePatientInfoChange('firstName', e.target.value)}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-800">Last Name</label>
                        <input 
                          type="text" 
                          value={pls5Data?.patientInfo?.lastName || ''} 
                          onChange={(e) => handlePatientInfoChange('lastName', e.target.value)}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-800">Date of Birth</label>
                        <input 
                          type="text" 
                          value={formatForDisplay(pls5Data?.birthDate)} 
                          onChange={(e) => handleDateChange('birthDate', e.target.value)}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 bg-white"
                          placeholder="MM/DD/YYYY"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowPatientModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  
                  {patientMatches.length > 0 ? (
                    <button
                      onClick={completeAssessmentSave}
                      disabled={!selectedPatient}
                      className={`px-4 py-2 rounded-md text-white ${selectedPatient ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                    >
                      Confirm & Save
                    </button>
                  ) : (
                    <button
                      onClick={() => createPatientAndSave({
                        firstName: pls5Data?.patientInfo?.firstName,
                        lastName: pls5Data?.patientInfo?.lastName,
                        birthDate: pls5Data?.birthDate
                      })}
                      disabled={!pls5Data?.patientInfo?.firstName || !pls5Data?.patientInfo?.lastName}
                      className={`px-4 py-2 rounded-md text-white ${
                        pls5Data?.patientInfo?.firstName && pls5Data?.patientInfo?.lastName 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Create & Save
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Add debug button when in development */}
      {debugMode && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={testFirebaseQuery}
            className="bg-red-600 text-white px-4 py-2 rounded-md shadow-lg hover:bg-red-700"
          >
            Test Firebase Queries
          </button>
        </div>
      )}
    </div>
  );
} 