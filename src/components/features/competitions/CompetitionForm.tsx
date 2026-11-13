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
import { Plus, Trash2, Wand2, Loader2, Image as ImageIcon, UploadCloud, Copy, Terminal, ClipboardPaste, Check, X } from 'lucide-react';
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
  const isAdminOrManagement = userRole === UserRole.ADMIN || userRole === UserRole.MANAGEMENT || userRole === UserRole.ADMIN_SOS || userRole === UserRole.ADMIN_STUDENT;
  const isRegularStudent = userRole === UserRole.STUDENT;
  
  const [submitting, setSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.posterUrl || null);
  const [isManualAiOpen, setIsManualAiOpen] = useState(false);
  const [manualAiInput, setManualAiInput] = useState('');
  const [manualPosterInput, setManualPosterInput] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedBase64, setCopiedBase64] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const MANUAL_AI_PROMPT = `Tolong ekstrak informasi kompetisi/lomba dari poster yang saya lampirkan ini. Balas HANYA dengan JSON mentah sesuai format berikut, tanpa penjelasan apa pun, tanpa markdown backticks (jangan gunakan \`\`\`json). Format:
{
  "title": "Judul Acara",
  "field": ["IPA", "Matematika", "dsb (Pilih dari: IPA, IPS, Matematika, Astronomi, Geografi, Fisika, Biologi, Kimia, Kebumian, Ekonomi, Informatika, Logika)"],
  "type": "Daring",
  "registrationDeadline": "YYYY-MM-DD",
  "fee": 0,
  "location": "Nama Tempat/Platform",
  "guidebookUrl": "https://... (opsional, kosongkan jika tidak ada)",
  "posterUrl": "https://... (opsional URL langsung gambar poster jika ada)",
  "description": "Deskripsi singkat",
  "rounds": [
    { "name": "Penyisihan", "date": "YYYY-MM-DD" }
  ]
}`;

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

  
  const compressImageSourceToBase64 = (source: Blob | string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const processDataUrl = (dataUrlInput: string) => {
        const img = new Image();
        img.src = dataUrlInput;
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

      if (typeof source === 'string') {
        processDataUrl(source);
      } else {
        const reader = new FileReader();
        reader.readAsDataURL(source);
        reader.onload = (event) => {
          processDataUrl(event.target?.result as string);
        };
        reader.onerror = (err) => reject(err);
      }
    });
  };

  const applyPastedPosterValue = (val: string, target: 'form' | 'modal') => {
    if (target === 'modal') {
      setManualPosterInput(val);
    } else {
      setSelectedFile(null);
      form.setValue('posterUrl', val);
      setPreviewUrl(val || null);
    }
  };

  const handleImageBlobToSlot = async (blob: Blob, target: 'form' | 'modal') => {
    try {
      toast.loading('Mengonversi & mengompresi gambar ke Base64...', { id: 'paste-poster' });
      const compressedBase64 = await compressImageSourceToBase64(blob);
      applyPastedPosterValue(compressedBase64, target);
      const sizeKb = Math.round((compressedBase64.length * 3) / 4 / 1024);
      toast.success(`Gambar berhasil ditempel ke Base64 (~${sizeKb} KB)!`, { id: 'paste-poster' });
    } catch (err) {
      console.error('Error converting pasted image:', err);
      toast.error('Gagal memproses gambar dari clipboard.', { id: 'paste-poster' });
    }
  };

  const handlePasteClipboard = async (e: React.ClipboardEvent, target: 'form' | 'modal') => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          await handleImageBlobToSlot(blob, target);
        }
        return;
      }
    }

    // If pasted text is an oversized data:image Base64 string (> 350KB), compress it
    const text = e.clipboardData.getData('text');
    if (text && text.trim().startsWith('data:image/') && text.length > 350 * 1024) {
      e.preventDefault();
      try {
        toast.loading('Mengompresi Base64 agar aman disimpan...', { id: 'paste-poster' });
        const compressed = await compressImageSourceToBase64(text.trim());
        applyPastedPosterValue(compressed, target);
        const sizeKb = Math.round((compressed.length * 3) / 4 / 1024);
        toast.success(`Base64 dikompresi menjadi ~${sizeKb} KB!`, { id: 'paste-poster' });
      } catch {
        applyPastedPosterValue(text.trim(), target);
        toast.dismiss('paste-poster');
      }
    }
  };

  const handleReadClipboardButton = async (target: 'form' | 'modal') => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find(t => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            await handleImageBlobToSlot(blob, target);
            return;
          }
        }
      }

      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = (await navigator.clipboard.readText()).trim();
        if (text && (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('data:image/'))) {
          if (text.startsWith('data:image/') && text.length > 350 * 1024) {
            const compressed = await compressImageSourceToBase64(text);
            applyPastedPosterValue(compressed, target);
            toast.success('Base64 gambar berhasil ditempel & dikompresi!');
          } else {
            applyPastedPosterValue(text, target);
            toast.success('URL / Base64 gambar berhasil ditempel dari clipboard!');
          }
          return;
        }
      }

      toast.info('Clipboard belum berisi gambar atau URL. Copy gambar terlebih dahulu lalu tekan Ctrl+V.');
    } catch (err) {
      toast.info('Browser membatasi baca clipboard otomatis. Klik kotak URL/Paste lalu tekan Ctrl+V (atau Cmd+V).');
    }
  };

  const handleDropImage = async (e: React.DragEvent, target: 'form' | 'modal') => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await handleImageBlobToSlot(file, target);
    }
  };

  const handleApplyManualAI = () => {
    const trimmedJson = manualAiInput.trim();
    const trimmedPoster = manualPosterInput.trim();

    if (!trimmedJson && !trimmedPoster) {
      toast.error('Masukkan balasan JSON dari AI atau tempelkan gambar/URL poster terlebih dahulu.');
      return;
    }

    try {
      if (trimmedJson) {
        // Allow user to paste with or without markdown backticks
        let cleanInput = trimmedJson;
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
        if (data.type && ['Daring', 'Luring', 'Hybrid'].includes(data.type)) {
          form.setValue('type', data.type as 'Daring' | 'Luring' | 'Hybrid');
        }
        if (data.registrationDeadline) form.setValue('registrationDeadline', data.registrationDeadline);
        if (data.fee !== undefined) form.setValue('fee', Number(data.fee) || 0);
        if (data.location) form.setValue('location', data.location);
        if (data.guidebookUrl) form.setValue('guidebookUrl', data.guidebookUrl);
        if (data.description) form.setValue('description', data.description);

        // Apply poster URL/Base64: prioritize manual poster slot if user pasted one, otherwise use JSON posterUrl
        const resolvedPoster = trimmedPoster || (typeof data.posterUrl === 'string' ? data.posterUrl.trim() : '');
        if (resolvedPoster) {
          setSelectedFile(null);
          form.setValue('posterUrl', resolvedPoster);
          setPreviewUrl(resolvedPoster);
        }

        if (data.rounds && Array.isArray(data.rounds) && data.rounds.length > 0) {
          const currentRounds = form.getValues('rounds');
          for (let i = currentRounds.length - 1; i >= 0; i--) {
            remove(i);
          }
          data.rounds.forEach((r: any) => {
            if (r.name && r.date) {
              append({ name: r.name, date: r.date });
            }
          });
        }
      } else if (trimmedPoster) {
        // User only applied poster from slot
        setSelectedFile(null);
        form.setValue('posterUrl', trimmedPoster);
        setPreviewUrl(trimmedPoster);
      }

      setIsManualAiOpen(false);
      setManualAiInput('');
      setManualPosterInput('');
      toast.success(
        trimmedPoster
          ? 'Data AI & poster (URL/Base64) berhasil diterapkan ke form!'
          : 'Data dari AI berhasil diterapkan ke form!'
      );
    } catch (err) {
      toast.error('Format JSON tidak valid. Pastikan Anda menyalin persis seperti balasan AI.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      toast.error('Ukuran maksimal file adalah 4MB');
      return;
    }

    setSelectedFile(file);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const getCompressedBase64 = (file: File): Promise<string> => {
    return compressImageSourceToBase64(file);
  };

  const handleGenerateAI = async () => {
    const currentPosterUrl = form.getValues('posterUrl')?.trim();
    const hasPastedBase64 = Boolean(currentPosterUrl && currentPosterUrl.startsWith('data:image/'));

    if (!selectedFile && !hasPastedBase64) {
      toast.info('Pilih file poster atau tempel gambar (Ctrl+V) terlebih dahulu');
      fileInputRef.current?.click();
      return;
    }

    setIsGenerating(true);
    toast.info('AI sedang menganalisis poster lomba...');

    try {
      const base64Data = selectedFile
        ? await getCompressedBase64(selectedFile)
        : (currentPosterUrl as string);
      
      const response = await fetch('/api/extract-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: base64Data || emptyImagePlaceholder,
          mimeType: 'image/jpeg'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errObj: any = new Error(errorData.error || 'Gagal membaca poster');
        errObj.code = errorData.code;
        errObj.status = response.status;
        throw errObj;
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
      form.setValue('fee', typeof parsedData.fee === 'number' ? parsedData.fee : 0);
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

      toast.success('Informasi poster berhasil diekstrak otomatis! Silakan periksa formulir.');
    } catch (err: any) {
      console.warn("AI Poster Extraction Notice:", err.message);
      const isRecoverableError = 
        err.code === 'PROJECT_DENIED_ACCESS' || 
        err.code === 'CREDITS_DEPLETED' || 
        err.status === 402 || 
        err.status === 403 || 
        err.message?.includes('denied access') || 
        err.message?.includes('Saldo kredit') || 
        err.message?.includes('habis');

      if (isRecoverableError) {
        toast.error(err.message || 'Koneksi AI mengalami pembatasan kuota/akses.', {
          duration: 9000,
          action: {
            label: "Buka Bantuan AI",
            onClick: () => setIsManualAiOpen(true)
          }
        });
        // Pre-fill manual poster slot if user already pasted/selected a poster
        if (previewUrl) {
          setManualPosterInput(previewUrl);
        }
        // Buka dialog prompt manual otomatis agar pengguna tidak terhambat
        setIsManualAiOpen(true);
      } else {
        toast.error(err.message || 'Gagal mengekstrak data menggunakan AI', { duration: 6000 });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);

    try {
      let finalPosterUrl = values.posterUrl?.trim() || '';

      if (selectedFile) {
        toast.info('Memproses poster...');
        const compressedBase64 = await getCompressedBase64(selectedFile);
        finalPosterUrl = compressedBase64;
      } else if (finalPosterUrl.startsWith('data:image/') && finalPosterUrl.length > 350 * 1024) {
        toast.info('Mengompresi gambar Base64...');
        finalPosterUrl = await compressImageSourceToBase64(finalPosterUrl);
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
        isApproved: (isAdminOrManagement || isRegularStudent) ? true : (initialData?.isApproved ?? false), // Admin/Mgmt and regular students auto approved without admin approval, SOS kept pending for approval
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
        <div
          className="mb-6 p-4 border rounded-lg bg-muted/30"
          onPaste={(e) => handlePasteClipboard(e, 'form')}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDropImage(e, 'form')}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <Label className="font-semibold">Upload / Tempel Gambar Poster &amp; Generate Form (AI)</Label>
            <span className="text-[11px] text-muted-foreground">
              Tips: Bisa langsung <strong>Ctrl+V</strong> gambar poster atau drag &amp; drop ke sini tanpa simpan file
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
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
              className="cursor-pointer"
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Pilih File Poster
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleReadClipboardButton('form')}
              disabled={isGenerating || submitting}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 cursor-pointer"
              title="Tempel gambar poster langsung dari clipboard (tanpa harus download)"
            >
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Tempel Gambar (Clipboard)
            </Button>
            
            {selectedFile && (
              <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={selectedFile.name}>
                {selectedFile.name}
              </span>
            )}

            
            <div className="flex flex-wrap gap-2">
              <Button 
                type="button" 
                onClick={handleGenerateAI}
                disabled={isGenerating || submitting}
                className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm cursor-pointer"
                title="Ekstrak detail lomba secara otomatis dari gambar poster menggunakan AI"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengekstrak Poster...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Ekstrak Otomatis (AI)
                  </>
                )}
              </Button>
              
              <Dialog
                open={isManualAiOpen}
                onOpenChange={(open) => {
                  setIsManualAiOpen(open);
                  if (open && !manualPosterInput) {
                    const existingUrl = form.getValues('posterUrl')?.trim();
                    if (existingUrl) setManualPosterInput(existingUrl);
                  }
                }}
              >
                <DialogTrigger render={<Button type="button" variant="secondary" className="border border-purple-200 text-purple-700 hover:bg-purple-100 cursor-pointer" />}>
                  <Terminal className="mr-2 h-4 w-4" />
                  Isi Manual via AI Lain
                </DialogTrigger>
                <DialogContent
                  className="max-w-2xl max-h-[90vh] overflow-y-auto"
                  onPaste={(e) => {
                    // Only intercept if clipboard has an image so text paste in JSON textarea still works cleanly
                    const items = e.clipboardData?.items;
                    if (items) {
                      for (let i = 0; i < items.length; i++) {
                        if (items[i].type.startsWith('image/')) {
                          handlePasteClipboard(e, 'modal');
                          return;
                        }
                      }
                    }
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Bantuan Prompt AI Eksternal &amp; Slot Poster (URL / Base64)</DialogTitle>
                    <DialogDescription>
                      Ekstrak lewat ChatGPT/Gemini/Claude lalu tempel JSON balasan serta gambar/URL posternya langsung di sini tanpa perlu menyimpan file gambar.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 my-2">
                    <div className="p-3.5 bg-muted rounded-md text-xs sm:text-sm">
                      <p className="font-semibold mb-1.5">Langkah-langkah Cepat:</p>
                      <ol className="list-decimal pl-5 space-y-1">
                        <li>Buka ChatGPT (chatgpt.com) atau Gemini (gemini.google.com) di tab baru.</li>
                        <li>Copy &amp; paste gambar poster lomba ke chat AI beserta prompt di bawah ini.</li>
                        <li>Copy balasan JSON dari AI dan paste ke kotak JSON.</li>
                        <li>Untuk posternya: cukup klik kanan <strong>Copy Image</strong> (atau Screenshot) lalu tekan <strong>Ctrl+V</strong> / klik <strong>Tempel Gambar</strong> di Slot Poster — otomatis jadi <strong>Base64</strong>!</li>
                      </ol>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="font-semibold">Prompt untuk AI (Copy ini):</Label>
                        <Button 
                          type="button"
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            navigator.clipboard.writeText(MANUAL_AI_PROMPT);
                            setCopiedPrompt(true);
                            toast.success("Prompt disalin!");
                            setTimeout(() => setCopiedPrompt(false), 2000);
                          }}
                        >
                          {copiedPrompt ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                          {copiedPrompt ? 'Tersalin' : 'Copy Prompt'}
                        </Button>
                      </div>
                      <div className="p-3 bg-slate-900 text-slate-100 rounded-md text-[11px] font-mono whitespace-pre-wrap max-h-44 overflow-y-auto">
                        {MANUAL_AI_PROMPT}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="font-semibold mb-1 block">1. Paste Balasan JSON AI di sini:</Label>
                      <Textarea 
                        placeholder={'{\n  "title": "Olimpiade Sains",\n  ...\n}'}
                        className="font-mono text-xs min-h-[120px]"
                        value={manualAiInput}
                        onChange={(e) => setManualAiInput(e.target.value)}
                      />
                    </div>

                    {/* SLOT POSTER URL / BASE64 / COPY-PASTE GAMBAR */}
                    <div
                      className="p-3.5 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5"
                      onPaste={(e) => handlePasteClipboard(e, 'modal')}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropImage(e, 'modal')}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="font-semibold text-xs sm:text-sm flex items-center gap-1.5 text-indigo-950 dark:text-indigo-200">
                          <ImageIcon className="h-4 w-4 text-indigo-600" />
                          <span>2. Slot Poster Lomba (URL Gambar / Base64 / Paste Gambar)</span>
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleReadClipboardButton('modal')}
                            className="h-7 text-xs bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                          >
                            <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
                            Tempel Gambar (Clipboard)
                          </Button>
                          {manualPosterInput && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(manualPosterInput);
                                setCopiedBase64(true);
                                toast.success(
                                  manualPosterInput.startsWith('data:')
                                    ? 'Kode Base64 gambar disalin!'
                                    : 'URL poster disalin!'
                                );
                                setTimeout(() => setCopiedBase64(false), 2000);
                              }}
                              className="h-7 text-xs text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              {copiedBase64 ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                              {copiedBase64 ? 'Disalin' : 'Copy URL/Base64'}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          value={manualPosterInput}
                          onChange={(e) => setManualPosterInput(e.target.value)}
                          onPaste={(e) => handlePasteClipboard(e, 'modal')}
                          placeholder="Tekan Ctrl+V gambar langsung di sini, atau paste URL https://... / data:image/..."
                          className="h-8 text-xs font-mono bg-background"
                        />
                        {manualPosterInput && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setManualPosterInput('')}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 shrink-0"
                            title="Hapus poster"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {manualPosterInput ? (
                        <div className="flex items-center gap-3 pt-1">
                          <img
                            src={manualPosterInput}
                            alt="Preview Poster"
                            className="h-20 w-auto rounded-md border bg-white object-contain"
                          />
                          <div className="text-[11px] text-muted-foreground space-y-0.5">
                            <p className="font-semibold text-foreground">
                              {manualPosterInput.startsWith('data:image/')
                                ? `Format: Kode Base64 Siap Simpan (~${Math.round((manualPosterInput.length * 3) / 4 / 1024)} KB)`
                                : 'Format: URL Gambar Eksternal'}
                            </p>
                            <p>Akan otomatis mengisi kolom Poster Lomba saat diterapkan.</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          💡 Tidak perlu download gambar: klik kanan pada poster di web/WhatsApp/AI → pilih <strong>Copy Image</strong> → klik di kotak ini lalu tekan <strong>Ctrl+V</strong> (otomatis terkonversi ke Base64).
                        </p>
                      )}
                    </div>
                    
                    <Button type="button" onClick={handleApplyManualAI} className="w-full cursor-pointer">
                      Terapkan Data &amp; Poster ke Form
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {previewUrl && (
            <div className="mt-4 flex items-start gap-3">
              <div className="rounded-md overflow-hidden border bg-muted w-full max-w-[180px]">
                <img src={previewUrl} alt="Preview Poster" className="w-full h-auto object-cover" />
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  form.setValue('posterUrl', '');
                }}
                className="text-xs text-rose-600 hover:bg-rose-50"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Hapus Preview
              </Button>
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
                <div className="flex items-center justify-between gap-2">
                  <Label>URL Gambar Poster / Kode Base64 (Opsional)</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReadClipboardButton('form')}
                      className="h-7 text-xs text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                    >
                      <ClipboardPaste className="h-3.5 w-3.5 mr-1" /> Tempel Gambar
                    </Button>
                    {form.watch('posterUrl') && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(form.getValues('posterUrl') || '');
                          toast.success('URL / Kode Base64 poster disalin!');
                        }}
                        className="h-7 text-xs text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    {...form.register('posterUrl')}
                    onPaste={(e) => handlePasteClipboard(e, 'form')}
                    placeholder="https://... atau Ctrl+V gambar langsung (auto Base64)"
                    className="flex-1 font-mono text-xs"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Tips: Anda bisa langsung <strong>Ctrl+V</strong> gambar poster (otomatis jadi Base64), atau jika gambar dari Instagram gunakan <a href="https://fastdl.app/photo" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">fastdl.app/photo</a>
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
