import { toast } from 'sonner';
import {
  Achievement,
  Competition,
  CurationColor,
  MedalType,
  Registration,
  RegistrationStatus,
  StudentCvAchievement,
} from '../types';
import { safeFormatDate } from './utils';

export type AchievementSource = 'RESMI_SOS' | 'MANUAL_CV';

export const MEDAL_LABEL_MAP: Record<MedalType, string> = {
  [MedalType.GOLD]: 'Medali Emas',
  [MedalType.SILVER]: 'Medali Perak',
  [MedalType.BRONZE]: 'Medali Perunggu',
  [MedalType.FINALS]: 'Finalis / Honorable Mention',
  [MedalType.PARTICIPANT]: 'Peserta / Partisipan',
};

export const CURATION_LABEL_MAP: Record<CurationColor, string> = {
  [CurationColor.GOLD]: 'Lembaga Negara (GOLD)',
  [CurationColor.GREEN]: 'Sangat Disarankan',
  [CurationColor.YELLOW]: 'Sangat Disarankan (Kuning)',
  [CurationColor.ORANGE]: 'Disarankan',
  [CurationColor.RED]: 'Tidak Disarankan',
};

export interface RecapStudentProfile {
  userId: string;
  fullName: string;
  email: string;
  nisn: string;
  grade: string;
  osnField: string;
  role: string;
}

export interface UnifiedAchievementRow {
  id: string;
  source: AchievementSource;
  studentId: string;
  studentName: string;
  studentNisn: string;
  studentGrade: string;
  studentField: string;
  studentRole: string;
  competitionTitle: string;
  organizerOrLocation: string;
  field: string;
  levelOrCuration: string;
  medalType?: MedalType;
  achievementLabel: string;
  year: number;
  dateText: string;
  sortTimestamp: number;
  certificateUrl?: string;
  notes?: string;
}

export interface StudentAchievementSummary {
  studentId: string;
  fullName: string;
  email: string;
  nisn: string;
  grade: string;
  osnField: string;
  role: string;
  officialApprovedRegs: Registration[];
  manualCvItems: StudentCvAchievement[];
  unifiedRows: UnifiedAchievementRow[];
  counts: {
    officialTotal: number;
    manualTotal: number;
    totalAll: number;
    gold: number;
    silver: number;
    bronze: number;
    finals: number;
    participantOrRegistered: number;
  };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeHttpUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

const MEDAL_RANK: Record<MedalType, number> = {
  [MedalType.GOLD]: 5,
  [MedalType.SILVER]: 4,
  [MedalType.BRONZE]: 3,
  [MedalType.FINALS]: 2,
  [MedalType.PARTICIPANT]: 1,
};

function resolveBestMedal(regMedal?: MedalType, achMedal?: MedalType): MedalType | undefined {
  if (!regMedal) return achMedal;
  if (!achMedal) return regMedal;
  return MEDAL_RANK[achMedal] > MEDAL_RANK[regMedal] ? achMedal : regMedal;
}

export function buildStudentAchievementSummaries(params: {
  students: RecapStudentProfile[];
  registrations: Registration[];
  competitionsMap: Map<string, Competition>;
  achievements?: Achievement[];
  cvAchievements: StudentCvAchievement[];
}): { summaries: StudentAchievementSummary[]; rows: UnifiedAchievementRow[] } {
  const { students, registrations, competitionsMap, achievements = [], cvAchievements } = params;

  const achByStudentComp = new Map<string, MedalType>();
  achievements.forEach((ach) => {
    const key = `${ach.studentId}::${ach.competitionId}`;
    const current = achByStudentComp.get(key);
    if (!current || MEDAL_RANK[ach.medalType] > MEDAL_RANK[current]) {
      achByStudentComp.set(key, ach.medalType);
    }
  });

  const regsByStudent = new Map<string, Registration[]>();
  registrations.forEach((reg) => {
    if (reg.status !== RegistrationStatus.APPROVED) return;
    const list = regsByStudent.get(reg.studentId) || [];
    list.push(reg);
    regsByStudent.set(reg.studentId, list);
  });

  const cvByStudent = new Map<string, StudentCvAchievement[]>();
  cvAchievements.forEach((item) => {
    const list = cvByStudent.get(item.studentId) || [];
    list.push(item);
    cvByStudent.set(item.studentId, list);
  });

  const allRows: UnifiedAchievementRow[] = [];

  const summaries: StudentAchievementSummary[] = students.map((student) => {
    const studentRegs = (regsByStudent.get(student.userId) || [])
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const studentCv = (cvByStudent.get(student.userId) || [])
      .slice()
      .sort((a, b) => (b.year || 0) - (a.year || 0) || (b.createdAt || 0) - (a.createdAt || 0));

    const unifiedRows: UnifiedAchievementRow[] = [];
    const counts = {
      officialTotal: studentRegs.length,
      manualTotal: studentCv.length,
      totalAll: studentRegs.length + studentCv.length,
      gold: 0,
      silver: 0,
      bronze: 0,
      finals: 0,
      participantOrRegistered: 0,
    };

    const tallyMedal = (medal?: MedalType) => {
      if (medal === MedalType.GOLD) counts.gold += 1;
      else if (medal === MedalType.SILVER) counts.silver += 1;
      else if (medal === MedalType.BRONZE) counts.bronze += 1;
      else if (medal === MedalType.FINALS) counts.finals += 1;
      else counts.participantOrRegistered += 1;
    };

    studentRegs.forEach((reg) => {
      const comp = competitionsMap.get(reg.competitionId);
      const effectiveMedal = resolveBestMedal(
        reg.finalResult,
        achByStudentComp.get(`${student.userId}::${reg.competitionId}`)
      );
      tallyMedal(effectiveMedal);

      const fieldStr = comp?.field
        ? Array.isArray(comp.field)
          ? comp.field.join(', ')
          : String(comp.field)
        : student.osnField || '-';

      const curationLabel = comp?.curationColor
        ? CURATION_LABEL_MAP[comp.curationColor] || comp.curationColor
        : '';
      const tierStr = [curationLabel, comp?.type].filter(Boolean).join(' · ') || 'Lomba Resmi SOS';

      const eventTs =
        comp?.rounds && comp.rounds.length > 0
          ? comp.rounds[0].date
          : reg.createdAt || Date.now();
      const year = Number.isFinite(new Date(eventTs).getFullYear())
        ? new Date(eventTs).getFullYear()
        : new Date().getFullYear();

      const row: UnifiedAchievementRow = {
        id: `reg:${reg.id}`,
        source: 'RESMI_SOS',
        studentId: student.userId,
        studentName: student.fullName,
        studentNisn: student.nisn || '-',
        studentGrade: student.grade || '-',
        studentField: student.osnField || '-',
        studentRole: student.role,
        competitionTitle: reg.competitionTitle || comp?.title || 'Kompetisi Resmi SOS',
        organizerOrLocation: comp?.location || 'Program Pembinaan SOS',
        field: fieldStr,
        levelOrCuration: tierStr,
        medalType: effectiveMedal,
        achievementLabel: effectiveMedal
          ? MEDAL_LABEL_MAP[effectiveMedal] || effectiveMedal
          : 'Terdaftar / Proses Lomba',
        year,
        dateText: safeFormatDate(reg.createdAt),
        sortTimestamp: reg.createdAt || eventTs || 0,
        notes: reg.notes,
      };
      unifiedRows.push(row);
      allRows.push(row);
    });

    studentCv.forEach((item) => {
      tallyMedal(item.medalType);
      const achievementLabel =
        item.customAchievementLabel?.trim() ||
        MEDAL_LABEL_MAP[item.medalType] ||
        item.medalType;
      const dateDisplay = item.eventDate
        ? `${item.year} (${safeFormatDate(item.eventDate)})`
        : String(item.year);

      const parsedTs = item.eventDate
        ? new Date(item.eventDate).getTime()
        : new Date(item.year || new Date().getFullYear(), 0, 1).getTime();

      const row: UnifiedAchievementRow = {
        id: `cv:${item.id}`,
        source: 'MANUAL_CV',
        studentId: student.userId,
        studentName: student.fullName,
        studentNisn: student.nisn || '-',
        studentGrade: student.grade || '-',
        studentField: student.osnField || '-',
        studentRole: student.role,
        competitionTitle: item.competitionTitle,
        organizerOrLocation: item.organizer,
        field: item.field || '-',
        levelOrCuration: item.level,
        medalType: item.medalType,
        achievementLabel,
        year: item.year,
        dateText: dateDisplay,
        sortTimestamp: Number.isFinite(parsedTs) ? parsedTs : item.createdAt || 0,
        certificateUrl: safeHttpUrl(item.certificateUrl) || undefined,
        notes: item.notes,
      };
      unifiedRows.push(row);
      allRows.push(row);
    });

    unifiedRows.sort((a, b) => b.year - a.year || b.sortTimestamp - a.sortTimestamp);

    return {
      studentId: student.userId,
      fullName: student.fullName,
      email: student.email || '-',
      nisn: student.nisn || '-',
      grade: student.grade || '-',
      osnField: student.osnField || '-',
      role: student.role,
      officialApprovedRegs: studentRegs,
      manualCvItems: studentCv,
      unifiedRows,
      counts,
    };
  });

  allRows.sort(
    (a, b) =>
      b.year - a.year ||
      b.sortTimestamp - a.sortTimestamp ||
      a.studentName.localeCompare(b.studentName, 'id')
  );

  return { summaries, rows: allRows };
}

function triggerCsvDownload(filename: string, headers: string[], rows: string[][]) {
  const formatCell = (val: unknown) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return `"${str}"`;
  };

  const csvContent =
    '\uFEFF' +
    headers.map(formatCell).join(';') +
    '\n' +
    rows.map((r) => r.map(formatCell).join(';')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function safeFileSlug(name: string): string {
  return (
    name
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'Siswa'
  );
}

export function downloadStudentAchievementCsv(summary: StudentAchievementSummary) {
  if (summary.unifiedRows.length === 0) {
    toast.error('Siswa ini belum memiliki catatan lomba atau prestasi untuk diunduh');
    return;
  }

  const headers = [
    'No',
    'Nama Siswa',
    'NISN',
    'Kelas',
    'Program',
    'Bidang Pembinaan',
    'Sumber Data',
    'Nama Kompetisi',
    'Penyelenggara / Lokasi',
    'Bidang Lomba',
    'Tingkat / Kurasi',
    'Hasil / Capaian',
    'Tahun',
    'Tanggal / Keterangan Waktu',
    'Link Sertifikat',
    'Catatan',
  ];

  const rows = summary.unifiedRows.map((row, idx) => [
    String(idx + 1),
    summary.fullName,
    summary.nisn,
    summary.grade,
    summary.role === 'SOS' ? 'SOS' : 'Reguler',
    summary.osnField,
    row.source === 'RESMI_SOS' ? 'Resmi SOS' : 'Portofolio Manual CV',
    row.competitionTitle,
    row.organizerOrLocation,
    row.field,
    row.levelOrCuration,
    row.achievementLabel,
    String(row.year),
    row.dateText,
    row.certificateUrl || '-',
    row.notes || '-',
  ]);

  const dateTag = new Date().toISOString().slice(0, 10);
  triggerCsvDownload(`CV_Prestasi_${safeFileSlug(summary.fullName)}_${dateTag}.csv`, headers, rows);
  toast.success(`CSV prestasi ${summary.fullName} berhasil diunduh`);
}

export function downloadStudentsAchievementRecapCsv(
  rows: UnifiedAchievementRow[],
  summaries: StudentAchievementSummary[],
  mode: 'DETAIL' | 'SUMMARY'
) {
  const dateTag = new Date().toISOString().slice(0, 10);

  if (mode === 'DETAIL') {
    if (rows.length === 0) {
      toast.error('Tidak ada data prestasi yang sesuai filter untuk diunduh');
      return;
    }

    const headers = [
      'No',
      'Nama Siswa',
      'NISN',
      'Kelas',
      'Program',
      'Bidang Pembinaan',
      'Sumber Data',
      'Nama Kompetisi',
      'Penyelenggara / Lokasi',
      'Bidang Lomba',
      'Tingkat / Kurasi',
      'Hasil / Capaian',
      'Tahun',
      'Tanggal / Keterangan Waktu',
      'Link Sertifikat',
      'Catatan',
    ];

    const csvRows = rows.map((row, idx) => [
      String(idx + 1),
      row.studentName,
      row.studentNisn,
      row.studentGrade,
      row.studentRole === 'SOS' ? 'SOS' : 'Reguler',
      row.studentField,
      row.source === 'RESMI_SOS' ? 'Resmi SOS' : 'Portofolio Manual CV',
      row.competitionTitle,
      row.organizerOrLocation,
      row.field,
      row.levelOrCuration,
      row.achievementLabel,
      String(row.year),
      row.dateText,
      row.certificateUrl || '-',
      row.notes || '-',
    ]);

    triggerCsvDownload(`Rekap_Detail_Prestasi_SOS_${dateTag}.csv`, headers, csvRows);
    toast.success(`Rekap detail (${rows.length} baris prestasi) berhasil diunduh`);
    return;
  }

  if (summaries.length === 0) {
    toast.error('Tidak ada data siswa yang sesuai filter untuk diunduh');
    return;
  }

  const headers = [
    'No',
    'Nama Siswa',
    'Email',
    'NISN',
    'Kelas',
    'Program',
    'Bidang Pembinaan',
    'Total Prestasi & Lomba',
    'Resmi SOS (Disetujui)',
    'Portofolio Manual CV',
    'Emas',
    'Perak',
    'Perunggu',
    'Finalis / HM',
    'Partisipan / Terdaftar',
    'Daftar Ringkas Prestasi',
  ];

  const csvRows = summaries.map((s, idx) => [
    String(idx + 1),
    s.fullName,
    s.email,
    s.nisn,
    s.grade,
    s.role === 'SOS' ? 'SOS' : 'Reguler',
    s.osnField,
    String(s.counts.totalAll),
    String(s.counts.officialTotal),
    String(s.counts.manualTotal),
    String(s.counts.gold),
    String(s.counts.silver),
    String(s.counts.bronze),
    String(s.counts.finals),
    String(s.counts.participantOrRegistered),
    s.unifiedRows
      .map(
        (r) =>
          `[${r.year}] ${r.competitionTitle} (${r.achievementLabel}${r.source === 'MANUAL_CV' ? ' - Manual CV' : ''})`
      )
      .join(' | ') || '-',
  ]);

  triggerCsvDownload(`Rekap_Ringkasan_Siswa_SOS_${dateTag}.csv`, headers, csvRows);
  toast.success(`Rekap ringkasan (${summaries.length} siswa) berhasil diunduh`);
}

export function printStudentAchievementCV(summary: StudentAchievementSummary) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('Mohon izinkan pop-up browser untuk mencetak CV');
    return;
  }

  const officialRows = summary.unifiedRows.filter((r) => r.source === 'RESMI_SOS');
  const manualRows = summary.unifiedRows.filter((r) => r.source === 'MANUAL_CV');
  const medalTotal = summary.counts.gold + summary.counts.silver + summary.counts.bronze;
  const programLabel = summary.role === 'SOS' ? 'Semesta Olympiad Squad (SOS)' : 'Siswa Reguler';
  const printedDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8" />
      <title>Curriculum Vitae Prestasi - ${escapeHtml(summary.fullName)}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Georgia', 'Times New Roman', serif; padding: 36px; line-height: 1.5; color: #0f172a; max-width: 940px; margin: 0 auto; }
        .doc-header { border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
        .doc-kicker { font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; margin-bottom: 4px; }
        h1 { margin: 0; font-size: 24px; color: #0f172a; }
        .program-note { font-family: Arial, sans-serif; font-size: 12px; color: #334155; font-weight: 600; }
        .profile-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 24px; margin-bottom: 18px; font-size: 13.5px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 14px 18px; border-radius: 6px; }
        .stats-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 24px; font-family: Arial, sans-serif; }
        .stat-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #fff; }
        .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
        .stat-val { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; font-variant-numeric: tabular-nums; }
        .section-title { font-family: Arial, sans-serif; font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 24px; margin-bottom: 10px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
        table { border-collapse: collapse; margin-top: 6px; width: 100%; font-size: 12.5px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
        th { background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 11.5px; color: #334155; }
        .muted { color: #64748b; font-size: 11.5px; }
        .empty-note { color: #64748b; font-style: italic; font-size: 13px; margin: 8px 0 16px; }
        .cert-link { color: #1d4ed8; font-size: 11px; word-break: break-all; text-decoration: none; }
        .print-actions { margin-top: 32px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 16px; font-family: Arial, sans-serif; }
        .btn-print { padding: 10px 18px; cursor: pointer; font-size: 13.5px; font-weight: 600; background: #0f172a; color: #fff; border: none; border-radius: 6px; }
        @media print {
          body { padding: 0; }
          .print-actions { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="doc-header">
        <div>
          <div class="doc-kicker">Sekolah Semesta · Curriculum Vitae Lomba &amp; Prestasi</div>
          <h1>${escapeHtml(summary.fullName)}</h1>
        </div>
        <div class="program-note">${escapeHtml(programLabel)}</div>
      </div>

      <div class="profile-grid">
        <div><strong>Nama Lengkap:</strong> ${escapeHtml(summary.fullName)}</div>
        <div><strong>Email:</strong> ${escapeHtml(summary.email)}</div>
        <div><strong>Kelas / Unit:</strong> ${escapeHtml(summary.grade)}</div>
        <div><strong>Bidang Pembinaan:</strong> ${escapeHtml(summary.osnField)}</div>
        <div><strong>NISN:</strong> ${escapeHtml(summary.nisn)}</div>
        <div><strong>Total Catatan Prestasi:</strong> ${summary.counts.totalAll} entri</div>
      </div>

      <div class="stats-strip">
        <div class="stat-box">
          <div class="stat-label">Lomba Resmi SOS</div>
          <div class="stat-val">${officialRows.length}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Portofolio Manual CV</div>
          <div class="stat-val">${manualRows.length}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Medali (E/P/Pr)</div>
          <div class="stat-val">${medalTotal}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Finalis / Partisipan</div>
          <div class="stat-val">${summary.counts.finals + summary.counts.participantOrRegistered}</div>
        </div>
      </div>

      <div class="section-title">1. Riwayat Lomba &amp; Prestasi Resmi SOS</div>
      ${
        officialRows.length > 0
          ? `
        <table>
          <thead>
            <tr>
              <th style="width: 34px;">No</th>
              <th>Nama Kompetisi</th>
              <th>Bidang</th>
              <th>Kurasi / Jenis</th>
              <th>Hasil / Capaian</th>
              <th>Tanggal</th>
            </tr>
          </thead>
          <tbody>
            ${officialRows
              .map(
                (r, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>
                  <strong>${escapeHtml(r.competitionTitle)}</strong>
                  ${r.organizerOrLocation !== '-' ? `<div class="muted">${escapeHtml(r.organizerOrLocation)}</div>` : ''}
                </td>
                <td>${escapeHtml(r.field)}</td>
                <td>${escapeHtml(r.levelOrCuration)}</td>
                <td><strong>${escapeHtml(r.achievementLabel)}</strong></td>
                <td>${escapeHtml(r.dateText)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `
          : '<p class="empty-note">Belum ada riwayat lomba resmi SOS yang disetujui.</p>'
      }

      <div class="section-title">2. Portofolio &amp; Prestasi Mandiri Siswa (Tambahan Manual CV)</div>
      ${
        manualRows.length > 0
          ? `
        <table>
          <thead>
            <tr>
              <th style="width: 34px;">No</th>
              <th>Nama Kompetisi &amp; Penyelenggara</th>
              <th>Bidang</th>
              <th>Tingkat</th>
              <th>Capaian</th>
              <th>Tahun / Waktu</th>
            </tr>
          </thead>
          <tbody>
            ${manualRows
              .map(
                (r, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>
                  <strong>${escapeHtml(r.competitionTitle)}</strong>
                  <div class="muted">${escapeHtml(r.organizerOrLocation)}</div>
                  ${r.notes ? `<div class="muted">${escapeHtml(r.notes)}</div>` : ''}
                  ${r.certificateUrl ? `<div><a class="cert-link" href="${escapeHtml(r.certificateUrl)}" target="_blank" rel="noopener noreferrer">Bukti Sertifikat</a></div>` : ''}
                </td>
                <td>${escapeHtml(r.field)}</td>
                <td>${escapeHtml(r.levelOrCuration)}</td>
                <td><strong>${escapeHtml(r.achievementLabel)}</strong></td>
                <td>${escapeHtml(r.dateText)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `
          : '<p class="empty-note">Belum ada prestasi mandiri yang ditambahkan ke CV.</p>'
      }

      <div class="print-actions">
        <span class="muted">Dokumen resmi dicetak dari Sistem Manajemen SOS pada ${escapeHtml(printedDate)}</span>
        <button class="btn-print" onclick="window.print()">Cetak Dokumen / Simpan PDF</button>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

export function printStudentsAchievementRecap(
  summaries: StudentAchievementSummary[],
  rows: UnifiedAchievementRow[],
  filterSummaryText: string
) {
  if (rows.length === 0 && summaries.length === 0) {
    toast.error('Tidak ada data prestasi untuk dicetak');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('Mohon izinkan pop-up browser untuk mencetak rekap');
    return;
  }

  const totalOfficial = rows.filter((r) => r.source === 'RESMI_SOS').length;
  const totalManual = rows.filter((r) => r.source === 'MANUAL_CV').length;
  const totalGold = rows.filter((r) => r.medalType === MedalType.GOLD).length;
  const totalSilver = rows.filter((r) => r.medalType === MedalType.SILVER).length;
  const totalBronze = rows.filter((r) => r.medalType === MedalType.BRONZE).length;
  const printedDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8" />
      <title>Rekap Prestasi &amp; Lomba Siswa - SOS Semesta</title>
      <style>
        * { box-sizing: border-box; }
        @page { size: A4 landscape; margin: 14mm; }
        body { font-family: Arial, Helvetica, sans-serif; padding: 24px; line-height: 1.45; color: #0f172a; margin: 0 auto; max-width: 1120px; }
        .doc-header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
        .kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin-bottom: 4px; }
        h1 { margin: 0; font-size: 20px; color: #0f172a; }
        .filter-meta { font-size: 12px; color: #334155; margin-bottom: 16px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 6px; }
        .kpi-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 20px; }
        .kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; }
        .kpi-label { font-size: 10.5px; text-transform: uppercase; color: #64748b; }
        .kpi-num { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; font-variant-numeric: tabular-nums; }
        h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; margin: 18px 0 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 6px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; font-weight: 700; color: #334155; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .muted { color: #64748b; font-size: 10.5px; }
        .tag { display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; border: 1px solid #cbd5e1; background: #f8fafc; }
        .tag-manual { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
        .tag-resmi { background: #dbeafe; border-color: #93c5fd; color: #1e40af; }
        .print-actions { margin-top: 24px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 14px; }
        .btn-print { padding: 9px 16px; cursor: pointer; font-size: 13px; font-weight: 600; background: #0f172a; color: #fff; border: none; border-radius: 6px; }
        @media print {
          body { padding: 0; max-width: none; }
          .print-actions { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="doc-header">
        <div>
          <div class="kicker">Sekolah Semesta · Semesta Olympiad Squad (SOS)</div>
          <h1>Rekapitulasi Prestasi &amp; Partisipasi Lomba Siswa</h1>
        </div>
        <div class="muted">Tanggal Cetak: ${escapeHtml(printedDate)}</div>
      </div>

      <div class="filter-meta">
        <strong>Cakupan Filter:</strong> ${escapeHtml(filterSummaryText)}
      </div>

      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-label">Siswa Tercakup</div>
          <div class="kpi-num">${summaries.length}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Lomba Resmi SOS</div>
          <div class="kpi-num">${totalOfficial}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Portofolio Manual CV</div>
          <div class="kpi-num">${totalManual}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Total Medali E / P / Pr</div>
          <div class="kpi-num">${totalGold} / ${totalSilver} / ${totalBronze}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Total Catatan</div>
          <div class="kpi-num">${rows.length}</div>
        </div>
      </div>

      <h2>Daftar Lengkap Prestasi (Resmi SOS &amp; Input Manual CV)</h2>
      ${
        rows.length > 0
          ? `
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">No</th>
              <th>Nama Siswa</th>
              <th>Kelas · Bidang</th>
              <th>Sumber</th>
              <th>Nama Kompetisi &amp; Penyelenggara</th>
              <th>Bidang Lomba</th>
              <th>Tingkat / Kurasi</th>
              <th>Capaian / Hasil</th>
              <th style="width: 72px;">Tahun</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>
                  <strong>${escapeHtml(r.studentName)}</strong>
                  ${r.studentNisn !== '-' ? `<div class="muted">NISN: ${escapeHtml(r.studentNisn)}</div>` : ''}
                </td>
                <td>${escapeHtml(r.studentGrade)} · ${escapeHtml(r.studentField)}</td>
                <td>
                  <span class="tag ${r.source === 'MANUAL_CV' ? 'tag-manual' : 'tag-resmi'}">
                    ${r.source === 'MANUAL_CV' ? 'Manual CV' : 'Resmi SOS'}
                  </span>
                </td>
                <td>
                  <strong>${escapeHtml(r.competitionTitle)}</strong>
                  <div class="muted">${escapeHtml(r.organizerOrLocation)}</div>
                </td>
                <td>${escapeHtml(r.field)}</td>
                <td>${escapeHtml(r.levelOrCuration)}</td>
                <td><strong>${escapeHtml(r.achievementLabel)}</strong></td>
                <td>${escapeHtml(r.dateText)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `
          : '<p class="muted">Belum ada catatan prestasi pada filter yang dipilih.</p>'
      }

      <div class="print-actions">
        <span class="muted">Menampilkan ${rows.length} catatan prestasi dari ${summaries.length} siswa.</span>
        <button class="btn-print" onclick="window.print()">Cetak Rekap / Simpan PDF</button>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
