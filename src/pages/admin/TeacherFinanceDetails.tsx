import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  ChevronLeft,
  Users,
  Percent,
  DollarSign,
  Check,
  ArrowLeft,
  AlertCircle,
  Loader2,
  BookOpen,
  CreditCard,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const TeacherFinanceDetails: React.FC = () => {
  const { teacherId } = useParams<{ teacherId: string }>();
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfit, setEditingProfit] = useState<any>(null);
  const [newCommission, setNewCommission] = useState<number>(0);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!teacherId) return;
      try {
        // Fetch teacher info
        const tDoc = await getDoc(doc(db, 'users', teacherId));
        if (tDoc.exists()) {
          setTeacher({ id: tDoc.id, ...tDoc.data() });
        }

        // Fetch courses for this teacher
        const q = query(collection(db, 'Courses'), where('teacherId', '==', teacherId));
        const snap = await getDocs(q);
        setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teacherId]);

  const handleUpdateCommission = async () => {
    if (!editingProfit || !teacherId) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'Courses', editingProfit.id), {
        commissionPercentage: newCommission,
      });
      setCourses((prev) =>
        prev.map((c) =>
          c.id === editingProfit.id ? { ...c, commissionPercentage: newCommission } : c
        )
      );
      setEditingProfit(null);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء التحديث');
    } finally {
      setUpdating(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-950 p-6 md:p-12 text-right" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {teacher?.photoURL ? (
              <img
                src={teacher.photoURL}
                className="w-20 h-20 rounded-[2rem] object-cover border border-brand-blue/20 shadow-2xl shadow-brand-blue/20"
                alt=""
              />
            ) : (
              <div className="w-20 h-20 bg-brand-blue/10 rounded-[2rem] flex items-center justify-center text-brand-blue border border-brand-blue/20">
                <Users size={40} />
              </div>
            )}
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">
                {teacher?.displayName || 'المدرس'}
              </h1>
              <p className="text-slate-500 font-bold mt-1">إدارة العمولات والأرباح لهذا المدرس</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/teacher/finance')}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-6 py-4 rounded-2xl text-white font-black border border-white/10 transition-all"
          >
            <ChevronLeft size={20} /> رجوع للتقارير
          </button>
        </div>

        {/* 📊 Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                <BookOpen size={16} />
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                إجمالي الكورسات
              </span>
            </div>
            <p className="text-2xl font-black text-white">{courses.length}</p>
          </div>

          <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                <CreditCard size={16} />
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                إجمالي مبيعات المدرس
              </span>
            </div>
            <p className="text-2xl font-black text-white">
              {courses.reduce((acc, c) => acc + (c.price || 0), 0).toLocaleString('ar-EG')}{' '}
              <span className="text-xs">ج.م</span>
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-brand-blue/10 text-brand-blue rounded-lg">
                <Percent size={16} />
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                متوسط النسبة
              </span>
            </div>
            <p className="text-2xl font-black text-white">
              {Math.round(
                courses.reduce((acc, c) => acc + (c.commissionPercentage || 100), 0) /
                  (courses.length || 1)
              )}
              %
            </p>
          </div>

          <div className="bg-brand-blue/10 border border-brand-blue/20 p-6 rounded-[2rem] relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-brand-blue/20 text-brand-blue rounded-lg">
                <DollarSign size={16} />
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                صافي الاستحقاق
              </span>
            </div>
            <p className="text-2xl font-black text-white">
              {courses
                .reduce((acc, c) => acc + (c.price * (c.commissionPercentage || 100)) / 100, 0)
                .toLocaleString('ar-EG')}{' '}
              <span className="text-xs">ج.م</span>
            </p>
          </div>
        </div>

        {/* Courses Table */}
        <div className="bg-[#0f172a] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-white/5 bg-white/3 flex items-center justify-between">
            <h3 className="text-xl font-black text-white flex items-center gap-3">
              <BookOpen className="text-brand-blue" /> الكورسات المنشورة ({courses.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                  <th className="px-8 py-6">الكورس</th>
                  <th className="px-8 py-6 text-center">السعر</th>
                  <th className="px-8 py-6 text-center">النسبة (%)</th>
                  <th className="px-8 py-6 text-center">ربح المدرس (EGP)</th>
                  <th className="px-8 py-6 text-center">صافي المنصة (EGP)</th>
                  <th className="px-8 py-6 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {courses.map((course) => {
                  const teacherShare = (course.price * (course.commissionPercentage || 100)) / 100;
                  const platformShare = course.price - teacherShare;
                  return (
                    <tr key={course.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <img
                            src={course.imageUrl || course.thumbnailUrl}
                            className="w-14 h-10 object-cover rounded-lg"
                            alt=""
                          />
                          <span className="text-white font-black text-sm">{course.title}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center text-sm text-white font-mono">
                        {course.price} ج
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="px-3 py-1 bg-brand-blue/10 text-brand-blue rounded-lg font-black text-xs border border-brand-blue/20">
                          {course.commissionPercentage ?? 100}%
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center text-emerald-400 font-black text-sm">
                        {teacherShare} ج
                      </td>
                      <td className="px-8 py-5 text-center text-blue-400 font-black text-sm">
                        {platformShare} ج
                      </td>
                      <td className="px-8 py-5 text-center">
                        <button
                          onClick={() => {
                            setEditingProfit(course);
                            setNewCommission(course.commissionPercentage ?? 100);
                          }}
                          className="p-2 bg-white/5 hover:bg-brand-blue hover:text-white rounded-xl text-slate-400 transition-all border border-white/5"
                        >
                          <Percent size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Individual Profit Modal */}
        <AnimatePresence>
          {editingProfit && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card p-12 max-w-sm w-full shadow-2xl border border-white/10"
              >
                <div className="w-20 h-20 bg-brand-blue/20 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-blue">
                  <Percent size={40} />
                </div>
                <h3 className="text-2xl font-black text-white mb-4">تعديل نسبة الربح</h3>
                <p className="text-slate-400 font-bold mb-8 text-sm">
                  حدد نسبة المدرس من مبيعات كورس:
                  <br />
                  <span className="text-brand-blue">{editingProfit.title}</span>
                </p>

                <div className="space-y-8">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newCommission}
                      onChange={(e) => setNewCommission(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/15 rounded-[2rem] py-6 text-center text-5xl font-black text-white outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/20 transition-all font-mono"
                    />
                    <span className="absolute left-8 top-1/2 -translate-y-1/2 text-brand-blue text-2xl font-black">
                      %
                    </span>
                  </div>

                  {/* LIVE BREAKDOWN */}
                  <div className="bg-white/5 rounded-2xl p-4 space-y-2 text-right">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-emerald-400">
                        {(editingProfit.price * newCommission) / 100} ج
                      </span>
                      <span className="text-slate-500">منصيب المدرس:</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-blue-400">
                        {editingProfit.price - (editingProfit.price * newCommission) / 100} ج
                      </span>
                      <span className="text-slate-500">صافي المنصة:</span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={handleUpdateCommission}
                      disabled={updating}
                      className="flex-1 py-4 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-2xl font-black shadow-xl shadow-brand-blue/20 transition-all disabled:opacity-50"
                    >
                      {updating ? 'جاري الحفظ...' : 'حفظ التعديل'}
                    </button>
                    <button
                      onClick={() => setEditingProfit(null)}
                      className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black border border-white/10 transition-all"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
