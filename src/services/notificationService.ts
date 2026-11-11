import { collection, doc, setDoc, getDocs, query, where, orderBy, limit, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { removeUndefined } from '../lib/utils';

export interface AppNotification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: 'REMINDER' | 'DEADLINE' | 'INFO' | 'WARNING';
  link?: string;
  isRead: boolean;
  createdAt: number;
}

export const sendNotification = async (
  recipientId: string,
  title: string,
  message: string,
  type: 'REMINDER' | 'DEADLINE' | 'INFO' | 'WARNING' = 'REMINDER',
  link?: string
) => {
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const notifData: AppNotification = {
    id: notifId,
    recipientId,
    title,
    message,
    type,
    link,
    isRead: false,
    createdAt: Date.now()
  };
  await setDoc(doc(db, 'notifications', notifId), removeUndefined(notifData));
  return notifId;
};

export const broadcastReminderToStudents = async (
  studentIds: string[],
  title: string,
  message: string,
  link?: string
): Promise<number> => {
  let count = 0;
  for (const sid of studentIds) {
    try {
      await sendNotification(sid, title, message, 'REMINDER', link);
      count++;
    } catch (e) {
      console.error(`Failed to send in-app notif to ${sid}:`, e);
    }
  }
  return count;
};

export const getStudentInAppNotifications = async (userId: string): Promise<AppNotification[]> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      limit(20)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as AppNotification);
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error('Error fetching in-app notifications:', err);
    return [];
  }
};

export const markNotificationAsRead = async (notifId: string) => {
  try {
    await updateDoc(doc(db, 'notifications', notifId), { isRead: true });
  } catch (e) {
    console.error('Error marking notif as read:', e);
  }
};
