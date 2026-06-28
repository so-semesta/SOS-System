import { GoogleGenAI, Type } from "@google/genai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { base64Data, mimeType } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: "No image data provided" });
    }

    // In Vercel, environment variables are set in the Vercel dashboard.
    const apiKey = (process.env.CUSTOM_GEMINI_KEY || process.env.GEMINI_API_KEY)?.trim();

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured in the Vercel environment variables." });
    }

    let cleanBase64 = base64Data;
    if (base64Data.includes(",")) {
      cleanBase64 = base64Data.split(",")[1];
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

    return res.status(200).json(parsedData);
  } catch (err: any) {
    console.error("GEMINI_ERROR:", err);
    let errorMessage = err.message || "Gagal menghubungi Gemini API";
    return res.status(500).json({ error: errorMessage });
  }
}
