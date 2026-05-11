import ChevFooter from '../../components/ChevFooter.jsx';
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';
export default function StaffLayout() {
  return <div className="flex min-h-screen"><Sidebar /><main className="flex-1 overflow-auto p-6 flex flex-col min-h-0"><Outlet /><ChevFooter minimal /></main></div>;
}
