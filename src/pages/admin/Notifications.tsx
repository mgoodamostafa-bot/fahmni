import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Trash2, Clock, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export const Notifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Notification);
      setNotifications(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const deleteNotification = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return (
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/5">
            <CheckCircle size={24} />
          </div>
        );
      case 'warning':
        return (
          <div className="p-3 bg-accent-gold/10 text-accent-gold rounded-2xl shadow-lg shadow-accent-gold/5">
            <AlertTriangle size={24} />
          </div>
        );
      case 'error':
        return (
          <div className="p-3 bg-red-500/10 text-red-500 rounded-2xl shadow-lg shadow-red-500/5">
            <AlertCircle size={24} />
          </div>
        );
      default:
        return (
          <div className="p-3 bg-brand-600/10 text-brand-600 rounded-2xl shadow-lg shadow-brand-600/5">
            <Bell size={24} />
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-brand-600/10 text-brand-600 rounded-3xl flex items-center justify-center shrink-0 shadow-2xl shadow-brand-600/5 border border-brand-600/10 transition-transform hover:scale-105 duration-500">
            <Bell size={36} />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white leading-none tracking-tight mb-2">
              مركز التنبيهات
            </h1>
            <p className="text-gray-400 text-xs md:text-sm font-bold opacity-80">
              إدارة كافة التدفقات الإعلامية والرسائل الإدارية للنظام
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-6 py-4 bg-white/5 rounded-2xl border border-white/5 shadow-xl">
          <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
            إجمالي الرسائل
          </span>
          <span className="text-xl font-black text-white">{notifications.length}</span>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-6">
        {loading ? (
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-white/5 rounded-[2rem] animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-32 text-center space-y-6 bg-white/5 border-none shadow-3xl"
          >
            <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto border border-white/5 opacity-20">
              <Bell size={48} className="text-gray-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white font-display">صندوق الوارد فارغ</h2>
              <p className="text-gray-500 font-bold max-w-xs mx-auto">
                لا يوجد أية تنبيهات جديدة في الوقت الحالي. استمتع بيومك!
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="grid gap-6">
            {notifications.map((n, idx) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`group relative glass-card p-8 flex items-center justify-between border-r-4 transition-all duration-500 hover:scale-[1.01] hover:bg-white/8 ${
                  n.read
                    ? 'border-gray-800 bg-white/2 opacity-70'
                    : 'border-brand-600 bg-white/5 shadow-2xl shadow-brand-600/5'
                }`}
              >
                <div className="flex items-center gap-6">
                  {getIcon(n.type)}
                  <div className="space-y-1">
                    <div
                      className={`text-lg font-black tracking-tight ${n.read ? 'text-gray-400' : 'text-white'}`}
                    >
                      {n.message}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-black uppercase tracking-widest opacity-60">
                      <Clock size={12} />
                      {new Date(n.createdAt).toLocaleString('ar-EG', {
                        weekday: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-all">
                  {!n.read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="p-4 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-2xl transition-all shadow-xl shadow-emerald-500/10"
                      title="تحديد كمقروء"
                    >
                      <Check size={20} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(n.id)}
                    className="p-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-xl shadow-red-500/10"
                    title="حذف التنبيه"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
