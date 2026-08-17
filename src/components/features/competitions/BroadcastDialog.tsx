import React, { useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Competition } from '../../../types';
import { Download, Copy, MessageCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { format, differenceInDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';

interface BroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitions: Competition[];
}

export function BroadcastDialog({ open, onOpenChange, competitions }: BroadcastDialogProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const activeCompetitions = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    return competitions
      .filter(c => {
        const deadline = new Date(c.registrationDeadline);
        deadline.setHours(0,0,0,0);
        return c.isApproved !== false && c.status === 'OPEN' && deadline.getTime() >= today.getTime();
      })
      .sort((a, b) => new Date(a.registrationDeadline).getTime() - new Date(b.registrationDeadline).getTime());
  }, [competitions]);

  const broadcastText = useMemo(() => {
    let text = '*📢 INFO LOMBA TERKINI YANG MASIH DIBUKA*\n\n';
    
    if (activeCompetitions.length === 0) {
      return text + 'Belum ada lomba yang tersedia saat ini.';
    }

    activeCompetitions.forEach((comp, index) => {
      const deadline = new Date(comp.registrationDeadline);
      deadline.setHours(0,0,0,0);
      const today = new Date();
      today.setHours(0,0,0,0);
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
    
    text += '\nSegera daftarkan dirimu melalui Portal Lomba SOS Semesta!';
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

  const downloadRef = useRef<HTMLDivElement>(null);

  const handleDownloadImage = async () => {
    if (!downloadRef.current) return;
    
    try {
      const toastId = toast.loading('Memproses gambar...');
      // Ensure element is visible temporarily if needed, but absolute positioning usually works
      const canvas = await html2canvas(downloadRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `info-lomba-${format(new Date(), 'dd-MM-yyyy')}.png`;
      link.click();
      
      toast.dismiss(toastId);
      toast.success('Gambar berhasil diunduh');
    } catch (error) {
      console.error('Failed to generate image', error);
      toast.error('Gagal membuat gambar');
    }
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
             <div className="border rounded-lg p-4 bg-slate-50 text-sm whitespace-pre-wrap font-mono h-[400px] overflow-y-auto">
               {broadcastText}
             </div>
          </div>

          {/* Image Container */}
          <div className="space-y-2 relative flex flex-col">
             <h3 className="text-sm font-semibold text-slate-800">Preview Gambar</h3>
             <div className="border rounded-lg overflow-hidden flex-1 h-[400px] bg-slate-100 flex items-start justify-center overflow-y-auto">
               <div 
                 className="bg-gradient-to-br from-indigo-50 to-blue-50 w-full min-h-full p-4 md:p-8 shrink-0"
               >
                 <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                   <div className="bg-indigo-600 p-6 text-center">
                     <h2 className="text-2xl font-bold text-white mb-1">INFO LOMBA TERKINI</h2>
                     <p className="text-indigo-100 font-medium">Olimpiade Sains Semesta (SOS)</p>
                   </div>
                   <div className="p-4 md:p-6 space-y-4">
                     {activeCompetitions.length > 0 ? (
                       activeCompetitions.map((comp, idx) => {
                         const deadline = new Date(comp.registrationDeadline);
                         deadline.setHours(0,0,0,0);
                         const today = new Date();
                         today.setHours(0,0,0,0);
                         const daysLeft = differenceInDays(deadline, today);
                         const formattedDate = format(deadline, 'dd MMM yyyy', { locale: localeId });
                         
                         return (
                           <div key={comp.id} className="flex gap-4 items-start p-4 bg-slate-50 rounded-xl border border-slate-100">
                             <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-indigo-100 text-indigo-700 font-bold text-lg md:text-xl rounded-full flex items-center justify-center mt-1">
                               {idx + 1}
                             </div>
                             <div className="flex-1">
                               <h3 className="font-bold text-slate-800 text-base md:text-lg mb-1 leading-snug">{comp.title}</h3>
                               {comp.location && <p className="text-slate-600 text-xs md:text-sm mb-2 font-medium">Penyelenggara: {comp.location}</p>}
                               <div className="flex flex-wrap items-center gap-2">
                                 <span className="bg-slate-200 text-slate-700 text-[10px] md:text-xs px-2.5 py-1 rounded-md font-semibold whitespace-nowrap">
                                   Batas: {formattedDate}
                                 </span>
                                 <span className={`text-[10px] md:text-xs px-2.5 py-1 rounded-md font-bold whitespace-nowrap ${daysLeft <= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                   {daysLeft === 0 ? 'Hari ini terakhir!' : `${daysLeft} Hari lagi`}
                                 </span>
                               </div>
                             </div>
                           </div>
                         );
                       })
                     ) : (
                       <div className="text-center py-8 text-slate-500 font-medium">Belum ada lomba yang tersedia saat ini</div>
                     )}
                   </div>
                   <div className="bg-slate-50 p-4 text-center text-xs md:text-sm font-semibold text-slate-500 border-t">
                     Segera daftarkan dirimu melalui Portal Lomba SOS Semesta
                   </div>
                 </div>
               </div>
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

      {/* Hidden Render Node for html2canvas to ensure full uncropped capture */}
      <div className="fixed top-[-9999px] left-[-9999px] pointer-events-none opacity-0">
        <div 
          ref={downloadRef} 
          className="bg-gradient-to-br from-indigo-50 to-blue-50 w-[800px] p-8 shrink-0"
        >
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
            <div className="bg-indigo-600 p-6 text-center">
              <h2 className="text-3xl font-bold text-white mb-1">INFO LOMBA TERKINI</h2>
              <p className="text-indigo-100 font-medium text-lg">Olimpiade Sains Semesta (SOS)</p>
            </div>
            <div className="p-6 space-y-4">
              {activeCompetitions.length > 0 ? (
                activeCompetitions.map((comp, idx) => {
                  const deadline = new Date(comp.registrationDeadline);
                  deadline.setHours(0,0,0,0);
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  const daysLeft = differenceInDays(deadline, today);
                  const formattedDate = format(deadline, 'dd MMM yyyy', { locale: localeId });
                  
                  return (
                    <div key={comp.id} className="flex gap-5 items-start p-5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 text-indigo-700 font-bold text-xl rounded-full flex items-center justify-center mt-1">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-800 text-xl mb-1 leading-snug">{comp.title}</h3>
                        {comp.location && <p className="text-slate-600 text-sm mb-3 font-medium">Penyelenggara: {comp.location}</p>}
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-md font-semibold whitespace-nowrap">
                            Batas: {formattedDate}
                          </span>
                          <span className={`text-xs px-3 py-1.5 rounded-md font-bold whitespace-nowrap ${daysLeft <= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {daysLeft === 0 ? 'Hari ini terakhir!' : `${daysLeft} Hari lagi`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-500 font-medium">Belum ada lomba yang tersedia saat ini</div>
              )}
            </div>
            <div className="bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500 border-t">
              Segera daftarkan dirimu melalui Portal Lomba SOS Semesta
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
