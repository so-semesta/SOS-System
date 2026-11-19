import nodemailer from 'nodemailer';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SmtpCfg {
  smtpHost: string;
  smtpPort: number;
  smtpSecure?: boolean;
  smtpUser: string;
  smtpPass?: string;
  fromName: string;
  fromEmail: string;
  autoScheduleEnabled?: boolean;
  autoScheduleTime?: string;
  configUpdatedAt?: number;
}

const INDONESIAN_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function getWibTimeInfo(now: Date = new Date()) {
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
  const timeWIB = `${String(hourNum).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`;

  const wibDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const formattedDateWIB = `${INDONESIAN_DAYS[wibDate.getDay()]}, ${wibDate.getDate()} ${INDONESIAN_MONTHS[wibDate.getMonth()]} ${wibDate.getFullYear()}`;

  return { dateKeyWIB, timeWIB, formattedDateWIB };
}

function resolveSmtpConfig(bodySmtp?: Partial<SmtpCfg>): SmtpCfg {
  const port = Number(bodySmtp?.smtpPort || process.env.SMTP_PORT || 465);
  return {
    smtpHost: String(bodySmtp?.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com'),
    smtpPort: port,
    smtpSecure: typeof bodySmtp?.smtpSecure === 'boolean' ? bodySmtp.smtpSecure : port === 465,
    smtpUser: String(bodySmtp?.smtpUser || process.env.SMTP_USER || 'scienceolympiad@semesta.sch.id'),
    smtpPass: String(bodySmtp?.smtpPass || process.env.SMTP_PASS || '').trim(),
    fromName: String(bodySmtp?.fromName || process.env.SMTP_FROM_NAME || 'SOS Semesta'),
    fromEmail: String(
      bodySmtp?.fromEmail || bodySmtp?.smtpUser || process.env.SMTP_FROM_EMAIL || 'scienceolympiad@semesta.sch.id'
    ),
    autoScheduleEnabled: Boolean(bodySmtp?.autoScheduleEnabled),
    autoScheduleTime: String(bodySmtp?.autoScheduleTime || '20:30'),
    configUpdatedAt: bodySmtp?.configUpdatedAt,
  };
}

function buildHtmlEmail(params: {
  studentName: string;
  reminderType: 'REPORT' | 'COMPETITION';
  guidanceUrl: string;
  competitionsUrl?: string;
  todayFormatted: string;
  customNote?: string;
  pembinaName?: string;
  agendaItems?: Array<{
    badge?: string;
    competitionTitle?: string;
    title?: string;
    formattedDate?: string;
  }>;
}): string {
  const {
    studentName,
    reminderType,
    guidanceUrl,
    competitionsUrl,
    todayFormatted,
    customNote,
    pembinaName,
    agendaItems = [],
  } = params;

  const isReport = reminderType === 'REPORT';
  const targetUrl = isReport
    ? guidanceUrl
    : competitionsUrl || `${guidanceUrl.replace(/\/guidance.*/, '')}/competitions`;

  let agendaRowsHtml = '';
  if (!isReport) {
    agendaRowsHtml =
      agendaItems.length > 0
        ? agendaItems
            .map(
              (item) => `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
              <div style="font-weight: 700; color: #1e293b; font-size: 13px;">
                <span style="display:inline-block; background-color: #eef2ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 6px; text-transform: uppercase;">${item.badge || 'Agenda'}</span>
                ${item.competitionTitle || item.title || 'Kompetisi'}
              </div>
              <div style="font-size: 12px; color: #475569; margin-top: 2px;">${item.formattedDate || ''}</div>
            </td>
          </tr>`
            )
            .join('')
        : `<tr><td style="padding: 8px 0; font-size: 13px; color: #64748b;">Fokus pembinaan harian &amp; persiapan materi rutin OSN.</td></tr>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
    <tr>
      <td style="background: ${isReport ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'linear-gradient(135deg, #0284c7, #2563eb)'}; padding: 24px; color: #ffffff;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.9; font-weight: 700;">
          ${isReport ? 'Pengingat Harian' : 'Info Kompetisi'} • SOS Semesta
        </div>
        <h1 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 700; line-height: 1.3;">
          ${isReport ? 'Laporan Belajar Harian' : 'Agenda &amp; Batas Waktu Lomba'}
        </h1>
        <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">${todayFormatted}</div>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px;">
        <p style="margin: 0 0 14px 0; font-size: 15px; color: #1e293b;">Halo <strong>${studentName}</strong>,</p>
        ${
          isReport
            ? `<p style="margin: 0 0 18px 0; font-size: 14px; color: #334155; line-height: 1.6;">
                Kamu belum mengisi <strong>Laporan Belajar Harian</strong> untuk hari ini (<strong>${todayFormatted}</strong>). Mohon luangkan waktu sejenak untuk mencatat progres belajarmu.
              </p>`
            : `<p style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.6;">
                Berikut adalah informasi agenda lomba dan batas waktu pendaftaran pekan ini:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 18px; background: #f8fafc; border-radius: 8px; padding: 8px 14px; border: 1px solid #e2e8f0;">
                ${agendaRowsHtml}
              </table>`
        }
        ${
          customNote && customNote.trim()
            ? `<div style="margin: 0 0 18px 0; background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 4px;">
                 <div style="font-size: 11px; font-weight: 700; color: #b45309; text-transform: uppercase; margin-bottom: 4px;">Pesan Pembina (${pembinaName || 'SOS'}):</div>
                 <div style="font-size: 13px; color: #78350f;">${customNote}</div>
               </div>`
            : ''
        }
        <div style="text-align: center; margin: 20px 0 8px 0;">
          <a href="${targetUrl}" style="display: inline-block; background-color: ${isReport ? '#4f46e5' : '#0284c7'}; color: #ffffff; text-decoration: none; padding: 12px 26px; border-radius: 8px; font-weight: 700; font-size: 14px;">
            ${isReport ? 'Isi Laporan Sekarang →' : 'Lihat Detail Lomba →'}
          </a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8fafc; padding: 14px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
        <strong>Semesta Olympiad Squad (SOS)</strong> • SMP-SMA Semesta Bilingual Boarding School
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const actionRaw = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;
  const action = String(actionRaw || '');

  if (action === 'email-config') {
    if (req.method === 'GET') {
      const cfg = resolveSmtpConfig();
      return res.json({
        smtpHost: cfg.smtpHost,
        smtpPort: cfg.smtpPort,
        smtpSecure: cfg.smtpSecure,
        smtpUser: cfg.smtpUser,
        fromName: cfg.fromName,
        fromEmail: cfg.fromEmail,
        autoScheduleEnabled: cfg.autoScheduleEnabled,
        autoScheduleTime: cfg.autoScheduleTime,
        hasStoredPassword: Boolean(cfg.smtpPass),
      });
    }
    if (req.method === 'POST') {
      const cfg = resolveSmtpConfig(req.body || {});
      return res.json({
        smtpHost: cfg.smtpHost,
        smtpPort: cfg.smtpPort,
        smtpSecure: cfg.smtpSecure,
        smtpUser: cfg.smtpUser,
        fromName: cfg.fromName,
        fromEmail: cfg.fromEmail,
        autoScheduleEnabled: cfg.autoScheduleEnabled,
        autoScheduleTime: cfg.autoScheduleTime,
        configUpdatedAt: cfg.configUpdatedAt || Date.now(),
        hasStoredPassword: Boolean(cfg.smtpPass),
      });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (action === 'daily-status' && req.method === 'GET') {
    const { dateKeyWIB, timeWIB, formattedDateWIB } = getWibTimeInfo();
    const cfg = resolveSmtpConfig();
    return res.json({
      dateKeyWIB,
      formattedDateWIB,
      currentTimeWIB: timeWIB,
      status: {
        dateKey: dateKeyWIB,
        reportSent: false,
        totalSentCount: 0,
        lastBatchSentCount: 0,
        lastBatchFailedCount: 0,
        sentEmails: {},
      },
      snapshotCount: 0,
      snapshotUpdatedAt: null,
      config: {
        smtpHost: cfg.smtpHost,
        smtpPort: cfg.smtpPort,
        smtpSecure: cfg.smtpSecure,
        smtpUser: cfg.smtpUser,
        fromName: cfg.fromName,
        fromEmail: cfg.fromEmail,
        autoScheduleEnabled: cfg.autoScheduleEnabled,
        autoScheduleTime: cfg.autoScheduleTime,
        hasStoredPassword: Boolean(cfg.smtpPass),
      },
    });
  }

  if (action === 'sync-daily-snapshot' && req.method === 'POST') {
    const { dateKeyWIB } = getWibTimeInfo();
    const recipients = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
    return res.json({
      success: true,
      dateKeyWIB,
      snapshotCount: recipients.length,
      updatedAt: Date.now(),
    });
  }

  if (action === 'mark-submitted' && req.method === 'POST') {
    const { dateKeyWIB } = getWibTimeInfo();
    return res.json({ success: true, dateKeyWIB });
  }

  if (action === 'test-connection' && req.method === 'POST') {
    try {
      const cfg = resolveSmtpConfig(req.body?.smtpConfig);
      const testRecipient = String(req.body?.testRecipient || cfg.fromEmail || '').trim();
      if (!cfg.smtpUser || !cfg.smtpPass) {
        return res.status(400).json({
          success: false,
          message:
            'Kredensial SMTP belum lengkap. Mohon isi Email Pengirim dan Google App Password (16 digit) lalu klik Simpan Pengaturan.',
        });
      }
      const transporter = nodemailer.createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        secure: cfg.smtpPort === 465 ? true : Boolean(cfg.smtpSecure),
        auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
      });
      await transporter.verify();
      await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to: testRecipient,
        subject: '[TEST SOS] Uji Koneksi Email Otomatis Semesta',
        text: 'Koneksi email otomatis sistem Semesta Olympiad Squad (SOS) berhasil terhubung!',
      });
      return res.json({
        success: true,
        message: `Koneksi SMTP sukses! Email uji coba berhasil dikirim ke ${testRecipient}.`,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Gagal menghubungi server SMTP',
      });
    }
  }

  if (action === 'send-email-reminders' && req.method === 'POST') {
    try {
      const {
        recipients = [],
        subject,
        reminderType = 'REPORT',
        customNote,
        guidanceUrl = 'https://sos.olympiad.my.id/guidance',
        competitionsUrl = 'https://sos.olympiad.my.id/competitions',
        todayFormatted,
        pembinaName,
        agendaItems = [],
        smtpConfig,
      } = req.body || {};

      if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: 'Daftar penerima email kosong.' });
      }

      const cfg = resolveSmtpConfig(smtpConfig);
      if (!cfg.smtpUser || !cfg.smtpPass) {
        return res.status(400).json({
          error: 'Kredensial SMTP / Google App Password belum disimpan. Silakan simpan pengaturan email terlebih dahulu.',
        });
      }

      const transporter = nodemailer.createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        secure: cfg.smtpPort === 465 ? true : Boolean(cfg.smtpSecure),
        auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
      });

      const details: Array<{ email: string; name: string; status: 'sent' | 'failed'; error?: string }> = [];
      let sentCount = 0;
      let failedCount = 0;
      const isReport = reminderType === 'REPORT';

      for (const student of recipients) {
        if (isReport && student.role && student.role !== 'SOS') continue;
        if (!student.email || !String(student.email).includes('@')) {
          details.push({
            email: student.email || 'kosong',
            name: student.fullName || 'Siswa',
            status: 'failed',
            error: 'Alamat email tidak valid',
          });
          failedCount++;
          continue;
        }
        try {
          await transporter.sendMail({
            from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
            to: student.email,
            subject:
              subject ||
              (isReport
                ? `[SOS Semesta] Pengingat Laporan Belajar (${todayFormatted || 'Hari Ini'})`
                : '[SOS Semesta] Info & Agenda Lomba Pekan Ini'),
            html: buildHtmlEmail({
              studentName: student.fullName || 'Siswa',
              reminderType,
              guidanceUrl,
              competitionsUrl,
              todayFormatted: todayFormatted || 'Hari Ini',
              customNote,
              pembinaName: pembinaName || cfg.fromName,
              agendaItems,
            }),
          });
          details.push({ email: student.email, name: student.fullName || 'Siswa', status: 'sent' });
          sentCount++;
        } catch (sendErr: any) {
          details.push({
            email: student.email,
            name: student.fullName || 'Siswa',
            status: 'failed',
            error: sendErr?.message || 'Gagal terkirim',
          });
          failedCount++;
        }
      }

      const { dateKeyWIB } = getWibTimeInfo();
      const sentEmails: Record<string, any> = {};
      const now = Date.now();
      details.forEach((d) => {
        if (d.status === 'sent' && d.email) {
          sentEmails[d.email.toLowerCase()] = {
            email: d.email,
            name: d.name,
            sentAt: now,
            mode: 'MANUAL',
            status: 'sent',
          };
        }
      });

      return res.json({
        success: sentCount > 0,
        total: recipients.length,
        sentCount,
        failedCount,
        mode: 'smtp',
        dailyStatus: {
          dateKey: dateKeyWIB,
          reportSent: isReport && sentCount > 0,
          lastSentAt: now,
          lastSentMode: 'MANUAL',
          lastSentBy: pembinaName || cfg.fromName,
          totalSentCount: sentCount,
          lastBatchSentCount: sentCount,
          lastBatchFailedCount: failedCount,
          sentEmails,
        },
        message: `Berhasil mengirim ${sentCount} email otomatis langsung ke kotak masuk siswa!`,
        details,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Gagal memproses pengiriman email' });
    }
  }

  return res.status(404).json({ error: 'Notification endpoint not found' });
}
