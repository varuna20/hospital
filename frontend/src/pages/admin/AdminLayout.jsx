import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';
import ChevFooter from '../../components/ChevFooter.jsx';
import Topbar from '../../components/common/Topbar';

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen relative">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      
      <main className="flex-1 overflow-auto flex flex-col min-h-0 min-w-0">
        <Topbar title="Admin Panel" onMenuClick={() => setMobileOpen(true)} />

        <div className="p-4 md:p-6 flex-1 flex flex-col">
          <Outlet />
          <ChevFooter minimal />
        </div>
      </main>
    </div>
  );
}
