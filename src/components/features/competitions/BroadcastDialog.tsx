import React, { useRef, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Competition } from '../../../types';
import { Download, Copy, MessageCircle, Image as ImageIcon } from 'lucide-react';
import { toPng } from 'html-to-image';
import { format, differenceInDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { emptyImagePlaceholder } from '../../../lib/assets';

interface BroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitions: Competition[];
}

export function BroadcastDialog({ open, onOpenChange, competitions }: BroadcastDialogProps) {
  const downloadRef = useRef<HTMLDivElement>(null);
  const [failedPosterIds, setFailedPosterIds] = useState<Record<string, boolean>>({});

  const activeCompetitions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return competitions
      .filter(c => {
        const deadline = new Date(c.registrationDeadline);
        deadline.setHours(0, 0, 0, 0);
        return c.isApproved !== false && c.status === 'OPEN' && deadline.getTime() >= today.getTime();
      })
      .sort((a, b) => new Date(a.registrationDeadline).getTime() - new Date(b.registrationDeadline).getTime());
  }, [competitions]);

  const broadcastText = useMemo(() => {
    let text = 'Semesta Olympiad Squad Information\n*📢 INFO LOMBA TERKINI YANG MASIH DIBUKA*\n\n';

    if (activeCompetitions.length === 0) {
      return text + 'Belum ada lomba yang tersedia saat ini.';
    }

    activeCompetitions.forEach((comp) => {
      const deadline = new Date(comp.registrationDeadline);
      deadline.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysLeft = differenceInDays(deadline, today);

      const formattedDate = format(deadline, 'dd MMMM yyyy', { locale: localeId });
      const locationInfo = comp.location ? ` oleh ${comp.location}` : '';

      let daysText = '';
      if (daysLeft === 0) {
        daysText = '*Hari ini terakhir!*';
      } else {
        daysText = `*${daysLeft} Hari lagi*`;
      }

      text += `- ${comp.title}${locationInfo} (Deadline: ${formattedDate}) ${daysText}\n`;
    });

    text += '\nSegera ajukan perizinan melalui Portal SOS Semesta!\n\n';
    text += 'Website: https://sos.olympiad.my.id\n';
    text += 'Contact Person\n';
    text += 'SMA Putra: Mr Ghozi (+6285729660235 - mghozianka@semesta.sch.id)\n';
    text += 'SMA Putri: Miss Frehni (+6281336869545 - riswi@semesta.sch.id)\n';
    text += 'SMP: Miss Fitroh (+6281391715837 - scfitroh@semesta.sch.id)';
    return text;
  }, [activeCompetitions]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(broadcastText);
    toast.success('Teks broadcast disalin ke clipboard');
  };

  const handleShareWA = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(broadcastText)}`;
    window.open(url, '_blank');
  };

  const handleDownloadImage = async () => {
    if (!downloadRef.current) return;

    const toastId = toast.loading('Memproses gambar...');
    try {
      const dataUrl = await toPng(downloadRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipFonts: false,
        imagePlaceholder: emptyImagePlaceholder,
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `info-lomba-${format(new Date(), 'dd-MM-yyyy')}.png`;
      link.click();

      toast.dismiss(toastId);
      toast.success('Gambar berhasil diunduh');
    } catch (error) {
      console.error('Failed to generate image', error);
      toast.dismiss(toastId);
      toast.error('Gagal membuat gambar');
    }
  };

  const markPosterFailed = (id: string) => {
    setFailedPosterIds(prev => (prev[id] ? prev : { ...prev, [id]: true }));
  };

  const renderPosterGraphic = (isExport: boolean) => {
    const todayFormatted = format(new Date(), 'dd MMMM yyyy', { locale: localeId });

    return (
      <div
        className={
          isExport
            ? 'bg-gradient-to-br from-indigo-50 to-blue-50 w-[840px] p-8 shrink-0'
            : 'bg-gradient-to-br from-indigo-50 to-blue-50 w-full min-h-full p-4 md:p-6 shrink-0'
        }
      >
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200/80">
          <div className={isExport ? 'bg-indigo-600 px-8 py-6 text-center' : 'bg-indigo-600 p-5 text-center'}>
            <h2 className={isExport ? 'text-3xl font-bold text-white tracking-tight mb-1' : 'text-xl md:text-2xl font-bold text-white tracking-tight mb-1'}>
              INFO LOMBA TERKINI
            </h2>
            <p className={isExport ? 'text-indigo-100 font-medium text-base' : 'text-indigo-100 font-medium text-xs md:text-sm'}>
              Olimpiade Sains Semesta (SOS) · {todayFormatted}
            </p>
          </div>

          <div className={isExport ? 'p-6 space-y-4' : 'p-3.5 md:p-5 space-y-3.5'}>
            {activeCompetitions.length > 0 ? (
              activeCompetitions.map((comp, idx) => {
                const deadline = new Date(comp.registrationDeadline);
                deadline.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysLeft = differenceInDays(deadline, today);
                const formattedDate = format(deadline, 'dd MMM yyyy', { locale: localeId });

                const availableFields = Array.isArray(comp.field)
                  ? comp.field.filter(Boolean)
                  : comp.field
                    ? [String(comp.field)]
                    : [];

                const posterSrc = comp.posterUrl?.trim();
                const showPosterImg = Boolean(posterSrc && !failedPosterIds[comp.id]);

                return (
                  <div
                    key={comp.id}
                    className={
                      isExport
                        ? 'flex gap-5 items-stretch p-5 bg-slate-50/90 rounded-xl border border-slate-200/90'
                        : 'flex gap-3.5 items-stretch p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/90'
                    }
                  >
                    {/* Poster Lomba Thumbnail */}
                    <div
                      className={
                        isExport
                          ? 'relative w-28 h-[150px] shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-white flex items-center justify-center'
                          : 'relative w-20 sm:w-24 h-28 sm:h-32 shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-white flex items-center justify-center'
                      }
                    >
                      {/* Styled fallback layer (also sits behind image if external fetch falls back) */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 px-2 text-center">
                        <ImageIcon className={isExport ? 'w-6 h-6 mb-1 opacity-60' : 'w-5 h-5 mb-1 opacity-60'} />
                        <span className={isExport ? 'text-[11px] font-medium leading-tight' : 'text-[10px] font-medium leading-tight'}>
                          Tanpa Poster
                        </span>
                      </div>

                      {showPosterImg && (
                        <img
                          src={posterSrc}
                          alt={`Poster ${comp.title}`}
                          referrerPolicy="no-referrer"
                          onError={() => markPosterFailed(comp.id)}
                          className="relative z-10 w-full h-full object-contain bg-white"
                        />
                      )}
                    </div>

                    {/* Detail Lomba */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-start gap-2.5 mb-1">
                        <span
                          className={
                            isExport
                              ? 'shrink-0 w-7 h-7 rounded-md bg-indigo-600 text-white font-bold text-sm tabular-nums flex items-center justify-center mt-0.5'
                              : 'shrink-0 w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs tabular-nums flex items-center justify-center mt-0.5'
                          }
                        >
                          {idx + 1}
                        </span>
                        <h3
                          className={
                            isExport
                              ? 'font-bold text-slate-900 text-lg leading-snug'
                              : 'font-bold text-slate-900 text-sm md:text-base leading-snug'
                          }
                        >
                          {comp.title}
                        </h3>
                      </div>

                      {comp.location && (
                        <p
                          className={
                            isExport
                              ? 'text-slate-600 text-sm mb-2 font-medium'
                              : 'text-slate-600 text-xs mb-1.5 font-medium'
                          }
                        >
                          Penyelenggara: {comp.location}
                        </p>
                      )}

                      {/* Daftar Bidang Available */}
                      <div className={isExport ? 'text-sm text-slate-700 leading-relaxed mb-3' : 'text-xs text-slate-700 leading-relaxed mb-2.5'}>
                        <span className="font-semibold text-slate-900">Bidang Tersedia: </span>
                        <span className="font-medium text-indigo-700">
                          {availableFields.length > 0 ? availableFields.join(' · ') : 'Semua Bidang'}
                        </span>
                      </div>

                      {/* Batas Pendaftaran & Countdown */}
                      <div
                        className={
                          isExport
                            ? 'mt-auto pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm tabular-nums'
                            : 'mt-auto pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] md:text-xs tabular-nums'
                        }
                      >
                        <span className="font-semibold text-slate-700">
                          Batas Pendaftaran: {formattedDate}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className={`font-bold ${daysLeft <= 3 ? 'text-red-600' : 'text-amber-700'}`}>
                          {daysLeft === 0 ? 'Hari ini terakhir!' : `${daysLeft} Hari lagi`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-500 font-medium">
                Belum ada lomba yang tersedia saat ini
              </div>
            )}
          </div>

          <div
            className={
              isExport
                ? 'bg-slate-50 px-6 py-4 text-center text-sm font-semibold text-slate-600 border-t border-slate-200'
                : 'bg-slate-50 p-3.5 text-center text-xs font-semibold text-slate-600 border-t border-slate-200'
            }
          >
            Segera ajukan perizinan melalui Portal SOS Semesta (sos.olympiad.my.id)
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl w-[95vw] max-w-[95vw] max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>Broadcast Info Lomba</DialogTitle>
          <DialogDescription>
            Bagikan daftar lomba yang masih buka ke WhatsApp. Anda bisa menyalin teks atau mengunduh gambarnya.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Teks Preview */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">Preview Pesan Teks</h3>
            <div className="border rounded-lg p-4 bg-slate-50 text-sm whitespace-pre-wrap font-mono h-[420px] overflow-y-auto">
              {broadcastText}
            </div>
          </div>

          {/* Image Container */}
          <div className="space-y-2 relative flex flex-col">
            <h3 className="text-sm font-semibold text-slate-800">Preview Gambar</h3>
            <div className="border rounded-lg overflow-hidden flex-1 h-[420px] bg-slate-100 flex items-start justify-center overflow-y-auto">
              {renderPosterGraphic(false)}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2 shrink-0">
          <Button variant="outline" onClick={handleDownloadImage} className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" /> Unduh Gambar
          </Button>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:ml-auto">
            <Button variant="secondary" onClick={handleCopyText} className="w-full sm:w-auto">
              <Copy className="w-4 h-4 mr-2" /> Salin Teks
            </Button>
            <Button onClick={handleShareWA} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
              <MessageCircle className="w-4 h-4 mr-2" /> Share ke WhatsApp
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Hidden Render Node for html-to-image to ensure full uncropped capture */}
      <div className="fixed top-[-9999px] left-[-9999px] pointer-events-none opacity-0" aria-hidden="true">
        <div ref={downloadRef}>{renderPosterGraphic(true)}</div>
      </div>
    </Dialog>
  );
}

