import React, { useEffect, useState } from 'react';
import { getAllStudents, updateStudentProfile } from '../../services/studentService';
import { Student } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Search, Pencil, Trash2, Download } from 'lucide-react';
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
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch users based on role
      const rolesToFetch = userRole === UserRole.ADMIN ? [UserRole.STUDENT, UserRole.MANAGEMENT] : [UserRole.STUDENT];
      const usersQuery = query(collection(db, 'users'), where('role', 'in', rolesToFetch));
      const usersSnap = await getDocs(usersQuery);
      const userList = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

      // Fetch profiles
      const data = await getAllStudents();
      const profileMap = new Map();
      data.forEach(p => profileMap.set(p.userId, p));

      // Merge
      const mergedStudents: any[] = userList.map(u => {
        const profile = profileMap.get(u.uid);
        if (profile) {
          return { ...profile, fullName: profile.fullName || (u as any).name || '', role: (u as any).role, isBlocked: (u as any).isBlocked };
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

      setStudents(mergedStudents);
    } catch (err) {
      toast.error('Gagal mengambil data siswa');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const filteredStudents = students.filter(s => 
    s.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    s.nisn?.includes(search) ||
    s.osnField?.toLowerCase().includes(search.toLowerCase())
  );

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
      'Nama Lengkap', 'NISN', 'Kelas', 'Bidang OSN', 'NIK', 'Agama', 'Tempat Lahir', 'Tanggal Lahir', 'Kebutuhan Khusus', 'Buta Warna', 'Berat Badan (Kg)', 'Tinggi Badan (Cm)',
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

  const canEdit = userRole === UserRole.MANAGEMENT || userRole === UserRole.ADMIN;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Pengguna</h1>
          <p className="text-muted-foreground">Pangkalan data seluruh pengguna (siswa & manajemen) semesta olympiad squad.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari nama, NISN, atau bidang..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Ekspor CSV
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Lengkap</TableHead>
              <TableHead>NISN</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>Bidang OSN</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Tidak ada data siswa yang ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.fullName || '-'}</TableCell>
                  <TableCell>{s.nisn || '-'}</TableCell>
                  <TableCell>{s.grade || '-'}</TableCell>
                  <TableCell>{s.osnField || '-'}</TableCell>
                  <TableCell>{s.role === UserRole.MANAGEMENT ? 'Management' : 'Student'}</TableCell>
                  <TableCell>
                    {s.isBlocked ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Diblokir</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Aktif</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {userRole === UserRole.ADMIN && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={s.isBlocked ? "text-green-600" : "text-red-600"}
                          onClick={() => handleToggleBlock(s.userId, s.isBlocked)}
                        >
                          {s.isBlocked ? 'Buka Blokir' : 'Blokir'}
                        </Button>
                      )}
                      {canEdit && (
                        <Button variant="outline" size="sm" onClick={() => setEditingStudent(s)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      )}
                      {userRole === UserRole.MANAGEMENT && (
                        <Button variant="outline" size="sm" onClick={() => triggerDelete(s.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      )}
                      {!canEdit && <Button variant="outline" size="sm">Lihat Detail</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profil Siswa (God Mode)</DialogTitle>
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
