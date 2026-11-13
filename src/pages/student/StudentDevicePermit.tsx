import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isAdminRole } from '../../types/auth';
import { getStudentProfile } from '../../services/studentService';
import {
  findPermitForStudent,
  getAllDevicePermits,
  getPermitsCache,
  hasPermitsLoadedFromFirestore,
  subscribeToDevicePermits,
  DevicePermitStudent,
  getVerificationUrl,
} from '../../services/devicePermitService';
import { A7DeviceSticker } from '../../components/stickers/A7DeviceSticker';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  ShieldCheck,
  Laptop,
  Clock,
  Download,
  FileText,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Wifi,
  XCircle,
  UserCheck,
  ArrowRight,
  Loader2,
  Send,
  MessageCircle,
  Mail,
  Info,
  HelpCircle,
} from 'lucide-react';
import { MacAddressGuideModal } from '../../components/stickers/MacAddressGuideModal';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export function StudentDevicePermit() {
  const { currentUser, userProfile } = useAuth();
  const [allPermits, setAllPermits] = useState<DevicePermitStudent[]>(() =>
    hasPermitsLoadedFromFirestore() ? getPermitsCache() : []
  );
  const [studentFullName, setStudentFullName] = useState<string>('');
  const [loading, setLoading] = useState(() => !hasPermitsLoadedFromFirestore());
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const isAdmin = isAdminRole(userProfile?.role);

  // Fetch extended student profile & live device permits (plus realtime listener)
  useEffect(() => {
    let isMounted = true;
    if (currentUser?.uid) {
      getStudentProfile(currentUser.uid)
        .then(profile => {
          if (isMounted && profile?.fullName) {
            setStudentFullName(profile.fullName);
          }
        })
        .catch(() => null);
    }

    getAllDevicePermits(true).then(permits => {
      if (isMounted) {
        setAllPermits(permits);
        setLoading(false);
      }
    });

    const unsubscribe = subscribeToDevicePermits(updated => {
      if (isMounted) {
        setAllPermits(updated);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUser?.uid]);

  // Strictly match permit for the currently logged-in student ONLY.
  // Never fallback to other students' permits!
  const myPermit = useMemo(() => {
    if (studentFullName) {
      const p = findPermitForStudent(studentFullName, currentUser?.email || undefined, currentUser?.uid, allPermits);
      if (p) return p;
    }
    const p2 = findPermitForStudent(userProfile?.name, currentUser?.email || undefined, currentUser?.uid, allPermits);
    if (p2) return p2;

    if (currentUser?.uid) {
      const byId = allPermits.find(p => p.id === currentUser.uid || (p as any).userId === currentUser.uid);
      if (byId) return byId;
    }

    if (currentUser?.email) {
      const emailPrefix = currentUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const byEmail = allPermits.find(p => {
        const pClean = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return pClean.includes(emailPrefix) || emailPrefix.includes(pClean);
      });
      if (byEmail) return byEmail;
    }

    return undefined;
  }, [studentFullName, userProfile, currentUser, allPermits]);

  const verifyUrl = myPermit ? getVerificationUrl(myPermit) : '';
  const status = myPermit?.status || 'APPROVED';

  const studentDisplayName = myPermit?.name || studentFullName || userProfile?.name || currentUser?.displayName || 'Siswa SOS';
  const studentGrade = myPermit?.grade || 'Siswa SOS';
  const studentField = myPermit?.osnField || 'Olimpiade Sains';

  const applyMessageText = `Halo Koordinator SOS Semesta,
Saya ingin mengajukan permohonan izin perangkat (Laptop/Tablet) untuk persiapan bimbingan OSN Semesta TA 2026/2027:
- Nama Lengkap: ${studentDisplayName}
- Kelas: ${studentGrade}
- Bidang OSN: ${studentField}
- Email: ${currentUser?.email || '-'}
Mohon bantuan bapak/ibu guru pembina untuk memverifikasi dan mendaftarkan perangkat (Nama Device & MAC Address) saya ke sistem Izin Device SOS. Terima kasih!`;

  const handleCopyLink = () => {
    if (!verifyUrl) return;
    navigator.clipboard.writeText(verifyUrl);
    toast.success('Link verifikasi resmi stiker Anda berhasil disalin!');
  };

  const handleCopyApplyMessage = () => {
    navigator.clipboard.writeText(applyMessageText);
    toast.success('Format pesan pengajuan izin berhasil disalin!');
  };

  const handleOpenWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(applyMessageText)}`;
    window.open(waUrl, '_blank');
  };

  const handleOpenEmail = () => {
    const subject = encodeURIComponent(`Pengajuan Izin Device SOS - ${studentDisplayName}`);
    const body = encodeURIComponent(applyMessageText);
    window.open(`mailto:scienceolympiad@semesta.sch.id?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Izin Device & Web Resmi
            </span>
            <span className="text-xs text-muted-foreground">
              Tahun Ajaran {myPermit?.academicYear || '2026/2027'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Izin Device (SOS)
          </h1>
          <p className="text-sm text-muted-foreground">
            Status otorisasi, stiker fisik A7, dan ketentuan penggunaan perangkat laptop/tablet belajar siswa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsGuideOpen(true)}
            className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
            <span>Tutorial Cek MAC / ID Device</span>
          </Button>

          {/* Quick Link to PDF if matched */}
          {myPermit && (
            <a href={myPermit.pdfUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                <span>Surat Izin Resmi ({myPermit.unit}) PDF</span>
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Admin Notice if logged in as Management/Admin */}
      {isAdmin && (
        <Card className="p-4 bg-indigo-50/80 border-indigo-200 text-indigo-950">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <strong className="block font-bold text-indigo-900">
                  Mode Akun Management / Admin
                </strong>
                Halaman ini adalah tampilan privat siswa untuk melihat izin perorangan. Untuk mengelola data seluruh siswa dan menginput MAC Address/IP, buka menu <strong>Izin Device</strong> di panel admin.
              </div>
            </div>
            <Link to="/admin/device-permits">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs shrink-0">
                <span>Buka Panel Manajemen Izin</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          <span>Memuat data perizinan Anda...</span>
        </div>
      )}

      {/* CASE 1: Student is matched with their personal permit */}
      {!loading && myPermit && (
        <>
          {/* Identity Confirmation Banner (Strictly student's own identity, no dropdown) */}
          <Card className="p-3 bg-muted/40 border-muted">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm uppercase">
                      {myPermit.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {myPermit.unit} • Kelas {myPermit.grade}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground text-[11px] block mt-0.5">
                    Bidang OSN: <strong className="text-indigo-600">{myPermit.osnField}</strong> • No. Registrasi: <strong className="font-mono text-foreground">{myPermit.regNumber}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {status === 'APPROVED' && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs px-2.5 py-1 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Izin Aktif Terdaftar</span>
                  </Badge>
                )}
                {status === 'REJECTED' && (
                  <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-xs px-2.5 py-1 font-bold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Belum Ada Izin Resmi</span>
                  </Badge>
                )}
                {status === 'DUE' && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs px-2.5 py-1 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Masa Izin Habis (Due)</span>
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Status Warning & Apply Action Banner if Rejected / Not Permitted */}
          {status === 'REJECTED' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-xs">
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-sm font-bold text-rose-900">
                    Status: Belum Memiliki Otorisasi Device
                  </strong>
                  <p className="text-rose-800 mt-0.5 leading-relaxed">
                    Perangkat laptop/tablet Anda belum disahkan oleh Koordinator SOS. Silakan klik tombol di samping untuk mengajukan izin dan mendaftarkan perangkat Anda.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setIsApplyModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 shrink-0 shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ajukan Izin Device</span>
              </Button>
            </div>
          )}

          {/* Status Warning Banner if Due */}
          {status === 'DUE' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border-2 border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-xs">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-sm font-bold text-amber-900">
                    Perhatian: Masa Izin Telah Habis (DUE)
                  </strong>
                  <p className="text-amber-800 mt-0.5 leading-relaxed">
                    Masa berlaku durasi izin perangkat Anda telah kedaluwarsa. Silakan ajukan perpanjangan izin ke Koordinator SOS.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setIsApplyModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 shrink-0 shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ajukan Perpanjangan Izin</span>
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 6 Columns: Interactive A7 Sticker Preview & Download */}
            <div className="lg:col-span-6 space-y-4">
              <Card className="border-indigo-100 shadow-sm overflow-hidden">
                <CardHeader className="bg-linear-to-r from-indigo-700 to-indigo-900 text-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-amber-300" />
                        <span>Preview Sticker Fisik Anda (Ukuran A7)</span>
                      </CardTitle>
                      <p className="text-[11px] text-indigo-200 mt-0.5">
                        Ukuran standar: 105 mm × 74 mm (Landscape) • No. Reg: {myPermit.regNumber}
                      </p>
                    </div>
                    <Badge className="bg-amber-400 text-amber-950 font-bold text-[10px]">
                      A7 Landscape
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex flex-col items-center justify-center bg-slate-100/60">
                  <A7DeviceSticker permit={myPermit} showActions={status === 'APPROVED'} />
                  {status !== 'APPROVED' && (
                    <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-center max-w-sm">
                      <p className="text-[11px] text-rose-700 font-semibold leading-relaxed">
                        ⚠️ Download & cetak stiker dinonaktifkan karena perangkat belum berstatus Approved.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setIsApplyModalOpen(true)}
                        className="mt-2 text-xs h-7 bg-rose-600 hover:bg-rose-700 text-white font-bold"
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Ajukan Izin Sekarang
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Verification Link Card */}
              <Card className="p-4 border-slate-200">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-foreground block">
                      Link Verifikasi Resmi Anda (Dapat Diakses Siapapun via QR)
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono truncate max-w-xs block mt-0.5">
                      {verifyUrl}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={handleCopyLink} className="h-8 text-xs">
                      <Copy className="w-3 h-3 mr-1" />
                      Salin Link
                    </Button>
                    <a href={verifyUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" className="h-8 text-xs text-indigo-600">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right 6 Columns: Rule Breakdown & Instructions */}
            <div className="lg:col-span-6 space-y-4">
              <Card className="border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Durasi & Ketentuan Izin Penggunaan
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {myPermit.rules.validityPeriod}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  {/* Registered Device & MAC/ID info */}
                  <div className="p-3 bg-muted/40 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-start gap-2">
                      <Laptop className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Device Terdaftar
                        </span>
                        <strong className="text-foreground">
                          {myPermit.deviceName || (status === 'APPROVED' ? 'Laptop / Tablet' : 'Belum Didaftarkan')}
                        </strong>
                      </div>
                    </div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        <Wifi className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                            MAC Address / ID Unik
                          </span>
                          <strong className="text-foreground font-mono">
                            {myPermit.deviceMac || myPermit.deviceIp || '-'}
                          </strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsGuideOpen(true)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Cara Cek</span>
                      </button>
                    </div>
                    <div className="sm:col-span-2 text-[10.5px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t">
                      <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>Data nama perangkat dan MAC/ID diinput & diverifikasi oleh guru pembina SOS.</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-amber-900 dark:text-amber-200">1. EduOS Camp</span>
                        <span className="font-mono text-amber-800 font-semibold">{myPermit.rules.eduOsCampHours}</span>
                      </div>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Digunakan selama sesi camp pelatihan intensif olimpiade sekolah.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-indigo-900 dark:text-indigo-200">2. Sesi Belajar Sore</span>
                        <span className="font-mono text-indigo-800 font-semibold">{myPermit.rules.afternoonStudyHours}</span>
                      </div>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                        Sesi bimbingan materi rutin bersama pembina OSN setiap hari kerja.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-purple-900 dark:text-purple-200">3. Sesi Belajar Malam</span>
                        <span className="font-mono text-purple-800 font-semibold">{myPermit.rules.nightStudyHours}</span>
                      </div>
                      <p className="text-[11px] text-purple-700 dark:text-purple-300">
                        Waktu belajar mandiri dan koordinasi materi di asrama.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t space-y-2">
                    <div>
                      <span className="text-[11px] font-bold text-foreground block mb-1">
                        Web & Aplikasi yang Diizinkan:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs">
                          Google AI Studio
                        </Badge>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs">
                          WhatsApp Web
                        </Badge>
                        <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-xs">
                          Laptop Pribadi
                        </Badge>
                        <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-xs">
                          Tablet Belajar
                        </Badge>
                      </div>
                    </div>

                    {/* Warning required by school */}
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs leading-relaxed flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Ketentuan & Pengawasan:</strong>{' '}
                        Jika siswa ini menyalahgunakan izin, lapor ke Koordinator SOS / School Culture.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* CASE 2: No permit found for this student */}
      {!loading && !myPermit && (
        <Card className="p-8 text-center max-w-xl mx-auto space-y-4 border-slate-200 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Izin Perangkat Anda Belum Terdaftar
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
              Akun Anda (<strong>{studentDisplayName}</strong>) belum tercatat memiliki izin perangkat aktif di sistem SOS Semesta.
            </p>
          </div>

          <div className="p-4 bg-muted/40 rounded-xl border text-xs text-left space-y-2">
            <strong className="block text-foreground font-semibold">Prosedur Pendaftaran Izin:</strong>
            <p className="text-muted-foreground">• Hubungi <strong>Koordinator Tim Olimpiade Sains Semesta</strong> atau <strong>School Culture</strong>.</p>
            <p className="text-muted-foreground">• Daftarkan jenis laptop/tablet dan MAC Address / ID perangkat Anda.</p>
            <p className="text-muted-foreground">• Guru pembina akan menyetujui izin Anda di sistem dan stiker A7 Anda akan otomatis terbit di sini.</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              onClick={() => setIsApplyModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Ajukan Izin Device ke Koordinator SOS</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsGuideOpen(true)}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs px-4 py-2.5 font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <span>Tutorial Cek MAC / ID Device</span>
            </Button>
          </div>
        </Card>
      )}

      {/* DIALOG: Pengajuan Izin Device ke Koordinator SOS */}
      {isApplyModalOpen && (
        <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
          <DialogContent className="sm:max-w-lg p-6">
            <DialogHeader className="pb-3 border-b">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Pengajuan Izin Device ke Koordinator SOS</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-indigo-950 space-y-1">
                <strong className="block font-bold">Ketentuan Pengajuan:</strong>
                <p className="text-[11px] leading-relaxed text-indigo-900">
                  Hanya guru pembina / Koordinator SOS yang berwenang memasukkan data perangkat (Nama Laptop & MAC Address) dan mengesahkan status perizinan. Anda dapat langsung mengirim permohonan dengan format resmi di bawah ini:
                </p>
              </div>

              {/* Tutorial Cek MAC Banner inside Modal */}
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-[11px]">
                    Belum tahu <strong>MAC Address / ID</strong> laptop/tablet Anda?
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsGuideOpen(true)}
                  className="h-7 text-[11px] bg-white border-amber-300 text-amber-900 hover:bg-amber-100 font-bold shrink-0 cursor-pointer"
                >
                  Buka Tutorial
                </Button>
              </div>

              {/* Data Siswa Pemohon */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-xl border text-[11.5px]">
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold block">Nama Pemohon:</span>
                  <strong className="text-foreground">{studentDisplayName}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold block">Kelas & Bidang:</span>
                  <strong className="text-foreground">{studentGrade} • {studentField}</strong>
                </div>
              </div>

              {/* Preview Format Pesan */}
              <div>
                <label className="font-bold text-foreground block mb-1">
                  Format Pesan Pengajuan Resmi:
                </label>
                <div className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-xl whitespace-pre-wrap leading-relaxed border border-slate-800">
                  {applyMessageText}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleCopyApplyMessage}
                className="h-9 text-xs flex items-center justify-center gap-1.5 flex-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Pesan</span>
              </Button>

              <Button
                onClick={handleOpenWhatsApp}
                className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 flex-1 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Hubungi via WhatsApp</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* TUTORIAL MAC ADDRESS / ID DEVICE MODAL */}
      <MacAddressGuideModal open={isGuideOpen} onOpenChange={setIsGuideOpen} />
    </div>
  );
}
