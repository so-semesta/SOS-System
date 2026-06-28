import React, { useEffect, useState, useMemo } from 'react';
import { Competition, CompetitionStatus } from '../../types';
import { getAllCompetitions, deleteCompetition } from '../../services/competitionService';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { CompetitionForm } from '../../components/features/competitions/CompetitionForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Pencil, Trash2, AlertTriangle, Download } from 'lucide-react';
import { ConfirmDeleteDialog } from '../../components/ui/ConfirmDeleteDialog';

export function CompetitionsAdmin() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingComp, setEditingComp] = useState<Competition | null>(null);
  const [deletingCompId, setDeletingCompId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getAllCompetitions();
      setCompetitions(data);
    } catch (error) {
      toast.error('Gagal memuat daftar perlombaan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const clashes = useMemo(() => {
    const activeComps = competitions.filter(c => c.status === CompetitionStatus.OPEN);
    const issues: string[] = [];
    
    // Check for timeline overlaps (same day)
    for (let i = 0; i < activeComps.length; i++) {
      for (let j = i + 1; j < activeComps.length; j++) {
        const c1 = activeComps[i];
        const c2 = activeComps[j];
        
        // Check rounds
        c1.rounds.forEach(r1 => {
          c2.rounds.forEach(r2 => {
            const d1 = new Date(r1.date).toDateString();
            const d2 = new Date(r2.date).toDateString();
            if (d1 === d2) {
              issues.push(`Tabrakan Jadwal: Lomba "${c1.title}" (Babak ${r1.name}) bertabrakan dengan Lomba "${c2.title}" (Babak ${r2.name}) pada tanggal ${d1}`);
            }
          });
        });
      }
    }
    return issues;
  }, [competitions]);

  const triggerDelete = (id: string) => {
    if (!id) {
      toast.error('ID lomba tidak valid.');
      return;
    }
    setDeletingCompId(id);
  };

  const confirmDelete = async () => {
    if (!deletingCompId) return;
    setIsDeleting(true);
    try {
      await deleteCompetition(deletingCompId);
      toast.success('Data berhasil dihapus');
      setCompetitions(prev => prev.filter(c => c.id !== deletingCompId));
    } catch (err: any) {
      console.error("Error dari handleDelete:", err.message);
      toast.error(`Gagal menghapus data: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
      setDeletingCompId(null);
    }
  };

  const handleExportCSV = () => {
    if (competitions.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const headers = ['Judul', 'Bidang', 'Tipe', 'Batas Daftar', 'Biaya Pendaftaran', 'Lokasi', 'Warna Kurasi (Level)', 'Status Pendaftaran', 'Approval (ACC)', 'Link Guidebook/Pendaftaran', 'Deskripsi/Broadcast', 'Link Poster'];
    
    const formatField = (val: any) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      // Hindari base64 text yang sangat panjang karena membuat Excel crash
      if (str.startsWith('data:')) return '"[Data File/Gambar]"';
      // Escape quotes dan hilangkan newlines agar lebih aman di CSV
      return `"${str.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    };

    const rows = competitions.map(c => [
      formatField(c.title),
      formatField(Array.isArray(c.field) ? c.field.join(', ') : c.field),
      formatField(c.type),
      formatField(new Date(c.registrationDeadline).toLocaleDateString('id-ID')),
      c.fee || 0,
      formatField(c.location),
      formatField(c.curationColor),
      formatField(c.status),
      formatField(c.isApproved !== false ? 'Approved' : 'Pending'),
      formatField(c.guidebookUrl),
      formatField(c.description),
      formatField(c.posterUrl)
    ].join(';'));

    // Tambahkan BOM (\uFEFF) agar Excel mendeteksi UTF-8, dan gunakan titik koma (;) sebagai delimiter
    const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Katalog_Lomba_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manajemen Katalog Lomba</h1>
        <p className="text-muted-foreground">Admin dan Manajemen dapat menambah daftar lomba yang tersedia untuk diikuti siswa.</p>
      </div>

      {clashes.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-orange-800 flex items-center text-lg">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Catatan Lomba Aktif (Tabrakan Jadwal)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1 text-sm text-orange-900">
              {clashes.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <CompetitionForm onSuccess={loadData} />

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold tracking-tight">Daftar Lomba Aktif</h3>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" /> Ekspor CSV
          </Button>
        </div>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judul</TableHead>
                <TableHead>Bidang</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Batas Daftar</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">Memuat...</TableCell></TableRow>
              ) : competitions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">Belum ada lomba</TableCell></TableRow>
              ) : (
                competitions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>{Array.isArray(c.field) ? c.field.join(', ') : c.field}</TableCell>
                    <TableCell>{c.type}</TableCell>
                    <TableCell>{new Date(c.registrationDeadline).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === CompetitionStatus.OPEN ? 'default' : 'secondary'}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.isApproved !== false ? (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Approved</Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setEditingComp(c)}>
                          <Pencil className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => triggerDelete(c.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!editingComp} onOpenChange={(open) => !open && setEditingComp(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lomba</DialogTitle>
          </DialogHeader>
          {editingComp && (
            <CompetitionForm 
              initialData={editingComp} 
              onSuccess={() => {
                setEditingComp(null);
                loadData();
              }} 
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog 
        isOpen={!!deletingCompId} 
        onClose={() => setDeletingCompId(null)} 
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
