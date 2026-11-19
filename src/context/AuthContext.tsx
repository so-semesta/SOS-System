import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  AdminRequest,
  AuthGateStatus,
  AuthMode,
  AuthRoleIntent,
  UserProfile,
  UserRole,
  isAdminRole,
} from '../types/auth';
import { ParentLink, ParentRelationship } from '../types';
import {
  bindParentLoginToLink,
  findParentLinkByEmail,
  formatParentAccountName,
  submitParentRegistration,
} from '../services/parentService';
import { getAdminRequestsForUser, submitAdminRequest } from '../services/adminRequestService';
import { toast } from 'sonner';

const MASTER_ADMIN_EMAIL = 'scienceolympiad@semesta.sch.id';
const SOS_AUTH_INTENT_KEY = 'sos_auth_intent';
const SOS_AUTH_MODE_KEY = 'sos_auth_mode';

export interface LoginRoleOptions {
  requestedAdminRole?: UserRole.ADMIN | UserRole.ADMIN_SOS | UserRole.ADMIN_STUDENT;
  notes?: string;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  userRole: UserRole | null;
  loading: boolean;
  authGateStatus: AuthGateStatus;
  pendingParentLink: ParentLink | null;
  pendingAdminRequest: AdminRequest | null;
  loginWithGoogle: () => Promise<void>;
  loginWithRole: (mode: AuthMode, roleIntent: AuthRoleIntent, options?: LoginRoleOptions) => Promise<void>;
  submitPendingParentRegistration: (input: {
    relationship: ParentRelationship;
    phoneWa: string;
    studentId: string;
    studentName: string;
  }) => Promise<ParentLink>;
  submitPendingAdminRegistration: (input: {
    requestedRole: UserRole.ADMIN | UserRole.ADMIN_SOS | UserRole.ADMIN_STUDENT;
    notes?: string;
  }) => Promise<AdminRequest>;
  refreshAuthStatus: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  userRole: null,
  loading: true,
  authGateStatus: 'UNAUTHENTICATED',
  pendingParentLink: null,
  pendingAdminRequest: null,
  loginWithGoogle: async () => {},
  loginWithRole: async () => {},
  submitPendingParentRegistration: async () => {
    throw new Error('AuthProvider not mounted');
  },
  submitPendingAdminRegistration: async () => {
    throw new Error('AuthProvider not mounted');
  },
  refreshAuthStatus: async () => {},
  logout: async () => {},
});

function readStoredIntent(): AuthRoleIntent | null {
  try {
    const val = sessionStorage.getItem(SOS_AUTH_INTENT_KEY);
    if (val === 'STUDENT' || val === 'PARENT' || val === 'ADMIN') return val;
  } catch {
    // ignore storage restriction
  }
  return null;
}

function readStoredMode(): AuthMode {
  try {
    const val = sessionStorage.getItem(SOS_AUTH_MODE_KEY);
    if (val === 'LOGIN' || val === 'REGISTER') return val;
  } catch {
    // ignore storage restriction
  }
  return 'LOGIN';
}

function writeStoredAuthMeta(intent: AuthRoleIntent, mode: AuthMode) {
  try {
    sessionStorage.setItem(SOS_AUTH_INTENT_KEY, intent);
    sessionStorage.setItem(SOS_AUTH_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

function clearStoredAuthMeta() {
  try {
    sessionStorage.removeItem(SOS_AUTH_INTENT_KEY);
    sessionStorage.removeItem(SOS_AUTH_MODE_KEY);
  } catch {
    // ignore
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authGateStatus, setAuthGateStatus] = useState<AuthGateStatus>('UNAUTHENTICATED');
  const [pendingParentLink, setPendingParentLink] = useState<ParentLink | null>(null);
  const [pendingAdminRequest, setPendingAdminRequest] = useState<AdminRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const inflightUidRef = useRef<string | null>(null);
  const inflightPromiseRef = useRef<Promise<void> | null>(null);
  const pendingAdminOptionsRef = useRef<LoginRoleOptions | null>(null);

  const resetAuthState = useCallback(() => {
    setCurrentUser(null);
    setUserProfile(null);
    setPendingParentLink(null);
    setPendingAdminRequest(null);
    setAuthGateStatus('UNAUTHENTICATED');
  }, []);

  const resolveUserSession = async (
    user: User,
    explicitMode?: AuthMode,
    explicitRoleIntent?: AuthRoleIntent,
    explicitOptions?: LoginRoleOptions | null
  ): Promise<void> => {
    const email = (user.email || '').trim().toLowerCase();
    const isSemestaEmail = email.endsWith('@semesta.sch.id');
    const isMasterEmail = email === MASTER_ADMIN_EMAIL;

    const storedIntent = readStoredIntent();
    const effectiveRoleIntent: AuthRoleIntent =
      explicitRoleIntent || storedIntent || (isSemestaEmail ? 'STUDENT' : 'PARENT');
    const effectiveMode: AuthMode = explicitMode || readStoredMode();
    const effectiveOptions = explicitOptions ?? pendingAdminOptionsRef.current;

    // 1. PARENT FLOW (Non-@semesta.sch.id ONLY)
    if (effectiveRoleIntent === 'PARENT') {
      if (isSemestaEmail) {
        await firebaseSignOut(auth);
        clearStoredAuthMeta();
        resetAuthState();
        toast.error(
          'Akun Orang Tua wajib memakai email Google pribadi (mis. @gmail.com). Untuk Siswa/Admin silakan pilih tab Siswa atau Admin.'
        );
        return;
      }

      try {
        const link = await findParentLinkByEmail(email);

        if (!link) {
          setCurrentUser(user);
          setUserProfile(null);
          setPendingParentLink(null);
          setPendingAdminRequest(null);
          setAuthGateStatus('PARENT_NEEDS_REGISTRATION');
          return;
        }

        if (link.approvalStatus === 'PENDING') {
          setCurrentUser(user);
          setUserProfile(null);
          setPendingParentLink(link);
          setPendingAdminRequest(null);
          setAuthGateStatus('PARENT_PENDING');
          return;
        }

        if (link.approvalStatus === 'REJECTED' || !link.isActive) {
          setCurrentUser(user);
          setUserProfile(null);
          setPendingParentLink(link);
          setPendingAdminRequest(null);
          setAuthGateStatus('PARENT_REJECTED');
          return;
        }

        // APPROVED & Active 1-to-1 Parent Link
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        const now = Date.now();
        const canonicalName = formatParentAccountName(link.studentName);
        const studentIds = [link.studentId];
        const studentNames = [link.studentName];

        if (docSnap.exists()) {
          const existing = docSnap.data() as UserProfile;
          if (existing.isBlocked) {
            await firebaseSignOut(auth);
            clearStoredAuthMeta();
            resetAuthState();
            toast.error('Akun Anda telah diblokir. Silakan hubungi administrator.');
            return;
          }

          const syncedProfile: UserProfile = {
            ...existing,
            uid: user.uid,
            email,
            role: UserRole.PARENT,
            name: canonicalName,
            linkedStudentIds: studentIds,
            linkedStudentNames: studentNames,
            relationship: link.relationship,
            activeParentLinkId: link.id,
            updatedAt: now,
          };

          const needsSync =
            existing.role !== UserRole.PARENT ||
            existing.activeParentLinkId !== link.id ||
            existing.name !== canonicalName ||
            existing.relationship !== link.relationship ||
            JSON.stringify(existing.linkedStudentIds || []) !== JSON.stringify(studentIds) ||
            JSON.stringify(existing.linkedStudentNames || []) !== JSON.stringify(studentNames);

          if (needsSync) {
            await updateDoc(docRef, {
              email,
              name: canonicalName,
              role: UserRole.PARENT,
              linkedStudentIds: studentIds,
              linkedStudentNames: studentNames,
              relationship: link.relationship,
              activeParentLinkId: link.id,
              updatedAt: now,
            });
          }

          setCurrentUser(user);
          setUserProfile(syncedProfile);
        } else {
          const newParentProfile: UserProfile = {
            uid: user.uid,
            email,
            role: UserRole.PARENT,
            name: canonicalName,
            isBlocked: false,
            linkedStudentIds: studentIds,
            linkedStudentNames: studentNames,
            relationship: link.relationship,
            activeParentLinkId: link.id,
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(docRef, newParentProfile);
          setCurrentUser(user);
          setUserProfile(newParentProfile);
        }

        setPendingParentLink(link);
        setPendingAdminRequest(null);
        setAuthGateStatus('AUTHENTICATED');

        bindParentLoginToLink(link.id, user.uid).catch((err) => {
          console.warn('Could not bind parentUid to parentLinks:', err);
        });
      } catch (error) {
        console.error('Error verifying parent account:', error);
        await firebaseSignOut(auth);
        clearStoredAuthMeta();
        resetAuthState();
        toast.error('Gagal memverifikasi akun Orang Tua. Silakan coba lagi.');
      }
      return;
    }

    // 2. Non-semesta email rejected for Student & Admin
    if (!isSemestaEmail) {
      await firebaseSignOut(auth);
      clearStoredAuthMeta();
      resetAuthState();
      toast.error('Akun Siswa dan Admin wajib menggunakan email @semesta.sch.id. Untuk Orang Tua silakan pilih tab Orang Tua.');
      return;
    }

    // 3. ADMIN & MANAGEMENT FLOW
    if (effectiveRoleIntent === 'ADMIN') {
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          if (data.isBlocked) {
            await firebaseSignOut(auth);
            clearStoredAuthMeta();
            resetAuthState();
            toast.error('Akun Anda telah diblokir. Silakan hubungi administrator.');
            return;
          }

          if (isMasterEmail && data.role !== UserRole.MANAGEMENT) {
            data.role = UserRole.MANAGEMENT;
            await setDoc(
              docRef,
              {
                uid: user.uid,
                email,
                name: data.name || user.displayName || 'Management',
                role: UserRole.MANAGEMENT,
                updatedAt: Date.now(),
                createdAt: data.createdAt || Date.now(),
              },
              { merge: true }
            ).catch(() => {});
          }

          if (isMasterEmail || isAdminRole(data.role)) {
            setCurrentUser(user);
            setUserProfile(data);
            setPendingParentLink(null);
            setPendingAdminRequest(null);
            setAuthGateStatus('AUTHENTICATED');
            return;
          }
        } else if (isMasterEmail) {
          const masterProfile: UserProfile = {
            uid: user.uid,
            email,
            role: UserRole.MANAGEMENT,
            name: user.displayName || 'Management',
            isBlocked: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await setDoc(docRef, masterProfile);
          setCurrentUser(user);
          setUserProfile(masterProfile);
          setPendingParentLink(null);
          setPendingAdminRequest(null);
          setAuthGateStatus('AUTHENTICATED');
          return;
        }

        // Not yet an approved Admin/Management -> inspect adminRequests
        const requests = await getAdminRequestsForUser(user.uid);
        const latestReq = requests[0] || null;

        if (latestReq?.status === 'PENDING') {
          setCurrentUser(user);
          setUserProfile(null);
          setPendingParentLink(null);
          setPendingAdminRequest(latestReq);
          setAuthGateStatus('ADMIN_PENDING');
          return;
        }

        if (effectiveMode === 'REGISTER' && effectiveOptions?.requestedAdminRole) {
          const createdReq = await submitAdminRequest({
            uid: user.uid,
            email,
            name: user.displayName || email.split('@')[0] || 'Admin',
            requestedRole: effectiveOptions.requestedAdminRole,
            notes: effectiveOptions.notes,
          });
          pendingAdminOptionsRef.current = null;
          setCurrentUser(user);
          setUserProfile(null);
          setPendingParentLink(null);
          setPendingAdminRequest(createdReq);
          setAuthGateStatus('ADMIN_PENDING');
          return;
        }

        if (latestReq?.status === 'REJECTED' && effectiveMode === 'LOGIN') {
          setCurrentUser(user);
          setUserProfile(null);
          setPendingParentLink(null);
          setPendingAdminRequest(latestReq);
          setAuthGateStatus('ADMIN_REJECTED');
          return;
        }

        // Either REGISTER without role selected yet, or LOGIN before registering as Admin
        setCurrentUser(user);
        setUserProfile(null);
        setPendingParentLink(null);
        setPendingAdminRequest(latestReq);
        setAuthGateStatus('ADMIN_NEEDS_REGISTRATION');
      } catch (error) {
        console.error('Error verifying admin session:', error);
        await firebaseSignOut(auth);
        clearStoredAuthMeta();
        resetAuthState();
        toast.error('Gagal memverifikasi akses Admin. Silakan coba lagi.');
      }
      return;
    }

    // 4. STUDENT / SOS FLOW (@semesta.sch.id)
    setCurrentUser(user);
    setPendingParentLink(null);
    setPendingAdminRequest(null);
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile & { isNewStudent?: boolean };
        if (data.isBlocked) {
          await firebaseSignOut(auth);
          clearStoredAuthMeta();
          resetAuthState();
          toast.error('Akun Anda telah diblokir. Silakan hubungi administrator.');
          return;
        }

        if (isMasterEmail && data.role !== UserRole.MANAGEMENT) {
          data.role = UserRole.MANAGEMENT;
          try {
            await setDoc(
              docRef,
              {
                uid: user.uid,
                email,
                name: data.name || user.displayName || 'Management',
                role: UserRole.MANAGEMENT,
                updatedAt: Date.now(),
                createdAt: data.createdAt || Date.now(),
              },
              { merge: true }
            );
          } catch (e) {
            console.error('Failed to auto-upgrade to management:', e);
          }
        }

        setUserProfile(data);
        setAuthGateStatus('AUTHENTICATED');
      } else {
        const newUserProfile: UserProfile = {
          uid: user.uid,
          email,
          role: isMasterEmail ? UserRole.MANAGEMENT : UserRole.STUDENT,
          name: user.displayName || (isMasterEmail ? 'Management' : 'Student'),
          isBlocked: false,
          isNewStudent: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await setDoc(docRef, newUserProfile);
        setUserProfile(newUserProfile);
        setAuthGateStatus('AUTHENTICATED');
      }
    } catch (error) {
      console.warn('Could not fetch user profile from Firestore, using session fallback:', error);
      setUserProfile({
        uid: user.uid,
        email,
        role: isMasterEmail ? UserRole.MANAGEMENT : UserRole.STUDENT,
        name: user.displayName || (isMasterEmail ? 'Management' : 'Student'),
        isBlocked: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setAuthGateStatus('AUTHENTICATED');
    }
  };

  const runResolution = async (
    user: User,
    explicitMode?: AuthMode,
    explicitRoleIntent?: AuthRoleIntent,
    explicitOptions?: LoginRoleOptions | null
  ): Promise<void> => {
    if (inflightUidRef.current === user.uid && inflightPromiseRef.current) {
      await inflightPromiseRef.current;
      return;
    }
    inflightUidRef.current = user.uid;
    const promise = resolveUserSession(user, explicitMode, explicitRoleIntent, explicitOptions).finally(() => {
      if (inflightUidRef.current === user.uid) {
        inflightUidRef.current = null;
        inflightPromiseRef.current = null;
      }
    });
    inflightPromiseRef.current = promise;
    await promise;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await runResolution(user);
      } else {
        resetAuthState();
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [resetAuthState]);

  const loginWithRole = async (
    mode: AuthMode,
    roleIntent: AuthRoleIntent,
    options?: LoginRoleOptions
  ) => {
    writeStoredAuthMeta(roleIntent, mode);
    pendingAdminOptionsRef.current = options || null;

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(auth, provider);
      await runResolution(result.user, mode, roleIntent, options || null);
    } catch (error: any) {
      pendingAdminOptionsRef.current = null;
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        return;
      }
      console.error('Error logging in with Google:', error);
      toast.error('Gagal login dengan Google.');
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    await loginWithRole('LOGIN', 'STUDENT');
  };

  const submitPendingParentRegistration = async (input: {
    relationship: ParentRelationship;
    phoneWa: string;
    studentId: string;
    studentName: string;
  }): Promise<ParentLink> => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('Sesi Google Anda belum terhubung. Silakan login kembali.');
    }
    const created = await submitParentRegistration({
      uid: auth.currentUser.uid,
      parentEmail: auth.currentUser.email,
      relationship: input.relationship,
      phoneWa: input.phoneWa,
      studentId: input.studentId,
      studentName: input.studentName,
    });
    setPendingParentLink(created);
    setAuthGateStatus('PARENT_PENDING');
    return created;
  };

  const submitPendingAdminRegistration = async (input: {
    requestedRole: UserRole.ADMIN | UserRole.ADMIN_SOS | UserRole.ADMIN_STUDENT;
    notes?: string;
  }): Promise<AdminRequest> => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('Sesi Google Anda belum terhubung. Silakan login kembali.');
    }
    const created = await submitAdminRequest({
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      name: auth.currentUser.displayName || auth.currentUser.email.split('@')[0] || 'Admin',
      requestedRole: input.requestedRole,
      notes: input.notes,
    });
    setPendingAdminRequest(created);
    setAuthGateStatus('ADMIN_PENDING');
    return created;
  };

  const refreshAuthStatus = async () => {
    if (!auth.currentUser) return;
    await runResolution(auth.currentUser);
  };

  const logout = async () => {
    clearStoredAuthMeta();
    pendingAdminOptionsRef.current = null;
    await firebaseSignOut(auth);
    resetAuthState();
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        userRole: authGateStatus === 'AUTHENTICATED' ? userProfile?.role || null : null,
        loading,
        authGateStatus,
        pendingParentLink,
        pendingAdminRequest,
        loginWithGoogle,
        loginWithRole,
        submitPendingParentRegistration,
        submitPendingAdminRegistration,
        refreshAuthStatus,
        logout,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
