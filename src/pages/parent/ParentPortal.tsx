import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Laptop,
  MessageCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MedalType, RegistrationStatus } from '../../types';
import {
  getParentPortalChildBundle,
  ParentChildBundle,
  SOS_COORDINATORS,
} from '../../services/parentService';
import { Button, buttonVariants } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { cn } from '../../lib/utils';

type RegFilterTab = 'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED';

const MEDAL_CONFIG: Record<MedalType, { label: string; colorClass: string; iconBg: string }> = {
  [MedalType.GOLD]: {
    label: 'Medali Emas',
    colorClass: 'text-amber-700',
    iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
  },
  [MedalType.SILVER]: {
    label: 'Medali Perak',
    colorClass: 'text-slate-700',
    iconBg: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  [MedalType.BRONZE]: {
    label: 'Medali Perunggu',
    colorClass: 'text-orange-700',
    iconBg: 'bg-orange-50 text-orange-600 border-orange-200',
  },
  [MedalType.FINALS]: {
    label: 'Finalis',
    colorClass: 'text-blue-700',
    iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  [MedalType.PARTICIPANT]: {
    label: 'Peserta',
    colorClass: 'text-slate-600',
    iconBg: 'bg-slate-50 text-slate-500 border-slate-200',
  },
};

const REG_STATUS_CONFIG: Record<
  RegistrationStatus,
  { label: string; colorClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  [RegistrationStatus.APPROVED]: {
    label: 'Disetujui',
    colorClass: 'text-emerald-700',
    icon: CheckCircle2,
  },
  [RegistrationStatus.PENDING]: {
    label: 'Menunggu ACC',
    colorClass: 'text-amber-700',
    icon: Clock,
  },
  [RegistrationStatus.REJECTED]: {
    label: 'Ditolak',
    colorClass: 'text-red-700',
    icon: XCircle,
  },
};

function getInitials(name?: string): string {
  const clean = (name || '').trim();
  if (!clean) return 'OS';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatFieldSummary(field?: string[] | string): string {
  if (!field) return '';
  const list = Array.isArray(field) ? field : [field];
  if (list.length <= 3) return list.join(', ');
  return `${list.slice(0, 3).join(', ')} +${list.length - 3} bidang`;
}

export function ParentPortal() {
  const { userProfile } = useAuth();
  const linkedStudentIds = userProfile?.linkedStudentIds || [];
  const linkedStudentNames = userProfile?.linkedStudentNames || [];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [bundle, setBundle] = useState<ParentChildBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Interactive filters & expansion states
  const [regTab, setRegTab] = useState<RegFilterTab>('ALL');
  const [regSearch, setRegSearch] = useState('');
  const [showAllRegs, setShowAllRegs] = useState(false);
  const [showAllGuidance, setShowAllGuidance] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [coordinatorModalOpen, setCoordinatorModalOpen] = useState(false);

  const activeStudentId = linkedStudentIds[selectedIndex] || linkedStudentIds[0] || '';
  const activeFallbackName = linkedStudentNames[selectedIndex] || linkedStudentNames[0] || '';

  useEffect(() => {
    if (selectedIndex >= linkedStudentIds.length && linkedStudentIds.length > 0) {
      setSelectedIndex(0);
    }
  }, [linkedStudentIds.length, selectedIndex]);

  useEffect(() => {
    setAvatarError(false);
    setRegTab('ALL');
    setRegSearch('');
    setShowAllRegs(false);
    setShowAllGuidance(false);

    if (!activeStudentId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadChild = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const data = await getParentPortalChildBundle(activeStudentId, activeFallbackName);
        if (!cancelled) {
          setBundle(data);
        }
      } catch (err) {
        console.error('Error loading parent portal child bundle:', err);
        if (!cancelled) {
          setErrorMsg('Gagal memuat data siswa. Silakan muat ulang halaman.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadChild();
    return () => {
      cancelled = true;
    };
  }, [activeStudentId, activeFallbackName]);

  const metrics = useMemo(() => {
    if (!bundle) {
      return {
        totalRegs: 0,
        approvedRegs: 0,
        pendingRegs: 0,
        rejectedRegs: 0,
        totalPoints: 0,
        totalAchievements: 0,
        totalLogs: 0,
        totalHours: 0,
        totalQuestions: 0,
        totalPages: 0,
      };
    }

    const totalRegs = bundle.registrations.length;
    const approvedRegs = bundle.registrations.filter(
      (r) => r.status === RegistrationStatus.APPROVED
    ).length;
    const pendingRegs = bundle.registrations.filter(
      (r) => r.status === RegistrationStatus.PENDING
    ).length;
    const rejectedRegs = bundle.registrations.filter(
      (r) => r.status === RegistrationStatus.REJECTED
    ).length;
    const totalPoints = bundle.achievements.reduce((acc, a) => acc + (a.points || 0), 0);
    const totalAchievements = bundle.achievements.length;
    const totalLogs = bundle.guidanceSummaries.length;
    const totalHours = bundle.guidanceSummaries.reduce(
      (acc, g) => acc + (g.studyHours || 0),
      0
    );
    const totalQuestions = bundle.guidanceSummaries.reduce(
      (acc, g) => acc + (g.questionsCompleted || 0),
      0
    );
    const totalPages = bundle.guidanceSummaries.reduce(
      (acc, g) => acc + (g.summaryPages || 0),
      0
    );

    return {
      totalRegs,
      approvedRegs,
      pendingRegs,
      rejectedRegs,
      totalPoints,
      totalAchievements,
      totalLogs,
      totalHours,
      totalQuestions,
      totalPages,
    };
  }, [bundle]);

  const filteredRegistrations = useMemo(() => {
    if (!bundle) return [];
    const q = regSearch.trim().toLowerCase();
    return bundle.registrations.filter((reg) => {
      if (regTab === 'APPROVED' && reg.status !== RegistrationStatus.APPROVED) return false;
      if (regTab === 'PENDING' && reg.status !== RegistrationStatus.PENDING) return false;
      if (regTab === 'REJECTED' && reg.status !== RegistrationStatus.REJECTED) return false;

      if (!q) return true;
      const comp = bundle.competitionsMap[reg.competitionId];
      const title = (reg.competitionTitle || comp?.title || '').toLowerCase();
      const fields = Array.isArray(comp?.field)
        ? comp.field.join(' ').toLowerCase()
        : String(comp?.field || '').toLowerCase();
      return title.includes(q) || fields.includes(q);
    });
  }, [bundle, regTab, regSearch]);

  const visibleRegistrations = showAllRegs
    ? filteredRegistrations
    : filteredRegistrations.slice(0, 5);

  const visibleGuidance = bundle
    ? showAllGuidance
      ? bundle.guidanceSummaries
      : bundle.guidanceSummaries.slice(0, 4)
    : [];

  if (linkedStudentIds.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <UserCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Belum Ada Siswa Tertaut</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Akun Orang Tua Anda belum dihubungkan dengan data siswa. Silakan hubungi Koordinator SOS untuk konfirmasi.
          </p>
        </div>
      </div>
    );
  }

  const student = bundle?.student;
  const permit = bundle?.permit;
  const permitLetter = bundle?.permitLetter;
  const displayName = loading ? activeFallbackName || 'Memuat data siswa...' : bundle?.displayName || 'Siswa SOS';
  const photoUrl = !avatarError && student?.documents?.photoUrl ? student.documents.photoUrl : '';

  const permitStatusDisplay = !permit
    ? {
        label: 'Belum Terdaftar',
        tone: 'text-slate-700',
        surface: 'bg-slate-100 text-slate-600',
        icon: ShieldAlert,
      }
    : permit.status === 'APPROVED'
    ? {
        label: 'Aktif / Disetujui',
        tone: 'text-emerald-700',
        surface: 'bg-emerald-50 text-emerald-700',
        icon: ShieldCheck,
      }
    : permit.status === 'DUE'
    ? {
        label: 'Perlu Perpanjangan',
        tone: 'text-amber-700',
        surface: 'bg-amber-50 text-amber-700',
        icon: Clock,
      }
    : {
        label: 'Belum Memiliki Izin',
        tone: 'text-rose-700',
        surface: 'bg-rose-50 text-rose-700',
        icon: XCircle,
      };

  const PermitIcon = permitStatusDisplay.icon;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Top Student Profile Banner (Single Focal Anchor) */}
      <section className="rounded-xl border border-slate-200/90 bg-white px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 text-white flex items-center justify-center font-bold text-lg tracking-tight">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{getInitials(displayName)}</span>
              )}
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
                <span>Portal Pemantauan Orang Tua</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-700">{userProfile?.relationship || 'Wali'}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate">
                {displayName}
              </h1>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>
                  {student?.grade || permit?.grade
                    ? `Kelas ${student?.grade || permit?.grade}`
                    : 'Kelas belum dilengkapi'}
                </span>
                <span aria-hidden="true">·</span>
                <span>Bidang {student?.osnField || permit?.osnField || 'Umum'}</span>
                {(student?.nisn || permit?.regNumber) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {student?.nisn ? `NISN ${student.nisn}` : permit?.regNumber}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {linkedStudentIds.length > 1 && (
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                {linkedStudentIds.map((sid, idx) => (
                  <button
                    key={sid}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0',
                      selectedIndex === idx
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    {linkedStudentNames[idx] || `Anak ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCoordinatorModalOpen(true)}
              className="whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Hubungi Koordinator
            </Button>

            {permit && (
              <Link
                to={`/permit/${permit.slug}`}
                className={cn(
                  buttonVariants({ variant: 'default', size: 'sm' }),
                  'whitespace-nowrap shrink-0'
                )}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Kartu QR Device
              </Link>
            )}
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* 4 Balanced KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Status Izin Device</span>
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', permitStatusDisplay.surface)}>
              <Laptop className="h-4 w-4" />
            </div>
          </div>
          <div className={cn('mt-3 flex items-center gap-1.5 text-base font-bold', permitStatusDisplay.tone)}>
            <PermitIcon className="h-4 w-4 shrink-0" />
            <span>{loading ? '...' : permitStatusDisplay.label}</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            {permit ? `${permit.unit} · ${permit.regNumber}` : 'Belum terdaftar di data izin'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Partisipasi Lomba</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {loading ? '...' : metrics.totalRegs}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {metrics.approvedRegs} Disetujui · {metrics.pendingRegs} Menunggu
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Prestasi & Poin</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {loading ? '...' : `${metrics.totalPoints} Poin`}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {metrics.totalAchievements} Penghargaan tercatat
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-5 transition-colors hover:border-slate-300">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Laporan Bimbingan</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {loading ? '...' : `${metrics.totalLogs} Sesi`}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {metrics.totalHours} Jam belajar · {metrics.totalQuestions} Soal
          </p>
        </div>
      </div>

      {/* Main 2-Column Dashboard */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
            <div className="h-80 rounded-xl border border-slate-200 bg-white animate-pulse" />
          </div>
          <div className="lg:col-span-5 space-y-6">
            <div className="h-52 rounded-xl border border-slate-200 bg-white animate-pulse" />
            <div className="h-80 rounded-xl border border-slate-200 bg-white animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): Device Permit + Competitions */}
          <div className="lg:col-span-7 space-y-6">
            {/* Device Permit Card */}
            <section className="rounded-xl border border-slate-200/90 bg-white overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Informasi Perizinan Device
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Status penggunaan laptop/tablet pembelajaran Olimpiade Semesta
                  </p>
                </div>
                {permit && (
                  <Link
                    to={`/permit/pdf/${permit.unit}`}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'whitespace-nowrap shrink-0'
                    )}
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    Surat Resmi {permit.unit}
                  </Link>
                )}
              </div>

              {permit ? (
                <div className="divide-y divide-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                    <div className="px-6 py-4 space-y-3">
                      <div>
                        <div className="text-xs text-slate-500">Nomor Registrasi</div>
                        <div className="font-mono text-sm font-semibold text-slate-900 mt-0.5 tabular-nums">
                          {permit.regNumber}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Perangkat Terdaftar</div>
                        <div className="text-sm font-medium text-slate-900 mt-0.5">
                          {permit.deviceName || 'Belum diisi siswa'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">MAC Address / ID Perangkat</div>
                        <div className="font-mono text-xs text-slate-700 mt-0.5 tabular-nums">
                          {permit.deviceMac || 'Belum tercatat'}
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 space-y-3">
                      <div>
                        <div className="text-xs text-slate-500">Status Perizinan</div>
                        <div className={cn('inline-flex items-center gap-1.5 text-sm font-semibold mt-0.5', permitStatusDisplay.tone)}>
                          <PermitIcon className="h-4 w-4 shrink-0" />
                          <span>{permitStatusDisplay.label}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Masa Berlaku Izin</div>
                        <div className="text-sm font-medium text-slate-900 mt-0.5">
                          {permit.rules.validityPeriod}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Jadwal Belajar Terizinkan</div>
                        <div className="text-xs text-slate-700 mt-1 space-y-1 tabular-nums">
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">EduOS Camp</span>
                            <span className="font-medium text-slate-800">{permit.rules.eduOsCampHours}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">Sesi Malam</span>
                            <span className="font-medium text-slate-800">{permit.rules.nightStudyHours}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {permitLetter && (
                    <div className="bg-slate-50/70 px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="truncate">
                        Dokumen aktif: <span className="text-slate-700 font-medium">{permitLetter.title}</span> ({permitLetter.date})
                      </span>
                      <Link
                        to={`/permit/${permit.slug}`}
                        className="font-medium text-slate-900 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        Lihat Kartu & Detail
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <Laptop className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-medium text-slate-700">Belum Ada Data Izin Device</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Hubungi Koordinator SOS jika perangkat belajar anak memerlukan pendaftaran izin resmi.
                  </p>
                </div>
              )}
            </section>

            {/* Competitions Registration Feed */}
            <section className="rounded-xl border border-slate-200/90 bg-white overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Kompetisi & Pendaftaran Lomba
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pantau pengajuan lomba, status persetujuan, dan progres babak anak
                    </p>
                  </div>
                </div>

                {bundle && bundle.registrations.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                    <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80">
                      {(
                        [
                          { key: 'ALL', label: `Semua (${metrics.totalRegs})` },
                          { key: 'APPROVED', label: `Disetujui (${metrics.approvedRegs})` },
                          { key: 'PENDING', label: `Menunggu (${metrics.pendingRegs})` },
                          ...(metrics.rejectedRegs > 0
                            ? [{ key: 'REJECTED' as RegFilterTab, label: `Ditolak (${metrics.rejectedRegs})` }]
                            : []),
                        ] as Array<{ key: RegFilterTab; label: string }>
                      ).map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setRegTab(tab.key);
                            setShowAllRegs(false);
                          }}
                          className={cn(
                            'px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0',
                            regTab === tab.key
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full sm:w-52">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Cari lomba..."
                        value={regSearch}
                        onChange={(e) => setRegSearch(e.target.value)}
                        className="h-8 pl-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {filteredRegistrations.length > 0 ? (
                <>
                  <div className="divide-y divide-slate-100">
                    {visibleRegistrations.map((reg) => {
                      const comp = bundle?.competitionsMap[reg.competitionId];
                      const statusInfo = REG_STATUS_CONFIG[reg.status] || {
                        label: reg.status,
                        colorClass: 'text-slate-600',
                        icon: Clock,
                      };
                      const StatusIcon = statusInfo.icon;
                      const totalRounds = reg.roundsChecklist?.length || 0;
                      const passedCount = (reg.roundsChecklist || []).filter((rc) => rc.passed).length;
                      const progressPct = totalRounds > 0 ? Math.round((passedCount / totalRounds) * 100) : 0;
                      const fieldSummary = formatFieldSummary(comp?.field);

                      return (
                        <div key={reg.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                              {reg.competitionTitle || comp?.title || 'Kompetisi'}
                            </h3>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap shrink-0',
                                statusInfo.colorClass
                              )}
                            >
                              <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                              {statusInfo.label}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                            {fieldSummary && (
                              <>
                                <span>{fieldSummary}</span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            {comp?.type && (
                              <>
                                <span>{comp.type}</span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <span className="tabular-nums">
                              Daftar: {format(new Date(reg.createdAt), 'dd MMM yyyy', { locale: localeId })}
                            </span>
                          </div>

                          {totalRounds > 0 && (
                            <div className="flex items-center gap-3 pt-0.5">
                              <div className="flex-1 max-w-[180px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600 rounded-full transition-all"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-slate-600 tabular-nums">
                                Progres Babak: {passedCount}/{totalRounds} lolos
                              </span>
                            </div>
                          )}

                          {reg.notes && (
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Catatan: {reg.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {filteredRegistrations.length > 5 && (
                    <div className="border-t border-slate-100 px-6 py-3 bg-slate-50/50 flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllRegs((v) => !v)}
                        className="text-xs text-slate-700 hover:text-slate-900"
                      >
                        {showAllRegs ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5 mr-1.5" />
                            Tampilkan Ringkas
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5 mr-1.5" />
                            Lihat Semua ({filteredRegistrations.length} Lomba)
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center space-y-1.5">
                  <Trophy className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-medium text-slate-700">
                    {bundle && bundle.registrations.length > 0
                      ? 'Tidak ada lomba yang sesuai filter.'
                      : 'Belum Ada Pendaftaran Lomba'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {bundle && bundle.registrations.length > 0
                      ? 'Ubah kata kunci pencarian atau pilih tab status lainnya.'
                      : 'Riwayat pengajuan lomba siswa akan tampil secara otomatis di sini.'}
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Right Column (5 cols): Achievements + Guidance */}
          <div className="lg:col-span-5 space-y-6">
            {/* Achievements & Medals */}
            <section className="rounded-xl border border-slate-200/90 bg-white overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Rekap Prestasi & Penghargaan
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Capaian medali dan poin pembinaan Olimpiade
                  </p>
                </div>
                {metrics.totalPoints > 0 && (
                  <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
                    {metrics.totalPoints} Poin
                  </span>
                )}
              </div>

              {bundle && bundle.achievements.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {bundle.achievements.map((ach) => {
                    const comp = bundle.competitionsMap[ach.competitionId];
                    const medal = MEDAL_CONFIG[ach.medalType] || {
                      label: ach.medalType,
                      colorClass: 'text-slate-700',
                      iconBg: 'bg-slate-50 text-slate-600 border-slate-200',
                    };
                    return (
                      <div
                        key={ach.id}
                        className="px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                              medal.iconBg
                            )}
                          >
                            <Award className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {comp?.title || 'Kompetisi Sains'}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                              <span className={cn('font-semibold', medal.colorClass)}>
                                {medal.label}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                {format(new Date(ach.createdAt), 'dd MMM yyyy', { locale: localeId })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
                          +{ach.points}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    <Award className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Belum Ada Prestasi Tercatat</p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    Capaian medali dan poin Olimpiade anak akan otomatis tampil di sini setelah diverifikasi pembina.
                  </p>
                </div>
              )}
            </section>

            {/* Guidance Academic Summary */}
            <section className="rounded-xl border border-slate-200/90 bg-white overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    Ringkasan Bimbingan Akademik
                  </h2>
                  {metrics.totalLogs > 0 && (
                    <span className="text-xs font-medium text-slate-500 tabular-nums shrink-0">
                      {metrics.totalHours} jam · {metrics.totalQuestions} soal
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Catatan progres belajar terbaru yang dilaporkan siswa
                </p>
              </div>

              {visibleGuidance.length > 0 ? (
                <>
                  <div className="divide-y divide-slate-100">
                    {visibleGuidance.map((log) => (
                      <div key={log.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {log.academicSubject}
                          </span>
                          <span className="text-xs text-slate-500 tabular-nums shrink-0">
                            {format(new Date(log.date), 'dd MMM yyyy', { locale: localeId })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                          {log.studyProgress}
                        </p>
                        {(log.studyHours !== undefined ||
                          log.questionsCompleted !== undefined ||
                          log.summaryPages !== undefined) && (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-0.5 tabular-nums">
                            {log.studyHours !== undefined && <span>{log.studyHours} jam belajar</span>}
                            {log.questionsCompleted !== undefined && (
                              <>
                                {log.studyHours !== undefined && <span aria-hidden="true">·</span>}
                                <span>{log.questionsCompleted} soal</span>
                              </>
                            )}
                            {log.summaryPages !== undefined && (
                              <>
                                {(log.studyHours !== undefined || log.questionsCompleted !== undefined) && (
                                  <span aria-hidden="true">·</span>
                                )}
                                <span>{log.summaryPages} hal. ringkasan</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {bundle && bundle.guidanceSummaries.length > 4 && (
                    <div className="border-t border-slate-100 px-6 py-2.5 bg-slate-50/40 flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllGuidance((v) => !v)}
                        className="text-xs text-slate-700 hover:text-slate-900"
                      >
                        {showAllGuidance ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5 mr-1.5" />
                            Tampilkan Ringkas
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5 mr-1.5" />
                            Lihat Semua ({bundle.guidanceSummaries.length} Sesi)
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <BookOpen className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-medium text-slate-700">Belum Ada Laporan Bimbingan</p>
                  <p className="text-xs text-slate-500">
                    Catatan belajar harian siswa akan muncul di sini setelah check-in diisi.
                  </p>
                </div>
              )}

              <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-3 text-xs text-slate-500 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>
                  Hanya menampilkan progres akademik. Catatan refleksi psikologis siswa dijaga kerahasiaannya.
                </span>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* SOS Coordinator Contact Modal */}
      <Dialog open={coordinatorModalOpen} onOpenChange={setCoordinatorModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Hubungi Koordinator SOS via WhatsApp</DialogTitle>
            <DialogDescription>
              Pilih koordinator sesuai unit sekolah putra/putri Anda untuk konsultasi izin device, pendaftaran lomba, atau perkembangan pembinaan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-2">
            {SOS_COORDINATORS.map((coord) => {
              const hour = new Date().getHours();
              const greeting =
                hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
              const msg = `Assalamualaikum / Selamat ${greeting} ${coord.name},\nSaya ${userProfile?.name || `Parent ${displayName}`} (${userProfile?.relationship || 'Wali'} dari ${displayName}) ingin berkonsultasi terkait pembinaan SOS. Terima kasih.`;
              return (
                <a
                  key={coord.id}
                  href={`https://wa.me/${coord.phone}?text=${encodeURIComponent(msg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{coord.name}</div>
                    <div className="text-xs text-slate-500">{coord.label}</div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap shrink-0">
                    <MessageCircle className="h-4 w-4" />
                    Chat WA
                  </span>
                </a>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
