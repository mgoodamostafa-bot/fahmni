import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  X,
  Check,
  Trash2,
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { Link } from 'react-router-dom';

export const NotificationCenter: React.FC<{ isDrawer?: boolean }> = ({ isDrawer = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="text-emerald-500" size={18} />;
      case 'warning':
        return <AlertTriangle className="text-accent-gold" size={18} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={18} />;
      default:
        return <Info className="text-brand-600" size={18} />;
    }
  };

  const renderContent = () => (
    <div
      className={
        isDrawer
          ? 'w-full h-full flex flex-col pt-4'
          : 'fixed lg:absolute left-4 right-4 lg:left-0 lg:right-auto top-24 lg:top-auto lg:mt-4 lg:w-96 max-h-[80vh] lg:max-h-[600px] bg-white/95 dark:bg-space-900/95 backdrop-blur-2xl border border-gray-100 dark:border-white/10 rounded-[2.5rem] shadow-3xl z-[70] text-right overflow-hidden flex flex-col'
      }
      dir="rtl"
    >
      {!isDrawer && (
        <div className="p-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black font-display text-gray-900 dark:text-white tracking-tight">
              التنبيهات
            </h3>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
              {unreadCount > 0 ? `لديك ${unreadCount} تنبيهات جديدة` : 'لا توجد تنبيهات جديدة'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-[10px] font-black text-brand-blue hover:text-brand-blue/80 transition-colors uppercase tracking-widest bg-brand-blue/5 px-3 py-1.5 rounded-lg"
            >
              تحديد الكل كمقروء
            </button>
          )}
        </div>
      )}

      {isDrawer && unreadCount > 0 && (
        <div className="px-6 pb-4 border-b border-white/5 flex justify-end">
          <button
            onClick={markAllAsRead}
            className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20"
          >
            تحديد الكل كمقروء
          </button>
        </div>
      )}

      <div className="overflow-y-auto flex-1 custom-scrollbar">
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-6 border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all group relative ${notif.read ? 'opacity-60' : ''}`}
            >
              <div className="flex gap-4">
                <div
                  className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/2 shadow-inner transition-transform group-hover:scale-110`}
                >
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-sm text-gray-900 dark:text-white line-clamp-1">
                      {notif.title}
                    </h4>
                    <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase whitespace-nowrap mr-2">
                      {notif.createdAt?.toDate
                        ? notif.createdAt
                            .toDate()
                            .toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                        : 'الآن'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-bold leading-relaxed line-clamp-2">
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    {notif.senderName && (
                      <span className="text-[9px] font-black text-brand-blue bg-brand-blue/5 px-2 py-0.5 rounded-md">
                        من: {notif.senderName}
                      </span>
                    )}
                    {notif.link ? (
                      notif.link.startsWith('http') ? (
                        <a
                          href={notif.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            markAsRead(notif.id);
                            setIsOpen(false);
                          }}
                          className="inline-flex items-center gap-1.5 text-[10px] font-black text-brand-blue hover:text-brand-blue/80"
                        >
                          انتقال للرابط المرفق <ChevronLeft size={10} />
                        </a>
                      ) : (
                        <Link
                          to={notif.link}
                          onClick={() => {
                            markAsRead(notif.id);
                            setIsOpen(false);
                          }}
                          className="inline-flex items-center gap-1.5 text-[10px] font-black text-brand-blue hover:text-brand-blue/80"
                        >
                          انتقال للمحتوى <ChevronLeft size={10} />
                        </Link>
                      )
                    ) : (
                      <Link
                        to={`/notifications/${notif.id}`}
                        onClick={() => {
                          markAsRead(notif.id);
                          setIsOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 text-[10px] font-black text-brand-blue hover:text-brand-blue/80"
                      >
                        عرض التفاصيل <ChevronLeft size={10} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {!notif.read && (
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10 border border-emerald-500/20"
                    title="تحديد كمقروء"
                  >
                    <Check size={16} />
                  </button>
                )}
                <button
                  onClick={() => deleteNotification(notif.id)}
                  className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10 border border-red-500/20"
                  title="حذف"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-24 text-center space-y-4">
            <div>
              <p className="text-gray-900 dark:text-white font-black">لا توجد تنبيهات</p>
              <p className="text-xs text-gray-500 font-bold mt-1">تأكد من مراجعة الدروس بانتظام</p>
            </div>
          </div>
        )}
      </div>

      {!isDrawer && (
        <button
          onClick={() => setIsOpen(false)}
          className="w-full p-6 text-center text-[10px] font-black text-gray-400 hover:text-brand-blue hover:bg-gray-50 dark:hover:bg-white/2 transition-all border-t border-gray-100 dark:border-white/5 uppercase tracking-[0.2em]"
        >
          إغلاق القائمة
        </button>
      )}
    </div>
  );

  if (isDrawer) {
    return renderContent();
  }

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl transition-all group border-2 ${
          isOpen
            ? 'bg-brand-blue/10 border-brand-blue shadow-lg shadow-brand-blue/20'
            : 'bg-white/5 hover:bg-white/10 border-white/5'
        }`}
      >
        <Bell
          size={22}
          className={`transition-colors ${isOpen ? 'text-brand-blue' : 'text-gray-400 group-hover:text-white'} ${unreadCount > 0 && !isOpen ? 'animate-wiggle' : ''}`}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-600 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-brand-dark shadow-lg">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none"
            />

            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="fixed lg:absolute left-4 right-4 lg:left-0 lg:right-auto top-24 lg:top-auto z-[70] text-right"
              dir="rtl"
            >
              {renderContent()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
