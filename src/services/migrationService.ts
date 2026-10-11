import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserRole } from '../types/auth';

/**
 * Migrates existing users with role 'STUDENT' to 'SOS'
 * as requested: "Semua yang Role Students saat ini ubah ke Role SOS".
 */
export async function migrateExistingStudentsToSos(): Promise<{ migratedCount: number }> {
  try {
    // Only attempt if user is signed in
    if (!auth.currentUser) {
      return { migratedCount: 0 };
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'STUDENT'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { migratedCount: 0 };
    }

    const batch = writeBatch(db);
    let count = 0;

    snapshot.docs.forEach((userDoc) => {
      const data = userDoc.data();
      // Skip master email if it somehow had student
      const isMasterEmail = data.email?.trim().toLowerCase() === 'scienceolympiad@semesta.sch.id';
      if (!isMasterEmail) {
        batch.update(doc(db, 'users', userDoc.id), {
          role: UserRole.SOS,
          migratedToSosAt: Date.now(),
          updatedAt: Date.now(),
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Successfully migrated ${count} students to role SOS.`);
    }

    return { migratedCount: count };
  } catch (error: any) {
    // If the logged-in user lacks admin privileges to list/batch-update all users, return silently
    if (error?.code === 'permission-denied') {
      return { migratedCount: 0 };
    }
    console.error('Error migrating students to SOS:', error);
    return { migratedCount: 0 };
  }
}
