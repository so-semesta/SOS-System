import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { BookOpen, FileText, Megaphone, Download, Pencil, Plus, Trash2, Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/auth';
import { OsnAnnouncement, OsnBankSoal } from '../types';
import { getOsnAnnouncements, addOsnAnnouncement, updateOsnAnnouncement, deleteOsnAnnouncement, getOsnBankSoal, addOsnBankSoal, updateOsnBankSoal, deleteOsnBankSoal } from '../services/osnService';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ConfirmDeleteDialog } from '../components/ui/ConfirmDeleteDialog';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'align': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link', 'clean'],
    [{ 'color': [] }, { 'background': [] }]
  ]
};

export function OSN() {
  const { userRole } = useAuth();
  const isManagement = userRole === UserRole.MANAGEMENT || userRole === UserRole.ADMIN || userRole === UserRole.ADMIN_SOS || userRole === UserRole.ADMIN_STUDENT;

  const [announcements, setAnnouncements] = useState<OsnAnnouncement[]>([]);
  const [bankSoal, setBankSoal] = useState<OsnBankSoal[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isEditInfoOpen, setIsEditInfoOpen] = useState(false);
  const [infoForm, setInfoForm] = useState<Partial<OsnAnnouncement>>({ title: '', content: '', targetAudience: 'ALL' });
  const [editingInfoId, setEditingInfoId] = useState<string | null>(null);
  const [deletingInfoId, setDeletingInfoId] = useState<string | null>(null);

  const [isSoalModalOpen, setIsSoalModalOpen] = useState(false);
  const [soalForm, setSoalForm] = useState<Partial<OsnBankSoal>>({ title: '', subject: '', fileUrl: '', targetAudience: 'ALL' });
  const [editingSoalId, setEditingSoalId] = useState<string | null>(null);

  const [deletingSoalId, setDeletingSoalId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const anns = await getOsnAnnouncements();
      setAnnouncements(anns);
      
      const soal = await getOsnBankSoal();
      setBankSoal(soal);
    } catch (error) {
      console.error("Error fetching OSN data:", error);
      toast.error('Gagal mengambil data OSN');
    } finally {
      setLoading(false);
    }
  };

  // Filtered based on role: regular students only see items meant for ALL or STUDENT
  const displayedAnnouncements = useMemo(() => {
    if (userRole === UserRole.STUDENT) {
      return announcements.filter(a => !a.targetAudience || a.targetAudience === 'ALL' || a.targetAudience === 'STUDENT');
    }
    return announcements;
  }, [announcements, userRole]);

  const displayedBankSoal = useMemo(() => {
    if (userRole === UserRole.STUDENT) {
      return bankSoal.filter(s => !s.targetAudience || s.targetAudience === 'ALL' || s.targetAudience === 'STUDENT');
    }
    return bankSoal;
  }, [bankSoal, userRole]);

  // Group soal by subject
  const groupedSoal = useMemo(() => {
    return displayedBankSoal.reduce((acc, soal) => {
      const subj = soal.subject || 'Lainnya';
      if (!acc[subj]) acc[subj] = [];
      acc[subj].push(soal);
      return acc;
    }, {} as Record<string, OsnBankSoal[]>);
  }, [displayedBankSoal]);

  // --- Announcement Handlers ---
  const handleOpenAddInfo = () => {
    setEditingInfoId(null);
    setInfoForm({ title: '', content: '', targetAudience: 'ALL' });
    setIsEditInfoOpen(true);
  };
  
  const handleOpenEditInfo = (ann: OsnAnnouncement) => {
    setEditingInfoId(ann.id!);
    setInfoForm({ title: ann.title, content: ann.content, targetAudience: ann.targetAudience || 'ALL' });
    setIsEditInfoOpen(true);
  };

  const handleSaveInfo = async () => {
    try {
      if (editingInfoId) {
        await updateOsnAnnouncement(editingInfoId, infoForm);
        setAnnouncements(prev => prev.map(a => a.id === editingInfoId ? { ...a, ...infoForm } as OsnAnnouncement : a));
        toast.success('Informasi berhasil diperbarui');
      } else {
        await addOsnAnnouncement(infoForm as Omit<OsnAnnouncement, 'id'>);
        const anns = await getOsnAnnouncements();
        setAnnouncements(anns);
        toast.success('Informasi berhasil ditambahkan');
      }
      setIsEditInfoOpen(false);
    } catch (error) {
      toast.error('Gagal menyimpan informasi');
    }
  };
  
  const confirmDeleteInfo = async () => {
    if (!deletingInfoId) return;
    setIsDeleting(true);
    try {
      await deleteOsnAnnouncement(deletingInfoId);
      setAnnouncements(prev => prev.filter(a => a.id !== deletingInfoId));
      toast.success('Informasi berhasil dihapus');
    } catch (error) {
      toast.error('Gagal menghapus informasi');
    } finally {
      setIsDeleting(false);
      setDeletingInfoId(null);
    }
  };

  // --- Bank Soal Handlers ---
  const handleOpenAddSoal = () => {
    setEditingSoalId(null);
    setSoalForm({ title: '', subject: '', fileUrl: '', targetAudience: 'ALL' });
    setIsSoalModalOpen(true);
  };

  const handleOpenEditSoal = (soal: OsnBankSoal) => {
    setEditingSoalId(soal.id!);
    setSoalForm({ title: soal.title, subject: soal.subject, fileUrl: soal.fileUrl, targetAudience: soal.targetAudience || 'ALL' });
    setIsSoalModalOpen(true);
  };

  const handleSaveSoal = async () => {
    if (!soalForm.title || !soalForm.subject || !soalForm.fileUrl) {
      toast.error('Harap lengkapi semua field');
      return;
    }
    
    try {
      if (editingSoalId) {
        await updateOsnBankSoal(editingSoalId, soalForm);
        setBankSoal(prev => prev.map(s => s.id === editingSoalId ? { ...s, ...soalForm } as OsnBankSoal : s));
        toast.success('Bank soal diperbarui');
      } else {
        await addOsnBankSoal(soalForm as Omit<OsnBankSoal, 'id'>);
        const soal = await getOsnBankSoal();
        setBankSoal(soal);
        toast.success('Bank soal ditambahkan');
      }
      setIsSoalModalOpen(false);
    } catch (error) {
      toast.error('Gagal menyimpan bank soal');
    }
  };

  const confirmDeleteSoal = async () => {
    if (!deletingSoalId) return;
    setIsDeleting(true);
    try {
      await deleteOsnBankSoal(deletingSoalId);
      setBankSoal(prev => prev.filter(s => s.id !== deletingSoalId));
      toast.success('Bank soal dihapus');
    } catch (err: any) {
      toast.error('Gagal menghapus bank soal');
    } finally {
      setIsDeleting(false);
      setDeletingSoalId(null);
    }
  };

  if (loading) {
    return <div>Memuat...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">OSN Corner</h1>
        <p className="text-muted-foreground">Pusat informasi, bank soal, dan pengumuman terkait Olimpiade Sains Nasional.</p>
      </div>

      {/* Notice for Student role */}
      {userRole === UserRole.STUDENT && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-sm">Akses Informasi Terbuka untuk Siswa</div>
            <div className="text-xs text-amber-700 mt-0.5">
              Anda sedang mengakses materi dan silabus umum OSN. Materi pembinaan intensif dan bank soal terarah dikhususkan untuk skuad SOS.
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="silabus" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 max-w-md">
          <TabsTrigger value="silabus" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>Informasi & Silabus</span>
          </TabsTrigger>
          <TabsTrigger value="soal" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Bank Soal</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="silabus" className="space-y-4">
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Informasi Silabus</h2>
                <p className="text-muted-foreground text-sm">Informasi penting dan panduan silabus OSN.</p>
              </div>
              {isManagement && (
                <Button onClick={handleOpenAddInfo} size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Tambah Informasi
                </Button>
              )}
            </div>
            
            {displayedAnnouncements.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Belum ada informasi yang ditambahkan.
                </CardContent>
              </Card>
            ) : (
              displayedAnnouncements.map((ann) => (
                <Card key={ann.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{ann.title || 'Informasi'}</CardTitle>
                      {ann.targetAudience && ann.targetAudience !== 'ALL' && (
                        <Badge variant="outline" className={ann.targetAudience === 'SOS' ? "bg-purple-50 text-purple-700 border-purple-200 text-xs" : "bg-blue-50 text-blue-700 border-blue-200 text-xs"}>
                          {ann.targetAudience === 'SOS' ? 'Khusus SOS' : 'Khusus Siswa'}
                        </Badge>
                      )}
                    </div>
                    {isManagement && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenEditInfo(ann)}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDeletingInfoId(ann.id!)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="prose prose-sm max-w-none prose-slate mt-2"
                      dangerouslySetInnerHTML={{ __html: ann.content ? DOMPurify.sanitize(ann.content) : '' }}
                    />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="soal" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Bank Soal & Pembahasan</CardTitle>
                <CardDescription>Tautan unduhan soal-soal latihan.</CardDescription>
              </div>
              {isManagement && (
                <Button onClick={handleOpenAddSoal} size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Tambah Soal
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.keys(groupedSoal).length === 0 ? (
                <p className="text-muted-foreground text-sm">Belum ada bank soal tersedia.</p>
              ) : (
                Object.keys(groupedSoal).map((subject) => (
                  <div key={subject} className="space-y-3">
                    <h3 className="font-semibold text-lg border-b pb-2">{subject}</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {groupedSoal[subject].map((soal) => (
                        <div key={soal.id} className="flex flex-col p-4 border rounded-lg bg-card gap-4 justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-md shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium text-sm line-clamp-2">{soal.title}</p>
                              {soal.targetAudience && soal.targetAudience !== 'ALL' && (
                                <Badge variant="outline" className={soal.targetAudience === 'SOS' ? "bg-purple-50 text-purple-700 border-purple-200 text-xs" : "bg-blue-50 text-blue-700 border-blue-200 text-xs"}>
                                  {soal.targetAudience === 'SOS' ? 'Khusus SOS' : 'Khusus Siswa'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between border-t pt-3">
                            <Button variant="outline" size="sm" className="text-xs" onClick={() => window.open(soal.fileUrl, '_blank', 'noopener,noreferrer')}>
                              <Download className="w-3 h-3 mr-1" /> Buka
                            </Button>
                            {isManagement && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => handleOpenEditSoal(soal)}>
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setDeletingSoalId(soal.id!)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Edit Info */}
      <Dialog open={isEditInfoOpen} onOpenChange={setIsEditInfoOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingInfoId ? 'Edit Informasi OSN' : 'Tambah Informasi OSN'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Judul Informasi</Label>
              <Input value={infoForm.title || ''} onChange={e => setInfoForm({...infoForm, title: e.target.value})} />
            </div>
            {isManagement && (
              <div className="space-y-2">
                <Label>Target Pembaca / Akses</Label>
                <Select 
                  value={infoForm.targetAudience || 'ALL'} 
                  onValueChange={(val: any) => setInfoForm({...infoForm, targetAudience: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih target akses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Siswa (SOS & Siswa Reguler)</SelectItem>
                    <SelectItem value="SOS">Hanya Tim SOS</SelectItem>
                    <SelectItem value="STUDENT">Hanya Siswa Reguler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Konten / Pengumuman / Silabus</Label>
              <div className="h-[400px] mb-12">
                <ReactQuill 
                  theme="snow"
                  modules={quillModules}
                  value={infoForm.content || ''} 
                  onChange={content => setInfoForm({...infoForm, content})} 
                  className="h-[350px]"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditInfoOpen(false)}>Batal</Button>
            <Button onClick={handleSaveInfo}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Tambah/Edit Soal */}
      <Dialog open={isSoalModalOpen} onOpenChange={setIsSoalModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSoalId ? 'Edit Bank Soal' : 'Tambah Bank Soal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Judul / Nama File</Label>
              <Input 
                placeholder="Contoh: Soal OSK Matematika 2023"
                value={soalForm.title} 
                onChange={e => setSoalForm({...soalForm, title: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Bidang / Mata Pelajaran</Label>
              <Input 
                placeholder="Contoh: Matematika"
                value={soalForm.subject} 
                onChange={e => setSoalForm({...soalForm, subject: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>URL File (Google Drive dll)</Label>
              <Input 
                type="url"
                placeholder="https://..."
                value={soalForm.fileUrl} 
                onChange={e => setSoalForm({...soalForm, fileUrl: e.target.value})} 
              />
            </div>
            {isManagement && (
              <div className="space-y-2">
                <Label>Target Pembaca / Akses</Label>
                <Select 
                  value={soalForm.targetAudience || 'ALL'} 
                  onValueChange={(val: any) => setSoalForm({...soalForm, targetAudience: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih target akses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Siswa (SOS & Siswa Reguler)</SelectItem>
                    <SelectItem value="SOS">Hanya Tim SOS</SelectItem>
                    <SelectItem value="STUDENT">Hanya Siswa Reguler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSoalModalOpen(false)}>Batal</Button>
            <Button onClick={handleSaveSoal}>Simpan Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Soal */}
      <ConfirmDeleteDialog
        isOpen={!!deletingSoalId}
        onClose={() => setDeletingSoalId(null)}
        onConfirm={confirmDeleteSoal}
        isLoading={isDeleting}
      />
    
      <ConfirmDeleteDialog
        isOpen={!!deletingInfoId}
        onClose={() => setDeletingInfoId(null)}
        onConfirm={confirmDeleteInfo}
        isLoading={isDeleting}
      />
    </div>
  );
}
