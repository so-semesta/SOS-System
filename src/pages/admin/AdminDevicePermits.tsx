import React, { useState, useEffect, useMemo } from 'react';
import {
  getAllDevicePermits,
  updateDevicePermit,
  bulkUpdateDevicePermits,
  createDevicePermit,
  deleteDevicePermit,
  DevicePermitStudent,
  SchoolUnit,
  PermitStatus,
  getVerificationUrl,
  PDF_FILES,
  extractTACode,
} from '../../services/devicePermitService';
import { A7DeviceSticker } from '../../components/stickers/A7DeviceSticker';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  ShieldCheck,
  Printer,
  FileText,
  Search,
  ExternalLink,
  Laptop,
  CheckCircle2,
  Clock,
  QrCode,
  Building2,
  Edit,
  XCircle,
  AlertTriangle,
  Layers,
  Save,
  CheckSquare,
  Square,
  Wifi,
  Trash2,
  RefreshCw,
  Eye,
  Plus,
  HelpCircle,
} from 'lucide-react';
import { MacAddressGuideModal } from '../../components/stickers/MacAddressGuideModal';
import { toast } from 'sonner';

export function AdminDevicePermits() {
  const [permits, setPermits] = useState<DevicePermitStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<'ALL' | SchoolUnit>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | PermitStatus>('ALL');
  const [selectedField, setSelectedField] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Modals & Preview States
  const [previewStudent, setPreviewStudent] = useState<DevicePermitStudent | null>(null);
  const [editingPermit, setEditingPermit] = useState<DevicePermitStudent | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<PermitStatus>('APPROVED');
  const [bulkAcademicYear, setBulkAcademicYear] = useState('2026/2027');
  const [bulkDeviceName, setBulkDeviceName] = useState('');
  const [bulkDeviceIpPrefix, setBulkDeviceIpPrefix] = useState('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Create Student Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPermit, setNewPermit] = useState({
    name: '',
    unit: 'SMA' as SchoolUnit,
    grade: '10',
    osnField: 'Matematika',
    gender: 'L' as 'L' | 'P',
    status: 'APPROVED' as PermitStatus,
    deviceName: '',
    deviceIp: '',
    deviceMac: '',
    notes: '',
    academicYear: '2026/2027',
  });
  const [isCreating, setIsCreating] = useState(false);

  // Load permits from Firestore / memory
  const loadPermits = async () => {
    setLoading(true);
    try {
      const data = await getAllDevicePermits(true);
      setPermits(data);
    } catch (err) {
      console.error('Error loading permits:', err);
      toast.error('Gagal memuat data izin perangkat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermits();
  }, []);

  // Filtered dataset
  const filteredPermits = useMemo(() => {
    return permits.filter(p => {
      if (selectedUnit !== 'ALL' && p.unit !== selectedUnit) return false;
      if (selectedStatus !== 'ALL' && (p.status || 'APPROVED') !== selectedStatus) return false;
      if (selectedField !== 'ALL' && p.osnField !== selectedField) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.regNumber || '').toLowerCase().includes(q) ||
          p.grade.toLowerCase().includes(q) ||
          (p.deviceName || '').toLowerCase().includes(q) ||
          (p.deviceIp || '').toLowerCase().includes(q) ||
          p.osnField.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [permits, selectedUnit, selectedStatus, selectedField, search]);

  // Unique OSN fields for dropdown
  const allFields = useMemo(() => {
    const set = new Set<string>();
    permits.forEach(p => set.add(p.osnField));
    return Array.from(set).sort();
  }, [permits]);

  // Stats
  const smpCount = useMemo(() => permits.filter(p => p.unit === 'SMP').length, [permits]);
  const smaCount = useMemo(() => permits.filter(p => p.unit === 'SMA').length, [permits]);
  const approvedCount = useMemo(() => permits.filter(p => (p.status || 'APPROVED') === 'APPROVED').length, [permits]);
  const dueCount = useMemo(() => permits.filter(p => p.status === 'DUE').length, [permits]);
  const rejectedCount = useMemo(() => permits.filter(p => p.status === 'REJECTED').length, [permits]);

  // Selection handlers
  const isAllSelected = filteredPermits.length > 0 && selectedIds.length === filteredPermits.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPermits.map(p => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Single edit submit
  const handleSaveSingleEdit = async () => {
    if (!editingPermit) return;
    setIsSavingEdit(true);
    try {
      const updated = await updateDevicePermit(editingPermit.id, {
        name: editingPermit.name,
        grade: editingPermit.grade,
        osnField: editingPermit.osnField,
        unit: editingPermit.unit,
        status: editingPermit.status,
        academicYear: editingPermit.academicYear,
        regNumber: editingPermit.regNumber,
        deviceName: editingPermit.deviceName,
        deviceMac: editingPermit.deviceMac || editingPermit.deviceIp || '',
        deviceIp: editingPermit.deviceIp,
        notes: editingPermit.notes,
        rules: editingPermit.rules,
      });

      setPermits(prev => prev.map(p => (p.id === updated.id ? updated : p)));
      toast.success(`Data perizinan ${updated.name} berhasil diperbarui!`);
      setEditingPermit(null);
    } catch (err: any) {
      console.error('Error saving permit edit:', err);
      toast.error(err.message || 'Gagal menyimpan perubahan');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Create new student permit
  const handleCreateStudentPermit = async () => {
    if (!newPermit.name.trim()) {
      toast.error('Nama siswa wajib diisi');
      return;
    }
    setIsCreating(true);
    try {
      const created = await createDevicePermit({
        ...newPermit,
        name: newPermit.name.trim(),
        grade: newPermit.grade.trim() || '10',
        osnField: newPermit.osnField.trim() || 'Umum',
      });
      setPermits(prev => {
        const next = [...prev, created];
        next.sort((a, b) => a.regNumber.localeCompare(b.regNumber));
        return next;
      });
      toast.success(`Berhasil mendaftarkan siswa ${created.name} ke daftar izin device!`);
      setIsCreateOpen(false);
      setNewPermit({
        name: '',
        unit: 'SMA',
        grade: '10',
        osnField: 'Matematika',
        gender: 'L',
        status: 'APPROVED',
        deviceName: '',
        deviceIp: '',
        deviceMac: '',
        notes: '',
        academicYear: '2026/2027',
      });
    } catch (err: any) {
      console.error('Error creating permit:', err);
      toast.error(err.message || 'Gagal menambahkan siswa');
    } finally {
      setIsCreating(false);
    }
  };

  // Delete permit
  const handleDeletePermit = async (permitId: string, studentName: string) => {
    if (!confirm(`Hapus perizinan device untuk ${studentName}?`)) return;
    try {
      await deleteDevicePermit(permitId);
      setPermits(prev => prev.filter(p => p.id !== permitId));
      setSelectedIds(prev => prev.filter(id => id !== permitId));
      if (editingPermit?.id === permitId) setEditingPermit(null);
      toast.success(`Data perizinan ${studentName} berhasil dihapus.`);
    } catch (err) {
      toast.error('Gagal menghapus data izin');
    }
  };

  // Bulk status update
  const handleBulkStatusChange = async (newStatus: PermitStatus) => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await bulkUpdateDevicePermits(selectedIds, { status: newStatus });
      setPermits(prev =>
        prev.map(p => (selectedIds.includes(p.id) ? { ...p, status: newStatus } : p))
      );
      toast.success(`Berhasil mengubah status ${selectedIds.length} siswa menjadi ${newStatus}!`);
      setSelectedIds([]);
    } catch (err) {
      toast.error('Gagal memperbarui status secara massal');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Bulk edit submit
  const handleSaveBulkEdit = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const updates: Partial<DevicePermitStudent> = {};
      if (bulkStatus) updates.status = bulkStatus;
      if (bulkAcademicYear.trim()) {
        updates.academicYear = bulkAcademicYear.trim();
        updates.academicYearCode = extractTACode(bulkAcademicYear.trim());
      }
      if (bulkDeviceName.trim()) {
        updates.deviceName = bulkDeviceName.trim();
      }

      await bulkUpdateDevicePermits(selectedIds, updates);

      // Reload permits to ensure proper Reg Number updates
      await loadPermits();
      toast.success(`Berhasil memperbarui data ${selectedIds.length} siswa secara massal!`);
      setIsBulkEditOpen(false);
      setSelectedIds([]);
    } catch (err) {
      toast.error('Gagal memperbarui data massal');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Print handlers
  const handlePrintAllSheets = () => {
    toast.info('Menyiapkan lembar cetak stiker A4 (8 stiker per halaman)...');
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const handlePrintSelectedOnly = () => {
    if (selectedIds.length === 0) {
      toast.error('Pilih siswa yang ingin dicetak terlebih dahulu');
      return;
    }
    toast.info(`Menyiapkan cetak ${selectedIds.length} stiker terpilih...`);
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const handlePrintSingle = (student: DevicePermitStudent) => {
    setPreviewStudent(student);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Permits to print in sheet mode
  const permitsToPrint = useMemo(() => {
    if (selectedIds.length > 0) {
      return permits.filter(p => selectedIds.includes(p.id));
    }
    return filteredPermits;
  }, [selectedIds, permits, filteredPermits]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              SK Izin Web & Device Resmi 2026/2027
            </span>
            <span className="text-xs text-muted-foreground">{permits.length} Siswa Terdaftar</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Manajemen Izin Device & Stiker A7
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola status izin (Approved, Rejected, Due), IP/Jenis perangkat, cetak per nama atau cetak massal A4.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-3.5 font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa ke Izin</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsGuideOpen(true)}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs h-9 px-3.5 font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            <span>Tutorial Cek MAC / ID Device</span>
          </Button>

          <Button
            onClick={handlePrintAllSheets}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-3.5 font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Lembar A4 ({filteredPermits.length} Stiker)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadPermits}
            className="h-9 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
            title="Muat ulang dari server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <a href={PDF_FILES.SMP.url} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="h-9 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              <FileText className="w-3.5 h-3.5 mr-1" />
              <span>PDF SMP</span>
            </Button>
          </a>

          <a href={PDF_FILES.SMA.url} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="h-9 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <FileText className="w-3.5 h-3.5 mr-1" />
              <span>PDF SMA</span>
            </Button>
          </a>
        </div>
      </div>

      {/* Rules Summary Banner */}
      <Card className="border-indigo-100 bg-linear-to-r from-indigo-50/70 via-slate-50 to-emerald-50/70 shadow-xs print:hidden">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-slate-900 block font-bold">Durasi Izin Resmi</strong>
                <span className="text-slate-600 text-[11px] block mt-0.5">
                  • 07.00 - 16.00 (EduOS Camp)<br/>
                  • 14.35 - 17.00 (Sore)<br/>
                  • 19.30 - 21.30 (Malam)
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                <Laptop className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-slate-900 block font-bold">Akses & Status Izin</strong>
                <span className="text-slate-600 text-[11px] block mt-0.5">
                  • Web: Google AI Studio, WA Web<br/>
                  • Status: <strong className="text-emerald-700">Approved ({approvedCount})</strong>, <strong className="text-amber-700">Due ({dueCount})</strong>, <strong className="text-red-700">Rejected ({rejectedCount})</strong>
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                <Wifi className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-slate-900 block font-bold">IP & Jenis Perangkat</strong>
                <span className="text-slate-600 text-[11px] block mt-0.5">
                  IP Device & Nama Laptop tercantum di kartu. Disertai peringatan lapor koordinator jika disalahgunakan.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-slate-900 block font-bold">No. Reg TA (2627)</strong>
                <span className="text-slate-600 text-[11px] block mt-0.5">
                  Format no reg otomatis memuat kode TA: <strong>SMP-2627-001</strong> / <strong>SMA-2627-001</strong>.
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter & Search Ribbon */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
        {/* Unit and Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Unit Tabs */}
          <div className="flex items-center bg-muted p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setSelectedUnit('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedUnit === 'ALL' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Semua ({permits.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedUnit('SMP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedUnit === 'SMP' ? 'bg-background shadow-xs text-indigo-700 font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              SMP Semesta ({smpCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedUnit('SMA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedUnit === 'SMA' ? 'bg-background shadow-xs text-emerald-700 font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              SMA Semesta ({smaCount})
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center bg-muted/80 p-1 rounded-xl text-xs shrink-0">
            <button
              type="button"
              onClick={() => setSelectedStatus('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                selectedStatus === 'ALL' ? 'bg-background shadow-xs font-bold text-foreground' : 'text-muted-foreground'
              }`}
            >
              Semua ({permits.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('APPROVED')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                selectedStatus === 'APPROVED' ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-700'
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('REJECTED')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                selectedStatus === 'REJECTED' ? 'bg-rose-600 text-white font-bold' : 'text-rose-700'
              }`}
            >
              Belum Ada Izin ({rejectedCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('DUE')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                selectedStatus === 'DUE' ? 'bg-amber-600 text-white font-bold' : 'text-amber-700'
              }`}
            >
              Due ({dueCount})
            </button>
          </div>
        </div>

        {/* Search & Field Select */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari siswa, no reg, jenis device, IP..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <select
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
            className="h-9 px-2.5 bg-background border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">Semua Bidang OSN</option>
            {allFields.map(f => (
              <option key={f} value={f}>
                OSN {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* BULK ACTION BAR (Visible when 1 or more rows selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-linear-to-r from-indigo-900 to-purple-900 text-white p-3.5 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 print:hidden">
          <div className="flex items-center gap-3">
            <span className="bg-white/20 text-white font-bold text-xs px-2.5 py-1 rounded-full">
              {selectedIds.length} Siswa Terpilih
            </span>
            <span className="text-xs text-indigo-200 hidden sm:inline">
              Aksi Massal (Bulk Action) untuk perizinan siswa terpilih:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleBulkStatusChange('APPROVED')}
              disabled={isBulkProcessing}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Set Approved
            </Button>

            <Button
              size="sm"
              onClick={() => handleBulkStatusChange('DUE')}
              disabled={isBulkProcessing}
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              Set Due
            </Button>

            <Button
              size="sm"
              onClick={() => handleBulkStatusChange('REJECTED')}
              disabled={isBulkProcessing}
              className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Set Rejected
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsBulkEditOpen(true)}
              className="h-8 text-xs border-indigo-300 bg-white/10 hover:bg-white/20 text-white"
            >
              <Edit className="w-3.5 h-3.5 mr-1" />
              Edit Device & TA Massal
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handlePrintSelectedOnly}
              className="h-8 text-xs border-amber-300 text-amber-300 hover:bg-amber-400/20"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Cetak {selectedIds.length} Stiker
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              className="h-8 text-xs text-indigo-300 hover:text-white hover:bg-white/10"
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {/* Standard Table View */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-xs print:hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-10 text-center">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Pilih semua yang difilter"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </TableHead>
              <TableHead className="w-32 text-xs">No. Reg (TA)</TableHead>
              <TableHead className="text-xs">Nama Siswa</TableHead>
              <TableHead className="text-xs">Unit & Kelas</TableHead>
              <TableHead className="text-xs">Bidang OSN</TableHead>
              <TableHead className="text-xs">Device & MAC/ID</TableHead>
              <TableHead className="text-xs">Status Izin</TableHead>
              <TableHead className="text-right text-xs">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPermits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-xs text-muted-foreground">
                  Tidak ada data siswa yang cocok dengan filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredPermits.map((student) => {
                const isSelected = selectedIds.includes(student.id);
                const verifyUrl = getVerificationUrl(student);
                const status = student.status || 'APPROVED';

                return (
                  <TableRow
                    key={student.id}
                    className={`text-xs hover:bg-muted/30 transition-colors ${
                      isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelectOne(student.id)}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10.5px] py-0.5 px-2 font-bold bg-slate-50">
                        {student.regNumber || student.id}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-bold text-foreground">
                      {student.name}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-1.5 font-bold ${
                            student.unit === 'SMP'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {student.unit}
                        </Badge>
                        <span className="font-semibold text-slate-700">Kelas {student.grade}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="font-semibold text-indigo-700">OSN {student.osnField}</span>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-0.5 text-[11px]">
                        <div className="flex items-center gap-1 font-medium text-slate-800 truncate max-w-[170px]" title={student.deviceName}>
                          <Laptop className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{student.deviceName || 'Laptop / Tablet'}</span>
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                          <Wifi className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                          <span>{student.deviceMac || student.deviceIp || '-'}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {status === 'APPROVED' && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] py-0.5 px-2 font-bold flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Approved</span>
                        </Badge>
                      )}
                      {status === 'DUE' && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] py-0.5 px-2 font-bold flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Due (Habis)</span>
                        </Badge>
                      )}
                      {status === 'REJECTED' && (
                        <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] py-0.5 px-2 font-bold flex items-center gap-1 w-fit">
                          <XCircle className="w-3 h-3 text-red-600" />
                          <span>Rejected</span>
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingPermit({ ...student })}
                          className="h-7 w-7 p-0 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                          title="Edit Izin & Device"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewStudent(student)}
                          className="h-7 text-[11px] px-2 font-medium flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-indigo-600" />
                          <span className="hidden sm:inline">Stiker</span>
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handlePrintSingle(student)}
                          className="h-7 text-[11px] px-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1"
                          title="Cetak A7 Satuan"
                        >
                          <Printer className="w-3 h-3" />
                        </Button>

                        <a href={verifyUrl} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600" title="Buka Link Verifikasi Publik">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* SINGLE EDIT MODAL */}
      {editingPermit && (
        <Dialog open={Boolean(editingPermit)} onOpenChange={() => setEditingPermit(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader className="pb-3 border-b">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-600" />
                <span>Edit Perizinan Device - {editingPermit.name}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3 text-xs">
              {/* Nama Siswa */}
              <div className="sm:col-span-2">
                <label className="font-semibold text-foreground block mb-1">Nama Lengkap Siswa</label>
                <Input
                  value={editingPermit.name}
                  onChange={(e) => setEditingPermit({ ...editingPermit, name: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              {/* Status Izin */}
              <div>
                <label className="font-semibold text-foreground block mb-1">Status Izin</label>
                <select
                  value={editingPermit.status}
                  onChange={(e) => setEditingPermit({ ...editingPermit, status: e.target.value as PermitStatus })}
                  className="w-full h-8 px-2 bg-background border rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="APPROVED">APPROVED (Diizinkan / Aktif)</option>
                  <option value="DUE">DUE (Masa Izin Telah Habis)</option>
                  <option value="REJECTED">REJECTED (Ditolak / Dicabut)</option>
                </select>
              </div>

              {/* Tahun Ajaran */}
              <div>
                <label className="font-semibold text-foreground block mb-1">Tahun Ajaran (TA)</label>
                <Input
                  value={editingPermit.academicYear || '2026/2027'}
                  onChange={(e) => {
                    const ta = e.target.value;
                    const code = extractTACode(ta);
                    const numPart = editingPermit.regNumber?.split('-').pop() || '001';
                    setEditingPermit({
                      ...editingPermit,
                      academicYear: ta,
                      academicYearCode: code,
                      regNumber: `${editingPermit.unit}-${code}-${numPart}`,
                    });
                  }}
                  placeholder="2026/2027"
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Kode TA: <strong>{editingPermit.academicYearCode || '2627'}</strong>
                </span>
              </div>

              {/* No. Registrasi */}
              <div>
                <label className="font-semibold text-foreground block mb-1">No. Registrasi (di Kartu)</label>
                <Input
                  value={editingPermit.regNumber}
                  onChange={(e) => setEditingPermit({ ...editingPermit, regNumber: e.target.value })}
                  placeholder="SMP-2627-001"
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              {/* Unit & Kelas */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Unit</label>
                  <select
                    value={editingPermit.unit}
                    onChange={(e) => {
                      const u = e.target.value as SchoolUnit;
                      const numPart = editingPermit.regNumber?.split('-').pop() || '001';
                      const code = editingPermit.academicYearCode || '2627';
                      setEditingPermit({
                        ...editingPermit,
                        unit: u,
                        regNumber: `${u}-${code}-${numPart}`,
                      });
                    }}
                    className="w-full h-8 px-2 bg-background border rounded-lg text-xs"
                  >
                    <option value="SMP">SMP Semesta</option>
                    <option value="SMA">SMA Semesta</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">Kelas</label>
                  <Input
                    value={editingPermit.grade}
                    onChange={(e) => setEditingPermit({ ...editingPermit, grade: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Bidang OSN */}
              <div>
                <label className="font-semibold text-foreground block mb-1">Bidang OSN</label>
                <Input
                  value={editingPermit.osnField}
                  onChange={(e) => setEditingPermit({ ...editingPermit, osnField: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              {/* Nama / Jenis Device */}
              <div>
                <label className="font-semibold text-foreground block mb-1">Nama / Jenis Device</label>
                <Input
                  value={editingPermit.deviceName || ''}
                  onChange={(e) => setEditingPermit({ ...editingPermit, deviceName: e.target.value })}
                  placeholder="Contoh: Laptop Asus Vivobook / iPad"
                  className="h-8 text-xs"
                />
              </div>

              {/* MAC / ID Device */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-foreground">
                    MAC Address / ID Unik Device <span className="text-muted-foreground font-normal">(Opsional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsGuideOpen(true)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Tutorial Cek MAC</span>
                  </button>
                </div>
                <Input
                  value={editingPermit.deviceMac ?? editingPermit.deviceIp ?? ''}
                  onChange={(e) => setEditingPermit({ ...editingPermit, deviceMac: e.target.value, deviceIp: e.target.value })}
                  placeholder="Contoh: A4:C3:F0:89:12:DE atau No Seri (Boleh Kosong)"
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Masa Berlaku */}
              <div>
                <label className="font-semibold text-foreground block mb-1">Masa Berlaku Izin</label>
                <Input
                  value={editingPermit.rules.validityPeriod}
                  onChange={(e) =>
                    setEditingPermit({
                      ...editingPermit,
                      rules: { ...editingPermit.rules, validityPeriod: e.target.value },
                    })
                  }
                  placeholder="Oktober 2026 - Mei 2027"
                  className="h-8 text-xs"
                />
              </div>

              {/* Catatan / Keterangan Khusus */}
              <div className="sm:col-span-2">
                <label className="font-semibold text-foreground block mb-1">Catatan Tambahan (Opsional)</label>
                <Input
                  value={editingPermit.notes || ''}
                  onChange={(e) => setEditingPermit({ ...editingPermit, notes: e.target.value })}
                  placeholder="Catatan dari koordinator SOS / pembina..."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t flex items-center justify-between sm:justify-between w-full">
              <Button
                variant="ghost"
                onClick={() => handleDeletePermit(editingPermit.id, editingPermit.name)}
                className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Izin</span>
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setEditingPermit(null)} className="h-8 text-xs">
                  Batal
                </Button>
                <Button
                  onClick={handleSaveSingleEdit}
                  disabled={isSavingEdit}
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* BULK EDIT DIALOG */}
      {isBulkEditOpen && (
        <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
          <DialogContent className="sm:max-w-md p-6">
            <DialogHeader className="pb-3 border-b">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>Edit Massal ({selectedIds.length} Siswa Terpilih)</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">Ubah Status Massal</label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as PermitStatus)}
                  className="w-full h-8 px-2 bg-background border rounded-lg text-xs font-bold"
                >
                  <option value="APPROVED">APPROVED (Diizinkan / Aktif)</option>
                  <option value="DUE">DUE (Masa Izin Telah Habis)</option>
                  <option value="REJECTED">REJECTED (Ditolak / Dicabut)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Set Tahun Ajaran (TA)</label>
                <Input
                  value={bulkAcademicYear}
                  onChange={(e) => setBulkAcademicYear(e.target.value)}
                  placeholder="2026/2027"
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Akan memperbarui kode TA menjadi <strong>{extractTACode(bulkAcademicYear)}</strong>
                </span>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Set Jenis Device Default (Opsional)</label>
                <Input
                  value={bulkDeviceName}
                  onChange={(e) => setBulkDeviceName(e.target.value)}
                  placeholder="Contoh: Laptop & Tablet Belajar"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button variant="ghost" onClick={() => setIsBulkEditOpen(false)} className="h-8 text-xs">
                Batal
              </Button>
              <Button
                onClick={handleSaveBulkEdit}
                disabled={isBulkProcessing}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                {isBulkProcessing ? 'Memproses...' : 'Terapkan ke Siswa Terpilih'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* SINGLE PREVIEW DIALOG */}
      {previewStudent && (
        <Dialog open={Boolean(previewStudent)} onOpenChange={() => setPreviewStudent(null)}>
          <DialogContent className="sm:max-w-xl p-6">
            <DialogHeader className="pb-3 border-b">
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span>Stiker A7 - {previewStudent.name}</span>
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {previewStudent.regNumber || previewStudent.id}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 flex flex-col items-center justify-center bg-slate-100 rounded-xl p-4">
              <A7DeviceSticker permit={previewStudent} showActions={true} />
            </div>

            <div className="pt-2 text-xs text-slate-600 space-y-1">
              <p>• <strong>Ukuran Fisik:</strong> 105 mm × 74 mm (Standar A7)</p>
              <p>• <strong>No. Registrasi:</strong> <span className="font-mono font-bold text-slate-900">{previewStudent.regNumber || previewStudent.id}</span> (Kode TA: {previewStudent.academicYearCode || '2627'})</p>
              <p>• <strong>QR Code:</strong> Mengarah ke halaman verifikasi resmi tanpa login (<span className="font-mono text-indigo-600">{getVerificationUrl(previewStudent)}</span>)</p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* CREATE STUDENT PERMIT DIALOG */}
      {isCreateOpen && (
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-xl p-6">
            <DialogHeader className="pb-3 border-b">
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Tambah Siswa ke Daftar Izin Device</span>
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  TA {newPermit.academicYear}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 py-3 text-xs">
              <div className="sm:col-span-2">
                <label className="font-semibold text-foreground block mb-1">Nama Lengkap Siswa *</label>
                <Input
                  value={newPermit.name}
                  onChange={(e) => setNewPermit({ ...newPermit, name: e.target.value })}
                  placeholder="Masukkan nama lengkap siswa..."
                  className="h-8 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Unit Sekolah</label>
                <select
                  value={newPermit.unit}
                  onChange={(e) => setNewPermit({ ...newPermit, unit: e.target.value as SchoolUnit })}
                  className="w-full h-8 px-2 bg-background border rounded-lg text-xs"
                >
                  <option value="SMA">SMA Semesta</option>
                  <option value="SMP">SMP Semesta</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Kelas</label>
                <Input
                  value={newPermit.grade}
                  onChange={(e) => setNewPermit({ ...newPermit, grade: e.target.value })}
                  placeholder="Contoh: 10A, 8B"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Bidang OSN</label>
                <Input
                  value={newPermit.osnField}
                  onChange={(e) => setNewPermit({ ...newPermit, osnField: e.target.value })}
                  placeholder="Contoh: Matematika, Fisika, IPA..."
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Status Izin Awal</label>
                <select
                  value={newPermit.status}
                  onChange={(e) => setNewPermit({ ...newPermit, status: e.target.value as PermitStatus })}
                  className="w-full h-8 px-2 bg-background border rounded-lg text-xs font-bold"
                >
                  <option value="APPROVED">APPROVED (Berizin Resmi)</option>
                  <option value="REJECTED">REJECTED (Belum Ada Izin)</option>
                  <option value="DUE">DUE (Masa Habis)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Nama / Jenis Device (Opsional)</label>
                <Input
                  value={newPermit.deviceName}
                  onChange={(e) => setNewPermit({ ...newPermit, deviceName: e.target.value })}
                  placeholder="Contoh: Laptop Asus Vivobook / iPad"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-foreground">
                    MAC Address / ID Unik Device <span className="text-muted-foreground font-normal">(Opsional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsGuideOpen(true)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Tutorial Cek MAC</span>
                  </button>
                </div>
                <Input
                  value={newPermit.deviceMac || newPermit.deviceIp}
                  onChange={(e) => setNewPermit({ ...newPermit, deviceMac: e.target.value, deviceIp: e.target.value })}
                  placeholder="Contoh: A4:C3:F0:89:12:DE atau No Seri (Boleh Kosong)"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-foreground block mb-1">Catatan Tambahan (Opsional)</label>
                <Input
                  value={newPermit.notes}
                  onChange={(e) => setNewPermit({ ...newPermit, notes: e.target.value })}
                  placeholder="Keterangan dari tim pembina..."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="h-8 text-xs">
                Batal
              </Button>
              <Button
                onClick={handleCreateStudentPermit}
                disabled={isCreating}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCreating ? 'Mendaftarkan...' : 'Daftarkan Siswa'}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* PRINT STICKER SHEET CONTAINER (Visible during window.print()) */}
      {/* 
        A4 Layout: 210mm x 297mm.
        A7 Sticker: 105mm x 74mm.
        Exactly 2 columns x 4 rows = 8 stickers per A4 page!
      */}
      <div className="hidden print:block print:w-full print:m-0 print:p-0">
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 4mm;
            }
            body {
              background: #ffffff !important;
              color: #000000 !important;
              font-family: sans-serif !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .sticker-sheet-grid {
              display: grid !important;
              grid-template-columns: repeat(2, 105mm) !important;
              grid-auto-rows: 74mm !important;
              gap: 0px !important;
              justify-content: center !important;
              page-break-after: always;
            }
            .sticker-card {
              box-shadow: none !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        `}</style>

        <div className="sticker-sheet-grid">
          {previewStudent ? (
            <div className="flex items-center justify-center p-1">
              <A7DeviceSticker permit={previewStudent} showActions={false} />
            </div>
          ) : (
            permitsToPrint.map(student => (
              <div key={student.id} className="flex items-center justify-center p-0.5">
                <A7DeviceSticker permit={student} showActions={false} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* TUTORIAL MAC ADDRESS / ID DEVICE MODAL */}
      <MacAddressGuideModal open={isGuideOpen} onOpenChange={setIsGuideOpen} />
    </div>
  );
}
