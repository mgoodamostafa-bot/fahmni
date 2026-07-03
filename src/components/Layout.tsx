import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTenant } from '../contexts/TenantContext';
import { getTenantAuth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import {
  LogOut,
  BookOpen,
  LayoutGrid,
  Menu,
  X,
  Wallet,
  Bell,
  Home,
  LayoutDashboard,
  User,
  ShieldAlert,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { SocialLinks } from './SocialLinks';
import { BottomNav } from './BottomNav';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationCenter } from './NotificationCenter';
import { useNotifications } from '../contexts/NotificationContext';

export const Layout: React.FC = () => {
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const { tenantData } = useTenant();
  const { newNotification, clearNewNotification, isDrawerOpen, setIsDrawerOpen } =
    useNotifications();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleLogout = async () => {
    await signOut(getTenantAuth());
    navigate('/login');
  };

  const isCoursesPage =
    location.pathname === '/courses' || /^\/courses\/[^/]+$/.test(location.pathname);

  // 🛡️ Safety Bypass: If this is an Admin or Teacher route,
  // It shouldn't get here because of App.tsx structure, but isolated completely to be sure.
  const isRoleSpecificRoute =
    location.pathname.startsWith('/admin') || location.pathname.startsWith('/teacher');

  // Auto-dismiss notification after 6 seconds
  React.useEffect(() => {
    if (newNotification) {
      const timer = setTimeout(() => {
        clearNewNotification(false); // Already marked read in context
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [newNotification, clearNewNotification]);

  if (isRoleSpecificRoute) {
    return <Outlet />;
  }

  return (
    <div
      className="flex h-screen bg-[#0a0f1a] font-sans selection:bg-brand-blue/30 overflow-hidden"
      dir="rtl"
    >
      {/* Real-time Toast Notifications */}
      <AnimatePresence>
        {user &&
          newNotification &&
          !location.pathname.includes('/login') &&
          !location.pathname.includes('/register') && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9 }}
              className="fixed top-4 left-4 right-4 md:top-8 md:left-auto md:right-8 md:w-96 z-[9999] group overflow-hidden"
            >
              {/* Glassmorphic Container */}
              <div className="relative w-80 md:w-96 bg-space-950/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-start gap-4 ring-1 ring-white/5">
                {/* Animated Progress Bar Background */}
                <div className="absolute bottom-0 left-0 h-1 bg-emerald-500/10 w-full" />
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: 0 }}
                  transition={{ duration: 8, ease: 'linear' }}
                  className="absolute bottom-0 left-0 h-1 bg-emerald-500 shadow-[0_0_10px_#10b981]"
                />

                {/* Icon Section */}
                <div className="relative shrink-0">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-inner group-hover:scale-110 transition-transform">
                    <Bell className="text-emerald-500 animate-wiggle" size={28} />
                  </div>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-space-950 animate-pulse shadow-[0_0_10px_#10b981]" />
                </div>

                {/* Content Section */}
                <div className="flex-1 min-w-0 py-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">
                      تنبيه جديد
                    </span>
                    <button
                      onClick={() => clearNewNotification(true)}
                      className="text-gray-500 hover:text-white transition-colors bg-white/5 p-1 rounded-lg hover:bg-white/10"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <h4 className="text-sm font-black text-white leading-tight mb-2 truncate group-hover:text-emerald-400 transition-colors uppercase tracking-tight">
                    {newNotification.title}
                  </h4>
                  <p className="text-[11px] font-bold text-gray-400 leading-relaxed mb-4 line-clamp-2 opacity-80">
                    {newNotification.message}
                  </p>

                  <button
                    onClick={() => {
                      navigate(`/notifications/${newNotification.id}`);
                      clearNewNotification(true);
                    }}
                    className="w-full text-[10px] font-black text-white bg-emerald-500 hover:bg-emerald-600 px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    فتح التفاصيل
                  </button>
                </div>
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* Sidebar Overlay (Drawer) - Disabled on Home Page */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9000]"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full sm:w-80 md:w-96 bg-[#0a0f1c]/95 backdrop-blur-2xl border-l border-white/5 flex flex-col z-[9001] shadow-2xl overflow-hidden"
              dir="rtl"
            >
              {/* Drawer Header */}
              <div className="p-8 border-b border-white/5 bg-white/2 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white">التنبيهات</h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                    آخر المستجدات
                  </p>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <NotificationCenter isDrawer={true} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar Overlay (Drawer) - Disabled on Home Page */}
      <AnimatePresence>
        {isSidebarOpen && location.pathname !== '/' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[9998]"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-72 bg-[#0a0f1a] border-l border-white/10 flex flex-col z-[9999] shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <Sidebar
                isOpen={isSidebarOpen}
                isCollapsed={false}
                onToggleCollapse={() => {}}
                onClose={() => setIsSidebarOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main
        className={`flex-1 overflow-y-auto transition-all duration-300 flex flex-col relative z-0 custom-scrollbar ${location.pathname === '/' ? 'pt-0 md:pt-20' : user && profile?.role === 'student' && !location.pathname.includes('/learn') && location.pathname !== '/profile' ? 'pt-[70px]' : 'pt-0'} ${user && profile?.role === 'student' && !location.pathname.includes('/learn') ? 'pb-28 md:pb-0' : ''}`}
      >
        {/* Floating Sidebar Toggle (Only visible if NOT on home page and NOT on lesson page AND USER IS STUDENT) */}
        {/* ─── Global Clean UI Header (Internal Pages, except Profile) ─── */}
        {user &&
          profile?.role === 'student' &&
          location.pathname !== '/' &&
          location.pathname !== '/profile' &&
          !location.pathname.includes('/learn') && (
            <header className="fixed top-0 left-0 right-0 z-[70] h-20 bg-[#0a0f1a]/80 backdrop-blur-xl border-b border-white/5 px-6 lg:px-12 flex items-center justify-between">
              {/* 1. Branding (Top Left) */}
              <Link to="/" className="flex items-center gap-3 group">
                <div className="h-11 w-11 shrink-0 flex items-center justify-center overflow-hidden">
                  {tenantData?.logo ? (
                    <img src={tenantData.logo} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="bg-brand-blue p-2 rounded-full">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
                <span className="text-xl font-black text-white font-display tracking-tight">
                  {tenantData?.name || settings.siteName || 'فهمني'}
                </span>
              </Link>

              {/* 2. Menu Button (Top Right) */}
              <button
                onClick={toggleSidebar}
                className="w-12 h-12 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white rounded-2xl shadow-lg border border-brand-blue/20 flex items-center justify-center transition-all active:scale-90"
                title="القائمة"
              >
                <Menu size={24} />
              </button>
            </header>
          )}

        {/* Header - Fixed Top (Only on Home Page for Desktop, as requested) */}
        <header
          className={`fixed top-0 left-0 right-0 z-50 h-20 bg-[#0a0f1a] border-b border-white/5 shadow-md hidden ${location.pathname === '/' ? 'md:block' : ''}`}
        >
          <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-4 lg:px-8">
            {/* Left Side: Logo (Moved from right to left as requested) */}
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="h-11 w-11 shrink-0 flex items-center justify-center overflow-hidden">
                  {tenantData?.logo ? (
                    <img src={tenantData.logo} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="bg-brand-blue p-2 rounded-full">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
                <span className="text-xl font-black text-white font-display tracking-tight">
                  {tenantData?.name || settings.siteName || 'فهمني'}
                </span>
              </Link>
            </div>

            {/* Center: Desktop Navigation Links (Moved if necessary, but reordered for logic) */}
            {user && profile?.role === 'student' && (
              <nav className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
                {[
                  { to: '/courses', icon: LayoutGrid, label: 'الكورسات' },
                  { to: '/', icon: LayoutDashboard, label: 'لوحتي' },
                  { to: '/profile', icon: User, label: 'حسابي' },
                ].map((item) => {
                  const isActive =
                    location.pathname === item.to ||
                    (item.to !== '/' && location.pathname.startsWith(item.to));
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`relative flex flex-col items-center justify-center gap-1.5 px-4 py-2 transition-all duration-300 group ${
                        isActive ? 'text-emerald-500' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <item.icon
                        size={20}
                        className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}
                      />
                      <span className="text-[12px] font-black tracking-wide leading-none">
                        {item.label}
                      </span>

                      {isActive && (
                        <motion.div
                          layoutId="nav-dot"
                          className="absolute -bottom-1 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* Right Side: Wallet, Profile & Menu Toggle (Moved from left to right) */}
            <div className="flex items-center gap-3 sm:gap-4">
              {user && (
                <div className="flex items-center gap-2 sm:gap-4">
                  {profile?.role === 'student' && (
                    <div className="hidden sm:flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                      <Wallet size={16} className="text-brand-yellow" />
                      <span className="text-sm font-black text-white">
                        {(profile?.walletBalance || 0).toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>
                  )}
                  <NotificationCenter />

                  {/* Profile Link */}
                  <Link
                    to="/profile"
                    className="w-10 h-10 rounded-xl bg-brand-blue/10 overflow-hidden flex items-center justify-center border border-white/10 hover:border-brand-blue/50 transition-colors"
                  >
                    {profile?.imageUrl ? (
                      <img src={profile.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={20} className="text-brand-blue" />
                    )}
                  </Link>
                </div>
              )}

              {user ? (
                <div className="flex items-center gap-3 sm:gap-4">
                  {profile?.role !== 'student' && (
                    <Link
                      to={profile?.role === 'admin' ? '/admin' : '/teacher'}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                        profile?.role === 'admin'
                          ? 'bg-brand-blue text-white'
                          : 'bg-emerald-600 text-white'
                      } hover:scale-105 shadow-lg`}
                    >
                      {profile?.role === 'admin' ? (
                        <ShieldAlert size={16} />
                      ) : (
                        <LayoutDashboard size={16} />
                      )}
                      لوحة التحكم
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    title="تسجيل الخروج"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link to="/login" className="px-4 py-2 text-sm font-bold text-white">
                    دخول
                  </Link>
                  <Link to="/register" className="btn-secondary !py-2 !px-6 !text-xs">
                    اشترك
                  </Link>
                </div>
              )}

              {/* Header Hamburger for Desktop if needed (or just keep the floating one) */}
              {user && location.pathname !== '/' && (
                <button
                  onClick={toggleSidebar}
                  className="p-2 text-white hover:bg-white/5 rounded-xl transition-colors sm:hidden"
                >
                  <Menu size={24} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Padding to prevent overlap with fixed header */}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${isCoursesPage ? 'pt-8' : 'pt-0'}`}
        >
          <div
            className={`${location.pathname === '/' || location.pathname.includes('/learn') ? 'max-w-full px-0' : 'max-w-[1700px] px-4 lg:px-12'} ${location.pathname.includes('/learn') ? 'py-0' : 'py-6'} mx-auto w-full flex-grow`}
          >
            <Outlet />
          </div>

          {!location.pathname.includes('/learn') && (
            <footer className="mt-auto border-t border-white/5 px-8 bg-white/2 py-16">
              <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between items-center gap-10 text-gray-500">
                <div className="flex items-center gap-4 group cursor-default">
                  <span className="font-black text-white/20 transition-all text-xl">
                    {tenantData?.name || settings.siteName}
                  </span>
                </div>
                <SocialLinks links={settings} variant="footer" />
                <p className="font-bold tracking-widest uppercase opacity-40 text-sm">
                  © {new Date().getFullYear()} {tenantData?.name || settings.siteName} • العلم
                  والتميز
                </p>
              </div>
            </footer>
          )}
        </div>

        {user && profile?.role === 'student' && <BottomNav />}
      </main>
    </div>
  );
};
