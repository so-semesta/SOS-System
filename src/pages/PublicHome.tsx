import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { getAllCompetitions, getRegistrationsByCompetition } from '../services/competitionService';
import { Competition, Registration } from '../types';
import { GraduationCap, LogIn, MapPin, Calendar as CalendarIcon, Users, ExternalLink, Trophy } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'id': localeId,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export function PublicHome() {
  const navigate = useNavigate();
  const { currentUser, loginWithGoogle } = useAuth();
  
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [registrationsMap, setRegistrationsMap] = useState<Record<string, Registration[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<any>('month');

  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const comps = await getAllCompetitions();
        const approvedComps = comps.filter(c => c.isApproved !== false);
        setCompetitions(approvedComps);
        
        const regsMap: Record<string, Registration[]> = {};
        for (const comp of approvedComps) {
          const regs = await getRegistrationsByCompetition(comp.id);
          regsMap[comp.id] = regs;
        }
        setRegistrationsMap(regsMap);
      } catch (error) {
        console.error("Failed to fetch public competitions", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const events: any[] = [];
  competitions.forEach(c => {
    events.push({
      id: `${c.id}-deadline`,
      title: `${c.title} (Batas Daftar)`,
      start: new Date(c.registrationDeadline),
      end: new Date(c.registrationDeadline),
      allDay: true,
      type: 'Deadline',
      comp: c
    });
    c.rounds.forEach(r => {
      events.push({
        id: `${c.id}-round-${r.name}`,
        title: `${c.title} - ${r.name}`,
        start: new Date(r.date),
        end: new Date(r.date),
        allDay: true,
        type: 'Babak',
        comp: c
      });
    });
  });

  const eventStyleGetter = (event: any) => {
    const isDeadline = event.type === 'Deadline';
    const style = {
      backgroundColor: isDeadline ? '#ef4444' : '#3b82f6',
      borderRadius: '4px',
      opacity: 0.9,
      color: 'white',
      border: '0px',
      display: 'block',
      padding: '2px 5px'
    };
    return { style };
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <div className="bg-primary/10 p-2 rounded-full">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SOS System</h1>
        </div>
        <Button onClick={() => loginWithGoogle()} variant="default">
          <LogIn className="h-4 w-4 mr-2" />
          Login
        </Button>
      </header>
      
      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full space-y-12">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Portal Lomba Sains</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Temukan dan ikuti berbagai perlombaan sains terkini. Persiapkan dirimu untuk menjadi juara!
          </p>
        </div>

        <Card className="h-[600px] flex flex-col overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <CalendarIcon className="mr-2 h-5 w-5 text-primary" />
              Kalender Lomba Terkini
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-6 pt-0">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                eventPropGetter={eventStyleGetter}
                date={currentDate}
                onNavigate={(newDate) => setCurrentDate(newDate)}
                view={currentView}
                onView={(newView) => setCurrentView(newView)}
                views={['month', 'week', 'day', 'agenda']}
                messages={{
                  next: "Selanjutnya",
                  previous: "Sebelumnya",
                  today: "Hari Ini",
                  month: "Bulan",
                  week: "Minggu",
                  day: "Hari",
                  agenda: "Agenda",
                  date: "Tanggal",
                  time: "Waktu",
                  event: "Acara",
                  noEventsInRange: "Tidak ada acara pada rentang ini.",
                }}
                culture="id"
              />
            )}
          </CardContent>
        </Card>
        
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : competitions.length === 0 ? (
          <div className="text-center py-20 text-slate-500 bg-white rounded-xl border">
            Belum ada data lomba yang tersedia saat ini.
          </div>
        ) : (
          <div>
            <h3 className="text-2xl font-bold mb-6 flex items-center">
              <Trophy className="h-6 w-6 mr-2 text-yellow-500" /> Katalog Kompetisi
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {competitions.map((comp) => {
                const regs = registrationsMap[comp.id] || [];
                const regCount = regs.length;
                
                return (
                  <Card key={comp.id} className="flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedComp(comp)}>
                    {comp.posterUrl && (
                      <div className="h-48 w-full overflow-hidden bg-muted">
                        <img src={comp.posterUrl} alt={comp.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardHeader className={comp.posterUrl ? "pt-4" : ""}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(comp.field) ? comp.field.map((f, i) => (
                            <Badge key={i} variant="outline" className="bg-primary/5 text-primary border-primary/20">
                              {f}
                            </Badge>
                          )) : (
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                              {comp.field}
                            </Badge>
                          )}
                        </div>
                        <Badge variant="secondary">{comp.type}</Badge>
                      </div>
                      <CardTitle className="line-clamp-2">{comp.title}</CardTitle>
                      <CardDescription className="flex items-center mt-2">
                        <MapPin className="h-3 w-3 mr-1" />
                        {comp.location || 'Tidak disebutkan'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-2 text-slate-400" />
                          <span>Deadline: {format(new Date(comp.registrationDeadline), 'dd MMM yyyy', { locale: localeId })}</span>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center text-sm font-medium text-slate-900 mb-2">
                            <Users className="h-4 w-4 mr-2 text-primary" />
                            Pendaftar ({regCount})
                          </div>
                          {regCount > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {regs.slice(0, 5).map(r => (
                                <Badge key={r.id} variant="secondary" className="text-xs font-normal">
                                  {r.studentName || 'Anonim'}
                                </Badge>
                              ))}
                              {regCount > 5 && (
                                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                  +{regCount - 5} lainnya
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Belum ada pendaftar</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-4 border-t">
                      <Button className="w-full" onClick={(e) => { e.stopPropagation(); loginWithGoogle(); }}>
                        Daftar Lomba
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!selectedComp} onOpenChange={(open) => !open && setSelectedComp(null)}>
        {selectedComp && (
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{selectedComp.title}</DialogTitle>
              <DialogDescription>
                Informasi detail mengenai kompetisi ini.
              </DialogDescription>
              <div className="flex gap-2 mt-2 flex-wrap">
                 {Array.isArray(selectedComp.field) ? selectedComp.field.map((f, i) => <Badge key={i} variant="secondary">{f}</Badge>) : <Badge variant="secondary">{selectedComp.field}</Badge>}
                 <Badge variant="outline">{selectedComp.type}</Badge>
              </div>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {selectedComp.posterUrl && (
                <img src={selectedComp.posterUrl} alt="Poster" className="w-full rounded-md border" />
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-muted-foreground">Penyelenggara / Lokasi</p>
                  <p>{selectedComp.location || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Batas Pendaftaran</p>
                  <p>{format(new Date(selectedComp.registrationDeadline), 'dd MMM yyyy', { locale: localeId })}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Biaya Pendaftaran</p>
                  <p>{selectedComp.fee > 0 ? `Rp ${selectedComp.fee.toLocaleString()}` : 'Gratis'}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Guidebook</p>
                   {selectedComp.guidebookUrl ? (
                    <a href={selectedComp.guidebookUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                      Buka Dokumen <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  ) : '-'}
                </div>
              </div>

              <div>
                <p className="font-semibold text-muted-foreground text-sm mb-1">Rangkaian / Jadwal Lomba</p>
                <div className="rounded-md border p-3 bg-muted/20 text-sm space-y-2">
                  {selectedComp.rounds.length > 0 ? selectedComp.rounds.map((r, i) => (
                    <div key={i} className="flex justify-between border-b last:border-0 pb-1 last:pb-0">
                      <span>{r.name}</span>
                      <span className="font-medium">{format(new Date(r.date), 'dd MMM yyyy', { locale: localeId })}</span>
                    </div>
                  )) : (
                    <p className="text-muted-foreground">Belum ada jadwal yang ditentukan.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="font-semibold text-muted-foreground text-sm mb-1">Deskripsi & Broadcast</p>
                <p className="text-sm whitespace-pre-wrap">{selectedComp.description || '-'}</p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => loginWithGoogle()} className="w-full sm:w-auto">
                Login untuk Daftar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
