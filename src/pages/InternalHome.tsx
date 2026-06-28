import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { getAllCompetitions, getAllRegistrations } from '../services/competitionService';
import { getOsnAnnouncement } from '../services/osnService';
import { getStudentGuidanceLogs } from '../services/guidanceService';
import { Competition, OsnAnnouncement, Registration, GuidanceLog, MedalType } from '../types';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/auth';
import { Calendar as CalendarIcon, Trophy, BookOpen, PenTool, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
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
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [announcement, setAnnouncement] = useState<OsnAnnouncement | null>(null);
  
  // Student stats state
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [myGuidanceLogs, setMyGuidanceLogs] = useState<GuidanceLog[]>([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const compsPromise = getAllCompetitions();
        const annPromise = getOsnAnnouncement();
        let regsPromise: Promise<Registration[]> = Promise.resolve([]);
        let guidancePromise: Promise<GuidanceLog[]> = Promise.resolve([]);

        if (userRole === UserRole.STUDENT && currentUser) {
          regsPromise = getAllRegistrations();
          guidancePromise = getStudentGuidanceLogs(currentUser.uid);
        }

        const [comps, ann, regs, guidance] = await Promise.all([
          compsPromise,
          annPromise,
          regsPromise,
          guidancePromise
        ]);
        
        let filteredComps = comps;
        if (userRole !== UserRole.ADMIN && userRole !== UserRole.MANAGEMENT) {
           filteredComps = comps.filter(c => c.isApproved !== false || c.proposedByUserId === currentUser?.uid);
        }
        
        setCompetitions(filteredComps);
        setAnnouncement(ann);

        if (userRole === UserRole.STUDENT && currentUser) {
          setMyRegistrations(regs.filter(r => r.studentId === currentUser.uid));
          setMyGuidanceLogs(guidance.sort((a, b) => a.date - b.date)); // sort by date ascending for chart
        }

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

  const events: any[] = useMemo(() => {
    const arr: any[] = [];
    competitions.forEach(c => {
      arr.push({
        id: `${c.id}-deadline`,
        title: `${c.title} (Batas)`,
        start: new Date(c.registrationDeadline),
        end: new Date(c.registrationDeadline),
        allDay: true,
        type: 'Deadline',
        comp: c
      });
      c.rounds.forEach(r => {
        arr.push({
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
    return arr;
  }, [competitions]);

  const eventStyleGetter = (event: any) => {
    const isDeadline = event.type === 'Deadline';
    const style = {
      backgroundColor: isDeadline ? '#ef4444' : '#3b82f6',
      borderRadius: '4px',
      opacity: 0.9,
      color: 'white',
      border: '0px',
      display: 'block',
      padding: '2px 5px',
      fontSize: '11px'
    };
    return { style };
  };

  // Student Stats Calculation
  const isStudent = userRole === UserRole.STUDENT;
  
  const competitionStats = useMemo(() => {
    let joined = 0;
    let gold = 0;
    let silver = 0;
    let bronze = 0;
    let hm = 0;
    myRegistrations.forEach(r => {
      joined++;
      if (r.finalResult === MedalType.GOLD) gold++;
      if (r.finalResult === MedalType.SILVER) silver++;
      if (r.finalResult === MedalType.BRONZE) bronze++;
      if (r.finalResult === MedalType.FINALS) hm++;
    });
    return { joined, gold, silver, bronze, hm };
  }, [myRegistrations]);

  const guidanceChartData = useMemo(() => {
    return myGuidanceLogs.map(log => ({
      dateStr: format(new Date(log.date), 'dd MMM'),
      'Jam Belajar': log.studyHours || 0,
      'Soal': log.questionsCompleted || 0,
      'Halaman': log.summaryPages || 0,
    }));
  }, [myGuidanceLogs]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Home</h1>
          <p className="text-muted-foreground">Selamat datang di Sistem Manajemen Prestasi SOS.</p>
        </div>
      </div>

      {isStudent && !loading && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Lomba Analytics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <Trophy className="mr-2 h-5 w-5 text-amber-500" />
                Statistik Lomba
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl text-center">
                  <div className="text-3xl font-bold text-slate-800">{competitionStats.joined}</div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Diikuti</div>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl text-center">
                  <div className="text-3xl font-bold text-amber-600">{competitionStats.gold}</div>
                  <div className="text-xs text-amber-700 font-medium uppercase tracking-wider">Emas</div>
                </div>
                <div className="bg-gray-100 p-4 rounded-xl text-center">
                  <div className="text-3xl font-bold text-gray-600">{competitionStats.silver}</div>
                  <div className="text-xs text-gray-700 font-medium uppercase tracking-wider">Perak</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-xl text-center">
                  <div className="text-3xl font-bold text-orange-600">{competitionStats.bronze}</div>
                  <div className="text-xs text-orange-700 font-medium uppercase tracking-wider">Perunggu</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Guidance Analytics */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center text-lg">
                <PenTool className="mr-2 h-5 w-5 text-indigo-500" />
                Daily Report Guidance
              </CardTitle>
              <Button size="sm" onClick={() => navigate('/guidance')} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-1" /> Input Report
              </Button>
            </CardHeader>
            <CardContent>
              {guidanceChartData.length > 0 ? (
                <div className="h-[180px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={guidanceChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dateStr" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" fontSize={12} tickLine={false} axisLine={false} />
                      <RechartsTooltip />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="Jam Belajar" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="left" type="monotone" dataKey="Soal" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="left" type="monotone" dataKey="Halaman" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[180px] flex items-center justify-center border border-dashed rounded-lg text-muted-foreground mt-4 text-sm">
                  Belum ada data daily report.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Informasi OSN (Left) */}
        <Card className="h-[500px] flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <BookOpen className="mr-2 h-5 w-5 text-indigo-500" />
              Informasi Pelatihan & OSN
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
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

        {/* Kalender Lomba (Right) */}
        <Card className="h-[500px] flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <CalendarIcon className="mr-2 h-5 w-5 text-primary" />
              Kalender Lomba
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden pb-4 px-4">
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
                views={['month', 'agenda']}
                messages={{
                  next: ">",
                  previous: "<",
                  today: "Hari Ini",
                  month: "Bulan",
                  agenda: "Agenda",
                  date: "Tanggal",
                  time: "Waktu",
                  event: "Acara",
                  noEventsInRange: "Tidak ada acara",
                }}
                culture="id"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
