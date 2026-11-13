import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getDevicePermitByIdOrSlug,
  getAllDevicePermits,
  getDevicePermitFromCache,
  getPermitsCache,
  hasPermitsLoadedFromFirestore,
  subscribeToDevicePermits,
  getDevicePermitLetters,
  getPermitLettersCache,
  subscribeToDevicePermitLetters,
  createSlug,
  DevicePermitStudent,
  DevicePermitLetter,
  SchoolUnit,
} from '../../services/devicePermitService';
import { A7DeviceSticker } from '../../components/stickers/A7DeviceSticker';
import { LOGO_BASE64 } from '../../lib/constants';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  FileText,
  Download,
  ExternalLink,
  Laptop,
  Globe,
  Search,
  Building2,
  AlertCircle,
  Award,
  ChevronRight,
  AlertTriangle,
  XCircle,
  Wifi,
  Info,
  Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export function PublicPermitVerification() {
  const { id } = useParams<{ id: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Only pre-populate from cache if Firestore has already loaded in this session
  const [currentPermit, setCurrentPermit] = useState<DevicePermitStudent | undefined>(() => {
    return id && hasPermitsLoadedFromFirestore() ? getDevicePermitFromCache(id) : undefined;
  });

  const [allPermits, setAllPermits] = useState<DevicePermitStudent[]>(() =>
    hasPermitsLoadedFromFirestore() ? getPermitsCache() : []
  );

  const [permitLetters, setPermitLetters] = useState<Record<SchoolUnit, DevicePermitLetter>>(() =>
    getPermitLettersCache()
  );

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getDevicePermitLetters(true).then(letters => {
      if (isMounted) setPermitLetters(letters);
    });

    if (id) {
      getDevicePermitByIdOrSlug(id).then(permit => {
        if (isMounted) {
          setCurrentPermit(permit);
          setLoading(false);
        }
      });
    } else {
      getAllDevicePermits(true).then(permits => {
        if (isMounted) {
          setAllPermits(permits);
          setLoading(false);
        }
      });
    }

    // Real-time listener so updates made in Admin Management appear instantaneously
    const unsubscribe = subscribeToDevicePermits(updatedList => {
      if (!isMounted) return;
      setAllPermits(updatedList);
      if (id) {
        const target = id.trim().toLowerCase();
        const match = updatedList.find(
          p =>
            p.id.toLowerCase() === target ||
            p.regNumber.toLowerCase() === target ||
            p.slug.toLowerCase() === target ||
            createSlug(p.name) === target ||
            p.name.toLowerCase() === target
        );
        if (match) {
          setCurrentPermit(match);
        }
      }
      setLoading(false);
    });

    const unsubLetters = subscribeToDevicePermitLetters(updatedLetters => {
      if (isMounted) {
        setPermitLetters(updatedLetters);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      unsubLetters();
    };
  }, [id]);

  const filteredPermits = useMemo(() => {
    if (!searchTerm.trim()) return allPermits;
    const q = searchTerm.toLowerCase();
    return allPermits.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.regNumber.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.grade.toLowerCase().includes(q) ||
        p.osnField.toLowerCase().includes(q) ||
        p.unit.toLowerCase().includes(q) ||
        (p.deviceName && p.deviceName.toLowerCase().includes(q)) ||
        (p.deviceMac && p.deviceMac.toLowerCase().includes(q)) ||
        (p.deviceIp && p.deviceIp.toLowerCase().includes(q))
    );
  }, [allPermits, searchTerm]);

  if (id && loading && !currentPermit) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-semibold text-slate-700">Memverifikasi data izin perangkat resmi...</p>
        <p className="text-xs text-slate-500">Mengambil status terbaru dari database Semesta Olympiad Squad</p>
      </div>
    );
  }

  // If a specific student permit was requested and found:
  if (currentPermit) {
    const isSMP = currentPermit.unit === 'SMP';
    const status = currentPermit.status || 'APPROVED';

    let statusBadgeBg = 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40';
    let statusText = 'TERVERIFIKASI RESMI';
    let StatusIcon = CheckCircle2;
    let cardAlert = null;

    if (status === 'REJECTED') {
      statusBadgeBg = 'bg-rose-500/20 text-rose-200 border-rose-400/40';
      statusText = 'IZIN DITOLAK / DICABUT';
      StatusIcon = XCircle;
      cardAlert = (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-start gap-3 text-rose-900">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="block text-sm font-bold text-rose-800">PERINGATAN: IZIN INI TELAH DICABUT / DITOLAK</strong>
            Siswa ini tidak lagi memiliki otorisasi untuk membawa atau mengoperasikan perangkat/akses di luar ketentuan standar sekolah.
          </div>
        </div>
      );
    } else if (status === 'DUE') {
      statusBadgeBg = 'bg-amber-500/20 text-amber-200 border-amber-400/40';
      statusText = 'MASA IZIN TELAH HABIS (DUE)';
      StatusIcon = AlertTriangle;
      cardAlert = (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 text-amber-950">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="block text-sm font-bold text-amber-900">MASA BERLAKU IZIN SUDAH HABIS (DUE)</strong>
            Masa durasi izin perangkat telah kedaluwarsa. Siswa diwajibkan mengajukan perpanjangan izin melalui Koordinator Tim Olimpiade Sains Semesta.
          </div>
        </div>
      );
    }

    const headerGradient = isSMP
      ? 'from-indigo-800 via-indigo-900 to-purple-950'
      : 'from-emerald-800 via-emerald-900 to-teal-950';

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
        {/* Top Official Banner */}
        <header className={`bg-linear-to-r ${headerGradient} text-white shadow-lg`}>
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shrink-0">
                  <img src={LOGO_BASE64} alt="Logo" className="w-9 h-9 object-contain" />
                </div>
                <div>
                  <div className="text-[10px] sm:text-xs font-bold tracking-widest uppercase text-indigo-200">
                    SEMESTA BILINGUAL BOARDING SCHOOL
                  </div>
                  <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                    Verifikasi Resmi Izin Web & Device (SOS)
                  </h1>
                </div>
              </div>

              {/* Status Pill */}
              <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold shadow-xs ${statusBadgeBg}`}>
                <StatusIcon className="w-4 h-4" />
                <span>{statusText}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {cardAlert}

          {/* Status Validation Box */}
          <div className="p-4 sm:p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Surat Izin Authorized Device ({currentPermit.unit})
                  </h2>
                  <Badge variant="outline" className="text-xs px-2 py-0.5 font-bold border bg-indigo-50 text-indigo-900 border-indigo-200">
                    TA {currentPermit.academicYear || '2026/2027'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Nomor Registrasi:{' '}
                  <strong className="font-mono text-indigo-700 text-sm font-black">{currentPermit.regNumber || currentPermit.id}</strong> • Berlaku:{' '}
                  <strong>{currentPermit.rules.validityPeriod}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <a
                href={permitLetters[currentPermit.unit]?.url || currentPermit.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-initial"
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-9 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5 font-semibold"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Buka Surat Asli (PDF)</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </Button>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: Detail Izin, Durasi, dan Legalitas */}
            <div className="lg:col-span-7 space-y-5">
              {/* Student Identity Card */}
              <Card className="border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      Identitas Siswa Penerima Izin
                    </span>
                    <span className="font-mono text-xs text-slate-500 font-normal">
                      No. Reg: {currentPermit.regNumber}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Nama Lengkap Siswa
                    </span>
                    <span className="text-lg font-black text-slate-900 uppercase">
                      {currentPermit.name}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Unit & Kelas</span>
                      <strong className="text-slate-800">{currentPermit.unit} • Kelas {currentPermit.grade}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Bidang OSN</span>
                      <strong className="text-indigo-700">{currentPermit.osnField}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Jenis Kelamin</span>
                      <strong className="text-slate-800">
                        {currentPermit.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                      </strong>
                    </div>
                  </div>

                  {/* Registered Device & IP info */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-start gap-2">
                      <Laptop className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Nama / Jenis Device</span>
                        <strong className="text-slate-900">{currentPermit.deviceName || 'Laptop / Tablet'}</strong>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Wifi className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">MAC Address / ID Unik</span>
                        <strong className="text-slate-900 font-mono">{currentPermit.deviceMac || currentPermit.deviceIp || '-'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Warning Notice required by school */}
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs leading-relaxed flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">Ketentuan Pengawasan:</strong>{' '}
                      Jika siswa ini menyalahgunakan izin, lapor ke Koordinator SOS / School Culture.
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{currentPermit.schoolName}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Allowed Duration & Time Rules Card */}
              <Card className="border-slate-200 shadow-xs overflow-hidden">
                <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>DURASI & JADWAL PENGGUNAAN RESMI</span>
                  </div>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-semibold">
                    WIB
                  </span>
                </div>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                        1
                      </div>
                      <div>
                        <strong className="text-slate-900 block text-xs">EduOS Camp</strong>
                        <span className="text-slate-600 font-mono font-semibold">
                          {currentPermit.rules.eduOsCampHours}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs shrink-0">
                        2
                      </div>
                      <div>
                        <strong className="text-slate-900 block text-xs">Sesi Belajar Sore</strong>
                        <span className="text-slate-600 font-mono font-semibold">
                          {currentPermit.rules.afternoonStudyHours}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                      <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0">
                        3
                      </div>
                      <div>
                        <strong className="text-slate-900 block text-xs">Sesi Belajar Malam</strong>
                        <span className="text-slate-600 font-mono font-semibold">
                          {currentPermit.rules.nightStudyHours}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100">
                      <span className="text-[10px] font-bold text-indigo-800 uppercase flex items-center gap-1 mb-1">
                        <Globe className="w-3 h-3 text-indigo-600" /> Web di Chromebook:
                      </span>
                      <div className="font-semibold text-slate-800 space-y-0.5">
                        {currentPermit.rules.chromebookWebAccess.map((w, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1 mb-1">
                        <Laptop className="w-3 h-3 text-emerald-600" /> Device Tambahan (jika ada):
                      </span>
                      <div className="font-semibold text-slate-800 space-y-0.5">
                        {currentPermit.rules.allowedDevices.map((d, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Legal Signatories Card */}
              <Card className="border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span>Pejabat Penandatangan Surat Izin</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        {currentPermit.signatories.schoolCulture.title}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700 block mt-1">
                        {currentPermit.signatories.schoolCulture.role}
                      </span>
                      <strong className="text-xs text-slate-900 block mt-2">
                        {currentPermit.signatories.schoolCulture.name}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        {currentPermit.signatories.olympiadCoordinator.title}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700 block mt-1">
                        {currentPermit.signatories.olympiadCoordinator.role}
                      </span>
                      <strong className="text-xs text-slate-900 block mt-2">
                        {currentPermit.signatories.olympiadCoordinator.name}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200">
                      <span className="text-[10px] text-indigo-600 block font-semibold">
                        {currentPermit.signatories.principal.title}
                      </span>
                      <span className="text-[11px] font-bold text-indigo-900 block mt-1">
                        {currentPermit.signatories.principal.role}
                      </span>
                      <strong className="text-xs text-slate-900 block mt-2">
                        {currentPermit.signatories.principal.name}
                      </strong>
                    </div>
                  </div>

                  <div className="mt-3 text-center text-[11px] text-slate-500">
                    Diterbitkan di {currentPermit.rules.location}, tanggal {currentPermit.rules.issueDate}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right 5 Columns: Official A7 Sticker & Download */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    Sticker Resmi Authorized Device (A7)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">105 × 74 mm</span>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Sticker ini ditempelkan pada bagian luar laptop/tablet siswa sebagai tanda bukti izin resmi di lingkungan sekolah dan asrama.
                </p>

                {/* Sticker Render */}
                <div className="overflow-x-auto pb-1">
                  <div className="w-max mx-auto py-2">
                    <A7DeviceSticker permit={currentPermit} showActions={true} />
                  </div>
                </div>
              </div>

              {/* Direct PDF Link Card */}
              <div className="bg-indigo-50/70 rounded-2xl p-4 border border-indigo-200 shadow-xs space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Dokumen Surat Permohonan Izin Asli</span>
                </div>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  Surat resmi yang ditandatangani oleh Koordinator School Culture, Koordinator Tim Olimpiade, dan Kepala Sekolah.
                </p>
                <a
                  href={permitLetters[currentPermit.unit]?.url || currentPermit.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full"
                >
                  <Button
                    size="sm"
                    className="w-full h-8.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Surat Izin Resmi ({currentPermit.unit})</span>
                  </Button>
                </a>
              </div>

              {/* Back / Search Directory Link */}
              <div className="text-center pt-2">
                <Link
                  to="/permit"
                  className="text-xs text-slate-600 hover:text-indigo-600 inline-flex items-center gap-1 font-medium transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Lihat Daftar Seluruh Siswa Berizin</span>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // If no ID or ID not found, render searchable directory of authorized device permits:
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      <header className="bg-linear-to-r from-indigo-800 via-indigo-900 to-slate-900 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-bold mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
            <span>PORTAL VERIFIKASI RESMI • TANPA LOGIN</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Daftar Izin Web & Device Siswa SOS Semesta
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200 max-w-xl mx-auto">
            Verifikasi keabsahan stiker authorized device dan surat izin perangkat (laptop/tablet) Tim Olimpiade Sains Semesta TA 2026/2027.
          </p>

          <div className="pt-3 max-w-md mx-auto relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama siswa, nomor registrasi, kelas, atau bidang..."
              className="bg-white text-slate-900 pl-10 h-10 text-xs rounded-xl shadow-md border-0"
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* PDF Document Quick Access */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 border border-indigo-200 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <strong className="text-xs text-slate-900 block">Surat Izin SMP Semesta</strong>
                <span className="text-[11px] text-slate-500">Masa Berlaku: Okt 2026 - Mei 2027</span>
              </div>
            </div>
            <a href={permitLetters.SMP.url} target="_blank" rel="noreferrer" title={permitLetters.SMP.fileName}>
              <Button size="sm" variant="outline" className="h-8 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50">
                <Download className="w-3.5 h-3.5 mr-1" /> PDF
              </Button>
            </a>
          </div>

          <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <strong className="text-xs text-slate-900 block">Surat Izin SMA Semesta</strong>
                <span className="text-[11px] text-slate-500">Masa Berlaku: Okt 2026 - Mei 2027</span>
              </div>
            </div>
            <a href={permitLetters.SMA.url} target="_blank" rel="noreferrer" title={permitLetters.SMA.fileName}>
              <Button size="sm" variant="outline" className="h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                <Download className="w-3.5 h-3.5 mr-1" /> PDF
              </Button>
            </a>
          </div>
        </div>

        {/* List of Permitted Students */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              Daftar Siswa Berizin ({filteredPermits.length} Siswa)
            </span>
            <span className="text-[11px] text-slate-500">
              Klik nama siswa untuk melihat surat izin dan stiker A7
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
            {filteredPermits.map((student, idx) => {
              const status = student.status || 'APPROVED';
              let badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-200';
              let statusLabel = 'Approved';
              if (status === 'REJECTED') {
                badgeStyle = 'bg-rose-100 text-rose-800 border-rose-200';
                statusLabel = 'Rejected';
              } else if (status === 'DUE') {
                badgeStyle = 'bg-amber-100 text-amber-800 border-amber-200';
                statusLabel = 'Due';
              }

              return (
                <Link
                  key={student.id}
                  to={`/permit/${student.slug || student.id}`}
                  className="p-3.5 sm:px-5 flex items-center justify-between hover:bg-indigo-50/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400 w-6">{idx + 1}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-xs sm:text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {student.name}
                        </strong>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold">
                          {student.unit}
                        </Badge>
                        <Badge className={`text-[9.5px] py-0 px-1.5 font-bold ${badgeStyle}`}>
                          {statusLabel}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>Kelas {student.grade}</span>
                        <span>•</span>
                        <span className="font-medium text-indigo-700">OSN {student.osnField}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-slate-600 font-bold">{student.regNumber || student.id}</span>
                        {student.deviceName && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Laptop className="w-3 h-3" /> {student.deviceName}
                            </span>
                          </>
                        )}
                        {(student.deviceMac || student.deviceIp) && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] font-mono text-slate-500 flex items-center gap-0.5">
                              <Wifi className="w-2.5 h-2.5 text-indigo-500" /> {student.deviceMac || student.deviceIp}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform shrink-0">
                    <span className="hidden sm:inline text-[11px]">Verifikasi Izin</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
