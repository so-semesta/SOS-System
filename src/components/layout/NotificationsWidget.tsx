import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Badge } from '../ui/badge';
import { getAllCompetitions, getStudentRegistrations, getAllRegistrations } from '../../services/competitionService';
import { getStudentGuidanceLogs, getAllGuidanceLogs } from '../../services/guidanceService';
import { getAllStudents } from '../../services/studentService';
import { CompetitionStatus, RegistrationStatus } from '../../types';
import { UserRole } from '../../types/auth';

export function NotificationsWidget() {
  const { currentUser, userRole } = useAuth();
  const [notifications, setNotifications] = useState<{title: string, desc: string, type: string}[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!currentUser) return;
    const notifs = [];
    try {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      if (userRole === UserRole.STUDENT) {
        // H-3 lomba
        const regs = await getStudentRegistrations(currentUser.uid);
        const comps = await getAllCompetitions();
        regs.forEach(reg => {
          const comp = comps.find(c => c.id === reg.competitionId);
          if (comp && reg.status === RegistrationStatus.APPROVED) {
            comp.rounds.forEach(r => {
              const rDate = new Date(r.date);
              const diffTime = rDate.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays >= 0 && diffDays <= 3) {
                notifs.push({
                  title: 'Pengingat Lomba',
                  desc: `Babak ${r.name} untuk lomba ${comp.title} akan dimulai dalam ${diffDays} hari.`,
                  type: 'warning'
                });
              }
            });
            const dlDate = new Date(comp.registrationDeadline);
            const dlDiffTime = dlDate.getTime() - today.getTime();
            const dlDiffDays = Math.ceil(dlDiffTime / (1000 * 60 * 60 * 24));
            if (dlDiffDays >= 0 && dlDiffDays <= 3) {
               notifs.push({
                  title: 'Deadline Lomba',
                  desc: `Batas pendaftaran lomba ${comp.title} akan berakhir dalam ${dlDiffDays} hari.`,
                  type: 'info'
               });
            }
          }
        });
        
        // Daily checkin check
        const logs = await getStudentGuidanceLogs(currentUser.uid);
        const hasCheckedInToday = logs.some(log => {
          const logDate = new Date(log.date);
          return logDate.toDateString() === today.toDateString();
        });
        
        if (!hasCheckedInToday) {
          notifs.push({
            title: 'Daily Checkin',
            desc: 'Anda belum mengisi Daily Checkin hari ini.',
            type: 'alert'
          });
        }
      } else if (userRole === UserRole.MANAGEMENT || userRole === UserRole.ADMIN) {
        // Request perizinan
        const allRegs = await getAllRegistrations();
        const pendingRegs = allRegs.filter(r => r.status === RegistrationStatus.PENDING);
        if (pendingRegs.length > 0) {
          notifs.push({
            title: 'Permintaan Perizinan',
            desc: `Terdapat ${pendingRegs.length} permintaan perizinan lomba yang menunggu persetujuan.`,
            type: 'warning'
          });
        }
        
        // Daily checkin hari ini yg belum
        const allLogs = await getAllGuidanceLogs();
        const allStudents = await getAllStudents();
        
        const checkedInStudentIds = new Set(allLogs.filter(log => {
          return new Date(log.date).toDateString() === today.toDateString();
        }).map(log => log.studentId));
        
        const notCheckedIn = allStudents.filter(s => !checkedInStudentIds.has(s.id));
        if (notCheckedIn.length > 0) {
          notifs.push({
            title: 'Rekap Daily Checkin',
            desc: `${notCheckedIn.length} siswa belum mengisi daily checkin hari ini.`,
            type: 'info'
          });
        }
      }
    } catch (error) {
      console.error("Error fetching notifications", error);
    }
    setNotifications(notifs);
  };

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, currentUser]);
  
  // also fetch once on mount
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10 * 60 * 1000); // every 10 min
    return () => clearInterval(interval);
  }, [currentUser]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* @ts-ignore */}
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-red-600"></span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b px-4 py-3">
          <h4 className="font-semibold text-sm">Notifikasi</h4>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Tidak ada notifikasi baru.
            </div>
          ) : (
            notifications.map((n, i) => (
              <div key={i} className="flex flex-col gap-1 border-b p-4 last:border-0 hover:bg-muted/50">
                <span className="text-sm font-medium">{n.title}</span>
                <span className="text-xs text-muted-foreground">{n.desc}</span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
