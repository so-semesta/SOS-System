export enum UserRole {
  SOS = 'SOS',
  STUDENT = 'STUDENT',
  ADMIN_SOS = 'ADMIN_SOS',
  ADMIN_STUDENT = 'ADMIN_STUDENT',
  ADMIN = 'ADMIN',
  MANAGEMENT = 'MANAGEMENT',
  PARENT = 'PARENT',
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  isBlocked?: boolean;
  linkedStudentIds?: string[];
  linkedStudentNames?: string[];
  relationship?: 'Ayah' | 'Ibu' | 'Wali';
  activeParentLinkId?: string;
  createdAt?: number;
  updatedAt?: number;
}

export const isStudentRole = (role?: UserRole | string | null): boolean =>
  role === UserRole.SOS || role === UserRole.STUDENT;

export const isAdminRole = (role?: UserRole | string | null): boolean =>
  role === UserRole.ADMIN ||
  role === UserRole.ADMIN_SOS ||
  role === UserRole.ADMIN_STUDENT ||
  role === UserRole.MANAGEMENT;

export const isManagementRole = (role?: UserRole | string | null): boolean =>
  role === UserRole.MANAGEMENT;

export const isParentRole = (role?: UserRole | string | null): boolean =>
  role === UserRole.PARENT || role === 'parent';

export type AuthMode = 'LOGIN' | 'REGISTER';
export type AuthRoleIntent = 'STUDENT' | 'PARENT' | 'ADMIN';
export type AuthGateStatus =
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED'
  | 'PARENT_NEEDS_REGISTRATION'
  | 'PARENT_PENDING'
  | 'PARENT_REJECTED'
  | 'ADMIN_PENDING'
  | 'ADMIN_REJECTED'
  | 'ADMIN_NEEDS_REGISTRATION';

export type AdminRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminRequest {
  id: string;
  uid: string;
  email: string;
  name: string;
  requestedRole: UserRole.ADMIN | UserRole.ADMIN_SOS | UserRole.ADMIN_STUDENT;
  notes?: string;
  status: AdminRequestStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  rejectionReason?: string;
  createdAt: number;
  updatedAt: number;
}

