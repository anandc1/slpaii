// Firebase configuration
// IMPORTANT: In a production app, consider using Firebase config from a secure source
// This is a placeholder configuration for development purposes
const firebaseConfig = {
  apiKey: "AIzaSyAO0jbpjUvIFJJGnvZHTIBOBSLbTqACuIA", // Replace with your Firebase API key
  authDomain: "slp-ai-27f1f.firebaseapp.com", // Replace with your Firebase Auth Domain
  projectId: "slp-ai-27f1f", // Replace with your Firebase Project ID
  storageBucket: "slp-ai-27f1f.appspot.com", // Replace with your Storage Bucket
  messagingSenderId: "828268211437", // Replace with your Messaging Sender ID
  appId: "1:828268211437:web:d4cb3375bbb38d08f1f0e4", // Replace with your App ID
  databaseURL: "https://slp-ai-27f1f-default-rtdb.firebaseio.com", // Replace with your Firebase Database URL
  measurementId: "G-MEASUREMENT_ID", // Replace with your Measurement ID if using Analytics
};

// Create mock implementations for fallback
function createMockFirestore() {
  console.log("Creating mock Firestore implementation");
  return {
    collection: function (name) {
      return {
        doc: function (id) {
          const docId = id || "mock_" + Date.now();
          return {
            id: docId,
            set: function (data) {
              return Promise.resolve();
            },
            update: function (data) {
              return Promise.resolve();
            },
            get: function () {
              return Promise.resolve({
                exists: true,
                data: function () {
                  return {};
                },
              });
            },
          };
        },
        add: function (data) {
          const docId = "mock_" + Date.now();
          return Promise.resolve({ id: docId });
        },
      };
    },
  };
}

function createMockStorage() {
  console.log("Creating mock Storage implementation");
  return {
    ref: function (path) {
      return {
        put: function (file) {
          return {
            snapshot: {},
            ref: {
              getDownloadURL: function () {
                return Promise.resolve("https://mock-url.com/file.jpg");
              },
            },
          };
        },
        getDownloadURL: function () {
          return Promise.resolve("https://mock-url.com/file.jpg");
        },
      };
    },
  };
}

function createMockAuth() {
  console.log("Creating mock Auth implementation");
  return {
    onAuthStateChanged: function (callback) {
      callback(null);
      return function () {};
    },
    signInAnonymously: function () {
      return Promise.resolve({ user: { uid: "mock_user_" + Date.now() } });
    },
  };
}

try {
  // Check if Firebase is defined
  if (typeof firebase !== "undefined") {
    console.log("Firebase SDK detected, initializing Firebase services");

    // Check if Firebase app is already initialized
    if (!firebase.apps || !firebase.apps.length) {
      // Initialize Firebase
      firebase.initializeApp(firebaseConfig);
      console.log("Firebase initialized successfully");
    } else {
      console.log("Firebase already initialized");
    }

    // Initialize Firestore
    const db = firebase.firestore();

    // Initialize Firebase Storage
    const storage = firebase.storage();

    // Initialize Firebase Auth
    const auth = firebase.auth();

    // Export the Firebase services
    window.db = db;
    window.storage = storage;
    window.auth = auth;

    console.log("Firebase services exported to window");
  } else {
    console.warn("Firebase SDK not detected, using mock implementations");

    // Create mock implementations
    window.db = createMockFirestore();
    window.storage = createMockStorage();
    window.auth = createMockAuth();

    console.log("Mock Firebase services exported to window");
  }
} catch (error) {
  console.error("Error initializing Firebase:", error);
}
