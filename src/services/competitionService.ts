import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Competition, Registration, RegistrationStatus, CompetitionRound } from '../types';

export const createCompetition = async (id: string, data: Omit<Competition, 'id'>) => {
  await setDoc(doc(db, 'competitions', id), data);
};

export const updateCompetition = async (id: string, data: Partial<Competition>) => {
  await updateDoc(doc(db, 'competitions', id), data);
};

export const deleteCompetition = async (id: string) => {
  await deleteDoc(doc(db, 'competitions', id));
};

export const getCompetitionById = async (id: string): Promise<Competition | null> => {
  const docRef = doc(db, 'competitions', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Competition;
  }
  return null;
};

export const getAllCompetitions = async (): Promise<Competition[]> => {
  const q = query(collection(db, 'competitions'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Competition);
};

export const getStudentRegistrations = async (studentId: string): Promise<Registration[]> => {
  const q = query(collection(db, 'registrations'), where('studentId', '==', studentId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Registration);
};

export const getRegistrationsByCompetition = async (competitionId: string): Promise<Registration[]> => {
  const q = query(collection(db, 'registrations'), where('competitionId', '==', competitionId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Registration);
};

export const getAllRegistrations = async (): Promise<Registration[]> => {
  const q = query(collection(db, 'registrations'));
  const querySnapshot = await getDocs(q);
  const registrations = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Registration);
  return registrations.sort((a, b) => b.createdAt - a.createdAt);
};

export const updateRegistration = async (registrationId: string, data: Partial<Registration>) => {
  await updateDoc(doc(db, 'registrations', registrationId), data);
};

export const updateRegistrationStatus = async (registrationId: string, status: RegistrationStatus) => {
  await updateDoc(doc(db, 'registrations', registrationId), {
    status,
    updatedAt: Date.now()
  });
};

/**
 * Checks if applying to `targetCompetition` conflicts with the given user's approved/pending registrations.
 */
export const checkScheduleConflict = async (studentId: string, targetCompetition: Competition): Promise<string | null> => {
  // 1. Fetch user's existing registrations
  const registrations = await getStudentRegistrations(studentId);
  const activeRegistrations = registrations.filter(r => r.status === RegistrationStatus.PENDING || r.status === RegistrationStatus.APPROVED);
  
  if (activeRegistrations.length === 0) return null; // No active registrations, no conflict

  // 2. Fetch all competitions to get the dates for active registrations
  const allCompetitions = await getAllCompetitions();
  const compsMap = new Map(allCompetitions.map(c => [c.id, c]));

  // 3. For each round in the target competition, check if it overlaps with any round in active registrations.
  // We assume a conflict if the dates (just taking timestamp to YYYY-MM-DD string roughly) are the same.
  // Since timestamps might have times, we can just compare the start of the day.
  const toDateString = (ts: number) => new Date(ts).toDateString();
  
  const targetDates = new Set(targetCompetition.rounds.map(r => toDateString(r.date)));

  for (const reg of activeRegistrations) {
    const existingComp = compsMap.get(reg.competitionId);
    if (!existingComp) continue;

    for (const round of existingComp.rounds) {
      if (targetDates.has(toDateString(round.date))) {
        return existingComp.title; // Conflict found! Return the name of the conflicting competition
      }
    }
  }

  return null; // No conflict
};

export const applyForCompetition = async (registrationId: string, data: Omit<Registration, 'id'>) => {
  await setDoc(doc(db, 'registrations', registrationId), data);
};
