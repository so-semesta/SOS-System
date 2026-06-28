import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getStudentProfile, createStudentProfile, updateStudentProfile } from '../../services/studentService';
import { Student } from '../../types';
import { StudentProfileForm } from '../../components/features/students/StudentProfileForm';
import { toast } from 'sonner';

export function MyProfile() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!currentUser) return;
      try {
        const studentData = await getStudentProfile(currentUser.uid);
        setProfile(studentData);
        if (!studentData) {
          setIsEditMode(true); // Auto edit mode if no profile exists
        }
      } catch (error) {
        toast.error('Gagal memuat profil');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [currentUser]);

  const handleSave = async (data: Partial<Student>) => {
    if (!currentUser) return;
    setSaving(true);
    try {
      if (profile) {
        await updateStudentProfile(profile.id, data);
        setProfile({ ...profile, ...data } as Student);
        toast.success('Profil berhasil diperbaharui');
      } else {
        const newId = `stu_${Date.now()}`;
        const newStudent = {
          ...data,
          userId: currentUser.uid,
          createdAt: Date.now(),
        } as Omit<Student, 'id'>;
        await createStudentProfile(newId, newStudent);
        setProfile({ id: newId, ...newStudent });
        toast.success('Profil berhasil dibuat');
      }
      setIsEditMode(false);
    } catch (err) {
      toast.error('Gagal menyimpan profil');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center">Memuat profil...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Profil</h1>
          <p className="text-muted-foreground">Pastikan data Anda selalu up-to-date untuk keperluan kompetisi.</p>
        </div>
        {!isEditMode && profile && (
          <button 
            onClick={() => setIsEditMode(true)}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Edit Profil
          </button>
        )}
      </div>

      <div className={isEditMode ? '' : 'pointer-events-none opacity-80'}>
        <StudentProfileForm 
          initialData={profile} 
          studentId={profile?.id || currentUser?.uid!} 
          onSave={handleSave}
          isLoading={saving}
        />
        {!isEditMode && (
           <div className="mt-4 text-center text-sm text-muted-foreground">
             Mode Lihat. Klik tombol "Edit Profil" untuk mengubah data.
           </div>
        )}
      </div>
    </div>
  );
}
