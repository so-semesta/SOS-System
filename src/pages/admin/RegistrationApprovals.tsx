import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllRegistrations, updateRegistrationStatus, updateRegistration, getCompetitionById, getAllCompetitions } from '../../services/competitionService';
import { getStudentProfile } from '../../services/studentService';
import { Registration, RegistrationStatus, Competition, Student, RoundChecklist, MedalType } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Checkbox } from '../../components/ui/checkbox';
import { Search, CheckCircle2, XCircle, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';

export function RegistrationApprovals() {
  const { userRole } = useAuth();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [competitionFilter, setCompetitionFilter] = useState<string>('ALL');
  
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const loadData = async () => {
    try {
      const [regsData, compsData] = await Promise.all([
        getAllRegistrations(),
        getAllCompetitions()
      ]);
      setRegistrations(regsData);
      setCompetitions(compsData);
    } catch (error) {
      toast.error('Gagal mengambil data perizinan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openDetail = async (reg: Registration) => {
    setSelectedReg(reg);
    setSelectedStudent(null);
    setSelectedCompetition(null);
    setIsDetailOpen(true);

    try {
      const [student, comp] = await Promise.all([
        getStudentProfile(reg.studentId),
        getCompetitionById(reg.competitionId)
      ]);
      setSelectedStudent(student);
      setSelectedCompetition(comp);

      // Initialize roundsChecklist if empty and competition has rounds
      if (comp && comp.rounds && (!reg.roundsChecklist || reg.roundsChecklist.length === 0)) {
        const initialChecklist = comp.rounds.map(r => ({
          roundName: r.name,
          passed: false,
          notes: ''
        }));
        await updateRegistration(reg.id, { roundsChecklist: initialChecklist });
        setSelectedReg(prev => prev ? { ...prev, roundsChecklist: initialChecklist } : null);
        setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, roundsChecklist: initialChecklist } : r));
      }

    } catch (error) {
      toast.error('Gagal mengambil detail pendaftaran');
    }
  };

  const toggleRoundPassed = async (index: number, passed: boolean) => {
    if (!selectedReg || !selectedReg.roundsChecklist) return;
    setSavingChecklist(true);
    const newChecklist = [...selectedReg.roundsChecklist];
    newChecklist[index].passed = passed;

    try {
      await updateRegistration(selectedReg.id, { roundsChecklist: newChecklist });
      setSelectedReg({ ...selectedReg, roundsChecklist: newChecklist });
      setRegistrations(prev => prev.map(r => r.id === selectedReg.id ? { ...r, roundsChecklist: newChecklist } : r));
    } catch (error) {
      toast.error('Gagal mengupdate checklist');
    } finally {
      setSavingChecklist(false);
    }
  };

  const updateRoundNotes = async (index: number, notes: string) => {
    if (!selectedReg || !selectedReg.roundsChecklist) return;
    const newChecklist = [...selectedReg.roundsChecklist];
    newChecklist[index].notes = notes;
    setSelectedReg({ ...selectedReg, roundsChecklist: newChecklist });
  };

  const saveRoundNotes = async (index: number) => {
    if (!selectedReg || !selectedReg.roundsChecklist) return;
    setSavingChecklist(true);
    try {
      await updateRegistration(selectedReg.id, { roundsChecklist: selectedReg.roundsChecklist });
      setRegistrations(prev => prev.map(r => r.id === selectedReg.id ? { ...r, roundsChecklist: selectedReg.roundsChecklist } : r));
      toast.success('Catatan berhasil disimpan');
    } catch (error) {
      toast.error('Gagal mengupdate catatan');
    } finally {
      setSavingChecklist(false);
    }
  };
  
  const updateFinalResult = async (val: string) => {
    if (!selectedReg) return;
    try {
      const finalResult = val === 'CLEAR' ? undefined : val as MedalType;
      // We pass an object, if finalResult is undefined we can either set it or remove it.
      await updateRegistration(selectedReg.id, { finalResult });
      setSelectedReg({ ...selectedReg, finalResult });
      setRegistrations(prev => prev.map(r => r.id === selectedReg.id ? { ...r, finalResult } : r));
      toast.success('Hasil akhir berhasil disimpan');
    } catch(e) {
      toast.error('Gagal menyimpan hasil akhir');
    }
  };

  const handleUpdateStatus = async (id: string, status: RegistrationStatus) => {
    try {
      await updateRegistrationStatus(id, status);
      toast.success(`Berhasil mengubah status menjadi ${status}`);
      // Optimistic update
      setRegistrations(prev => 
        prev.map(r => r.id === id ? { ...r, status, updatedAt: Date.now() } : r)
      );
    } catch (error) {
      toast.error('Gagal mengubah status');
    }
  };

  const filteredRegs = useMemo(() => {
    return registrations.filter(
      (r) => {
        const matchesSearch = (r.studentName?.toLowerCase() || '').includes(search.toLowerCase()) || 
                              r.competitionTitle.toLowerCase().includes(search.toLowerCase());
        const matchesComp = competitionFilter === 'ALL' || r.competitionId === competitionFilter;
        return matchesSearch && matchesComp;
      }
    );
  }, [registrations, search, competitionFilter]);

  const handleExportCSV = () => {
    if (filteredRegs.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const headers = ['ID Pendaftaran', 'Tanggal Pengajuan', 'Nama Siswa', 'Kompetisi', 'Status', 'Hasil Akhir'];
    
    const formatField = (val: any) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      if (str.startsWith('data:')) return '"[Data File/Gambar]"';
      return `"${str.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    };

    const rows = filteredRegs.map(r => [
      formatField(r.id),
      formatField(new Date(r.createdAt).toLocaleDateString('id-ID')),
      formatField(r.studentName || 'Siswa Tanpa Nama'),
      formatField(r.competitionTitle),
      formatField(r.status),
      formatField(r.finalResult)
    ].join(';'));

    const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Perizinan_Lomba_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Perizinan Lomba</h1>
          <p className="text-muted-foreground">Review dan setujui pengajuan perizinan lomba dari siswa.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select value={competitionFilter} onValueChange={setCompetitionFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Semua Lomba" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Lomba</SelectItem>
              {competitions.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama siswa atau lomba..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Ekspor CSV
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tgl Pengajuan</TableHead>
              <TableHead>Nama Siswa</TableHead>
              <TableHead>Lomba / Kompetisi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">Memuat data perizinan...</TableCell>
              </TableRow>
            ) : filteredRegs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">Tidak ada pengajuan perizinan.</TableCell>
              </TableRow>
            ) : (
              filteredRegs.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(reg.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="font-medium">{reg.studentName || 'Siswa Tanpa Nama'}</TableCell>
                  <TableCell>{reg.competitionTitle}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        reg.status === RegistrationStatus.APPROVED ? 'default' : 
                        reg.status === RegistrationStatus.REJECTED ? 'destructive' : 'secondary'
                      }
                    >
                      {reg.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(reg)}>
                        <Eye className="w-4 h-4 text-blue-500" />
                      </Button>
                      {reg.status === RegistrationStatus.PENDING ? (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                            onClick={() => handleUpdateStatus(reg.id, RegistrationStatus.APPROVED)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Setujui
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
                            onClick={() => handleUpdateStatus(reg.id, RegistrationStatus.REJECTED)}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Tolak
                          </Button>
                        </>
                      ) : userRole === 'MANAGEMENT' ? (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
                            onClick={() => handleUpdateStatus(reg.id, RegistrationStatus.PENDING)}
                            title="God Mode: Batalkan Review"
                          >
                            <XCircle className="h-4 w-4 mr-1" /> God Mode: Pending
                          </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Perizinan Lomba</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Student Info */}
            <div className="bg-muted/20 p-4 rounded-lg">
              <h3 className="font-semibold text-lg border-b pb-2 mb-4">Informasi Siswa</h3>
              {selectedStudent ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground block">Nama Lengkap</span> <span className="font-medium">{selectedStudent.fullName}</span></div>
                  <div><span className="text-muted-foreground block">NISN</span> <span className="font-medium">{selectedStudent.nisn}</span></div>
                  <div><span className="text-muted-foreground block">Kelas</span> <span className="font-medium">{selectedStudent.grade}</span></div>
                  <div><span className="text-muted-foreground block">Email</span> <span className="font-medium">{selectedStudent.activeEmail}</span></div>
                  <div><span className="text-muted-foreground block">Bidang OSN</span> <span className="font-medium">{selectedStudent.osnField}</span></div>
                  <div><span className="text-muted-foreground block">No HP (WA)</span> <span className="font-medium">{selectedStudent.activePhoneWA}</span></div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Data siswa belum lengkap atau tidak ditemukan.</p>
              )}
            </div>

            {/* Checklist Babak & Hasil Akhir */}
            {selectedReg?.status === RegistrationStatus.APPROVED && (
              <div className="bg-muted/20 p-4 rounded-lg">
                <h3 className="font-semibold text-lg border-b pb-2 mb-4">Checklist Progres Lomba & Hasil Akhir</h3>
                
                {selectedReg.roundsChecklist && selectedReg.roundsChecklist.length > 0 && (
                  <div className="space-y-4 mb-6">
                    {selectedReg.roundsChecklist.map((rc, idx) => (
                      <div key={idx} className="flex flex-col gap-2 p-3 border rounded-md bg-card">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            id={`round-${idx}`} 
                            checked={rc.passed} 
                            onCheckedChange={(checked) => toggleRoundPassed(idx, checked === true)} 
                            disabled={savingChecklist}
                          />
                          <label htmlFor={`round-${idx}`} className="font-medium flex-1 cursor-pointer">
                            {rc.roundName}
                          </label>
                          <Badge variant={rc.passed ? 'default' : 'secondary'}>
                            {rc.passed ? 'Lolos' : 'Belum Lolos'}
                          </Badge>
                        </div>
                        <div className="flex gap-2 pl-7 mt-1">
                          <Input 
                            placeholder="Catatan babak ini (opsional)" 
                            value={rc.notes || ''}
                            onChange={(e) => updateRoundNotes(idx, e.target.value)}
                            className="flex-1 text-sm h-8"
                          />
                          <Button size="sm" onClick={() => saveRoundNotes(idx)} disabled={savingChecklist} variant="secondary" className="h-8">Simpan</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t">
                  <p className="font-semibold text-sm mb-2">Hasil Akhir Lomba</p>
                  <Select 
                    value={selectedReg.finalResult || 'CLEAR'} 
                    onValueChange={updateFinalResult}
                  >
                    <SelectTrigger className="w-full bg-card">
                      <SelectValue placeholder="Pilih pencapaian/hasil akhir..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLEAR">Belum Ada Hasil</SelectItem>
                      <SelectItem value="GOLD">Emas</SelectItem>
                      <SelectItem value="SILVER">Perak</SelectItem>
                      <SelectItem value="BRONZE">Perunggu</SelectItem>
                      <SelectItem value="FINALS">Honorable Mention / Finalis</SelectItem>
                      <SelectItem value="PARTICIPANT">Partisipasi Lomba</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">Data ini akan terhubung ke kalkulasi poin Leaderboard siswa.</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
