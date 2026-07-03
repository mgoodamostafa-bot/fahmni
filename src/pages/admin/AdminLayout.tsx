import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  ChevronRight,
  Shield,
  CreditCard,
  MessageSquare,
  Activity,
  FileText,
  Send,
  Home,
  Trophy,
  Zap,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { getTenantAuth } from '../../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { SocialLinks } from '../../components/SocialLinks';
import { useSettings } from '../../contexts/SettingsContext';

const SidebarItem = ({
  to,
  icon: Icon,
  label,
  active,
  collapsed,
}: {
  to: string;
  icon: any;
  label: string;
  active: boolean;
  collapsed: boolean;
}) => (
  <Link
    to={to}
    className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative ${
      active
        ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30'
        : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    <Icon
      size={22}
      className={`${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-300`}
    />
    {!collapsed && <span className="font-bold text-sm tracking-wide">{label}</span>}
    {active && !collapsed && (
      <motion.div
        layoutId="activeInd"
        className="absolute left-2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_#fff]"
      />
    )}
  </Link>
);

export const AdminLayout: React.FC = () => {
  const { settings } = useSettings();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && profile && profile.role !== 'admin' && profile.role !== 'teacher') {
      console.error('Unauthorized access attempt strictly blocked.');
      navigate('/', { replace: true });
    }
  }, [profile, loading, navigate]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = async () => {
    await signOut(getTenantAuth());
    navigate('/login');
  };

  const menuItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'لوحة التحكم' },
    { to: '/admin/courses', icon: BookOpen, label: 'إدارة الكورسات' },
    { to: '/admin/users', icon: Users, label: 'إدارة الطلاب' },
    { to: '/admin/enrollments', icon: CreditCard, label: 'الاشتراكات' },
    { to: '/admin/codes', icon: Shield, label: 'الأكواد' },
    { to: '/admin/coupons', icon: FileText, label: 'الكوبونات' },

    { type: 'header', label: 'إدارة السنتر (Center OS)' },
    { to: '/admin/branches', icon: Home, label: 'إدارة الفروع' },
    { to: '/admin/groups', icon: Users, label: 'مجموعات السنتر' },
    { to: '/admin/offline-results', icon: Trophy, label: 'نتائج السنتر (ورقي)' },
    { to: '/admin/finance', icon: Landmark, label: 'التقارير المالية' },
    { to: '/admin/maintenance', icon: Zap, label: 'صيانة النظام' },

    { type: 'header', label: 'الإعدادات والتقارير' },
    { to: '/admin/wallet-requests', icon: CreditCard, label: 'طلبات الشحن' },
    { to: '/admin/payment-settings', icon: CreditCard, label: 'بوابات الدفع' },
    { to: '/admin/send-notification', icon: Send, label: 'إرسال تنبيه' },
    { to: '/admin/settings', icon: Settings, label: 'إعدادات الموقع' },
    { to: '/admin/logs', icon: Activity, label: 'سجلات النشاط' },
    { to: '/admin/diagnostic', icon: Activity, label: 'فحص الصلاحيات' },
  ];

  return (
    <div
      className="min-h-screen bg-[#0a0f1e] text-white flex overflow-hidden font-display"
      dir="rtl"
    >
      {/* Dynamic Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? (isMobile ? '100%' : '300px') : '0px' }}
        className={`fixed lg:relative z-50 h-screen bg-[#0f172a]/80 backdrop-blur-3xl border-l border-white/5 flex flex-col transition-all duration-500 overflow-hidden ${
          !isSidebarOpen
            ? '-translate-x-full lg:translate-x-0 opacity-0 lg:opacity-0'
            : 'translate-x-0 opacity-100'
        }`}
      >
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center shadow-lg shadow-brand-blue/20">
              <Shield className="text-white" size={24} />
            </div>
            {isSidebarOpen && (
              <span className="text-xl font-black tracking-tighter">
                {settings.siteName || 'فهمني'} <span className="text-brand-blue">ADMIN</span>
              </span>
            )}
          </div>
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)}>
              <X size={24} />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto no-scrollbar">
          <p
            className={`px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 transition-opacity duration-300 ${!isSidebarOpen && 'opacity-0'}`}
          >
            القائمة الرئيسية
          </p>
          {menuItems.map((item, idx) => {
            if ((item as any).type === 'header') {
              return (
                <div
                  key={idx}
                  className={`pt-6 pb-2 px-4 transition-opacity duration-300 ${!isSidebarOpen && 'opacity-0'}`}
                >
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    {item.label}
                  </p>
                </div>
              );
            }
            return (
              <SidebarItem
                key={item.to}
                {...(item as any)}
                active={location.pathname === item.to}
                collapsed={!isSidebarOpen}
              />
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-white/5 bg-white/5 backdrop-blur-md space-y-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all group"
          >
            <LogOut size={22} className="group-hover:scale-110 transition-transform" />
            {isSidebarOpen && <span className="font-bold text-sm">تسجيل الخروج</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden relative no-scrollbar">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[#0a0f1e]/60 backdrop-blur-xl border-b border-white/5 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all text-brand-blue"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400 font-bold">
              <LayoutDashboard size={16} />
              <span>لوحة القيادة</span>
              <ChevronRight size={14} />
              <span className="text-white">الإحصائيات العامة</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5">
              <Search size={18} className="text-gray-500" />
              <input
                type="text"
                placeholder="بحث سريع..."
                className="bg-transparent border-none focus:ring-0 text-sm font-bold w-40 text-right"
                dir="rtl"
              />
            </div>
            <button className="p-3 bg-white/5 hover:bg-brand-blue/10 rounded-2xl border border-white/5 transition-all relative group text-gray-400 hover:text-brand-blue">
              <Bell size={20} />
              <span className="absolute top-3 right-3 w-2 h-2 bg-brand-blue rounded-full ring-4 ring-[#0a0f1e] group-hover:scale-110 transition-transform"></span>
            </button>
            <div className="h-10 w-[1px] bg-white/5 mx-2"></div>
            <div className="flex items-center gap-3 bg-white/5 p-1.5 pl-4 rounded-2xl border border-white/5">
              <div className="w-9 h-9 rounded-xl bg-brand-blue/20 flex items-center justify-center text-brand-blue font-black shadow-inner">
                {profile?.displayName?.charAt(0) || 'A'}
              </div>
              <div className="text-right hidden sm:block leading-tight">
                <p className="text-xs font-black text-white">
                  {profile?.displayName || 'المستخدم'}
                </p>
                <p className="text-[9px] font-black text-brand-blue uppercase tracking-tighter">
                  {profile?.role === 'admin' || profile?.isOwner
                    ? 'أدمن المنصة'
                    : profile?.role === 'teacher'
                      ? 'مدرس'
                      : 'طالب'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};
