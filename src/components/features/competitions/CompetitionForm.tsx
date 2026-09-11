import React, { useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Competition, CompetitionStatus, CurationColor } from '../../../types';
import { createCompetition, updateCompetition } from '../../../services/competitionService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Checkbox } from '../../../components/ui/checkbox';
import { toast } from 'sonner';

const PREDEFINED_FIELDS = [
  'IPA', 'IPS', 'Matematika', 'Astronomi', 'Geografi', 
  'Fisika', 'Biologi', 'Kimia', 'Kebumian', 'Ekonomi', 
  'Informatika', 'Logika'
];
import { Plus, Trash2, Wand2, Loader2, Image as ImageIcon, UploadCloud, Copy, Terminal } from 'lucide-react';
import { useAuth } from "../../../context/AuthContext";
import { emptyImagePlaceholder } from "../../../lib/assets";
import { LOGO_BASE64 } from "../../../lib/constants";

import { UserRole } from '../../../types/auth';

const formSchema = z.object({
  title: z.string().min(1, 'Judul wajib diisi'),
  field: z.array(z.string()).min(1, 'Bidang wajib diisi minimal 1'),
  type: z.enum(['Daring', 'Luring', 'Hybrid']),
  curationColor: z.nativeEnum(CurationColor),
  registrationDeadline: z.string().min(1),
  fee: z.number().min(0),
  location: z.string().optional(),
  guidebookUrl: z.string().optional(),
  posterUrl: z.string().optional(),
  description: z.string().optional(),
  rounds: z.array(z.object({
    name: z.string().min(1),
    date: z.string().min(1),
  })).min(1, "Minimal 1 babak perlombaan")
});

type FormValues = z.infer<typeof formSchema>;

export function CompetitionForm({ onSuccess, initialData }: { onSuccess: () => void, initialData?: Competition | null }) {
  const { userRole, currentUser } = useAuth();
  const isAdminOrManagement = userRole === UserRole.ADMIN || userRole === UserRole.MANAGEMENT;
  
  const [submitting, setSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.posterUrl || null);
  const [isManualAiOpen, setIsManualAiOpen] = useState(false);
  const [manualAiInput, setManualAiInput] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      title: initialData.title,
      field: Array.isArray(initialData.field) ? initialData.field : [initialData.field].filter(Boolean) as string[],
      type: initialData.type,
      curationColor: initialData.curationColor,
      registrationDeadline: new Date(initialData.registrationDeadline).toISOString().split('T')[0],
      fee: initialData.fee,
      location: initialData.location || '',
      guidebookUrl: initialData.guidebookUrl || '',
      posterUrl: initialData.posterUrl || '',
      description: initialData.description || '',
      rounds: initialData.rounds.map(r => ({ name: r.name, date: new Date(r.date).toISOString().split('T')[0] }))
    } : {
      type: 'Daring',
      curationColor: CurationColor.GREEN,
      fee: 0,
      rounds: [{ name: 'Penyisihan', date: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rounds",
  });

  
  const handleApplyManualAI = () => {
    try {
      // Allow user to paste with or without markdown backticks
      let cleanInput = manualAiInput.trim();
      if (cleanInput.startsWith('```json')) {
        cleanInput = cleanInput.replace(/```json/g, '').replace(/```/g, '').trim();
      } else if (cleanInput.startsWith('```')) {
        cleanInput = cleanInput.replace(/```/g, '').trim();
      }
      
      const data = JSON.parse(cleanInput);
      
      if (data.title) form.setValue('title', data.title);
      if (data.field && Array.isArray(data.field)) {
        const validFields = data.field.filter((f: string) => PREDEFINED_FIELDS.includes(f));
        form.setValue('field', validFields);
      }
      if (data.type && ['Daring', 'Luring', 'Hybrid'].includes(data.type)) form.setValue('type', data.type as 'Daring' | 'Luring' | 'Hybrid');
      if (data.registrationDeadline) form.setValue('registrationDeadline', data.registrationDeadline);
      if (data.fee !== undefined) form.setValue('fee', Number(data.fee) || 0);
      if (data.location) form.setValue('location', data.location);
      if (data.description) form.setValue('description', data.description);
      
      if (data.rounds && Array.isArray(data.rounds) && data.rounds.length > 0) {
        // Clear existing rounds
        const currentRounds = form.getValues('rounds');
        for (let i = currentRounds.length - 1; i >= 0; i--) {
          remove(i);
        }
        // Add new rounds
        data.rounds.forEach((r: any) => {
          if (r.name && r.date) {
            append({ name: r.name, date: r.date });
          }
        });
      }
      
      setIsManualAiOpen(false);
      setManualAiInput('');
      toast.success('Data dari AI berhasil diterapkan ke form!');
    } catch (err) {
      toast.error('Format JSON tidak valid. Pastikan Anda menyalin persis seperti balasan AI.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran maksimal file adalah 2MB');
      return;
    }

    setSelectedFile(file);
    if (previewUrl && !previewUrl.startsWith('http')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const getCompressedBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleGenerateAI = async () => {
    if (!selectedFile) {
      toast.error('Silakan pilih file poster terlebih dahulu');
      return;
    }

    setIsGenerating(true);
    toast.info('AI sedang mengekstrak data dari poster...');

    try {
      const base64Data = await getCompressedBase64(selectedFile);
      
      const response = await fetch('/api/extract-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: base64Data || emptyImagePlaceholder,
          mimeType: 'image/jpeg'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal membaca poster');
      }

      const parsedData = await response.json();
      
      form.setValue('title', parsedData.title || '');
      let mappedFields: string[] = [];
      if (Array.isArray(parsedData.field)) {
        mappedFields = parsedData.field;
      } else if (typeof parsedData.field === 'string') {
        mappedFields = [parsedData.field];
      }
      form.setValue('field', mappedFields);
      form.setValue('type', parsedData.type === 'Luring' ? 'Luring' : parsedData.type === 'Hybrid' ? 'Hybrid' : 'Daring');
      if (parsedData.registrationDeadline) form.setValue('registrationDeadline', parsedData.registrationDeadline);
      form.setValue('fee', parsedData.fee || 0);
      form.setValue('location', parsedData.location || '');
      form.setValue('description', parsedData.description || '');
      
      if (parsedData.rounds && Array.isArray(parsedData.rounds) && parsedData.rounds.length > 0) {
        const existingRoundsCount = form.getValues('rounds').length;
        for (let i = existingRoundsCount - 1; i >= 0; i--) {
          remove(i);
        }
        parsedData.rounds.forEach((r: any) => {
          append({ name: r.name || '', date: r.date || '' });
        });
      }

      toast.success('Data berhasil diekstrak! Silakan review kembali isian form.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal mengekstrak data menggunakan AI');
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);

    try {
      let finalPosterUrl = values.posterUrl;

      if (selectedFile) {
        toast.info('Memproses poster...');
        const compressedBase64 = await getCompressedBase64(selectedFile);
        finalPosterUrl = compressedBase64;
      }

      const payload: Omit<Competition, 'id'> = {
        title: values.title,
        field: values.field,
        type: values.type,
        status: initialData ? initialData.status : CompetitionStatus.OPEN,
        curationColor: values.curationColor,
        registrationDeadline: new Date(values.registrationDeadline).getTime(),
        fee: values.fee,
        location: values.location || '',
        guidebookUrl: values.guidebookUrl || '',
        posterUrl: finalPosterUrl || '',
        description: values.description || '',
        rounds: values.rounds.map(r => ({
          name: r.name,
          date: new Date(r.date).getTime(),
        })),
        proposedByUserId: initialData?.proposedByUserId || currentUser?.uid,
        isApproved: isAdminOrManagement ? true : (initialData?.isApproved ?? false), // Admin/Mgmt auto approves or overrides, normal user keeps it pending
        createdAt: initialData ? initialData.createdAt : Date.now(),
        updatedAt: Date.now()
      };

      if (initialData) {
        await updateCompetition(initialData.id, payload);
        toast.success('Lomba berhasil diperbarui');
      } else {
        const id = `comp_${Date.now()}`;
        await createCompetition(id, payload);
        toast.success('Lomba berhasil ditambahkan');
      }

      onSuccess();
    } catch (error: any) {
      toast.error(`Gagal menyimpan lomba: ${error.message || 'Error tidak diketahui'}`);
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-start gap-2">
          <CardTitle>Tambah Lomba Baru</CardTitle>
          <CardDescription>Masukkan detail lomba ke dalam sistem katalog, atau gunakan AI untuk mengekstrak data dari poster otomatis.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 border rounded-lg bg-muted/30">
          <Label className="mb-2 block font-semibold">Upload Poster & Generate Form (AI)</Label>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button 
              type="button" 
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isGenerating || submitting}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Pilih File Poster
            </Button>
            
            {selectedFile && (
              <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={selectedFile.name}>
                {selectedFile.name}
              </span>
            )}

            
            <div className="flex gap-2">
              <Button 
                type="button" 
                className="bg-purple-600/50 hover:bg-purple-600/50 text-white shadow-sm cursor-not-allowed"
                disabled={true}
                title="Fitur dinonaktifkan sementara karena limit API. Gunakan tombol Manual AI di sebelahnya."
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Generate AI (Dinonaktifkan)
              </Button>
              
              <Dialog open={isManualAiOpen} onOpenChange={setIsManualAiOpen}>
                <DialogTrigger render={<Button type="button" variant="secondary" className="border border-purple-200 text-purple-700 hover:bg-purple-100" />}>
                  <Terminal className="mr-2 h-4 w-4" />
                  Isi Manual via AI Lain
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Isi Form via AI Eksternal (ChatGPT/Gemini/Claude)</DialogTitle>
                    <DialogDescription>
                      Karena API internal sedang mencapai batas, Anda bisa menggunakan AI pihak ketiga secara gratis untuk mengekstrak data poster.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 my-2">
                    <div className="p-4 bg-muted rounded-md text-sm">
                      <p className="font-semibold mb-2">Langkah-langkah:</p>
                      <ol className="list-decimal pl-5 space-y-1">
                        <li>Buka ChatGPT (chatgpt.com) atau Gemini (gemini.google.com) di tab baru.</li>
                        <li>Upload poster lomba Anda ke chat tersebut.</li>
                        <li>Copy teks prompt (perintah) di bawah ini dan paste ke chat AI.</li>
                        <li>Copy balasan AI (yang berbentuk format JSON), lalu paste ke kotak di bawah ini.</li>
                      </ol>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="font-semibold">Prompt untuk AI (Copy ini):</Label>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            navigator.clipboard.writeText(`Tolong ekstrak informasi kompetisi/lomba dari poster yang saya lampirkan ini. Balas HANYA dengan JSON mentah sesuai format berikut, tanpa penjelasan apa pun, tanpa markdown backticks (jangan gunakan \`\`\`json). Format:
{
  "title": "Judul Acara",
  "field": ["IPA", "Matematika", "dsb (Pilih dari: IPA, IPS, Matematika, Astronomi, Geografi, Fisika, Biologi, Kimia, Kebumian, Ekonomi, Informatika, Logika)"],
  "type": "Daring", // (Daring/Luring/Hybrid)
  "registrationDeadline": "YYYY-MM-DD",
  "fee": 0, // angka murni tanpa titik/koma
  "location": "Nama Tempat/Platform",
  "description": "Deskripsi singkat",
  "rounds": [
    { "name": "Penyisihan", "date": "YYYY-MM-DD" }
  ]
}`);
                            toast.success("Prompt disalin!");
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copy Prompt
                        </Button>
                      </div>
                      <div className="p-3 bg-slate-900 text-slate-100 rounded-md text-xs font-mono whitespace-pre-wrap">
                        {`Tolong ekstrak informasi kompetisi/lomba dari poster yang saya lampirkan ini. Balas HANYA dengan JSON mentah sesuai format berikut, tanpa penjelasan apa pun, tanpa markdown backticks (jangan gunakan \`\`\`json). Format:
{
  "title": "Judul Acara",
  "field": ["IPA", "Matematika", "dsb (Pilih dari: IPA, IPS, Matematika, Astronomi, Geografi, Fisika, Biologi, Kimia, Kebumian, Ekonomi, Informatika, Logika)"],
  "type": "Daring", // (Daring/Luring/Hybrid)
  "registrationDeadline": "YYYY-MM-DD",
  "fee": 0, // angka murni tanpa titik/koma
  "location": "Nama Tempat/Platform",
  "description": "Deskripsi singkat",
  "rounds": [
    { "name": "Penyisihan", "date": "YYYY-MM-DD" }
  ]
}`}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="font-semibold mb-1 block">Paste Balasan AI di sini:</Label>
                      <Textarea 
                        placeholder={'{\n  "title": "Olimpiade Sains",\n  ...\n}'}
                        className="font-mono text-xs min-h-[150px]"
                        value={manualAiInput}
                        onChange={(e) => setManualAiInput(e.target.value)}
                      />
                    </div>
                    
                    <Button onClick={handleApplyManualAI} className="w-full">
                      Terapkan Data ke Form
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {previewUrl && (
            <div className="mt-4 rounded-md overflow-hidden border bg-muted w-full max-w-[200px]">
              <img src={previewUrl} alt="Preview Poster" className="w-full h-auto object-cover" />
            </div>
          )}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Judul Lomba</Label>
                <Input {...form.register('title')} placeholder="Contoh: KSM Nasional 2024" />
                {form.formState.errors.title && <p className="text-red-500 text-xs">{form.formState.errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Bidang</Label>
                <div className="grid grid-cols-3 gap-2 border p-3 rounded-md">
                  {PREDEFINED_FIELDS.map((f) => {
                    const rawFields = form.watch('field');
                    const currentFields = Array.isArray(rawFields) ? rawFields : [];
                    return (
                      <div key={f} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`field-${f}`} 
                          checked={currentFields.includes(f)} 
                          onCheckedChange={(checked) => {
                            if (checked) {
                              form.setValue('field', [...currentFields, f]);
                            } else {
                              form.setValue('field', currentFields.filter(cf => cf !== f));
                            }
                          }}
                        />
                        <label htmlFor={`field-${f}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {f}
                        </label>
                      </div>
                    );
                  })}
                </div>
                {form.formState.errors.field && <p className="text-red-500 text-xs">{form.formState.errors.field.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipe Pelaksanaan</Label>
                  <Select onValueChange={(val) => form.setValue('type', val as any)} value={form.watch('type')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daring">Daring (Online)</SelectItem>
                      <SelectItem value="Luring">Luring (Offline)</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Batas Pendaftaran</Label>
                  <Input type="date" {...form.register('registrationDeadline')} />
                  {form.formState.errors.registrationDeadline && <p className="text-red-500 text-xs">{form.formState.errors.registrationDeadline.message}</p>}
                </div>
                {isAdminOrManagement && (
                  <div className="space-y-2">
                    <Label>Kurasi Admin</Label>
                    <Select onValueChange={(val) => form.setValue('curationColor', val as any)} value={form.watch('curationColor')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CurationColor.GOLD}>Lembaga Negara (GOLD)</SelectItem>
                        <SelectItem value={CurationColor.GREEN}>Hijau (Sangat Disarankan)</SelectItem>
                        <SelectItem value={CurationColor.YELLOW}>Kuning (Sangat Disarankan)</SelectItem>
                        <SelectItem value={CurationColor.ORANGE}>Oranye (Disarankan)</SelectItem>
                        <SelectItem value={CurationColor.RED}>Merah (Tidak Disarankan)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Lokasi / Penyelenggara</Label>
                <Input {...form.register('location')} placeholder="Contoh: Universitas Indonesia" />
              </div>
              <div className="space-y-2">
                <Label>Biaya Pendaftaran (Rp)</Label>
                <Input type="number" {...form.register('fee', { valueAsNumber: true })} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rangkaian Babak Lomba</Label>
                <div className="space-y-2 border rounded-md p-4 bg-muted/20">
                  {fields.map((item, index) => (
                    <div key={item.id} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Input size={1} {...form.register(`rounds.${index}.name`)} placeholder="Nama Babak (Semifinal)" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Input type="date" {...form.register(`rounds.${index}.date`)} />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', date: '' })}>
                    <Plus className="h-4 w-4 mr-2" /> Tambah Jadwal Babak
                  </Button>
                  {form.formState.errors.rounds && <p className="text-red-500 text-xs text-center">{form.formState.errors.rounds.message}</p>}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>URL Gambar Poster (Opsional)</Label>
                <div className="flex gap-2">
                  <Input {...form.register('posterUrl')} placeholder="https://... (Kosongkan jika upload di atas)" className="flex-1" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Tips: Jika gambar dari Instagram, Anda bisa mengekstrak link-nya melalui <a href="https://fastdl.app/photo" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">fastdl.app/photo</a>
                </p>
                {form.watch('posterUrl') && !previewUrl && (
                  <div className="mt-2 rounded-md overflow-hidden border bg-muted/50 w-full max-w-[200px]">
                    <img src={form.watch('posterUrl')} alt="Preview Poster" className="w-full h-auto object-cover" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>URL Guidebook (Opsional)</Label>
                <Input {...form.register('guidebookUrl')} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Deskripsi / Keterangan</Label>
                <Textarea {...form.register('description')} rows={3} placeholder="Syarat, ketentuan, dll..." />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || isGenerating}>
              {submitting ? 'Menyimpan...' : (initialData ? 'Perbarui Lomba' : 'Simpan Lomba ke Katalog')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
