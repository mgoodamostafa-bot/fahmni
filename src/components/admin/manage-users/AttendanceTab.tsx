import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { CheckSquare, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  groupId?: string;
  timestamp?: { seconds: number };
  dateString: string;
}

interface Group {
  id: string;
  name: string;
}

export const AttendanceTab: React.FC = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'attendance'), where('dateString', '==', today));
    const unsub = onSnapshot(q, (snap) => {
      setRecentAttendance(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord)
          .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
      );
    });

    const unsubGroups = onSnapshot(collection(db, 'groups'), (snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Group));
    });

    return () => {
      unsub();
      unsubGroups();
    };
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      const q = query(collection(db, 'users'), where('studentId', '==', code.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('كود الطالب غير صحيح');

      const studentDoc = snap.docs[0];
      const studentData = studentDoc.data();
      const userId = studentDoc.id;
      const today = new Date().toISOString().split('T')[0];

      const attQ = query(
        collection(db, 'attendance'),
        where('studentId', '==', userId),
        where('dateString', '==', today)
      );
      const attSnap = await getDocs(attQ);
      if (!attSnap.empty) throw new Error('تم تسجيل حضور هذا الطالب بالفعل اليوم');

      await addDoc(collection(db, 'attendance'), {
        studentId: userId,
        studentCode: code.trim().toUpperCase(),
        studentName: studentData.displayName || studentData.email,
        groupId: selectedGroupId || studentData.groupId || 'none',
        timestamp: serverTimestamp(),
        dateString: today,
      });

      setMsg({ type: 'success', text: `تم تسجيل حضور ${studentData.displayName} بنجاح` });
      setCode('');
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'خطأ غير معروف' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/10 transition-all" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 bg-emerald-500/15 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckSquare size={32} />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">تسجيل حضور الطلاب</h2>
          <p className="text-slate-400 text-sm mb-8">
            أدخل كود الطالب لتسجيل حضوره في قاعدة البيانات لتاريخ اليوم
          </p>
          <div className="mb-6 max-w-sm mx-auto">
            <label className="block text-xs font-black text-gray-500 mb-2">
              اختر المجموعة (اختياري)
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-white text-sm outline-none focus:border-brand-blue"
            >
              <option value="">جميع المجموعات / عام</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleRegister} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="أدخل كود الطالب (STU-2026-XXXX)"
              className="flex-1 bg-white/5 border border-white/15 rounded-2xl px-6 py-4 text-white font-black text-center focus:outline-none focus:border-emerald-500 transition-all uppercase tracking-widest"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'تسجيل حضور'
              )}
            </button>
          </form>

          <AnimatePresence>
            {msg && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`mt-6 p-4 rounded-xl border text-sm font-bold ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
              >
                {msg.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-black text-white flex items-center gap-2">
          <Clock size={20} className="text-slate-400" />
          حضور اليوم ({recentAttendance.length})
          {selectedGroupId && (
            <span className="text-xs bg-brand-blue/10 text-brand-blue px-2 py-1 rounded-lg">
              مجموعة: {groups.find((g) => g.id === selectedGroupId)?.name}
            </span>
          )}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {recentAttendance.map((att) => (
            <div
              key={att.id}
              className="bg-[#0a1220] border border-white/8 p-4 rounded-2xl flex items-center gap-3 hover:border-emerald-500/30 transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center text-xs font-black text-white uppercase">
                {att.studentName.charAt(0)}
              </div>
              <div>
                <p className="text-white font-bold text-sm line-clamp-1">{att.studentName}</p>
                <p className="text-emerald-400 text-[10px] font-black">{att.studentCode}</p>
              </div>
            </div>
          ))}
          {recentAttendance.length === 0 && (
            <p className="col-span-full py-16 text-center text-slate-500 border border-dashed border-white/10 rounded-[2rem]">
              لا يوجد حضور مسجل اليوم حتى الآن
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
