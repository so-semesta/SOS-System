import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  getAllDevicePermits,
  updateDevicePermit,
  bulkUpdateDevicePermits,
  bulkUpdateIndividualPermits,
  createDevicePermit,
  deleteDevicePermit,
  getDevicePermitLetters,
  getPermitLettersCache,
  subscribeToDevicePermitLetters,
  uploadDevicePermitPdfFile,
  saveDevicePermitPdfUrl,
  resetDevicePermitPdfToDefault,
  DevicePermitStudent,
  DevicePermitLetter,
  SchoolUnit,
  PermitStatus,
  getVerificationUrl,
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
  X,
  Upload,
  RotateCcw,
  Link2,
  Loader2,
  Download,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { MacAddressGuideModal } from '../../components/stickers/MacAddressGuideModal';
import { toast } from 'sonner';

type PermitSortField = 'regNumber' | 'name' | 'unitGrade' | 'osnField' | 'deviceName' | 'deviceMac' | 'status';
type SortDirection = 'asc' | 'desc';

export function AdminDevicePermits() {
  const [permits, setPermits] = useState<DevicePermitStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<'ALL' | SchoolUnit>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | PermitStatus>('ALL');
  const [selectedField, setSelectedField] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<PermitSortField>('regNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Modals & Preview States
  const [previewStudent, setPreviewStudent] = useState<DevicePermitStudent | null>(null);
  const [editingPermit, setEditingPermit] = useState<DevicePermitStudent | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkTab, setBulkTab] = useState<'individual' | 'uniform'>('individual');
  const [bulkStatus, setBulkStatus] = useState<'NO_CHANGE' | PermitStatus>('NO_CHANGE');
  const [bulkAcademicYear, setBulkAcademicYear] = useState('');
  const [bulkDeviceName, setBulkDeviceName] = useState('');
  const [bulkMacMode, setBulkMacMode] = useState<'no_change' | 'set_value' | 'clear'>('no_change');
  const [bulkDeviceMac, setBulkDeviceMac] = useState('');
  const [bulkIndividualRows, setBulkIndividualRows] = useState<
    Array<{ id: string; regNumber: string; name: string; unit: SchoolUnit; grade: string; osnField: string; deviceName: string; deviceMac: string }>
  >([]);
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

  // Official PDF Management States (SMP & SMA)
  const [permitLetters, setPermitLetters] = useState<Record<SchoolUnit, DevicePermitLetter>>(() =>
    getPermitLettersCache()
  );
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [uploadingUnit, setUploadingUnit] = useState<SchoolUnit | null>(null);
  const [urlInputUnit, setUrlInputUnit] = useState<Record<SchoolUnit, string>>({ SMP: '', SMA: '' });
  const [showUrlMode, setShowUrlMode] = useState<Record<SchoolUnit, boolean>>({ SMP: false, SMA: false });
  const smpFileInputRef = useRef<HTMLInputElement>(null);
  const smaFileInputRef = useRef<HTMLInputElement>(null);

  // Load permits from Firestore / memory
  const loadPermits = async () => {
    setLoading(true);
    try {
      const [data, letters] = await Promise.all([
        getAllDevicePermits(true),
        getDevicePermitLetters(true),
      ]);
      setPermits(data);
      setPermitLetters(letters);
    } catch (err) {
      console.error('Error loading permits:', err);
      toast.error('Gagal memuat data izin perangkat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermits();
    const unsubLetters = subscribeToDevicePermitLetters((updatedLetters) => {
      setPermitLetters(updatedLetters);
    });
    return () => unsubLetters();
  }, []);

  const handleUploadUnitPdf = async (unit: SchoolUnit, file?: File) => {
    if (!file) return;
    setUploadingUnit(unit);
    try {
      const updated = await uploadDevicePermitPdfFile(unit, file);
      setPermitLetters(prev => ({ ...prev, [unit]: updated }));
      toast.success(`PDF Surat Izin ${unit} (${updated.fileName}) berhasil diperbarui!`);
    } catch (err: any) {
      toast.error(err?.message || `Gagal mengunggah PDF ${unit}`);
    } finally {
      setUploadingUnit(null);
      if (unit === 'SMP' && smpFileInputRef.current) smpFileInputRef.current.value = '';
      if (unit === 'SMA' && smaFileInputRef.current) smaFileInputRef.current.value = '';
    }
  };

  const handleSaveUnitPdfUrl = async (unit: SchoolUnit) => {
    const rawUrl = urlInputUnit[unit]?.trim();
    if (!rawUrl) {
      toast.error('Masukkan link PDF terlebih dahulu');
      return;
    }
    setUploadingUnit(unit);
    try {
      const updated = await saveDevicePermitPdfUrl(unit, rawUrl);
      setPermitLetters(prev => ({ ...prev, [unit]: updated }));
      setShowUrlMode(prev => ({ ...prev, [unit]: false }));
      setUrlInputUnit(prev => ({ ...prev, [unit]: '' }));
      toast.success(`Link PDF Surat Izin ${unit} berhasil disimpan!`);
    } catch (err: any) {
      toast.error(err?.message || `Gagal menyimpan link PDF ${unit}`);
    } finally {
      setUploadingUnit(null);
    }
  };

  const handleResetUnitPdf = async (unit: SchoolUnit) => {
    setUploadingUnit(unit);
    try {
      const resetDoc = await resetDevicePermitPdfToDefault(unit);
      setPermitLetters(prev => ({ ...prev, [unit]: resetDoc }));
      toast.success(`PDF Surat Izin ${unit} dikembalikan ke surat bawaan.`);
    } catch (err: any) {
      toast.error(err?.message || `Gagal mereset PDF ${unit}`);
    } finally {
      setUploadingUnit(null);
    }
  };

  const handleToggleSort = (field: PermitSortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtered & sorted dataset
  const filteredPermits = useMemo(() => {
    const filtered = permits.filter(p => {
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
          (p.deviceMac || '').toLowerCase().includes(q) ||
          (p.deviceIp || '').toLowerCase().includes(q) ||
          p.osnField.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'regNumber':
          cmp = (a.regNumber || a.id).localeCompare(b.regNumber || b.id, 'id', { numeric: true, sensitivity: 'base' });
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
          break;
        case 'unitGrade': {
          const unitCmp = a.unit.localeCompare(b.unit, 'id');
          cmp = unitCmp !== 0
            ? unitCmp
            : (a.grade || '').localeCompare(b.grade || '', 'id', { numeric: true, sensitivity: 'base' });
          break;
        }
        case 'osnField':
          cmp = (a.osnField || '').localeCompare(b.osnField || '', 'id', { sensitivity: 'base' });
          break;
        case 'deviceName':
          cmp = (a.deviceName || '').localeCompare(b.deviceName || '', 'id', { sensitivity: 'base' });
          break;
        case 'deviceMac': {
          const macA = (a.deviceMac || a.deviceIp || '').trim();
          const macB = (b.deviceMac || b.deviceIp || '').trim();
          if (!macA && macB) return 1;
          if (macA && !macB) return -1;
          cmp = macA.localeCompare(macB, 'id', { sensitivity: 'base' });
          break;
        }
        case 'status':
          cmp = (a.status || 'APPROVED').localeCompare(b.status || 'APPROVED', 'id');
          break;
      }
      if (cmp !== 0) return cmp * dir;
      return (a.regNumber || a.id).localeCompare(b.regNumber || b.id, 'id', { numeric: true });
    });
  }, [permits, selectedUnit, selectedStatus, selectedField, search, sortField, sortDirection]);

  const buildExportFileStamp = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const unitTag = selectedUnit === 'ALL' ? 'SemuaUnit' : selectedUnit;
    const statusTag = selectedStatus === 'ALL' ? 'SemuaStatus' : selectedStatus;
    return `${unitTag}_${statusTag}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  };

  const getStatusExportLabel = (status?: PermitStatus) => {
    const s = status || 'APPROVED';
    if (s === 'APPROVED') return 'APPROVED';
    if (s === 'DUE') return 'DUE (Habis)';
    return 'REJECTED (Belum Ada Izin)';
  };

  const handleExportCsv = (rowsToExport: DevicePermitStudent[] = filteredPermits) => {
    if (rowsToExport.length === 0) {
      toast.error('Tidak ada data izin device untuk diekspor.');
      return;
    }

    const headers = [
      'No',
      'No. Registrasi (TA)',
      'Tahun Ajaran',
      'Nama Lengkap Siswa',
      'Jenis Kelamin',
      'Unit',
      'Kelas',
      'Bidang OSN',
      'Nama / Jenis Device',
      'MAC Address / ID Unik',
      'Status Izin',
      'Masa Berlaku',
      'Catatan',
      'Link Verifikasi QR',
    ];

    const escapeCsv = (val: unknown) => {
      const str = String(val ?? '').replace(/\r?\n/g, ' ').trim();
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvRows = rowsToExport.map((s, idx) =>
      [
        idx + 1,
        s.regNumber || s.id,
        s.academicYear || '2026/2027',
        s.name,
        s.gender === 'P' ? 'Perempuan' : 'Laki-laki',
        s.unit,
        s.grade,
        `OSN ${s.osnField}`,
        s.deviceName || '-',
        s.deviceMac || s.deviceIp || '-',
        getStatusExportLabel(s.status),
        s.rules?.validityPeriod || 'Oktober 2026 - Mei 2027',
        s.notes || '-',
        getVerificationUrl(s),
      ]
        .map(escapeCsv)
        .join(';')
    );

    const csvContent = '\uFEFF' + headers.map(escapeCsv).join(';') + '\n' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Izin_Device_SOS_${buildExportFileStamp()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Berhasil mengekspor ${rowsToExport.length} data izin device ke CSV.`);
  };

  const handleExportExcel = (rowsToExport: DevicePermitStudent[] = filteredPermits) => {
    if (rowsToExport.length === 0) {
      toast.error('Tidak ada data izin device untuk diekspor.');
      return;
    }

    const escapeHtml = (val: unknown) =>
      String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const tableRowsHtml = rowsToExport
      .map((s, idx) => {
        const macValue = s.deviceMac || s.deviceIp || '-';
        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td style="mso-number-format:'\\@';font-weight:bold;">${escapeHtml(s.regNumber || s.id)}</td>
            <td style="mso-number-format:'\\@';">${escapeHtml(s.academicYear || '2026/2027')}</td>
            <td>${escapeHtml(s.name)}</td>
            <td style="text-align:center;">${s.gender === 'P' ? 'Perempuan' : 'Laki-laki'}</td>
            <td style="text-align:center;">${escapeHtml(s.unit)}</td>
            <td style="mso-number-format:'\\@';text-align:center;">${escapeHtml(s.grade)}</td>
            <td>${escapeHtml(`OSN ${s.osnField}`)}</td>
            <td>${escapeHtml(s.deviceName || '-')}</td>
            <td style="mso-number-format:'\\@';font-family:monospace;">${escapeHtml(macValue)}</td>
            <td style="font-weight:bold;">${escapeHtml(getStatusExportLabel(s.status))}</td>
            <td>${escapeHtml(s.rules?.validityPeriod || 'Oktober 2026 - Mei 2027')}</td>
            <td>${escapeHtml(s.notes || '-')}</td>
            <td>${escapeHtml(getVerificationUrl(s))}</td>
          </tr>`;
      })
      .join('');

    const htmlWorkbook = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Izin Device SOS</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; }
  th { background-color: #312e81; color: #ffffff; font-weight: bold; text-align: center; }
</style>
</head>
<body>
  <table>
    <thead>
      <tr>
        <th>No</th>
        <th>No. Registrasi (TA)</th>
        <th>Tahun Ajaran</th>
        <th>Nama Lengkap Siswa</th>
        <th>Jenis Kelamin</th>
        <th>Unit</th>
        <th>Kelas</th>
        <th>Bidang OSN</th>
        <th>Nama / Jenis Device</th>
        <th>MAC Address / ID Unik</th>
        <th>Status Izin</th>
        <th>Masa Berlaku</th>
        <th>Catatan</th>
        <th>Link Verifikasi QR</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>
</body>
</html>`;

    const blob = new Blob(['\uFEFF' + htmlWorkbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Izin_Device_SOS_${buildExportFileStamp()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Berhasil mengekspor ${rowsToExport.length} data izin device ke Excel (.xls).`);
  };

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
        deviceName: editingPermit.deviceName ?? '',
        deviceMac: editingPermit.deviceMac ?? '',
        deviceIp: editingPermit.deviceMac !== undefined ? editingPermit.deviceMac : (editingPermit.deviceIp ?? ''),
        notes: editingPermit.notes ?? '',
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

  // Open Bulk Edit Modal
  const openBulkEditModal = (initialTab: 'individual' | 'uniform' = 'individual') => {
    const selectedPermits = permits.filter(p => selectedIds.includes(p.id));
    setBulkIndividualRows(
      selectedPermits.map(p => ({
        id: p.id,
        regNumber: p.regNumber,
        name: p.name,
        unit: p.unit,
        grade: p.grade,
        osnField: p.osnField,
        deviceName: p.deviceName || '',
        deviceMac: p.deviceMac || p.deviceIp || '',
      }))
    );
    setBulkTab(initialTab);
    setBulkStatus('NO_CHANGE');
    setBulkAcademicYear('');
    setBulkDeviceName('');
    setBulkMacMode('no_change');
    setBulkDeviceMac('');
    setIsBulkEditOpen(true);
  };

  // Bulk edit submit (Uniform mode)
  const handleSaveBulkEdit = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const updates: Partial<DevicePermitStudent> = {};
      if (bulkStatus !== 'NO_CHANGE') updates.status = bulkStatus;
      if (bulkAcademicYear.trim()) {
        updates.academicYear = bulkAcademicYear.trim();
        updates.academicYearCode = extractTACode(bulkAcademicYear.trim());
      }
      if (bulkDeviceName.trim()) {
        updates.deviceName = bulkDeviceName.trim();
      }
      if (bulkMacMode === 'set_value') {
        const macVal = bulkDeviceMac.trim();
        updates.deviceMac = macVal;
        updates.deviceIp = macVal;
      } else if (bulkMacMode === 'clear') {
        updates.deviceMac = '';
        updates.deviceIp = '';
      }

      if (Object.keys(updates).length === 0) {
        toast.info('Pilih minimal satu kolom perubahan terlebih dahulu');
        setIsBulkProcessing(false);
        return;
      }

      await bulkUpdateDevicePermits(selectedIds, updates);

      // Reload permits to ensure proper sync
      await loadPermits();
      toast.success(`Berhasil memperbarui data ${selectedIds.length} siswa secara massal!`);
      setIsBulkEditOpen(false);
      setSelectedIds([]);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memperbarui data massal');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Bulk edit submit (Individual Per-Student MAC & Device mode)
  const handleSaveBulkIndividual = async () => {
    if (bulkIndividualRows.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const entries = bulkIndividualRows.map(row => ({
        id: row.id,
        updates: {
          deviceName: row.deviceName.trim(),
          deviceMac: row.deviceMac.trim(),
          deviceIp: row.deviceMac.trim(),
        },
      }));

      await bulkUpdateIndividualPermits(entries);
      await loadPermits();
      toast.success(`Berhasil menyimpan Nama Device & MAC Address untuk ${entries.length} siswa!`);
      setIsBulkEditOpen(false);
      setSelectedIds([]);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan data MAC Address massal');
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPdfModalOpen(true)}
            className="h-9 text-xs border-purple-200 bg-purple-50/70 text-purple-700 hover:bg-purple-100 font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Upload ulang atau kelola PDF Surat Izin SMP & SMA"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload PDF SMP/SMA</span>
          </Button>

          <a href={permitLetters.SMP.url} target="_blank" rel="noreferrer" title={permitLetters.SMP.fileName}>
            <Button variant="outline" size="sm" className="h-9 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 cursor-pointer">
              <FileText className="w-3.5 h-3.5 mr-1" />
              <span>PDF SMP</span>
            </Button>
          </a>

          <a href={permitLetters.SMA.url} target="_blank" rel="noreferrer" title={permitLetters.SMA.fileName}>
            <Button variant="outline" size="sm" className="h-9 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer">
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

        {/* Search, Field, Sort & Export */}
        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari siswa, no reg, jenis device, MAC..."
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

          <div className="flex items-center gap-1">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as PermitSortField)}
              title="Urutkan berdasarkan"
              className="h-9 px-2.5 bg-background border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="regNumber">Urut: No. Reg</option>
              <option value="name">Urut: Nama Siswa</option>
              <option value="unitGrade">Urut: Unit &amp; Kelas</option>
              <option value="osnField">Urut: Bidang OSN</option>
              <option value="deviceName">Urut: Nama Device</option>
              <option value="deviceMac">Urut: MAC Address</option>
              <option value="status">Urut: Status Izin</option>
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="h-9 px-2 text-xs border-slate-300 cursor-pointer"
              title={sortDirection === 'asc' ? 'Urutan Naik (A-Z / Kecil-Besar)' : 'Urutan Turun (Z-A / Besar-Kecil)'}
            >
              {sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv()}
              className="h-9 text-xs border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Ekspor data hasil sortir & urutan saat ini ke file CSV"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>CSV ({filteredPermits.length})</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExportExcel()}
              className="h-9 text-xs border-emerald-300 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Ekspor data hasil sortir & urutan saat ini ke file Excel (.xls)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Excel ({filteredPermits.length})</span>
            </Button>
          </div>
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
              onClick={() => openBulkEditModal('individual')}
              className="h-8 text-xs border-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 text-white font-bold cursor-pointer"
            >
              <Wifi className="w-3.5 h-3.5 mr-1 text-emerald-300" />
              Input MAC &amp; Device Massal
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => openBulkEditModal('uniform')}
              className="h-8 text-xs border-indigo-300 bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5 mr-1" />
              Edit Status &amp; TA Massal
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
              variant="outline"
              onClick={() => handleExportExcel(permits.filter(p => selectedIds.includes(p.id)))}
              className="h-8 text-xs border-emerald-300 text-emerald-200 hover:bg-emerald-500/20 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
              Excel ({selectedIds.length})
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExportCsv(permits.filter(p => selectedIds.includes(p.id)))}
              className="h-8 text-xs border-slate-300 text-slate-100 hover:bg-white/10 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              CSV ({selectedIds.length})
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
              <TableHead className="w-32 text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleSort('regNumber')}
                  className="inline-flex items-center gap-1 hover:text-indigo-600 cursor-pointer font-semibold"
                >
                  <span>No. Reg (TA)</span>
                  {sortField === 'regNumber' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </button>
              </TableHead>
              <TableHead className="text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleSort('name')}
                  className="inline-flex items-center gap-1 hover:text-indigo-600 cursor-pointer font-semibold"
                >
                  <span>Nama Siswa</span>
                  {sortField === 'name' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </button>
              </TableHead>
              <TableHead className="text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleSort('unitGrade')}
                  className="inline-flex items-center gap-1 hover:text-indigo-600 cursor-pointer font-semibold"
                >
                  <span>Unit &amp; Kelas</span>
                  {sortField === 'unitGrade' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </button>
              </TableHead>
              <TableHead className="text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleSort('osnField')}
                  className="inline-flex items-center gap-1 hover:text-indigo-600 cursor-pointer font-semibold"
                >
                  <span>Bidang OSN</span>
                  {sortField === 'osnField' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </button>
              </TableHead>
              <TableHead className="text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleSort('deviceMac')}
                  className="inline-flex items-center gap-1 hover:text-indigo-600 cursor-pointer font-semibold"
                >
                  <span>Device &amp; MAC/ID</span>
                  {sortField === 'deviceMac' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </button>
              </TableHead>
              <TableHead className="text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleSort('status')}
                  className="inline-flex items-center gap-1 hover:text-indigo-600 cursor-pointer font-semibold"
                >
                  <span>Status Izin</span>
                  {sortField === 'status' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </button>
              </TableHead>
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

      {/* BULK EDIT DIALOG (Dual Mode: Individual MAC/Device Table + Uniform Batch Update) */}
      {isBulkEditOpen && (
        <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-6">
            <DialogHeader className="pb-3 border-b shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <span>Edit Massal ({selectedIds.length} Siswa Terpilih)</span>
                </DialogTitle>
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer mr-4"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Tutorial Cek MAC</span>
                </button>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setBulkTab('individual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    bulkTab === 'individual'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>1. Input MAC &amp; Device (Per Siswa)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBulkTab('uniform')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    bulkTab === 'uniform'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>2. Ubah Serentak (Status / TA / Kosongkan)</span>
                </button>
              </div>
            </DialogHeader>

            {/* TAB 1: INDIVIDUAL PER-STUDENT QUICK MAC & DEVICE ENTRY */}
            {bulkTab === 'individual' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs bg-indigo-50/70 dark:bg-indigo-950/20 px-3 rounded-xl border border-indigo-200 dark:border-indigo-900 mt-2 shrink-0">
                  <span className="text-indigo-950 dark:text-indigo-200 text-[11px]">
                    Isi atau tempel <strong>Nama Device</strong> dan <strong>MAC Address / ID Unik</strong> masing-masing siswa di bawah lalu simpan sekaligus.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setBulkIndividualRows(prev =>
                        prev.map(r => ({ ...r, deviceMac: '' }))
                      )
                    }
                    className="h-7 text-[11px] border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer shrink-0"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Kosongkan Semua MAC
                  </Button>
                </div>

                <div className="overflow-y-auto flex-1 border rounded-xl mt-2">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/70 sticky top-0 z-10 border-b">
                      <tr className="text-left text-[11px] font-bold text-muted-foreground">
                        <th className="py-2.5 px-3">Siswa</th>
                        <th className="py-2.5 px-3">Nama / Jenis Device</th>
                        <th className="py-2.5 px-3">MAC Address / ID Unik (Opsional)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bulkIndividualRows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="py-2 px-3 align-middle">
                            <div className="font-bold text-foreground">{row.name}</div>
                            <div className="text-[10.5px] text-muted-foreground font-mono">
                              {row.regNumber} • {row.unit} {row.grade}
                            </div>
                          </td>
                          <td className="py-2 px-3 align-middle">
                            <Input
                              value={row.deviceName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBulkIndividualRows(prev =>
                                  prev.map((item, i) => (i === idx ? { ...item, deviceName: val } : item))
                                );
                              }}
                              placeholder="Contoh: Laptop Asus / iPad"
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="py-2 px-3 align-middle">
                            <div className="flex items-center gap-1">
                              <Input
                                value={row.deviceMac}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBulkIndividualRows(prev =>
                                    prev.map((item, i) => (i === idx ? { ...item, deviceMac: val } : item))
                                  );
                                }}
                                placeholder="EC:3A:56:1D:CE:B8 atau kosong"
                                className="h-8 text-xs font-mono"
                              />
                              {row.deviceMac && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setBulkIndividualRows(prev =>
                                      prev.map((item, i) => (i === idx ? { ...item, deviceMac: '' } : item))
                                    )
                                  }
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 shrink-0"
                                  title="Kosongkan MAC baris ini"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <DialogFooter className="pt-3 border-t shrink-0">
                  <Button variant="ghost" onClick={() => setIsBulkEditOpen(false)} className="h-8 text-xs">
                    Batal
                  </Button>
                  <Button
                    onClick={handleSaveBulkIndividual}
                    disabled={isBulkProcessing}
                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    {isBulkProcessing ? 'Menyimpan...' : `Simpan MAC & Device (${bulkIndividualRows.length} Siswa)`}
                  </Button>
                </DialogFooter>
              </>
            )}

            {/* TAB 2: UNIFORM BATCH UPDATE */}
            {bulkTab === 'uniform' && (
              <>
                <div className="space-y-3.5 py-3 text-xs overflow-y-auto">
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Ubah Status Massal (Opsional)</label>
                    <select
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value as 'NO_CHANGE' | PermitStatus)}
                      className="w-full h-8 px-2 bg-background border rounded-lg text-xs font-bold"
                    >
                      <option value="NO_CHANGE">-- Tidak Diubah --</option>
                      <option value="APPROVED">APPROVED (Diizinkan / Aktif)</option>
                      <option value="DUE">DUE (Masa Izin Telah Habis)</option>
                      <option value="REJECTED">REJECTED (Ditolak / Dicabut)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-foreground block mb-1">Set Tahun Ajaran (TA) — Kosongkan jika tetap</label>
                    <Input
                      value={bulkAcademicYear}
                      onChange={(e) => setBulkAcademicYear(e.target.value)}
                      placeholder="Contoh: 2026/2027 (biarkan kosong jika tidak diubah)"
                      className="h-8 text-xs font-mono"
                    />
                    {bulkAcademicYear.trim() && (
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        Akan memperbarui kode TA menjadi <strong>{extractTACode(bulkAcademicYear)}</strong>
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="font-semibold text-foreground block mb-1">Set Jenis Device Default — Kosongkan jika tetap</label>
                    <Input
                      value={bulkDeviceName}
                      onChange={(e) => setBulkDeviceName(e.target.value)}
                      placeholder="Contoh: Laptop & Tablet Belajar"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40 border space-y-2">
                    <label className="font-semibold text-foreground block">
                      Pengaturan Massal MAC Address / ID Unik Device
                    </label>
                    <select
                      value={bulkMacMode}
                      onChange={(e) => setBulkMacMode(e.target.value as 'no_change' | 'set_value' | 'clear')}
                      className="w-full h-8 px-2 bg-background border rounded-lg text-xs font-semibold"
                    >
                      <option value="no_change">-- Tidak Diubah (Biarkan Data Saat Ini) --</option>
                      <option value="set_value">Isi MAC Address / ID yang Sama untuk Semua Terpilih</option>
                      <option value="clear">Kosongkan MAC Address &amp; IP Semua Siswa Terpilih</option>
                    </select>

                    {bulkMacMode === 'set_value' && (
                      <Input
                        value={bulkDeviceMac}
                        onChange={(e) => setBulkDeviceMac(e.target.value)}
                        placeholder="Masukkan MAC Address / ID Unik..."
                        className="h-8 text-xs font-mono"
                      />
                    )}
                    {bulkMacMode === 'clear' && (
                      <p className="text-[11px] text-rose-600 font-medium">
                        Semua MAC Address &amp; IP lama milik {selectedIds.length} siswa terpilih akan dihapus menjadi kosong (-).
                      </p>
                    )}
                  </div>
                </div>

                <DialogFooter className="pt-3 border-t shrink-0">
                  <Button variant="ghost" onClick={() => setIsBulkEditOpen(false)} className="h-8 text-xs">
                    Batal
                  </Button>
                  <Button
                    onClick={handleSaveBulkEdit}
                    disabled={isBulkProcessing}
                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    {isBulkProcessing ? 'Memproses...' : 'Terapkan ke Siswa Terpilih'}
                  </Button>
                </DialogFooter>
              </>
            )}
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

      {/* UPLOAD & KELOLA PDF SURAT IZIN SMP / SMA MODAL */}
      {isPdfModalOpen && (
        <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader className="pb-3 border-b">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <span>Upload Ulang PDF Surat Izin Device (SMP &amp; SMA)</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Dokumen PDF yang diunggah di sini langsung berlaku untuk panel Management, Portal Siswa, dan halaman Verifikasi QR Publik.
              </p>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {(['SMP', 'SMA'] as SchoolUnit[]).map((unit) => {
                const letter = permitLetters[unit];
                const isSMP = unit === 'SMP';
                const isUploading = uploadingUnit === unit;
                const inputRef = isSMP ? smpFileInputRef : smaFileInputRef;
                const sizeText =
                  letter.sizeBytes && letter.sizeBytes > 0
                    ? letter.sizeBytes >= 1024 * 1024
                      ? `${(letter.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
                      : `${Math.round(letter.sizeBytes / 1024)} KB`
                    : null;

                return (
                  <div
                    key={unit}
                    className={`rounded-xl border p-4 flex flex-col gap-3 ${
                      isSMP
                        ? 'border-indigo-200 bg-indigo-50/30'
                        : 'border-emerald-200 bg-emerald-50/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`text-xs font-bold uppercase tracking-wide ${
                            isSMP ? 'text-indigo-700' : 'text-emerald-700'
                          }`}
                        >
                          Surat Izin {unit} Semesta
                        </span>
                        <p className="text-xs font-semibold text-foreground mt-0.5 break-all">
                          {letter.fileName}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {letter.sourceType === 'upload'
                            ? 'Diunggah Management'
                            : letter.sourceType === 'url'
                              ? 'Link Eksternal'
                              : 'Surat Bawaan Sistem'}
                          {sizeText ? ` · ${sizeText}` : ''}
                          {letter.date ? ` · ${letter.date}` : ''}
                        </p>
                      </div>

                      <a href={letter.url} target="_blank" rel="noreferrer">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] bg-white cursor-pointer shrink-0"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Lihat
                        </Button>
                      </a>
                    </div>

                    <input
                      ref={inputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadUnitPdf(unit, file);
                      }}
                    />

                    {/* Drag/Drop & Click Upload Box */}
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer?.files?.[0];
                        if (file) handleUploadUnitPdf(unit, file);
                      }}
                      className="rounded-lg border-2 border-dashed border-slate-300 bg-white/90 p-3.5 text-center space-y-2"
                    >
                      <Button
                        type="button"
                        disabled={isUploading}
                        onClick={() => inputRef.current?.click()}
                        className={`w-full h-9 text-xs font-semibold text-white cursor-pointer ${
                          isSMP
                            ? 'bg-indigo-600 hover:bg-indigo-700'
                            : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            <span>Mengunggah PDF {unit}...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            <span>Pilih / Upload Ulang PDF {unit}</span>
                          </>
                        )}
                      </Button>
                      <p className="text-[11px] text-muted-foreground">
                        Atau seret file <strong>.pdf</strong> ke kotak ini (maks. 6 MB)
                      </p>
                    </div>

                    {/* Alternative External Link Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setShowUrlMode(prev => ({ ...prev, [unit]: !prev[unit] }))
                          }
                          className="text-[11px] font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>{showUrlMode[unit] ? 'Tutup Input Link' : 'Atau Pakai Link PDF (Google Drive/URL)'}</span>
                        </button>

                        {letter.sourceType !== 'default' && (
                          <button
                            type="button"
                            disabled={isUploading}
                            onClick={() => handleResetUnitPdf(unit)}
                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset Bawaan</span>
                          </button>
                        )}
                      </div>

                      {showUrlMode[unit] && (
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={urlInputUnit[unit]}
                            onChange={(e) =>
                              setUrlInputUnit(prev => ({ ...prev, [unit]: e.target.value }))
                            }
                            placeholder="https://drive.google.com/file/d/..."
                            className="h-8 text-xs bg-white"
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={isUploading}
                            onClick={() => handleSaveUnitPdfUrl(unit)}
                            className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white shrink-0 cursor-pointer"
                          >
                            Simpan
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button variant="outline" onClick={() => setIsPdfModalOpen(false)} className="h-8 text-xs">
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
