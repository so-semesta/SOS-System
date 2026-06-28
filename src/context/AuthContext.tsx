import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserRole, UserProfile } from '../types/auth';

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
      setCurrentUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            if (data.isBlocked) {
              await firebaseSignOut(auth);
              setUserProfile(null);
              setCurrentUser(null);
              // We could show a toast here if we had access to it, but standard alert works for a force logout
              alert('Akun Anda telah diblokir. Silakan hubungi administrator.');
            } else {
              setUserProfile(data);
            }
          } else {
            // Implicit login handling, just in case (e.g. page refresh)
            const newUserProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              role: user.email === 'scienceolympiad@semesta.sch.id' ? UserRole.ADMIN : UserRole.STUDENT,
              name: user.displayName || 'Student',
              isBlocked: false,
            };
            await setDoc(docRef, newUserProfile);
            setUserProfile(newUserProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
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
      
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        const newUserProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          role: user.email === 'scienceolympiad@semesta.sch.id' ? UserRole.ADMIN : UserRole.STUDENT,
          name: user.displayName || 'Student',
          isBlocked: false,
        };
        await setDoc(docRef, newUserProfile);
        setUserProfile(newUserProfile);
      }
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.log("Login popup cancelled by user.");
        return;
      }
      console.error("Error logging in with Google:", error);
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
