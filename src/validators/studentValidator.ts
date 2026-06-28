import { z } from 'zod';

const AddressSchema = z.object({
  street: z.string().min(1, 'Jalan wajib diisi'),
  number: z.string().min(1, 'No wajib diisi'),
  rtRw: z.string().min(1, 'RT/RW wajib diisi'),
  village: z.string().min(1, 'Kelurahan wajib diisi'),
  district: z.string().min(1, 'Kecamatan wajib diisi'),
  city: z.string().min(1, 'Kab/Kota wajib diisi'),
  province: z.string().min(1, 'Provinsi wajib diisi'),
  postalCode: z.string().min(1, 'Kode Pos wajib diisi'),
});

const DocumentsSchema = z.object({
  photoUrl: z.string().optional(),
  studentCardUrl: z.string().optional(),
  familyCardUrl: z.string().optional(),
  birthCertificateUrl: z.string().optional(),
  idCardUrl: z.string().optional(),
});

export const StudentFormSchema = z.object({
  // Pribadi
  fullName: z.string().min(1, 'Nama Lengkap wajib diisi'),
  nisn: z.string().min(1, 'NISN wajib diisi'),
  grade: z.string().min(1, 'Kelas wajib diisi'),
  osnField: z.string().min(1, 'Bidang OSN wajib diisi'),
  nik: z.string().min(1, 'NIK wajib diisi'),
  religion: z.string().min(1, 'Agama wajib diisi'),
  birthPlace: z.string().min(1, 'Tempat Lahir wajib diisi'),
  birthDate: z.string().min(1, 'Tanggal Lahir wajib diisi'), // We'll convert to timestamp later
  specialNeeds: z.string().optional(),
  isColorBlind: z.boolean(),
  weightKg: z.number().min(1, 'Berat Badan wajib diisi'),
  heightCm: z.number().min(1, 'Tinggi Badan wajib diisi'),
  
  // Kontak
  activeEmail: z.string().email('Email tidak valid'),
  semestaEmail: z.string().email('Email tidak valid').optional(),
  activePhoneWA: z.string().min(1, 'No HP (WA) wajib diisi'),
  
  // Alamat Singkat
  homeAddress: z.string().min(1, 'Alamat Rumah singkat wajib diisi'),
  houseNumber: z.string().min(1, 'No Rumah wajib diisi'),
  rtRw: z.string().min(1, 'RT/RW singkat wajib diisi'),
  postalCode: z.string().min(1, 'Kode Pos singkat wajib diisi'),

  // Alamat Lengkap
  fullAddress: AddressSchema,

  // Orang Tua
  motherName: z.string().min(1, 'Nama Ibu wajib diisi'),
  motherNik: z.string().min(1, 'NIK Ibu wajib diisi'),
  motherOccupation: z.string().min(1, 'Pekerjaan Ibu wajib diisi'),
  motherEducation: z.string().min(1, 'Pendidikan Ibu wajib diisi'),
  fatherName: z.string().min(1, 'Nama Ayah wajib diisi'),
  fatherNik: z.string().min(1, 'NIK Ayah wajib diisi'),
  fatherOccupation: z.string().min(1, 'Pekerjaan Ayah wajib diisi'),
  fatherEducation: z.string().min(1, 'Pendidikan Ayah wajib diisi'),
  guardianContact: z.string().optional(), // Or mandatory?

  documents: DocumentsSchema.optional(),
  
  // Field-file uploads validation are handled at Component level using logic
});

export type StudentFormValues = z.infer<typeof StudentFormSchema>;
