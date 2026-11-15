import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Laptop,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MedalType, RegistrationStatus } from '../../types';
import { getParentPortalChildBundle, ParentChildBundle } from '../../services/parentService';
import { buttonVariants } from '../../components/ui/button';
import { cn } from '../../lib/utils';

const MEDAL_LABELS: Record<MedalType, { label: string; colorClass: string }> = {
  [MedalType.GOLD]: { label: 'Medali Emas', colorClass: 'text-amber-700' },
  [MedalType.SILVER]: { label: 'Medali Perak', colorClass: 'text-slate-700' },
  [MedalType.BRONZE]: { label: 'Medali Perunggu', colorClass: 'text-orange-700' },
  [MedalType.FINALS]: { label: 'Finalis', colorClass: 'text-blue-700' },
  [MedalType.PARTICIPANT]: { label: 'Peserta', colorClass: 'text-slate-600' },
};

const REG_STATUS_LABELS: Record<RegistrationStatus, { label: string; colorClass: string }> = {
  [RegistrationStatus.APPROVED]: { label: 'Disetujui', colorClass: 'text-emerald-700' },
  [RegistrationStatus.PENDING]: { label: 'Menunggu Persetujuan', colorClass: 'text-amber-700' },
  [RegistrationStatus.REJECTED]: { label: 'Ditolak', colorClass: 'text-red-700' },
};

export function ParentPortal() {
  const { userProfile } = useAuth();
  const linkedStudentIds = userProfile?.linkedStudentIds || [];
  const linkedStudentNames = userProfile?.linkedStudentNames || [];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [bundle, setBundle] = useState<ParentChildBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeStudentId = linkedStudentIds[selectedIndex] || linkedStudentIds[0] || '';
  const activeFallbackName = linkedStudentNames[selectedIndex] || linkedStudentNames[0] || '';

  useEffect(() => {
    if (selectedIndex >= linkedStudentIds.length && linkedStudentIds.length > 0) {
      setSelectedIndex(0);
    }
  }, [linkedStudentIds.length, selectedIndex]);

  useEffect(() => {
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
        totalPoints: 0,
        totalAchievements: 0,
        totalLogs: 0,
        totalHours: 0,
        totalQuestions: 0,
      };
    }

    const totalRegs = bundle.registrations.length;
    const approvedRegs = bundle.registrations.filter(
      (r) => r.status === RegistrationStatus.APPROVED
    ).length;
    const pendingRegs = bundle.registrations.filter(
      (r) => r.status === RegistrationStatus.PENDING
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

    return {
      totalRegs,
      approvedRegs,
      pendingRegs,
      totalPoints,
      totalAchievements,
      totalLogs,
      totalHours,
      totalQuestions,
    };
  }, [bundle]);

  if (linkedStudentIds.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3">
          <UserCheck className="h-10 w-10 text-slate-400 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">Belum Ada Siswa Tertaut</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Akun Orang Tua Anda belum dihubungkan dengan data siswa. Silakan hubungi Koordinator SOS untuk menautkan akun Anda dengan putra/putri Anda.
          </p>
        </div>
      </div>
    );
  }

  const student = bundle?.student;
  const permit = bundle?.permit;
  const permitLetter = bundle?.permitLetter;

  const permitStatusDisplay = !permit
    ? { label: 'Belum Terdaftar', tone: 'text-slate-600', icon: ShieldAlert }
    : permit.status === 'APPROVED'
    ? { label: 'Aktif / Disetujui', tone: 'text-emerald-700', icon: ShieldCheck }
    : permit.status === 'DUE'
    ? { label: 'Perlu Perpanjangan', tone: 'text-amber-700', icon: Clock }
    : { label: 'Belum Memiliki Izin', tone: 'text-red-700', icon: XCircle };

  const PermitIcon = permitStatusDisplay.icon;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Multi-Child Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Portal Pemantauan Orang Tua ({userProfile?.relationship || 'Wali'})
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-0.5">
            {loading ? activeFallbackName || 'Memuat data siswa...' : bundle?.displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
            <span>
              {student?.grade || permit?.grade
                ? `Kelas ${student?.grade || permit?.grade}`
                : 'Kelas belum dilengkapi'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Bidang {student?.osnField || permit?.osnField || 'Umum'}
            </span>
            {(student?.nisn || permit?.regNumber) && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {student?.nisn ? `NISN ${student.nisn}` : `No. Reg ${permit?.regNumber}`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          {permit && (
            <Link
              to={`/permit/${permit.slug}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'whitespace-nowrap shrink-0')}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Verifikasi QR Device
            </Link>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* 4 Compact KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Status Izin Device</span>
            <Laptop className="h-4 w-4 text-slate-400" />
          </div>
          <div className={cn('mt-2 flex items-center gap-1.5 text-lg font-bold', permitStatusDisplay.tone)}>
            <PermitIcon className="h-4 w-4 shrink-0" />
            <span>{loading ? '...' : permitStatusDisplay.label}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {permit ? `${permit.unit} · ${permit.regNumber}` : 'Belum ada catatan izin'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Partisipasi Lomba</span>
            <Trophy className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? '...' : metrics.totalRegs}
          </div>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {metrics.approvedRegs} Disetujui · {metrics.pendingRegs} Menunggu
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Prestasi & Poin</span>
            <Award className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? '...' : `${metrics.totalPoints} Poin`}
          </div>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {metrics.totalAchievements} Penghargaan tercatat
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Laporan Bimbingan</span>
            <BookOpen className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {loading ? '...' : `${metrics.totalLogs} Sesi`}
          </div>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {metrics.totalHours} Jam belajar · {metrics.totalQuestions} Soal
          </p>
        </div>
      </div>

      {/* Main 2-Column Dashboard */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <div className="h-56 rounded-lg border border-slate-200 bg-white animate-pulse" />
            <div className="h-64 rounded-lg border border-slate-200 bg-white animate-pulse" />
          </div>
          <div className="lg:col-span-5 space-y-6">
            <div className="h-56 rounded-lg border border-slate-200 bg-white animate-pulse" />
            <div className="h-64 rounded-lg border border-slate-200 bg-white animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Device Permit Card */}
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
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
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Nomor Registrasi</div>
                      <div className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                        {permit.regNumber}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Status Izin</div>
                      <div className={cn('font-semibold mt-0.5', permitStatusDisplay.tone)}>
                        {permitStatusDisplay.label}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Perangkat Terdaftar</div>
                      <div className="font-medium text-slate-900 mt-0.5">
                        {permit.deviceName || 'Belum diisi siswa'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">MAC Address / ID Perangkat</div>
                      <div className="font-mono text-slate-800 mt-0.5 tabular-nums">
                        {permit.deviceMac || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Masa Berlaku Izin</div>
                      <div className="font-medium text-slate-900 mt-0.5">
                        {permit.rules.validityPeriod}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Jam Belajar Terizinkan</div>
                      <div className="text-xs text-slate-700 mt-0.5 space-y-0.5">
                        <div>EduOS Camp: {permit.rules.eduOsCampHours}</div>
                        <div>Sesi Malam: {permit.rules.nightStudyHours}</div>
                      </div>
                    </div>
                  </div>

                  {permitLetter && (
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        Dokumen aktif: {permitLetter.title} ({permitLetter.date})
                      </span>
                      <Link
                        to={`/permit/${permit.slug}`}
                        className="font-medium text-slate-900 hover:underline inline-flex items-center gap-1"
                      >
                        Lihat Kartu & Detail Lengkap
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-slate-500">
                  Belum ada data izin device untuk siswa ini. Hubungi Koordinator SOS jika perangkat memerlukan pendaftaran izin resmi.
                </div>
              )}
            </section>

            {/* Competitions Registration List */}
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Kompetisi & Pendaftaran Lomba
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daftar pengajuan lomba dan progres babak yang diikuti anak
                </p>
              </div>

              {bundle && bundle.registrations.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {bundle.registrations.map((reg) => {
                    const comp = bundle.competitionsMap[reg.competitionId];
                    const statusInfo = REG_STATUS_LABELS[reg.status] || {
                      label: reg.status,
                      colorClass: 'text-slate-600',
                    };
                    const passedCount = (reg.roundsChecklist || []).filter((rc) => rc.passed).length;

                    return (
                      <div key={reg.id} className="px-5 py-4 space-y-1.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {reg.competitionTitle || comp?.title || 'Kompetisi'}
                          </h3>
                          <span className={cn('text-xs font-semibold shrink-0', statusInfo.colorClass)}>
                            {statusInfo.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {comp?.field && (
                            <>
                              <span>
                                {Array.isArray(comp.field) ? comp.field.join(', ') : comp.field}
                              </span>
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
                            Daftar:{' '}
                            {format(new Date(reg.createdAt), 'dd MMM yyyy', { locale: localeId })}
                          </span>
                          {reg.roundsChecklist && reg.roundsChecklist.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                Progres Babak: {passedCount}/{reg.roundsChecklist.length} lolos
                              </span>
                            </>
                          )}
                        </div>

                        {reg.notes && (
                          <p className="text-xs text-slate-600 pt-0.5">Catatan: {reg.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-slate-500">
                  Siswa belum memiliki catatan pendaftaran lomba pada periode ini.
                </div>
              )}
            </section>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-6">
            {/* Achievements & Medals */}
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Rekap Prestasi & Penghargaan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Capaian medali dan poin pembinaan Olimpiade
                </p>
              </div>

              {bundle && bundle.achievements.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {bundle.achievements.map((ach) => {
                    const comp = bundle.competitionsMap[ach.competitionId];
                    const medal = MEDAL_LABELS[ach.medalType] || {
                      label: ach.medalType,
                      colorClass: 'text-slate-700',
                    };
                    return (
                      <div
                        key={ach.id}
                        className="px-5 py-3.5 flex items-start justify-between gap-3"
                      >
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
                        <div className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
                          +{ach.points}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-slate-500">
                  Belum ada raihan medali atau penghargaan yang tercatat.
                </div>
              )}
            </section>

            {/* Guidance Academic Summary */}
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Ringkasan Bimbingan Akademik
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Catatan progres belajar terbaru yang dilaporkan siswa
                </p>
              </div>

              {bundle && bundle.guidanceSummaries.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {bundle.guidanceSummaries.slice(0, 8).map((log) => (
                    <div key={log.id} className="px-5 py-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {log.academicSubject}
                        </span>
                        <span className="text-xs text-slate-500 tabular-nums shrink-0">
                          {format(new Date(log.date), 'dd MMM yyyy', { locale: localeId })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {log.studyProgress}
                      </p>
                      {(log.studyHours !== undefined || log.questionsCompleted !== undefined || log.summaryPages !== undefined) && (
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
              ) : (
                <div className="p-6 text-center text-sm text-slate-500">
                  Belum ada laporan bimbingan belajar yang masuk.
                </div>
              )}

              <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>
                  Hanya menampilkan progres akademik. Catatan refleksi psikologis siswa dijaga kerahasiaannya.
                </span>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
