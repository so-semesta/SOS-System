import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

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
