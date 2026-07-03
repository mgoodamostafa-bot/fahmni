import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  CreditCard,
  Hash,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Transaction {
  id: string;
  type: 'deposit' | 'purchase';
  amount: number;
  date: any;
  courseName?: string;
  codeUsed?: string;
}

export const TransactionHistory: React.FC<{ userId: string }> = ({ userId }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let txsLower: Transaction[] = [];
    let txsUpper: Transaction[] = [];

    const handleUpdate = () => {
      const combined = [...txsLower, ...txsUpper]
        .sort((a, b) => {
          const dateA = a.date?.toDate?.()?.getTime() || (a.date ? new Date(a.date).getTime() : 0);
          const dateB = b.date?.toDate?.()?.getTime() || (b.date ? new Date(b.date).getTime() : 0);
          return dateB - dateA;
        })
        .slice(0, 30);
      setTransactions(combined);
      setLoading(false);
    };

    // Note: Removed orderBy to bypass Firestore Index requirement
    const qLower = query(collection(db, 'transactions'), where('userId', '==', userId), limit(50));
    const qUpper = query(collection(db, 'Transactions'), where('userId', '==', userId), limit(50));

    const unsubLower = onSnapshot(
      qLower,
      (snap) => {
        txsLower = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Transaction[];
        handleUpdate();
      },
      (err) => {
        console.error('Error lower transactions:', err);
        setLoading(false);
      }
    );

    const unsubUpper = onSnapshot(
      qUpper,
      (snap) => {
        txsUpper = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Transaction[];
        handleUpdate();
      },
      (err) => {
        console.error('Error upper transactions:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubLower();
      unsubUpper();
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-gray-500 font-bold">جاري تحميل المعاملات...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-white/5 rounded-2xl border border-dashed border-white/10">
        <AlertCircle className="w-10 h-10 text-gray-600 mx-auto mb-3 opacity-20" />
        <p className="text-xs text-gray-500 font-bold">لا توجد معاملات مسجلة حتى الآن.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      <AnimatePresence mode="popLayout">
        {transactions.map((tx) => (
          <motion.div
            layout
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            key={tx.id}
            className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  tx.type === 'deposit'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-brand-blue/10 text-brand-blue'
                }`}
              >
                {tx.type === 'deposit' ? <ArrowUpCircle size={20} /> : <CreditCard size={20} />}
              </div>
              <div>
                <h4 className="text-sm font-black text-white group-hover:text-brand-blue transition-colors">
                  {tx.type === 'deposit' ? 'شحن رصيد' : 'شراء كورس'}
                </h4>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                    <Clock size={10} />
                    {tx.date?.toDate ? tx.date.toDate().toLocaleDateString('ar-EG') : 'الآن'}
                  </p>
                  {tx.type === 'purchase' && tx.courseName && (
                    <p className="text-[10px] text-brand-blue font-bold flex items-center gap-1 truncate max-w-[120px]">
                      <BookOpen size={10} />
                      {tx.courseName}
                    </p>
                  )}
                  {tx.type === 'deposit' && tx.codeUsed && (
                    <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                      <Hash size={10} />
                      {tx.codeUsed}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="text-left">
              <p
                className={`text-sm font-black ${
                  tx.type === 'deposit' ? 'text-emerald-500' : 'text-blue-400'
                }`}
              >
                {tx.type === 'deposit' ? '+' : '-'}
                {Math.abs(tx.amount)} ج.م
              </p>
              <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">
                {tx.type === 'deposit' ? 'نجاح' : 'تم الخصم'}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
