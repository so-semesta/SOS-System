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

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured in the environment variables." });
      }

      // Clean base64 if it contains the data URL prefix
      let cleanBase64 = base64Data;
      if (base64Data.includes(",")) {
        cleanBase64 = base64Data.split(",")[1];
      }

      const apiKey = (process.env.CUSTOM_GEMINI_KEY || process.env.GEMINI_API_KEY)?.trim();
      console.log("🔎 DETEKTOR KUNCI:", apiKey ? apiKey.substring(0, 10) + "******" : "KOSONG/UNDEFINED");

      if (!apiKey) {
        throw new Error("KUNCI API TIDAK DITEMUKAN DI ENVIRONMENT!");
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = "Ekstrak informasi kompetisi/lomba dari poster ini. Balas HANYA dengan JSON mentah. Tanpa backticks, tanpa format markdown (```json). Langsung mulai dengan tanda { dan akhiri dengan }.";
      
      const aiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
      const parsedData = JSON.parse(cleanJsonString);

      return res.json(parsedData);
    } catch (err: any) {
      console.error("GEMINI_ERROR:", err);
      let errorMessage = err.message || "Gagal menghubungi Gemini API";
      
      if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
        errorMessage = "API Key yang Anda masukkan tidak valid. Kunci dengan awalan 'AQ' adalah format baru yang benar! Namun sepertinya ada sedikit kesalahan saat menyalin, atau kuncinya belum aktif. Coba hapus kunci di menu Secrets, buat kunci baru di aistudio.google.com, pastikan tersalin semua (tidak ada yang terpotong), lalu masukkan kembali.";
      }
      
      return res.status(500).json({ error: errorMessage });
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
