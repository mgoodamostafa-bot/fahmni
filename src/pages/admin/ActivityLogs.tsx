import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  Activity,
  Clock,
  CreditCard,
  ArrowUpCircle,
  Wallet,
  User,
  Hash,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Transaction {
  id: string;
  type: 'deposit' | 'purchase';
  amount: number;
  date: any;
  courseName?: string;
  codeUsed?: string;
  userId: string;
  userName?: string;
}

export const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Transaction);
      setLogs(logsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Wallet className="text-brand-yellow" size={32} />
            سجل العمليات المالية
          </h1>
          <p className="text-slate-400">مراقبة جميع عمليات الشحن وشراء الكورسات</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-12 h-12 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">لا توجد حركات مالية مسجلة بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-sm">
                  <th className="p-6 font-medium">العملية</th>
                  <th className="p-6 font-medium">الطالب</th>
                  <th className="p-6 font-medium">التفاصيل</th>
                  <th className="p-6 font-medium text-left">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence>
                  {logs.map((log) => (
                    <motion.tr
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      key={log.id}
                      className="hover:bg-white/5 group transition-colors"
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              log.type === 'deposit'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-brand-blue/10 text-brand-blue'
                            }`}
                          >
                            {log.type === 'deposit' ? (
                              <ArrowUpCircle size={20} />
                            ) : (
                              <CreditCard size={20} />
                            )}
                          </div>
                          <div>
                            <div
                              className={`font-bold text-lg ${
                                log.type === 'deposit' ? 'text-emerald-400' : 'text-blue-400'
                              }`}
                            >
                              {log.type === 'deposit' ? '+' : '-'}
                              {Math.abs(log.amount)} ج.م
                            </div>
                            <div className="text-xs text-slate-400">
                              {log.type === 'deposit' ? 'شحن رصيد' : 'شراء كورس'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-slate-500" />
                          <span className="text-white font-bold">{log.userName || log.userId}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        {log.type === 'purchase' && log.courseName ? (
                          <div className="flex items-center gap-2 text-brand-blue text-sm font-bold bg-brand-blue/10 px-3 py-1.5 rounded-lg w-fit">
                            <BookOpen size={14} />
                            {log.courseName}
                          </div>
                        ) : log.type === 'deposit' && log.codeUsed ? (
                          <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold bg-emerald-500/10 px-3 py-1.5 rounded-lg w-fit">
                            <Hash size={14} />
                            {log.codeUsed}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="p-6 text-left">
                        <div className="flex items-center justify-end gap-2 text-slate-400 text-sm">
                          <Clock size={14} />
                          {log.date?.toDate ? log.date.toDate().toLocaleString('ar-EG') : 'الآن'}
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
