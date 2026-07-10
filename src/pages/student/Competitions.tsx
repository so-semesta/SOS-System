import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllCompetitions, applyForCompetition, checkScheduleConflict, getStudentRegistrations, updateRegistration } from '../../services/competitionService';
import { Competition, Registration, CurationColor, CompetitionStatus, RegistrationStatus, MedalType } from '../../types';
import { CompetitionForm } from '../../components/features/competitions/CompetitionForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import { Search, MapPin, Calendar, ExternalLink, Plus, Printer } from 'lucide-react';

const formatCuration = (curation: CurationColor) => {
  switch (curation) {
    case CurationColor.GOLD:
      return { text: "Lembaga Negara (GOLD)", className: "bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 text-yellow-950 font-bold border-amber-500 shadow-sm" };
    case CurationColor.GREEN:
      return { text: "Sangat Disarankan", className: "bg-green-100 text-green-800 border-green-200" };
    case CurationColor.YELLOW:
      return { text: "Sangat Disarankan (Kuning)", className: "bg-[#fefce8] text-yellow-800 border-yellow-200" };
    case CurationColor.ORANGE:
      return { text: "Disarankan", className: "bg-orange-100 text-orange-800 border-orange-200" };
    case CurationColor.RED:
      return { text: "Tidak Disarankan", className: "bg-red-100 text-red-800 border-red-200" };
    default:
      return { text: curation, className: "" };
  }
};

export function Competitions() {
  const { currentUser, userProfile } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [fieldFilter, setFieldFilter] = useState('ALL');
  const [curationFilter, setCurationFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('NEWEST');
  
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const [selectedMyReg, setSelectedMyReg] = useState<Registration | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const loadData = async () => {
    if (!currentUser) return;
    try {
      const comps = await getAllCompetitions();
      const approvedComps = comps.filter(c => c.isApproved !== false || c.proposedByUserId === currentUser.uid);
      const regs = await getStudentRegistrations(currentUser.uid);
      setCompetitions(approvedComps);
      setRegistrations(regs);
    } catch (error) {
      toast.error('Gagal memuat katalog lomba');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const fields = ['ALL', ...Array.from(new Set(competitions.flatMap(c => c.field || [])))];

  const filteredComps = competitions.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchField = fieldFilter === 'ALL' || (Array.isArray(c.field) ? c.field.includes(fieldFilter) : c.field === fieldFilter);
    const matchCuration = curationFilter === 'ALL' || c.curationColor === curationFilter;
    return matchSearch && matchField && matchCuration;
  }).sort((a, b) => {
    if (sortBy === 'DEADLINE') {
      return new Date(b.registrationDeadline).getTime() - new Date(a.registrationDeadline).getTime();
    } else if (sortBy === 'PRELIMINARY') {
      const aPrelim = a.rounds.length > 0 ? Math.min(...a.rounds.map(r => new Date(r.date).getTime())) : Infinity;
      const bPrelim = b.rounds.length > 0 ? Math.min(...b.rounds.map(r => new Date(r.date).getTime())) : Infinity;
      return bPrelim - aPrelim;
    } else {
      // NEWEST
      return b.createdAt - a.createdAt;
    }
  });

  const getRegistrationStatus = (compId: string) => {
    return registrations.find(r => r.competitionId === compId);
  };

  const handleApply = async () => {
    if (!currentUser || !selectedComp) return;
    
    setIsApplying(true);
    try {
      // Check schedule conflict
      const conflictCompTitle = await checkScheduleConflict(currentUser.uid, selectedComp);
      if (conflictCompTitle) {
        toast.error(`Gagal mendaftar. Terdapat jadwal yang bertabrakan dengan lomba: ${conflictCompTitle}`);
        return;
      }

      // No conflict, proceed
      const newRegId = `reg_${Date.now()}`;
      await applyForCompetition(newRegId, {
        studentId: currentUser.uid,
        studentName: userProfile?.name || 'Siswa',
        competitionId: selectedComp.id,
        competitionTitle: selectedComp.title,
        status: RegistrationStatus.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      toast.success('Pengajuan perizinan berhasil dikirim!');
      setSelectedComp(null);
      loadData(); // Reload registrations
    } catch (error) {
      toast.error('Terjadi kesalahan saat mengajukan perizinan');
      console.error(error);
    } finally {
      setIsApplying(false);
    }
  };

  const handlePrintCV = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Mohon izinkan pop-up untuk mencetak CV');
      return;
    }

    const approvedRegs = registrations.filter(r => r.status === RegistrationStatus.APPROVED);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Curriculum Vitae Lomba - ${userProfile?.name || 'Siswa'}</title>
        <style>
          body { font-family: 'Times New Roman', Times, serif; padding: 40px; line-height: 1.6; color: #333; }
          h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 30px; }
          .profile-section { margin-bottom: 30px; }
          .profile-item { margin-bottom: 8px; }
          .section-title { font-size: 1.2em; font-weight: bold; margin-top: 30px; margin-bottom: 15px; background: #f0f0f0; padding: 5px 10px; border-left: 4px solid #666; }
          table { w-full; border-collapse: collapse; margin-top: 10px; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background-color: #f9f9f9; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Curriculum Vitae</h1>
        
        <div class="profile-section">
          <div class="profile-item"><strong>Nama Lengkap:</strong> ${userProfile?.name || '-'}</div>
          <div class="profile-item"><strong>Email:</strong> ${currentUser?.email || '-'}</div>
        </div>

        <div class="section-title">Riwayat Partisipasi Lomba & Kompetisi</div>
        ${approvedRegs.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Kompetisi</th>
                <th>Bidang</th>
                <th>Tingkat/Kurasi</th>
                <th>Hasil / Pencapaian</th>
                <th>Tanggal Pengajuan</th>
              </tr>
            </thead>
            <tbody>
              ${approvedRegs.map((reg, idx) => {
                const comp = competitions.find(c => c.id === reg.competitionId);
                const finalResultMap: Record<string, string> = {
                  'GOLD': 'Medali Emas',
                  'SILVER': 'Medali Perak',
                  'BRONZE': 'Medali Perunggu',
                  'FINALS': 'Finalis / Honorable Mention',
                  'PARTICIPANT': 'Partisipan'
                };
                const resultText = reg.finalResult ? (finalResultMap[reg.finalResult] || reg.finalResult) : 'Proses/Belum Ada Hasil';
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${reg.competitionTitle}</td>
                    <td>${comp?.field ? (Array.isArray(comp.field) ? comp.field.join(', ') : comp.field) : '-'}</td>
                    <td>${comp?.curationColor || '-'}</td>
                    <td>${resultText}</td>
                    <td>${new Date(reg.createdAt).toLocaleDateString('id-ID')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        ` : '<p>Belum ada riwayat lomba yang disetujui.</p>'}
        
        <div style="margin-top: 50px; display: flex; justify-content: flex-end;">
          <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer; font-size: 16px;">Cetak Dokumen / Simpan PDF</button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Katalog Lomba</h1>
            <p className="text-muted-foreground">Jelajahi dan daftar berbagai kompetisi tingkat nasional maupun internasional.</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger render={<Button variant="outline" className="shrink-0 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" onClick={() => setIsAddDialogOpen(true)} />}>
              <Plus className="w-4 h-4 mr-2" />
              Usulkan Lomba Baru
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Usulkan Lomba Baru</DialogTitle>
                <DialogDescription>
                  Punya informasi lomba menarik? Usulkan di sini agar admin dapat menyetujuinya!
                </DialogDescription>
              </DialogHeader>
              <CompetitionForm onSuccess={() => {
                setIsAddDialogOpen(false);
                toast.success('Lomba berhasil diusulkan!');
                loadData();
              }} />
            </DialogContent>
          </Dialog>
        </div>

      <Tabs defaultValue="katalog" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="katalog">Katalog Lomba</TabsTrigger>
          <TabsTrigger value="saya">Lomba Saya</TabsTrigger>
        </TabsList>

        <TabsContent value="katalog" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama lomba..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={fieldFilter} onValueChange={setFieldFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Pilih Bidang" />
              </SelectTrigger>
              <SelectContent>
                {fields.map(f => (
                  <SelectItem key={f} value={f}>
                    {f === 'ALL' ? 'Semua Bidang' : f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={curationFilter} onValueChange={setCurationFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Pilih Kurasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Kurasi</SelectItem>
                <SelectItem value={CurationColor.GREEN}>Sangat Disarankan (Hijau)</SelectItem>
                <SelectItem value={CurationColor.YELLOW}>Sangat Disarankan (Kuning)</SelectItem>
                <SelectItem value={CurationColor.ORANGE}>Disarankan</SelectItem>
                <SelectItem value={CurationColor.RED}>Tidak Disarankan</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEWEST">Input Terbaru</SelectItem>
                <SelectItem value="DEADLINE">Deadline Daftar</SelectItem>
                <SelectItem value="PRELIMINARY">Pelaksanaan Penyisihan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Memuat katalog...</div>
          ) : filteredComps.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              Tidak ada lomba yang sesuai.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredComps.map(comp => {
                const curation = formatCuration(comp.curationColor);
                const myReg = getRegistrationStatus(comp.id);
                const isYellow = comp.curationColor === CurationColor.YELLOW;
                const isGold = comp.curationColor === CurationColor.GOLD;
                
                return (
                  <Card key={comp.id} className={`flex flex-col overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${isGold ? 'bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 border-amber-600' : isYellow ? 'bg-yellow-50/70 border-yellow-200' : ''}`} onClick={() => setSelectedComp(comp)}>
                    {comp.posterUrl ? (
                      <div className="aspect-video w-full overflow-hidden bg-muted">
                        <img src={comp.posterUrl} alt={comp.title} className="object-cover w-full h-full" />
                      </div>
                    ) : (
                      <div className="aspect-video w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <TrophyIcon className="h-12 w-12 text-slate-300" />
                      </div>
                    )}
                    
                    <CardHeader className="pb-3 flex-1 flex flex-col items-start gap-2">
                      <div className="flex flex-wrap gap-2 w-full">
                        {Array.isArray(comp.field) ? comp.field.map((f, i) => <Badge key={i} variant="secondary" className={isGold ? "bg-amber-100 text-amber-900" : isYellow ? "bg-yellow-100 text-yellow-800" : ""}>{f}</Badge>) : <Badge variant="secondary" className={isGold ? "bg-amber-100 text-amber-900" : isYellow ? "bg-yellow-100 text-yellow-800" : ""}>{comp.field}</Badge>}
                        <Badge variant="outline" className={isGold ? "bg-amber-200/50 text-amber-950 border-amber-300" : isYellow ? "bg-yellow-200/50 text-yellow-900 border-yellow-300" : ""}>{comp.type}</Badge>
                        <Badge variant="outline" className={curation.className}>{curation.text}</Badge>
                      </div>
                      <CardTitle className="line-clamp-2 text-xl mt-1">{comp.title}</CardTitle>
                    </CardHeader>
                    
                    <CardContent className="pb-3 text-sm flex-none">
                      <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold mb-3 ${new Date(comp.registrationDeadline).getTime() < new Date().setHours(0,0,0,0) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        <Calendar className="mr-1.5 h-3 w-3" />
                        Batas Daftar: {new Date(comp.registrationDeadline).toLocaleDateString('id-ID')}
                      </div>
                      <div className="flex items-center text-muted-foreground mb-3">
                        <MapPin className="mr-2 h-4 w-4" />
                        {comp.location || '-'}
                      </div>
                      
                      {myReg ? (
                        <Badge 
                          className="w-full justify-center" 
                          variant={myReg.status === RegistrationStatus.APPROVED ? 'default' : myReg.status === RegistrationStatus.REJECTED ? 'destructive' : 'secondary'}
                        >
                          Status: {myReg.status}
                        </Badge>
                      ) : comp.status === CompetitionStatus.OPEN ? (
                        <Badge variant="outline" className="w-full justify-center text-blue-600 border-blue-200 bg-blue-50">
                          Pendaftaran Buka
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="w-full justify-center text-gray-500">
                          Pendaftaran Ditutup
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="saya" className="space-y-6">
          <div className="flex justify-end mb-4">
            <Button variant="outline" onClick={handlePrintCV}>
              <Printer className="w-4 h-4 mr-2" /> Cetak Riwayat CV
            </Button>
          </div>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Memuat lomba saya...</div>
          ) : registrations.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              Anda belum mengajukan perizinan lomba apapun.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {registrations.map(reg => {
                const comp = competitions.find(c => c.id === reg.competitionId);
                return (
                  <Card key={reg.id} className="flex flex-col hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedMyReg(reg)}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <Badge 
                          variant={reg.status === RegistrationStatus.APPROVED ? 'default' : reg.status === RegistrationStatus.REJECTED ? 'destructive' : 'secondary'}
                        >
                          {reg.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg line-clamp-2">{reg.competitionTitle}</CardTitle>
                      <CardDescription>
                        Diajukan pada: {new Date(reg.createdAt).toLocaleDateString('id-ID')}
                      </CardDescription>
                    </CardHeader>
                    {comp && (
                      <CardContent className="text-sm">
                        <div className="flex items-center text-muted-foreground mb-1">
                          <MapPin className="mr-2 h-4 w-4" />
                          {comp.location || '-'}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
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
                 <Badge variant="outline" className={formatCuration(selectedComp.curationColor).className}>
                   {formatCuration(selectedComp.curationColor).text}
                 </Badge>
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
                  <p>{new Date(selectedComp.registrationDeadline).toLocaleDateString('id-ID')}</p>
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
                  {selectedComp.rounds.length > 0 ? selectedComp.rounds.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((r, i) => (
                    <div key={i} className="flex justify-between border-b last:border-0 pb-1 last:pb-0">
                      <span>{r.name}</span>
                      <span className="font-medium">{new Date(r.date).toLocaleDateString('id-ID')}</span>
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

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setSelectedComp(null)}>Kembali</Button>
              
              {(() => {
                const myReg = getRegistrationStatus(selectedComp.id);
                if (myReg) {
                  return (
                    <Button disabled variant="secondary" className="w-full sm:w-auto">
                      {myReg.status === RegistrationStatus.APPROVED ? 'Sudah Disetujui' : myReg.status === RegistrationStatus.REJECTED ? 'Ditolak' : 'Menunggu Persetujuan Admin'}
                    </Button>
                  );
                }
                if (selectedComp.status === CompetitionStatus.CLOSED) {
                  return (
                    <Button disabled variant="secondary" className="w-full sm:w-auto text-muted-foreground">
                      Pendaftaran Ditutup
                    </Button>
                  );
                }
                return (
                  <Button onClick={handleApply} disabled={isApplying} className="w-full sm:w-auto">
                    {isApplying ? 'Mengajukan...' : 'Ajukan Perizinan'}
                  </Button>
                );
              })()}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* My Registration Detail Dialog */}
      <Dialog open={!!selectedMyReg} onOpenChange={(open) => !open && setSelectedMyReg(null)}>
        {selectedMyReg && (
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{selectedMyReg.competitionTitle}</DialogTitle>
              <DialogDescription>
                Detail pendaftaran dan progres lomba Anda.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground">Status Pendaftaran:</span>
                <Badge variant={selectedMyReg.status === RegistrationStatus.APPROVED ? 'default' : selectedMyReg.status === RegistrationStatus.REJECTED ? 'destructive' : 'secondary'}>
                  {selectedMyReg.status}
                </Badge>
              </div>

              {selectedMyReg.status === RegistrationStatus.APPROVED && (
                <div>
                  <p className="font-semibold text-muted-foreground text-sm mb-2 mt-4">Checklist Progres Lomba</p>
                  {selectedMyReg.roundsChecklist && selectedMyReg.roundsChecklist.length > 0 ? (
                    <div className="space-y-3">
                      {selectedMyReg.roundsChecklist.map((rc, idx) => (
                        <div key={idx} className="flex flex-col gap-2 p-3 border rounded-md bg-muted/20">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{rc.roundName}</span>
                            <Badge variant={rc.passed ? 'default' : 'secondary'}>
                              {rc.passed ? 'Lolos' : 'Belum Lolos'}
                            </Badge>
                          </div>
                          {rc.notes && (
                            <p className="text-sm text-muted-foreground bg-white/50 p-2 rounded border mt-1">
                              <strong>Catatan:</strong> {rc.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Checklist babak belum diatur oleh manajemen.</p>
                  )}

                  <div className="mt-6">
                    <p className="font-semibold text-muted-foreground text-sm mb-2">Hasil Akhir (Terhubung ke Leaderboard)</p>
                    <Select 
                      value={selectedMyReg.finalResult || ''} 
                      onValueChange={async (val: string) => {
                        try {
                          await updateRegistration(selectedMyReg.id, { finalResult: val as MedalType });
                          setSelectedMyReg(prev => prev ? { ...prev, finalResult: val as MedalType } : null);
                          setRegistrations(prev => prev.map(r => r.id === selectedMyReg.id ? { ...r, finalResult: val as MedalType } : r));
                          toast.success('Hasil akhir berhasil disimpan');
                        } catch(e) {
                          toast.error('Gagal menyimpan hasil akhir');
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih pencapaian/hasil akhir..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GOLD">Emas</SelectItem>
                        <SelectItem value="SILVER">Perak</SelectItem>
                        <SelectItem value="BRONZE">Perunggu</SelectItem>
                        <SelectItem value="FINALS">Honorable Mention / Finalis</SelectItem>
                        <SelectItem value="PARTICIPANT">Partisipasi Lomba</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedMyReg(null)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function TrophyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
