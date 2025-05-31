// Mock data for development and testing
const mockData = {
  patient: {
    firstName: "Jane",
    lastName: "Doe",
    birthDate: "2018-05-15",
    uid: "mock_patient_123"
  },
  soapNote: {
    patientUID: "mock_patient_123",
    providerUID: "provider_1234567890",
    type: "soap",
    dateCreated: "2025-03-10T10:30:00Z",
    dateAmended: null,
    data: {
      subjective: "Patient is a 6-year-old female who presents with concerns about articulation and language development. Mother reports that Jane has difficulty with /r/ and /s/ sounds and struggles to form complete sentences when excited. She has been receiving speech therapy at school once a week for the past 3 months.",
      objective: "Jane demonstrated difficulty with /r/ and /s/ sounds in all positions. She substituted /w/ for /r/ and had lateral distortion of /s/. Sentence length averaged 4-5 words during structured activities but decreased to 2-3 words during free play. Receptive language skills appear age-appropriate based on following multi-step directions.",
      assessment: "Jane presents with a mild-to-moderate articulation disorder and a mild expressive language delay. Her articulation errors are consistent with developmental patterns but are persisting beyond the typical age of acquisition. Her receptive language appears to be within normal limits.",
      plan: "Recommend twice-weekly speech therapy sessions focusing on articulation of /r/ and /s/ sounds and expressive language development. Home program to include daily practice of target sounds in words and simple sentences. Re-evaluation in 3 months to assess progress."
    },
    uid: "mock_soap_456"
  },
  assessment: {
    patientUID: "mock_patient_123",
    providerUID: "provider_1234567890",
    type: "PLS-5",
    dateCreated: "2025-03-10T11:15:00Z",
    dateAmended: null,
    data: {
      scores: {
        receptive: 92,
        expressive: 85,
        total: 88
      },
      interpretation: "Jane's PLS-5 results indicate receptive language skills within normal limits (standard score 92, 30th percentile) and expressive language skills slightly below average (standard score 85, 16th percentile). Her total language score falls within the low average range (standard score 88, 21st percentile).",
      recommendations: "Based on these results, Jane would benefit from speech therapy services focusing on expressive language development, particularly in the areas of sentence formulation, vocabulary expansion, and narrative skills."
    },
    uid: "mock_assessment_789"
  }
};

// Make it available globally
window.mockData = mockData;
