import { db } from './firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc, FieldValue as FirestoreFieldValue } from 'firebase/firestore';
import { Timestamp, serverTimestamp } from 'firebase/firestore';

export interface User {
  firstName: string;
  lastName: string;
  email: string;
  admin: boolean;
  organization: string;
  devMode: boolean;
  createdAt: any; // Allow any type for createdAt to handle Firestore timestamps
}

/**
 * Get user data from Firestore
 */
export async function getUserData(userId: string) {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as User & { id: string };
    } else {
      console.error('No user document found with ID:', userId);
      return null;
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}

/**
 * Update user admin status
 */
export async function updateUserAdminStatus(userId: string, isAdmin: boolean) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      admin: isAdmin
    });
    return true;
  } catch (error) {
    console.error('Error updating user admin status:', error);
    throw error;
  }
}

/**
 * Update user organization
 */
export async function updateUserOrganization(userId: string, organization: string) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      organization: organization
    });
    return true;
  } catch (error) {
    console.error('Error updating user organization:', error);
    throw error;
  }
}

/**
 * Toggle user developer mode
 */
export async function toggleUserDevMode(userId: string, devMode: boolean) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      devMode: devMode
    });
    return true;
  } catch (error) {
    console.error('Error toggling user dev mode:', error);
    throw error;
  }
}

/**
 * Check if user exists in Firestore and create if not
 */
export async function ensureUserExists(userId: string, userData: Partial<User>) {
  try {
    const userRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userRef);
    
    if (!docSnap.exists()) {
      // User doesn't exist in Firestore, create with default values
      const defaultUserData: Omit<User, 'createdAt'> & { createdAt: any } = {
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        admin: userData.admin !== undefined ? userData.admin : false,
        // Handle organization as a string
        organization: userData.organization || '',
        devMode: userData.devMode !== undefined ? userData.devMode : false,
        createdAt: userData.createdAt || serverTimestamp()
      };
      
      console.log('Creating new user document:', defaultUserData);
      await setDoc(userRef, defaultUserData);
      return { ...defaultUserData, id: userId };
    }
    
    return { id: docSnap.id, ...docSnap.data() } as User & { id: string };
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    throw error;
  }
} 