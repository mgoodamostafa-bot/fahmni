import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNotifications } from '../contexts/NotificationContext';
import { motion } from 'framer-motion';
import {
  Bell,
  ArrowRight,
  Clock,
  User,
  ChevronLeft,
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Trash2,
} from 'lucide-react';

export const NotificationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { markAsRead, deleteNotification } = useNotifications();
  const [notification, setNotification] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotification = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'notifications', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setNotification(data);
          // Mark as read when opened
          if (!(data as any).read) {
            await updateDoc(docRef, { read: true });
            markAsRead(id);
          }
        } else {
          console.error('No such notification!');
          navigate('/');
        }
      } catch (error) {
        console.error('Error fetching notification:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotification();
  }, [id, navigate, markAsRead]);

  const handleDelete = async () => {
    if (id) {
      await deleteNotification(id);
      navigate(-1);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="text-emerald-500" size={32} />;
      case 'warning':
        return <AlertTriangle className="text-accent-gold" size={32} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={32} />;
      default:
        return <Bell className="text-brand-blue" size={32} />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center space-y-4 animate-pulse">
        <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-3xl mx-auto" />
        <div className="h-8 bg-gray-100 dark:bg-white/5 w-1/2 mx-auto rounded-xl" />
        <div className="h-32 bg-gray-100 dark:bg-white/5 w-full rounded-3xl" />
      </div>
    );
  }

  if (!notification) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-8 pb-20 text-right"
      dir="rtl"
    >
      {/* Header / Back */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center gap-2 text-gray-500 hover:text-brand-blue transition-colors font-bold text-sm"
        >
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          رجوع
        </button>
        <button
          onClick={handleDelete}
          className="p-3 bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all border border-red-500/10"
          title="حذف التنبيه"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="bg-white dark:bg-space-900 rounded-[3rem] border border-gray-100 dark:border-white/5 shadow-2xl overflow-hidden">
        {/* Detail Header */}
        <div className="p-8 sm:p-12 border-b border-gray-50 dark:border-white/5 bg-gray-50/50 dark:bg-white/2">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="w-20 h-20 bg-white dark:bg-space-800 rounded-[2rem] flex items-center justify-center shadow-xl border border-gray-100 dark:border-white/10 shrink-0">
              {getIcon(notification.type)}
            </div>
            <div className="space-y-3 text-center sm:text-right">
              <div className="flex flex-wrap justify-center sm:justify-start gap-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <Clock size={12} />
                  {notification.createdAt?.toDate
                    ? notification.createdAt
                        .toDate()
                        .toLocaleDateString('ar-EG', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                    : 'الآن'}
                </div>
                {notification.senderName && (
                  <div className="flex items-center gap-2 text-[10px] font-black text-brand-blue bg-brand-blue/5 px-3 py-1 rounded-lg uppercase tracking-widest">
                    <User size={12} />
                    من: {notification.senderName}
                  </div>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white leading-tight">
                {notification.title}
              </h1>
            </div>
          </div>
        </div>

        {/* Message Body */}
        <div className="p-8 sm:p-12 space-y-8">
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-gray-700 dark:text-gray-300 font-bold leading-relaxed text-lg whitespace-pre-wrap">
              {notification.message}
            </p>
          </div>

          {notification.link && (
            <Link
              to={notification.link}
              className="inline-flex items-center gap-3 px-8 py-4 bg-brand-blue text-white rounded-[1.5rem] font-black shadow-xl shadow-brand-blue/20 hover:scale-105 active:scale-95 transition-all text-sm"
            >
              الانتقال للرابط <ChevronLeft size={18} />
            </Link>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center">
        <p className="text-xs text-gray-500 font-bold">
          هذا التنبيه تم إرساله إليك بشكل شخصي أو كجزء من اشتراكك في الكورسات.
        </p>
      </div>
    </motion.div>
  );
};
