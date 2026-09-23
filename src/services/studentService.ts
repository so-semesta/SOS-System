import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student } from '../types';

export const getStudentProfile = async (userId: string): Promise<Student | null> => {
  const q = query(collection(db, 'students'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    const directDoc = await getDoc(doc(db, 'students', userId));
    if (directDoc.exists()) {
      return { id: directDoc.id, ...directDoc.data() } as Student;
    }
    return null;
  }
  // If multiple exist, pick the most recently updated or created
  const sortedDocs = [...querySnapshot.docs].sort((a, b) => {
    const aTime = a.data().updatedAt || a.data().createdAt || 0;
    const bTime = b.data().updatedAt || b.data().createdAt || 0;
    return bTime - aTime;
  });
  const studentDoc = sortedDocs[0];
  return { id: studentDoc.id, ...studentDoc.data() } as Student;
};

export const getAllStudents = async (): Promise<Student[]> => {
  const q = query(collection(db, 'students'));
  const querySnapshot = await getDocs(q);
  
  // Deduplicate by userId (or doc.id) to ensure unique identities across the app
  const studentsMap = new Map<string, Student>();
  querySnapshot.docs.forEach(doc => {
    const data = doc.data() as Omit<Student, 'id'>;
    const student: Student = { id: doc.id, ...data };
    const uniqueKey = student.userId || doc.id;

    if (!studentsMap.has(uniqueKey)) {
      studentsMap.set(uniqueKey, student);
    } else {
      const existing = studentsMap.get(uniqueKey)!;
      const studentTime = student.updatedAt || student.createdAt || 0;
      const existingTime = existing.updatedAt || existing.createdAt || 0;
      if (studentTime > existingTime) {
        studentsMap.set(uniqueKey, student);
      }
    }
  });

  return Array.from(studentsMap.values());
};

export const createStudentProfile = async (studentId: string, data: Omit<Student, 'id'>) => {
  await setDoc(doc(db, 'students', studentId), data);
};

export const updateStudentProfile = async (studentId: string, data: Partial<Student>) => {
  await updateDoc(doc(db, 'students', studentId), data);
};
