export enum UserRole {
  SOS = 'SOS',
  STUDENT = 'STUDENT',
  ADMIN_SOS = 'ADMIN_SOS',
  ADMIN_STUDENT = 'ADMIN_STUDENT',
  ADMIN = 'ADMIN',
  MANAGEMENT = 'MANAGEMENT',
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  isBlocked?: boolean;
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

