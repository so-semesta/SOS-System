import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student } from '../types';

export const getStudentProfile = async (userId: string): Promise<Student | null> => {
  const q = query(collection(db, 'students'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }
  const studentDoc = querySnapshot.docs[0];
  return { id: studentDoc.id, ...studentDoc.data() } as Student;
};

export const getAllStudents = async (): Promise<Student[]> => {
  const q = query(collection(db, 'students'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Student);
};

export const createStudentProfile = async (studentId: string, data: Omit<Student, 'id'>) => {
  await setDoc(doc(db, 'students', studentId), data);
};

export const updateStudentProfile = async (studentId: string, data: Partial<Student>) => {
  await updateDoc(doc(db, 'students', studentId), data);
};
