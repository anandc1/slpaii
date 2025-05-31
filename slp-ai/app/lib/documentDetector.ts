/**
 * Utility functions for detecting and classifying assessment documents
 */

interface DocumentClassification {
  isDocument: boolean;
  documentType: string;
  confidence: number;
  patterns: {
    name: string;
    found: boolean;
  }[];
}

// Interface for the internal best match tracking
interface DocumentMatch {
  type: string;
  matchCount: number;
  totalPatterns: number;
  patterns: {
    name: string;
    found: boolean;
  }[];
}

// Known document types with their identifying patterns
const documentPatterns = {
  'PLS-5': [
    'Preschool Language Scales',
    'PLS-5',
    'Fifth Edition',
    'Auditory Comprehension',
    'Expressive Communication',
    'Language Score',
  ],
  'CELF-5': [
    'Clinical Evaluation of Language Fundamentals',
    'CELF-5',
    'Language Content Index',
    'Language Structure Index',
  ],
  'GFTA-3': [
    'Goldman-Fristoe Test',
    'GFTA-3',
    'Articulation',
    'Sounds-in-Words',
  ],
  'OWLS-II': [
    'Oral and Written Language Scales',
    'OWLS-II',
    'Listening Comprehension',
    'Oral Expression',
  ],
  'REEL-4': [
    'Receptive-Expressive Emergent Language Test',
    'REEL-4',
    'Receptive Language',
    'Expressive Language',
  ],
};

/**
 * Classifies a document based on text content
 * @param text The extracted text from the document
 * @returns DocumentClassification object with the detected document type and confidence
 */
export function classifyDocument(text: string): DocumentClassification {
  if (!text || typeof text !== 'string') {
    return {
      isDocument: false,
      documentType: 'Unknown',
      confidence: 0,
      patterns: [],
    };
  }

  const normalizedText = text.toLowerCase();
  let bestMatch: DocumentMatch = {
    type: 'Unknown',
    matchCount: 0,
    totalPatterns: 0,
    patterns: [] as { name: string; found: boolean; }[]
  };

  // Check each document type
  for (const [docType, patterns] of Object.entries(documentPatterns)) {
    let matchCount = 0;
    const matchedPatterns = patterns.map(pattern => {
      const found = normalizedText.includes(pattern.toLowerCase());
      if (found) matchCount++;
      return { name: pattern, found };
    });

    // Calculate the confidence score
    const confidence = patterns.length > 0 ? matchCount / patterns.length : 0;

    // Update best match if this one is better
    if (matchCount > bestMatch.matchCount || 
        (matchCount === bestMatch.matchCount && confidence > bestMatch.matchCount / bestMatch.totalPatterns)) {
      bestMatch = {
        type: docType,
        matchCount,
        totalPatterns: patterns.length,
        patterns: matchedPatterns,
      };
    }
  }

  // Ensure confidence is a real number
  const confidence = bestMatch.totalPatterns > 0 
    ? bestMatch.matchCount / bestMatch.totalPatterns 
    : 0;

  // Consider it a match if confidence exceeds threshold
  const isDocument = confidence >= 0.3;
  
  return {
    isDocument,
    documentType: isDocument ? bestMatch.type : 'Unknown',
    confidence,
    patterns: bestMatch.patterns,
  };
}

/**
 * Recognize additional information about a specific document type
 * @param documentType The detected document type
 * @param data The extracted data
 * @returns Enhanced data with document-specific structure
 */
export function enhanceDocumentData(documentType: string, data: any): any {
  // Clone the data to avoid modifying the original
  const enhancedData = { ...data };
  
  // Add document type if not present
  if (!enhancedData.formType) {
    enhancedData.formType = documentType;
  }
  
  // Document type specific enhancements
  switch (documentType) {
    case 'PLS-5':
      // Ensure the PLS-5 specific structure
      if (!enhancedData.scores) enhancedData.scores = {};
      if (!enhancedData.scores.rawScores) enhancedData.scores.rawScores = {};
      if (!enhancedData.scores.standardScores) enhancedData.scores.standardScores = {};
      if (!enhancedData.scores.percentiles) enhancedData.scores.percentiles = {};
      if (!enhancedData.scores.confidenceIntervals) enhancedData.scores.confidenceIntervals = {};
      if (!enhancedData.scores.compositeScores) enhancedData.scores.compositeScores = {};
      
      // Map generic scores to specific categories if needed
      if (enhancedData.scores.all) {
        for (const [key, value] of Object.entries(enhancedData.scores.all)) {
          const keyLower = String(key).toLowerCase();
          
          if (keyLower.includes('raw') && keyLower.includes('ac')) {
            enhancedData.scores.rawScores['AC Raw Score'] = value;
          } else if (keyLower.includes('raw') && keyLower.includes('ec')) {
            enhancedData.scores.rawScores['EC Raw Score'] = value;
          } else if (keyLower.includes('standard') && keyLower.includes('ac')) {
            enhancedData.scores.standardScores['AC Standard Score'] = value;
          } else if (keyLower.includes('standard') && keyLower.includes('ec')) {
            enhancedData.scores.standardScores['EC Standard Score'] = value;
          } else if (keyLower.includes('total') && keyLower.includes('standard')) {
            enhancedData.scores.compositeScores['Standard Score Total'] = value;
          } else if (keyLower.includes('percentile') || keyLower.includes('rank')) {
            enhancedData.scores.percentiles[key] = value;
          } else if (keyLower.includes('confidence') || keyLower.includes('interval')) {
            enhancedData.scores.confidenceIntervals[key] = value;
          }
        }
      }
      break;
      
    // Add more document types as needed
    default:
      // No specific enhancements for unknown document types
      break;
  }
  
  return enhancedData;
}

export default {
  classifyDocument,
  enhanceDocumentData,
}; 