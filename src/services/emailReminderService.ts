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
  autoScheduleTime: string; // "HH:mm" in WIB (e.g. "19:30")
  lastAutoSentDate?: string;
  lastAutoSentCount?: number;
  hasStoredPassword?: boolean;
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
  message: string;
  details: Array<{
    email: string;
    name: string;
    status: 'sent' | 'failed';
    error?: string;
  }>;
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
    body: JSON.stringify(config)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Gagal menyimpan konfigurasi email');
  }
  return res.json();
}

export async function testEmailConnection(testRecipient: string): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  const res = await fetch('/api/notifications/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testRecipient })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Koneksi email gagal');
  }
  return data;
}

export async function sendDirectEmailReminders(payload: SendRemindersPayload): Promise<SendRemindersResult> {
  const res = await fetch('/api/notifications/send-email-reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.details) {
    throw new Error(data.error || 'Gagal mengirim email pengingat otomatis');
  }
  return data;
}
