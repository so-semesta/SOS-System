import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StudentFormSchema, StudentFormValues } from '../../../validators/studentValidator';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Checkbox } from '../../ui/checkbox';
import { toast } from 'sonner';
import { Student } from '../../../types';

interface StudentProfileFormProps {
  initialData?: Student | null;
  studentId: string;
  onSave: (data: Partial<Student>) => void;
  isLoading?: boolean;
}

export function StudentProfileForm({ initialData, studentId, onSave, isLoading }: StudentProfileFormProps) {
  const [activeTab, setActiveTab] = useState('pribadi');

  // Custom default values transforming timestamp to yyyy-mm-dd
  const formatDefaultDate = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
  };

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(StudentFormSchema),
    defaultValues: initialData ? {
      ...initialData,
      birthDate: formatDefaultDate(initialData.birthDate),
    } : {
      isColorBlind: false,
      documents: {}
    } as any,
  });

  const { register, handleSubmit, formState: { errors }, control, watch, setValue } = form;

  const onSubmit = (values: StudentFormValues) => {
    try {
      const birthDateTimestamp = new Date(values.birthDate).getTime();
      const updatedData: Partial<Student> = {
        ...values,
        documents: values.documents as any,
        birthDate: birthDateTimestamp,
        updatedAt: Date.now(),
      };
      
      onSave(updatedData);
    } catch (error) {
      toast.error('Gagal menyimpan profil.');
    }
  };

  const handleNextTab = (current: string) => {
    const tabs = ['pribadi', 'kontak', 'alamat', 'ortu'];
    const idx = tabs.indexOf(current);
    if (idx >= 0 && idx < tabs.length - 1) {
      setActiveTab(tabs[idx + 1]);
    }
  };

  const uploadedDocs = watch('documents');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Profil Siswa</CardTitle>
        <CardDescription>Lengkapi data profil Anda dengan akurat. Anda menggunakan ID: {studentId}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 md:grid-cols-4 mb-8 h-auto gap-2">
              <TabsTrigger value="pribadi" className="py-2 text-xs md:text-sm">Data Pribadi</TabsTrigger>
              <TabsTrigger value="kontak" className="py-2 text-xs md:text-sm">Kontak</TabsTrigger>
              <TabsTrigger value="alamat" className="py-2 text-xs md:text-sm">Alamat Lengkap</TabsTrigger>
              <TabsTrigger value="ortu" className="py-2 text-xs md:text-sm">Data Orang Tua</TabsTrigger>
            </TabsList>

            {/* TAB PRIBADI */}
            <TabsContent value="pribadi" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Lengkap</Label>
                  <Input {...register('fullName')} placeholder="Nama Lengkap sesuai Akte" />
                  {errors.fullName && <p className="text-red-500 text-xs">{errors.fullName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>NISN</Label>
                  <Input {...register('nisn')} placeholder="NISN" />
                  {errors.nisn && <p className="text-red-500 text-xs">{errors.nisn.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Kelas</Label>
                  <Input {...register('grade')} placeholder="Misal: 10A" />
                  {errors.grade && <p className="text-red-500 text-xs">{errors.grade.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Bidang OSN</Label>
                  <Controller
                    control={control}
                    name="osnField"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Bidang OSN" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IPA">IPA</SelectItem>
                          <SelectItem value="IPS">IPS</SelectItem>
                          <SelectItem value="Matematika SMP">Matematika SMP</SelectItem>
                          <SelectItem value="Matematika SMA">Matematika SMA</SelectItem>
                          <SelectItem value="Astronomi">Astronomi</SelectItem>
                          <SelectItem value="Geografi">Geografi</SelectItem>
                          <SelectItem value="Fisika">Fisika</SelectItem>
                          <SelectItem value="Biologi">Biologi</SelectItem>
                          <SelectItem value="Kimia">Kimia</SelectItem>
                          <SelectItem value="Kebumian">Kebumian</SelectItem>
                          <SelectItem value="Ekonomi">Ekonomi</SelectItem>
                          <SelectItem value="Informatika">Informatika</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.osnField && <p className="text-red-500 text-xs">{errors.osnField.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>NIK</Label>
                  <Input {...register('nik')} placeholder="NIK sesuai KTP/KIA/Kk" />
                  {errors.nik && <p className="text-red-500 text-xs">{errors.nik.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Agama</Label>
                  <Input {...register('religion')} placeholder="Agama" />
                  {errors.religion && <p className="text-red-500 text-xs">{errors.religion.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Tempat Lahir</Label>
                  <Input {...register('birthPlace')} placeholder="Tempat Lahir" />
                  {errors.birthPlace && <p className="text-red-500 text-xs">{errors.birthPlace.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Lahir</Label>
                  <Input type="date" {...register('birthDate')} />
                  {errors.birthDate && <p className="text-red-500 text-xs">{errors.birthDate.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Kebutuhan Khusus</Label>
                  <Input {...register('specialNeeds')} placeholder="Penyakit / Alergi dll (Opsional)" />
                </div>
                <div className="space-y-2">
                  <Label>Berat Badan (kg)</Label>
                  <Input type="number" {...register('weightKg', { valueAsNumber: true })} />
                  {errors.weightKg && <p className="text-red-500 text-xs">{errors.weightKg.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Tinggi Badan (cm)</Label>
                  <Input type="number" {...register('heightCm', { valueAsNumber: true })} />
                  {errors.heightCm && <p className="text-red-500 text-xs">{errors.heightCm.message}</p>}
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Controller
                    name="isColorBlind"
                    control={control}
                    render={({ field }) => (
                      <Checkbox id="colorBlind" checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                  <Label htmlFor="colorBlind">Apakah Buta Warna?</Label>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="button" onClick={() => handleNextTab('pribadi')}>Selanjutnya</Button>
              </div>
            </TabsContent>

            {/* TAB KONTAK */}
            <TabsContent value="kontak" className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email Aktif</Label>
                  <Input type="email" {...register('activeEmail')} placeholder="email@gmail.com" />
                  {errors.activeEmail && <p className="text-red-500 text-xs">{errors.activeEmail.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Email Sekolah (Semesta)</Label>
                  <Input type="email" {...register('semestaEmail')} placeholder="nama@semesta.sch.id" />
                  {errors.semestaEmail && <p className="text-red-500 text-xs">{errors.semestaEmail.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>No HP Aktif (WA)</Label>
                  <Input {...register('activePhoneWA')} placeholder="08..." />
                  {errors.activePhoneWA && <p className="text-red-500 text-xs">{errors.activePhoneWA.message}</p>}
                </div>
               </div>
               <div className="flex justify-end pt-4">
                <Button type="button" onClick={() => handleNextTab('kontak')}>Selanjutnya</Button>
              </div>
            </TabsContent>

            {/* TAB ALAMAT */}
            <TabsContent value="alamat" className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Alamat Singkat */}
                 <div className="space-y-4 bg-muted/20 p-4 rounded-lg">
                    <h3 className="font-semibold border-b pb-2">Alamat Singkat</h3>
                    <div className="space-y-2">
                      <Label>Jalan / Perumahan</Label>
                      <Input {...register('homeAddress')} />
                    </div>
                    <div className="space-y-2">
                      <Label>No Rumah</Label>
                      <Input {...register('houseNumber')} />
                    </div>
                    <div className="space-y-2">
                      <Label>RT / RW</Label>
                      <Input {...register('rtRw')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Kode Pos</Label>
                      <Input {...register('postalCode')} />
                    </div>
                 </div>

                 {/* Alamat Lengkap */}
                 <div className="space-y-4 bg-muted/20 p-4 rounded-lg">
                    <h3 className="font-semibold border-b pb-2">Detail Lokasi</h3>
                    <div className="space-y-2">
                      <Label>Jalan (Lengkap)</Label>
                      <Input {...register('fullAddress.street')} />
                    </div>
                    <div className="space-y-2">
                      <Label>No Rumah (Lengkap)</Label>
                      <Input {...register('fullAddress.number')} />
                    </div>
                    <div className="space-y-2">
                      <Label>RT / RW (Lengkap)</Label>
                      <Input {...register('fullAddress.rtRw')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Kelurahan / Desa</Label>
                      <Input {...register('fullAddress.village')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Kecamatan</Label>
                      <Input {...register('fullAddress.district')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Kabupaten / Kota</Label>
                      <Input {...register('fullAddress.city')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Provinsi</Label>
                      <Input {...register('fullAddress.province')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Kode Pos (Detail)</Label>
                      <Input {...register('fullAddress.postalCode')} />
                    </div>
                 </div>
               </div>
               <div className="flex justify-end pt-4">
                <Button type="button" onClick={() => handleNextTab('alamat')}>Selanjutnya</Button>
               </div>
            </TabsContent>

            {/* TAB DATA ORANG TUA */}
            <TabsContent value="ortu" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Ibu */}
                 <div className="space-y-4 bg-muted/20 p-4 rounded-lg border-l-4 border-l-pink-400">
                    <h3 className="font-semibold mb-2">Data Ibu</h3>
                    <div className="space-y-2">
                      <Label>Nama Ibu Lengkap</Label>
                      <Input {...register('motherName')} />
                    </div>
                    <div className="space-y-2">
                      <Label>NIK Ibu</Label>
                      <Input {...register('motherNik')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Pendidikan Terakhir</Label>
                      <Input {...register('motherEducation')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Pekerjaan</Label>
                      <Input {...register('motherOccupation')} />
                    </div>
                 </div>

                 {/* Ayah */}
                 <div className="space-y-4 bg-muted/20 p-4 rounded-lg border-l-4 border-l-blue-400">
                    <h3 className="font-semibold mb-2">Data Ayah</h3>
                    <div className="space-y-2">
                      <Label>Nama Ayah Lengkap</Label>
                      <Input {...register('fatherName')} />
                    </div>
                    <div className="space-y-2">
                      <Label>NIK Ayah</Label>
                      <Input {...register('fatherNik')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Pendidikan Terakhir</Label>
                      <Input {...register('fatherEducation')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Pekerjaan</Label>
                      <Input {...register('fatherOccupation')} />
                    </div>
                 </div>

                 {/* Kontak Wali */}
                 <div className="space-y-2 md:col-span-2 mt-4">
                    <Label>Kontak Orang Tua / Wali Aktif</Label>
                    <Input {...register('guardianContact')} placeholder="08..." />
                 </div>
              </div>
              <div className="flex justify-end pt-8 relative z-10">
                <Button type="submit" disabled={isLoading} className="w-full md:w-auto mt-6" size="lg">
                  {isLoading ? 'Menyimpan...' : 'Simpan Seluruh Data Profil'}
                </Button>
              </div>
            </TabsContent>

          </Tabs>
        </form>
      </CardContent>
    </Card>
  );
}
