import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { CompetitionLevel, MedalType, StudentCvAchievement } from '../types';
import { removeUndefined } from '../lib/utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  console.error(
    'Firestore Error:',
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      operationType,
      path,
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    })
  );
  throw new Error(error instanceof Error ? error.message : 'Operasi database gagal.');
}

function buildCvAchievementId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `cvach_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function getStudentCvAchievements(studentId: string): Promise<StudentCvAchievement[]> {
  if (!studentId) return [];
  try {
    const q = query(
      collection(db, 'studentCvAchievements'),
      where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<StudentCvAchievement, 'id'>) }))
      .sort((a, b) => (b.year || 0) - (a.year || 0) || (b.createdAt || 0) - (a.createdAt || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'studentCvAchievements');
  }
}

export interface StudentCvAchievementInput {
  studentId: string;
  competitionTitle: string;
  organizer: string;
  field: string;
  level: CompetitionLevel;
  medalType: MedalType;
  customAchievementLabel?: string;
  year: number;
  eventDate?: string;
  certificateUrl?: string;
  notes?: string;
}

export async function createStudentCvAchievement(
  input: StudentCvAchievementInput
): Promise<StudentCvAchievement> {
  const now = Date.now();
  const id = buildCvAchievementId();

  const payload: StudentCvAchievement = {
    id,
    studentId: input.studentId.trim(),
    competitionTitle: input.competitionTitle.trim().slice(0, 256),
    organizer: input.organizer.trim().slice(0, 200),
    field: input.field.trim().slice(0, 150),
    level: input.level,
    medalType: input.medalType,
    ...(input.customAchievementLabel?.trim()
      ? { customAchievementLabel: input.customAchievementLabel.trim().slice(0, 150) }
      : {}),
    year: Number(input.year),
    ...(input.eventDate?.trim() ? { eventDate: input.eventDate.trim().slice(0, 32) } : {}),
    ...(input.certificateUrl?.trim()
      ? { certificateUrl: input.certificateUrl.trim().slice(0, 1000) }
      : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim().slice(0, 500) } : {}),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'studentCvAchievements', id), removeUndefined(payload));
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `studentCvAchievements/${id}`);
  }
}

export async function updateStudentCvAchievement(
  existing: StudentCvAchievement,
  updates: Omit<StudentCvAchievementInput, 'studentId'>
): Promise<StudentCvAchievement> {
  const now = Date.now();
  const payload: StudentCvAchievement = {
    id: existing.id,
    studentId: existing.studentId,
    competitionTitle: updates.competitionTitle.trim().slice(0, 256),
    organizer: updates.organizer.trim().slice(0, 200),
    field: updates.field.trim().slice(0, 150),
    level: updates.level,
    medalType: updates.medalType,
    customAchievementLabel: updates.customAchievementLabel?.trim()
      ? updates.customAchievementLabel.trim().slice(0, 150)
      : undefined,
    year: Number(updates.year),
    eventDate: updates.eventDate?.trim() ? updates.eventDate.trim().slice(0, 32) : undefined,
    certificateUrl: updates.certificateUrl?.trim()
      ? updates.certificateUrl.trim().slice(0, 1000)
      : undefined,
    notes: updates.notes?.trim() ? updates.notes.trim().slice(0, 500) : undefined,
    createdAt: existing.createdAt,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'studentCvAchievements', existing.id), removeUndefined(payload));
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `studentCvAchievements/${existing.id}`);
  }
}

export async function deleteStudentCvAchievement(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'studentCvAchievements', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `studentCvAchievements/${id}`);
  }
}
