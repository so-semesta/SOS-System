import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WeeklyAgendaItem } from './agendaService';

export interface EmailRecipient {
  id?: string;
  userId?: string;
  fullName: string;
  email: string;
  grade?: string;
  osnField?: string;
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass?: string;
  fromName: string;
  fromEmail: string;
  autoScheduleEnabled: boolean;
  autoScheduleTime: string; // "HH:mm" in WIB (e.g. "20:30")
  lastAutoSentDate?: string;
  lastAutoSentAt?: number;
  lastAutoSentCount?: number;
  lastAutoFailedCount?: number;
  lastAutoStatus?:
    | 'SENT'
    | 'PARTIAL'
    | 'FAILED'
    | 'SKIPPED_NO_SMTP'
    | 'SKIPPED_NO_SNAPSHOT'
    | 'SKIPPED_EMPTY';
  lastAutoMessage?: string;
  lastManualSentDate?: string;
  lastManualSentAt?: number;
  lastManualSentCount?: number;
  lastManualSentBy?: string;
  hasStoredPassword?: boolean;
}

export interface DailyRecipientDispatch {
  email: string;
  name: string;
  sentAt: number;
  mode: 'AUTO' | 'MANUAL';
  status: 'sent' | 'failed';
  error?: string;
}

export interface DailyReminderStatusRecord {
  dateKey: string;
  reportSent: boolean;
  lastSentAt?: number;
  lastSentMode?: 'AUTO' | 'MANUAL';
  lastSentBy?: string;
  totalSentCount: number;
  lastBatchSentCount: number;
  lastBatchFailedCount: number;
  sentEmails: Record<string, DailyRecipientDispatch>;
}

export interface DailyStatusResponse {
  dateKeyWIB: string;
  formattedDateWIB: string;
  currentTimeWIB: string;
  status: DailyReminderStatusRecord;
  snapshotCount: number;
  snapshotUpdatedAt: number | null;
  config: EmailConfig;
}

export interface SendRemindersPayload {
  recipients: EmailRecipient[];
  subject: string;
  reminderType?: 'REPORT' | 'COMPETITION';
  customNote?: string;
  guidanceUrl?: string;
  competitionsUrl?: string;
  todayFormatted: string;
  pembinaName?: string;
  agendaItems?: WeeklyAgendaItem[];
}

export interface SendRemindersResult {
  success: boolean;
  total: number;
  sentCount: number;
  failedCount: number;
  mode: 'smtp' | 'ethereal' | 'simulated';
  previewUrl?: string;
  dailyStatus?: DailyReminderStatusRecord;
  message: string;
  details: Array<{
    email: string;
    name: string;
    status: 'sent' | 'failed';
    error?: string;
  }>;
}

export function getWibDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function formatWibTime(timestamp?: number): string {
  if (!timestamp) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

export async function persistDailyReminderLogToFirestore(
  status: DailyReminderStatusRecord
): Promise<void> {
  if (!status?.dateKey || !status.reportSent) return;
  try {
    const sentEmailsList = Object.values(status.sentEmails || {})
      .filter((item) => item.status === 'sent' && item.email)
      .map((item) => item.email.toLowerCase())
      .slice(0, 500);

    await setDoc(doc(db, 'dailyReminderLogs', status.dateKey), {
      dateKey: status.dateKey,
      reportSent: true,
      lastSentAt: status.lastSentAt || Date.now(),
      lastSentMode: status.lastSentMode || 'MANUAL',
      ...(status.lastSentBy ? { lastSentBy: status.lastSentBy.slice(0, 256) } : {}),
      sentCount: status.totalSentCount || sentEmailsList.length || status.lastBatchSentCount || 0,
      failedCount: status.lastBatchFailedCount || 0,
      recipientEmails: sentEmailsList,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('Could not persist dailyReminderLogs to Firestore:', err);
  }
}

export async function getDailyReminderStatus(): Promise<DailyStatusResponse> {
  const res = await fetch('/api/notifications/daily-status');
  if (!res.ok) {
    throw new Error('Gagal memuat status pengingat harian');
  }
  const serverData = (await res.json()) as DailyStatusResponse;

  // Cross-sync with Firestore dailyReminderLogs/{dateKeyWIB} for persistence across restarts
  try {
    const dateKey = serverData.dateKeyWIB || getWibDateKey();
    const docSnap = await getDoc(doc(db, 'dailyReminderLogs', dateKey));
    const fsData = docSnap.exists() ? (docSnap.data() as any) : null;

    if (serverData.status?.reportSent) {
      // If server sent more recently or Firestore doesn't have it yet, mirror to Firestore
      if (!fsData || (serverData.status.lastSentAt || 0) > (fsData.lastSentAt || 0)) {
        void persistDailyReminderLogToFirestore(serverData.status);
      }
    } else if (fsData?.reportSent) {
      // Restore status from Firestore if server restarted cleanly
      const reconstructedEmails: Record<string, DailyRecipientDispatch> = {};
      if (Array.isArray(fsData.recipientEmails)) {
        fsData.recipientEmails.forEach((em: string) => {
          const clean = String(em || '').trim().toLowerCase();
          if (clean) {
            reconstructedEmails[clean] = {
              email: clean,
              name: clean,
              sentAt: Number(fsData.lastSentAt || Date.now()),
              mode: fsData.lastSentMode === 'AUTO' ? 'AUTO' : 'MANUAL',
              status: 'sent',
            };
          }
        });
      }
      serverData.status = {
        dateKey,
        reportSent: true,
        lastSentAt: Number(fsData.lastSentAt || 0),
        lastSentMode: fsData.lastSentMode === 'AUTO' ? 'AUTO' : 'MANUAL',
        lastSentBy: fsData.lastSentBy,
        totalSentCount: Number(fsData.sentCount || 0),
        lastBatchSentCount: Number(fsData.sentCount || 0),
        lastBatchFailedCount: Number(fsData.failedCount || 0),
        sentEmails: reconstructedEmails,
      };
    }
  } catch (err) {
    console.warn('Firestore dailyReminderLogs sync skipped:', err);
  }

  return serverData;
}

export async function syncDailyReminderSnapshot(
  recipients: EmailRecipient[],
  syncedBy?: string
): Promise<{ success: boolean; dateKeyWIB: string; snapshotCount: number }> {
  const res = await fetch('/api/notifications/sync-daily-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipients, syncedBy }),
  });
  if (!res.ok) {
    throw new Error('Gagal menyinkronkan daftar siswa ke server');
  }
  return res.json();
}

export async function markStudentSubmittedToday(studentId: string): Promise<void> {
  if (!studentId) return;
  await fetch('/api/notifications/mark-submitted', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId }),
  }).catch(() => {});
}

export async function getEmailConfig(): Promise<EmailConfig> {
  const res = await fetch('/api/notifications/email-config');
  if (!res.ok) {
    throw new Error('Gagal memuat konfigurasi email');
  }
  return res.json();
}

export async function saveEmailConfig(config: Partial<EmailConfig>): Promise<EmailConfig> {
  const res = await fetch('/api/notifications/email-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Gagal menyimpan konfigurasi email');
  }
  return res.json();
}

export async function testEmailConnection(
  testRecipient: string
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  const res = await fetch('/api/notifications/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testRecipient }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Koneksi email gagal');
  }
  return data;
}

export async function sendDirectEmailReminders(
  payload: SendRemindersPayload
): Promise<SendRemindersResult> {
  const res = await fetch('/api/notifications/send-email-reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as SendRemindersResult & { error?: string };
  if (!res.ok && !data.details) {
    throw new Error(data.error || 'Gagal mengirim email pengingat otomatis');
  }
  if (data.dailyStatus?.reportSent) {
    void persistDailyReminderLogToFirestore(data.dailyStatus);
  }
  return data;
}
