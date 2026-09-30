import React, { useEffect, useState, useMemo } from 'react';
import { getAllStudents, updateStudentProfile } from '../../services/studentService';
import { Student } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Search, Pencil, Trash2, Download, ShieldCheck, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { StudentProfileForm } from '../../components/features/students/StudentProfileForm';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';
import { deleteDoc, doc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ConfirmDeleteDialog } from '../../components/ui/ConfirmDeleteDialog';

export function StudentsDirectory() {
  const { userRole } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Sortir state for Management/Admin: default SOS
  const initialRoleFilter = userRole === UserRole.ADMIN_STUDENT ? 'STUDENT' : 'SOS';
  const [roleFilter, setRoleFilter] = useState<string>(initialRoleFilter);

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isRoleLocked = userRole === UserRole.ADMIN_SOS || userRole === UserRole.ADMIN_STUDENT;

  const loadData = async () => {
    try {
      setLoading(true);
      // Determine which user roles this admin can fetch
      let rolesToFetch: string[] = [];
      if (userRole === UserRole.ADMIN_SOS) {
        rolesToFetch = [UserRole.SOS];
      } else if (userRole === UserRole.ADMIN_STUDENT) {
        rolesToFetch = [UserRole.STUDENT];
      } else {
        // ADMIN & MANAGEMENT can fetch both SOS and STUDENT
        rolesToFetch = [UserRole.SOS, UserRole.STUDENT];
      }

      const usersQuery = query(collection(db, 'users'), where('role', 'in', rolesToFetch));
      const usersSnap = await getDocs(usersQuery);
      const userList = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

      // Fetch extended profiles
      const data = await getAllStudents();
      const profileMap = new Map();
      data.forEach(p => profileMap.set(p.userId, p));

      // Merge
      const mergedStudents: any[] = userList.map(u => {
        const profile = profileMap.get(u.uid);
        if (profile) {
          return { 
            ...profile, 
            id: profile.id || u.uid, 
            userId: u.uid, 
            fullName: profile.fullName || (u as any).name || '', 
            role: (u as any).role, 
            isBlocked: (u as any).isBlocked 
          };
        } else {
          return {
            id: u.uid,
            userId: u.uid,
            fullName: (u as any).name || 'Belum isi profil',
            nisn: '',
            grade: '',
            osnField: '',
            activePhoneWA: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            role: (u as any).role,
            isBlocked: (u as any).isBlocked,
          };
        }
      });

      const uniqueMerged = Array.from(
        new Map(mergedStudents.map(s => [s.id || s.userId, s])).values()
      );

      setStudents(uniqueMerged);
    } catch (err) {
      toast.error('Gagal mengambil data siswa');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userRole]);

  const triggerDelete = (id: string) => {
    if (!id) {
      toast.error('ID Siswa tidak valid.');
      return;
    }
    setDeletingStudentId(id);
  };

  const confirmDelete = async () => {
    if (!deletingStudentId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'students', deletingStudentId));
      toast.success('Data berhasil dihapus');
      setStudents(prev => prev.filter(s => s.id !== deletingStudentId));
    } catch (err: any) {
      console.error("Error dari handleDelete:", err.message);
      toast.error(`Gagal menghapus data: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
      setDeletingStudentId(null);
    }
  };

  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isBlocked: !currentStatus
      });
      toast.success(!currentStatus ? 'User berhasil diblokir' : 'Blokir user berhasil dibuka');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengubah status blokir');
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // Access constraint based on admin role
      if (userRole === UserRole.ADMIN_SOS && s.role !== UserRole.SOS) return false;
      if (userRole === UserRole.ADMIN_STUDENT && s.role !== UserRole.STUDENT) return false;

      // Management / General Admin filter (Default SOS, can be ALL or STUDENT)
      if (!isRoleLocked && roleFilter !== 'ALL') {
        if (s.role !== roleFilter) return false;
      }

      // Search query
      if (search.trim()) {
        const queryText = search.toLowerCase();
        const matchName = (s.fullName || '').toLowerCase().includes(queryText);
        const matchNisn = (s.nisn || '').includes(queryText);
        const matchField = (s.osnField || '').toLowerCase().includes(queryText);
        const matchGrade = (s.grade || '').toLowerCase().includes(queryText);
        return matchName || matchNisn || matchField || matchGrade;
      }

      return true;
    });
  }, [students, userRole, roleFilter, isRoleLocked, search]);

  const handleSaveStudent = async (data: Partial<Student>) => {
    if (!editingStudent) return;
    try {
      await updateStudentProfile(editingStudent.id, data);
      toast.success('Pembaruan God-Mode Berhasil', { description: 'Profil siswa telah diubah.' });
      setEditingStudent(null);
      loadData();
    } catch (err) {
      toast.error('Gagal menyimpan profil');
    }
  };
  
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const headers = [
      'Role Siswa', 'Nama Lengkap', 'NISN', 'Kelas', 'Bidang (OSN / Minat)', 'NIK', 'Agama', 'Tempat Lahir', 'Tanggal Lahir', 'Kebutuhan Khusus', 'Buta Warna', 'Berat Badan (Kg)', 'Tinggi Badan (Cm)',
      'Email Aktif', 'Email Semesta', 'No HP/WA', 
      'Alamat Singkat', 'No Rumah', 'RT/RW', 'Kode Pos',
      'Jalan (Lengkap)', 'Nomor (Lengkap)', 'RT/RW (Lengkap)', 'Kelurahan', 'Kecamatan', 'Kota/Kabupaten', 'Provinsi', 'Kode Pos (Lengkap)',
      'Nama Ibu', 'NIK Ibu', 'Pekerjaan Ibu', 'Pendidikan Ibu',
      'Nama Ayah', 'NIK Ayah', 'Pekerjaan Ayah', 'Pendidikan Ayah',
      'Kontak Wali',
      'Link Pas Foto', 'Link Kartu Siswa', 'Link KK', 'Link Akte', 'Link KTP/KIA'
    ];
    
    const formatField = (val: any) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      if (str.startsWith('data:')) return '"[Data File/Gambar]"';
      return `"${str.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    };

    const rows = filteredStudents.map(s => [
      formatField(s.role === UserRole.SOS ? 'SOS' : 'Siswa Reguler'),
      formatField(s.fullName),
      formatField(s.nisn),
      formatField(s.grade),
      formatField(s.osnField),
      formatField(s.nik),
      formatField(s.religion),
      formatField(s.birthPlace),
      formatField(s.birthDate ? new Date(s.birthDate).toLocaleDateString('id-ID') : ''),
      formatField(s.specialNeeds),
      formatField(s.isColorBlind ? 'Ya' : 'Tidak'),
      formatField(s.weightKg),
      formatField(s.heightCm),
      formatField(s.activeEmail),
      formatField(s.semestaEmail),
      formatField(s.activePhoneWA),
      formatField(s.homeAddress),
      formatField(s.houseNumber),
      formatField(s.rtRw),
      formatField(s.postalCode),
      formatField(s.fullAddress?.street),
      formatField(s.fullAddress?.number),
      formatField(s.fullAddress?.rtRw),
      formatField(s.fullAddress?.village),
      formatField(s.fullAddress?.district),
      formatField(s.fullAddress?.city),
      formatField(s.fullAddress?.province),
      formatField(s.fullAddress?.postalCode),
      formatField(s.motherName),
      formatField(s.motherNik),
      formatField(s.motherOccupation),
      formatField(s.motherEducation),
      formatField(s.fatherName),
      formatField(s.fatherNik),
      formatField(s.fatherOccupation),
      formatField(s.fatherEducation),
      formatField(s.guardianContact),
      formatField(s.documents?.photoUrl),
      formatField(s.documents?.studentCardUrl),
      formatField(s.documents?.familyCardUrl),
      formatField(s.documents?.birthCertificateUrl),
      formatField(s.documents?.idCardUrl)
    ].join(';'));

    const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daftar_Siswa_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const canEdit = userRole === UserRole.MANAGEMENT || userRole === UserRole.ADMIN || userRole === UserRole.ADMIN_SOS || userRole === UserRole.ADMIN_STUDENT;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Siswa</h1>
          <p className="text-muted-foreground">
            {userRole === UserRole.ADMIN_SOS && "Pangkalan data khusus siswa Squad SOS."}
            {userRole === UserRole.ADMIN_STUDENT && "Pangkalan data khusus siswa Reguler."}
            {(userRole === UserRole.MANAGEMENT || userRole === UserRole.ADMIN) && "Pangkalan data seluruh siswa (SOS dan Siswa Reguler)."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Ekspor CSV
          </Button>
        </div>
      </div>

      {/* Role Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card p-4 rounded-lg border">
        <div className="flex flex-wrap items-center gap-3">
          {!isRoleLocked ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Sortir Role:</span>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Pilih Role Siswa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOS">Hanya Siswa SOS (Default)</SelectItem>
                  <SelectItem value="ALL">Semua Siswa (All)</SelectItem>
                  <SelectItem value="STUDENT">Hanya Siswa Reguler</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge className={userRole === UserRole.ADMIN_SOS ? "bg-purple-100 text-purple-800 border-purple-200 py-1 px-3 text-xs" : "bg-blue-100 text-blue-800 border-blue-200 py-1 px-3 text-xs"}>
              {userRole === UserRole.ADMIN_SOS ? "Admin SOS: Khusus Siswa SOS" : "Admin Siswa: Khusus Siswa Reguler"}
            </Badge>
          )}

          <span className="text-xs text-muted-foreground">
            Total {filteredStudents.length} siswa ditemukan
          </span>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari nama, NISN, atau bidang..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Nama Lengkap</TableHead>
              <TableHead>NISN</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>Bidang (OSN / Minat)</TableHead>
              <TableHead>Status Akun</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Memuat data siswa...
                </TableCell>
              </TableRow>
            ) : filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Tidak ada data siswa yang sesuai filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((s) => (
                <TableRow key={s.id || s.userId}>
                  <TableCell>
                    {s.role === UserRole.SOS ? (
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200">SOS</Badge>
                    ) : (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">Siswa Reguler</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{s.fullName || '-'}</TableCell>
                  <TableCell>{s.nisn || '-'}</TableCell>
                  <TableCell>{s.grade || '-'}</TableCell>
                  <TableCell>{s.osnField || '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {s.isBlocked ? 'Diblokir' : 'Aktif'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Edit Lengkap (God Mode)"
                          onClick={() => setEditingStudent(s)}
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                      {(userRole === UserRole.MANAGEMENT || userRole === UserRole.ADMIN) && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={`text-xs ${s.isBlocked ? 'text-green-600' : 'text-orange-600'}`}
                          onClick={() => handleToggleBlock(s.userId, s.isBlocked)}
                        >
                          {s.isBlocked ? 'Buka Blokir' : 'Blokir'}
                        </Button>
                      )}
                      {canEdit && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-700" 
                          title="Hapus Siswa"
                          onClick={() => triggerDelete(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog Edit God-Mode */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profil Siswa (God Mode Admin)</DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <StudentProfileForm 
              initialData={editingStudent} 
              studentId={editingStudent.id} 
              onSave={handleSaveStudent} 
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog 
        isOpen={!!deletingStudentId} 
        onClose={() => setDeletingStudentId(null)} 
        onConfirm={confirmDelete} 
        isLoading={isDeleting}
      />
    </div>
  );
}
