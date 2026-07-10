import { z } from 'zod';

const AddressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  rtRw: z.string().optional(),
  village: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
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
  nisn: z.string().optional(),
  grade: z.string().optional(),
  osnField: z.string().optional(),
  nik: z.string().optional(),
  religion: z.string().optional(),
  birthPlace: z.string().optional(),
  birthDate: z.string().optional(), 
  specialNeeds: z.string().optional(),
  isColorBlind: z.boolean().optional(),
  weightKg: z.number().optional().or(z.nan()),
  heightCm: z.number().optional().or(z.nan()),
  
  // Kontak
  activeEmail: z.string().email('Email tidak valid').optional().or(z.literal('')),
  semestaEmail: z.string().email('Email tidak valid').optional().or(z.literal('')),
  activePhoneWA: z.string().optional(),
  
  // Alamat Singkat
  homeAddress: z.string().optional(),
  houseNumber: z.string().optional(),
  rtRw: z.string().optional(),
  postalCode: z.string().optional(),

  // Alamat Lengkap
  fullAddress: AddressSchema.optional(),

  // Orang Tua
  motherName: z.string().optional(),
  motherNik: z.string().optional(),
  motherOccupation: z.string().optional(),
  motherEducation: z.string().optional(),
  fatherName: z.string().optional(),
  fatherNik: z.string().optional(),
  fatherOccupation: z.string().optional(),
  fatherEducation: z.string().optional(),
  guardianContact: z.string().optional(),

  documents: DocumentsSchema.optional(),
  
  // Field-file uploads validation are handled at Component level using logic
});

export type StudentFormValues = z.infer<typeof StudentFormSchema>;
