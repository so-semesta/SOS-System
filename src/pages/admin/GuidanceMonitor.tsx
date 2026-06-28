import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllGuidanceLogs } from '../../services/guidanceService';
import { GuidanceLog, Mood } from '../../types';
import { UserRole } from '../../types/auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Search, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ConfirmDeleteDialog } from '../../components/ui/ConfirmDeleteDialog';

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isManagement = userRole === UserRole.MANAGEMENT || userRole === UserRole.ADMIN;

  const fetchLogs = async () => {
    try {
      const data = await getAllGuidanceLogs();
      setLogs(data);
    } catch (error) {
      toast.error('Gagal mengambil data monitoring guidance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
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
      console.error("Error dari handleDelete:", err.message);
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
      ? ['Tanggal', 'Nama Siswa', 'Mata Pelajaran', 'Progress Akademik', 'Kondisi Psikologis', 'Catatan Private']
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
          formatField(l.psychologicalNotes || '-')
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
