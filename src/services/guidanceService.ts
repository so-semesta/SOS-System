import { collection, doc, getDocs, setDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GuidanceLog } from '../types';

export const createGuidanceLog = async (logId: string, data: Omit<GuidanceLog, 'id'>) => {
  await setDoc(doc(db, 'guidanceLogs', logId), data);
};

export const getStudentGuidanceLogs = async (studentId: string): Promise<GuidanceLog[]> => {
  const q = query(
    collection(db, 'guidanceLogs'),
    where('studentId', '==', studentId)
    // Removed orderBy('date', 'desc') to avoid requiring index for simple list right now, or we can sort on client side
  );
  const querySnapshot = await getDocs(q);
  const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GuidanceLog);
  // Sort descending by date
  return logs.sort((a, b) => b.date - a.date);
};

export const getAllGuidanceLogs = async (): Promise<GuidanceLog[]> => {
  const q = query(collection(db, 'guidanceLogs'));
  const querySnapshot = await getDocs(q);
  const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GuidanceLog);
  return logs.sort((a, b) => b.date - a.date);
};
