import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';
import { Trash2, Search, ArrowRightLeft, Users } from 'lucide-react';
import { UserRole } from '../../types/auth';
import { ConfirmDeleteDialog } from '../../components/ui/ConfirmDeleteDialog';
import { migrateExistingStudentsToSos } from '../../services/migrationService';

export function UsersManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  
  // Sortir role: default SOS
  const [roleFilter, setRoleFilter] = useState<string>('SOS');
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const userMap = new Map<string, any>();
      snapshot.docs.forEach(doc => {
        userMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
      setUsers(Array.from(userMap.values()));
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
      await updateDoc(doc(db, 'users', userId), { role: newRole, updatedAt: Date.now() });
      toast.success(`Role berhasil diubah menjadi ${newRole}`);
      fetchUsers();
    } catch (error) {
      toast.error('Gagal mengubah role');
    }
  };

  const handleRunMigration = async () => {
    setIsMigrating(true);
    try {
      const res = await migrateExistingStudentsToSos();
      if (res.migratedCount > 0) {
        toast.success(`Berhasil memigrasikan ${res.migratedCount} siswa lama ke role SOS!`);
      } else {
        toast.info('Semua data siswa saat ini sudah berada di role SOS.');
      }
      fetchUsers();
    } catch (error) {
      toast.error('Gagal menjalankan migrasi');
    } finally {
      setIsMigrating(false);
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

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Role filter
      if (roleFilter !== 'ALL') {
        if (u.role !== roleFilter) return false;
      }
      // Search filter
      if (search.trim()) {
        const queryText = search.toLowerCase();
        const matchEmail = (u.email || '').toLowerCase().includes(queryText);
        const matchName = (u.name || '').toLowerCase().includes(queryText);
        return matchEmail || matchName;
      }
      return true;
    });
  }, [users, roleFilter, search]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case UserRole.SOS:
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">SOS</Badge>;
      case UserRole.STUDENT:
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Siswa Reguler</Badge>;
      case UserRole.ADMIN_SOS:
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Admin SOS</Badge>;
      case UserRole.ADMIN_STUDENT:
        return <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200">Admin Siswa</Badge>;
      case UserRole.ADMIN:
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Admin Umum</Badge>;
      case UserRole.MANAGEMENT:
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Management</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Pengguna</h1>
          <p className="text-muted-foreground">Kontrol penuh akun pengguna dan penugasan role di aplikasi.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRunMigration} 
          disabled={isMigrating}
          className="border-purple-200 text-purple-700 hover:bg-purple-50 shrink-0"
        >
          <ArrowRightLeft className="w-4 h-4 mr-2" />
          {isMigrating ? 'Memigrasikan...' : 'Migrasi Siswa Lama ke SOS'}
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Sortir Role:</span>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Pilih Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SOS">Hanya SOS (Default)</SelectItem>
              <SelectItem value="ALL">Semua Role (All)</SelectItem>
              <SelectItem value="STUDENT">Hanya Siswa Reguler</SelectItem>
              <SelectItem value="ADMIN_SOS">Hanya Admin SOS</SelectItem>
              <SelectItem value="ADMIN_STUDENT">Hanya Admin Siswa</SelectItem>
              <SelectItem value="ADMIN">Hanya Admin Umum</SelectItem>
              <SelectItem value="MANAGEMENT">Hanya Management</SelectItem>
            </SelectContent>
          </Select>
          {roleFilter === 'SOS' && (
            <span className="text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-200 font-medium">
              Menampilkan {filteredUsers.length} Siswa SOS
            </span>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama atau email..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-8"
          />
        </div>
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
              <TableRow><TableCell colSpan={5} className="text-center h-24">Memuat data pengguna...</TableCell></TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Tidak ada pengguna pada kategori role ini.</TableCell></TableRow>
            ) : (
              filteredUsers.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.email}</TableCell>
                  <TableCell className="font-medium">{u.name || '-'}</TableCell>
                  <TableCell>
                    {getRoleBadge(u.role)}
                  </TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(val) => handleRoleChange(u.id, val)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UserRole.SOS}>SOS (Siswa SOS)</SelectItem>
                        <SelectItem value={UserRole.STUDENT}>STUDENT (Siswa Reguler)</SelectItem>
                        <SelectItem value={UserRole.ADMIN_SOS}>ADMIN_SOS (Admin SOS)</SelectItem>
                        <SelectItem value={UserRole.ADMIN_STUDENT}>ADMIN_STUDENT (Admin Siswa)</SelectItem>
                        <SelectItem value={UserRole.ADMIN}>ADMIN (Admin Umum)</SelectItem>
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
