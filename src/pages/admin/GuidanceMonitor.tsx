import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllGuidanceLogs } from '../../services/guidanceService';
import { getAllStudents } from '../../services/studentService';
import { GuidanceLog, Mood, Student } from '../../types';
import { UserRole } from '../../types/auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Search, Trash2, Download, BarChart2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from 'sonner';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ConfirmDeleteDialog } from '../../components/ui/ConfirmDeleteDialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';

const MOOD_EMOJIS = {
  [Mood.GREAT]: '🤩 Sangat Baik',
  [Mood.GOOD]: '😊 Baik',
  [Mood.NEUTRAL]: '😐 Biasa Saja',
  [Mood.BAD]: '😔 Sedih/Lelah',
  [Mood.TERRIBLE]: '😭 Sangat Buruk',
};

const getMoodBadgeColor = (mood: Mood) => {
  switch (mood) {
    case Mood.GREAT:
    case Mood.GOOD:
      return 'bg-green-100 text-green-800 border-green-200';
    case Mood.NEUTRAL:
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case Mood.BAD:
    case Mood.TERRIBLE:
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function GuidanceMonitor() {
  const { userRole } = useAuth();
  const [logs, setLogs] = useState<GuidanceLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedStudentForChart, setSelectedStudentForChart] = useState<string>('ALL');

  const isManagement = userRole === UserRole.MANAGEMENT || userRole === UserRole.ADMIN;

  const fetchData = async () => {
    try {
      const [logsData, studentsData] = await Promise.all([
        getAllGuidanceLogs(),
        getAllStudents()
      ]);
      setLogs(logsData);
      setStudents(studentsData);
    } catch (error) {
      toast.error('Gagal mengambil data monitoring guidance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerDelete = (id: string) => {
    if(!id) {
      toast.error('ID catatan tidak valid');
      return;
    }
    setDeletingLogId(id);
  };

  const confirmDelete = async () => {
    if (!deletingLogId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'guidanceLogs', deletingLogId));
      toast.success('Data berhasil dihapus');
      setLogs(prev => prev.filter(log => log.id !== deletingLogId));
    } catch (err: any) {
      toast.error(`Gagal menghapus data: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
      setDeletingLogId(null);
    }
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.studentName?.toLowerCase().includes(search.toLowerCase()) ||
      l.academicSubject.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const headers = isManagement 
      ? ['Tanggal', 'Nama Siswa', 'Mata Pelajaran', 'Progress Akademik', 'Kondisi Psikologis', 'Catatan Private', 'Jam Belajar', 'Jml Soal', 'Jml Halaman']
      : ['Tanggal', 'Nama Siswa', 'Mata Pelajaran', 'Progress Akademik'];

    const formatField = (val: any) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      return `"${str.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    };

    const rows = filteredLogs.map(l => {
      const baseFields = [
        formatField(new Date(l.date).toLocaleDateString('id-ID')),
        formatField(l.studentName || 'Siswa'),
        formatField(l.academicSubject),
        formatField(l.studyProgress)
      ];
      if (isManagement) {
        baseFields.push(
          formatField(MOOD_EMOJIS[l.mood] || l.mood),
          formatField(l.psychologicalNotes || '-'),
          formatField(l.studyHours || 0),
          formatField(l.questionsCompleted || 0),
          formatField(l.summaryPages || 0)
        );
      }
      return baseFields.join(';');
    });

    const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Monitoring_Guidance_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Student specific chart data
  const chartData = useMemo(() => {
    if (selectedStudentForChart === 'ALL') return [];
    
    const studentLogs = logs
      .filter(l => l.studentId === selectedStudentForChart)
      .sort((a, b) => a.date - b.date);

    return studentLogs.map(log => ({
      dateStr: format(new Date(log.date), 'dd MMM'),
      'Jam Belajar': log.studyHours || 0,
      'Soal': log.questionsCompleted || 0,
      'Halaman': log.summaryPages || 0,
    }));
  }, [logs, selectedStudentForChart]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guidance & Monitoring</h1>
          <p className="text-muted-foreground">
            {isManagement 
              ? 'Pantau progress akademik dan kondisi psikologis siswa secara menyeluruh.'
              : 'Pantau laporan harian jurnal akademik siswa.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari siswa atau materi..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {(userRole === UserRole.ADMIN || userRole === UserRole.MANAGEMENT) && (
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Ekspor CSV
            </Button>
          )}
        </div>
      </div>

      {isManagement && (
        <Card className="mb-6">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center text-lg">
              <BarChart2 className="mr-2 h-5 w-5 text-indigo-500" />
              Analitik Jurnal Harian Siswa
            </CardTitle>
            <Select value={selectedStudentForChart} onValueChange={setSelectedStudentForChart}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Pilih Siswa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">-- Pilih Siswa --</SelectItem>
                {students.map(s => (
                  <SelectItem key={s.userId} value={s.userId}>
                    {s.fullName} ({s.grade})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {selectedStudentForChart === 'ALL' ? (
              <div className="h-[200px] flex items-center justify-center border border-dashed rounded-lg text-muted-foreground mt-4 text-sm">
                Pilih nama siswa pada dropdown di atas untuk melihat analitik.
              </div>
            ) : chartData.length > 0 ? (
              <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
              <div className="h-[200px] flex items-center justify-center border border-dashed rounded-lg text-muted-foreground mt-4 text-sm">
                Belum ada data daily report untuk siswa ini.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Nama Siswa</TableHead>
              <TableHead>Mata Pelajaran</TableHead>
              <TableHead className="w-1/3">Progress Akademik</TableHead>
              {isManagement && (
                <>
                  <TableHead>Kondisi Psikologis</TableHead>
                  <TableHead className="w-1/4">Catatan Private</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isManagement ? 7 : 4} className="h-24 text-center">
                  Memuat data monitoring...
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isManagement ? 7 : 4} className="h-24 text-center">
                  Tidak ada data yang ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id} className={isManagement && (log.mood === Mood.BAD || log.mood === Mood.TERRIBLE) ? 'bg-red-50/30' : ''}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(log.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="font-semibold">{log.studentName || 'Siswa'}</TableCell>
                  <TableCell>{log.academicSubject}</TableCell>
                  <TableCell className="text-sm">
                    <p className="line-clamp-2" title={log.studyProgress}>{log.studyProgress}</p>
                  </TableCell>

                  {/* KONDISI PSIKOLOGIS - HANYA UNTUK MANAGEMENT */}
                  {isManagement && (
                    <>
                      <TableCell>
                        <Badge variant="outline" className={getMoodBadgeColor(log.mood)}>
                          {MOOD_EMOJIS[log.mood] || log.mood}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground italic">
                        <p className="line-clamp-2" title={log.psychologicalNotes}>
                          {log.psychologicalNotes || '-'}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => triggerDelete(log.id!)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <ConfirmDeleteDialog 
        isOpen={!!deletingLogId} 
        onClose={() => setDeletingLogId(null)} 
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
