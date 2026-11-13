import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { PDF_FILES, SchoolUnit } from '../../services/devicePermitService';
import { Button } from '../../components/ui/button';
import { Download, ExternalLink, FileText, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';

function base64ToPdfBlob(base64: string): Blob {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(clean.trim());
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'application/pdf' });
}

export function PublicPermitPdfViewer() {
  const { unit: rawUnit } = useParams<{ unit: string }>();
  const normalizedUnit: SchoolUnit = String(rawUnit || '').toUpperCase() === 'SMA' ? 'SMA' : 'SMP';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>(PDF_FILES[normalizedUnit].fileName);
  const [title, setTitle] = useState<string>(PDF_FILES[normalizedUnit].title);
  const [isExternalUrl, setIsExternalUrl] = useState(false);

  useEffect(() => {
    let active = true;
    let createdBlobUrl: string | null = null;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      setIsExternalUrl(false);

      const defaultInfo = PDF_FILES[normalizedUnit];
      try {
        const letterRef = doc(db, 'devicePermitLetters', normalizedUnit);
        const letterSnap = await getDoc(letterRef);

        if (!active) return;

        if (letterSnap.exists()) {
          const data = letterSnap.data() as any;
          if (data?.fileName) setFileName(data.fileName);
          if (data?.title) setTitle(data.title);

          if (data?.sourceType === 'url' && data?.url && /^https?:\/\//i.test(data.url)) {
            setIsExternalUrl(true);
            setPdfUrl(data.url);
            setLoading(false);
            return;
          }

          if (data?.hasChunks) {
            const chunksSnap = await getDocs(collection(db, 'devicePermitLetters', normalizedUnit, 'chunks'));
            if (!active) return;

            if (!chunksSnap.empty) {
              const sortedDocs = chunksSnap.docs
                .map(d => ({
                  index: Number(d.data()?.index ?? 0),
                  data: String(d.data()?.data || ''),
                }))
                .sort((a, b) => a.index - b.index);

              const combinedBase64 = sortedDocs.map(item => item.data).join('');
              if (combinedBase64) {
                const blob = base64ToPdfBlob(combinedBase64);
                createdBlobUrl = URL.createObjectURL(blob);
                setPdfUrl(createdBlobUrl);
                setLoading(false);
                return;
              }
            }
          }
        }

        // Default bundled static PDF fallback
        setFileName(defaultInfo.fileName);
        setTitle(defaultInfo.title);
        setPdfUrl(defaultInfo.url);
        setLoading(false);
      } catch (err: any) {
        if (!active) return;
        console.error('Error loading permit PDF in viewer:', err);
        // Always fallback to bundled default PDF on read failure
        setFileName(defaultInfo.fileName);
        setTitle(defaultInfo.title);
        setPdfUrl(defaultInfo.url);
        setError('Dokumen kustom gagal dimuat, menampilkan surat bawaan sistem.');
        setLoading(false);
      }
    }

    loadPdf();

    return () => {
      active = false;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [normalizedUnit]);

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-900 text-white">
      <header className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/permit">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Kembali
            </Button>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold truncate">{title}</h1>
              <p className="text-[11px] text-slate-400 truncate font-mono">{fileName}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pdfUrl && (
            <>
              <a href={pdfUrl} download={fileName}>
                <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download PDF
                </Button>
              </a>
              {isExternalUrl && (
                <a href={pdfUrl} target="_blank" rel="noreferrer">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Buka Link
                  </Button>
                </a>
              )}
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="px-4 py-2 bg-amber-500/20 border-b border-amber-500/30 text-amber-200 text-xs flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden bg-slate-800">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-300">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
            <p className="text-xs font-medium">Memuat Surat Izin Resmi {normalizedUnit}...</p>
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            title={title}
            className="w-full h-full flex-1 border-0 bg-white"
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-300 p-6 text-center">
            <FileText className="w-10 h-10 text-slate-500" />
            <p className="text-sm font-semibold">Dokumen PDF tidak tersedia</p>
          </div>
        )}
      </main>
    </div>
  );
}
