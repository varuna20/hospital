import ChevFooter from '../../components/ChevFooter.jsx';
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';

export default function SuperLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen relative">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      
      <main className="flex-1 overflow-auto flex flex-col min-h-0 min-w-0">
        <div className="lg:hidden p-4 border-b flex items-center justify-between sticky top-0 z-30" 
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2">
            <span className="text-2xl">☰</span>
          </button>
          <span className="font-bold text-sm tracking-tight text-white">SUPER ADMIN</span>
          <div className="w-8" />
        </div>

        <div className="p-4 md:p-6 flex-1 flex flex-col">
          <Outlet />
          <ChevFooter minimal />
        </div>
      </main>
    </div>
  );
}
