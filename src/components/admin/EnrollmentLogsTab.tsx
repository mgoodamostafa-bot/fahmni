import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Search, BookOpen, Clock, User, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Transaction {
  id: string;
  type: 'purchase';
  amount: number;
  date: any;
  courseName?: string;
  courseId?: string;
  userId: string;
  userName?: string;
}

export const EnrollmentLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('type', '==', 'purchase'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const logsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Transaction);
      setLogs(logsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const queryStr = searchQuery.toLowerCase();
    return (
      (log.courseName && log.courseName.toLowerCase().includes(queryStr)) ||
      (log.userId && log.userId.toLowerCase().includes(queryStr)) ||
      (log.userName && log.userName.toLowerCase().includes(queryStr))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/5 border border-white/10 p-6 rounded-[2rem]">
        <div>
          <h2 className="text-2xl font-black text-brand-blue flex items-center gap-3">
            <CreditCard size={28} />
            سجل الاشتراكات والكورسات
          </h2>
          <p className="text-gray-400 text-sm font-bold mt-1">
            تتبع كافة مبيعات المنصة واشتراكات الطلاب بالكورسات
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="ابحث باسم الكورس أو الطالب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-2xl py-3 pr-12 pl-4 text-white focus:outline-none focus:border-brand-blue transition-colors"
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden border-brand-blue/20">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={48} className="mx-auto text-gray-600 mb-4 opacity-30" />
            <p className="text-gray-400 font-bold">لا يوجد سجلات مطابقة للبحث.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-brand-blue/5 border-b border-brand-blue/10 text-blue-300 text-sm">
                  <th className="p-5 font-bold">الطالب</th>
                  <th className="p-5 font-bold">الكورس التعليمي</th>
                  <th className="p-5 font-bold text-center">سعر الشراء</th>
                  <th className="p-5 font-bold text-left">تاريخ العملية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence>
                  {filteredLogs.map((log) => (
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={log.id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center text-brand-blue shrink-0">
                            <User size={18} />
                          </div>
                          <div>
                            <p className="text-white font-bold">{log.userName || 'طالب مسجل'}</p>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                              ID: {log.userId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="bg-brand-blue/10 text-brand-blue border border-brand-blue/20 px-3 py-1.5 rounded-lg text-sm font-bold tracking-widest flex items-center gap-2 w-fit">
                          <BookOpen size={14} />
                          {log.courseName || 'كورس غير مسمّى'}
                        </span>
                      </td>
                      <td className="p-5 text-center">
                        <span className="text-lg font-black text-rose-400">
                          {log.amount} <span className="text-xs">ج.م</span>
                        </span>
                      </td>
                      <td className="p-5 text-left">
                        <div className="flex justify-end items-center gap-2 text-gray-400 text-xs font-bold">
                          <Clock size={14} />
                          {log.date?.toDate
                            ? log.date.toDate().toLocaleString('ar-EG')
                            : 'غير متوفر'}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
