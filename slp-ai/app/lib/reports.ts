import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';

export async function saveReport(userId: string, template: string, inputData: string, generatedReport: string) {
  try {
    const docRef = await addDoc(collection(db, 'reports'), {
      userId,
      template,
      inputData,
      generatedReport,
      createdAt: new Date(),
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
  }
}

export async function getReportsByUser(userId: string) {
  const q = query(collection(db, 'reports'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
} 