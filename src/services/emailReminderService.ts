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
  role?: string;
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
  configUpdatedAt?: number;
  updatedBy?: string;
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

interface StoredFirestoreEmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass?: string;
  fromName: string;
  fromEmail: string;
  autoScheduleEnabled: boolean;
  autoScheduleTime: string;
  updatedAt: number;
  updatedBy?: string;
}

const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: 'scienceolympiad@semesta.sch.id',
  fromName: 'SOS Semesta',
  fromEmail: 'scienceolympiad@semesta.sch.id',
  autoScheduleEnabled: false,
  autoScheduleTime: '20:30',
  hasStoredPassword: false,
};

const SYSTEM_SETTINGS_COLLECTION = 'systemSettings';
const EMAIL_CONFIG_DOC_ID = 'emailConfig';

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

function getFormattedWibDateFallback(): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function sanitizeTimeHHMM(raw?: string): string {
  const val = String(raw || '').trim();
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(val) ? val : '20:30';
}

async function loadEmailConfigFromFirestore(): Promise<StoredFirestoreEmailConfig | null> {
  try {
    const snap = await getDoc(doc(db, SYSTEM_SETTINGS_COLLECTION, EMAIL_CONFIG_DOC_ID));
    if (!snap.exists()) return null;
    const data = snap.data() as StoredFirestoreEmailConfig;
    return data;
  } catch (err) {
    console.warn('Could not read systemSettings/emailConfig from Firestore:', err);
    return null;
  }
}

async function syncConfigToBackendServer(payload: Record<string, unknown>): Promise<EmailConfig | null> {
  try {
    const res = await fetch('/api/notifications/email-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return (await res.json()) as EmailConfig;
  } catch {
    return null;
  }
}

function mergeEmailConfigs(
  serverCfg: EmailConfig | null,
  fsCfg: StoredFirestoreEmailConfig | null
): EmailConfig {
  const base = { ...DEFAULT_EMAIL_CONFIG, ...(serverCfg || {}) };
  if (!fsCfg) return base;

  const serverHasNewer =
    typeof serverCfg?.configUpdatedAt === 'number' &&
    typeof fsCfg.updatedAt === 'number' &&
    serverCfg.configUpdatedAt > fsCfg.updatedAt;

  if (serverHasNewer) {
    return {
      ...base,
      hasStoredPassword: Boolean(serverCfg?.hasStoredPassword) || Boolean(fsCfg.smtpPass),
    };
  }

  return {
    ...base,
    smtpHost: fsCfg.smtpHost || base.smtpHost,
    smtpPort: typeof fsCfg.smtpPort === 'number' ? fsCfg.smtpPort : base.smtpPort,
    smtpSecure: typeof fsCfg.smtpSecure === 'boolean' ? fsCfg.smtpSecure : base.smtpSecure,
    smtpUser: fsCfg.smtpUser || base.smtpUser,
    fromName: fsCfg.fromName || base.fromName,
    fromEmail: fsCfg.fromEmail || base.fromEmail,
    autoScheduleEnabled:
      typeof fsCfg.autoScheduleEnabled === 'boolean'
        ? fsCfg.autoScheduleEnabled
        : base.autoScheduleEnabled,
    autoScheduleTime: fsCfg.autoScheduleTime || base.autoScheduleTime,
    configUpdatedAt: fsCfg.updatedAt,
    updatedBy: fsCfg.updatedBy,
    hasStoredPassword: Boolean(fsCfg.smtpPass) || Boolean(serverCfg?.hasStoredPassword),
  };
}

function needsBackendRehydration(
  serverCfg: EmailConfig | null,
  fsCfg: StoredFirestoreEmailConfig | null
): boolean {
  if (!fsCfg || !serverCfg) return false;
  const missingPasswordOnServer = Boolean(fsCfg.smtpPass) && !serverCfg.hasStoredPassword;
  const serverMissingTimestamp =
    typeof fsCfg.updatedAt === 'number' && !serverCfg.configUpdatedAt;
  const firestoreIsNewer =
    typeof fsCfg.updatedAt === 'number' &&
    typeof serverCfg.configUpdatedAt === 'number' &&
    fsCfg.updatedAt > serverCfg.configUpdatedAt;

  return missingPasswordOnServer || serverMissingTimestamp || firestoreIsNewer;
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
  const [serverRes, fsCfg] = await Promise.all([
    fetch('/api/notifications/daily-status')
      .then(async (res) => (res.ok ? ((await res.json()) as DailyStatusResponse) : null))
      .catch(() => null),
    loadEmailConfigFromFirestore(),
  ]);

  const dateKey = serverRes?.dateKeyWIB || getWibDateKey();
  const serverData: DailyStatusResponse = serverRes || {
    dateKeyWIB: dateKey,
    formattedDateWIB: getFormattedWibDateFallback(),
    currentTimeWIB: formatWibTime(Date.now()),
    status: {
      dateKey,
      reportSent: false,
      totalSentCount: 0,
      lastBatchSentCount: 0,
      lastBatchFailedCount: 0,
      sentEmails: {},
    },
    snapshotCount: 0,
    snapshotUpdatedAt: null,
    config: { ...DEFAULT_EMAIL_CONFIG },
  };

  if (fsCfg) {
    if (needsBackendRehydration(serverRes?.config || null, fsCfg)) {
      void syncConfigToBackendServer({
        ...fsCfg,
        configUpdatedAt: fsCfg.updatedAt,
      });
    }
    serverData.config = mergeEmailConfigs(serverRes?.config || null, fsCfg);
  }

  // Cross-sync with Firestore dailyReminderLogs/{dateKeyWIB} for persistence across restarts
  try {
    const docSnap = await getDoc(doc(db, 'dailyReminderLogs', dateKey));
    const fsData = docSnap.exists() ? (docSnap.data() as any) : null;

    if (serverData.status?.reportSent) {
      if (!fsData || (serverData.status.lastSentAt || 0) > (fsData.lastSentAt || 0)) {
        void persistDailyReminderLogToFirestore(serverData.status);
      }
    } else if (fsData?.reportSent) {
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
  const [serverCfg, fsCfg] = await Promise.all([
    fetch('/api/notifications/email-config')
      .then(async (res) => (res.ok ? ((await res.json()) as EmailConfig) : null))
      .catch(() => null),
    loadEmailConfigFromFirestore(),
  ]);

  if (fsCfg && needsBackendRehydration(serverCfg, fsCfg)) {
    const rehydrated = await syncConfigToBackendServer({
      ...fsCfg,
      configUpdatedAt: fsCfg.updatedAt,
    });
    return mergeEmailConfigs(rehydrated || serverCfg, fsCfg);
  }

  return mergeEmailConfigs(serverCfg, fsCfg);
}

export async function saveEmailConfig(config: Partial<EmailConfig>): Promise<EmailConfig> {
  const existingFs = await loadEmailConfigFromFirestore();
  const now = Date.now();

  const portNum = Number(config.smtpPort ?? existingFs?.smtpPort ?? 465);
  const validPort = Number.isFinite(portNum) && portNum >= 1 && portNum <= 65535 ? Math.round(portNum) : 465;
  const smtpUser = String(config.smtpUser ?? existingFs?.smtpUser ?? 'scienceolympiad@semesta.sch.id')
    .trim()
    .slice(0, 256);
  const effectivePass =
    typeof config.smtpPass === 'string' && config.smtpPass.trim().length > 0
      ? config.smtpPass.trim().slice(0, 256)
      : existingFs?.smtpPass;

  const firestorePayload: StoredFirestoreEmailConfig = {
    smtpHost: String(config.smtpHost ?? existingFs?.smtpHost ?? 'smtp.gmail.com').trim().slice(0, 200) || 'smtp.gmail.com',
    smtpPort: validPort,
    smtpSecure: typeof config.smtpSecure === 'boolean' ? config.smtpSecure : validPort === 465,
    smtpUser: smtpUser.length >= 3 ? smtpUser : 'scienceolympiad@semesta.sch.id',
    ...(effectivePass ? { smtpPass: effectivePass } : {}),
    fromName: String(config.fromName ?? existingFs?.fromName ?? 'SOS Semesta').trim().slice(0, 150) || 'SOS Semesta',
    fromEmail:
      String(config.fromEmail ?? existingFs?.fromEmail ?? smtpUser ?? 'scienceolympiad@semesta.sch.id')
        .trim()
        .slice(0, 256) || 'scienceolympiad@semesta.sch.id',
    autoScheduleEnabled: Boolean(config.autoScheduleEnabled ?? existingFs?.autoScheduleEnabled ?? false),
    autoScheduleTime: sanitizeTimeHHMM(config.autoScheduleTime ?? existingFs?.autoScheduleTime),
    updatedAt: now,
    ...(config.updatedBy ? { updatedBy: String(config.updatedBy).slice(0, 256) } : {}),
  };

  let firestoreSaved = false;
  try {
    await setDoc(doc(db, SYSTEM_SETTINGS_COLLECTION, EMAIL_CONFIG_DOC_ID), firestorePayload);
    firestoreSaved = true;
  } catch (err) {
    console.error('Failed saving systemSettings/emailConfig to Firestore:', err);
  }

  const serverRes = await syncConfigToBackendServer({
    ...firestorePayload,
    configUpdatedAt: now,
  });

  if (!firestoreSaved && !serverRes) {
    throw new Error('Gagal menyimpan konfigurasi email ke server maupun database.');
  }

  return mergeEmailConfigs(serverRes, firestorePayload);
}

export async function testEmailConnection(
  testRecipient: string
): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  const fsCfg = await loadEmailConfigFromFirestore();
  const res = await fetch('/api/notifications/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      testRecipient,
      ...(fsCfg ? { smtpConfig: { ...fsCfg, configUpdatedAt: fsCfg.updatedAt } } : {}),
    }),
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
  const fsCfg = await loadEmailConfigFromFirestore();
  const res = await fetch('/api/notifications/send-email-reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      ...(fsCfg ? { smtpConfig: { ...fsCfg, configUpdatedAt: fsCfg.updatedAt } } : {}),
    }),
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
