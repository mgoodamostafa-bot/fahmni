import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  User,
  Users,
  Save,
  X,
  Search,
  Trophy,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OfflineResult {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  groupId: string;
  groupName: string;
  examTitle: string;
  score: number;
  maxScore: number;
  date: string;
  createdAt: any;
}

export const OfflineResults: React.FC = () => {
  const [results, setResults] = useState<OfflineResult[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [studentInfo, setStudentInfo] = useState<any>(null);

  const [formData, setFormData] = useState({
    groupId: '',
    examTitle: '',
    score: 0,
    maxScore: 100,
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    // Fetch Groups
    onSnapshot(collection(db, 'groups'), (snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // Fetch Results
    onSnapshot(collection(db, 'offline_results'), (snap) => {
      setResults(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as OfflineResult)
          .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)
      );
      setLoading(false);
    });
  }, []);

  const lookupStudent = async () => {
    if (!searchCode.trim()) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('studentId', '==', searchCode.trim().toUpperCase())
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        alert('الطالب غير موجود');
        setStudentInfo(null);
      } else {
        setStudentInfo({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (e) {
      alert('خطأ في البحث');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInfo) return;
    setLoading(true);
    try {
      const groupName = groups.find((g) => g.id === formData.groupId)?.name || 'غير محدد';
      await addDoc(collection(db, 'offline_results'), {
        ...formData,
        studentId: studentInfo.id,
        studentName: studentInfo.displayName,
        studentCode: studentInfo.studentId,
        groupName,
        createdAt: serverTimestamp(),
      });
      setFormData({ ...formData, score: 0, examTitle: '' });
      setIsAdding(false);
      setStudentInfo(null);
      setSearchCode('');
    } catch (e) {
      alert('خطأ في حفظ النتيجة');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('حذف هذه النتيجة؟')) return;
    await deleteDoc(doc(db, 'offline_results', id));
  };

  if (loading && results.length === 0)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
      </div>
    );

  return (
    <div className="space-y-8 pb-20 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center shadow-2xl border border-emerald-500/10">
            <Trophy size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white mb-2 font-display">
              نتائج الامتحانات الورقية
            </h1>
            <p className="text-gray-400 font-bold text-sm">
              تسجيل درجات الطلاب في امتحانات السنتر الفعلية
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-emerald-500/30 transition-all flex items-center gap-3"
        >
          <Plus size={20} /> إضافة نتيجة جديدة
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="lg:col-span-1"
            >
              <div className="glass-card p-8 border border-emerald-500/30 bg-emerald-500/5 sticky top-28">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-white">تسجيل درجة</h3>
                  <button
                    onClick={() => setIsAdding(false)}
                    className="text-gray-500 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                {!studentInfo ? (
                  <div className="space-y-4">
                    <label className="block text-sm font-black text-gray-400 mr-2">
                      ابحث بكود الطالب
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        className="flex-1 bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none uppercase"
                        placeholder="STU-2026-..."
                      />
                      <button
                        onClick={lookupStudent}
                        className="bg-brand-blue text-white px-6 rounded-2xl font-black"
                      >
                        <Search size={20} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 mb-4">
                      <p className="text-emerald-400 text-[10px] font-black uppercase">
                        الطالب المحدد
                      </p>
                      <p className="text-white font-black">{studentInfo.displayName}</p>
                      <p className="text-gray-400 text-xs">{studentInfo.studentId}</p>
                      <button
                        onClick={() => setStudentInfo(null)}
                        className="text-xs text-red-400 mt-2 underline"
                      >
                        تغيير الطالب
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-black text-gray-400 mr-2">
                        المجموعة
                      </label>
                      <select
                        required
                        value={formData.groupId}
                        onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none appearance-none font-sans"
                      >
                        <option value="">اختر المجموعة...</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-black text-gray-400 mr-2">
                        عنوان الامتحان
                      </label>
                      <input
                        required
                        type="text"
                        value={formData.examTitle}
                        onChange={(e) => setFormData({ ...formData, examTitle: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none"
                        placeholder="مثلاً: شهر أكتوبر"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-black text-gray-400 mr-2">
                          الدرجة
                        </label>
                        <input
                          required
                          type="number"
                          value={formData.score}
                          onChange={(e) =>
                            setFormData({ ...formData, score: parseFloat(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-black text-gray-400 mr-2">
                          الدرجة النهائية
                        </label>
                        <input
                          required
                          type="number"
                          value={formData.maxScore}
                          onChange={(e) =>
                            setFormData({ ...formData, maxScore: parseFloat(e.target.value) })
                          }
                          className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-xl transition-all flex items-center justify-center gap-3"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                      حفظ النتيجة
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={isAdding ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className="glass-card overflow-hidden border border-white/10">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-white/5 border-b border-white/10 text-gray-400 text-xs font-black uppercase tracking-widest">
                  <th className="p-6">الطالب</th>
                  <th className="p-6">المجموعة / الامتحان</th>
                  <th className="p-6">الدرجة</th>
                  <th className="p-6">نسبة المئوية</th>
                  <th className="p-6 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {results.map((res) => {
                  const percentage = (res.score / res.maxScore) * 100;
                  return (
                    <tr key={res.id} className="hover:bg-white/3 transition-colors group">
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center text-brand-blue font-black uppercase">
                            {res.studentName?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-white font-black text-sm">{res.studentName}</p>
                            <p className="text-gray-500 text-[10px] font-bold">{res.studentCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <p className="text-white font-bold text-sm">{res.examTitle}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-black">
                          <Users size={12} className="text-brand-yellow" />
                          {res.groupName}
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="text-lg font-black text-white">{res.score}</span>
                        <span className="text-gray-500 font-bold"> / {res.maxScore}</span>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-full border-4 flex items-center justify-center text-[10px] font-black ${percentage >= 50 ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'}`}
                          >
                            {Math.round(percentage)}%
                          </div>
                        </div>
                      </td>
                      <td className="p-6 text-left">
                        <button
                          onClick={() => handleDelete(res.id)}
                          className="p-3 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-20 text-center text-gray-600 font-bold">
                      لا توجد نتائج مسجلة حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
