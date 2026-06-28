import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/auth';
import { Student, ChatMessage } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { sendMessage, deleteMessage } from '../services/chatService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Send, Image as ImageIcon, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDeleteDialog } from '../components/ui/ConfirmDeleteDialog';

const OSN_FIELDS = [
  'Matematika', 'Fisika', 'Kimia', 'Biologi', 'Komputer/Informatika',
  'Astronomi', 'Ekonomi', 'Kebumian', 'Geografi'
];

export function Classroom() {
  const { currentUser: user, userRole } = useAuth();
  const [activeRoom, setActiveRoom] = useState<string>('Matematika');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [studentField, setStudentField] = useState<string | null>(null);

  // Focus only on the student's assigned room + management can see all
  useEffect(() => {
    const fetchStudentField = async () => {
      if (userRole === UserRole.STUDENT && user?.uid) {
        const q = query(collection(db, 'students'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const s = snap.docs[0].data() as Student;
          if (s.osnField) {
            setStudentField(s.osnField);
            setActiveRoom(s.osnField);
          }
        }
      }
    };
    fetchStudentField();
  }, [user, userRole]);

  useEffect(() => {
    if (!activeRoom) return;

    const q = query(
      collection(db, 'chats'),
      where('roomId', '==', activeRoom),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ChatMessage);
      setMessages(msgs);
    }, (error) => {
      console.error("Chat subscription error:", error);
      toast.error('Gagal memuat chat');
    });

    return () => unsubscribe();
  }, [activeRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !imageFile) return;
    if (!user) return;

    try {
      setSending(true);
      await sendMessage(
        activeRoom,
        user.uid,
        user.displayName || user.email || 'User',
        userRole!,
        newMessage.trim(),
        imageFile
      );
      setNewMessage('');
      setImageFile(null);
    } catch (err: any) {
      console.error("Gagal mengirim pesan:", err);
      toast.error(`Gagal mengirim pesan: ${err.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const triggerDelete = (id: string) => {
    if (!id) {
      toast.error('ID Pesan tidak valid');
      return;
    }
    setDeletingMsgId(id);
  };

  const confirmDelete = async () => {
    if (!deletingMsgId) return;
    setIsDeleting(true);
    try {
      await deleteMessage(deletingMsgId);
      toast.success('Pesan berhasil dihapus');
    } catch (err: any) {
      console.error("Error dari handleDelete Pesan:", err.message);
      toast.error(`Gagal menghapus pesan: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
      setDeletingMsgId(null);
    }
  };

  const handleAddImage = () => {
    const url = window.prompt("Masukkan URL gambar dari internet:");
    if (url) {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        setImageFile(url);
      } else {
        toast.error("URL tidak valid. Harus dimulai dengan http:// atau https://");
      }
    }
  };

  const isModerator = userRole === UserRole.ADMIN || userRole === UserRole.MANAGEMENT;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Classroom Forum</h1>
        <p className="text-muted-foreground">Diskusikan materi OSN sesuai dengan bidang Anda.</p>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isModerator ? (
          <div className="p-2 border-b overflow-x-auto whitespace-nowrap">
            <Tabs value={activeRoom} onValueChange={setActiveRoom} className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 flex-nowrap">
                {OSN_FIELDS.map(f => (
                  <TabsTrigger key={f} value={f} className="shrink-0">{f}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        ) : (
          <div className="p-4 border-b bg-muted/30">
            <h2 className="font-semibold flex items-center">
              Ruang Diskusi: <span className="ml-2 px-3 py-1 bg-primary text-primary-foreground text-sm rounded-full">{activeRoom}</span>
            </h2>
          </div>
        )}

        <CardContent className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Belum ada diskusi di ruang ini.
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user?.uid;
              const isModMsg = msg.senderRole === UserRole.ADMIN || msg.senderRole === UserRole.MANAGEMENT;
              
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                      <span className="font-medium flex items-center gap-1">
                        {msg.senderName}
                        {isModMsg && <ShieldAlert className="w-3 h-3 text-blue-500" />}
                      </span>
                      <span>•</span>
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isModerator && (
                        <button onClick={() => triggerDelete(msg.id)} className="text-red-500 hover:text-red-700 ml-2" title="Hapus (Moderator)">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    
                    <div className={`p-3 rounded-lg ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                      {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                      {msg.imageUrl && (
                        <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                          <img src={msg.imageUrl} alt="Attachment" className="mt-2 max-w-sm max-h-60 rounded border hover:opacity-90 transition-opacity" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="p-4 border-t bg-background">
          {imageFile && (
            <div className="mb-2 flex items-center gap-2 text-sm bg-muted/50 p-2 rounded">
              <ImageIcon className="w-4 h-4 text-blue-500" />
              <span className="truncate max-w-[200px]">{imageFile}</span>
              <button 
                type="button" 
                onClick={() => setImageFile(null)} 
                className="text-red-500 hover:text-red-700 text-xs font-bold"
              >
                Batal
              </button>
            </div>
          )}
          <form onSubmit={handleSend} className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="icon" 
              onClick={handleAddImage}
              disabled={sending}
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
            <Input 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Tulis pesan diskusi..."
              className="flex-1"
              disabled={sending}
            />
            <Button type="submit" disabled={sending || (!newMessage.trim() && !imageFile)}>
              {sending ? 'Mengirim...' : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </Card>
      <ConfirmDeleteDialog 
        isOpen={!!deletingMsgId} 
        onClose={() => setDeletingMsgId(null)} 
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
