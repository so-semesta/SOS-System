import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { getAllStudents } from '../services/studentService';
import { getAllCompetitions, getAllRegistrations } from '../services/competitionService';
import { Student, Competition, Registration, MedalType } from '../types';
import { Users, Trophy, ClipboardList, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export function Dashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studs, comps, regs] = await Promise.all([
          getAllStudents(),
          getAllCompetitions(),
          getAllRegistrations(),
        ]);
        setStudents(studs);
        setCompetitions(comps);
        setRegistrations(regs);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="py-12 flex justify-center text-muted-foreground">Memuat Dashboard...</div>;
  }

  // Calculate some stats
  const totalStudents = students.length;
  const totalCompetitions = competitions.length;
  const totalRegistrations = registrations.length;
  
  let totalMedals = 0;
  let gold = 0, silver = 0, bronze = 0, participant = 0;
  
  registrations.forEach(r => {
    if (r.finalResult) {
      if (r.finalResult === MedalType.GOLD) gold++;
      if (r.finalResult === MedalType.SILVER) silver++;
      if (r.finalResult === MedalType.BRONZE) bronze++;
      if (r.finalResult === MedalType.PARTICIPANT || r.finalResult === MedalType.FINALS) participant++;
      totalMedals++;
    }
  });

  const medalData = [
    { name: 'Emas', value: gold, color: '#fbbf24' },
    { name: 'Perak', value: silver, color: '#94a3b8' },
    { name: 'Perunggu', value: bronze, color: '#b45309' },
    { name: 'Partisipan/Finalis', value: participant, color: '#64748b' }
  ].filter(d => d.value > 0);

  // Field distribution
  const fieldCounts: Record<string, number> = {};
  competitions.forEach(c => {
    if (Array.isArray(c.field)) {
      c.field.forEach(f => {
        fieldCounts[f] = (fieldCounts[f] || 0) + 1;
      });
    } else if (c.field) {
      fieldCounts[c.field] = (fieldCounts[c.field] || 0) + 1;
    }
  });
  
  const fieldData = Object.entries(fieldCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Analitik</h1>
        <p className="text-muted-foreground">Ringkasan data manajemen siswa dan lomba</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Siswa</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Kompetisi</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompetitions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendaftaran Lomba</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRegistrations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Penghargaan</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMedals}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Distribusi Bidang Lomba</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fieldData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="count" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Perolehan Medali</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {medalData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={medalData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {medalData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  Belum ada data penghargaan.
                </div>
              )}
            </div>
            {medalData.length > 0 && (
              <div className="flex justify-center gap-4 mt-4 flex-wrap">
                {medalData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs font-medium">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
