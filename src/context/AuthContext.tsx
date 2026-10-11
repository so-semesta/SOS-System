import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserRole, UserProfile } from '../types/auth';
import { migrateExistingStudentsToSos } from '../services/migrationService';
import { toast } from 'sonner';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  userRole: UserRole | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  userRole: null,
  loading: true,
  loginWithGoogle: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (!user.email?.endsWith('@semesta.sch.id')) {
          await firebaseSignOut(auth);
          setCurrentUser(null);
          setUserProfile(null);
          setLoading(false);
          toast.error('Sesi ditolak. Gunakan email @semesta.sch.id.');
          return;
        }

        setCurrentUser(user);
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile & { isNewStudent?: boolean };
            if (data.isBlocked) {
              await firebaseSignOut(auth);
              setUserProfile(null);
              setCurrentUser(null);
              toast.error('Akun Anda telah diblokir. Silakan hubungi administrator.');
            } else {
              // Auto-upgrade master email to MANAGEMENT (Superadmin)
              const isMasterEmail = user.email?.trim().toLowerCase() === 'scienceolympiad@semesta.sch.id';
              if (isMasterEmail && data.role !== UserRole.MANAGEMENT) {
                data.role = UserRole.MANAGEMENT;
                try {
                  await setDoc(docRef, { 
                    uid: user.uid,
                    email: user.email || '',
                    name: data.name || user.displayName || 'Management',
                    role: UserRole.MANAGEMENT, 
                    updatedAt: Date.now(),
                    createdAt: data.createdAt || Date.now()
                  }, { merge: true });
                } catch (e) {
                  console.error("Failed to auto-upgrade to management:", e);
                }
              }

              const isAdminUser = isMasterEmail || [UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.ADMIN_SOS].includes(data.role);
              if (isAdminUser) {
                // Safely trigger migration in background if admin
                migrateExistingStudentsToSos().catch(() => {});
              } else if (data.role === UserRole.STUDENT && !data.isNewStudent) {
                // Migrate existing student to SOS
                data.role = UserRole.SOS;
                try {
                  await updateDoc(docRef, {
                    role: UserRole.SOS,
                    migratedToSosAt: Date.now(),
                    updatedAt: Date.now()
                  });
                } catch (e) {
                  console.error("Failed to auto-migrate student to SOS:", e);
                }
              }
              setUserProfile(data);
            }
          } else {
            // Implicit login handling, just in case (e.g. page refresh)
            const isMasterEmail = user.email?.trim().toLowerCase() === 'scienceolympiad@semesta.sch.id';
            const newUserProfile: UserProfile & { isNewStudent?: boolean } = {
              uid: user.uid,
              email: user.email || '',
              role: isMasterEmail ? UserRole.MANAGEMENT : UserRole.STUDENT,
              name: user.displayName || (isMasterEmail ? 'Management' : 'Student'),
              isBlocked: false,
              isNewStudent: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await setDoc(docRef, newUserProfile);
            setUserProfile(newUserProfile);
          }
        } catch (error) {
          console.warn("Could not fetch user profile from Firestore, using session fallback:", error);
          const isMasterEmail = user.email?.trim().toLowerCase() === 'scienceolympiad@semesta.sch.id';
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            role: isMasterEmail ? UserRole.MANAGEMENT : UserRole.STUDENT,
            name: user.displayName || (isMasterEmail ? 'Management' : 'Student'),
            isBlocked: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email?.endsWith('@semesta.sch.id')) {
        await firebaseSignOut(auth);
        toast.error('Akses ditolak. Gunakan email @semesta.sch.id untuk login.');
        return;
      }
      
      const isMasterEmail = user.email?.trim().toLowerCase() === 'scienceolympiad@semesta.sch.id';
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        const newUserProfile: UserProfile & { isNewStudent?: boolean } = {
          uid: user.uid,
          email: user.email || '',
          role: isMasterEmail ? UserRole.MANAGEMENT : UserRole.STUDENT,
          name: user.displayName || (isMasterEmail ? 'Management' : 'Student'),
          isBlocked: false,
          isNewStudent: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await setDoc(docRef, newUserProfile);
        setUserProfile(newUserProfile);
      } else {
        const existingProfile = docSnap.data() as UserProfile & { isNewStudent?: boolean };
        if (existingProfile.isBlocked) {
          await firebaseSignOut(auth);
          toast.error('Akun Anda telah diblokir.');
          return;
        }
        
        // Auto-upgrade master email to MANAGEMENT if needed
        if (isMasterEmail && existingProfile.role !== UserRole.MANAGEMENT) {
          existingProfile.role = UserRole.MANAGEMENT;
          try {
            await setDoc(docRef, { 
              uid: user.uid,
              email: user.email || '',
              name: existingProfile.name || user.displayName || 'Management',
              role: UserRole.MANAGEMENT, 
              updatedAt: Date.now(),
              createdAt: existingProfile.createdAt || Date.now()
            }, { merge: true });
          } catch (e) {
            console.error("Failed to auto-upgrade to management:", e);
          }
        } else if (existingProfile.role === UserRole.STUDENT && !existingProfile.isNewStudent) {
          // Migrate existing student to SOS
          existingProfile.role = UserRole.SOS;
          try {
            await updateDoc(docRef, {
              role: UserRole.SOS,
              migratedToSosAt: Date.now(),
              updatedAt: Date.now()
            });
          } catch (e) {
            console.error("Failed to auto-migrate student to SOS:", e);
          }
        }
        
        setUserProfile(existingProfile);
      }
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.log("Login popup cancelled by user.");
        return;
      }
      console.error("Error logging in with Google:", error);
      toast.error('Gagal login dengan Google.');
      throw error;
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, userRole: userProfile?.role || null, loading, loginWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
