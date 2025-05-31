import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { mockUploadAssessmentImage, getMockAssessmentImageUrl } from './mockStorageService';

// Flag to track if Firebase Storage is available
let isFirebaseStorageAvailable = true;

/**
 * Upload a file to Firebase Storage
 * @param file The file to upload
 * @param path The path in storage where the file should be saved
 * @returns Promise with the download URL
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  // If we already know Firebase Storage is unavailable, use mock immediately
  if (!isFirebaseStorageAvailable) {
    console.log('Using mock storage service (Firebase Storage unavailable)');
    return getMockAssessmentImageUrl('auto-detect');
  }

  try {
    // Create a storage reference
    const storageRef = ref(storage, path);
    
    // Set metadata based on file type
    const metadata = {
      contentType: file.type || 'application/octet-stream'
    };
    
    // Upload the file with metadata
    const snapshot = await uploadBytes(storageRef, file, metadata);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    console.log('Falling back to mock storage service');
    
    // Mark Firebase Storage as unavailable for future uploads
    isFirebaseStorageAvailable = false;
    
    // Return a mock URL instead
    return getMockAssessmentImageUrl('auto-detect');
  }
}

/**
 * Upload an assessment image to Firebase Storage
 * @param file The image file to upload
 * @param userId The user ID
 * @param assessmentId The assessment ID
 * @returns Promise with the download URL
 */
export async function uploadAssessmentImage(
  file: File, 
  userId: string, 
  assessmentId: string
): Promise<string> {
  // If we already know Firebase Storage is unavailable, use mock immediately
  if (!isFirebaseStorageAvailable) {
    console.log('Using mock upload service (Firebase Storage unavailable)');
    return mockUploadAssessmentImage(file, userId, assessmentId);
  }

  try {
    // Generate a unique path for the image
    const path = `assessments/${userId}/${assessmentId}/${file.name}`;
    return await uploadFile(file, path);
  } catch (error) {
    console.error('Error in uploadAssessmentImage, falling back to mock:', error);
    
    // Mark Firebase Storage as unavailable for future uploads
    isFirebaseStorageAvailable = false;
    
    // Use the mock upload function instead
    return mockUploadAssessmentImage(file, userId, assessmentId);
  }
}
