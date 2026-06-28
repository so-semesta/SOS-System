export enum UserRole {
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN',
  MANAGEMENT = 'MANAGEMENT',
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  isBlocked?: boolean;
}
