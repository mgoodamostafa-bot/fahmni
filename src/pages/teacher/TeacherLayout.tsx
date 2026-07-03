import React, { useEffect } from 'react';
import { Outlet, Navigate, useOutletContext, useLocation, Link } from 'react-router-dom';
import { TeacherSidebar } from '../../components/TeacherSidebar';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, Search, User, Menu, X, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../contexts/SettingsContext';

export const TeacherLayout: React.FC = () => {
  const { settings } = useSettings();
  const { profile } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  const [isDesktop, setIsDesktop] = React.useState(window.innerWidth >= 1024);
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar when navigating
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname, setIsSidebarOpen]);

  // 🛡️ Guard: Wait for profile, then check role
  if (!profile) return null; // Wait for profile in current layout instead of redirecting

  if (profile.role !== 'teacher' && profile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const sidebarVariants = {
    expanded: {
      width: 280,
      x: 0,
      transition: { type: 'spring', stiffness: 300, damping: 30 },
    },
    collapsed: {
      width: 0,
      x: 280,
      transition: { type: 'spring', stiffness: 300, damping: 30 },
    },
    mobileOpen: {
      width: 280,
      x: 0,
      transition: { type: 'spring', stiffness: 300, damping: 30 },
    },
    mobileClosed: {
      width: 280,
      x: 300,
      transition: { type: 'spring', stiffness: 300, damping: 30 },
    },
  };

  return (
    <div
      className="flex min-h-screen bg-space-950 text-white font-sans selection:bg-emerald-500/30"
      dir="rtl"
    >
      {/* 1. Fixed Header (Mobile Only) */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-[#0a0f1a] border-b border-white/5 z-[100] flex items-center justify-between px-6 lg:hidden">
        {/* Toggle Button (Right side in RTL) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsSidebarOpen(!isSidebarOpen);
          }}
          className={`w-12 h-12 rounded-2xl border-2 transition-all active:scale-95 flex items-center justify-center pointer-events-auto cursor-pointer shadow-xl ${
            isSidebarOpen
              ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/40'
              : 'bg-red-600 border-red-500 text-white shadow-red-500/40'
          }`}
          aria-label="Toggle Sidebar"
        >
          <Menu size={24} />
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-white tracking-tighter">
            {settings?.siteName || 'فهمني'} <span className="text-emerald-500 text-xs">TEACHER</span>
          </span>
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <LayoutDashboard size={20} className="text-white" />
          </div>
        </div>
      </header>

      {/* 3. Sidebar Z-Index 999 & 2. Call TeacherSidebar */}
      {/* Mobile Sidebar Backdrop */}
      <AnimatePresence>
        {!isDesktop && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[998] lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 right-0 z-[999] bg-space-900 border-l border-white/5 shadow-2xl transition-all duration-300 lg:relative ${
          isDesktop
            ? isSidebarCollapsed
              ? 'w-0 translate-x-full opacity-0 border-transparent'
              : 'w-[250px] translate-x-0 opacity-100'
            : isSidebarOpen
              ? 'translate-x-0 w-[250px]'
              : 'translate-x-full w-[250px]'
        } overflow-hidden`}
      >
        <TeacherSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </aside>

      <main className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        {/* Header (Coordinated with main layout header) */}
        <header className="h-20 md:h-24 px-4 md:px-12 flex items-center justify-between sticky top-0 z-[90] bg-space-950/50 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="relative group hidden lg:block">
              <Search
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors"
                size={18}
              />
              <input
                type="text"
                placeholder="ابحث عن درس أو طالب..."
                className="bg-white/5 border border-white/10 rounded-2xl py-3 pr-12 pl-6 w-64 xl:w-80 text-sm focus:outline-none focus:border-emerald-500/50 transition-all font-bold"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            {/* Sidebar Toggle for Desktop */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex p-2.5 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all text-emerald-500"
              title={isSidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
            >
              {isSidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
            </button>

            <Link
              to="/teacher/notifications"
              className="relative p-2.5 md:p-3 bg-white/5 rounded-xl md:rounded-2xl border border-white/10 hover:bg-white/10 transition-all group"
            >
              <Bell
                size={18}
                className="md:w-5 md:h-5 text-gray-400 group-hover:text-emerald-500"
              />
              <span className="absolute top-2.5 left-2.5 w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full border-2 border-space-950 animate-pulse" />
            </Link>
            <div className="flex items-center gap-3 md:gap-4 pl-2 border-l border-white/10">
              <div className="text-left hidden sm:block">
                <p className="text-xs md:text-sm font-black text-white flex items-center gap-1 justify-end">
                  {profile?.displayName}
                  <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full w-3.5 h-3.5 shadow-sm shrink-0" title="مدرس معتمد">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                </p>
                <p className="text-[8px] md:text-[10px] text-emerald-500 font-bold uppercase tracking-widest leading-tight">
                  مدرس معتمد
                </p>
              </div>
              <Link
                to="/profile"
                className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-[2px] shadow-xl shadow-emerald-500/10 overflow-hidden"
              >
                <div className="w-full h-full rounded-[10px] md:rounded-[14px] bg-space-900 flex items-center justify-center overflow-hidden">
                  {profile?.imageUrl ? (
                    <img src={profile.imageUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <User className="text-emerald-500 md:w-6 md:h-6" size={20} />
                  )}
                </div>
              </Link>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-12 pt-24 lg:pt-0 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
