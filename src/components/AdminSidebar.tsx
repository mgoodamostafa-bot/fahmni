import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  CreditCard,
  ChevronLeft,
  Settings,
  Activity,
  Bell,
  Key,
  X,
  Send,
  Database,
  Building2,
  LogOut,
  MessageSquare,
} from 'lucide-react';
import { SocialLinks } from './SocialLinks';
import { useSettings } from '../contexts/SettingsContext';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { getTenantAuth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from 'react';

interface AdminSidebarProps {
  onClose?: () => void;
  isCollapsed?: boolean;
  setIsSidebarCollapsed?: (c: boolean) => void;
}

export const AdminSidebar = ({
  onClose,
  isCollapsed,
  setIsSidebarCollapsed,
}: AdminSidebarProps) => {
  const { settings } = useSettings();

  const [isHovered, setIsHovered] = React.useState(false);
  const actualCollapsed = isCollapsed && !isHovered;
  const navigate = useNavigate();

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'wallet_requests'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingRequestsCount(snapshot.size);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(getTenantAuth());
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navItems: Array<{
    to: string;
    icon: any;
    label: string;
    end?: boolean;
    category?: string;
  }> = [
    {
      to: '/admin',
      icon: <LayoutDashboard size={20} />,
      label: 'لوحة التحكم',
      end: true,
      category: 'عام',
    },
    {
      to: '/admin/courses',
      icon: <BookOpen size={20} />,
      label: 'إدارة الكورسات',
      category: 'عام',
    },
    { to: '/library', icon: <Database size={20} />, label: 'المكتبة التعليمية', category: 'عام' },
    {
      to: '/question-bank',
      icon: <Database size={20} />,
      label: 'بنك الأسئلة الذكي',
      category: 'عام',
    },

    // Center & Finance Category
    {
      to: '/teacher/center',
      icon: <Building2 size={20} />,
      label: 'نظام إدارة السناتر (Center OS)',
      category: 'السنتر والماليات',
    },
    {
      to: '/admin/finance',
      icon: <CreditCard size={20} />,
      label: 'التقارير المالية',
      category: 'السنتر والماليات',
    },
    {
      to: '/admin/users',
      icon: <Users size={20} />,
      label: 'إدارة المدرسين والطلاب',
      category: 'السنتر والماليات',
    },
    {
      to: '/admin/enrollments',
      icon: <CreditCard size={20} />,
      label: 'الاشتراكات والمدفوعات',
      category: 'السنتر والماليات',
    },
    {
      to: '/teacher/codes',
      icon: <Key size={20} />,
      label: 'إدارة الأكواد',
      category: 'السنتر والماليات',
    },
    {
      to: '/admin/wallet-requests',
      icon: <CreditCard size={20} />,
      label: 'طلبات الشحن (فودافون)',
      category: 'السنتر والماليات',
    },
    {
      to: '/admin/groups',
      icon: <Users size={20} />,
      label: 'إدارة المجموعات',
      category: 'السنتر والماليات',
    },

    // Communication & Settings
    {
      to: '/admin/messages',
      icon: <MessageSquare size={20} />,
      label: 'رسائل الطلاب وأولياء الأمور',
      category: 'التواصل',
    },
    {
      to: '/admin/send-notification',
      icon: <Send size={20} />,
      label: 'إرسال تنبيه',
      category: 'التواصل',
    },
    {
      to: '/admin/notifications',
      icon: <Bell size={20} />,
      label: 'سجل التنبيهات',
      category: 'التواصل',
    },
    {
      to: '/admin/payment-settings',
      icon: <CreditCard size={20} />,
      label: 'بوابات الدفع',
      category: 'الإعدادات',
    },
    {
      to: '/admin/settings',
      icon: <Settings size={20} />,
      label: 'إعدادات المنصة',
      category: 'الإعدادات',
    },
  ];

  const categories = ['عام', 'الالسنتر والماليات', 'التواصل', 'الإعدادات'];

  return (
    <div
      className={`${actualCollapsed ? 'w-20' : 'w-[250px]'} bg-space-900 border-l border-white/5 h-screen flex flex-col text-right shadow-2xl z-[100] relative overflow-hidden transition-all duration-300`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      dir="rtl"
    >
      {/* 1. FIXED HEADER */}
      <div
        className={`shrink-0 ${actualCollapsed ? 'p-4' : 'p-8'} pb-4 border-b border-white/5 relative`}
      >
        {/* Mobile Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 left-4 p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        )}

        <div
          className={`flex items-center ${actualCollapsed ? 'justify-center' : 'justify-between'} overflow-hidden`}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-600/20 rotate-3 border border-white/10 p-1.5 shrink-0">
              <LayoutDashboard size={20} className="text-brand-600" />
            </div>
            {!actualCollapsed && (
              <h1 className="text-lg font-black font-Cairo tracking-tight text-white truncate">
                {settings.siteName}
              </h1>
            )}
          </div>

          {/* Inner Toggle for Desktop */}
          {!onClose && setIsSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed!(!isCollapsed)}
              className={`hidden lg:flex p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all ${isCollapsed ? 'rotate-180' : ''}`}
            >
              <ChevronLeft size={20} />
            </button>
          )}
        </div>
      </div>

      {/* 2. SCROLLABLE CONTENT */}
      <div
        className={`flex-1 overflow-y-auto scrollbar-hide ${actualCollapsed ? 'p-2' : 'p-6'} pt-6 flex flex-col`}
      >
        <nav className="space-y-8">
          {['عام', 'السنتر والماليات', 'التواصل', 'الإعدادات'].map((cat) => (
            <div key={cat} className="space-y-3">
              {!actualCollapsed && (
                <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mr-4 mb-2">
                  {cat}
                </p>
              )}
              {navItems
                .filter((item) => item.category === cat)
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-5 py-3.5 rounded-[1.2rem] font-black transition-all duration-300 group relative overflow-hidden ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                          : 'text-gray-500 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <div
                      className={`flex items-center justify-between w-full relative z-10`}
                    >
                      <div className={`flex items-center ${actualCollapsed ? 'justify-center' : 'gap-3'}`}>
                        <div className="shrink-0 transition-transform duration-500 group-hover:scale-110">
                          {item.icon}
                        </div>
                        {!actualCollapsed && <span className="text-xs truncate">{item.label}</span>}
                      </div>
                      {!actualCollapsed && item.to === '/admin/wallet-requests' && pendingRequestsCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 animate-pulse ml-2">
                          {pendingRequestsCount}
                        </span>
                      )}
                    </div>
                    {!actualCollapsed && (
                      <ChevronLeft
                        size={14}
                        className="opacity-10 group-hover:opacity-100 group-hover:-translate-x-1 transition-all shrink-0"
                      />
                    )}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>

        {/* 📱 Social Links for Admin Support */}
        {!actualCollapsed && (
          <div className="mt-8 pt-8 border-t border-white/5 px-4 space-y-4 text-center">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              دعم المنصة
            </p>
            <SocialLinks links={settings} variant="sidebar" className="justify-center" />
          </div>
        )}

        {/* Sidebar Footer */}
        <div className="mt-auto pt-10 pb-[50px]">
          {!actualCollapsed && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4 overflow-hidden px-2 text-right">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-2xl shadow-emerald-600/20 rotate-3 p-1.5 shrink-0">
                  <BookOpen size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-base font-black text-white font-Cairo truncate max-w-[120px]">
                    {settings.siteName}
                  </h1>
                  <p className="text-[8px] text-emerald-500 font-black uppercase tracking-widest">
                    {settings.tagline}
                  </p>
                </div>
              </div>
              <button className="w-full btn-secondary !py-3 !rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl mb-4">
                سجل التغييرات
              </button>

              <button
                onClick={() => {
                  handleLogout();
                  onClose?.();
                }}
                className="flex items-center gap-4 px-6 py-4 w-full text-red-500 font-bold hover:bg-red-500/10 rounded-2xl transition-all group"
              >
                <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm">تسجيل الخروج</span>
              </button>
            </div>
          )}
          {actualCollapsed && (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => {
                  handleLogout();
                  onClose?.();
                }}
                className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                title="تسجيل الخروج"
              >
                <LogOut size={20} />
              </button>
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-2xl shadow-emerald-600/20 rotate-3 p-1.5 shrink-0">
                <BookOpen size={20} className="text-emerald-600" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
