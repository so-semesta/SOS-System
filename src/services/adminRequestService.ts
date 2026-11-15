import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AdminRequest, UserRole } from '../types/auth';
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
  throw new Error(error instanceof Error ? error.message : 'Firestore operation failed');
}

function buildAdminRequestId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `areq_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function getAdminRequestsForUser(uid: string): Promise<AdminRequest[]> {
  try {
    const q = query(collection(db, 'adminRequests'), where('uid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<AdminRequest, 'id'>) }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'adminRequests');
  }
}

export async function getAllAdminRequests(): Promise<AdminRequest[]> {
  try {
    const q = query(collection(db, 'adminRequests'), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminRequest, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'adminRequests');
  }
}

export async function submitAdminRequest(input: {
  uid: string;
  email: string;
  name: string;
  requestedRole: UserRole.ADMIN | UserRole.ADMIN_SOS | UserRole.ADMIN_STUDENT;
  notes?: string;
}): Promise<AdminRequest> {
  const email = input.email.trim().toLowerCase().slice(0, 256);
  const name = (input.name || email.split('@')[0] || 'Admin').trim().slice(0, 150);

  if (!email.endsWith('@semesta.sch.id')) {
    throw new Error('Pendaftaran Admin wajib menggunakan email @semesta.sch.id.');
  }

  try {
    const existingList = await getAdminRequestsForUser(input.uid);
    const activePending = existingList.find((r) => r.status === 'PENDING');
    if (activePending) {
      return activePending;
    }

    const now = Date.now();
    const id = buildAdminRequestId();
    const payload: AdminRequest = {
      id,
      uid: input.uid.slice(0, 128),
      email,
      name,
      requestedRole: input.requestedRole,
      ...(input.notes?.trim() ? { notes: input.notes.trim().slice(0, 500) } : {}),
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'adminRequests', id), removeUndefined(payload));
    await batch.commit();
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.includes('wajib')) throw error;
    handleFirestoreError(error, OperationType.CREATE, 'adminRequests');
  }
}

export async function approveAdminRequest(
  req: AdminRequest,
  finalRole: UserRole.ADMIN | UserRole.ADMIN_SOS | UserRole.ADMIN_STUDENT | UserRole.MANAGEMENT,
  reviewerEmail: string
): Promise<void> {
  try {
    const now = Date.now();
    const batch = writeBatch(db);

    batch.update(
      doc(db, 'adminRequests', req.id),
      removeUndefined({
        status: 'APPROVED',
        reviewedBy: reviewerEmail.slice(0, 256),
        reviewedAt: now,
        updatedAt: now,
      })
    );

    batch.set(
      doc(db, 'users', req.uid),
      removeUndefined({
        uid: req.uid,
        email: req.email,
        name: req.name,
        role: finalRole,
        isBlocked: false,
        updatedAt: now,
        createdAt: req.createdAt || now,
      }),
      { merge: true }
    );

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `adminRequests/${req.id}`);
  }
}

export async function rejectAdminRequest(
  requestId: string,
  reviewerEmail: string,
  reason: string = 'Ditolak oleh Management'
): Promise<void> {
  try {
    const now = Date.now();
    const batch = writeBatch(db);
    batch.update(
      doc(db, 'adminRequests', requestId),
      removeUndefined({
        status: 'REJECTED',
        reviewedBy: reviewerEmail.slice(0, 256),
        reviewedAt: now,
        rejectionReason: reason.trim().slice(0, 500),
        updatedAt: now,
      })
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `adminRequests/${requestId}`);
  }
}

export async function deleteAdminRequest(requestId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'adminRequests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `adminRequests/${requestId}`);
  }
}
