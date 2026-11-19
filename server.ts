import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import {
  EmailConfig,
  loadEmailConfig,
  saveEmailConfig,
  createTransporter,
  generateHtmlEmail,
  getWibTimeInfo,
  loadDailySnapshot,
  saveDailySnapshot,
  markStudentSubmittedInSnapshot,
  loadDailyReminderStatus,
  recordDailyReminderDispatch,
} from "./serverEmail";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // API route for extracting poster
  app.post("/api/extract-poster", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;

      if (!base64Data) {
        return res.status(400).json({ error: "No image data provided" });
      }

      // Clean base64 if it contains the data URL prefix
      let cleanBase64 = base64Data;
      if (base64Data.includes(",")) {
        cleanBase64 = base64Data.split(",")[1];
      }

      const candidateKeys = [
        process.env.CUSTOM_GEMINI_KEY,
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_API_KEY,
      ].filter(Boolean).map(k => k!.trim());

      const uniqueKeys = Array.from(new Set(candidateKeys));

      if (uniqueKeys.length === 0) {
        return res.status(500).json({ 
          error: "API Key Gemini belum diset. Silakan masukkan API Key Anda di panel Secrets (GEMINI_API_KEY).",
          code: "NO_KEY"
        });
      }

      let lastError: any = null;
      let parsedData: any = null;

      for (const apiKey of uniqueKeys) {
        try {
          const ai = new GoogleGenAI({ 
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });
          const prompt = "Ekstrak informasi kompetisi/lomba dari poster ini. Balas HANYA dengan JSON mentah. Tanpa backticks, tanpa format markdown (```json). Langsung mulai dengan tanda { dan akhiri dengan }.";
          
          const aiResponse = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: {
              parts: [
                { inlineData: { data: cleanBase64, mimeType: mimeType || "image/jpeg" } },
                { text: prompt }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Nama kompetisi atau lomba" },
                  field: { 
                    type: Type.ARRAY, 
                    description: "Bidang/mata pelajaran lomba. Pilih SATU ATAU LEBIH dari daftar berikut yang paling sesuai: IPA, IPS, Matematika, Astronomi, Geografi, Fisika, Biologi, Kimia, Kebumian, Ekonomi, Informatika, Logika.", 
                    items: {
                      type: Type.STRING,
                      enum: ["IPA", "IPS", "Matematika", "Astronomi", "Geografi", "Fisika", "Biologi", "Kimia", "Kebumian", "Ekonomi", "Informatika", "Logika"]
                    }
                  },
                  type: { type: Type.STRING, description: "Apakah Daring, Luring, atau Hybrid?", enum: ["Daring", "Luring", "Hybrid"] },
                  registrationDeadline: { type: Type.STRING, description: "Batas waktu pendaftaran. Format: YYYY-MM-DD" },
                  fee: { type: Type.NUMBER, description: "Biaya pendaftaran dalam angka, jika gratis isi 0" },
                  location: { type: Type.STRING, description: "Lokasi lomba jika ada atau nama institusi penyelenggara" },
                  description: { type: Type.STRING, description: "Rangkuman singkat tentang lomba, syarat, dan ketentuan" },
                  rounds: {
                    type: Type.ARRAY,
                    description: "Jadwal/babak perlombaan (misal penyisihan, final)",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING, description: "Nama babak" },
                        date: { type: Type.STRING, description: "Tanggal pelaksanaan babak ini. Format: YYYY-MM-DD" }
                      }
                    }
                  }
                },
                required: ["title", "field", "type", "registrationDeadline", "fee", "rounds"]
              }
            }
          });
          const jsonText = aiResponse.text || "{}";
          const cleanJsonString = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
          parsedData = JSON.parse(cleanJsonString);
          break; // Sukses!
        } catch (err: any) {
          lastError = err;
          console.warn(`[Gemini API key ${apiKey.substring(0, 8)}... Notice]:`, err?.message?.substring(0, 100));
        }
      }

      if (parsedData) {
        return res.json(parsedData);
      }

      throw lastError || new Error("Gagal mengekstrak poster dengan API Key yang tersedia.");
    } catch (err: any) {
      let rawMessage = err?.message || String(err);
      let errorMessage = rawMessage;
      let statusCode = 500;
      let errorCode = "GENERAL_ERROR";

      console.warn("[Gemini API Provider Notice]:", rawMessage);
      
      if (errorMessage.includes("denied access") || errorMessage.includes("Your project has been denied access")) {
        statusCode = 403;
        errorCode = "PROJECT_DENIED_ACCESS";
        errorMessage = "Proyek Google AI Studio pada API Key ini sedang dibatasi (Error 403: Project denied access). Solusi: Di aistudio.google.com, klik 'Get API key' > 'Create API key in new project', lalu perbarui GEMINI_API_KEY di Secrets. Sementara itu, silakan gunakan tombol 'Isi Manual via AI Lain' untuk mengisi form secara instan.";
      } else if (errorMessage.includes("prepayment credits are depleted") || errorMessage.includes("402")) {
        statusCode = 402;
        errorCode = "CREDITS_DEPLETED";
        errorMessage = "Saldo kredit API Key Gemini (Prepay) telah habis. Silakan perbarui GEMINI_API_KEY atau CUSTOM_GEMINI_KEY dengan API Key aktif Anda di panel Settings > Secrets AI Studio, atau gunakan tombol 'Isi Manual via AI Lain'.";
      } else if (errorMessage.includes("leaked") || errorMessage.includes("reported as leaked")) {
        statusCode = 403;
        errorCode = "KEY_LEAKED";
        errorMessage = "Kunci API Gemini lama (berawalan AIza) telah diblokir Google karena terindikasi bocor. Format API Key baru Anda yang berawalan 'AQ...' adalah format resmi terbaru dari Google AI Studio. Silakan perbarui nilai GEMINI_API_KEY atau CUSTOM_GEMINI_KEY dengan API Key 'AQ...' Anda di Secrets.";
      } else if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("Quota")) {
        statusCode = 429;
        errorCode = "RATE_LIMITED";
        errorMessage = "Batas kuota API Gemini tercapai (Error 429: Resource Exhausted). Silakan coba lagi beberapa saat atau gunakan 'Isi Manual via AI Lain'.";
      } else if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("UNAUTHENTICATED")) {
        statusCode = 401;
        errorCode = "INVALID_KEY";
        errorMessage = "API Key tidak valid atau belum aktif. Kunci dengan awalan 'AQ...' adalah format baru resmi dari Google AI Studio. Pastikan seluruh karakter tersalin dengan lengkap tanpa spasi tambahan di Secrets.";
      }
      
      return res.status(statusCode).json({ error: errorMessage, code: errorCode });
    }
  });

  // --- AUTOMATED EMAIL REMINDER API ROUTES ---

  const sanitizeConfigResponse = (config: EmailConfig) => ({
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpSecure: config.smtpSecure,
    smtpUser: config.smtpUser,
    fromName: config.fromName,
    fromEmail: config.fromEmail,
    autoScheduleEnabled: config.autoScheduleEnabled,
    autoScheduleTime: config.autoScheduleTime,
    configUpdatedAt: config.configUpdatedAt,
    lastAutoSentDate: config.lastAutoSentDate,
    lastAutoSentAt: config.lastAutoSentAt,
    lastAutoSentCount: config.lastAutoSentCount,
    lastAutoFailedCount: config.lastAutoFailedCount,
    lastAutoStatus: config.lastAutoStatus,
    lastAutoMessage: config.lastAutoMessage,
    lastManualSentDate: config.lastManualSentDate,
    lastManualSentAt: config.lastManualSentAt,
    lastManualSentCount: config.lastManualSentCount,
    lastManualSentBy: config.lastManualSentBy,
    hasStoredPassword: Boolean(config.smtpPass && config.smtpPass.length > 0),
  });

  // 1. Get Email Configuration (sanitized, hides real password)
  app.get("/api/notifications/email-config", (req, res) => {
    try {
      const config = loadEmailConfig();
      res.json(sanitizeConfigResponse(config));
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Gagal membaca konfigurasi email" });
    }
  });

  // 2. Save Email Configuration
  app.post("/api/notifications/email-config", (req, res) => {
    try {
      const current = loadEmailConfig();
      const incomingBody = req.body || {};
      const patch: Partial<EmailConfig> = {
        ...incomingBody,
        configUpdatedAt: typeof incomingBody.configUpdatedAt === "number" ? incomingBody.configUpdatedAt : Date.now(),
      };

      // If user explicitly updated autoScheduleTime to a future WIB time today, allow re-trigger today
      if (
        typeof incomingBody.autoScheduleTime === "string" &&
        incomingBody.autoScheduleTime !== current.autoScheduleTime
      ) {
        const { dateKeyWIB, minutesSinceMidnight } = getWibTimeInfo();
        const [h, m] = incomingBody.autoScheduleTime.split(":").map(Number);
        const newTargetMins = (Number(h) || 0) * 60 + (Number(m) || 0);
        if (current.lastAutoSentDate === dateKeyWIB && newTargetMins > minutesSinceMidnight) {
          patch.lastAutoSentDate = undefined;
          patch.lastAutoStatus = undefined;
          patch.lastAutoMessage = undefined;
        }
      }

      const updated = saveEmailConfig(patch);
      res.json(sanitizeConfigResponse(updated));
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Gagal menyimpan konfigurasi email" });
    }
  });

  // 2b. Daily Reminder Status (WIB today)
  app.get("/api/notifications/daily-status", (req, res) => {
    try {
      const { dateKeyWIB, formattedDateWIB, timeWIB } = getWibTimeInfo();
      const config = loadEmailConfig();
      const status = loadDailyReminderStatus(dateKeyWIB);
      const snapshot = loadDailySnapshot();
      const activeSnapshotCount =
        snapshot && snapshot.dateKeyWIB === dateKeyWIB
          ? snapshot.recipients.filter(
              (r) =>
                r.email &&
                r.email.includes("@") &&
                !snapshot.submittedStudentIds.includes(r.userId || r.id)
            ).length
          : 0;

      res.json({
        dateKeyWIB,
        formattedDateWIB,
        currentTimeWIB: timeWIB,
        status,
        snapshotCount: activeSnapshotCount,
        snapshotUpdatedAt: snapshot?.dateKeyWIB === dateKeyWIB ? snapshot.updatedAt : null,
        config: sanitizeConfigResponse(config),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Gagal memuat status pengingat harian" });
    }
  });

  // 2c. Sync Daily Unsubmitted Students Snapshot from Admin GuidanceMonitor
  app.post("/api/notifications/sync-daily-snapshot", (req, res) => {
    try {
      const { recipients, syncedBy } = req.body || {};
      if (!Array.isArray(recipients)) {
        return res.status(400).json({ error: "recipients harus berupa array." });
      }
      const { dateKeyWIB } = getWibTimeInfo();
      const saved = saveDailySnapshot(dateKeyWIB, recipients, syncedBy);
      const activeCount = saved.recipients.filter(
        (r) =>
          r.email &&
          r.email.includes("@") &&
          !saved.submittedStudentIds.includes(r.userId || r.id)
      ).length;

      // If scheduler was previously waiting for snapshot inside today's trigger window, run now
      const cfg = loadEmailConfig();
      if (cfg.autoScheduleEnabled && cfg.lastAutoStatus === "SKIPPED_NO_SNAPSHOT") {
        void runAutoReminderCheck();
      }

      return res.json({
        success: true,
        dateKeyWIB,
        snapshotCount: activeCount,
        updatedAt: saved.updatedAt,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Gagal menyinkronkan daftar siswa" });
    }
  });

  // 2d. Mark Student as Submitted Today (when student checks in on Guidance page)
  app.post("/api/notifications/mark-submitted", (req, res) => {
    try {
      const { studentId } = req.body || {};
      if (!studentId || typeof studentId !== "string") {
        return res.status(400).json({ error: "studentId wajib diisi." });
      }
      const { dateKeyWIB } = getWibTimeInfo();
      markStudentSubmittedInSnapshot(studentId, dateKeyWIB);
      return res.json({ success: true, dateKeyWIB });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Gagal menandai check-in siswa" });
    }
  });

  // 3. Test Email Connection
  app.post("/api/notifications/test-connection", async (req, res) => {
    try {
      let config = loadEmailConfig();
      const incomingSmtp = req.body?.smtpConfig;
      if ((!config.smtpPass || !config.smtpUser) && incomingSmtp?.smtpPass) {
        config = saveEmailConfig({
          ...incomingSmtp,
          configUpdatedAt: incomingSmtp.configUpdatedAt || Date.now(),
        });
      }
      const testRecipient = req.body.testRecipient || config.fromEmail;

      if (!config.smtpUser || !config.smtpPass) {
        return res.status(400).json({
          success: false,
          message:
            "Kredensial SMTP belum lengkap. Mohon isi Email Pengirim dan Google App Password (16 digit) terlebih dahulu di pengaturan.",
        });
      }

      const transporter = createTransporter(config);
      if (!transporter) {
        return res.status(400).json({ success: false, message: "Gagal membuat koneksi SMTP." });
      }

      await transporter.verify();

      await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: testRecipient,
        subject: "[TEST SOS] Uji Koneksi Email Otomatis Semesta",
        text: "Koneksi email otomatis sistem Semesta Olympiad Squad (SOS) berhasil terhubung!",
        html: `
          <div style="font-family: sans-serif; padding: 24px; border: 1px solid #6366f1; border-radius: 10px; max-width: 500px; background-color: #faf5ff;">
            <h2 style="color: #4338ca; margin-top: 0;">Uji Koneksi Email Berhasil! ✅</h2>
            <p style="color: #334155; font-size: 14px; line-height: 1.5;">
              Sistem SOS Semesta telah berhasil terhubung ke server SMTP <strong>${config.smtpHost}</strong> menggunakan akun <strong>${config.smtpUser}</strong>.
            </p>
            <p style="color: #475569; font-size: 13px;">
              Email pengingat jurnal harian & agenda pekan ini kini siap dikirimkan secara langsung dan otomatis ke email siswa tanpa perlu membuka mailto.
            </p>
            <hr style="border: none; border-top: 1px solid #e0e7ff; margin: 16px 0;" />
            <span style="font-size: 11px; color: #64748b;">Semesta Olympiad Squad • SMP-SMA Semesta</span>
          </div>
        `,
      });

      return res.json({
        success: true,
        message: `Koneksi SMTP sukses! Email uji coba berhasil dikirim ke ${testRecipient}.`,
      });
    } catch (err: any) {
      console.error("[Test Connection Error]:", err);
      let errorMsg = err.message || "Gagal menghubungi server SMTP";
      if (errorMsg.includes("Invalid login") || errorMsg.includes("535") || errorMsg.includes("BadCredentials")) {
        errorMsg =
          "Login SMTP gagal (Username/Password salah). Untuk akun Google / Google Workspace (@semesta.sch.id), gunakan 16-digit Google App Password (bukan kata sandi akun biasa). Buka myaccount.google.com > Keamanan > Sandi Aplikasi.";
      }
      return res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  });

  // 4. Send Direct Email Reminders from System
  app.post("/api/notifications/send-email-reminders", async (req, res) => {
    try {
      const {
        recipients,
        subject,
        reminderType = "REPORT",
        customNote,
        guidanceUrl = "https://sos.olympiad.my.id/guidance",
        competitionsUrl = "https://sos.olympiad.my.id/competitions",
        todayFormatted,
        pembinaName,
        agendaItems = [],
        smtpConfig,
      } = req.body;

      if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "Daftar penerima email kosong." });
      }

      let config = loadEmailConfig();
      if ((!config.smtpPass || !config.smtpUser) && smtpConfig?.smtpPass) {
        config = saveEmailConfig({
          ...smtpConfig,
          configUpdatedAt: smtpConfig.configUpdatedAt || Date.now(),
        });
      }
      let transporter = createTransporter(config);
      let mode: "smtp" | "ethereal" = "smtp";
      let testAccountUrl: string | undefined;

      // If SMTP credentials not provided yet, use ethereal to preview rendered email
      if (!transporter) {
        mode = "ethereal";
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      }

      const details: Array<{ email: string; name: string; status: "sent" | "failed"; error?: string }> = [];
      let sentCount = 0;
      let failedCount = 0;

      const isReport = reminderType === "REPORT";

      for (const student of recipients) {
        if (isReport && student.role && student.role !== "SOS") {
          continue;
        }
        if (!student.email || !student.email.includes("@")) {
          details.push({
            email: student.email || "kosong",
            name: student.fullName,
            status: "failed",
            error: "Alamat email tidak valid atau belum terdaftar",
          });
          failedCount++;
          continue;
        }

        const studentHtml = generateHtmlEmail({
          studentName: student.fullName,
          reminderType,
          guidanceUrl,
          competitionsUrl,
          todayFormatted: todayFormatted || "Hari Ini",
          customNote,
          pembinaName: pembinaName || config.fromName,
          agendaItems,
        });

        const plainText = isReport
          ? `Halo ${student.fullName},\n\nMengingatkan untuk mengisi Laporan Belajar Harian hari ini (${todayFormatted || "Hari Ini"}).\nSilakan isi melalui: ${guidanceUrl}\n\nSalam,\n${pembinaName || config.fromName} - SOS Semesta`
          : `Halo ${student.fullName},\n\nBerikut agenda dan batas waktu kompetisi pekan ini.\nSilakan cek detail lomba di: ${competitionsUrl || guidanceUrl.replace(/\/guidance.*/, '') + '/competitions'}\n\nSalam,\n${pembinaName || config.fromName} - SOS Semesta`;

        try {
          const info = await transporter.sendMail({
            from: `"${config.fromName}" <${config.fromEmail}>`,
            to: student.email,
            subject:
              subject ||
              (isReport
                ? `[SOS Semesta] Pengingat Laporan Belajar (${todayFormatted})`
                : `[SOS Semesta] Info & Agenda Lomba Pekan Ini`),
            text: plainText,
            html: studentHtml,
          });

          if (mode === "ethereal" && !testAccountUrl) {
            testAccountUrl = nodemailer.getTestMessageUrl(info) || undefined;
          }

          details.push({
            email: student.email,
            name: student.fullName,
            status: "sent",
          });
          sentCount++;
        } catch (sendErr: any) {
          console.error(`[Email Send Error to ${student.email}]:`, sendErr);
          details.push({
            email: student.email,
            name: student.fullName,
            status: "failed",
            error: sendErr.message || "Gagal terkirim",
          });
          failedCount++;
        }
      }

      const { dateKeyWIB } = getWibTimeInfo();
      saveEmailConfig({
        lastManualSentDate: dateKeyWIB,
        lastManualSentAt: Date.now(),
        lastManualSentCount: sentCount,
        lastManualSentBy: pembinaName || config.fromName,
      });

      const dailyStatus =
        reminderType === "REPORT"
          ? recordDailyReminderDispatch({
              dateKeyWIB,
              mode: "MANUAL",
              sentBy: pembinaName || config.fromName,
              details,
            })
          : loadDailyReminderStatus(dateKeyWIB);

      return res.json({
        success: sentCount > 0,
        total: recipients.length,
        sentCount,
        failedCount,
        mode,
        previewUrl: testAccountUrl,
        dailyStatus,
        message:
          mode === "smtp"
            ? `Berhasil mengirim ${sentCount} email otomatis langsung ke kotak masuk siswa!`
            : `Mode Pratinjau Ethereal Aktif (${sentCount} email diproses). Konfigurasikan Google App Password akun scienceolympiad@semesta.sch.id di tab Pengaturan Email untuk pengiriman riil.`,
        details,
      });
    } catch (err: any) {
      console.error("[Send Email Reminders Error]:", err);
      return res.status(500).json({ error: err.message || "Gagal memproses pengiriman email otomatis" });
    }
  });

  // Real Automated Daily Reminder Scheduler (runs every 30 seconds in WIB)
  let isAutoSchedulerRunning = false;

  async function runAutoReminderCheck() {
    if (isAutoSchedulerRunning) return;
    isAutoSchedulerRunning = true;

    try {
      const config = loadEmailConfig();
      if (!config.autoScheduleEnabled) return;

      const { dateKeyWIB, timeWIB, minutesSinceMidnight, formattedDateWIB } = getWibTimeInfo();
      const [schedH, schedM] = String(config.autoScheduleTime || "20:30").split(":").map(Number);
      if (Number.isNaN(schedH) || Number.isNaN(schedM)) return;
      const targetMinutes = schedH * 60 + schedM;

      // Trigger within [targetMinutes, targetMinutes + 15 minutes] once per WIB day
      if (config.lastAutoSentDate === dateKeyWIB && Boolean(config.lastAutoSentAt)) return;
      if (minutesSinceMidnight < targetMinutes || minutesSinceMidnight > targetMinutes + 15) return;

      const transporter = createTransporter(config);
      if (!transporter) {
        console.warn("[Auto Scheduler] Skipped: SMTP credentials not configured.");
        saveEmailConfig({
          lastAutoSentDate: dateKeyWIB,
          lastAutoSentAt: Date.now(),
          lastAutoSentCount: 0,
          lastAutoFailedCount: 0,
          lastAutoStatus: "SKIPPED_NO_SMTP",
          lastAutoMessage: "Kredensial SMTP / Google App Password belum lengkap.",
        });
        return;
      }

      const snapshot = loadDailySnapshot();
      if (!snapshot || snapshot.dateKeyWIB !== dateKeyWIB) {
        if (config.lastAutoStatus !== "SKIPPED_NO_SNAPSHOT") {
          console.warn("[Auto Scheduler] Waiting for today's unsubmitted student snapshot.");
          saveEmailConfig({
            lastAutoStatus: "SKIPPED_NO_SNAPSHOT",
            lastAutoMessage:
              "Daftar siswa hari ini belum tersinkronisasi (belum ada Admin membuka Guidance & Monitoring hari ini).",
          });
        }
        return;
      }

      const submittedSet = new Set(snapshot.submittedStudentIds || []);
      const targets = snapshot.recipients.filter(
        (r) =>
          (!r.role || r.role === "SOS") &&
          r.email &&
          r.email.includes("@") &&
          !submittedSet.has(r.userId || r.id)
      );

      if (targets.length === 0) {
        console.log(`[Auto Scheduler] All students already submitted on ${dateKeyWIB}.`);
        saveEmailConfig({
          lastAutoSentDate: dateKeyWIB,
          lastAutoSentAt: Date.now(),
          lastAutoSentCount: 0,
          lastAutoFailedCount: 0,
          lastAutoStatus: "SKIPPED_EMPTY",
          lastAutoMessage: "Seluruh siswa sudah mengisi laporan belajar hari ini.",
        });
        return;
      }

      console.log(
        `[Auto Scheduler] Sending daily reminders at ${timeWIB} WIB (${dateKeyWIB}) to ${targets.length} students...`
      );

      const guidanceUrl = "https://sos.olympiad.my.id/guidance";
      const details: Array<{ email: string; name: string; status: "sent" | "failed"; error?: string }> = [];
      let sentCount = 0;
      let failedCount = 0;

      for (const student of targets) {
        const html = generateHtmlEmail({
          studentName: student.fullName,
          reminderType: "REPORT",
          guidanceUrl,
          todayFormatted: formattedDateWIB,
          pembinaName: config.fromName,
        });
        const plainText = `Halo ${student.fullName},\n\nMengingatkan untuk mengisi Laporan Belajar Harian hari ini (${formattedDateWIB}).\nSilakan isi melalui: ${guidanceUrl}\n\nSalam,\n${config.fromName} - SOS Semesta`;

        try {
          await transporter.sendMail({
            from: `"${config.fromName}" <${config.fromEmail}>`,
            to: student.email,
            subject: `[SOS Semesta] Pengingat Laporan Belajar (${formattedDateWIB})`,
            text: plainText,
            html,
          });
          details.push({ email: student.email, name: student.fullName, status: "sent" });
          sentCount++;
        } catch (sendErr: any) {
          console.error(`[Auto Scheduler] Failed sending to ${student.email}:`, sendErr?.message || sendErr);
          details.push({
            email: student.email,
            name: student.fullName,
            status: "failed",
            error: sendErr?.message || "Gagal terkirim",
          });
          failedCount++;
        }
      }

      const statusFlag =
        sentCount > 0 && failedCount === 0
          ? "SENT"
          : sentCount > 0
          ? "PARTIAL"
          : "FAILED";

      recordDailyReminderDispatch({
        dateKeyWIB,
        mode: "AUTO",
        sentBy: `Jadwal Otomatis (${config.autoScheduleTime} WIB)`,
        details,
      });

      saveEmailConfig({
        lastAutoSentDate: dateKeyWIB,
        lastAutoSentAt: Date.now(),
        lastAutoSentCount: sentCount,
        lastAutoFailedCount: failedCount,
        lastAutoStatus: statusFlag,
        lastAutoMessage:
          sentCount > 0
            ? `Terkirim otomatis ke ${sentCount} siswa pada pukul ${timeWIB} WIB${failedCount > 0 ? ` (${failedCount} gagal)` : ""}.`
            : `Gagal mengirim email terjadwal (${failedCount} gagal).`,
      });

      console.log(
        `[Auto Scheduler] Completed ${dateKeyWIB} at ${timeWIB} WIB: ${sentCount} sent, ${failedCount} failed.`
      );
    } catch (schedErr) {
      console.error("[Scheduler Error]:", schedErr);
    } finally {
      isAutoSchedulerRunning = false;
    }
  }

  setInterval(() => {
    void runAutoReminderCheck();
  }, 30000);

  // --- DEVICE PERMIT PDF UPLOAD & SERVE ROUTES ---
  const permitUploadsDir = path.join(process.cwd(), "public", "uploads", "device-permits");

  const getDefaultPermitPdfPath = (unit: "SMP" | "SMA") =>
    path.join(
      process.cwd(),
      "public",
      "assets",
      "aistudio",
      unit === "SMP" ? "2627SMP_4cc5979e.pdf" : "2627SMA_97f45d75.pdf"
    );

  const loadFirebaseConfigSafe = () => {
    try {
      const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(cfgPath)) {
        return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      }
    } catch {
      // ignore
    }
    return null;
  };

  app.post("/api/device-permits/upload-pdf", (req, res) => {
    try {
      const { unit, fileName, base64Data } = req.body || {};
      if (unit !== "SMP" && unit !== "SMA") {
        return res.status(400).json({ error: "Unit harus SMP atau SMA." });
      }
      if (!base64Data || typeof base64Data !== "string") {
        return res.status(400).json({ error: "Data file PDF tidak ditemukan." });
      }

      const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
      const pdfBuffer = Buffer.from(cleanBase64.trim(), "base64");

      if (pdfBuffer.length < 100 || pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
        return res.status(400).json({ error: "File yang diunggah bukan dokumen PDF yang valid." });
      }
      if (pdfBuffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "Ukuran maksimal PDF adalah 10 MB." });
      }

      fs.mkdirSync(permitUploadsDir, { recursive: true });
      const pdfPath = path.join(permitUploadsDir, `${unit}_latest.pdf`);
      const metaPath = path.join(permitUploadsDir, `${unit}_meta.json`);
      const safeFileName = (typeof fileName === "string" && fileName.trim() ? fileName.trim() : `${unit}_Izin_Device_SOS.pdf`).replace(/[^a-zA-Z0-9._\- ]/g, "_");
      const now = Date.now();

      fs.writeFileSync(pdfPath, pdfBuffer);
      fs.writeFileSync(metaPath, JSON.stringify({ fileName: safeFileName, updatedAt: now, sizeBytes: pdfBuffer.length }));

      return res.json({
        success: true,
        url: `/api/device-permits/pdf/${unit}?v=${now}`,
        fileName: safeFileName,
        sizeBytes: pdfBuffer.length,
        updatedAt: now,
      });
    } catch (err: any) {
      console.error("[Upload Permit PDF Error]:", err);
      return res.status(500).json({ error: err?.message || "Gagal menyimpan PDF di server." });
    }
  });

  app.get("/api/device-permits/pdf/:unit", async (req, res) => {
    try {
      const unitParam = String(req.params.unit || "").toUpperCase();
      if (unitParam !== "SMP" && unitParam !== "SMA") {
        return res.status(400).send("Invalid unit");
      }
      const unit = unitParam as "SMP" | "SMA";
      const pdfPath = path.join(permitUploadsDir, `${unit}_latest.pdf`);
      const metaPath = path.join(permitUploadsDir, `${unit}_meta.json`);

      let downloadName = `${unit}_Izin_Device_SOS.pdf`;
      let metaUpdatedAt = 0;
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
          if (meta?.fileName) downloadName = meta.fileName;
          if (meta?.updatedAt) metaUpdatedAt = Number(meta.updatedAt) || 0;
        } catch {
          // ignore
        }
      }

      const requestedV = Number(req.query.v || 0);
      const isDiskCacheStale = requestedV > 0 && metaUpdatedAt > 0 && requestedV > metaUpdatedAt + 2000;

      if (fs.existsSync(pdfPath) && !isDiskCacheStale) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${downloadName}"`);
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        return res.sendFile(pdfPath);
      }

      // Self-heal from Firestore chunks if server restarted on ephemeral disk
      const fbCfg = loadFirebaseConfigSafe();
      if (fbCfg?.projectId && fbCfg?.firestoreDatabaseId) {
        const baseDocUrl = `https://firestore.googleapis.com/v1/projects/${fbCfg.projectId}/databases/${fbCfg.firestoreDatabaseId}/documents/devicePermitLetters/${unit}`;
        const docResp = await fetch(baseDocUrl);
        if (docResp.ok) {
          const docJson: any = await docResp.json();
          const fields = docJson?.fields || {};
          const sourceType = fields?.sourceType?.stringValue;
          const externalUrl = fields?.url?.stringValue;
          const fbFileName = fields?.fileName?.stringValue;
          if (fbFileName) downloadName = fbFileName;

          if (sourceType === "url" && externalUrl && /^https?:\/\//i.test(externalUrl)) {
            return res.redirect(externalUrl);
          }

          if (fields?.hasChunks?.booleanValue) {
            const chunksResp = await fetch(`${baseDocUrl}/chunks?pageSize=50`);
            if (chunksResp.ok) {
              const chunksJson: any = await chunksResp.json();
              const docs = Array.isArray(chunksJson?.documents) ? chunksJson.documents : [];
              if (docs.length > 0) {
                docs.sort((a: any, b: any) => {
                  const ia = Number(a?.fields?.index?.integerValue ?? 0);
                  const ib = Number(b?.fields?.index?.integerValue ?? 0);
                  return ia - ib;
                });
                const combinedBase64 = docs.map((d: any) => d?.fields?.data?.stringValue || "").join("");
                if (combinedBase64) {
                  const restoredBuf = Buffer.from(combinedBase64, "base64");
                  fs.mkdirSync(permitUploadsDir, { recursive: true });
                  fs.writeFileSync(pdfPath, restoredBuf);
                  fs.writeFileSync(metaPath, JSON.stringify({ fileName: downloadName, updatedAt: Date.now(), sizeBytes: restoredBuf.length }));
                  res.setHeader("Content-Type", "application/pdf");
                  res.setHeader("Content-Disposition", `inline; filename="${downloadName}"`);
                  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
                  return res.send(restoredBuf);
                }
              }
            }
          }
        }
      }

      // Final fallback to bundled default official PDF
      const defaultPath = getDefaultPermitPdfPath(unit);
      if (fs.existsSync(defaultPath)) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${path.basename(defaultPath)}"`);
        return res.sendFile(defaultPath);
      }

      return res.status(404).send("PDF not found");
    } catch (err: any) {
      console.error("[Serve Permit PDF Error]:", err);
      return res.status(500).send("Gagal memuat dokumen PDF");
    }
  });

  app.delete("/api/device-permits/pdf/:unit", (req, res) => {
    try {
      const unitParam = String(req.params.unit || "").toUpperCase();
      if (unitParam !== "SMP" && unitParam !== "SMA") {
        return res.status(400).json({ error: "Invalid unit" });
      }
      const pdfPath = path.join(permitUploadsDir, `${unitParam}_latest.pdf`);
      const metaPath = path.join(permitUploadsDir, `${unitParam}_meta.json`);
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Gagal mereset PDF" });
    }
  });

  // Serve static assets from public folder
  const publicPath = path.join(process.cwd(), "public");
  app.use(express.static(publicPath));
  app.use("/assets", express.static(path.join(publicPath, "assets")));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
