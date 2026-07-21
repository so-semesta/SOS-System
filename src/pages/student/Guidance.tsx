import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { createGuidanceLog, getStudentGuidanceLogs } from '../../services/guidanceService';
import { Mood, GuidanceLog } from '../../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';

const GuidanceFormSchema = z.object({
  academicSubject: z.string().min(1, 'Mata Pelajaran wajib diisi'),
  studyProgress: z.string().min(1, 'Progress Belajar wajib diisi'),
  questionsCompleted: z.number().min(0, 'Minimal 0'),
  summaryPages: z.number().min(0, 'Minimal 0'),
  studyHours: z.number().min(1, 'Minimal 1 jam'),
  mood: z.nativeEnum(Mood),
  psychologicalNotes: z.string().optional(),
});

type GuidanceFormValues = z.infer<typeof GuidanceFormSchema>;

const MOOD_EMOJIS = {
  [Mood.GREAT]: '🤩 Sangat Baik',
  [Mood.GOOD]: '😊 Baik',
  [Mood.BAD]: '😔 Sedih/Lelah',
  [Mood.TERRIBLE]: '😭 Sangat Buruk',
};

export function Guidance() {
  const { currentUser, userProfile } = useAuth();
  const [logs, setLogs] = useState<GuidanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<GuidanceFormValues>({
    resolver: zodResolver(GuidanceFormSchema),
    defaultValues: {
      questionsCompleted: 0,
      summaryPages: 0,
      studyHours: 1,
      mood: Mood.GOOD,
      psychologicalNotes: '',
    },
  });

  const loadLogs = async () => {
    if (!currentUser) return;
    try {
      const data = await getStudentGuidanceLogs(currentUser.uid);
      setLogs(data);
    } catch (error) {
      toast.error('Gagal memuat history guidance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [currentUser]);

  const onSubmit = async (values: GuidanceFormValues) => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const newId = `gl_${Date.now()}`;
      await createGuidanceLog(newId, {
        studentId: currentUser.uid,
        studentName: userProfile?.name || 'Siswa',
        date: Date.now(),
        academicSubject: values.academicSubject,
        studyProgress: values.studyProgress,
        questionsCompleted: values.questionsCompleted,
        summaryPages: values.summaryPages,
        studyHours: Math.round(values.studyHours),
        mood: values.mood,
        psychologicalNotes: values.psychologicalNotes || '',
        createdAt: Date.now(),
      });
      toast.success('Check-in harian berhasil disimpan!');
      form.reset();
      loadLogs();
    } catch (err) {
      toast.error('Gagal menyimpan check-in harian');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daily Check-in & Guidance</h1>
        <p className="text-muted-foreground">Catat progress belajar dan kondisi emosional Anda hari ini secara private.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Jurnal Harian</CardTitle>
          <CardDescription>Bagian ini akan terpantau oleh admin & guru pembimbing</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* JURNAL AKADEMIK (Left/Top) */}
              <div className="space-y-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800">
                <h3 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center">
                  <span className="mr-2">📚</span> Jurnal Akademik
                </h3>
                <div className="space-y-2">
                  <Label>Mata Pelajaran / Bidang OSN</Label>
                  <Input {...form.register('academicSubject')} placeholder="Contoh: Matematika Kombinatorik" />
                  {form.formState.errors.academicSubject && (
                    <p className="text-red-500 text-xs">{form.formState.errors.academicSubject.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Jumlah Soal</Label>
                    <Input type="number" {...form.register('questionsCompleted', { valueAsNumber: true })} />
                    {form.formState.errors.questionsCompleted && (
                      <p className="text-red-500 text-xs">{form.formState.errors.questionsCompleted.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Jumlah Halaman</Label>
                    <Input type="number" {...form.register('summaryPages', { valueAsNumber: true })} />
                    {form.formState.errors.summaryPages && (
                      <p className="text-red-500 text-xs">{form.formState.errors.summaryPages.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Jam Belajar</Label>
                    <Input type="number" {...form.register('studyHours', { valueAsNumber: true })} />
                    {form.formState.errors.studyHours && (
                      <p className="text-red-500 text-xs">{form.formState.errors.studyHours.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Progress Belajar Hari Ini</Label>
                  <Textarea 
                    {...form.register('studyProgress')} 
                    placeholder="Apa saja yang kamu pelajari hari ini? Apakah ada kendala pada materi?"
                    className="min-h-[120px]"
                  />
                  {form.formState.errors.studyProgress && (
                    <p className="text-red-500 text-xs">{form.formState.errors.studyProgress.message}</p>
                  )}
                </div>
              </div>

              {/* AREA PRIVATE (Right/Bottom) */}
              <div className="space-y-4 p-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800">
                <h3 className="font-semibold text-purple-800 dark:text-purple-300 flex items-center">
                  <span className="mr-2">🧠</span> Area Private (Psikologis)
                </h3>
                <p className="text-xs text-muted-foreground mb-4">Hanya dapat dilihat oleh Manajemen Pusat SOS.</p>
                
                <div className="space-y-2">
                  <Label>Bagaimana perasaanmu belajar hari ini?</Label>
                  <Controller
                    name="mood"
                    control={form.control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Kondisi Mood" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(Mood).map((m) => (
                            <SelectItem key={m} value={m}>
                              {MOOD_EMOJIS[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catatan Pribadi / Kendala Emosional (Opsional)</Label>
                  <Textarea 
                    {...form.register('psychologicalNotes')} 
                    placeholder="Ceritakan keluh kesahmu, kendala bersama teman, atau jika sedang merasa burnout..."
                    className="min-h-[120px]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan Jurnal Hari Ini'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-xl font-bold tracking-tight">History Daily Check-in</h3>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Mata Pelajaran</TableHead>
                <TableHead>Progress Terakhir</TableHead>
                <TableHead>Mood</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">Memuat riwayat...</TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">Belum ada riwayat check-in.</TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </TableCell>
                    <TableCell className="font-medium">{log.academicSubject}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{log.studyProgress}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200">
                        {MOOD_EMOJIS[log.mood] || log.mood}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
