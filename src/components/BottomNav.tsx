import React from 'react';
import { Home, LayoutGrid, LayoutDashboard, User, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { unreadCount, setIsDrawerOpen } = useNotifications();
  const isLessonPage = location.pathname.includes('/learn');

  const [isTakingExam, setIsTakingExam] = React.useState(false);

  React.useEffect(() => {
    const checkClass = () => {
      setIsTakingExam(document.body.classList.contains('taking-exam'));
    };
    checkClass();
    const observer = new MutationObserver(checkClass);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // 🛡️ Strict Role Protection: Only show for students
  if (!user || !profile || profile.role !== 'student' || isLessonPage || isTakingExam) return null;

  const dashboardRoute = '/';

  const navItems = [
    { icon: LayoutGrid, label: 'الكورسات', path: '/courses' },
    { icon: FileText, label: 'الحقيبة', path: '/library' },
    { icon: LayoutDashboard, label: 'لوحتي', path: dashboardRoute },
    { icon: User, label: 'حسابي', path: '/profile' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-3xl border-t border-white/5 pt-2 pb-safe px-4">
      <div className="flex justify-between items-center max-w-md mx-auto h-[72px]">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center w-16 h-full transition-all active:scale-90 relative ${
                isActive ? 'text-brand-yellow font-black' : 'text-white/30 hover:text-white/60'
              }`}
            >
              <div className="relative flex items-center justify-center">
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 -mx-2 -my-1 bg-brand-yellow/15 rounded-full shadow-[0_4px_12px_rgba(251,191,36,0.25)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className="relative z-10 transition-transform"
                />
                {item.path === dashboardRoute && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center z-20 border border-black/40 shadow-lg animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] font-bold mt-1.5 transition-all ${isActive ? 'opacity-100' : 'opacity-40'}`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
