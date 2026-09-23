import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Competition, Registration, CurationColor } from '../../../types';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  subDays, 
  addWeeks, 
  subWeeks, 
  isSameDay, 
  isWithinInterval 
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { 
  MonitorPlay, 
  Calendar as CalendarIcon, 
  CalendarDays, 
  Clock, 
  Download, 
  Copy, 
  MessageCircle, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Maximize, 
  Minimize, 
  X, 
  Users, 
  MapPin, 
  Trophy, 
  Sparkles,
  Layers,
  Send,
  Printer
} from 'lucide-react';
import { getAllRegistrations } from '../../../services/competitionService';

interface Props {
  open: boolean;
  onClose: () => void;
  competitions: Competition[];
  initialRegistrations?: Registration[];
}

export interface AgendaItem {
  id: string;
  competition: Competition;
  roundName: string;
  date: number; // timestamp
  isDeadline?: boolean;
  delegates: string[];
}

export function AgendaPresentationModal({ 
  open, 
  onClose, 
  competitions, 
  initialRegistrations 
}: Props) {
  const [timeMode, setTimeMode] = useState<'daily' | 'weekly'>('weekly');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWeekRef, setSelectedWeekRef] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'slide' | 'whatsapp'>('slide');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>(initialRegistrations || []);
  const [customWaNotes, setCustomWaNotes] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  // Load registrations if not provided
  useEffect(() => {
    if (open && (!registrations || registrations.length === 0)) {
      getAllRegistrations()
        .then(regs => setRegistrations(regs))
        .catch(err => console.error("Error loading registrations for agenda:", err));
    }
  }, [open]);

  // Fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error('Error requesting fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error('Error exiting fullscreen:', err);
      });
    }
  };

  // Compute date range for weekly mode (Monday to Sunday)
  const weekRange = useMemo(() => {
    const start = startOfWeek(selectedWeekRef, { weekStartsOn: 1 });
    const end = endOfWeek(selectedWeekRef, { weekStartsOn: 1 });
    return { start, end };
  }, [selectedWeekRef]);

  // Map approved registrations by competition ID
  const delegatesByCompId = useMemo(() => {
    const map = new Map<string, string[]>();
    registrations
      .filter(r => r.status === 'APPROVED' || (r as any).status === 'approved')
      .forEach(r => {
        if (!map.has(r.competitionId)) {
          map.set(r.competitionId, []);
        }
        const name = r.studentName || 'Delegasi Siswa';
        const list = map.get(r.competitionId)!;
        if (!list.includes(name)) {
          list.push(name);
        }
      });
    return map;
  }, [registrations]);

  // Filter agenda items based on selected mode
  const agendaItems = useMemo<AgendaItem[]>(() => {
    const approvedComps = competitions.filter(c => c.isApproved !== false);
    const items: AgendaItem[] = [];

    approvedComps.forEach(comp => {
      const delegates = delegatesByCompId.get(comp.id) || [];

      // Check rounds (pelaksanaan kompetisi)
      if (comp.rounds && Array.isArray(comp.rounds)) {
        comp.rounds.forEach((round, rIdx) => {
          if (!round.date) return;
          const roundDate = new Date(round.date);

          let matches = false;
          if (timeMode === 'daily') {
            matches = isSameDay(roundDate, selectedDate);
          } else {
            matches = isWithinInterval(roundDate, {
              start: weekRange.start,
              end: weekRange.end,
            });
          }

          if (matches) {
            items.push({
              id: `${comp.id}-round-${rIdx}`,
              competition: comp,
              roundName: round.name || 'Babak Lomba',
              date: round.date,
              isDeadline: false,
              delegates,
            });
          }
        });
      }
    });

    // Sort chronologically by date
    items.sort((a, b) => a.date - b.date);
    return items;
  }, [competitions, timeMode, selectedDate, weekRange, delegatesByCompId]);

  // Group agenda items by date for weekly view
  const groupedWeeklyItems = useMemo(() => {
    const groups: { [key: string]: { date: Date; items: AgendaItem[] } } = {};
    agendaItems.forEach(item => {
      const dateKey = format(new Date(item.date), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: new Date(item.date),
          items: [],
        };
      }
      groups[dateKey].items.push(item);
    });
    return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [agendaItems]);

  // Date titles
  const formattedPeriodTitle = useMemo(() => {
    if (timeMode === 'daily') {
      const isToday = isSameDay(selectedDate, new Date());
      const isTomorrow = isSameDay(selectedDate, addDays(new Date(), 1));
      const prefix = isToday ? 'Hari Ini, ' : isTomorrow ? 'Besok, ' : '';
      return `${prefix}${format(selectedDate, 'EEEE, dd MMMM yyyy', { locale: localeId })}`;
    } else {
      const isThisWeek = isWithinInterval(new Date(), { start: weekRange.start, end: weekRange.end });
      const prefix = isThisWeek ? 'Pekan Ini: ' : 'Pekan: ';
      return `${prefix}${format(weekRange.start, 'dd MMM', { locale: localeId })} - ${format(weekRange.end, 'dd MMMM yyyy', { locale: localeId })}`;
    }
  }, [timeMode, selectedDate, weekRange]);

  // Generate WhatsApp broadcast text
  const whatsappBroadcastText = useMemo(() => {
    const headerTitle = timeMode === 'daily' 
      ? `📅 *AGENDA LOMBA HARI INI* (${format(selectedDate, 'EEEE, dd MMMM yyyy', { locale: localeId })})`
      : `📅 *AGENDA LOMBA PEKAN INI* (${format(weekRange.start, 'dd MMM', { locale: localeId })} - ${format(weekRange.end, 'dd MMM yyyy', { locale: localeId })})`;

    let text = `🏆 *SEMESTA OLYMPIAD SQUAD (SOS)*\n`;
    text += `${headerTitle}\n\n`;
    text += `Bismillah, berikut daftar kompetisi dan babak lomba yang berlangsung ${timeMode === 'daily' ? 'hari ini' : 'pekan ini'} (yang tercatat di sistem sos.olympiad.my.id):\n\n`;

    if (agendaItems.length === 0) {
      text += `_Tidak ada jadwal babak lomba yang berlangsung pada periode ini._\n\n`;
    } else {
      agendaItems.forEach((item, index) => {
        const itemDate = new Date(item.date);
        const dateStr = format(itemDate, 'EEEE, dd MMM yyyy', { locale: localeId });
        const fields = Array.isArray(item.competition.field) 
          ? item.competition.field.join(', ') 
          : item.competition.field;

        text += `*${index + 1}. ${item.competition.title.toUpperCase()}*\n`;
        text += `   📌 *Babak/Agenda:* ${item.roundName}\n`;
        text += `   🗓 *Waktu:* ${dateStr}\n`;
        if (fields) text += `   🔬 *Bidang:* ${fields}\n`;
        text += `   📍 *Tipe & Lokasi:* ${item.competition.type} - ${item.competition.location || 'Online'}\n`;
        
        if (item.delegates.length > 0) {
          text += `   👥 *Delegasi Peserta Semesta:*\n`;
          item.delegates.forEach(name => {
            text += `      • ${name}\n`;
          });
        }
        text += `\n`;
      });
    }

    if (customWaNotes.trim()) {
      text += `📢 *Catatan Tambahan:*\n${customWaNotes.trim()}\n\n`;
    }

    text += `Mohon doa dan dukungan dari segenap Bapak/Ibu serta rekan-rekan untuk kelancaran para peserta. Semoga meraih prestasi membanggakan! 🌟\n\n`;
    text += `*Semesta Olympiad Squad (SOS)*\n`;
    text += `Website: https://sos.olympiad.my.id\n\n`;
    text += `Contact Person\n`;
    text += `SMA Putra: Mr Ghozi (+6285729660235 - mghozianka@semesta.sch.id)\n`;
    text += `SMA Putri: Miss Frehni (+6281336869545 - riswi@semesta.sch.id)\n`;
    text += `SMP: Miss Fitroh (+6281391715837 - scfitroh@semesta.sch.id)`;

    return text;
  }, [agendaItems, timeMode, selectedDate, weekRange, customWaNotes]);

  // Handler: Copy text WA
  const handleCopyWaText = () => {
    navigator.clipboard.writeText(whatsappBroadcastText);
    toast.success('Pesan WhatsApp berhasil disalin ke clipboard!');
  };

  // Handler: Open in WA
  const handleOpenWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(whatsappBroadcastText)}`;
    window.open(url, '_blank');
  };

  // Handler: Download Image / Screenshot
  const handleDownloadImage = async () => {
    if (!captureRef.current) return;
    setIsCapturing(true);
    const toastId = toast.loading('Memproses gambar presentasi...');

    try {
      const dataUrl = await toPng(captureRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipFonts: false,
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      const fileNamePeriod = timeMode === 'daily' 
        ? format(selectedDate, 'yyyy-MM-dd') 
        : `${format(weekRange.start, 'yyyy-MM-dd')}_sd_${format(weekRange.end, 'yyyy-MM-dd')}`;
      link.download = `Agenda_Lomba_SOS_${timeMode}_${fileNamePeriod}.png`;
      link.click();

      toast.dismiss(toastId);
      toast.success('Gambar berhasil diunduh!');
    } catch (err: any) {
      console.error('Failed capturing image:', err);
      toast.dismiss(toastId);
      toast.error('Gagal membuat gambar: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCapturing(false);
    }
  };

  // Handler: Copy Image to Clipboard directly
  const handleCopyImageToClipboard = async () => {
    if (!captureRef.current) return;
    setIsCapturing(true);
    const toastId = toast.loading('Menyalin gambar ke clipboard...');

    try {
      const dataUrl = await toPng(captureRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipFonts: false,
        cacheBust: true,
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        toast.dismiss(toastId);
        toast.success('Gambar berhasil disalin! Silakan paste (Ctrl+V) langsung ke WhatsApp.');
      } else {
        // Fallback to download
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `Agenda_Lomba_SOS.png`;
        link.click();
        toast.dismiss(toastId);
        toast.info('Browser tidak mendukung salin langsung, gambar otomatis diunduh.');
      }
    } catch (err: any) {
      console.error('Failed copying image:', err);
      toast.dismiss(toastId);
      toast.error('Gagal menyalin gambar, silakan gunakan tombol Unduh Gambar.');
    } finally {
      setIsCapturing(false);
    }
  };

  if (!open) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col overflow-hidden text-slate-100 animate-in fade-in duration-200"
    >
      {/* Top Navbar & Controls */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 z-20">
        {/* Left: Branding & Mode Switcher */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white tracking-wide text-base">MODE PRESENTASI</span>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs py-0">
                Agenda Lomba SOS
              </Badge>
            </div>
            <p className="text-xs text-slate-400">Kompetisi yang Berlangsung Pekan / Hari Ini</p>
          </div>
        </div>

        {/* Center: Mode Selector (Tanggal Spesifik vs Pekan Spesifik) */}
        <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/60 shadow-inner">
          <button
            type="button"
            onClick={() => setTimeMode('daily')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
              timeMode === 'daily'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Tanggal Spesifik</span>
          </button>
          <button
            type="button"
            onClick={() => setTimeMode('weekly')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
              timeMode === 'weekly'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Pekan Spesifik</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Switch Tab between Slide and WhatsApp */}
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              onClick={() => setActiveTab('slide')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'slide' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Slide Presentasi
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'whatsapp' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pesan WhatsApp
            </button>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleFullscreen} 
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white hidden sm:flex"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>

          <Button 
            variant="destructive" 
            size="sm" 
            onClick={onClose}
            className="font-medium shadow-sm"
          >
            <X className="w-4 h-4 mr-1.5" /> Tutup
          </Button>
        </div>
      </header>

      {/* Date Navigation & Period Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {timeMode === 'daily' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                className="h-8 w-8 p-0 border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                title="Hari Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-1.5">
                <Button
                  variant={isSameDay(selectedDate, new Date()) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDate(new Date())}
                  className={`h-8 text-xs font-semibold ${
                    isSameDay(selectedDate, new Date()) 
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold' 
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                >
                  Hari Ini
                </Button>
                <Button
                  variant={isSameDay(selectedDate, addDays(new Date(), 1)) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDate(addDays(new Date(), 1))}
                  className={`h-8 text-xs font-semibold ${
                    isSameDay(selectedDate, addDays(new Date(), 1)) 
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                >
                  Besok
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="h-8 w-8 p-0 border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                title="Hari Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>

              {/* Native Datepicker input */}
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-xs text-slate-400 hidden md:inline">Pilih Tanggal:</span>
                <input
                  type="date"
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split('-').map(Number);
                      setSelectedDate(new Date(y, m - 1, d));
                    }
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedWeekRef(subWeeks(selectedWeekRef, 1))}
                className="h-8 w-8 p-0 border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                title="Pekan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-1.5">
                <Button
                  variant={isWithinInterval(new Date(), { start: weekRange.start, end: weekRange.end }) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedWeekRef(new Date())}
                  className={`h-8 text-xs font-semibold ${
                    isWithinInterval(new Date(), { start: weekRange.start, end: weekRange.end }) 
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold' 
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                >
                  Pekan Ini
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedWeekRef(addWeeks(new Date(), 1))}
                  className="h-8 text-xs font-semibold border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                >
                  Pekan Depan
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedWeekRef(addWeeks(selectedWeekRef, 1))}
                className="h-8 w-8 p-0 border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                title="Pekan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-xs text-slate-400 hidden md:inline">Pekan dari:</span>
                <input
                  type="date"
                  value={format(selectedWeekRef, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split('-').map(Number);
                      setSelectedWeekRef(new Date(y, m - 1, d));
                    }
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Current Period Badge & Count */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Periode Terpilih</span>
            <span className="text-xs md:text-sm font-bold text-amber-400">{formattedPeriodTitle}</span>
          </div>
          <Badge className="bg-indigo-600/30 text-indigo-300 border-indigo-500/40 text-xs px-2.5 py-1">
            {agendaItems.length} Agenda Lomba
          </Badge>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col items-center">
        {activeTab === 'slide' ? (
          <div className="w-full max-w-5xl space-y-6">
            {/* Action Bar for Presentation: Download & Copy Image */}
            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs md:text-sm font-medium text-slate-300">
                  Desain slide ini dioptimalkan untuk presentasi layar/proyektor atau di-screenshot untuk grup WA.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleCopyImageToClipboard}
                  disabled={isCapturing}
                  variant="outline"
                  className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white text-xs font-semibold"
                >
                  <Copy className="w-4 h-4 mr-1.5 text-indigo-400" /> Salin Gambar
                </Button>

                <Button
                  size="sm"
                  onClick={handleDownloadImage}
                  disabled={isCapturing}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md"
                >
                  <Download className="w-4 h-4 mr-1.5" /> Unduh Screenshot (PNG)
                </Button>

                <Button
                  size="sm"
                  onClick={() => setActiveTab('whatsapp')}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold shadow-md"
                >
                  <MessageCircle className="w-4 h-4 mr-1.5" /> Format Pesan WA
                </Button>
              </div>
            </div>

            {/* Visual Presentation Slide (Visible on Screen) */}
            <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
              {/* Slide Header */}
              <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-amber-600 p-6 md:p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-white text-xs font-bold uppercase tracking-wider mb-2">
                      <Trophy className="w-3.5 h-3.5 text-amber-300" /> Semesta Olympiad Squad
                    </div>
                    <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
                      {timeMode === 'daily' ? 'AGENDA LOMBA HARI INI' : 'AGENDA LOMBA PEKAN INI'}
                    </h2>
                    <p className="text-indigo-100 text-sm md:text-base font-medium mt-1">
                      {formattedPeriodTitle}
                    </p>
                  </div>

                  <div className="bg-white/15 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-center md:text-right shrink-0">
                    <span className="text-2xl md:text-3xl font-black text-amber-300 block">{agendaItems.length}</span>
                    <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">Babak / Agenda Berlangsung</span>
                  </div>
                </div>
              </div>

              {/* Slide Content */}
              <div className="p-6 md:p-8 bg-slate-900/90 min-h-[350px]">
                {agendaItems.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                      <CalendarIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-300">Tidak Ada Agenda Lomba yang Berlangsung</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                      Tidak ditemukan jadwal babak kompetisi pada {formattedPeriodTitle.toLowerCase()}.
                      Silakan pilih tanggal atau pekan lain melalui tombol kontrol di atas.
                    </p>
                    <div className="pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          if (timeMode === 'daily') setSelectedDate(addDays(selectedDate, 1));
                          else setSelectedWeekRef(addWeeks(selectedWeekRef, 1));
                        }}
                        className="border-slate-700 text-slate-300 hover:text-white"
                      >
                        Lihat {timeMode === 'daily' ? 'Hari Berikutnya' : 'Pekan Depan'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {agendaItems.map((item, idx) => {
                      const itemDate = new Date(item.date);
                      const fields = Array.isArray(item.competition.field) 
                        ? item.competition.field 
                        : [item.competition.field];

                      return (
                        <div 
                          key={item.id}
                          className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl p-5 transition-all shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                        >
                          <div className="flex items-start gap-4 flex-1">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-bold text-lg flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </div>

                            <div className="space-y-1.5 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-amber-500 text-slate-950 font-bold text-xs">
                                  {item.roundName}
                                </Badge>
                                <span className="text-xs font-semibold text-slate-400 flex items-center">
                                  <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                  {format(itemDate, 'EEEE, dd MMM yyyy', { locale: localeId })}
                                </span>
                                <Badge variant="outline" className="text-slate-300 border-slate-600 text-xs">
                                  {item.competition.type}
                                </Badge>
                              </div>

                              <h4 className="text-lg md:text-xl font-bold text-white leading-snug">
                                {item.competition.title}
                              </h4>

                              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-300">
                                {fields.length > 0 && (
                                  <span className="font-medium text-indigo-300">
                                    🔬 Bidang: {fields.join(', ')}
                                  </span>
                                )}
                                {item.competition.location && (
                                  <span className="flex items-center text-slate-400">
                                    <MapPin className="w-3.5 h-3.5 mr-1" />
                                    {item.competition.location}
                                  </span>
                                )}
                              </div>

                              {/* Registered Delegates */}
                              {item.delegates.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-start gap-2">
                                  <Users className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                  <div className="text-xs text-slate-300">
                                    <span className="font-semibold text-amber-400 mr-1.5">Delegasi Semesta:</span>
                                    <span>{item.delegates.join(', ')}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Slide Footer */}
              <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Semesta Olympiad Squad (SOS) • Menuju Prestasi Juara</span>
                <span>Portal Resmi: sos.olympiad.my.id</span>
              </div>
            </div>
          </div>
        ) : (
          /* WhatsApp Message Preview Tab */
          <div className="w-full max-w-4xl space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-green-500" />
                    Generator Pesan Broadcast WhatsApp
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pesan otomatis tersusun dengan rapi berdasarkan agenda lomba {formattedPeriodTitle.toLowerCase()}.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleCopyWaText}
                    variant="outline"
                    className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold"
                  >
                    <Copy className="w-4 h-4 mr-1.5" /> Salin Pesan WA
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleOpenWhatsApp}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold shadow-md"
                  >
                    <Send className="w-4 h-4 mr-1.5" /> Kirim ke WhatsApp
                  </Button>
                </div>
              </div>

              {/* Optional Custom Notes Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span>Catatan Tambahan (Opsional):</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Seluruh peserta kumpul di Lab Komputer pukul 07.30 WIB..."
                  value={customWaNotes}
                  onChange={(e) => setCustomWaNotes(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* Message Preview Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Preview Teks WhatsApp:</span>
                  <span>{whatsappBroadcastText.length} karakter</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 whitespace-pre-wrap max-h-[420px] overflow-y-auto leading-relaxed select-all">
                  {whatsappBroadcastText}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 
        OFFSCREEN CAPTURE CONTAINER
        Rendered offscreen with fixed 1080px width to guarantee pristine 2x DPI screenshot
        regardless of screen resolution or modal scroll state!
      */}
      <div className="fixed top-[-9999px] left-[-9999px] pointer-events-none opacity-0">
        <div 
          ref={captureRef}
          className="w-[1080px] bg-slate-900 text-slate-100 p-8 font-sans"
        >
          <div className="rounded-3xl border border-slate-700 overflow-hidden shadow-2xl bg-slate-900">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-amber-600 p-8 text-white relative">
              <div className="flex items-center justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-white text-xs font-bold uppercase tracking-wider mb-2">
                    <Trophy className="w-4 h-4 text-amber-300" /> Semesta Olympiad Squad
                  </div>
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    {timeMode === 'daily' ? 'AGENDA LOMBA HARI INI' : 'AGENDA LOMBA PEKAN INI'}
                  </h1>
                  <p className="text-indigo-100 text-base font-medium mt-1">
                    {formattedPeriodTitle}
                  </p>
                </div>

                <div className="bg-white/20 backdrop-blur px-6 py-4 rounded-2xl border border-white/30 text-right">
                  <span className="text-4xl font-black text-amber-300 block">{agendaItems.length}</span>
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Babak Lomba</span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 bg-slate-900 space-y-4">
              {agendaItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-lg font-medium">Tidak ada agenda kompetisi pada periode ini.</p>
                </div>
              ) : (
                agendaItems.map((item, idx) => {
                  const itemDate = new Date(item.date);
                  const fields = Array.isArray(item.competition.field) 
                    ? item.competition.field.join(', ') 
                    : item.competition.field;

                  return (
                    <div 
                      key={item.id}
                      className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-start gap-4 shadow-sm"
                    >
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-xl flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-400 text-slate-950 font-bold text-xs px-2.5 py-0.5 rounded-md">
                            {item.roundName}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">
                            {format(itemDate, 'EEEE, dd MMM yyyy', { locale: localeId })}
                          </span>
                          <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-md font-medium">
                            {item.competition.type}
                          </span>
                        </div>

                        <h3 className="text-xl font-bold text-white leading-tight">
                          {item.competition.title}
                        </h3>

                        <div className="flex items-center gap-4 text-xs text-slate-300">
                          {fields && <span>🔬 Bidang: <strong className="text-indigo-300">{fields}</strong></span>}
                          {item.competition.location && <span>📍 Lokasi: <strong>{item.competition.location}</strong></span>}
                        </div>

                        {item.delegates.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-700/80 text-xs text-slate-300">
                            <span className="font-bold text-amber-400">Delegasi Semesta: </span>
                            <span>{item.delegates.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-950 px-8 py-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-200">Semesta Olympiad Squad (SOS) • Pembinaan Prestasi Sains</span>
              <span>Website: https://sos.olympiad.my.id</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
