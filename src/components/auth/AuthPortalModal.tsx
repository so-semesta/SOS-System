import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  GraduationCap,
  LogOut,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { AuthMode, AuthRoleIntent, UserRole } from '../../types/auth';
import { ParentRelationship } from '../../types';
import {
  SOS_COORDINATORS,
  buildCoordinatorWaUrl,
  formatParentAccountName,
  getUnclaimedStudentsForParentRegistration,
  LinkableStudentOption,
} from '../../services/parentService';
import { LOGO_BASE64 } from '../../lib/constants';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface AuthPortalContentProps {
  defaultMode?: AuthMode;
  defaultRole?: AuthRoleIntent;
  compactHeader?: boolean;
}

function getAdminRoleLabel(role: UserRole | string) {
  switch (role) {
    case UserRole.ADMIN_SOS:
      return 'Admin SOS';
    case UserRole.ADMIN_STUDENT:
      return 'Admin Siswa';
    case UserRole.ADMIN:
      return 'Admin Umum';
    case UserRole.MANAGEMENT:
      return 'Management';
    default:
      return String(role);
  }
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthPortalContent({
  defaultMode = 'LOGIN',
  defaultRole = 'STUDENT',
  compactHeader = false,
}: AuthPortalContentProps) {
  const {
    currentUser,
    authGateStatus,
    pendingParentLink,
    pendingAdminRequest,
    loginWithRole,
    submitPendingParentRegistration,
    submitPendingAdminRegistration,
    refreshAuthStatus,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [roleIntent, setRoleIntent] = useState<AuthRoleIntent>(defaultRole);
  const [adminRoleChoice, setAdminRoleChoice] = useState<
    UserRole.ADMIN | UserRole.ADMIN_SOS | UserRole.ADMIN_STUDENT
  >(UserRole.ADMIN_SOS);
  const [adminNotes, setAdminNotes] = useState('');

  // Parent registration states
  const [unclaimedStudents, setUnclaimedStudents] = useState<LinkableStudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [relationship, setRelationship] = useState<ParentRelationship>('Ayah');
  const [phoneWa, setPhoneWa] = useState('');
  const [reapplyingParent, setReapplyingParent] = useState(false);
  const [reapplyingAdmin, setReapplyingAdmin] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const showParentRegistrationForm =
    authGateStatus === 'PARENT_NEEDS_REGISTRATION' ||
    (authGateStatus === 'PARENT_REJECTED' && reapplyingParent);

  const showAdminRegistrationForm =
    authGateStatus === 'ADMIN_NEEDS_REGISTRATION' ||
    (authGateStatus === 'ADMIN_REJECTED' && reapplyingAdmin);

  useEffect(() => {
    if (!showParentRegistrationForm) return;
    let active = true;
    const loadStudents = async () => {
      setLoadingStudents(true);
      try {
        const list = await getUnclaimedStudentsForParentRegistration();
        if (active) setUnclaimedStudents(list);
      } catch (err) {
        console.error(err);
        if (active) toast.error('Gagal memuat daftar siswa yang belum memiliki akun orang tua.');
      } finally {
        if (active) setLoadingStudents(false);
      }
    };
    loadStudents();
    return () => {
      active = false;
    };
  }, [showParentRegistrationForm]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return unclaimedStudents;
    return unclaimedStudents.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.grade.toLowerCase().includes(q) ||
        s.osnField.toLowerCase().includes(q)
    );
  }, [unclaimedStudents, studentSearch]);

  const selectedStudent = useMemo(
    () => unclaimedStudents.find((s) => s.userId === selectedStudentId) || null,
    [unclaimedStudents, selectedStudentId]
  );

  const handleGoogleContinue = async () => {
    setSubmitting(true);
    try {
      await loginWithRole(
        mode,
        roleIntent,
        mode === 'REGISTER' && roleIntent === 'ADMIN'
          ? { requestedAdminRole: adminRoleChoice, notes: adminNotes.trim() || undefined }
          : undefined
      );
    } catch {
      // handled in AuthContext toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleParentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Silakan pilih 1 nama putra/putri Anda.');
      return;
    }
    if (!phoneWa.trim()) {
      toast.error('Nomor WhatsApp aktif wajib diisi untuk konfirmasi Koordinator SOS.');
      return;
    }

    setSubmitting(true);
    try {
      await submitPendingParentRegistration({
        relationship,
        phoneWa: phoneWa.trim(),
        studentId: selectedStudent.userId,
        studentName: selectedStudent.fullName,
      });
      setReapplyingParent(false);
      toast.success('Pendaftaran Akun Orang Tua terkirim. Silakan hubungi Koordinator SOS untuk ACC Management.');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengajukan pendaftaran akun orang tua.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitPendingAdminRegistration({
        requestedRole: adminRoleChoice,
        notes: adminNotes.trim() || undefined,
      });
      setReapplyingAdmin(false);
      toast.success('Permohonan akses Admin terkirim. Menunggu persetujuan Management.');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengirim permohonan akses Admin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAuthStatus();
      toast.info('Status persetujuan telah diperbarui.');
    } catch {
      toast.error('Gagal memeriksa status terbaru.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSwitchAccount = async () => {
    setReapplyingParent(false);
    setReapplyingAdmin(false);
    setSelectedStudentId('');
    setPhoneWa('');
    await logout();
  };

  // --- GATE SUB-VIEW 1: PARENT REGISTRATION FORM (STEP 2) ---
  if (currentUser && showParentRegistrationForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Email Google Terverifikasi</p>
            <p className="text-sm font-mono font-medium text-slate-900 truncate">{currentUser.email}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSwitchAccount}
            className="text-xs whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Ganti Akun
          </Button>
        </div>

        <form onSubmit={handleParentSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Pilih Putra / Putri (1 Siswa = 1 Akun Orang Tua)</Label>
              <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                {unclaimedStudents.length} tersedia
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari nama siswa, kelas, atau bidang..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
              {loadingStudents ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Memuat daftar siswa yang tersedia...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Tidak ada siswa tersedia yang cocok dengan pencarian Anda. Siswa yang sudah memiliki akun orang tua tidak ditampilkan.
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected = selectedStudentId === student.userId;
                  return (
                    <label
                      key={student.userId}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-slate-900/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="parentStudentId"
                        checked={isSelected}
                        onChange={() => setSelectedStudentId(student.userId)}
                        className="h-4 w-4 text-slate-900 border-slate-300"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{student.fullName}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {student.grade ? `Kelas ${student.grade}` : 'Kelas belum diisi'}
                          {student.osnField ? ` · ${student.osnField}` : ''}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {selectedStudent && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs">
              <span className="text-emerald-800">Nama Akun Terdaftar: </span>
              <span className="font-semibold text-emerald-950">
                {formatParentAccountName(selectedStudent.fullName)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="regRelationship">Hubungan</Label>
              <Select
                value={relationship}
                onValueChange={(val) => setRelationship(val as ParentRelationship)}
              >
                <SelectTrigger id="regRelationship">
                  <SelectValue>{relationship}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ayah">Ayah</SelectItem>
                  <SelectItem value="Ibu">Ibu</SelectItem>
                  <SelectItem value="Wali">Wali</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="regPhoneWa">No. WhatsApp Aktif</Label>
              <Input
                id="regPhoneWa"
                placeholder="0812xxxxxxxx"
                value={phoneWa}
                onChange={(e) => setPhoneWa(e.target.value)}
                maxLength={30}
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-11" disabled={submitting || !selectedStudent}>
            {submitting ? 'Mengirim Pendaftaran...' : 'Ajukan Pendaftaran Akun Orang Tua'}
          </Button>
        </form>
      </div>
    );
  }

  // --- GATE SUB-VIEW 2: PARENT PENDING / REJECTED + 3 WA COORDINATOR BUTTONS ---
  if (
    currentUser &&
    (authGateStatus === 'PARENT_PENDING' || authGateStatus === 'PARENT_REJECTED') &&
    pendingParentLink
  ) {
    const isRejected = authGateStatus === 'PARENT_REJECTED';

    return (
      <div className="space-y-4">
        <div
          className={`rounded-lg border p-4 ${
            isRejected ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-amber-50/70'
          }`}
        >
          <div className="flex items-start gap-3">
            {isRejected ? (
              <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-slate-900">
                {pendingParentLink.approvalStatus === 'REJECTED'
                  ? 'Pendaftaran Akun Orang Tua Ditolak'
                  : !pendingParentLink.isActive && pendingParentLink.approvalStatus === 'APPROVED'
                  ? 'Akun Orang Tua Dinonaktifkan Sementara'
                  : 'Menunggu ACC Management'}
              </h3>
              <p className="text-xs text-slate-600">
                {pendingParentLink.approvalStatus === 'REJECTED'
                  ? pendingParentLink.rejectionReason ||
                    'Silakan hubungi Koordinator SOS atau ajukan ulang dengan data yang sesuai.'
                  : !pendingParentLink.isActive && pendingParentLink.approvalStatus === 'APPROVED'
                  ? 'Akses portal untuk akun ini sedang ditangguhkan oleh Management.'
                  : 'Permohonan akun Anda sedang menunggu persetujuan Management. Silakan hubungi salah satu Koordinator SOS di bawah ini agar segera di-ACC.'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs space-y-1.5">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Nama Akun</span>
            <span className="font-semibold text-slate-900">{pendingParentLink.parentName}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Siswa Tertaut</span>
            <span className="font-medium text-slate-800">{pendingParentLink.studentName}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Email Google</span>
            <span className="font-mono text-slate-700 truncate">{pendingParentLink.parentEmail}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Hubungan / WA</span>
            <span className="text-slate-800 tabular-nums">
              {pendingParentLink.relationship} · {pendingParentLink.phoneWa || '-'}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">
            Hubungi Koordinator SOS via WhatsApp untuk Konfirmasi ACC:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SOS_COORDINATORS.map((coord) => (
              <a
                key={coord.id}
                href={buildCoordinatorWaUrl(
                  coord.phone,
                  coord.name,
                  pendingParentLink.studentName,
                  pendingParentLink.parentEmail,
                  pendingParentLink.relationship
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-start gap-0.5 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 hover:bg-emerald-100/70 transition-colors"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  {coord.name}
                </span>
                <span className="text-[11px] text-emerald-700">{coord.label}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSwitchAccount}
            className="whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Ganti Akun / Keluar
          </Button>

          <div className="flex items-center gap-2">
            {pendingParentLink.approvalStatus === 'REJECTED' && (
              <Button
                type="button"
                size="sm"
                onClick={() => setReapplyingParent(true)}
                className="whitespace-nowrap shrink-0"
              >
                Ajukan Ulang
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant={pendingParentLink.approvalStatus === 'REJECTED' ? 'outline' : 'default'}
              onClick={handleRefresh}
              disabled={refreshing}
              className="whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Periksa Status ACC
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- GATE SUB-VIEW 3: ADMIN NEEDS REGISTRATION ---
  if (currentUser && showAdminRegistrationForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Email Sekolah Terverifikasi</p>
            <p className="text-sm font-mono font-medium text-slate-900 truncate">{currentUser.email}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSwitchAccount}
            className="text-xs whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Ganti Akun
          </Button>
        </div>

        <form onSubmit={handleAdminRequestSubmit} className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-600">
            Akun Anda belum memiliki akses Admin/Management aktif. Ajukan pendaftaran role Admin di bawah ini untuk disetujui oleh Management.
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adminRoleSelect">Peran Admin yang Diajukan</Label>
            <Select
              value={adminRoleChoice}
              onValueChange={(val) =>
                setAdminRoleChoice(val as UserRole.ADMIN | UserRole.ADMIN_SOS | UserRole.ADMIN_STUDENT)
              }
            >
              <SelectTrigger id="adminRoleSelect">
                <SelectValue>{getAdminRoleLabel(adminRoleChoice)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.ADMIN_SOS}>Admin SOS (Koordinator / Pembina)</SelectItem>
                <SelectItem value={UserRole.ADMIN_STUDENT}>Admin Siswa (Asrama / Kultur)</SelectItem>
                <SelectItem value={UserRole.ADMIN}>Admin Umum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adminNotesInput">Catatan / Bidang Tugas (Opsional)</Label>
            <Input
              id="adminNotesInput"
              placeholder="cth. Pembina OSN Fisika / Koordinator Putra"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              maxLength={500}
            />
          </div>

          <Button type="submit" className="w-full h-11" disabled={submitting}>
            {submitting ? 'Mengirim Permohonan...' : 'Ajukan Akses Admin ke Management'}
          </Button>
        </form>
      </div>
    );
  }

  // --- GATE SUB-VIEW 4: ADMIN PENDING / REJECTED ---
  if (
    currentUser &&
    (authGateStatus === 'ADMIN_PENDING' || authGateStatus === 'ADMIN_REJECTED') &&
    pendingAdminRequest
  ) {
    const isRejected = authGateStatus === 'ADMIN_REJECTED';
    return (
      <div className="space-y-4">
        <div
          className={`rounded-lg border p-4 ${
            isRejected ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-amber-50/70'
          }`}
        >
          <div className="flex items-start gap-3">
            {isRejected ? (
              <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">
                {isRejected ? 'Permohonan Akses Admin Ditolak' : 'Menunggu ACC Management'}
              </h3>
              <p className="text-xs text-slate-600">
                {isRejected
                  ? pendingAdminRequest.rejectionReason || 'Permohonan akses Admin Anda ditolak oleh Management.'
                  : 'Permohonan akses Admin Anda telah dicatat dan sedang menunggu persetujuan Management.'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs space-y-1.5">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Nama</span>
            <span className="font-semibold text-slate-900">{pendingAdminRequest.name}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Email Sekolah</span>
            <span className="font-mono text-slate-700 truncate">{pendingAdminRequest.email}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Role Diajukan</span>
            <span className="font-medium text-slate-900">
              {getAdminRoleLabel(pendingAdminRequest.requestedRole)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSwitchAccount}
            className="whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Ganti Akun / Keluar
          </Button>
          <div className="flex items-center gap-2">
            {isRejected && (
              <Button
                type="button"
                size="sm"
                onClick={() => setReapplyingAdmin(true)}
                className="whitespace-nowrap shrink-0"
              >
                Ajukan Ulang
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant={isRejected ? 'outline' : 'default'}
              onClick={handleRefresh}
              disabled={refreshing}
              className="whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Periksa Status ACC
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- DEFAULT GATE VIEW: MODE TABS (MASUK / DAFTAR) + 3 ROLE CHOICES ---
  const roles: Array<{
    key: AuthRoleIntent;
    title: string;
    subtitle: string;
    domainBadge: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      key: 'STUDENT',
      title: 'Siswa',
      subtitle: 'Peserta SOS & siswa reguler Semesta',
      domainBadge: '@semesta.sch.id',
      icon: GraduationCap,
    },
    {
      key: 'PARENT',
      title: 'Orang Tua',
      subtitle: 'Portal pantau putra/putri (1 Siswa = 1 Orang Tua)',
      domainBadge: 'Gmail Pribadi',
      icon: UserCheck,
    },
    {
      key: 'ADMIN',
      title: 'Admin & Management',
      subtitle: 'Pembina, Koordinator SOS, & Management',
      domainBadge: '@semesta.sch.id',
      icon: ShieldCheck,
    },
  ];

  const ctaText =
    mode === 'LOGIN'
      ? `Masuk sebagai ${roles.find((r) => r.key === roleIntent)?.title} dengan Google`
      : roleIntent === 'PARENT'
      ? 'Verifikasi Gmail untuk Daftar Orang Tua'
      : roleIntent === 'ADMIN'
      ? 'Ajukan Daftar Admin dengan Google (@semesta.sch.id)'
      : 'Daftar Siswa dengan Google (@semesta.sch.id)';

  return (
    <div className="space-y-5">
      {!compactHeader && (
        <div className="flex flex-col items-center text-center space-y-2 pb-1">
          <div className="rounded-xl bg-white p-2.5 border border-slate-200 shadow-xs">
            <img src={LOGO_BASE64} alt="Logo SOS" className="h-10 w-10 object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">SOS System (Beta)</h1>
            <p className="text-xs text-slate-500">Semesta Olympiad Squad Management System</p>
          </div>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('LOGIN')}
          className={`rounded-md py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
            mode === 'LOGIN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Masuk (Login)
        </button>
        <button
          type="button"
          onClick={() => setMode('REGISTER')}
          className={`rounded-md py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
            mode === 'REGISTER' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Daftar (Register)
        </button>
      </div>

      {/* Role Options */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {mode === 'LOGIN' ? 'Pilih Jenis Akun untuk Masuk' : 'Pilih Peran yang Didaftarkan'}
        </Label>
        <div className="grid gap-2.5">
          {roles.map((r) => {
            const Icon = r.icon;
            const selected = roleIntent === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRoleIntent(r.key)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                  selected
                    ? 'border-slate-900 bg-slate-900/[0.03] ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                    selected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{r.title}</span>
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 whitespace-nowrap shrink-0">
                      {r.domainBadge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{r.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contextual Role Instructions & Admin Register Fields */}
      {mode === 'REGISTER' && roleIntent === 'PARENT' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-slate-600 shrink-0" />
            Alur Pendaftaran Akun Orang Tua
          </p>
          <p>
            1. Verifikasi email Google pribadi (Gmail, bukan @semesta.sch.id).
            <br />
            2. Pilih 1 siswa yang belum memiliki akun orang tua (nama otomatis: <span className="font-medium text-slate-800">Parent [Nama Siswa]</span>).
            <br />
            3. Hubungi Koordinator SOS via WhatsApp untuk persetujuan (ACC) Management.
          </p>
        </div>
      )}

      {mode === 'REGISTER' && roleIntent === 'ADMIN' && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="preAdminRole" className="text-xs font-semibold text-slate-700">
              Peran Admin yang Diajukan
            </Label>
            <Select
              value={adminRoleChoice}
              onValueChange={(val) =>
                setAdminRoleChoice(val as UserRole.ADMIN | UserRole.ADMIN_SOS | UserRole.ADMIN_STUDENT)
              }
            >
              <SelectTrigger id="preAdminRole" className="bg-white">
                <SelectValue>{getAdminRoleLabel(adminRoleChoice)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.ADMIN_SOS}>Admin SOS (Pembina / Koordinator)</SelectItem>
                <SelectItem value={UserRole.ADMIN_STUDENT}>Admin Siswa (Asrama / Kultur)</SelectItem>
                <SelectItem value={UserRole.ADMIN}>Admin Umum</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preAdminNotes" className="text-xs font-semibold text-slate-700">
              Keterangan / Jabatan (Opsional)
            </Label>
            <Input
              id="preAdminNotes"
              placeholder="cth. Pembina OSN Kimia / Koordinator SMP"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              maxLength={500}
              className="bg-white"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Pendaftaran Admin menggunakan email <span className="font-medium">@semesta.sch.id</span> dan wajib menunggu ACC dari Management.
          </p>
        </div>
      )}

      {mode === 'REGISTER' && roleIntent === 'STUDENT' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            Siswa wajib menggunakan email sekolah <span className="font-medium text-slate-800">@semesta.sch.id</span>. Email pribadi (Gmail) hanya dapat digunakan pada menu Orang Tua.
          </span>
        </div>
      )}

      <Button
        type="button"
        size="lg"
        className="w-full h-11 text-sm font-medium gap-2"
        onClick={handleGoogleContinue}
        disabled={submitting}
      >
        <GoogleIcon />
        <span>{submitting ? 'Menghubungkan ke Google...' : ctaText}</span>
      </Button>
    </div>
  );
}

interface AuthPortalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: AuthMode;
  defaultRole?: AuthRoleIntent;
}

export function AuthPortalModal({
  open,
  onOpenChange,
  defaultMode = 'LOGIN',
  defaultRole = 'STUDENT',
}: AuthPortalModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[92vh] overflow-y-auto">
        <DialogHeader className="pb-1">
          <div className="flex items-center gap-2.5">
            <img src={LOGO_BASE64} alt="Logo SOS" className="h-7 w-7 object-contain" />
            <div>
              <DialogTitle className="text-lg">Portal Akses SOS System</DialogTitle>
              <DialogDescription className="text-xs">
                Pilih peran Anda untuk masuk atau mendaftar ke sistem Semesta Olympiad Squad.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <AuthPortalContent
          defaultMode={defaultMode}
          defaultRole={defaultRole}
          compactHeader
        />
      </DialogContent>
    </Dialog>
  );
}
