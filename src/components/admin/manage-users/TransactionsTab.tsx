import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { SearchInput } from '../../SearchInput';
import type { Transaction } from './types';

export const TransactionsTab: React.FC = () => {
  const [logs, setLogs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'transactions'));
    const unsub = onSnapshot(q, async (snap) => {
      const items = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          let userName = 'غير معروف';
          try {
            const uDoc = await getDoc(doc(db, 'users', data.userId));
            if (uDoc.exists())
              userName = uDoc.data().displayName || uDoc.data().email || 'غير معروف';
          } catch {
            // User not found
          }
          return {
            id: d.id,
            ...data,
            userName,
            teacherShare: data.teacherShare ?? 0,
            platformShare: data.platformShare ?? 0,
          } as Transaction;
        })
      );
      items.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      setLogs(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.userName?.toLowerCase().includes(search.toLowerCase()) ||
      l.courseName?.toLowerCase().includes(search.toLowerCase()) ||
      l.codeUsed?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="البحث بالاسم أو الكورس أو الكود..."
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/8">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-white/5 border-b border-white/8 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-5 py-4 text-right">المستخدم</th>
                <th className="px-5 py-4 text-right">العملية</th>
                <th className="px-5 py-4 text-right">المبلغ</th>
                <th className="px-5 py-4 text-right">نصيب المدرس</th>
                <th className="px-5 py-4 text-right">نصيب المنصة</th>
                <th className="px-5 py-4 text-right">التفاصيل</th>
                <th className="px-5 py-4 text-right">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-5 py-4 font-bold text-white text-sm">{log.userName}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border ${log.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}
                    >
                      {log.type === 'deposit' ? 'شحن' : 'شراء'}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-black text-white">{log.amount} ج</td>
                  <td className="px-5 py-4 text-emerald-400 font-bold text-xs">
                    {log.type === 'purchase' ? `${log.teacherShare ?? 0} ج` : '—'}
                  </td>
                  <td className="px-5 py-4 text-brand-blue font-bold text-xs">
                    {log.type === 'purchase' ? `${log.platformShare ?? 0} ج` : '—'}
                  </td>
                  <td className="px-5 py-4 text-slate-400 text-xs">
                    {log.type === 'deposit' ? log.codeUsed : log.courseName}
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-[10px]">
                    {log.date?.seconds
                      ? new Date(log.date.seconds * 1000).toLocaleString('ar-EG')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
