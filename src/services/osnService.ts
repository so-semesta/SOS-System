import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, deleteDoc, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OsnAnnouncement, OsnBankSoal } from '../types';

export const getOsnAnnouncement = async (): Promise<OsnAnnouncement | null> => {
  const docRef = doc(db, 'osn_announcements', 'main');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as OsnAnnouncement;
  }
  return null;
};

export const updateOsnAnnouncement = async (data: Partial<OsnAnnouncement>) => {
  const docRef = doc(db, 'osn_announcements', 'main');
  await setDoc(docRef, data, { merge: true });
};

export const getOsnBankSoal = async (): Promise<OsnBankSoal[]> => {
  const q = query(collection(db, 'osn_banksoal'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as OsnBankSoal);
};

export const addOsnBankSoal = async (data: Omit<OsnBankSoal, 'id'>) => {
  await addDoc(collection(db, 'osn_banksoal'), data);
};

export const updateOsnBankSoal = async (id: string, data: Partial<OsnBankSoal>) => {
  await updateDoc(doc(db, 'osn_banksoal', id), data);
};

export const deleteOsnBankSoal = async (id: string) => {
  await deleteDoc(doc(db, 'osn_banksoal', id));
};
