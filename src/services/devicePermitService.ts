import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { removeUndefined } from '../lib/utils';

export type SchoolUnit = 'SMP' | 'SMA';
export type PermitStatus = 'APPROVED' | 'REJECTED' | 'DUE';

export interface DevicePermitSignatory {
  role: string;
  name: string;
  title: string;
}

export interface DevicePermitRules {
  eduOsCampHours: string;
  afternoonStudyHours: string;
  nightStudyHours: string;
  chromebookWebAccess: string[];
  allowedDevices: string[];
  validityPeriod: string;
  issueDate: string;
  location: string;
}

export interface DevicePermitStudent {
  id: string; // e.g. "SMP-2627-001" or "SMP-001"
  regNumber: string; // e.g. "SMP-2627-001" (includes TA code)
  academicYear: string; // e.g. "2026/2027"
  academicYearCode: string; // e.g. "2627"
  slug: string; // URL-friendly slug
  name: string;
  gender: 'L' | 'P';
  grade: string; // e.g. "7A", "10B"
  osnField: string;
  unit: SchoolUnit;
  schoolName: string;
  status: PermitStatus;
  deviceName?: string; // e.g. "Laptop Asus Vivobook / iPad"
  deviceMac?: string; // e.g. "A4:C3:F0:89:12:DE" or Serial Number (opsional, boleh kosong)
  deviceIp?: string; // e.g. "10.10.24.85"
  notes?: string;
  rules: DevicePermitRules;
  signatories: {
    schoolCulture: DevicePermitSignatory;
    olympiadCoordinator: DevicePermitSignatory;
    principal: DevicePermitSignatory;
  };
  pdfUrl: string;
  pdfFileName: string;
  updatedAt?: number;
}

const COMMON_RULES_SMP: DevicePermitRules = {
  eduOsCampHours: 'Pukul 07.00 - 16.00 WIB',
  afternoonStudyHours: 'Pukul 14.35 - 17.00 WIB',
  nightStudyHours: 'Pukul 19.30 - 21.30 WIB',
  chromebookWebAccess: ['Google AI Studio', 'WhatsApp Web'],
  allowedDevices: ['Laptop', 'Tablet'],
  validityPeriod: 'Oktober 2026 - Mei 2027',
  issueDate: '7 Oktober 2026',
  location: 'Semarang',
};

const COMMON_RULES_SMA: DevicePermitRules = {
  eduOsCampHours: 'Pukul 07.00 - 16.00 WIB',
  afternoonStudyHours: 'Pukul 14.35 - 17.00 WIB',
  nightStudyHours: 'Pukul 19.30 - 21.30 WIB',
  chromebookWebAccess: ['Google AI Studio', 'WhatsApp Web'],
  allowedDevices: ['Laptop', 'Tablet'],
  validityPeriod: 'Oktober 2026 - Mei 2027',
  issueDate: '23 Juli 2026',
  location: 'Semarang',
};

const SIGNATORIES_SMP = {
  schoolCulture: {
    role: 'Koordinator School Culture',
    name: 'Puji Lestari, S.Pd.',
    title: 'Mengetahui',
  },
  olympiadCoordinator: {
    role: 'Koordinator Tim Olimpiade',
    name: 'Siti Cholifah Fitroh, S.Pd.',
    title: 'Pemohon',
  },
  principal: {
    role: 'Kepala Sekolah SMP Semesta',
    name: 'Imas Walijah, S. Pd., M. Ed.',
    title: 'Disetujui Oleh',
  },
};

const SIGNATORIES_SMA = {
  schoolCulture: {
    role: 'Koordinator School Culture',
    name: 'Kurniawan Ahibul Ibad, S.Pd.',
    title: 'Mengetahui',
  },
  olympiadCoordinator: {
    role: 'Koordinator Tim Olimpiade',
    name: 'Muhammad Ghozian K.A., S.Pd., M.Pd.',
    title: 'Pemohon',
  },
  principal: {
    role: 'Kepala Sekolah SMA Semesta',
    name: 'Ahmad Nurani, S.T., M. Pd.',
    title: 'Disetujui Oleh',
  },
};

export const PDF_FILES = {
  SMP: {
    url: '/assets/aistudio/Izin_WA_SMP_39523655.pdf',
    fileName: 'Izin_WA_SMP_39523655.pdf',
    title: 'Surat Permohonan Izin Web dan Device - SMP Semesta',
    date: '7 Oktober 2026',
  },
  SMA: {
    url: '/assets/aistudio/Izin_WA_SMA_7d11466a.pdf',
    fileName: 'Izin_WA_SMA_7d11466a.pdf',
    title: 'Surat Permohonan Izin Web dan Device - SMA Semesta',
    date: '23 Juli 2026',
  },
};

export function extractTACode(academicYear: string = '2026/2027'): string {
  // e.g. "2026/2027" -> "2627", "2025/2026" -> "2526"
  const digits = academicYear.match(/\d+/g);
  if (digits && digits.length >= 2) {
    const y1 = digits[0].slice(-2);
    const y2 = digits[1].slice(-2);
    return `${y1}${y2}`;
  }
  return '2627';
}

export function generateRegNumber(unit: SchoolUnit, index: number, academicYear: string = '2026/2027'): string {
  const taCode = extractTACode(academicYear);
  const num = String(index).padStart(3, '0');
  return `${unit}-${taCode}-${num}`;
}

export function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 12 Students SMP Semesta from PDF
const SMP_RAW_STUDENTS: Array<[string, 'L' | 'P', string, string]> = [
  ['Muhammad Raihan Al Biruni', 'L', '7A', 'IPA'],
  ['Aqilla Sabrina Azzahra', 'P', '7B', 'IPA'],
  ['Muhammad Faza Fauzan Adzima', 'L', '7A', 'IPA'],
  ['Alyauma Malaika Dhiyandha Putri', 'P', '8B', 'IPA'],
  ['Kayla Almira Wahyudi', 'P', '8B', 'IPA'],
  ['Muhammad Rafie Issan Al Fattah', 'L', '7A', 'IPS'],
  ['Giandra Algajaya', 'L', '8A', 'IPS'],
  ['Muhammad Yusuf Zhafran Aqila', 'L', '7A', 'Matematika'],
  ['Radityo Rizky Riananda', 'L', '7A', 'Matematika'],
  ['Nada Jenna Sasmaya', 'P', '7B', 'Matematika'],
  ['Phebe Tisyanna Dwi Ludya', 'P', '7B', 'Matematika'],
  ['Khayyissa Berlian Azzahra', 'P', '8B', 'Matematika'],
];

// 24 Students SMA Semesta from PDF
const SMA_RAW_STUDENTS: Array<[string, 'L' | 'P', string, string]> = [
  ['Hanif Pradipta', 'L', '10B', 'Astronomi'],
  ['A Deta Adatama', 'L', '10C', 'Astronomi'],
  ['Keyla Ezrany Medea', 'P', '10D', 'Astronomi'],
  ['Muh. Fahry Ariyadi', 'L', '10C', 'Biologi'],
  ['Nararya Danish Radithya Erlangga', 'L', '11C', 'Biologi'],
  ['Hesti Novita Sari', 'P', '10D', 'Ekonomi'],
  ['Maulida Al-Hawa Nurol Aen', 'P', '11E', 'Ekonomi'],
  ['Rafan Ganendra Adhi Prabowo', 'L', '10A', 'Ekonomi'],
  ['Farid Athaya Rahman Harahap', 'L', '10A', 'Fisika'],
  ['Alif Gavin Biantoro', 'L', '10A', 'Geografi'],
  ['Samuel Pranata Sinaga', 'L', '11A', 'Geografi'],
  ['Fadhel Mulia Al Hamid', 'L', '11B', 'Geografi'],
  ['Samuel Timothy Setiawan', 'L', '10A', 'Informatika'],
  ['Evan Pradipta Candra', 'L', '11B', 'Informatika'],
  ['Jupiter Arshavino Raditya Mustofa', 'L', '11C', 'Kebumian'],
  ['Lily Fatima Azis', 'P', '10D', 'Kebumian'],
  ['Zhafirah Madina Zahra', 'P', '10E', 'Kebumian'],
  ['Raffi Ghifary Meditra', 'L', '11A', 'Matematika'],
  ['Moses Markhesywan Ganda Ribowo', 'L', '11C', 'Matematika'],
  ['Fayyadh Assahib', 'L', '9A', 'Astronomi'],
  ['Faith Athallah Zaki Saparudin', 'L', '9A', 'Fisika'],
  ['Avicenna Al Ayyubi Sainz', 'L', '9A', 'Biologi'],
  ['Alyssa Aqeela Nathifa', 'P', '9B', 'Geografi'],
  ['Muhammad Zaid Ramadhan', 'L', '9A', 'Geografi'],
];

// In-memory baseline / seed dataset
export const BASELINE_DEVICE_PERMITS: DevicePermitStudent[] = [
  ...SMP_RAW_STUDENTS.map(([name, gender, grade, osnField], idx) => {
    const academicYear = '2026/2027';
    const taCode = extractTACode(academicYear);
    const num = String(idx + 1).padStart(3, '0');
    const regNumber = `SMP-${taCode}-${num}`;
    return {
      id: regNumber,
      regNumber,
      academicYear,
      academicYearCode: taCode,
      slug: `smp-${createSlug(name)}`,
      name,
      gender,
      grade,
      osnField,
      unit: 'SMP' as SchoolUnit,
      schoolName: 'SMP Semesta Bilingual Boarding School',
      status: 'APPROVED' as PermitStatus,
      deviceName: 'Laptop & Tablet Belajar',
      deviceIp: `10.20.14.${10 + idx}`,
      notes: 'Izin aktif untuk persiapan OSN 2026/2027',
      rules: COMMON_RULES_SMP,
      signatories: SIGNATORIES_SMP,
      pdfUrl: PDF_FILES.SMP.url,
      pdfFileName: PDF_FILES.SMP.fileName,
      updatedAt: Date.now(),
    };
  }),
  ...SMA_RAW_STUDENTS.map(([name, gender, grade, osnField], idx) => {
    const academicYear = '2026/2027';
    const taCode = extractTACode(academicYear);
    const num = String(idx + 1).padStart(3, '0');
    const regNumber = `SMA-${taCode}-${num}`;
    return {
      id: regNumber,
      regNumber,
      academicYear,
      academicYearCode: taCode,
      slug: `sma-${createSlug(name)}`,
      name,
      gender,
      grade,
      osnField,
      unit: 'SMA' as SchoolUnit,
      schoolName: 'SMA Semesta Bilingual Boarding School',
      status: 'APPROVED' as PermitStatus,
      deviceName: 'Laptop & Tablet Belajar',
      deviceIp: `10.20.15.${10 + idx}`,
      notes: 'Izin aktif untuk persiapan OSN 2026/2027',
      rules: COMMON_RULES_SMA,
      signatories: SIGNATORIES_SMA,
      pdfUrl: PDF_FILES.SMA.url,
      pdfFileName: PDF_FILES.SMA.fileName,
      updatedAt: Date.now(),
    };
  }),
];

// In-memory cache for fast responsive rendering & offline fallback
let permitsMemoryCache: DevicePermitStudent[] = [...BASELINE_DEVICE_PERMITS];

export function getPermitsCache(): DevicePermitStudent[] {
  return [...permitsMemoryCache];
}

export function getDevicePermitFromCache(idOrSlug: string): DevicePermitStudent | undefined {
  if (!idOrSlug) return undefined;
  const target = idOrSlug.trim().toLowerCase();
  return permitsMemoryCache.find(
    p =>
      p.id.toLowerCase() === target ||
      p.regNumber.toLowerCase() === target ||
      p.slug.toLowerCase() === target ||
      createSlug(p.name) === target ||
      p.name.toLowerCase() === target
  );
}

import { isRawId, getFriendlyDisplayName } from '../lib/utils';
import { deleteDoc } from 'firebase/firestore';

/**
 * Sync active SOS students from 'students' and 'users' collections
 * into the device permits list.
 * Students from the 36-student PDF letters are marked 'APPROVED'.
 * Other active SOS students who have not yet been granted permits will appear with status 'REJECTED' (Belum Ada Izin).
 */
async function syncActiveSosStudents(existingPermits: DevicePermitStudent[]): Promise<DevicePermitStudent[]> {
  try {
    // 1. Fetch from students collection
    const studentsSnap = await getDocs(collection(db, 'students')).catch(() => null);
    // 2. Fetch from users collection where role is SOS or STUDENT
    const usersSnap = await getDocs(
      query(collection(db, 'users'), where('role', 'in', ['SOS', 'STUDENT', 'sos', 'student']))
    ).catch(() => null);

    const activeStudentsMap = new Map<string, {
      userId: string;
      fullName: string;
      grade?: string;
      osnField?: string;
      gender?: 'L' | 'P';
    }>();

    if (studentsSnap && !studentsSnap.empty) {
      studentsSnap.docs.forEach(d => {
        const data = d.data();
        const fullName = data.fullName?.trim();
        if (fullName && !isRawId(fullName)) {
          const key = data.userId || d.id;
          activeStudentsMap.set(key, {
            userId: key,
            fullName,
            grade: data.grade || '',
            osnField: data.osnField || '',
            gender: data.gender === 'P' ? 'P' : 'L',
          });
        }
      });
    }

    if (usersSnap && !usersSnap.empty) {
      usersSnap.docs.forEach(d => {
        const data = d.data();
        const name = data.name || data.displayName;
        const cleanName = getFriendlyDisplayName(name, data.email, '');
        if (cleanName && !isRawId(cleanName) && !activeStudentsMap.has(d.id)) {
          activeStudentsMap.set(d.id, {
            userId: d.id,
            fullName: cleanName,
            grade: '',
            osnField: '',
            gender: 'L',
          });
        }
      });
    }

    // Determine which active students are not yet in existingPermits
    const mergedList = [...existingPermits];
    const newPermitsToBatch: DevicePermitStudent[] = [];

    let smpCounter = mergedList.filter(p => p.unit === 'SMP').length + 1;
    let smaCounter = mergedList.filter(p => p.unit === 'SMA').length + 1;

    activeStudentsMap.forEach(student => {
      // Check if already in mergedList by normalized name or ID
      const normalizedStudentName = student.fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const exists = mergedList.some(p => {
        const pNorm = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return pNorm === normalizedStudentName || p.id === student.userId || p.name.toLowerCase().trim() === student.fullName.toLowerCase().trim();
      });

      if (!exists) {
        // Detect unit based on grade
        const gradeStr = (student.grade || '').toUpperCase();
        const isSMP =
          gradeStr.startsWith('7') ||
          gradeStr.startsWith('8') ||
          gradeStr.startsWith('9') ||
          gradeStr.includes('SMP');
        const unit: SchoolUnit = isSMP ? 'SMP' : 'SMA';
        const academicYear = '2026/2027';
        const taCode = extractTACode(academicYear);
        const seqNum = isSMP ? smpCounter++ : smaCounter++;
        const numPart = String(seqNum).padStart(3, '0');
        const regNumber = `${unit}-${taCode}-${numPart}`;

        const defaultRules = unit === 'SMA' ? COMMON_RULES_SMA : COMMON_RULES_SMP;
        const defaultSigs = unit === 'SMA' ? SIGNATORIES_SMA : SIGNATORIES_SMP;
        const defaultPdf = unit === 'SMA' ? PDF_FILES.SMA : PDF_FILES.SMP;

        const newPermit: DevicePermitStudent = {
          id: regNumber,
          regNumber,
          academicYear,
          academicYearCode: taCode,
          slug: `${unit.toLowerCase()}-${createSlug(student.fullName)}`,
          name: student.fullName,
          gender: student.gender || 'L',
          grade: student.grade || (unit === 'SMP' ? '8' : '10'),
          osnField: student.osnField || 'Umum',
          unit,
          schoolName:
            unit === 'SMA'
              ? 'SMA Semesta Bilingual Boarding School'
              : 'SMP Semesta Bilingual Boarding School',
          status: 'REJECTED', // Belum Ada Izin
          deviceName: '',
          deviceIp: '',
          notes: 'Siswa aktif SOS (Belum memiliki izin resmi device)',
          rules: defaultRules,
          signatories: defaultSigs,
          pdfUrl: defaultPdf.url,
          pdfFileName: defaultPdf.fileName,
          updatedAt: Date.now(),
        };

        mergedList.push(newPermit);
        newPermitsToBatch.push(newPermit);
      }
    });

    // If new active student permits were generated, persist them to Firestore in background
    if (newPermitsToBatch.length > 0) {
      const batch = writeBatch(db);
      for (const np of newPermitsToBatch) {
        const dRef = doc(db, 'devicePermits', np.id);
        batch.set(dRef, removeUndefined(np), { merge: true });
      }
      batch.commit().catch(err => console.warn('Could not auto-sync new student permits to Firestore:', err));
    }

    // Sort by unit then regNumber
    mergedList.sort((a, b) => a.regNumber.localeCompare(b.regNumber));
    return mergedList;
  } catch (err) {
    console.warn('Error syncing active SOS students:', err);
    return existingPermits;
  }
}

/**
 * Fetch all device permits from Firestore.
 * Automatically synchronizes with all active SOS students in the database.
 * The 36 official students remain 'APPROVED', and any other active SOS student is listed (e.g. 'REJECTED' / Belum Ada Izin).
 */
export async function getAllDevicePermits(forceRefresh: boolean = false): Promise<DevicePermitStudent[]> {
  try {
    const colRef = collection(db, 'devicePermits');
    const snapshot = await getDocs(colRef);

    let loadedPermits: DevicePermitStudent[] = [];

    if (!snapshot.empty) {
      loadedPermits = snapshot.docs.map(d => {
        const data = d.data() as Partial<DevicePermitStudent>;
        const unit = (data.unit as SchoolUnit) || (d.id.startsWith('SMA') ? 'SMA' : 'SMP');
        const defaultRules = unit === 'SMA' ? COMMON_RULES_SMA : COMMON_RULES_SMP;
        const defaultSigs = unit === 'SMA' ? SIGNATORIES_SMA : SIGNATORIES_SMP;
        const defaultPdf = unit === 'SMA' ? PDF_FILES.SMA : PDF_FILES.SMP;
        const academicYear = data.academicYear || '2026/2027';
        const taCode = data.academicYearCode || extractTACode(academicYear);
        const regNumber = data.regNumber || d.id;

        return {
          id: d.id,
          regNumber,
          academicYear,
          academicYearCode: taCode,
          slug: data.slug || createSlug(data.name || d.id),
          name: data.name || 'Siswa Tanpa Nama',
          gender: (data.gender as 'L' | 'P') || 'L',
          grade: data.grade || '10',
          osnField: data.osnField || 'Matematika',
          unit,
          schoolName: data.schoolName || (unit === 'SMA' ? 'SMA Semesta Bilingual Boarding School' : 'SMP Semesta Bilingual Boarding School'),
          status: (data.status as PermitStatus) || 'APPROVED',
          deviceName: data.deviceName || '',
          deviceMac: data.deviceMac || '',
          deviceIp: data.deviceIp || '',
          notes: data.notes || '',
          rules: { ...defaultRules, ...(data.rules || {}) },
          signatories: defaultSigs,
          pdfUrl: defaultPdf.url,
          pdfFileName: defaultPdf.fileName,
          updatedAt: data.updatedAt || Date.now(),
        };
      });
    } else {
      // Seed baseline 36 permits if Firestore collection is fresh
      await seedBaselinePermitsToFirestore().catch(e => console.warn('Could not seed permits:', e));
      loadedPermits = [...BASELINE_DEVICE_PERMITS];
    }

    // Sync with active SOS students from students & users collections
    const fullMergedList = await syncActiveSosStudents(loadedPermits);
    permitsMemoryCache = fullMergedList;
    return fullMergedList;
  } catch (err) {
    console.warn('Error reading devicePermits from Firestore, using memory fallback:', err);
    return permitsMemoryCache;
  }
}

/**
 * Seed baseline permits to Firestore
 */
async function seedBaselinePermitsToFirestore() {
  try {
    const batch = writeBatch(db);
    for (const p of BASELINE_DEVICE_PERMITS) {
      const docRef = doc(db, 'devicePermits', p.id);
      batch.set(docRef, removeUndefined({ ...p }));
    }
    await batch.commit();
    console.log('Successfully seeded 36 device permits to Firestore');
  } catch (err) {
    console.error('Failed to seed device permits:', err);
  }
}

/**
 * Manually create a new student device permit
 */
export async function createDevicePermit(data: {
  name: string;
  unit: SchoolUnit;
  grade: string;
  osnField: string;
  gender?: 'L' | 'P';
  status?: PermitStatus;
  deviceName?: string;
  deviceMac?: string;
  deviceIp?: string;
  notes?: string;
  academicYear?: string;
}): Promise<DevicePermitStudent> {
  const academicYear = data.academicYear || '2026/2027';
  const taCode = extractTACode(academicYear);
  const unit = data.unit;

  const existingWithSameTa = permitsMemoryCache.filter(
    p => p.unit === unit && p.academicYearCode === taCode
  );
  const nextNum = existingWithSameTa.length + 1;
  const numPart = String(nextNum).padStart(3, '0');
  const regNumber = `${unit}-${taCode}-${numPart}`;

  const defaultRules = unit === 'SMA' ? COMMON_RULES_SMA : COMMON_RULES_SMP;
  const defaultSigs = unit === 'SMA' ? SIGNATORIES_SMA : SIGNATORIES_SMP;
  const defaultPdf = unit === 'SMA' ? PDF_FILES.SMA : PDF_FILES.SMP;

  const newPermit: DevicePermitStudent = {
    id: regNumber,
    regNumber,
    academicYear,
    academicYearCode: taCode,
    slug: `${unit.toLowerCase()}-${createSlug(data.name)}`,
    name: data.name,
    gender: data.gender || 'L',
    grade: data.grade || (unit === 'SMP' ? '8' : '10'),
    osnField: data.osnField || 'Umum',
    unit,
    schoolName: unit === 'SMA' ? 'SMA Semesta Bilingual Boarding School' : 'SMP Semesta Bilingual Boarding School',
    status: data.status || 'APPROVED',
    deviceName: data.deviceName || '',
    deviceMac: data.deviceMac || '',
    deviceIp: data.deviceIp || '',
    notes: data.notes || '',
    rules: defaultRules,
    signatories: defaultSigs,
    pdfUrl: defaultPdf.url,
    pdfFileName: defaultPdf.fileName,
    updatedAt: Date.now(),
  };

  const docRef = doc(db, 'devicePermits', regNumber);
  await setDoc(docRef, removeUndefined(newPermit));

  permitsMemoryCache.push(newPermit);
  permitsMemoryCache.sort((a, b) => a.regNumber.localeCompare(b.regNumber));
  return newPermit;
}

/**
 * Delete a student device permit
 */
export async function deleteDevicePermit(permitId: string): Promise<void> {
  const docRef = doc(db, 'devicePermits', permitId);
  await deleteDoc(docRef);
  permitsMemoryCache = permitsMemoryCache.filter(p => p.id !== permitId);
}

/**
 * Update single permit in Firestore and local memory
 */
export async function updateDevicePermit(
  permitId: string,
  updates: Partial<DevicePermitStudent>
): Promise<DevicePermitStudent> {
  const current = permitsMemoryCache.find(p => p.id === permitId) || BASELINE_DEVICE_PERMITS.find(p => p.id === permitId);
  if (!current) {
    throw new Error(`Permit with ID ${permitId} not found`);
  }

  // Recalculate regNumber if TA or unit changed
  const academicYear = updates.academicYear || current.academicYear;
  const academicYearCode = extractTACode(academicYear);
  const unit = updates.unit || current.unit;
  
  let newRegNumber = current.regNumber;
  if (updates.regNumber) {
    newRegNumber = updates.regNumber;
  } else if (updates.academicYear && updates.academicYear !== current.academicYear) {
    const numPart = current.regNumber.split('-').pop() || '001';
    newRegNumber = `${unit}-${academicYearCode}-${numPart}`;
  }

  const updatedPermit: DevicePermitStudent = {
    ...current,
    ...updates,
    academicYear,
    academicYearCode,
    regNumber: newRegNumber,
    updatedAt: Date.now(),
  };

  // 1. Update in Firestore
  try {
    const docRef = doc(db, 'devicePermits', permitId);
    await setDoc(docRef, removeUndefined({
      id: updatedPermit.id,
      regNumber: updatedPermit.regNumber,
      academicYear: updatedPermit.academicYear,
      academicYearCode: updatedPermit.academicYearCode,
      slug: updatedPermit.slug,
      name: updatedPermit.name,
      gender: updatedPermit.gender,
      grade: updatedPermit.grade,
      osnField: updatedPermit.osnField,
      unit: updatedPermit.unit,
      schoolName: updatedPermit.schoolName,
      status: updatedPermit.status,
      deviceName: updatedPermit.deviceName || '',
      deviceMac: updatedPermit.deviceMac || '',
      deviceIp: updatedPermit.deviceIp || '',
      notes: updatedPermit.notes || '',
      rules: updatedPermit.rules,
      updatedAt: updatedPermit.updatedAt,
    }), { merge: true });
  } catch (err) {
    console.error('Error updating permit in Firestore:', err);
  }

  // 2. Update memory cache
  const idx = permitsMemoryCache.findIndex(p => p.id === permitId);
  if (idx >= 0) {
    permitsMemoryCache[idx] = updatedPermit;
  } else {
    permitsMemoryCache.push(updatedPermit);
  }

  return updatedPermit;
}

/**
 * Bulk update multiple permits
 */
export async function bulkUpdateDevicePermits(
  permitIds: string[],
  updates: Partial<DevicePermitStudent>
): Promise<number> {
  if (permitIds.length === 0) return 0;

  try {
    const batch = writeBatch(db);
    const now = Date.now();

    for (const pid of permitIds) {
      const docRef = doc(db, 'devicePermits', pid);
      const cleanPayload = removeUndefined({
        ...updates,
        updatedAt: now,
      });
      batch.set(docRef, cleanPayload, { merge: true });
    }

    await batch.commit();

    // Update memory cache
    permitsMemoryCache = permitsMemoryCache.map(p => {
      if (permitIds.includes(p.id)) {
        return {
          ...p,
          ...updates,
          updatedAt: now,
        };
      }
      return p;
    });

    return permitIds.length;
  } catch (err) {
    console.error('Error bulk updating permits:', err);
    throw err;
  }
}

/**
 * Look up permit by ID, slug, or student name
 */
export async function getDevicePermitByIdOrSlug(idOrSlug: string): Promise<DevicePermitStudent | undefined> {
  if (!idOrSlug) return undefined;
  const target = idOrSlug.trim().toLowerCase();

  // Check cache first
  let found = permitsMemoryCache.find(
    p =>
      p.id.toLowerCase() === target ||
      p.regNumber.toLowerCase() === target ||
      p.slug.toLowerCase() === target ||
      createSlug(p.name) === target ||
      p.name.toLowerCase() === target
  );

  if (found) return found;

  // Try direct Firestore lookup
  try {
    const docRef = doc(db, 'devicePermits', idOrSlug);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as DevicePermitStudent;
      return {
        ...BASELINE_DEVICE_PERMITS[0],
        ...data,
      };
    }

    // Try fetching all to refresh cache
    const all = await getAllDevicePermits();
    return all.find(
      p =>
        p.id.toLowerCase() === target ||
        p.regNumber.toLowerCase() === target ||
        p.slug.toLowerCase() === target ||
        createSlug(p.name) === target
    );
  } catch (err) {
    console.warn('Error querying Firestore for permit:', err);
    return permitsMemoryCache.find(
      p =>
        p.id.toLowerCase() === target ||
        p.regNumber.toLowerCase() === target ||
        p.slug.toLowerCase() === target
    );
  }
}

export function findPermitForStudent(
  studentName?: string,
  email?: string,
  userId?: string
): DevicePermitStudent | undefined {
  if (!studentName && !email && !userId) return undefined;

  // 1. Check by userId or exact permit ID
  if (userId) {
    const byId = permitsMemoryCache.find(p => p.id === userId || (p as any).userId === userId);
    if (byId) return byId;
  }

  // 2. Check by student name
  if (studentName) {
    const cleanName = studentName.trim().toLowerCase();
    const exact = permitsMemoryCache.find(p => p.name.toLowerCase() === cleanName);
    if (exact) return exact;

    const match = permitsMemoryCache.find(
      p => cleanName.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(cleanName)
    );
    if (match) return match;
  }

  // 3. Check by email
  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    const emailPrefix = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '');
    const matchByEmail = permitsMemoryCache.find(p => {
      const pClean = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return pClean.includes(emailPrefix) || emailPrefix.includes(pClean);
    });
    if (matchByEmail) return matchByEmail;
  }

  return undefined;
}

export function getVerificationUrl(permit: DevicePermitStudent): string {
  const baseDomain = 'https://sos.olympiad.my.id';
  return `${baseDomain}/permit/${permit.slug}`;
}
