import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';
import { getAllStudents } from '../../services/studentService';
import {
  getAllApprovedRegistrationsForRecap,
  getAllArchivedCompetitions,
  getAllCompetitions,
} from '../../services/competitionService';
import { getAllAchievements } from '../../services/achievementService';
import { getAllStudentCvAchievements } from '../../services/cvAchievementService';
import { Competition, MedalType } from '../../types';
import { getFriendlyDisplayName } from '../../lib/utils';
import {
  AchievementSource,
  buildStudentAchievementSummaries,
  downloadStudentAchievementCsv,
  downloadStudentsAchievementRecapCsv,
  printStudentAchievementCV,
  printStudentsAchievementRecap,
  RecapStudentProfile,
  StudentAchievementSummary,
  UnifiedAchievementRow,
} from '../../lib/cvPrintUtils';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import {
  Award,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
} from 'lucide-react';

export function AchievementsRecap() {
  const { userRole } = useAuth();
  const isRoleLocked = userRole === UserRole.ADMIN_SOS || userRole === UserRole.ADMIN_STUDENT;
  const initialRoleFilter = userRole === UserRole.ADMIN_STUDENT ? 'STUDENT' : 'SOS';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allSummaries, setAllSummaries] = useState<StudentAchievementSummary[]>([]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(initialRoleFilter);
  const [sourceFilter, setSourceFilter] = useState<'ALL' | AchievementSource>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [medalFilter, setMedalFilter] = useState<string>('ALL');
  const [onlyWithRecords, setOnlyWithRecords] = useState<boolean>(false);

  const [selectedStudent, setSelectedStudent] = useState<StudentAchievementSummary | null>(null);

  useEffect(() => {
    setRoleFilter(userRole === UserRole.ADMIN_STUDENT ? 'STUDENT' : 'SOS');
  }, [userRole]);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      let rolesToFetch: string[] = [UserRole.SOS, UserRole.STUDENT];
      if (userRole === UserRole.ADMIN_SOS) rolesToFetch = [UserRole.SOS];
      else if (userRole === UserRole.ADMIN_STUDENT) rolesToFetch = [UserRole.STUDENT];

      const usersQuery = query(collection(db, 'users'), where('role', 'in', rolesToFetch));

      const [
        usersSnap,
        studentProfiles,
        approvedRegs,
        activeComps,
        archivedComps,
        achievements,
        cvAchievements,
      ] = await Promise.all([
        getDocs(usersQuery),
        getAllStudents(),
        getAllApprovedRegistrationsForRecap(),
        getAllCompetitions(),
        getAllArchivedCompetitions().catch(() => [] as Competition[]),
        getAllAchievements().catch(() => []),
        getAllStudentCvAchievements(),
      ]);

      const profileByUid = new Map(studentProfiles.map((p) => [p.userId, p]));
      const studentMap = new Map<string, RecapStudentProfile>();

      usersSnap.docs.forEach((docSnap) => {
        const u = docSnap.data() as Record<string, any>;
        const profile = profileByUid.get(docSnap.id);
        const fullName = getFriendlyDisplayName(
          profile?.fullName || u.name,
          u.email,
          'Siswa'
        );
        studentMap.set(docSnap.id, {
          userId: docSnap.id,
          fullName,
          email: profile?.semestaEmail || profile?.activeEmail || u.email || '-',
          nisn: profile?.nisn || '-',
          grade: profile?.grade || '-',
          osnField: profile?.osnField || '-',
          role: String(u.role || UserRole.STUDENT),
        });
      });

      const studentsList = Array.from(studentMap.values()).sort((a, b) =>
        a.fullName.localeCompare(b.fullName, 'id')
      );

      const competitionsMap = new Map<string, Competition>();
      archivedComps.forEach((c) => competitionsMap.set(c.id, c));
      activeComps.forEach((c) => competitionsMap.set(c.id, c));

      const { summaries } = buildStudentAchievementSummaries({
        students: studentsList,
        registrations: approvedRegs,
        competitionsMap,
        achievements,
        cvAchievements,
      });

      setAllSummaries(summaries);
    } catch (err) {
      console.error('Failed to load achievement recap:', err);
      setLoadError('Gagal memuat data rekap prestasi siswa.');
      toast.error('Gagal memuat data rekap prestasi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userRole]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allSummaries.forEach((s) => {
      s.unifiedRows.forEach((r) => {
        if (r.year && Number.isFinite(r.year)) years.add(r.year);
      });
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allSummaries]);

  const matchRowFilters = (row: UnifiedAchievementRow): boolean => {
    if (sourceFilter !== 'ALL' && row.source !== sourceFilter) return false;
    if (yearFilter !== 'ALL' && String(row.year) !== yearFilter) return false;
    if (medalFilter !== 'ALL') {
      if (medalFilter === 'REGISTERED_ONLY') {
        if (row.medalType) return false;
      } else if (row.medalType !== medalFilter) {
        return false;
      }
    }
    return true;
  };

  const { filteredSummaries, filteredRows } = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    const summariesOut: StudentAchievementSummary[] = [];
    const rowsOut: UnifiedAchievementRow[] = [];

    allSummaries.forEach((s) => {
      if (userRole === UserRole.ADMIN_SOS && s.role !== UserRole.SOS) return;
      if (userRole === UserRole.ADMIN_STUDENT && s.role !== UserRole.STUDENT) return;
      if (!isRoleLocked && roleFilter !== 'ALL' && s.role !== roleFilter) return;

      const studentMetaMatches =
        !queryText ||
        s.fullName.toLowerCase().includes(queryText) ||
        s.nisn.toLowerCase().includes(queryText) ||
        s.grade.toLowerCase().includes(queryText) ||
        s.osnField.toLowerCase().includes(queryText);

      const matchedRows = s.unifiedRows.filter((row) => {
        if (!matchRowFilters(row)) return false;
        if (!queryText) return true;
        if (studentMetaMatches) return true;
        return (
          row.competitionTitle.toLowerCase().includes(queryText) ||
          row.organizerOrLocation.toLowerCase().includes(queryText) ||
          row.field.toLowerCase().includes(queryText)
        );
      });

      const hasAchievementFilter =
        sourceFilter !== 'ALL' || yearFilter !== 'ALL' || medalFilter !== 'ALL';

      if (onlyWithRecords && matchedRows.length === 0) return;
      if (hasAchievementFilter && matchedRows.length === 0) return;
      if (queryText && !studentMetaMatches && matchedRows.length === 0) return;

      const filteredCounts = {
        officialTotal: matchedRows.filter((r) => r.source === 'RESMI_SOS').length,
        manualTotal: matchedRows.filter((r) => r.source === 'MANUAL_CV').length,
        totalAll: matchedRows.length,
        gold: matchedRows.filter((r) => r.medalType === MedalType.GOLD).length,
        silver: matchedRows.filter((r) => r.medalType === MedalType.SILVER).length,
        bronze: matchedRows.filter((r) => r.medalType === MedalType.BRONZE).length,
        finals: matchedRows.filter((r) => r.medalType === MedalType.FINALS).length,
        participantOrRegistered: matchedRows.filter(
          (r) => !r.medalType || r.medalType === MedalType.PARTICIPANT
        ).length,
      };

      summariesOut.push({
        ...s,
        unifiedRows: matchedRows,
        counts: filteredCounts,
      });

      rowsOut.push(...matchedRows);
    });

    rowsOut.sort(
      (a, b) =>
        b.year - a.year ||
        b.sortTimestamp - a.sortTimestamp ||
        a.studentName.localeCompare(b.studentName, 'id')
    );

    return { filteredSummaries: summariesOut, filteredRows: rowsOut };
  }, [
    allSummaries,
    userRole,
    isRoleLocked,
    roleFilter,
    sourceFilter,
    yearFilter,
    medalFilter,
    onlyWithRecords,
    search,
  ]);

  const summaryByStudentId = useMemo(() => {
    return new Map(allSummaries.map((s) => [s.studentId, s]));
  }, [allSummaries]);

  const kpis = useMemo(() => {
    const official = filteredRows.filter((r) => r.source === 'RESMI_SOS').length;
    const manual = filteredRows.filter((r) => r.source === 'MANUAL_CV').length;
    const gold = filteredRows.filter((r) => r.medalType === MedalType.GOLD).length;
    const silver = filteredRows.filter((r) => r.medalType === MedalType.SILVER).length;
    const bronze = filteredRows.filter((r) => r.medalType === MedalType.BRONZE).length;
    return {
      studentsCount: filteredSummaries.length,
      official,
      manual,
      gold,
      silver,
      bronze,
    };
  }, [filteredSummaries, filteredRows]);

  const filterSummaryText = useMemo(() => {
    const parts: string[] = [];
    if (isRoleLocked) {
      parts.push(userRole === UserRole.ADMIN_SOS ? 'Program: SOS' : 'Program: Reguler');
    } else {
      parts.push(
        roleFilter === 'ALL'
          ? 'Program: Semua Siswa'
          : roleFilter === 'SOS'
          ? 'Program: Siswa SOS'
          : 'Program: Siswa Reguler'
      );
    }
    parts.push(
      sourceFilter === 'ALL'
        ? 'Sumber: Resmi SOS + Manual CV'
        : sourceFilter === 'RESMI_SOS'
        ? 'Sumber: Resmi SOS'
        : 'Sumber: Manual CV'
    );
    if (yearFilter !== 'ALL') parts.push(`Tahun: ${yearFilter}`);
    if (medalFilter !== 'ALL') parts.push(`Capaian: ${medalFilter}`);
    if (search.trim()) parts.push(`Pencarian: "${search.trim()}"`);
    return parts.join(' · ');
  }, [isRoleLocked, userRole, roleFilter, sourceFilter, yearFilter, medalFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Rekap Prestasi &amp; CV Siswa
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cetak CV lengkap per siswa maupun unduh rekap prestasi gabungan dari lomba resmi SOS dan portofolio manual siswa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="whitespace-nowrap shrink-0"
            disabled={loading || filteredRows.length === 0}
            onClick={() =>
              downloadStudentsAchievementRecapCsv(filteredRows, filteredSummaries, 'DETAIL')
            }
          >
            <Download className="w-4 h-4 mr-2" />
            Download Rekap Detail (.csv)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="whitespace-nowrap shrink-0"
            disabled={loading || filteredSummaries.length === 0}
            onClick={() =>
              downloadStudentsAchievementRecapCsv(filteredRows, filteredSummaries, 'SUMMARY')
            }
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Ringkasan Siswa (.csv)
          </Button>
          <Button
            type="button"
            size="sm"
            className="whitespace-nowrap shrink-0"
            disabled={loading || (filteredRows.length === 0 && filteredSummaries.length === 0)}
            onClick={() =>
              printStudentsAchievementRecap(filteredSummaries, filteredRows, filterSummaryText)
            }
          >
            <Printer className="w-4 h-4 mr-2" />
            Cetak / PDF Rekap
          </Button>
        </div>
      </div>

      {/* 4-Card KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Siswa Tercakup</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {loading ? '—' : kpis.studentsCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Sesuai filter aktif saat ini</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Riwayat Resmi SOS</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {loading ? '—' : kpis.official}
          </div>
          <div className="text-xs text-slate-500 mt-1">Pendaftaran disetujui sistem</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Portofolio Manual CV</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {loading ? '—' : kpis.manual}
          </div>
          <div className="text-xs text-slate-500 mt-1">Prestasi eksternal / lampau siswa</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Perolehan Medali (E / P / Pr)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {loading ? '—' : `${kpis.gold} / ${kpis.silver} / ${kpis.bronze}`}
          </div>
          <div className="text-xs text-slate-500 mt-1">Gabungan prestasi resmi &amp; manual</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Cari nama siswa, NISN, lomba, penyelenggara..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {!isRoleLocked && (
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Program Siswa">
                  {roleFilter === 'SOS'
                    ? 'Siswa SOS'
                    : roleFilter === 'STUDENT'
                    ? 'Siswa Reguler'
                    : 'Semua Siswa'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SOS">Siswa SOS</SelectItem>
                <SelectItem value="ALL">Semua Siswa</SelectItem>
                <SelectItem value="STUDENT">Siswa Reguler</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as 'ALL' | AchievementSource)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sumber Prestasi">
                {sourceFilter === 'ALL'
                  ? 'Semua Sumber'
                  : sourceFilter === 'RESMI_SOS'
                  ? 'Hanya Resmi SOS'
                  : 'Hanya Manual CV'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Sumber</SelectItem>
              <SelectItem value="RESMI_SOS">Hanya Resmi SOS</SelectItem>
              <SelectItem value="MANUAL_CV">Hanya Manual CV</SelectItem>
            </SelectContent>
          </Select>

          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tahun">
                {yearFilter === 'ALL' ? 'Semua Tahun' : `Tahun ${yearFilter}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Tahun</SelectItem>
              {availableYears.map((yr) => (
                <SelectItem key={yr} value={String(yr)}>
                  {yr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={medalFilter} onValueChange={setMedalFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Capaian">
                {medalFilter === 'ALL'
                  ? 'Semua Capaian'
                  : medalFilter === MedalType.GOLD
                  ? 'Medali Emas'
                  : medalFilter === MedalType.SILVER
                  ? 'Medali Perak'
                  : medalFilter === MedalType.BRONZE
                  ? 'Medali Perunggu'
                  : medalFilter === MedalType.FINALS
                  ? 'Finalis / HM'
                  : medalFilter === MedalType.PARTICIPANT
                  ? 'Peserta / Partisipan'
                  : 'Terdaftar / Proses'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Capaian</SelectItem>
              <SelectItem value={MedalType.GOLD}>Medali Emas</SelectItem>
              <SelectItem value={MedalType.SILVER}>Medali Perak</SelectItem>
              <SelectItem value={MedalType.BRONZE}>Medali Perunggu</SelectItem>
              <SelectItem value={MedalType.FINALS}>Finalis / Honorable Mention</SelectItem>
              <SelectItem value={MedalType.PARTICIPANT}>Peserta / Partisipan</SelectItem>
              <SelectItem value="REGISTERED_ONLY">Terdaftar / Proses Lomba</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={onlyWithRecords}
              onChange={(e) => setOnlyWithRecords(e.target.checked)}
            />
            Hanya tampilkan siswa yang sudah memiliki catatan lomba / prestasi
          </label>
          <span className="text-xs text-slate-500 tabular-nums">
            {filteredSummaries.length} siswa · {filteredRows.length} entri prestasi
          </span>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-800">{loadError}</p>
          <Button type="button" size="sm" variant="outline" onClick={loadData}>
            Muat Ulang
          </Button>
        </div>
      )}

      <Tabs defaultValue="per-student" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="per-student" className="whitespace-nowrap shrink-0">
            Rekap Per Siswa ({filteredSummaries.length})
          </TabsTrigger>
          <TabsTrigger value="all-achievements" className="whitespace-nowrap shrink-0">
            Semua Daftar Prestasi ({filteredRows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="per-student">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Siswa</TableHead>
                  <TableHead className="text-right">Resmi SOS</TableHead>
                  <TableHead className="text-right">Manual CV</TableHead>
                  <TableHead className="text-right">Medali (E/P/Pr)</TableHead>
                  <TableHead className="text-right">Total Catatan</TableHead>
                  <TableHead className="text-right">Aksi CV &amp; Unduh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-slate-500">
                      Memuat rekap prestasi siswa...
                    </TableCell>
                  </TableRow>
                ) : filteredSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-slate-500">
                      Tidak ada siswa yang sesuai dengan filter saat ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSummaries.map((s) => {
                    const fullStudentSummary = summaryByStudentId.get(s.studentId) || s;
                    return (
                      <TableRow key={s.studentId} className="hover:bg-slate-50/70">
                        <TableCell>
                          <div className="font-semibold text-slate-900">{s.fullName}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {s.role === UserRole.SOS ? 'SOS' : 'Reguler'}
                            <span aria-hidden="true"> · </span>
                            Kelas {s.grade}
                            <span aria-hidden="true"> · </span>
                            {s.osnField}
                            {s.nisn !== '-' ? (
                              <>
                                <span aria-hidden="true"> · </span>
                                NISN {s.nisn}
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {s.counts.officialTotal}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {s.counts.manualTotal}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {s.counts.gold} / {s.counts.silver} / {s.counts.bronze}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-slate-900">
                          {s.counts.totalAll}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="whitespace-nowrap shrink-0 h-8 px-2.5 text-xs"
                              onClick={() => setSelectedStudent(fullStudentSummary)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1.5" />
                              Detail
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="whitespace-nowrap shrink-0 h-8 px-2.5 text-xs"
                              onClick={() => printStudentAchievementCV(fullStudentSummary)}
                            >
                              <Printer className="w-3.5 h-3.5 mr-1.5" />
                              Cetak CV
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="whitespace-nowrap shrink-0 h-8 px-2.5 text-xs"
                              disabled={fullStudentSummary.unifiedRows.length === 0}
                              onClick={() => downloadStudentAchievementCsv(fullStudentSummary)}
                            >
                              <Download className="w-3.5 h-3.5 mr-1.5" />
                              CSV
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="all-achievements">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Siswa</TableHead>
                  <TableHead>Kompetisi &amp; Penyelenggara</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead>Bidang &amp; Tingkat</TableHead>
                  <TableHead>Capaian</TableHead>
                  <TableHead className="text-right">Waktu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-slate-500">
                      Memuat daftar prestasi...
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-slate-500">
                      Belum ada prestasi yang sesuai dengan filter saat ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-slate-50/70">
                      <TableCell>
                        <div className="font-medium text-slate-900">{row.studentName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Kelas {row.studentGrade} · {row.studentField}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{row.competitionTitle}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {row.organizerOrLocation}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700 whitespace-nowrap">
                        {row.source === 'MANUAL_CV' ? 'Manual CV' : 'Resmi SOS'}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-slate-800">{row.field}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{row.levelOrCuration}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold text-slate-900">
                          {row.achievementLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {row.dateText}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Student CV Preview Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          {selectedStudent && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-xl text-slate-900">
                  CV &amp; Daftar Prestasi: {selectedStudent.fullName}
                </DialogTitle>
                <div className="text-xs text-slate-500 pt-1">
                  {selectedStudent.role === UserRole.SOS ? 'Siswa SOS' : 'Siswa Reguler'}
                  <span aria-hidden="true"> · </span>
                  Kelas {selectedStudent.grade}
                  <span aria-hidden="true"> · </span>
                  {selectedStudent.osnField}
                  {selectedStudent.nisn !== '-' ? (
                    <>
                      <span aria-hidden="true"> · </span>
                      NISN {selectedStudent.nisn}
                    </>
                  ) : null}
                </div>
              </DialogHeader>

              <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 py-3">
                <div className="text-xs text-slate-600 tabular-nums">
                  Total {selectedStudent.counts.totalAll} catatan ({selectedStudent.counts.officialTotal} Resmi SOS · {selectedStudent.counts.manualTotal} Manual CV)
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="whitespace-nowrap shrink-0"
                    disabled={selectedStudent.unifiedRows.length === 0}
                    onClick={() => downloadStudentAchievementCsv(selectedStudent)}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Download CSV
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="whitespace-nowrap shrink-0"
                    onClick={() => printStudentAchievementCV(selectedStudent)}
                  >
                    <Printer className="w-4 h-4 mr-1.5" />
                    Cetak CV / Simpan PDF
                  </Button>
                </div>
              </div>

              {/* Section 1: Official SOS */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-slate-600" />
                  1. Riwayat Lomba Resmi SOS ({selectedStudent.counts.officialTotal})
                </h3>
                {selectedStudent.counts.officialTotal === 0 ? (
                  <p className="text-xs text-slate-500">
                    Belum ada lomba resmi SOS yang disetujui untuk siswa ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {selectedStudent.unifiedRows
                      .filter((r) => r.source === 'RESMI_SOS')
                      .map((r) => (
                        <div key={r.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900">
                              {r.competitionTitle}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {r.field} · {r.levelOrCuration} · {r.dateText}
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-slate-900 shrink-0">
                            {r.achievementLabel}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Section 2: Manual CV */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  2. Portofolio &amp; Prestasi Mandiri Siswa ({selectedStudent.counts.manualTotal})
                </h3>
                {selectedStudent.counts.manualTotal === 0 ? (
                  <p className="text-xs text-slate-500">
                    Siswa ini belum menambahkan prestasi manual untuk CV.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {selectedStudent.unifiedRows
                      .filter((r) => r.source === 'MANUAL_CV')
                      .map((r) => (
                        <div key={r.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900">
                              {r.competitionTitle}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {r.organizerOrLocation} · {r.field} · {r.levelOrCuration} · {r.dateText}
                            </div>
                            {r.notes && (
                              <div className="text-xs text-slate-500 mt-1">{r.notes}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {r.certificateUrl && (
                              <a
                                href={r.certificateUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                              >
                                Sertifikat
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            <span className="text-xs font-semibold text-slate-900">
                              {r.achievementLabel}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
