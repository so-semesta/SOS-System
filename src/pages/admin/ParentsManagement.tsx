import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  UserPlus,
  Search,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Users,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Check,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { isManagementRole } from '../../types/auth';
import { ParentLink, ParentRelationship, StudentParentClaim } from '../../types';
import {
  approveParentLink,
  createParentLink,
  deleteParentLink,
  formatParentAccountName,
  getAllParentLinks,
  getAvailableStudentsForLinking,
  getClaimedStudentIdsMap,
  LinkableStudentOption,
  rejectParentLink,
  toggleParentLinkActive,
  updateParentLink,
} from '../../services/parentService';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { ConfirmDeleteDialog } from '../../components/ui/ConfirmDeleteDialog';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED_OR_INACTIVE' | 'LOGGED_IN';

export function ParentsManagement() {
  const { userProfile, userRole } = useAuth();
  const canManageApproval =
    isManagementRole(userRole) ||
    userProfile?.email?.trim().toLowerCase() === 'scienceolympiad@semesta.sch.id';

  const [links, setLinks] = useState<ParentLink[]>([]);
  const [students, setStudents] = useState<LinkableStudentOption[]>([]);
  const [claimsMap, setClaimsMap] = useState<Record<string, StudentParentClaim>>({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Add / Edit Modal (strict 1-to-1)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ParentLink | null>(null);
  const [parentEmail, setParentEmail] = useState('');
  const [relationship, setRelationship] = useState<ParentRelationship>('Ayah');
  const [phoneWa, setPhoneWa] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isActiveForm, setIsActiveForm] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reject Reason Modal
  const [rejectingLink, setRejectingLink] = useState<ParentLink | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState<string | null>(null);

  // Delete dialog
  const [deletingLink, setDeletingLink] = useState<ParentLink | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [linksData, studentsData, claimsData] = await Promise.all([
        getAllParentLinks(),
        getAvailableStudentsForLinking(),
        getClaimedStudentIdsMap(),
      ]);
      setLinks(linksData);
      setStudents(studentsData);
      setClaimsMap(claimsData);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data akun orang tua.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const total = links.length;
    const pending = links.filter((l) => l.approvalStatus === 'PENDING').length;
    const active = links.filter((l) => l.approvalStatus === 'APPROVED' && l.isActive).length;
    const loggedIn = links.filter((l) => Boolean(l.parentUid) && l.approvalStatus === 'APPROVED').length;
    return { total, pending, active, loggedIn };
  }, [links]);

  const filteredLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return links.filter((link) => {
      if (statusFilter === 'PENDING' && link.approvalStatus !== 'PENDING') return false;
      if (statusFilter === 'APPROVED' && !(link.approvalStatus === 'APPROVED' && link.isActive)) return false;
      if (statusFilter === 'REJECTED_OR_INACTIVE' && link.approvalStatus !== 'REJECTED' && link.isActive) return false;
      if (statusFilter === 'LOGGED_IN' && !link.parentUid) return false;

      if (!q) return true;
      const inName = link.parentName.toLowerCase().includes(q);
      const inEmail = link.parentEmail.toLowerCase().includes(q);
      const inStudent = link.studentName.toLowerCase().includes(q);
      return inName || inEmail || inStudent;
    });
  }, [links, search, statusFilter]);

  const filteredStudentOptions = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.grade.toLowerCase().includes(q) ||
        s.osnField.toLowerCase().includes(q) ||
        s.nisn.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.userId === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const openCreateModal = () => {
    setEditingLink(null);
    setParentEmail('');
    setRelationship('Ayah');
    setPhoneWa('');
    setSelectedStudentId('');
    setIsActiveForm(true);
    setStudentSearch('');
    setIsModalOpen(true);
  };

  const openEditModal = (link: ParentLink) => {
    setEditingLink(link);
    setParentEmail(link.parentEmail);
    setRelationship(link.relationship);
    setPhoneWa(link.phoneWa || '');
    setSelectedStudentId(link.studentId || link.studentIds[0] || '');
    setIsActiveForm(link.isActive);
    setStudentSearch('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = parentEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.endsWith('@semesta.sch.id')) {
      toast.error('Masukkan email Google pribadi orang tua (bukan @semesta.sch.id).');
      return;
    }
    if (!selectedStudentId) {
      toast.error('Pilih 1 siswa untuk ditautkan (relasi 1 Siswa = 1 Orang Tua).');
      return;
    }

    const resolvedName =
      selectedStudent?.fullName ||
      (editingLink && editingLink.studentId === selectedStudentId ? editingLink.studentName : 'Siswa SOS');

    setIsSaving(true);
    try {
      if (editingLink) {
        await updateParentLink(editingLink, {
          parentEmail: cleanEmail,
          relationship,
          phoneWa: phoneWa.trim() || undefined,
          studentId: selectedStudentId,
          studentName: resolvedName,
          isActive: isActiveForm,
        });
        toast.success(`Data ${formatParentAccountName(resolvedName)} berhasil diperbarui.`);
      } else {
        await createParentLink({
          parentEmail: cleanEmail,
          relationship,
          phoneWa: phoneWa.trim() || undefined,
          studentId: selectedStudentId,
          studentName: resolvedName,
          createdBy: userProfile?.email || 'management',
        });
        toast.success(`${formatParentAccountName(resolvedName)} berhasil didaftarkan & diaktifkan.`);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Gagal menyimpan data orang tua.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (link: ParentLink) => {
    if (!canManageApproval) {
      toast.error('Hanya Management yang berwenang melakukan ACC pendaftaran.');
      return;
    }
    setIsProcessingApproval(link.id);
    try {
      await approveParentLink(link, userProfile?.email || 'management');
      toast.success(`${link.parentName} telah di-ACC dan aksesnya diaktifkan.`);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Gagal menyetujui pendaftaran orang tua.');
    } finally {
      setIsProcessingApproval(null);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingLink) return;
    setIsProcessingApproval(rejectingLink.id);
    try {
      await rejectParentLink(
        rejectingLink,
        userProfile?.email || 'management',
        rejectionReason.trim() || 'Ditolak oleh Management'
      );
      toast.success(`Pendaftaran ${rejectingLink.parentName} ditolak.`);
      setRejectingLink(null);
      setRejectionReason('');
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Gagal menolak pendaftaran.');
    } finally {
      setIsProcessingApproval(null);
    }
  };

  const handleToggleActive = async (link: ParentLink, nextVal: boolean) => {
    if (!canManageApproval) {
      toast.error('Hanya Management yang dapat mengubah status akses orang tua.');
      return;
    }
    try {
      await toggleParentLinkActive(link.id, nextVal);
      setLinks((prev) =>
        prev.map((item) =>
          item.id === link.id ? { ...item, isActive: nextVal, updatedAt: Date.now() } : item
        )
      );
      toast.success(
        nextVal ? `Akses ${link.parentName} diaktifkan.` : `Akses ${link.parentName} dinonaktifkan.`
      );
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengubah status akses.');
    }
  };

  const confirmDelete = async () => {
    if (!deletingLink) return;
    setIsDeleting(true);
    try {
      await deleteParentLink(deletingLink);
      toast.success('Tautan akun orang tua berhasil dihapus dan slot siswa dibebaskan.');
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus data orang tua.');
    } finally {
      setIsDeleting(false);
      setDeletingLink(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Manajemen Akun Orang Tua
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Relasi 1-ke-1 (1 Siswa = 1 Akun Orang Tua dengan format <span className="font-medium text-slate-700">Parent [Nama Siswa]</span>). Pendaftaran mandiri menunggu ACC Management.
          </p>
        </div>
        <Button onClick={openCreateModal} className="whitespace-nowrap shrink-0">
          <UserPlus className="w-4 h-4 mr-2" />
          Tambah Akun Orang Tua
        </Button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Menunggu ACC</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700 tabular-nums">{stats.pending}</div>
          <p className="mt-1 text-xs text-slate-500">Perlu persetujuan Management</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Disetujui & Aktif</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">{stats.active}</div>
          <p className="mt-1 text-xs text-slate-500">Diizinkan masuk portal</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Terverifikasi Login</span>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{stats.loggedIn}</div>
          <p className="mt-1 text-xs text-slate-500">Pernah masuk via Gmail</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Terdaftar</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{stats.total}</div>
          <p className="mt-1 text-xs text-slate-500">Semua status pendaftaran</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          {(
            [
              { key: 'ALL', label: 'Semua' },
              { key: 'PENDING', label: `Menunggu ACC (${stats.pending})` },
              { key: 'APPROVED', label: 'Aktif' },
              { key: 'REJECTED_OR_INACTIVE', label: 'Ditolak / Nonaktif' },
              { key: 'LOGGED_IN', label: 'Sudah Login' },
            ] as Array<{ key: StatusFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cari Parent [Nama], email, atau siswa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70">
              <TableHead>Akun Orang Tua</TableHead>
              <TableHead>Siswa Tertaut (1-to-1)</TableHead>
              <TableHead>Status Persetujuan</TableHead>
              <TableHead>Login Terakhir</TableHead>
              <TableHead className="text-center">Akses</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-28 text-slate-500">
                  Memuat data akun orang tua...
                </TableCell>
              </TableRow>
            ) : filteredLinks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-36">
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <p className="text-sm font-medium text-slate-700">
                      Belum ada data akun orang tua pada kategori ini.
                    </p>
                    <p className="text-xs text-slate-500">
                      Orang tua dapat mendaftar sendiri via portal dengan Gmail lalu disetujui oleh Management.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLinks.map((link) => {
                const isPending = link.approvalStatus === 'PENDING';
                const isRejected = link.approvalStatus === 'REJECTED';
                const busy = isProcessingApproval === link.id;

                return (
                  <TableRow key={link.id} className="hover:bg-slate-50/60">
                    <TableCell>
                      <div className="font-semibold text-slate-900">{link.parentName}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <span>{link.relationship}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{link.parentEmail}</span>
                        {link.phoneWa && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{link.phoneWa}</span>
                          </>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm font-medium text-slate-800">{link.studentName}</div>
                    </TableCell>

                    <TableCell>
                      {isPending ? (
                        <span className="inline-flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 whitespace-nowrap">
                          <Clock className="h-3.5 w-3.5" />
                          Menunggu ACC
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 whitespace-nowrap">
                          <XCircle className="h-3.5 w-3.5" />
                          Ditolak
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Disetujui Management
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-slate-500 tabular-nums">
                      {link.lastLoginAt
                        ? format(new Date(link.lastLoginAt), 'dd MMM yyyy, HH:mm', { locale: localeId })
                        : 'Belum masuk'}
                    </TableCell>

                    <TableCell className="text-center">
                      {isPending ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <div className="inline-flex items-center justify-center">
                          <Switch
                            checked={link.isActive}
                            disabled={!canManageApproval || isRejected}
                            onCheckedChange={(checked) => handleToggleActive(link, checked)}
                            aria-label={`Aktifkan akses ${link.parentName}`}
                          />
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {isPending && canManageApproval && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(link)}
                              disabled={busy}
                              className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap shrink-0"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              ACC
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRejectingLink(link);
                                setRejectionReason('');
                              }}
                              disabled={busy}
                              className="h-8 px-2.5 text-red-600 border-red-200 hover:bg-red-50 whitespace-nowrap shrink-0"
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              Tolak
                            </Button>
                          </>
                        )}
                        {canManageApproval && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(link)}
                            title="Edit tautan orang tua"
                          >
                            <Pencil className="w-4 h-4 text-slate-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingLink(link)}
                          title="Hapus akun orang tua"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dialog (1-to-1) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLink ? 'Edit Akun Orang Tua (1-to-1)' : 'Tambah Akun Orang Tua (1-to-1)'}
            </DialogTitle>
            <DialogDescription>
              Setiap siswa hanya tertaut ke 1 akun orang tua, dan nama akun otomatis menjadi <span className="font-medium">Parent [Nama Siswa]</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            {selectedStudent && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs">
                <span className="text-emerald-800">Nama Akun Otomatis: </span>
                <span className="font-semibold text-emerald-950">
                  {formatParentAccountName(selectedStudent.fullName)}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="parentEmail">Email Google Pribadi (Gmail)</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="parentEmail"
                    type="email"
                    placeholder="orangtua@gmail.com"
                    className="pl-8"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    maxLength={256}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="relationship">Hubungan dengan Siswa</Label>
                <Select
                  value={relationship}
                  onValueChange={(val) => setRelationship(val as ParentRelationship)}
                >
                  <SelectTrigger id="relationship">
                    <SelectValue>{relationship}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ayah">Ayah</SelectItem>
                    <SelectItem value="Ibu">Ibu</SelectItem>
                    <SelectItem value="Wali">Wali</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phoneWa">No. WhatsApp (Opsional)</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="phoneWa"
                  placeholder="0812xxxxxxxx"
                  className="pl-8"
                  value={phoneWa}
                  onChange={(e) => setPhoneWa(e.target.value)}
                  maxLength={30}
                />
              </div>
            </div>

            {editingLink && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 bg-slate-50/70">
                <div>
                  <p className="text-sm font-medium text-slate-900">Status Akses Portal</p>
                  <p className="text-xs text-slate-500">
                    Nonaktifkan sementara jika akses orang tua perlu ditangguhkan.
                  </p>
                </div>
                <Switch checked={isActiveForm} onCheckedChange={setIsActiveForm} />
              </div>
            )}

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label>Pilih 1 Siswa yang Ditautkan</Label>
                <span className="text-xs text-slate-500">
                  {selectedStudent ? selectedStudent.fullName : 'Belum dipilih'}
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari nama siswa, kelas, atau bidang OSN..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {filteredStudentOptions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Tidak ada siswa yang sesuai pencarian.
                  </div>
                ) : (
                  filteredStudentOptions.map((student) => {
                    const claim = claimsMap[student.userId];
                    const claimedByOther =
                      claim &&
                      claim.linkId !== editingLink?.id &&
                      (claim.status === 'PENDING' || claim.status === 'APPROVED');
                    const isSelected = selectedStudentId === student.userId;

                    return (
                      <label
                        key={student.userId}
                        className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                          claimedByOther
                            ? 'bg-slate-50 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-slate-900/5 cursor-pointer'
                            : 'hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <input
                          type="radio"
                          name="adminParentStudent"
                          checked={isSelected}
                          disabled={claimedByOther}
                          onChange={() => setSelectedStudentId(student.userId)}
                          className="h-4 w-4 text-slate-900 border-slate-300"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-900 truncate">
                              {student.fullName}
                            </span>
                            {claimedByOther && (
                              <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap shrink-0">
                                Sudah tertaut
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                            <span>{student.grade ? `Kelas ${student.grade}` : 'Kelas belum diisi'}</span>
                            {student.osnField && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{student.osnField}</span>
                              </>
                            )}
                            {student.nisn && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">NISN {student.nisn}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSaving || !selectedStudentId}>
                {isSaving
                  ? 'Menyimpan...'
                  : editingLink
                  ? 'Simpan Perubahan'
                  : 'Daftarkan & Aktifkan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={!!rejectingLink} onOpenChange={(open) => !open && setRejectingLink(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Tolak Pendaftaran Akun Orang Tua</DialogTitle>
            <DialogDescription>
              Slot siswa <span className="font-medium text-slate-800">{rejectingLink?.studentName}</span> akan dibebaskan kembali setelah penolakan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmReject} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="rejectReason">Alasan Penolakan (Opsional)</Label>
              <Input
                id="rejectReason"
                placeholder="cth. Data siswa tidak cocok atau email belum terkonfirmasi"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                maxLength={500}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectingLink(null)}
                disabled={!!isProcessingApproval}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!!isProcessingApproval}
              >
                {isProcessingApproval ? 'Memproses...' : 'Tolak Pendaftaran'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        isOpen={!!deletingLink}
        onClose={() => setDeletingLink(null)}
        onConfirm={confirmDelete}
        title="Hapus Tautan Orang Tua"
        description={`Yakin ingin menghapus akun ${deletingLink?.parentName || 'orang tua'} ini? Siswa ${deletingLink?.studentName || ''} akan dapat ditautkan ke email orang tua baru lagi.`}
        isLoading={isDeleting}
      />
    </div>
  );
}
