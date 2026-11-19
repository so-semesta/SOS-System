import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass?: string;
  fromName: string;
  fromEmail: string;
  autoScheduleEnabled: boolean;
  autoScheduleTime: string; // "HH:mm" in WIB, e.g. "20:30"
  configUpdatedAt?: number;
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
}

export interface DailySnapshotRecipient {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  grade?: string;
  osnField?: string;
  role?: string;
}

export interface DailyReminderSnapshot {
  dateKeyWIB: string;
  updatedAt: number;
  syncedBy?: string;
  recipients: DailySnapshotRecipient[];
  submittedStudentIds: string[];
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

const CONFIG_FILE = path.join(process.cwd(), 'server-email-config.json');
const SNAPSHOT_FILE = path.join(process.cwd(), 'server-reminder-snapshot.json');
const STATUS_FILE = path.join(process.cwd(), 'server-reminder-status.json');

const INDONESIAN_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function getWibTimeInfo(now: Date = new Date()) {
  const dateKeyWIB = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hourNum = Number(timeParts.find((p) => p.type === 'hour')?.value || 0) % 24;
  const minNum = Number(timeParts.find((p) => p.type === 'minute')?.value || 0);
  const hourStr = String(hourNum).padStart(2, '0');
  const minStr = String(minNum).padStart(2, '0');

  const wibDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const formattedDateWIB = `${INDONESIAN_DAYS[wibDate.getDay()]}, ${wibDate.getDate()} ${INDONESIAN_MONTHS[wibDate.getMonth()]} ${wibDate.getFullYear()}`;

  return {
    dateKeyWIB,
    timeWIB: `${hourStr}:${minStr}`,
    minutesSinceMidnight: hourNum * 60 + minNum,
    formattedDateWIB,
  };
}

// Default initial config
const defaultConfig: EmailConfig = {
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT) || 465,
  smtpSecure: true,
  smtpUser: process.env.SMTP_USER || 'scienceolympiad@semesta.sch.id',
  smtpPass: process.env.SMTP_PASS || '',
  fromName: process.env.SMTP_FROM_NAME || 'SOS Semesta',
  fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'scienceolympiad@semesta.sch.id',
  autoScheduleEnabled: false,
  autoScheduleTime: '20:30',
};

export function loadEmailConfig(): EmailConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...defaultConfig, ...parsed };
    }
  } catch (err) {
    console.error('[ServerEmail] Error loading config file:', err);
  }
  return { ...defaultConfig };
}

export function saveEmailConfig(config: Partial<EmailConfig>): EmailConfig {
  const current = loadEmailConfig();
  const updated: EmailConfig = {
    ...current,
    ...config,
    // Preserve existing password if not provided in update
    smtpPass: config.smtpPass !== undefined ? config.smtpPass : current.smtpPass,
  };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ServerEmail] Error saving config file:', err);
  }
  return updated;
}

export function loadDailySnapshot(): DailyReminderSnapshot | null {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as DailyReminderSnapshot;
      if (parsed && typeof parsed.dateKeyWIB === 'string' && Array.isArray(parsed.recipients)) {
        return {
          ...parsed,
          submittedStudentIds: Array.isArray(parsed.submittedStudentIds) ? parsed.submittedStudentIds : [],
        };
      }
    }
  } catch (err) {
    console.error('[ServerEmail] Error loading daily snapshot:', err);
  }
  return null;
}

export function saveDailySnapshot(
  dateKeyWIB: string,
  recipients: DailySnapshotRecipient[],
  syncedBy?: string
): DailyReminderSnapshot {
  const existing = loadDailySnapshot();
  const existingSubmitted =
    existing && existing.dateKeyWIB === dateKeyWIB ? existing.submittedStudentIds : [];

  const updated: DailyReminderSnapshot = {
    dateKeyWIB,
    updatedAt: Date.now(),
    syncedBy: syncedBy || existing?.syncedBy,
    recipients: recipients
      .filter((r) => !r.role || r.role === 'SOS')
      .map((r) => ({
        id: String(r.id || r.userId || ''),
        userId: String(r.userId || r.id || ''),
        fullName: String(r.fullName || 'Siswa'),
        email: String(r.email || '').trim(),
        grade: r.grade ? String(r.grade) : undefined,
        osnField: r.osnField ? String(r.osnField) : undefined,
        role: r.role ? String(r.role) : 'SOS',
      })),
    submittedStudentIds: Array.from(new Set(existingSubmitted)),
  };
  try {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ServerEmail] Error saving daily snapshot:', err);
  }
  return updated;
}

export function markStudentSubmittedInSnapshot(studentId: string, dateKeyWIB: string): void {
  if (!studentId) return;
  const existing = loadDailySnapshot();
  const submitted =
    existing && existing.dateKeyWIB === dateKeyWIB ? existing.submittedStudentIds : [];
  if (submitted.includes(studentId)) return;

  const updated: DailyReminderSnapshot = {
    dateKeyWIB,
    updatedAt: existing?.updatedAt || Date.now(),
    syncedBy: existing?.syncedBy,
    recipients:
      existing && existing.dateKeyWIB === dateKeyWIB
        ? existing.recipients.filter((r) => r.userId !== studentId && r.id !== studentId)
        : [],
    submittedStudentIds: [...submitted, studentId],
  };
  try {
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ServerEmail] Error updating snapshot submission:', err);
  }
}

export function loadDailyReminderStatus(dateKeyWIB: string): DailyReminderStatusRecord {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const raw = fs.readFileSync(STATUS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as DailyReminderStatusRecord;
      if (parsed && parsed.dateKey === dateKeyWIB) {
        return {
          ...parsed,
          sentEmails: parsed.sentEmails || {},
        };
      }
    }
  } catch (err) {
    console.error('[ServerEmail] Error loading daily status:', err);
  }
  return {
    dateKey: dateKeyWIB,
    reportSent: false,
    totalSentCount: 0,
    lastBatchSentCount: 0,
    lastBatchFailedCount: 0,
    sentEmails: {},
  };
}

export function recordDailyReminderDispatch(params: {
  dateKeyWIB: string;
  mode: 'AUTO' | 'MANUAL';
  sentBy?: string;
  details: Array<{ email: string; name: string; status: 'sent' | 'failed'; error?: string }>;
}): DailyReminderStatusRecord {
  const current = loadDailyReminderStatus(params.dateKeyWIB);
  const now = Date.now();
  const nextSentEmails = { ...(current.sentEmails || {}) };

  let batchSent = 0;
  let batchFailed = 0;
  for (const item of params.details) {
    const emailKey = (item.email || '').trim().toLowerCase();
    if (!emailKey || emailKey === 'kosong') {
      batchFailed++;
      continue;
    }
    if (item.status === 'sent') {
      batchSent++;
    } else {
      batchFailed++;
    }
    // Never overwrite a 'sent' status with a failed one unless re-sending failed
    const prev = nextSentEmails[emailKey];
    if (!prev || prev.status !== 'sent' || item.status === 'sent') {
      nextSentEmails[emailKey] = {
        email: emailKey,
        name: item.name,
        sentAt: now,
        mode: params.mode,
        status: item.status,
        error: item.error,
      };
    }
  }

  const totalSentCount = Object.values(nextSentEmails).filter((v) => v.status === 'sent').length;
  const updated: DailyReminderStatusRecord = {
    dateKey: params.dateKeyWIB,
    reportSent: current.reportSent || batchSent > 0,
    lastSentAt: batchSent > 0 ? now : current.lastSentAt,
    lastSentMode: batchSent > 0 ? params.mode : current.lastSentMode,
    lastSentBy: batchSent > 0 ? params.sentBy : current.lastSentBy,
    totalSentCount,
    lastBatchSentCount: batchSent,
    lastBatchFailedCount: batchFailed,
    sentEmails: nextSentEmails,
  };

  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ServerEmail] Error saving daily status:', err);
  }
  return updated;
}

export function createTransporter(config: EmailConfig) {
  if (config.smtpUser && config.smtpPass) {
    return nodemailer.createTransport({
      host: config.smtpHost || 'smtp.gmail.com',
      port: config.smtpPort || 465,
      secure: config.smtpPort === 465 ? true : Boolean(config.smtpSecure),
      auth: {
        user: config.smtpUser.trim(),
        pass: config.smtpPass.replace(/\s+/g, ''), // remove accidental spaces in app password
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return null;
}

export function generateHtmlEmail({
  studentName,
  reminderType = 'REPORT',
  guidanceUrl,
  competitionsUrl,
  todayFormatted,
  customNote,
  pembinaName,
  agendaItems,
}: {
  studentName: string;
  reminderType?: 'REPORT' | 'COMPETITION';
  guidanceUrl: string;
  competitionsUrl?: string;
  todayFormatted: string;
  customNote?: string;
  pembinaName?: string;
  agendaItems?: Array<{
    type?: string;
    title: string;
    formattedDate: string;
    badge?: string;
    description?: string;
  }>;
}): string {
  const isReport = reminderType === 'REPORT';
  const targetUrl = isReport
    ? (guidanceUrl || 'https://sos.olympiad.my.id/guidance')
    : (competitionsUrl || 'https://sos.olympiad.my.id/competitions');

  // Build compact agenda table if competition mode
  let agendaHtml = '';
  if (!isReport) {
    if (agendaItems && agendaItems.length > 0) {
      const rows = agendaItems
        .map(
          item => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 8px; vertical-align: top;">
            <span style="display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background-color: #ede9fe; color: #5b21b6;">
              ${item.badge || 'Lomba'}
            </span>
          </td>
          <td style="padding: 8px; vertical-align: top;">
            <strong style="font-size: 13px; color: #1e293b; display: block;">${item.title}</strong>
            ${item.description ? `<span style="font-size: 11px; color: #64748b;">${item.description}</span>` : ''}
          </td>
          <td style="padding: 8px; vertical-align: top; text-align: right; white-space: nowrap; font-size: 12px; font-weight: 600; color: #4338ca;">
            ${item.formattedDate}
          </td>
        </tr>
      `
        )
        .join('');

      agendaHtml = `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 8px; border-collapse: collapse; background-color: #faf5ff; border: 1px solid #ede9fe; border-radius: 8px; overflow: hidden;">
          <tbody>${rows}</tbody>
        </table>
      `;
    } else {
      agendaHtml = `
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; margin-top: 8px;">
          <p style="margin: 0; font-size: 12px; color: #64748b;">
            📌 Fokus Pekan Ini: Pembinaan harian dan latihan rutin materi OSN.
          </p>
        </div>
      `;
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isReport ? 'Pengingat Laporan Belajar' : 'Agenda Lomba Pekan Ini'} - SOS Semesta</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 3px 10px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">
          
          <!-- Compact Header -->
          <tr>
            <td style="background: ${isReport ? 'linear-gradient(135deg, #3730a3 0%, #4338ca 100%)' : 'linear-gradient(135deg, #065f46 0%, #059669 100%)'}; padding: 24px; text-align: left; color: #ffffff;">
              <span style="display: inline-block; background-color: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #ffffff; margin-bottom: 6px;">
                ${isReport ? 'Pengingat Harian' : 'Info Kompetisi'} • SOS Semesta
              </span>
              <h1 style="margin: 0; font-size: 19px; font-weight: 800; line-height: 1.3; color: #ffffff;">
                ${isReport ? 'Pengingat Laporan Belajar' : 'Agenda & Deadline Lomba Pekan Ini'}
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #e0e7ff;">
                📅 ${todayFormatted}
              </p>
            </td>
          </tr>

          <!-- Compact Body -->
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.5; color: #334155;">
                Halo <strong>${studentName}</strong>,
              </p>

              ${isReport ? `
                <!-- Compact Alert Box for Report -->
                <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 6px; margin-bottom: 16px;">
                  <p style="margin: 0; font-size: 13px; font-weight: 600; color: #b45309;">
                    ⚠️ Kamu belum mengisi Laporan Belajar hari ini (${todayFormatted}).
                  </p>
                  <p style="margin: 4px 0 0 0; font-size: 12px; color: #78350f; line-height: 1.4;">
                    Mohon segera mengisi jurnal belajar harian untuk mencatat waktu belajar dan perkembangan materi olimpiade kamu.
                  </p>
                </div>
              ` : `
                <!-- Compact Intro for Competition -->
                <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 14px; border-radius: 6px; margin-bottom: 16px;">
                  <p style="margin: 0; font-size: 13px; font-weight: 600; color: #047857;">
                    🏆 Agenda & Batas Waktu Kompetisi Pekan Ini
                  </p>
                  <p style="margin: 4px 0 0 0; font-size: 12px; color: #065f46; line-height: 1.4;">
                    Perhatikan jadwal babak lomba dan batas pendaftaran yang aktif berikut:
                  </p>
                </div>
                ${agendaHtml}
              `}

              ${
                customNote && customNote.trim()
                  ? `
              <div style="background-color: #f8fafc; border-left: 3px solid #6366f1; padding: 10px 14px; margin: 16px 0; border-radius: 4px;">
                <p style="margin: 0 0 2px 0; font-size: 11px; font-weight: 700; color: #4338ca; text-transform: uppercase;">
                  Pesan Pembina (${pembinaName || 'SOS'}):
                </p>
                <p style="margin: 0; font-size: 12px; color: #334155; font-style: italic;">
                  "${customNote.trim()}"
                </p>
              </div>
              `
                  : ''
              }

              <!-- Compact CTA Button -->
              <div style="text-align: center; margin: 22px 0 16px 0;">
                <a href="${targetUrl}" target="_blank" style="background-color: ${isReport ? '#4f46e5' : '#059669'}; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 13px; font-weight: 700; display: inline-block;">
                  ${isReport ? '👉 Isi Laporan Belajar Sekarang' : '🏆 Buka Info & Pendaftaran Lomba'}
                </a>
                <p style="margin: 6px 0 0 0; font-size: 11px; color: #94a3b8;">
                  Tautan: <a href="${targetUrl}" style="color: #6366f1; text-decoration: underline;">${targetUrl}</a>
                </p>
              </div>

            </td>
          </tr>

          <!-- Compact Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 14px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
              <strong style="color: #475569;">Semesta Olympiad Squad (SOS)</strong> • SMP-SMA Semesta Bilingual Boarding School<br/>
              scienceolympiad@semesta.sch.id
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
