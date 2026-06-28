import React from 'react';
import { cn } from '../../lib/utils';
import { Button, buttonVariants } from '../ui/button';
import { useAuth } from '../../context/AuthContext';
import { 
  GraduationCap, 
  Users, 
  CalendarDays, 
  BookOpen, 
  Settings, 
  BarChart, 
  Trophy
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { UserRole } from '../../types/auth';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const { userRole } = useAuth();
  const location = useLocation();

  const navItems = [
    // SEMUA ROLE
    { name: 'Home', icon: CalendarDays, path: '/home', roles: [UserRole.STUDENT, UserRole.ADMIN, UserRole.MANAGEMENT] },
    { name: 'Dashboard Analitik', icon: BarChart, path: '/analytics', roles: [UserRole.ADMIN, UserRole.MANAGEMENT] },
    { name: 'Leaderboard', icon: Trophy, path: '/leaderboard', roles: [UserRole.STUDENT, UserRole.ADMIN, UserRole.MANAGEMENT] },
    
    // STUDENT
    { name: 'Profil Saya', icon: Users, path: '/profile', roles: [UserRole.STUDENT] },
    { name: 'Lomba', icon: Trophy, path: '/competitions', roles: [UserRole.STUDENT] },
    { name: 'Guidance', icon: BookOpen, path: '/guidance', roles: [UserRole.STUDENT] },
    { name: 'OSN Corner', icon: GraduationCap, path: '/osn-corner', roles: [UserRole.STUDENT] },
    { name: 'Classroom', icon: CalendarDays, path: '/classroom', roles: [UserRole.STUDENT] },

    // ADMIN & MANAGEMENT
    { name: 'Manajemen Siswa', icon: Users, path: '/admin/students', roles: [UserRole.ADMIN, UserRole.MANAGEMENT] },
    { name: 'Manajemen Lomba', icon: Trophy, path: '/admin/competitions', roles: [UserRole.ADMIN, UserRole.MANAGEMENT] },
    { name: 'Perizinan Lomba', icon: CalendarDays, path: '/admin/registrations', roles: [UserRole.ADMIN, UserRole.MANAGEMENT] },
    { name: 'Review Guidance', icon: BookOpen, path: '/admin/guidance', roles: [UserRole.ADMIN, UserRole.MANAGEMENT] },
    { name: 'Manajemen OSN', icon: GraduationCap, path: '/admin/osn', roles: [UserRole.ADMIN, UserRole.MANAGEMENT] },

    // MANAGEMENT ONLY
    { name: 'Manajemen User', icon: Settings, path: '/management/users', roles: [UserRole.MANAGEMENT] },
  ];

  const filteredNavItems = navItems.filter((item) => {
    if (!userRole) return false;
    return item.roles.includes(userRole);
  });

  return (
    <>
      <div 
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden",
          isOpen ? "block" : "hidden"
        )}
        onClick={() => setIsOpen(false)}
      />
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 border-r bg-background transition-transform duration-300 md:relative md:translate-x-0 flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center border-b px-6">
          <img src="/icon.png" alt="Logo" className="h-6 w-6 mr-2 object-contain" />
          <span className="font-bold tracking-tight">SOS System (Beta)</span>
        </div>
        <div className="flex-1 overflow-auto py-4">
          <nav className="grid gap-1 px-2">
            {filteredNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  buttonVariants({ variant: location.pathname === item.path ? "secondary" : "ghost" }),
                  "justify-start",
                  location.pathname === item.path ? "bg-secondary" : ""
                )}
                onClick={() => setIsOpen(false)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
