import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, deleteDoc, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OsnAnnouncement, OsnBankSoal } from '../types';

export const getOsnAnnouncements = async (): Promise<OsnAnnouncement[]> => {
  const q = query(collection(db, 'osn_announcements'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as OsnAnnouncement);
};

export const addOsnAnnouncement = async (data: Omit<OsnAnnouncement, 'id'>) => {
  await addDoc(collection(db, 'osn_announcements'), data);
};

export const updateOsnAnnouncement = async (id: string, data: Partial<OsnAnnouncement>) => {
  await updateDoc(doc(db, 'osn_announcements', id), data);
};

export const deleteOsnAnnouncement = async (id: string) => {
  await deleteDoc(doc(db, 'osn_announcements', id));
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
