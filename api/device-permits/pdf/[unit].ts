import fs from "fs";
import path from "path";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const unitRaw = Array.isArray(req.query.unit) ? req.query.unit[0] : req.query.unit;
    const unit = String(unitRaw || "").toUpperCase();
    if (unit !== "SMP" && unit !== "SMA") {
      return res.status(400).send("Invalid unit");
    }

    let fbCfg: any = null;
    try {
      const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(cfgPath)) {
        fbCfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      }
    } catch {
      // ignore
    }

    if (fbCfg?.projectId && fbCfg?.firestoreDatabaseId) {
      const baseDocUrl = `https://firestore.googleapis.com/v1/projects/${fbCfg.projectId}/databases/${fbCfg.firestoreDatabaseId}/documents/devicePermitLetters/${unit}`;
      const docResp = await fetch(baseDocUrl);
      if (docResp.ok) {
        const docJson: any = await docResp.json();
        const fields = docJson?.fields || {};
        const sourceType = fields?.sourceType?.stringValue;
        const externalUrl = fields?.url?.stringValue;
        const fileName = fields?.fileName?.stringValue || `${unit}_Izin_Device_SOS.pdf`;

        if (sourceType === "url" && externalUrl && /^https?:\/\//i.test(externalUrl)) {
          return res.redirect(302, externalUrl);
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
                const pdfBuf = Buffer.from(combinedBase64, "base64");
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
                res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
                return res.status(200).send(pdfBuf);
              }
            }
          }
        }
      }
    }

    const defaultFile = unit === "SMP" ? "2627SMP_4cc5979e.pdf" : "2627SMA_97f45d75.pdf";
    return res.redirect(302, `/assets/aistudio/${defaultFile}`);
  } catch (err: any) {
    console.error("[Vercel Serve Permit PDF Error]:", err);
    return res.status(500).send("Gagal memuat dokumen PDF");
  }
}
