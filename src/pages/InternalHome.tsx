import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { getAllCompetitions } from '../services/competitionService';
import { getOsnAnnouncement } from '../services/osnService';
import { Competition, OsnAnnouncement } from '../types';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/auth';
import { Calendar as CalendarIcon, MapPin, Trophy, BookOpen } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import DOMPurify from 'dompurify';
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

export function InternalHome() {
  const { userRole, currentUser } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [announcement, setAnnouncement] = useState<OsnAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [comps, ann] = await Promise.all([
          getAllCompetitions(),
          getOsnAnnouncement()
        ]);
        
        let filteredComps = comps;
        // Hanya God, Management, dan user yang mengusulkan yang dapat melihat usulan lomba sebelum muncul
        if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGEMENT) {
           filteredComps = comps.filter(c => c.isApproved !== false || c.proposedByUserId === currentUser?.uid);
        }
        
        setCompetitions(filteredComps);
        setAnnouncement(ann);
      } catch (error) {
        console.error("Gagal mengambil data Home", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userRole, currentUser?.uid]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<any>('month');

  // Kumpulkan event untuk kalender
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Home</h1>
          <p className="text-muted-foreground">Kalender lomba dan informasi pelatihan.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <Card className="md:col-span-12 h-[600px] flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <CalendarIcon className="mr-2 h-5 w-5 text-primary" />
              Kalender Lomba
            </CardTitle>
            <CardDescription>Jadwal perlombaan dan batas pendaftaran (Google Calendar Style)</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-6 pt-0">
            {loading ? (
              <div className="flex h-full items-center justify-center">
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

        <Card className="md:col-span-12">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <BookOpen className="mr-2 h-5 w-5 text-indigo-500" />
              Informasi Pelatihan & OSN Corner
            </CardTitle>
            <CardDescription>Pengumuman dan silabus pelatihan terkini</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
               <div className="flex justify-center p-8">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
               </div>
            ) : announcement ? (
              <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
                <h3 className="font-bold text-xl text-indigo-900 mb-4">{announcement.title || 'Informasi Silabus'}</h3>
                <div 
                  className="prose prose-sm max-w-none text-slate-700 prose-headings:text-indigo-900 prose-a:text-indigo-600"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(announcement.content) }}
                />
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground border rounded-lg bg-slate-50">
                Belum ada informasi pelatihan saat ini.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
