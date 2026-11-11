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
  autoScheduleTime: string; // "HH:mm" in WIB, e.g. "19:30"
  lastAutoSentDate?: string;
  lastAutoSentCount?: number;
}

const CONFIG_FILE = path.join(process.cwd(), 'server-email-config.json');

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
  autoScheduleTime: '19:30',
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
