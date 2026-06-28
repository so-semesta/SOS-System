import { collection, doc, getDocs, setDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Achievement, CurationColor, MedalType } from '../types';

export const calculateAchievementPoints = (curationColor: CurationColor, medalType: MedalType): number => {
  const pointsMap = {
    [CurationColor.GREEN]: {
      [MedalType.GOLD]: 50,
      [MedalType.SILVER]: 40,
      [MedalType.BRONZE]: 30,
      [MedalType.FINALS]: 20,
      [MedalType.PARTICIPANT]: 10,
    },
    [CurationColor.YELLOW]: {
      [MedalType.GOLD]: 30,
      [MedalType.SILVER]: 25,
      [MedalType.BRONZE]: 20,
      [MedalType.FINALS]: 15,
      [MedalType.PARTICIPANT]: 10,
    },
    [CurationColor.ORANGE]: {
      [MedalType.GOLD]: 40,
      [MedalType.SILVER]: 30,
      [MedalType.BRONZE]: 20,
      [MedalType.FINALS]: 15,
      [MedalType.PARTICIPANT]: 10,
    },
    [CurationColor.RED]: {
      [MedalType.GOLD]: 0,
      [MedalType.SILVER]: 0,
      [MedalType.BRONZE]: 0,
      [MedalType.FINALS]: 0,
      [MedalType.PARTICIPANT]: 0,
    },
  };

  if (!curationColor || !pointsMap[curationColor]) {
    return 0;
  }

  return pointsMap[curationColor][medalType] || 0;
};

export const addAchievement = async (data: Omit<Achievement, 'id'>) => {
  const id = `ach_${Date.now()}`;
  await setDoc(doc(db, 'achievements', id), { ...data, id });
  return id;
};

export const getAllAchievements = async (): Promise<Achievement[]> => {
  const q = query(collection(db, 'achievements'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Achievement);
};

export const getStudentAchievements = async (studentId: string): Promise<Achievement[]> => {
  const q = query(collection(db, 'achievements')); // Can use a where clause if needed, but doing all for now depending on indexing
  const querySnapshot = await getDocs(q);
  const allAchievements = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Achievement);
  return allAchievements.filter(ach => ach.studentId === studentId);
};
