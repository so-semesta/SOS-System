import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { Outlet } from 'react-router-dom';
import { TimerWidget } from './TimerWidget';
import { StudentDailyReminderDialog } from '../reminders/StudentDailyReminderDialog';

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background print:block print:h-auto print:overflow-visible print:bg-white">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-auto bg-muted/20 p-4 md:p-6 print:overflow-visible print:bg-white print:p-0">
          <Outlet />
        </main>
      </div>
      <div className="print:hidden">
        <TimerWidget />
        <StudentDailyReminderDialog />
      </div>
    </div>
  );
}

