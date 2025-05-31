// assessment.js
// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAO0jbpjUvIFJJGnvZHTIBOBSLbTqACuIA",
  authDomain: "slp-ai-27f1f.firebaseapp.com",
  projectId: "slp-ai-27f1f",
  storageBucket: "slp-ai-27f1f.firebasestorage.app",
  messagingSenderId: "828268211437",
  appId: "1:828268211437:web:d4cb3375bbb38d08f1f0e4",
  databaseURL: "https://slp-ai-27f1f-default-rtdb.firebaseio.com"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const form = document.getElementById('pls5Form');
const message = document.getElementById('message');
form.onsubmit = async function(e) {
  e.preventDefault();
  // Get token from URL
  const token = new URLSearchParams(window.location.search).get('token');
  console.log('Submitting scores for token:', token);
  // Get form data
  const formData = new FormData(this);
  const scoreData = {
    auditoryComprehension: parseInt(formData.get('auditoryComprehension')),
    expressiveCommunication: parseInt(formData.get('expressiveCommunication')),
    totalLanguage: parseInt(formData.get('totalLanguage')),
    percentileRank: parseInt(formData.get('percentileRank')),
    completed: true,
    timestamp: new Date().toISOString()
  };
  console.log('Score data:', scoreData);
  try {
    await db.collection('assessments').doc(token).set(scoreData);
    console.log('Scores saved successfully');
    document.getElementById('message').textContent = 'Scores submitted successfully! You may close this page.';
    document.getElementById('message').className = 'success';
    form.reset();
  } catch (error) {
    console.error('Error saving scores:', error);
    document.getElementById('message').textContent = 'Error saving scores. Please try again.';
    document.getElementById('message').className = 'error';
  }
}; 