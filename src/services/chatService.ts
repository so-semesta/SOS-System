import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChatMessage } from '../types';

export const sendMessage = async (
  roomId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  text: string,
  imageUrl?: string | null
) => {
  const payload: any = {
    roomId,
    senderId,
    senderName,
    senderRole,
    text,
    createdAt: Date.now()
  };

  if (imageUrl) {
    payload.imageUrl = imageUrl;
  }

  await addDoc(collection(db, 'chats'), payload);
};

export const deleteMessage = async (chatId: string) => {
  await deleteDoc(doc(db, 'chats', chatId));
};
