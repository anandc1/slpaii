import { db, Timestamp, serverTimestamp } from './firebase';
import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';

export interface Token {
  id: string;
  userId: string;
  assessmentType: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  used: boolean;
  requiresAuth?: boolean;
}

export async function getToken(tokenId: string): Promise<Token | null> {
  try {
    const tokenRef = doc(db, 'tokens', tokenId);
    const tokenSnap = await getDoc(tokenRef);
    
    if (tokenSnap.exists()) {
      return { id: tokenSnap.id, ...tokenSnap.data() } as Token;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
}

export async function validateToken(tokenId: string): Promise<{ valid: boolean; token?: Token; error?: string }> {
  try {
    const token = await getToken(tokenId);
    
    if (!token) {
      return { valid: false, error: 'Token not found' };
    }
    
    // Check if token is expired
    const now = new Date();
    if (token.expiresAt.toDate() < now) {
      return { valid: false, error: 'Token expired' };
    }
    
    // Check if token has been used
    if (token.used) {
      return { valid: false, error: 'Token already used' };
    }
    
    return { valid: true, token };
  } catch (error) {
    console.error('Error validating token:', error);
    return { valid: false, error: 'Error validating token' };
  }
}

export async function markTokenAsUsed(tokenId: string): Promise<boolean> {
  try {
    const tokenRef = doc(db, 'tokens', tokenId);
    await updateDoc(tokenRef, { used: true });
    return true;
  } catch (error) {
    console.error('Error marking token as used:', error);
    return false;
  }
}
