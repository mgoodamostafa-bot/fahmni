import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { SocialLinks } from './SocialLinks';
import { useSettings } from '../contexts/SettingsContext';
import { useTenant } from '../contexts/TenantContext';
import {
  BookOpen,
  ClipboardList,
  User,
  LogOut,
  X,
  ChevronLeft,
  LayoutDashboard,
  Key,
  Settings,
  Wallet,
  Bell,
  Home,
  MapPin,
  CalendarDays,
  ShieldCheck,
  FileText,
  Users,
  QrCode,
  Award,
  Zap,
  Trophy,
  MessageSquare,
  Star,
  Building2,
} from 'lucide-react';
import { getTenantAuth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isCollapsed,
  onToggleCollapse,
  onClose,
  className = '',
}) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { tenantData } = useTenant();
  const { unreadCount, setIsDrawerOpen } = useNotifications();

  const handleLogout = async () => {
    await signOut(getTenantAuth());
    navigate('/login');
  };

  const navItems = [
    // --- Student Items ---
    {
      to: '/',
      icon: <LayoutDashboard size={22} />,
      label: 'لوحتي',
      role: 'student',
      end: true,
    },
    { to: '/courses', icon: <BookOpen size={22} />, label: 'كل الكورسات', role: 'student' },
    { to: '/library', icon: <FileText size={22} />, label: 'الحقيبة التعليمية', role: 'student' },
    { to: '/my-courses', icon: <BookOpen size={22} />, label: 'كورساتي', role: 'student' },
    {
      to: '/question-bank',
      icon: <ClipboardList size={22} />,
      label: 'بنك الأسئلة',
      role: 'student',
    },
    { to: '/exams', icon: <FileText size={22} />, label: 'الاختبارات', role: 'student' },

    // --- Teacher/Admin Items ---
    {
      to: '/teacher',
      icon: <LayoutDashboard size={22} />,
      label: 'لوحة المعلم',
      role: 'teacher',
      end: true,
    },
    {
      to: '/teacher/courses',
      icon: <BookOpen size={22} />,
      label: 'إدارة الكورسات',
      role: 'teacher',
    },
    { to: '/teacher/students', icon: <Users size={22} />, label: 'طلابي', role: 'teacher' },
    {
      to: '/teacher/results',
      icon: <FileText size={22} />,
      label: 'نتائج الاختبارات',
      role: 'teacher',
    },
    {
      to: '/teacher/my-exams',
      icon: <ClipboardList size={22} />,
      label: 'امتحاناتي',
      role: 'teacher',
    },
    {
      to: '/teacher/submissions',
      icon: <Star size={22} />,
      label: 'تسليمات الواجب',
      role: 'teacher',
    },

    // --- Admin Only (merged into /teacher routes) ---
    {
      to: '/teacher/users',
      icon: <Users size={22} />,
      label: 'إدارة المستخدمين',
      role: 'admin',
    },

    // Center OS Section
    { type: 'header', label: 'إدارة السنتر (Center OS)', role: 'admin' },
    {
      to: '/teacher/center',
      icon: <Building2 size={22} />,
      label: 'لوحة إدارة السناتر الشاملة',
      role: 'admin',
    },
    {
      to: '/teacher/attendance',
      icon: <QrCode size={22} />,
      label: 'تحضير الطلاب بالـ QR',
      role: 'admin',
    },
    {
      to: '/teacher/branches',
      icon: <Home size={22} />,
      label: 'إدارة الفروع (السناتر)',
      role: 'admin',
    },
    { to: '/teacher/groups', icon: <Users size={22} />, label: 'مجموعات السنتر', role: 'admin' },
    {
      to: '/teacher/offline-results',
      icon: <Trophy size={22} />,
      label: 'نتائج السنتر',
      role: 'admin',
    },
    { to: '/teacher/maintenance', icon: <Zap size={22} />, label: 'صيانة النظام', role: 'admin' },

    { type: 'header', label: 'الإعدادات العامة', role: 'admin' },
    { to: '/teacher/diagnostic', icon: <Settings size={22} />, label: 'إعدادات المنصة', role: 'admin' },

    // --- Common ---
    {
      to: '/notifications',
      icon: <Bell size={22} />,
      label: 'الإشعارات',
      badge: unreadCount,
      isAction: true,
    },
    { to: '/profile', icon: <User size={22} />, label: 'الملف الشخصي' },
  ].filter((item) => {
    if (!item.role) return true; // Common items
    if (profile?.role === 'admin') return true; // Admin sees everything or its own
    return item.role === profile?.role;
  });

  const renderNavItem = (item: any) => {
    const content = (
      <>
        <div className="flex items-center gap-4 min-w-0">
          <span className={`transition-transform duration-300 group-hover:scale-110 shrink-0`}>
            {item.icon}
          </span>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0, x: 10 }}
                animate={{ opacity: 1, width: 'auto', x: 0 }}
                exit={{ opacity: 0, width: 0, x: 10 }}
                className="whitespace-nowrap overflow-hidden text-sm md:text-base"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            {(item.badge ?? 0) > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-lg shadow-red-500/20">
                {item.badge}
              </span>
            )}
            <ChevronLeft
              size={16}
              className="opacity-30 group-hover:opacity-70 group-hover:-translate-x-1 transition-all"
            />
          </div>
        )}
      </>
    );

    const commonClass = (isActive: boolean = false) =>
      `flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-4 py-3 md:py-3.5 rounded-2xl font-bold transition-all duration-300 group w-full ${
        isActive
          ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
          : 'text-gray-500 dark:text-gray-400 hover:bg-brand-blue/5 hover:text-brand-blue dark:hover:text-brand-blue'
      }`;

    if (item.isAction) {
      return (
        <button
          key={item.label}
          onClick={() => {
            if (item.label === 'الإشعارات') {
              setIsDrawerOpen(true);
            }
            onClose();
          }}
          className={commonClass(false)}
        >
          {content}
        </button>
      );
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onClose}
        className={({ isActive }) => commonClass(isActive)}
      >
        {content}
      </NavLink>
    );
  };

  const logoUrl = tenantData?.logo || settings.logoUrl || '';
  const siteName = tenantData?.name || settings.siteName || 'منصة فهمني';

  return (
    <div className={`flex flex-col h-full bg-transparent relative overflow-hidden ${className}`}>
      {/* Header (Close on mobile) */}
      <div className="flex-none p-4 lg:p-6 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="w-full h-full object-cover rounded-full" />
              ) : (
                <div className="bg-brand-blue p-2 rounded-full">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <span className="text-base font-black text-white font-display tracking-tight">
              {siteName}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 lg:p-6 pt-4 flex flex-col">
        <nav className="space-y-1.5 md:space-y-2">
          {navItems.map((item, idx) => {
            if (item.type === 'header') {
              if (isCollapsed) return <div key={idx} className="h-px bg-white/5 my-4" />;
              return (
                <div key={idx} className="pt-6 pb-2 px-4">
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                    {item.label}
                  </p>
                </div>
              );
            }
            return renderNavItem(item);
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="mt-auto pt-6 border-t border-white/5 space-y-4 pb-20 lg:pb-8">
          {user && (
            <div
              className={`flex items-center ${isCollapsed ? 'justify-center p-2' : 'gap-4 px-4 py-3'} bg-white/2 dark:bg-white/5 rounded-2xl border border-white/5 transition-all`}
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-brand-blue/10 overflow-hidden flex items-center justify-center shrink-0 border border-white/10">
                {profile?.imageUrl ? (
                  <img src={profile.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={20} className="text-brand-blue" />
                )}
              </div>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex-1 min-w-0 text-right"
                >
                  <p className="text-sm font-black truncate text-white">
                    {profile?.displayName || user.email}
                  </p>
                  <p className="text-[10px] text-brand-blue font-black uppercase tracking-wider mt-0.5">
                    {profile?.role === 'admin'
                      ? 'مدير'
                      : profile?.role === 'teacher'
                        ? 'مدرس'
                        : 'طالب متميز'}
                  </p>
                </motion.div>
              )}
            </div>
          )}

          {!isCollapsed && (
            <div className="px-4 py-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <div className="h-px flex-1 bg-white/5" />
                <MessageSquare size={16} className="shrink-0" />
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <SocialLinks links={settings} variant="sidebar" className="justify-center" />
            </div>
          )}

          <button
            onClick={() => {
              handleLogout();
              onClose();
            }}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 px-5'} py-4 rounded-2xl font-bold text-red-500 hover:bg-red-500/10 transition-all group`}
            title={isCollapsed ? 'خروج' : undefined}
          >
            <LogOut
              size={22}
              className="group-hover:-translate-x-1 transition-transform shrink-0"
            />
            {!isCollapsed && <span>خروج</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
