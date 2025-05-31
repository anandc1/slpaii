import { db } from '../app/lib/firebase';
import { collection, addDoc, query, where, orderBy, getDocs } from 'firebase/firestore';
import { Report, ReportCreate } from '../models/report';

export async function saveReport(data: ReportCreate) {
  const reportsRef = collection(db, 'reports');
  return addDoc(reportsRef, {
    ...data,
    createdAt: new Date()
  });
}

export async function getReportsByUser(userId: string) {
  const reportsRef = collection(db, 'reports');
  const q = query(
    reportsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<Report, 'id'>)
  })) as (Report & { id: string })[];
} 