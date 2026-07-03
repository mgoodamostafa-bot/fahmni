import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  ClipboardList,
  Edit3,
  Trash2,
  Clock,
  BookOpen,
  Star,
  Save,
  X,
  PlusCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeacherExams: React.FC = () => {
  const { profile, user } = useAuth();
  const { sendNotification } = useNotifications();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingExam, setEditingExam] = useState<any | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [filterGrade, setFilterGrade] = useState('all');

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(collection(db, 'exams'), where('teacherId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setExams(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile?.uid]);

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الامتحان نهائياً؟')) {
      await deleteDoc(doc(db, 'exams', id));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam) return;
    setSaveLoading(true);
    try {
      await updateDoc(doc(db, 'exams', editingExam.id), {
        title: editingExam.title,
        duration: editingExam.duration,
        grade: editingExam.grade,
        questions: editingExam.questions,
        isActive: editingExam.isActive ?? true,
        allowRetake: editingExam.allowRetake ?? false,
        retakeDelay: editingExam.retakeDelay ?? 0,
      });
      setEditingExam(null);
    } catch (err) {
      console.error(err);
      alert('خطأ أثناء الحفظ');
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) return <div className="p-20 text-center text-white">جاري التحميل...</div>;

  return (
    <div className="space-y-8 pb-20" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">
            سجل <span className="text-emerald-500">الامتحانات</span>
          </h1>
          <p className="text-gray-400 font-bold mt-2">إدارة جميع الامتحانات التي قمت بإنشائها</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 font-bold focus:outline-none focus:border-emerald-500"
          >
            <option value="all">كل الصفوف</option>
            {Array.from(new Set(exams.map((e) => e.grade))).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <Link
            to="/teacher/add-exam"
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
          >
            <PlusCircle size={20} />
            <span>امتحان جديد</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams
          .filter((e) => filterGrade === 'all' || e.grade === filterGrade)
          .map((exam) => (
            <div
              key={exam.id}
              className={`bg-white/5 border rounded-[2rem] p-8 relative group overflow-hidden transition-all ${exam.isActive ? 'border-white/10' : 'border-red-500/20 opacity-60'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-black text-white">{exam.title}</h3>
                <div
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${exam.isActive ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}
                >
                  {exam.isActive ? 'نشط' : 'متوقف'}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mb-8">
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                  <BookOpen size={14} className="text-emerald-500" />
                  <span className="text-xs font-bold text-gray-300">{exam.subject}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                  <Star size={14} className="text-emerald-500" />
                  <span className="text-xs font-bold text-gray-300">{exam.grade}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                  <Clock size={14} className="text-emerald-500" />
                  <span className="text-xs font-bold text-gray-300">{exam.duration} دقيقة</span>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <button
                  onClick={async () => {
                    const newActiveState = !exam.isActive;
                    await updateDoc(doc(db, 'exams', exam.id), { isActive: newActiveState });
                    if (newActiveState) {
                      await sendNotification({
                        title: 'اختبار متاح الآن!',
                        message: `تم رفع وتفعيل اختبار "${exam.title}" في مادة ${exam.subject}. بادر باجتيازه!`,
                        type: 'info',
                        targetGroupId: exam.courseId || 'all',
                        targetGrade: exam.grade,
                        targetRole: 'student',
                        link: '/revisions',
                        senderName: profile?.displayName || 'مدرس المادة',
                      });
                    }
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    exam.isActive
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  <span className="text-sm font-black">ظهور الامتحان للطلبة</span>
                  <div
                    className={`w-10 h-6 rounded-full relative transition-colors ${exam.isActive ? 'bg-emerald-500' : 'bg-gray-700'}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${exam.isActive ? 'right-5' : 'right-1'}`}
                    />
                  </div>
                </button>

                <button
                  onClick={async () => {
                    await updateDoc(doc(db, 'exams', exam.id), { allowRetake: !exam.allowRetake });
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    exam.allowRetake
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  <span className="text-sm font-black">السماح بالإعادة للطلبة</span>
                  <div
                    className={`w-10 h-6 rounded-full relative transition-colors ${exam.allowRetake ? 'bg-blue-500' : 'bg-gray-700'}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${exam.allowRetake ? 'right-5' : 'right-1'}`}
                    />
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-2 pt-6 border-t border-white/5">
                <button
                  onClick={() => setEditingExam({ ...exam })}
                  className="flex-1 py-3 bg-white text-gray-900 hover:bg-emerald-50 rounded-xl font-black flex justify-center items-center gap-2 transition-all"
                >
                  <Edit3 size={16} /> تعديل الأسئلة
                </button>
                <button
                  onClick={() => handleDelete(exam.id)}
                  className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        {exams.length === 0 && (
          <div className="col-span-full py-20 text-center text-gray-500 font-bold">
            لا توجد امتحانات مسجلة. قم بإضافة امتحانك الأول!
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingExam && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#0a0f1c] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-white">تعديل الامتحان</h2>
                <button
                  onClick={() => setEditingExam(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdate} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">
                    عنوان الامتحان
                  </label>
                  <input
                    type="text"
                    value={editingExam.title}
                    onChange={(e) => setEditingExam({ ...editingExam, title: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-2">
                      المدة (دقائق)
                    </label>
                    <input
                      type="number"
                      value={editingExam.duration}
                      onChange={(e) =>
                        setEditingExam({ ...editingExam, duration: Number(e.target.value) })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-2">الصف</label>
                    <input
                      type="text"
                      value={editingExam.grade}
                      onChange={(e) => setEditingExam({ ...editingExam, grade: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-2">
                      تاريخ وقت الفتح (اختياري)
                    </label>
                    <input
                      type="datetime-local"
                      value={editingExam.opensAt || ''}
                      onChange={(e) => setEditingExam({ ...editingExam, opensAt: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                    <input
                      type="checkbox"
                      checked={editingExam.allowRetake}
                      onChange={(e) =>
                        setEditingExam({ ...editingExam, allowRetake: e.target.checked })
                      }
                      className="w-5 h-5"
                    />
                    <label className="text-white font-bold">السماح بالإعادة</label>
                  </div>
                  {editingExam.allowRetake && (
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-2">
                        ساعات الانتظار للإعادة
                      </label>
                      <input
                        type="number"
                        value={editingExam.retakeDelay}
                        onChange={(e) =>
                          setEditingExam({ ...editingExam, retakeDelay: Number(e.target.value) })
                        }
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-black text-white">
                    الأسئلة ({editingExam.questions?.length})
                  </h3>
                  {editingExam.questions?.map((q: any, index: number) => (
                    <div
                      key={index}
                      className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 relative group"
                    >
                      <input
                        type="text"
                        value={q.questionText}
                        onChange={(e) => {
                          const newQ = [...editingExam.questions];
                          newQ[index].questionText = e.target.value;
                          setEditingExam({ ...editingExam, questions: newQ });
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-bold"
                        placeholder="السؤال..."
                      />

                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt: string, oi: number) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={q.correctOptionIndex === oi}
                              onChange={() => {
                                const newQ = [...editingExam.questions];
                                newQ[index].correctOptionIndex = oi;
                                setEditingExam({ ...editingExam, questions: newQ });
                              }}
                              className="w-4 h-4"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newQ = [...editingExam.questions];
                                newQ[index].options[oi] = e.target.value;
                                setEditingExam({ ...editingExam, questions: newQ });
                              }}
                              className="w-full bg-transparent border-b border-white/10 text-sm text-gray-300 focus:border-emerald-500 font-bold"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 pt-4 border-t border-white/10">
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-black text-lg hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2"
                  >
                    {saveLoading ? (
                      'جاري الحفظ...'
                    ) : (
                      <>
                        <Save size={20} /> حفظ التعديلات
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
