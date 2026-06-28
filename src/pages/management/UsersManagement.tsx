import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { UserRole } from '../../types/auth';
import { ConfirmDeleteDialog } from '../../components/ui/ConfirmDeleteDialog';

export function UsersManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    } catch (error) {
      toast.error('Gagal mengambil data pengguna');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success('Role berhasil diubah');
      fetchUsers();
    } catch (error) {
      toast.error('Gagal mengubah role');
    }
  };

  const triggerDeleteUser = (userId: string) => {
    if (!userId) {
      toast.error('ID User tidak valid');
      return;
    }
    setDeletingUserId(userId);
  };

  const confirmDeleteUser = async () => {
    if (!deletingUserId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', deletingUserId));
      toast.success('Data berhasil dihapus');
      setUsers(prev => prev.filter(u => u.id !== deletingUserId));
    } catch (err: any) {
      console.error("Error dari handleDeleteUser:", err.message);
      toast.error(`Gagal menghapus data: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
      setDeletingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manajemen Pengguna</h1>
        <p className="text-muted-foreground">Kontrol penuh akses pengguna di aplikasi. (SUPERADMIN)</p>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Role Saat Ini</TableHead>
              <TableHead>Ubah Role</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">Memuat data...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">Belum ada user</TableCell></TableRow>
            ) : (
              users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.name || '-'}</TableCell>
                  <TableCell className="font-semibold">{u.role}</TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(val) => handleRoleChange(u.id, val)}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UserRole.STUDENT}>STUDENT</SelectItem>
                        <SelectItem value={UserRole.ADMIN}>ADMIN</SelectItem>
                        <SelectItem value={UserRole.MANAGEMENT}>MANAGEMENT</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => triggerDeleteUser(u.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <ConfirmDeleteDialog 
        isOpen={!!deletingUserId} 
        onClose={() => setDeletingUserId(null)} 
        onConfirm={confirmDeleteUser}
        title="PERINGATAN"
        description="Yakin ingin menghapus user ini secara permanen dari pangkalan data?"
        isLoading={isDeleting}
      />
    </div>
  );
}
