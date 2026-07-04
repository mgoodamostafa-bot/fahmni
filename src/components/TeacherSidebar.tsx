import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Settings,
  LogOut,
  Bell,
  Target,
  PlusCircle,
  BookText,
  MessageSquare,
  User,
  Key,
  Menu,
  X,
  ChevronLeft,
  Send,
  ClipboardList,
  FileText,
  Library,
  Book,
  FileQuestion,
  Folder,
  Star,
  CreditCard,
  Wallet,
  BarChart3,
  Tag,
  Shield,
  ShieldAlert,
  Building2,
  UsersRound,
  FileSpreadsheet,
  Wrench,
  ScanLine,
  Stethoscope,
} from 'lucide-react';

import { getTenantAuth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { SocialLinks } from './SocialLinks';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from 'react';

interface TeacherSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const TeacherSidebar: React.FC<TeacherSidebarProps> = ({ isOpen, onClose }) => {
  const handleLogout = () => signOut(getTenantAuth());
  const { isOwner } = useAuth();
  const settingsData = useSettings();
  
  const isSingleMode = settingsData.settings?.platformMode === 'single';

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'wallet_requests'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingRequestsCount(snapshot.size);
    });
    return () => unsubscribe();
  }, []);

  // ── Communication items ──
  const commItems = [
    { icon: <Bell size={22} />, label: 'التنبيهات', path: '/teacher/notifications' },
    { icon: <Send size={22} />, label: 'إرسال تنبيه', path: '/teacher/send-notification' },
  ];

  // ── Settings items (only shown to owner) ──
  const settingsItems = [
    { icon: <Shield size={22} />, label: 'بوابات الدفع', path: '/teacher/payment-settings' },
    { icon: <Wrench size={22} />, label: 'الصيانة', path: '/teacher/maintenance' },
    { icon: <Stethoscope size={22} />, label: 'تشخيص النظام', path: '/teacher/diagnostic' },
    { icon: <ShieldAlert size={22} className="text-red-500" />, label: 'كاشف التسريبات الجنائي', path: '/teacher/leak-decoder' },
    { icon: <User size={22} />, label: 'حسابي', path: '/profile' },
  ];

  const renderSection = (items: any[], sectionLabel?: string) => (
    <>
      {sectionLabel && (
        <div className="pt-6 pb-2 px-2">
          <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">{sectionLabel}</p>
        </div>
      )}
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/teacher'}
          onClick={onClose}
          className={({ isActive }) => `
            flex items-center justify-between px-6 py-4 rounded-2xl font-bold transition-all duration-300 group
            ${
              isActive
                ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 translate-x-1'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }
          `}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              {item.icon}
              <span className="text-sm tracking-tight">{item.label}</span>
            </div>
            {item.path === '/teacher/wallet-requests' && pendingRequestsCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 animate-pulse ml-2">
                {pendingRequestsCount}
              </span>
            )}
          </div>
          <ChevronLeft
            size={16}
            className={`transition-all duration-300 ${isOpen ? 'opacity-30 group-hover:opacity-100 group-hover:-translate-x-1' : 'opacity-0 lg:opacity-30'} shrink-0`}
          />
        </NavLink>
      ))}
    </>
  );

  const renderProfileOnly = () => (
    <NavLink
      to="/profile"
      onClick={onClose}
      className={({ isActive }) => `
        flex items-center justify-between px-6 py-4 rounded-2xl font-bold transition-all duration-300 group mt-4
        ${isActive ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 translate-x-1' : 'text-gray-500 hover:text-white hover:bg-white/5'}
      `}
    >
      <div className="flex items-center gap-4">
        <User size={22} />
        <span className="text-sm tracking-tight">حسابي</span>
      </div>
      <ChevronLeft size={16} className="opacity-0 lg:opacity-30" />
    </NavLink>
  );

  const renderSingleModeNav = () => {
    // In single mode, the teacher IS the admin, so we merge everything seamlessly into logical groups.
    const teacherBaseItems = [
      { icon: <LayoutDashboard size={22} />, label: 'لوحة التحكم', path: '/teacher' },
      { icon: <Book size={22} />, label: 'كورساتي', path: '/teacher/courses' },
      { icon: <FileQuestion size={22} />, label: 'إضافة أسئلة', path: '/teacher/add-question' },
      { icon: <Folder size={22} />, label: 'بنوك أسئلتي', path: '/teacher/question-banks' },
      { icon: <Target size={22} />, label: 'إضافة اختبار بسيط', path: '/teacher/add-exam' },
      { icon: <BookOpen size={22} />, label: 'سجل الامتحانات', path: '/teacher/my-exams' },
      { icon: <ClipboardList size={22} />, label: 'نتائج الامتحانات', path: '/teacher/results' },
      { icon: <Star size={22} />, label: 'تسليمات الواجب', path: '/teacher/submissions' },
      { icon: <Library size={22} />, label: 'الحقيبة التعليمية', path: '/teacher/portfolio' },
      { icon: <MessageSquare size={22} />, label: 'المناقشات', path: '/teacher/discussions' },
    ];

    const studentManagementItems = [
      { icon: <Users size={22} />, label: 'الطلاب المشتركين بالدورات', path: '/teacher/students' },
      { icon: <UsersRound size={22} />, label: 'أسماء وبيانات الطلاب المسجلين', path: '/teacher/users' },
      { icon: <Building2 size={22} />, label: 'إدارة المجموعات', path: '/teacher/groups' },
      { icon: <ScanLine size={22} />, label: 'تسجيل الحضور', path: '/teacher/attendance' },
    ];

    const financeItems = [
      { icon: <CreditCard size={22} />, label: 'الاشتراكات والمدفوعات', path: '/teacher/enrollments' },
      { icon: <BarChart3 size={22} />, label: 'التقارير المالية', path: '/teacher/finance' },
      { icon: <Key size={22} />, label: 'إدارة الأكواد', path: '/teacher/codes' },
      { icon: <Wallet size={22} />, label: 'طلبات الشحن', path: '/teacher/wallet-requests' },
    ];

    return (
      <nav className="space-y-2">
        {renderSection(teacherBaseItems, 'التعليم والمسارات')}
        {renderSection(studentManagementItems, 'الطلاب والتسجيلات')}
        {renderSection(financeItems, 'الماليات والاشتراكات')}
        {renderSection(commItems, 'التواصل')}
        {renderSection(settingsItems, 'الإعدادات المتقدمة')}
      </nav>
    );
  };

  const renderAcademyModeNav = () => {
    const teacherItems = [
      { icon: <LayoutDashboard size={22} />, label: 'لوحة التحكم', path: '/teacher' },
      { icon: <Book size={22} />, label: 'كورساتي', path: '/teacher/courses' },
      { icon: <FileQuestion size={22} />, label: 'إضافة أسئلة', path: '/teacher/add-question' },
      { icon: <Folder size={22} />, label: 'بنوك أسئلتي', path: '/teacher/question-banks' },
      { icon: <Target size={22} />, label: 'إضافة اختبار بسيط', path: '/teacher/add-exam' },
      { icon: <BookOpen size={22} />, label: 'سجل الامتحانات', path: '/teacher/my-exams' },
      { icon: <ClipboardList size={22} />, label: 'نتائج الامتحانات', path: '/teacher/results' },
      { icon: <Star size={22} />, label: 'تسليمات الواجب', path: '/teacher/submissions' },
      { icon: <Library size={22} />, label: 'الحقيبة التعليمية', path: '/teacher/portfolio' },
      { icon: <Users size={22} />, label: 'الطلاب المشتركين', path: '/teacher/students' },
      { icon: <MessageSquare size={22} />, label: 'المناقشات', path: '/teacher/discussions' },
    ];

    const adminItems = [
      { icon: <UsersRound size={22} />, label: 'الطلاب المسجلين والمستخدمين', path: '/teacher/users' },
      { icon: <CreditCard size={22} />, label: 'الاشتراكات والمدفوعات', path: '/teacher/enrollments' },
      { icon: <BarChart3 size={22} />, label: 'التقارير المالية', path: '/teacher/finance' },
      { icon: <Key size={22} />, label: 'إدارة الأكواد', path: '/teacher/codes' },
      { icon: <Wallet size={22} />, label: 'طلبات الشحن', path: '/teacher/wallet-requests' },
      { icon: <Building2 size={22} />, label: 'إدارة المجموعات', path: '/teacher/groups' },
      { icon: <ScanLine size={22} />, label: 'تسجيل الحضور', path: '/teacher/attendance' },
    ];

    return (
      <nav className="space-y-2">
        {renderSection(teacherItems, 'التعليم')}
        {isOwner && renderSection(adminItems, 'الإدارة والماليات')}
        {renderSection(commItems, 'التواصل')}
        {isOwner ? renderSection(settingsItems, 'الإعدادات') : renderProfileOnly()}
      </nav>
    );
  };

  return (
    <>
      <aside
        className={`
        fixed top-0 right-0 h-full bg-space-950/95 backdrop-blur-3xl border-l border-white/5 z-[100]
        transition-all duration-500 ease-in-out
        ${isOpen ? 'w-[250px] translate-x-0 shadow-2xl shadow-emerald-600/10' : 'w-[250px] translate-x-full lg:translate-x-0'}
        lg:sticky lg:top-0 lg:h-screen lg:w-[250px] lg:translate-x-0
      `}
        dir="rtl"
      >
        <div className="flex flex-col h-full overflow-hidden bg-space-950/95 backdrop-blur-3xl relative">
          <div className="shrink-0 p-8 pb-4 border-b border-white/5 relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-2xl shadow-emerald-600/20 rotate-3 p-1.5">
                <BookOpen size={24} />
              </div>
              <div>
                <h1 className="text-xl font-black text-white font-display">
                  {settingsData.settings?.siteName || 'فهمني'}
                </h1>
                <p className="text-[8px] text-emerald-500 font-black uppercase tracking-widest">
                  {isOwner ? 'لوحة التحكم الكاملة' : 'مساحة المدرس'}
                </p>
              </div>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="lg:hidden p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide p-8 pt-6 flex flex-col">
            {isSingleMode ? renderSingleModeNav() : renderAcademyModeNav()}

            <div className="pt-6 mt-6 border-t border-white/5 space-y-4 text-center">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                تواصل مع الإدارة
              </p>
              <SocialLinks
                links={settingsData.settings}
                variant="sidebar"
                className="justify-center"
              />
            </div>

            <div className="mt-auto space-y-4 pt-10 pb-[60px]">
              <div className="p-6 bg-emerald-600/10 rounded-3xl border border-emerald-600/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-600/10 blur-2xl rounded-full translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-700" />
                <p className="text-xs text-emerald-500 font-black uppercase tracking-widest mb-2">
                  الدعم الفني
                </p>
                <p className="text-sm font-bold text-white mb-4 leading-relaxed">
                  تحتاج مساعدة في المنصة؟
                </p>
                <a
                  href={
                    settingsData.settings.whatsapp
                      ? settingsData.settings.whatsapp.startsWith('http')
                        ? settingsData.settings.whatsapp
                        : `https://wa.me/${settingsData.settings.whatsapp.replace(/\+/g, '')}`
                      : '#'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-white text-emerald-900 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-emerald-50 shadow-lg shadow-black/10 transition-all block text-center"
                >
                  تواصل معنا
                </a>
              </div>

              <button
                onClick={() => {
                  handleLogout();
                  onClose?.();
                }}
                className="flex items-center gap-4 px-6 py-4 w-full text-red-400 font-bold hover:bg-red-400/10 rounded-2xl transition-all group"
              >
                <LogOut size={22} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm">تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
