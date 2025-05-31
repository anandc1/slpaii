'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, db, serverTimestamp } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { User as FirestoreUser, ensureUserExists } from '../lib/users';

type AuthContextType = {
  user: FirebaseUser | null;
  userData: FirestoreUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string, organization: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  ensureCurrentUserExists: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch Firestore user data
  const fetchUserData = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setUserData(docSnap.data() as FirestoreUser);
      } else {
        console.log("No Firestore user document found for:", uid);
        setUserData(null);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUserData(null);
    }
  };

  // Refresh user data function
  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user.uid);
    }
  };

  // Ensure the current user exists in Firestore
  const ensureCurrentUserExists = async () => {
    if (user) {
      // Extract first and last name from display name
      const displayNameParts = user.displayName?.split(' ') || ['', ''];
      const firstName = displayNameParts[0] || '';
      const lastName = displayNameParts.slice(1).join(' ') || '';
      
      // Check if user document already exists
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          console.log('User document already exists');
          return;
        }
      } catch (error) {
        console.error('Error checking if user exists:', error);
      }
      
      // Create user document if it doesn't exist
      await createUserDocument(user.uid, {
        firstName,
        lastName,
        email: user.email || '',
        organization: '' // Empty string for organization
      });
      
      // Refresh user data after ensuring it exists
      await refreshUserData();
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      if (user) {
        fetchUserData(user.uid);
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  // Helper function to create a user document in Firestore
  const createUserDocument = async (
    userId: string, 
    data: { 
      firstName: string; 
      lastName: string; 
      email: string; 
      organization?: string;
    }
  ) => {
    try {
      // Validate required fields
      if (!data.firstName || !data.lastName || !data.email) {
        console.error('Missing required user data fields');
        return false;
      }

      // Create formatted user data object
      const userData = {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.toLowerCase().trim(),
        admin: false,
        organization: data.organization ? data.organization.trim() : '', // Store as a string, not an array
        devMode: false,
        createdAt: serverTimestamp()
      };

      console.log(`Creating Firestore document for user ID: ${userId}`, userData);
      
      // Set the user document
      await setDoc(doc(db, 'users', userId), userData);
      console.log('User document created successfully');
      return true;
    } catch (error) {
      console.error('Error creating user document:', error);
      return false;
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, organization: string) => {
    try {
      console.log('Starting signup with:', { email, firstName, lastName, organization });
      
      // Create the Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('User created in Firebase Auth with UID:', userCredential.user.uid);
      
      // Update the user's profile with their name
      await updateProfile(userCredential.user, {
        displayName: `${firstName} ${lastName}`
      });
      console.log('User profile updated with display name');
      
      // Create the user document in Firestore
      const success = await createUserDocument(userCredential.user.uid, {
        firstName,
        lastName,
        email,
        organization
      });
      
      if (!success) {
        console.warn('Failed to create user document, but auth user was created');
      }
      
      // Reload the user to ensure we have the latest data
      await userCredential.user.reload();
      console.log('User reload completed');
    } catch (error) {
      console.error('Error during sign up process:', error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userData, 
      loading, 
      signIn, 
      signUp, 
      logout, 
      refreshUserData,
      ensureCurrentUserExists 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);