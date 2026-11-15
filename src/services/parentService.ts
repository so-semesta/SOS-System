import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  Achievement,
  Competition,
  ParentApprovalStatus,
  ParentLink,
  ParentRelationship,
  Registration,
  Student,
  StudentParentClaim,
} from '../types';
import { UserRole } from '../types/auth';
import { getFriendlyDisplayName, isRawId, removeUndefined } from '../lib/utils';
import { getStudentProfile } from './studentService';
import { getAllCompetitions, getStudentRegistrations } from './competitionService';
import { getStudentAchievements } from './achievementService';
import {
  DevicePermitLetter,
  DevicePermitStudent,
  findPermitForStudent,
  getAllDevicePermits,
  getDevicePermitLetters,
} from './devicePermitService';

export const SOS_COORDINATORS = [
  {
    id: 'sma-putra',
    label: 'Koordinator SMA Putra',
    name: 'Mr Ghozi',
    phone: '6285729660235',
  },
  {
    id: 'sma-putri',
    label: 'Koordinator SMA Putri',
    name: 'Miss Frehni',
    phone: '6281336869545',
  },
  {
    id: 'smp',
    label: 'Koordinator SMP',
    name: 'Miss Fitroh',
    phone: '6281391715837',
  },
] as const;

export function buildCoordinatorWaUrl(
  phone: string,
  coordinatorName: string,
  studentName: string,
  parentEmail: string,
  relationship: ParentRelationship = 'Wali'
): string {
  const hour = new Date().getHours();
  const greeting =
    hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
  const msg = `Assalamualaikum / Selamat ${greeting} ${coordinatorName},\nSaya orang tua/wali (${relationship}) dari siswa *${studentName}* telah mendaftar Akun Orang Tua (Parent ${studentName}) dengan email *${parentEmail}*.\nMohon berkenan untuk ACC pendaftaran akun tersebut di sistem SOS. Terima kasih.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(error instanceof Error ? error.message : JSON.stringify(errInfo));
}

export interface LinkableStudentOption {
  userId: string;
  fullName: string;
  grade: string;
  osnField: string;
  nisn: string;
  email: string;
  role: string;
}

export interface ParentGuidanceSummary {
  id: string;
  date: number;
  academicSubject: string;
  studyProgress: string;
  questionsCompleted?: number;
  summaryPages?: number;
  studyHours?: number;
  createdAt: number;
}

export interface ParentChildBundle {
  studentId: string;
  displayName: string;
  student: Student | null;
  permit: DevicePermitStudent | null;
  permitLetter: DevicePermitLetter | null;
  registrations: Registration[];
  competitionsMap: Record<string, Competition>;
  achievements: Achievement[];
  guidanceSummaries: ParentGuidanceSummary[];
}

export function normalizeParentEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 256);
}

export function formatParentAccountName(studentName: string): string {
  const clean = studentName.trim().replace(/^Parent\s+/i, '');
  return `Parent ${clean || 'Siswa'}`.slice(0, 150);
}

function buildValidLinkId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `plink_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function getClaimedStudentIdsMap(): Promise<Record<string, StudentParentClaim>> {
  try {
    const snap = await getDocs(collection(db, 'studentParentClaims'));
    const map: Record<string, StudentParentClaim> = {};
    snap.docs.forEach((d) => {
      const data = d.data() as StudentParentClaim;
      map[d.id] = {
        studentId: data.studentId || d.id,
        linkId: data.linkId,
        status: data.status,
        updatedAt: data.updatedAt || 0,
      };
    });
    return map;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'studentParentClaims');
  }
}

/**
 * Used by Admin/Management (has read access to both `users` and `students`)
 */
export async function getAvailableStudentsForLinking(): Promise<LinkableStudentOption[]> {
  try {
    const [usersSnap, studentsSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'users'),
          where('role', 'in', [UserRole.SOS, UserRole.STUDENT, 'sos', 'student'])
        )
      ),
      getDocs(collection(db, 'students')),
    ]);

    const studentProfilesByUid = new Map<string, Student>();
    studentsSnap.docs.forEach((d) => {
      const data = { id: d.id, ...(d.data() as Omit<Student, 'id'>) } as Student;
      const uid = data.userId || d.id;
      const existing = studentProfilesByUid.get(uid);
      if (!existing || (data.updatedAt || 0) >= (existing.updatedAt || 0)) {
        studentProfilesByUid.set(uid, data);
      }
    });

    const merged = new Map<string, LinkableStudentOption>();

    usersSnap.docs.forEach((d) => {
      const uData = d.data() as any;
      const profile = studentProfilesByUid.get(d.id);
      const rawName = profile?.fullName || uData.name || uData.displayName || '';
      const fullName = getFriendlyDisplayName(rawName, uData.email, '');
      if (!fullName || isRawId(fullName)) return;

      merged.set(d.id, {
        userId: d.id,
        fullName,
        grade: profile?.grade || '',
        osnField: profile?.osnField || '',
        nisn: profile?.nisn || '',
        email: uData.email || profile?.semestaEmail || profile?.activeEmail || '',
        role: uData.role || UserRole.SOS,
      });
    });

    studentProfilesByUid.forEach((profile, uid) => {
      if (!merged.has(uid) && profile.fullName && !isRawId(profile.fullName)) {
        merged.set(uid, {
          userId: uid,
          fullName: profile.fullName,
          grade: profile.grade || '',
          osnField: profile.osnField || '',
          nisn: profile.nisn || '',
          email: profile.semestaEmail || profile.activeEmail || '',
          role: UserRole.SOS,
        });
      }
    });

    return Array.from(merged.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'students');
  }
}

/**
 * Used during Parent self-registration (non-admin Gmail user).
 * Reads ONLY `students` and `studentParentClaims` (zero PII from `users`).
 */
export async function getUnclaimedStudentsForParentRegistration(): Promise<LinkableStudentOption[]> {
  try {
    const [studentsSnap, claimsMap] = await Promise.all([
      getDocs(collection(db, 'students')),
      getClaimedStudentIdsMap(),
    ]);

    const byUid = new Map<string, LinkableStudentOption>();
    studentsSnap.docs.forEach((d) => {
      const data = d.data() as Partial<Student>;
      const uid = (data.userId || d.id).trim();
      const fullName = (data.fullName || '').trim();
      if (!uid || !fullName || isRawId(fullName)) return;

      const claim = claimsMap[uid];
      if (claim && (claim.status === 'PENDING' || claim.status === 'APPROVED')) {
        return; // Already claimed by another parent
      }

      if (!byUid.has(uid)) {
        byUid.set(uid, {
          userId: uid,
          fullName,
          grade: data.grade || '',
          osnField: data.osnField || '',
          nisn: data.nisn || '',
          email: '',
          role: UserRole.SOS,
        });
      }
    });

    return Array.from(byUid.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'students');
  }
}

function normalizeParentLinkDoc(id: string, raw: Record<string, any>): ParentLink {
  const studentIds: string[] = Array.isArray(raw.studentIds) && raw.studentIds.length > 0
    ? raw.studentIds
    : raw.studentId
    ? [raw.studentId]
    : [];
  const studentNames: string[] = Array.isArray(raw.studentNames) && raw.studentNames.length > 0
    ? raw.studentNames
    : raw.studentName
    ? [raw.studentName]
    : [];

  return {
    id,
    parentEmail: String(raw.parentEmail || ''),
    parentName: String(raw.parentName || formatParentAccountName(studentNames[0] || 'Siswa')),
    relationship: (raw.relationship as ParentRelationship) || 'Wali',
    phoneWa: raw.phoneWa,
    studentId: String(raw.studentId || studentIds[0] || ''),
    studentName: String(raw.studentName || studentNames[0] || 'Siswa SOS'),
    studentIds,
    studentNames,
    parentUid: raw.parentUid,
    approvalStatus: (raw.approvalStatus as ParentApprovalStatus) || 'APPROVED',
    isActive: Boolean(raw.isActive),
    approvedBy: raw.approvedBy,
    approvedAt: raw.approvedAt,
    rejectionReason: raw.rejectionReason,
    createdBy: String(raw.createdBy || ''),
    createdAt: Number(raw.createdAt || 0),
    updatedAt: Number(raw.updatedAt || 0),
    lastLoginAt: raw.lastLoginAt,
  };
}

export async function getAllParentLinks(): Promise<ParentLink[]> {
  try {
    const q = query(collection(db, 'parentLinks'), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => normalizeParentLinkDoc(d.id, d.data() as Record<string, any>));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'parentLinks');
  }
}

export async function findParentLinkByEmail(email: string): Promise<ParentLink | null> {
  const normalized = normalizeParentEmail(email);
  if (!normalized) return null;

  try {
    const q = query(collection(db, 'parentLinks'), where('parentEmail', '==', normalized));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const links = snapshot.docs.map((d) =>
      normalizeParentLinkDoc(d.id, d.data() as Record<string, any>)
    );
    links.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return links[0];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'parentLinks');
  }
}

export async function bindParentLoginToLink(linkId: string, uid: string): Promise<void> {
  try {
    const now = Date.now();
    await updateDoc(
      doc(db, 'parentLinks', linkId),
      removeUndefined({
        parentUid: uid.slice(0, 128),
        lastLoginAt: now,
        updatedAt: now,
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `parentLinks/${linkId}`);
  }
}

/**
 * Self-registration by Parent (authenticated via personal Gmail).
 * Creates a PENDING parentLink and a 1-to-1 studentParentClaim atomically.
 */
export async function submitParentRegistration(input: {
  uid: string;
  parentEmail: string;
  relationship: ParentRelationship;
  phoneWa: string;
  studentId: string;
  studentName: string;
}): Promise<ParentLink> {
  const normalizedEmail = normalizeParentEmail(input.parentEmail);
  const cleanPhone = input.phoneWa.trim().slice(0, 30);
  const cleanStudentId = input.studentId.trim();
  const cleanStudentName = input.studentName.trim().slice(0, 150);

  if (!normalizedEmail || !normalizedEmail.includes('@') || normalizedEmail.endsWith('@semesta.sch.id')) {
    throw new Error('Akun Orang Tua harus menggunakan email Google pribadi (mis. @gmail.com).');
  }
  if (!cleanStudentId || !cleanStudentName) {
    throw new Error('Pilih siswa putra/putri Anda terlebih dahulu.');
  }
  if (!cleanPhone) {
    throw new Error('Nomor WhatsApp orang tua wajib diisi untuk verifikasi.');
  }

  try {
    const existingByEmail = await findParentLinkByEmail(normalizedEmail);
    if (existingByEmail && existingByEmail.approvalStatus !== 'REJECTED') {
      throw new Error('Email ini sudah memiliki pendaftaran akun orang tua. Silakan cek status Anda.');
    }

    const claims = await getClaimedStudentIdsMap();
    const existingClaim = claims[cleanStudentId];
    if (existingClaim && (existingClaim.status === 'PENDING' || existingClaim.status === 'APPROVED')) {
      throw new Error('Siswa ini sudah tertaut dengan akun orang tua lain.');
    }

    const now = Date.now();
    const id = buildValidLinkId();
    const parentName = formatParentAccountName(cleanStudentName);

    const payload: ParentLink = {
      id,
      parentEmail: normalizedEmail,
      parentName,
      relationship: input.relationship,
      phoneWa: cleanPhone,
      studentId: cleanStudentId,
      studentName: cleanStudentName,
      studentIds: [cleanStudentId],
      studentNames: [cleanStudentName],
      parentUid: input.uid.slice(0, 128),
      approvalStatus: 'PENDING',
      isActive: false,
      createdBy: normalizedEmail,
      createdAt: now,
      updatedAt: now,
    };

    const claimPayload: StudentParentClaim = {
      studentId: cleanStudentId,
      linkId: id,
      status: 'PENDING',
      updatedAt: now,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'parentLinks', id), removeUndefined(payload));
    batch.set(doc(db, 'studentParentClaims', cleanStudentId), claimPayload);
    await batch.commit();

    return payload;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('sudah') ||
        error.message.includes('Pilih') ||
        error.message.includes('wajib') ||
        error.message.includes('harus'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, 'parentLinks');
  }
}

/**
 * Direct creation by Management / Admin (immediately APPROVED & Active).
 */
export async function createParentLink(input: {
  parentEmail: string;
  relationship: ParentRelationship;
  phoneWa?: string;
  studentId: string;
  studentName: string;
  createdBy: string;
}): Promise<ParentLink> {
  const normalizedEmail = normalizeParentEmail(input.parentEmail);
  const cleanPhone = input.phoneWa?.trim().slice(0, 30);
  const cleanStudentId = input.studentId.trim();
  const cleanStudentName = input.studentName.trim().slice(0, 150);

  if (!normalizedEmail || !normalizedEmail.includes('@') || normalizedEmail.endsWith('@semesta.sch.id')) {
    throw new Error('Email orang tua harus email Google pribadi (bukan @semesta.sch.id).');
  }
  if (!cleanStudentId || !cleanStudentName) {
    throw new Error('Pilih 1 siswa yang akan ditautkan.');
  }

  try {
    const existingByEmail = await findParentLinkByEmail(normalizedEmail);
    if (existingByEmail) {
      throw new Error('Email orang tua ini sudah terdaftar (1 orang tua = 1 siswa).');
    }

    const claims = await getClaimedStudentIdsMap();
    const existingClaim = claims[cleanStudentId];
    if (existingClaim && (existingClaim.status === 'PENDING' || existingClaim.status === 'APPROVED')) {
      throw new Error('Siswa ini sudah memiliki akun orang tua (1 siswa = 1 orang tua).');
    }

    const now = Date.now();
    const id = buildValidLinkId();
    const parentName = formatParentAccountName(cleanStudentName);
    const actor = (input.createdBy || auth.currentUser?.email || 'management').slice(0, 256);

    const payload: ParentLink = {
      id,
      parentEmail: normalizedEmail,
      parentName,
      relationship: input.relationship,
      ...(cleanPhone ? { phoneWa: cleanPhone } : {}),
      studentId: cleanStudentId,
      studentName: cleanStudentName,
      studentIds: [cleanStudentId],
      studentNames: [cleanStudentName],
      approvalStatus: 'APPROVED',
      isActive: true,
      approvedBy: actor,
      approvedAt: now,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };

    const claimPayload: StudentParentClaim = {
      studentId: cleanStudentId,
      linkId: id,
      status: 'APPROVED',
      updatedAt: now,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'parentLinks', id), removeUndefined(payload));
    batch.set(doc(db, 'studentParentClaims', cleanStudentId), claimPayload);
    await batch.commit();

    return payload;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('sudah') || error.message.includes('Pilih') || error.message.includes('harus'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, 'parentLinks');
  }
}

export async function updateParentLink(
  existingLink: ParentLink,
  updates: {
    parentEmail: string;
    relationship: ParentRelationship;
    phoneWa?: string;
    studentId: string;
    studentName: string;
    isActive: boolean;
  }
): Promise<void> {
  const normalizedEmail = normalizeParentEmail(updates.parentEmail);
  const cleanPhone = updates.phoneWa?.trim().slice(0, 30);
  const cleanStudentId = updates.studentId.trim();
  const cleanStudentName = updates.studentName.trim().slice(0, 150);

  if (!normalizedEmail || !normalizedEmail.includes('@') || normalizedEmail.endsWith('@semesta.sch.id')) {
    throw new Error('Email orang tua harus email Google pribadi (bukan @semesta.sch.id).');
  }
  if (!cleanStudentId || !cleanStudentName) {
    throw new Error('Pilih 1 siswa yang akan ditautkan.');
  }

  try {
    const now = Date.now();
    const parentName = formatParentAccountName(cleanStudentName);
    const batch = writeBatch(db);

    if (existingLink.studentId !== cleanStudentId) {
      const claims = await getClaimedStudentIdsMap();
      const targetClaim = claims[cleanStudentId];
      if (
        targetClaim &&
        targetClaim.linkId !== existingLink.id &&
        (targetClaim.status === 'PENDING' || targetClaim.status === 'APPROVED')
      ) {
        throw new Error('Siswa tujuan sudah tertaut dengan akun orang tua lain.');
      }
      if (existingLink.studentId) {
        batch.delete(doc(db, 'studentParentClaims', existingLink.studentId));
      }
    }

    batch.update(
      doc(db, 'parentLinks', existingLink.id),
      removeUndefined({
        parentEmail: normalizedEmail,
        parentName,
        relationship: updates.relationship,
        ...(cleanPhone ? { phoneWa: cleanPhone } : {}),
        studentId: cleanStudentId,
        studentName: cleanStudentName,
        studentIds: [cleanStudentId],
        studentNames: [cleanStudentName],
        isActive: updates.isActive,
        updatedAt: now,
      })
    );

    batch.set(doc(db, 'studentParentClaims', cleanStudentId), {
      studentId: cleanStudentId,
      linkId: existingLink.id,
      status: existingLink.approvalStatus,
      updatedAt: now,
    });

    await batch.commit();
  } catch (error) {
    if (error instanceof Error && (error.message.includes('sudah') || error.message.includes('Pilih') || error.message.includes('harus'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `parentLinks/${existingLink.id}`);
  }
}

export async function approveParentLink(link: ParentLink, approverEmail: string): Promise<void> {
  try {
    const now = Date.now();
    const batch = writeBatch(db);
    batch.update(
      doc(db, 'parentLinks', link.id),
      removeUndefined({
        approvalStatus: 'APPROVED',
        isActive: true,
        approvedBy: approverEmail.slice(0, 256),
        approvedAt: now,
        updatedAt: now,
      })
    );
    batch.set(doc(db, 'studentParentClaims', link.studentId), {
      studentId: link.studentId,
      linkId: link.id,
      status: 'APPROVED',
      updatedAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `parentLinks/${link.id}`);
  }
}

export async function rejectParentLink(
  link: ParentLink,
  reviewerEmail: string,
  reason: string = 'Ditolak oleh Management'
): Promise<void> {
  try {
    const now = Date.now();
    const batch = writeBatch(db);
    batch.update(
      doc(db, 'parentLinks', link.id),
      removeUndefined({
        approvalStatus: 'REJECTED',
        isActive: false,
        approvedBy: reviewerEmail.slice(0, 256),
        approvedAt: now,
        rejectionReason: reason.trim().slice(0, 500),
        updatedAt: now,
      })
    );
    batch.set(doc(db, 'studentParentClaims', link.studentId), {
      studentId: link.studentId,
      linkId: link.id,
      status: 'REJECTED',
      updatedAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `parentLinks/${link.id}`);
  }
}

export async function toggleParentLinkActive(linkId: string, isActive: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'parentLinks', linkId), {
      isActive,
      updatedAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `parentLinks/${linkId}`);
  }
}

export async function deleteParentLink(link: ParentLink): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'parentLinks', link.id));
    if (link.studentId) {
      batch.delete(doc(db, 'studentParentClaims', link.studentId));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `parentLinks/${link.id}`);
  }
}

async function getStudentGuidanceSummariesForParent(studentId: string): Promise<ParentGuidanceSummary[]> {
  try {
    const q = query(collection(db, 'guidanceLogs'), where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          date: Number(data.date || 0),
          academicSubject: String(data.academicSubject || '-'),
          studyProgress: String(data.studyProgress || '-'),
          questionsCompleted: typeof data.questionsCompleted === 'number' ? data.questionsCompleted : undefined,
          summaryPages: typeof data.summaryPages === 'number' ? data.summaryPages : undefined,
          studyHours: typeof data.studyHours === 'number' ? data.studyHours : undefined,
          createdAt: Number(data.createdAt || 0),
        } as ParentGuidanceSummary;
      })
      .sort((a, b) => b.date - a.date);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'guidanceLogs');
  }
}

export async function getParentPortalChildBundle(
  studentId: string,
  fallbackStudentName?: string
): Promise<ParentChildBundle> {
  const [student, allPermits, letters, registrations, competitions, achievements, guidanceSummaries] =
    await Promise.all([
      getStudentProfile(studentId).catch(() => null),
      getAllDevicePermits().catch(() => []),
      getDevicePermitLetters().catch(() => null),
      getStudentRegistrations(studentId).catch(() => []),
      getAllCompetitions().catch(() => []),
      getStudentAchievements(studentId).catch(() => []),
      getStudentGuidanceSummariesForParent(studentId).catch(() => []),
    ]);

  const displayName =
    student?.fullName || fallbackStudentName || 'Siswa Olimpiade Semesta';

  const permit =
    findPermitForStudent(
      student?.fullName || fallbackStudentName,
      student?.semestaEmail || student?.activeEmail,
      studentId,
      allPermits
    ) || null;

  const permitLetter = permit && letters ? letters[permit.unit] || null : null;

  const competitionsMap: Record<string, Competition> = {};
  competitions.forEach((c) => {
    competitionsMap[c.id] = c;
  });

  const sortedRegistrations = [...registrations].sort(
    (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
  );
  const sortedAchievements = [...achievements].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  return {
    studentId,
    displayName,
    student,
    permit,
    permitLetter,
    registrations: sortedRegistrations,
    competitionsMap,
    achievements: sortedAchievements,
    guidanceSummaries,
  };
}
