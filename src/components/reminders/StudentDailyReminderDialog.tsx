import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isStudentRole } from '../../types/auth';
import { getStudentGuidanceLogs } from '../../services/guidanceService';
import { getWeeklyAgenda, WeeklyAgendaSummary, formatIndonesianDate } from '../../services/agendaService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { BookOpen, Calendar, Clock, AlertTriangle, ArrowRight, CheckCircle2, Trophy } from 'lucide-react';

export function StudentDailyReminderDialog() {
  const { currentUser, userProfile, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(true);
  const [weeklyAgenda, setWeeklyAgenda] = useState<WeeklyAgendaSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const todayFormatted = formatIndonesianDate(today);

  useEffect(() => {
    if (!currentUser || !isStudentRole(userRole)) {
      setLoading(false);
      return;
    }

    // Do not show popup if already on the /guidance page
    if (location.pathname === '/guidance') {
      return;
    }

    let isMounted = true;

    const checkStatus = async () => {
      try {
        // Check session storage to see if dismissed for current session
        const sessionDismissKey = `daily_reminder_dismissed_${todayStr}_${currentUser.uid}`;
        const isDismissed = sessionStorage.getItem(sessionDismissKey);

        const [logs, agenda] = await Promise.all([
          getStudentGuidanceLogs(currentUser.uid).catch(() => []),
          getWeeklyAgenda().catch(() => null)
        ]);

        if (!isMounted) return;

        if (agenda) {
          setWeeklyAgenda(agenda);
        }

        const checkedToday = logs.some(log => {
          const lDate = new Date(log.date);
          return lDate.toDateString() === today.toDateString();
        });

        setHasCheckedInToday(checkedToday);

        // If NOT checked in and NOT dismissed in this session, trigger popup
        if (!checkedToday && !isDismissed) {
          // Slight delay for smooth entrance
          const timer = setTimeout(() => {
            if (isMounted) setIsOpen(true);
          }, 1200);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        console.error('Error checking student daily reminder:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, [currentUser, userRole, location.pathname, todayStr]);

  const handleDismiss = () => {
    if (currentUser) {
      sessionStorage.setItem(`daily_reminder_dismissed_${todayStr}_${currentUser.uid}`, 'true');
    }
    setIsOpen(false);
  };

  const handleGoToGuidance = () => {
    handleDismiss();
    navigate('/guidance');
  };

  // Only render if student has not checked in today
  if (!currentUser || !isStudentRole(userRole) || hasCheckedInToday) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-amber-200/60 shadow-2xl">
        {/* Header Banner */}
        <div className="bg-linear-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-6 rounded-t-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-15 pointer-events-none">
            <BookOpen className="w-36 h-36" />
          </div>
          <div className="flex items-start gap-3 relative z-10">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl shrink-0">
              <AlertTriangle className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-white/25 rounded-full text-white">
                  Pengingat Harian SOS
                </span>
                <span className="text-xs text-amber-100 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {todayFormatted}
                </span>
              </div>
              <h2 className="text-xl font-bold leading-tight">
                Laporan Belajar Hari Ini Belum Diisi!
              </h2>
              <p className="text-sm text-amber-50 mt-1">
                Halo <span className="font-semibold text-white">{userProfile?.name || 'Siswa Berprestasi'}</span>, yuk sempatkan 2 menit untuk mencatat jurnal belajar harianmu.
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 bg-background">
          {/* Target Reminder Box */}
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-700 dark:text-amber-300 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <p className="font-semibold text-sm mb-1 text-amber-950 dark:text-amber-100">
                Pentingnya Konsistensi Jurnal Harian:
              </p>
              Setiap catatan progres (mata pelajaran, jumlah soal, jam belajar, dan evaluasi) dipantau langsung oleh tim pembimbing SOS untuk memetakan kesiapan kompetisi dan bimbingan intensifmu.
            </div>
          </div>

          {/* Agenda Pekan Ini Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Agenda & Perlombaan Pekan Ini
              </h3>
              {weeklyAgenda && (
                <span className="text-xs text-muted-foreground font-medium">
                  {weeklyAgenda.weekLabel}
                </span>
              )}
            </div>

            {weeklyAgenda && weeklyAgenda.allEvents.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {weeklyAgenda.allEvents.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                        <span className="font-medium text-foreground">{item.competitionTitle || item.title}</span>
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="font-semibold text-primary">{item.formattedDate}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground space-y-1">
                <Trophy className="w-5 h-5 mx-auto text-muted-foreground/60 mb-1" />
                <p className="font-medium">Tidak ada deadline perlombaan mendesak pekan ini.</p>
                <p>Fokuskan energimu pada latihan soal mandiri dan pendalaman silabus OSN.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-muted/30 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Ingatkan Nanti
          </Button>

          <Button
            onClick={handleGoToGuidance}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-md flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Isi Laporan Belajar Sekarang
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
