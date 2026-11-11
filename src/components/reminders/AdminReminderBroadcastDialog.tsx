import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getWeeklyAgenda, WeeklyAgendaSummary, formatIndonesianDate } from '../../services/agendaService';
import { broadcastReminderToStudents } from '../../services/notificationService';
import {
  getEmailConfig,
  saveEmailConfig,
  testEmailConnection,
  sendDirectEmailReminders,
  EmailConfig,
  SendRemindersResult,
} from '../../services/emailReminderService';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Bell,
  Mail,
  MessageSquare,
  Calendar,
  CheckCircle,
  Copy,
  ExternalLink,
  AlertCircle,
  Users,
  Search,
  Send,
  Clock,
  Zap,
  Settings,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Trophy,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface AdminReminderBroadcastDialogProps {
  unsubmittedStudents: {
    id: string;
    userId: string;
    fullName: string;
    email?: string;
    grade?: string;
    osnField?: string;
  }[];
  trigger?: React.ReactNode;
}

export function AdminReminderBroadcastDialog({
  unsubmittedStudents,
  trigger,
}: AdminReminderBroadcastDialogProps) {
  const { userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'students' | 'agenda' | 'preview' | 'settings'>('preview');
  
  // SEPARATE REMINDER TYPES: 'REPORT' (Laporan Belajar) vs 'COMPETITION' (Lomba)
  const [reminderMode, setReminderMode] = useState<'REPORT' | 'COMPETITION'>('REPORT');
  
  const [search, setSearch] = useState('');
  const [weeklyAgenda, setWeeklyAgenda] = useState<WeeklyAgendaSummary | null>(null);
  const [customNote, setCustomNote] = useState('');

  // Email Server Dispatch States
  const [isSendingServerEmail, setIsSendingServerEmail] = useState(false);
  const [singleSendingId, setSingleSendingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendRemindersResult | null>(null);

  // Settings & Configuration States
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [configForm, setConfigForm] = useState<Partial<EmailConfig>>({});
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // In-app notifications
  const [isSendingNotif, setIsSendingNotif] = useState(false);

  const today = new Date();
  const todayFormatted = formatIndonesianDate(today);

  // Load agenda and email config when dialog opens
  useEffect(() => {
    if (isOpen) {
      getWeeklyAgenda().then(setWeeklyAgenda).catch(err => {
        console.error('Error fetching weekly agenda:', err);
      });
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const cfg = await getEmailConfig();
      setEmailConfig(cfg);
      setConfigForm({
        smtpHost: cfg.smtpHost,
        smtpPort: cfg.smtpPort,
        smtpSecure: cfg.smtpSecure,
        smtpUser: cfg.smtpUser,
        fromName: cfg.fromName,
        fromEmail: cfg.fromEmail,
        autoScheduleEnabled: cfg.autoScheduleEnabled,
        autoScheduleTime: cfg.autoScheduleTime,
      });
      setTestEmailAddress(cfg.fromEmail || 'scienceolympiad@semesta.sch.id');
    } catch (err) {
      console.error('Error fetching email config:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return unsubmittedStudents;
    const q = search.toLowerCase();
    return unsubmittedStudents.filter(s =>
      (s.fullName || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.osnField || '').toLowerCase().includes(q) ||
      (s.grade || '').toLowerCase().includes(q)
    );
  }, [unsubmittedStudents, search]);

  const validEmailStudents = useMemo(() => {
    return unsubmittedStudents.filter(s => s.email && s.email.includes('@'));
  }, [unsubmittedStudents]);

  const appUrl = 'https://sos.olympiad.my.id';
  const guidanceUrl = `${appUrl}/guidance`;
  const competitionsUrl = `${appUrl}/competitions`;
  const pembinaName = userProfile?.name || 'Pembina SOS Semesta';

  // --- 1. TEMPLATE KHUSUS PENGINGAT LAPORAN BELAJAR (SINGKAT & PADAT) ---
  const reportEmailSubject = `[SOS Semesta] Pengingat Laporan Belajar (${todayFormatted})`;

  const reportEmailBody = useMemo(() => {
    return `Halo Siswa SOS Semesta,

Mengingatkan untuk mengisi Laporan Belajar Harian (Daily Check-in) untuk hari ini, ${todayFormatted}.

Silakan akses tautan berikut:
👉 ${guidanceUrl}
${customNote.trim() ? `\nCatatan Pembina: "${customNote.trim()}"\n` : ''}
Terima kasih atas kedisiplinan belajarmu!

Salam,
${pembinaName} - SOS Semesta`;
  }, [todayFormatted, guidanceUrl, customNote, pembinaName]);

  const reportWaMessage = useMemo(() => {
    const studentNamesList = unsubmittedStudents.slice(0, 15).map((s, i) => `${i + 1}. ${s.fullName}`).join('\n');
    const moreCount = unsubmittedStudents.length > 15 ? `\n...dan ${unsubmittedStudents.length - 15} siswa lainnya` : '';

    return `📢 *PENGINGAT LAPORAN BELAJAR SOS*
📅 ${todayFormatted}

Halo teman-teman, berikut siswa yang belum mengisi laporan belajar hari ini:
${studentNamesList}${moreCount}

Mohon segera mengisi jurnal belajar di:
👉 ${guidanceUrl}
${customNote.trim() ? `\n💬 *Catatan:* ${customNote.trim()}\n` : ''}
Terima kasih! 🚀
— _${pembinaName}_`;
  }, [todayFormatted, unsubmittedStudents, guidanceUrl, customNote, pembinaName]);

  // --- 2. TEMPLATE KHUSUS AGENDA & DEADLINE LOMBA (SINGKAT & PADAT) ---
  const competitionEmailSubject = `[SOS Semesta] Agenda & Batas Waktu Lomba Pekan Ini`;

  const competitionEmailBody = useMemo(() => {
    const agendaList = (weeklyAgenda?.allEvents || []).map((item, idx) => 
      `${idx + 1}. [${item.badge}] ${item.competitionTitle || item.title} (${item.formattedDate})`
    ).join('\n') || '- Fokus pembinaan harian & pemantapan materi rutin OSN.';

    return `Halo Siswa SOS Semesta,

Berikut agenda dan batas waktu pendaftaran lomba pekan ini:
${agendaList}

Detail info & pendaftaran lomba:
👉 ${competitionsUrl}
${customNote.trim() ? `\nCatatan Pembina: "${customNote.trim()}"\n` : ''}
Semangat berprestasi dan selamat berjuang!

Salam,
${pembinaName} - SOS Semesta`;
  }, [weeklyAgenda, competitionsUrl, customNote, pembinaName]);

  const competitionWaMessage = useMemo(() => {
    const agendaWaList = (weeklyAgenda?.allEvents || []).map((item, idx) => 
      `• *${item.competitionTitle || item.title}* (${item.badge}) - ${item.formattedDate}`
    ).join('\n') || '• Fokus pemantapan materi rutin & latihan soal OSN.';

    return `🏆 *AGENDA & DEADLINE LOMBA PEKAN INI*
📅 ${weeklyAgenda?.weekLabel || todayFormatted}

${agendaWaList}

Detail & pendaftaran lomba:
👉 ${competitionsUrl}
${customNote.trim() ? `\n💬 *Catatan:* ${customNote.trim()}\n` : ''}
Semangat pejuang medali! 🚀
— _${pembinaName}_`;
  }, [weeklyAgenda, todayFormatted, competitionsUrl, customNote, pembinaName]);

  // Active Subject & Body based on chosen reminder mode
  const currentEmailSubject = reminderMode === 'REPORT' ? reportEmailSubject : competitionEmailSubject;
  const currentEmailBody = reminderMode === 'REPORT' ? reportEmailBody : competitionEmailBody;
  const currentWaMessage = reminderMode === 'REPORT' ? reportWaMessage : competitionWaMessage;

  // DIRECT SERVER-SIDE EMAIL DISPATCH
  const handleSendDirectEmailReminders = async () => {
    if (validEmailStudents.length === 0) {
      toast.error('Tidak ada siswa dengan alamat email valid untuk dikirimi pesan.');
      return;
    }

    setIsSendingServerEmail(true);
    setSendResult(null);

    try {
      const recipients = validEmailStudents.map(s => ({
        id: s.id,
        userId: s.userId,
        fullName: s.fullName,
        email: s.email!,
        grade: s.grade,
        osnField: s.osnField,
      }));

      const result = await sendDirectEmailReminders({
        recipients,
        subject: currentEmailSubject,
        reminderType: reminderMode,
        customNote,
        guidanceUrl,
        competitionsUrl,
        todayFormatted,
        pembinaName,
        agendaItems: weeklyAgenda?.allEvents || [],
      });

      setSendResult(result);
      if (result.success) {
        toast.success(`Berhasil! ${result.sentCount} email ${reminderMode === 'REPORT' ? 'pengingat laporan' : 'agenda lomba'} terkirim langsung dari server.`);
      } else {
        toast.warning(result.message || 'Proses selesai dengan beberapa kendala.');
      }
    } catch (err: any) {
      console.error('Error sending direct reminders:', err);
      toast.error(err.message || 'Gagal mengirim email otomatis dari sistem');
    } finally {
      setIsSendingServerEmail(false);
    }
  };

  const handleSendDirectEmailSingle = async (student: typeof unsubmittedStudents[0]) => {
    if (!student.email) {
      toast.error(`Email untuk ${student.fullName} belum terdaftar`);
      return;
    }

    setSingleSendingId(student.id || student.userId);
    try {
      const result = await sendDirectEmailReminders({
        recipients: [
          {
            id: student.id,
            userId: student.userId,
            fullName: student.fullName,
            email: student.email,
            grade: student.grade,
            osnField: student.osnField,
          },
        ],
        subject: currentEmailSubject,
        reminderType: reminderMode,
        customNote,
        guidanceUrl,
        competitionsUrl,
        todayFormatted,
        pembinaName,
        agendaItems: weeklyAgenda?.allEvents || [],
      });

      if (result.sentCount > 0) {
        toast.success(`Email berhasil dikirim ke ${student.fullName} (${student.email})!`);
      } else {
        toast.error(`Gagal mengirim: ${result.details[0]?.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengirim email ke siswa');
    } finally {
      setSingleSendingId(null);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const payload: Partial<EmailConfig> = {
        ...configForm,
      };
      if (passwordInput.trim()) {
        payload.smtpPass = passwordInput.trim();
      }
      const updated = await saveEmailConfig(payload);
      setEmailConfig(updated);
      setPasswordInput('');
      toast.success('Pengaturan email dan jadwal otomatis berhasil disimpan!');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan pengaturan email');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    if (!testEmailAddress) {
      toast.error('Masukkan alamat email tujuan pengujian');
      return;
    }
    setIsTestingConnection(true);
    try {
      if (passwordInput.trim()) {
        await saveEmailConfig({ ...configForm, smtpPass: passwordInput.trim() });
        setPasswordInput('');
      }
      const res = await testEmailConnection(testEmailAddress);
      toast.success(res.message || 'Koneksi SMTP berhasil diverifikasi!');
    } catch (err: any) {
      toast.error(err.message || 'Koneksi SMTP gagal');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(currentWaMessage);
    toast.success('Pesan WhatsApp singkat berhasil disalin ke clipboard!');
  };

  const handleCopyEmailBody = () => {
    navigator.clipboard.writeText(currentEmailBody);
    toast.success('Format email singkat berhasil disalin ke clipboard!');
  };

  const handleLaunchEmailClient = () => {
    if (validEmailStudents.length === 0) {
      toast.error('Tidak ada alamat email siswa yang terdaftar.');
      return;
    }
    const bccList = validEmailStudents.map(s => s.email).join(',');
    const mailtoUrl = `mailto:?bcc=${encodeURIComponent(bccList)}&subject=${encodeURIComponent(currentEmailSubject)}&body=${encodeURIComponent(currentEmailBody)}`;
    window.location.href = mailtoUrl;
    toast.info(`Membuka aplikasi email/Gmail untuk ${validEmailStudents.length} siswa.`);
  };

  const handleSendInAppNotifications = async () => {
    if (unsubmittedStudents.length === 0) return;
    setIsSendingNotif(true);
    try {
      const studentIds = unsubmittedStudents.map(s => s.userId || s.id);
      const isRep = reminderMode === 'REPORT';
      const sentCount = await broadcastReminderToStudents(
        studentIds,
        isRep ? `Pengingat Laporan Belajar (${todayFormatted})` : `Info Agenda Lomba Pekan Ini`,
        isRep 
          ? `Halo! Mohon mengisi laporan belajar harian kamu hari ini (${todayFormatted}).` 
          : `Halo! Cek info kompetisi dan batas pendaftaran lomba pekan ini di menu Kompetisi.`,
        isRep ? '/guidance' : '/competitions'
      );
      toast.success(`Berhasil mengirim notifikasi in-app ke ${sentCount} siswa!`);
    } catch (err) {
      console.error('Error broadcasting notifs:', err);
      toast.error('Gagal mengirim notifikasi in-app');
    } finally {
      setIsSendingNotif(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as any} />
      ) : (
        <DialogTrigger
          render={
            <Button
              variant="outline"
              className="border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Bell className="w-4 h-4 text-amber-600 animate-bounce" />
              <span>Pengingat & Broadcast</span>
              {unsubmittedStudents.length > 0 && (
                <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-0.5 rounded-full ml-1">
                  {unsubmittedStudents.length} Belum Mengisi
                </Badge>
              )}
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 shadow-2xl border-indigo-200/50">
        {/* Header */}
        <div className="bg-linear-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white p-5 rounded-t-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider bg-white/20 rounded-full text-indigo-100 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-300" /> Sistem Broadcast SOS Semesta
                </span>
                <span className="text-xs text-indigo-200 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {todayFormatted}
                </span>
              </div>
              <h2 className="text-xl font-bold leading-tight">
                Pusat Pengingat & Broadcast Siswa
              </h2>
            </div>

            {/* SEPARATE REMINDER CATEGORY SWITCHER */}
            <div className="flex items-center bg-black/25 backdrop-blur-md p-1 rounded-xl border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setReminderMode('REPORT')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  reminderMode === 'REPORT'
                    ? 'bg-amber-400 text-amber-950 shadow-sm'
                    : 'text-indigo-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Pengingat Laporan Belajar</span>
                {unsubmittedStudents.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px]">
                    {unsubmittedStudents.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setReminderMode('COMPETITION')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  reminderMode === 'COMPETITION'
                    ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                    : 'text-indigo-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Agenda & Info Lomba</span>
                {weeklyAgenda && weeklyAgenda.allEvents.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-emerald-700 text-white rounded-full text-[10px]">
                    {weeklyAgenda.allEvents.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Primary Action Ribbon */}
        <div className="bg-linear-to-r from-emerald-50 via-teal-50 to-indigo-50 dark:bg-emerald-950/20 border-b border-emerald-200/80 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-emerald-950 dark:text-emerald-200">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold shrink-0 text-[11px]">
              {validEmailStudents.length}
            </span>
            <span>
              Target:{' '}
              <strong>
                {reminderMode === 'REPORT'
                  ? `${validEmailStudents.length} siswa belum mengisi laporan`
                  : `${validEmailStudents.length} siswa terdaftar di SOS`}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSendDirectEmailReminders}
              disabled={isSendingServerEmail || validEmailStudents.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8.5 px-3.5 shadow-xs flex items-center gap-1.5"
            >
              {isSendingServerEmail ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengirim Email...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>
                    Kirim Otomatis (
                    {reminderMode === 'REPORT' ? 'Pengingat Laporan' : 'Agenda Lomba'})
                  </span>
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyWhatsApp}
              className="border-green-600 text-green-700 hover:bg-green-50 text-xs h-8.5 flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-green-600" />
              Salin WhatsApp
            </Button>
          </div>
        </div>

        {/* Delivery Result Banner (if just sent) */}
        {sendResult && (
          <div className={`px-6 py-2.5 border-b text-xs flex items-center justify-between gap-3 ${
            sendResult.success ? 'bg-green-50 text-green-900 border-green-200' : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}>
            <div className="flex items-center gap-2">
              {sendResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div>
                <strong>Laporan:</strong> {sendResult.sentCount} email berhasil terkirim dari {sendResult.total} siswa.
                {sendResult.mode === 'ethereal' && (
                  <span className="block text-[11px] text-amber-700">
                    ℹ️ Menggunakan simulator Ethereal. Masukkan Google App Password di tab Pengaturan agar terkirim ke email siswa secara nyata.
                  </span>
                )}
              </div>
            </div>

            {sendResult.previewUrl && (
              <a
                href={sendResult.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-indigo-700 hover:underline flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-indigo-200"
              >
                <Eye className="w-3 h-3" />
                Lihat Pratinjau
              </a>
            )}
          </div>
        )}

        {/* Tabbed Content */}
        <div className="p-5">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="preview" className="flex items-center gap-1.5 text-xs">
                <Mail className="w-3.5 h-3.5" />
                Template Singkat ({reminderMode === 'REPORT' ? 'Laporan' : 'Lomba'})
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5" />
                Daftar Siswa ({unsubmittedStudents.length})
              </TabsTrigger>
              <TabsTrigger value="agenda" className="flex items-center gap-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5" />
                Agenda Pekan Ini ({weeklyAgenda?.allEvents.length || 0})
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-1.5 text-xs">
                <Settings className="w-3.5 h-3.5" />
                Pengaturan Email & Jadwal
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: TEMPLATE SINGKAT (SEPARATE & SHORT) */}
            <TabsContent value="preview" className="space-y-4">
              {/* Category indicator card */}
              <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                reminderMode === 'REPORT' 
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              }`}>
                <div className="flex items-center gap-2">
                  {reminderMode === 'REPORT' ? (
                    <BookOpen className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Trophy className="w-4 h-4 text-emerald-600" />
                  )}
                  <div>
                    <span className="font-bold">
                      {reminderMode === 'REPORT' 
                        ? 'Template Khusus: Pengingat Laporan Belajar' 
                        : 'Template Khusus: Agenda & Deadline Lomba'}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {reminderMode === 'REPORT'
                        ? 'Format ringkas & to-the-point untuk mengingatkan siswa mengisi daily check-in hari ini.'
                        : 'Format ringkas & to-the-point untuk mengabarkan jadwal babak & batas pendaftaran lomba pekan ini.'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-muted-foreground block">Ubah jenis pesan:</span>
                  <button
                    type="button"
                    onClick={() => setReminderMode(reminderMode === 'REPORT' ? 'COMPETITION' : 'REPORT')}
                    className="text-xs font-semibold text-indigo-700 hover:underline cursor-pointer"
                  >
                    Ganti ke {reminderMode === 'REPORT' ? 'Agenda Lomba' : 'Pengingat Laporan'} ➔
                  </button>
                </div>
              </div>

              {/* Optional Custom Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Catatan Tambahan Pembina (Opsional):
                </label>
                <Input
                  placeholder="Contoh: Kumpulkan resume bab kombinatorik sebelum jam 20.00 WIB."
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  className="text-xs h-8.5"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email Preview */}
                <div className="border rounded-lg p-3.5 bg-muted/20 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b pb-2 mb-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-indigo-600" />
                        Preview Email Singkat
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCopyEmailBody}
                        className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Salin Teks
                      </Button>
                    </div>

                    <div className="text-[11px] font-semibold text-foreground mb-1">
                      Subjek: <span className="text-indigo-600 font-mono">{currentEmailSubject}</span>
                    </div>

                    <div className="text-[11px] font-mono text-muted-foreground max-h-48 overflow-y-auto whitespace-pre-wrap p-2.5 bg-background rounded border">
                      {currentEmailBody}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t">
                    <Button
                      size="sm"
                      onClick={handleSendDirectEmailReminders}
                      disabled={isSendingServerEmail || validEmailStudents.length === 0}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      {isSendingServerEmail ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                      )}
                      Kirim Otomatis ke {validEmailStudents.length} Siswa (Dari Server)
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleLaunchEmailClient}
                      className="w-full text-muted-foreground hover:text-foreground text-[10px] h-6 flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Buka draft di Gmail / Mail manual
                    </Button>
                  </div>
                </div>

                {/* WhatsApp Preview */}
                <div className="border rounded-lg p-3.5 bg-muted/20 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b pb-2 mb-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                        Preview WhatsApp Singkat
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCopyWhatsApp}
                        className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Salin Teks
                      </Button>
                    </div>

                    <div className="text-[11px] font-mono text-muted-foreground max-h-52 overflow-y-auto whitespace-pre-wrap p-2.5 bg-background rounded border">
                      {currentWaMessage}
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyWhatsApp}
                      className="w-full border-green-600 text-green-700 hover:bg-green-50 text-xs h-8 font-medium flex items-center justify-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5 text-green-600" />
                      Salin Format WhatsApp Siap Kirim
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: LIST OF STUDENTS */}
            <TabsContent value="students" className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2" />
                  <Input
                    placeholder="Cari nama siswa, kelas, atau bidang OSN..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSendInAppNotifications}
                    disabled={isSendingNotif || unsubmittedStudents.length === 0}
                    className="text-xs h-8 flex items-center gap-1.5 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSendingNotif ? 'Mengirim...' : 'Notifikasi In-App'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSendDirectEmailReminders}
                    disabled={isSendingServerEmail || validEmailStudents.length === 0}
                    className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    Kirim Otomatis ke Semua
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-[320px] overflow-y-auto shadow-xs">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-10 text-xs">No</TableHead>
                      <TableHead className="text-xs">Nama Siswa</TableHead>
                      <TableHead className="text-xs">Kelas / Bidang</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-right text-xs">Kirim</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                          {unsubmittedStudents.length === 0 ? (
                            <div className="space-y-1">
                              <CheckCircle className="w-7 h-7 text-green-500 mx-auto mb-1" />
                              <p className="font-semibold text-foreground text-sm">Luar Biasa!</p>
                              <p>Semua siswa telah mengisi laporan belajar hari ini.</p>
                            </div>
                          ) : (
                            'Tidak ada siswa yang sesuai dengan filter pencarian.'
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student, idx) => {
                        const isThisSending = singleSendingId === (student.id || student.userId);
                        return (
                          <TableRow key={student.id || student.userId || idx} className="text-xs hover:bg-muted/30">
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium text-foreground">
                              {student.fullName}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {student.grade && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                    {student.grade}
                                  </Badge>
                                )}
                                {student.osnField && (
                                  <span className="text-[11px] text-muted-foreground font-medium">
                                    {student.osnField}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground font-mono text-[11px]">
                              {student.email ? (
                                <span className="text-foreground">{student.email}</span>
                              ) : (
                                <span className="text-amber-500 italic">Belum ada email</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendDirectEmailSingle(student)}
                                disabled={isThisSending || !student.email}
                                className="h-6.5 text-[11px] text-emerald-700 border-emerald-300 hover:bg-emerald-50 px-2 font-medium"
                                title="Kirim email langsung dari server"
                              >
                                {isThisSending ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <Zap className="w-3 h-3 mr-1 fill-emerald-600 text-emerald-600" />
                                )}
                                Kirim
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* TAB 3: WEEKLY AGENDA */}
            <TabsContent value="agenda" className="space-y-3">
              <div className="bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 text-xs text-indigo-900 dark:text-indigo-200 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Agenda & Deadline Perlombaan Pekan Ini</span>
                    <p className="mt-0.5 text-muted-foreground">
                      Daftar perlombaan yang memiliki batas pendaftaran atau babak kompetisi dalam sepekan ke depan.
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    setReminderMode('COMPETITION');
                    setActiveTab('preview');
                  }}
                  className="text-xs h-7.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                >
                  <Trophy className="w-3.5 h-3.5 mr-1" />
                  Siapkan Pesan Lomba
                </Button>
              </div>

              {weeklyAgenda && weeklyAgenda.allEvents.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {weeklyAgenda.allEvents.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 border rounded-lg bg-card hover:bg-muted/20 transition-colors flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                          <span className="font-medium text-foreground">{item.competitionTitle || item.title}</span>
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 font-semibold text-indigo-600 ml-4 text-[11px]">
                        {item.formattedDate}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 border border-dashed rounded-lg text-center text-xs text-muted-foreground">
                  <Calendar className="w-7 h-7 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="font-medium">Tidak ada deadline atau babak lomba spesifik pekan ini.</p>
                  <p className="text-[11px]">Fokus kegiatan pada pembinaan rutin dan latihan mandiri OSN.</p>
                </div>
              )}
            </TabsContent>

            {/* TAB 4: SETTINGS & AUTOMATED SCHEDULE */}
            <TabsContent value="settings" className="space-y-3">
              <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 text-xs space-y-1">
                <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-bold">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Pengaturan Pengiriman Email Otomatis</span>
                </div>
                <p className="text-muted-foreground leading-relaxed text-[11px]">
                  Email dikirim menggunakan server SMTP. Masukkan <strong>Google App Password</strong> (16 karakter) akun <strong>scienceolympiad@semesta.sch.id</strong> agar sistem dapat mengirim email langsung ke inbox siswa secara otomatis.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2.5">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-0.5">
                      Nama Pengirim
                    </label>
                    <Input
                      value={configForm.fromName || ''}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, fromName: e.target.value }))}
                      placeholder="SOS Semesta"
                      className="text-xs h-8"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-0.5">
                      Email Pengirim (Akun Google Workspace)
                    </label>
                    <Input
                      value={configForm.fromEmail || ''}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, fromEmail: e.target.value, smtpUser: e.target.value }))}
                      placeholder="scienceolympiad@semesta.sch.id"
                      className="text-xs h-8"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-0.5">
                      Google App Password (16 Karakter)
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder={emailConfig?.hasStoredPassword ? '•••••••••••••••• (Tersimpan)' : 'Contoh: abcd efgh ijkl mnop'}
                        className="text-xs h-8 pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      {emailConfig?.hasStoredPassword
                        ? '✅ Kredensial aktif tersimpan di server.'
                        : '⚠️ Belum dikonfigurasi. Masukkan sandi 16 karakter dari Google.'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-0.5">
                        SMTP Host
                      </label>
                      <Input
                        value={configForm.smtpHost || ''}
                        onChange={(e) => setConfigForm(prev => ({ ...prev, smtpHost: e.target.value }))}
                        placeholder="smtp.gmail.com"
                        className="text-xs h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-0.5">
                        Port
                      </label>
                      <Input
                        type="number"
                        value={configForm.smtpPort || 465}
                        onChange={(e) => setConfigForm(prev => ({ ...prev, smtpPort: Number(e.target.value) }))}
                        placeholder="465"
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  {/* Auto-Scheduler Setting */}
                  <div className="p-2.5 border rounded-lg bg-muted/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        Jadwal Otomatis Harian
                      </label>
                      <input
                        type="checkbox"
                        checked={Boolean(configForm.autoScheduleEnabled)}
                        onChange={(e) => setConfigForm(prev => ({ ...prev, autoScheduleEnabled: e.target.checked }))}
                        className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[11px] text-muted-foreground">Kirim jam:</span>
                      <Input
                        type="time"
                        value={configForm.autoScheduleTime || '19:30'}
                        onChange={(e) => setConfigForm(prev => ({ ...prev, autoScheduleTime: e.target.value }))}
                        disabled={!configForm.autoScheduleEnabled}
                        className="text-xs h-7 w-24"
                      />
                      <span className="text-[11px] text-muted-foreground">WIB</span>
                    </div>
                  </div>

                  {/* Test Connection Box */}
                  <div className="p-2.5 border rounded-lg bg-background space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      Tes Kirim Email Uji Coba
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="email"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        placeholder="Email penerima tes..."
                        className="text-xs h-7.5 flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={isTestingConnection}
                        className="text-xs h-7.5 shrink-0 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                      >
                        {isTestingConnection ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          'Tes'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-4 font-semibold flex items-center gap-1.5"
                >
                  {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Simpan Pengaturan
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
