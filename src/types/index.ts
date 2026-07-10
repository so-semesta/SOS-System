export type Role = 'admin' | 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: number;
  updatedAt: number;
}

export interface StudentAddress {
  street: string;       // Jalan
  number: string;       // No
  rtRw: string;         // RT/RW
  village: string;      // Kelurahan
  district: string;     // Kecamatan
  city: string;         // Kab/Kota
  province: string;     // Provinsi
  postalCode: string;   // Kode Pos
}

export interface StudentDocuments {
  photoUrl: string;               // Pas Foto 3x4
  studentCardUrl: string;         // Kartu Siswa
  familyCardUrl: string;          // Kartu Keluarga
  birthCertificateUrl: string;    // Akte
  idCardUrl: string;              // KTP/KIA
}

export interface Student {
  id: string;
  userId: string;

  // Informasi Dasar
  fullName: string;
  nisn: string;
  grade: string;        // Kelas
  osnField: string;     // Bidang OSN
  nik: string;
  religion: string;
  birthPlace: string;
  birthDate: number;    // timestamp
  specialNeeds: string;
  isColorBlind: boolean;
  weightKg: number;
  heightCm: number;

  // Kontak
  activeEmail: string;
  semestaEmail: string;
  activePhoneWA: string;
  
  // Alamat Singkat
  homeAddress: string;
  houseNumber: string;
  rtRw: string;
  postalCode: string;
  
  // Alamat Lengkap
  fullAddress: StudentAddress;

  // Keluarga
  motherName: string;
  motherNik: string;
  motherOccupation: string;
  motherEducation: string;
  fatherName: string;
  fatherNik: string;
  fatherOccupation: string;
  fatherEducation: string;
  guardianContact: string;

  // Prestasi (Ref ke collection)
  achievementIds: string[];

  // Dokumen URL
  documents: StudentDocuments;

  createdAt: number;
  updatedAt: number;
}

export enum CurationColor {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  ORANGE = 'ORANGE',
  RED = 'RED',
  GOLD = 'GOLD',
}

export enum CompetitionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export interface CompetitionRound {
  name: string;
  date: number; // timestamp
}

export interface Competition {
  id: string;
  title: string;
  field: string[];                // Bidang Lomba
  registrationDeadline: number; // timestamp
  rounds: CompetitionRound[];   // Tanggal Pelaksanaan
  fee: number;                  // Biaya
  type: 'Daring' | 'Luring' | 'Hybrid'; // Jenis Lomba
  status: CompetitionStatus;    // Status Pendaftaran
  location: string;
  guidebookUrl: string;         // Link Guidebook/Pendaftaran
  description: string;
  posterUrl: string;            // URL Gambar Poster
  curationColor: CurationColor;
  
  proposedByUserId?: string;
  isApproved?: boolean;

  createdAt: number;
  updatedAt: number;
}

export enum RegistrationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface RoundChecklist {
  roundName: string;
  passed: boolean;
  notes: string;
}

export interface Registration {
  id: string;
  studentId: string;
  studentName?: string;
  competitionId: string;
  competitionTitle: string;
  status: RegistrationStatus;
  roundsChecklist?: RoundChecklist[];
  finalResult?: MedalType;
  createdAt: number;
  updatedAt: number;
}

export enum MedalType {
  GOLD = 'GOLD',
  SILVER = 'SILVER',
  BRONZE = 'BRONZE',
  FINALS = 'FINALS',
  PARTICIPANT = 'PARTICIPANT',
}

export interface Achievement {
  id: string;
  studentId: string;
  competitionId: string;
  medalType: MedalType;
  points: number;
  
  createdAt: number;
  updatedAt: number;
}

export interface OSN {
  id: string;
  placeholder?: string;
}

export enum Mood {
  GREAT = 'GREAT',
  GOOD = 'GOOD',
  NEUTRAL = 'NEUTRAL',
  BAD = 'BAD',
  TERRIBLE = 'TERRIBLE',
}

export interface GuidanceLog {
  id: string;
  studentId: string;
  studentName?: string;
  date: number; // timestamp
  academicSubject: string;
  studyProgress: string;
  questionsCompleted?: number; // Jumlah Soal yang dikerjakan hari ini
  summaryPages?: number; // Jumlah Halaman Ringkasan hari ini
  studyHours?: number; // Jam Belajar hari ini
  mood: Mood;
  psychologicalNotes: string;
  createdAt: number;
}

export interface OsnAnnouncement {
  id?: string;
  title: string;
  content: string;
}

export interface OsnBankSoal {
  id?: string;
  title: string;
  subject: string;
  fileUrl: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: string; // STUDENT, ADMIN, MANAGEMENT
  text: string;
  imageUrl?: string;
  createdAt: number;
}
