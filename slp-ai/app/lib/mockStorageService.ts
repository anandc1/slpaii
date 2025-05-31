// Mock storage service for when Firebase storage is unavailable
// This provides fallback URLs for assessment templates

interface MockAssessmentTemplate {
  id: string;
  name: string;
  imageUrl: string;
}

// Collection of mock assessment templates with publicly available sample images
const mockAssessmentTemplates: Record<string, MockAssessmentTemplate> = {
  'pls-5': {
    id: 'pls-5',
    name: 'PLS-5',
    imageUrl: 'https://www.pearsonassessments.com/content/dam/school/global/clinical/us/assets/pls5/pls-5-sample.jpg'
  },
  'auto-detect': {
    id: 'auto-detect',
    name: 'Auto-detect',
    imageUrl: 'https://www.pearsonassessments.com/content/dam/school/global/clinical/us/assets/pls5/pls-5-sample.jpg'
  },
  // Add more mock templates as needed
};

// Fallback URLs for when no specific template is selected
const fallbackImageUrls = [
  'https://cdn.shopify.com/s/files/1/0081/7374/8305/articles/PLS-5_info_2048x.jpg',
  'https://www.researchgate.net/profile/Karla-Washington-2/publication/264396850/figure/fig1/AS:392292303761409@1470546694224/Preschool-Language-Scale-Fifth-Edition-PLS-5-Auditory-Comprehension-Expressive.png'
];

/**
 * Get a mock image URL for a specific assessment template
 * @param templateId The template ID to get a mock image for
 * @returns A URL to a sample image for the template
 */
export function getMockAssessmentImageUrl(templateId: string): string {
  // If we have a specific mock for this template, use it
  if (templateId && mockAssessmentTemplates[templateId]) {
    return mockAssessmentTemplates[templateId].imageUrl;
  }
  
  // Otherwise return a random fallback URL
  const randomIndex = Math.floor(Math.random() * fallbackImageUrls.length);
  return fallbackImageUrls[randomIndex];
}

/**
 * Mock function to simulate uploading a file
 * @param file The file to "upload"
 * @param userId The user ID
 * @param assessmentId The assessment ID
 * @returns A promise that resolves to a mock URL
 */
export async function mockUploadAssessmentImage(
  file: File,
  userId: string,
  assessmentId: string
): Promise<string> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // For PDFs, return a PDF icon URL
  if (file.type === 'application/pdf') {
    return '/pdf-icon.svg';
  }
  
  // For images, return a fallback URL
  return fallbackImageUrls[0];
}
