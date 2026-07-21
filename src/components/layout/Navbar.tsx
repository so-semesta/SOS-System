import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Menu, User, LogOut } from 'lucide-react';
import { Button } from '../ui/button';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { NotificationsWidget } from './NotificationsWidget';

interface NavbarProps {
  toggleSidebar: () => void;
}

export function Navbar({ toggleSidebar }: NavbarProps) {
  const { currentUser, userProfile, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
      <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
      <div className="flex flex-1 items-center justify-end gap-4 md:justify-end">
        {currentUser ? (
          <div className="flex items-center gap-4">
            <NotificationsWidget />
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm font-medium">{userProfile?.name || currentUser.email}</span>
              <span className="text-xs text-muted-foreground capitalize">{userProfile?.role || 'User'}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Logout</span>
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm">
            <User className="mr-2 h-4 w-4" />
            Login
          </Button>
        )}
      </div>
    </header>
  );
}
