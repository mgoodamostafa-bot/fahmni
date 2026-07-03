import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db, getTenantDb } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileText,
  Loader2,
  Plus,
  Trash2,
  Library,
  BookOpen,
  ExternalLink,
  Link as LinkIcon,
  CheckCircle,
  X,
  Pen,
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { smartGetDocs } from '../../utils/firestore';

export const TeacherPortfolio: React.FC = () => {
  const { profile, user } = useAuth();
  const { sendNotification } = useNotifications();

  const [courses, setCourses] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [subject, setSubject] = useState('');

  // Edit Resource state
  const [editingResource, setEditingResource] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPdfUrl, setEditPdfUrl] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editCourseId, setEditCourseId] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const fetchCourses = async () => {
    if (!user) return;
    try {
      const fetchedCourses = await smartGetDocs('Courses');
      setCourses(fetchedCourses);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchResources = async () => {
    if (!user) return;
    try {
      const [portfolioSnap, lessonsSnap, coursesSnap] = await Promise.all([
        smartGetDocs('PortfolioResources'),
        smartGetDocs('Lessons'),
        smartGetDocs('Courses')
      ]);

      const courseMap = new Map();
      coursesSnap.forEach((c) => courseMap.set(c.id, c));

      const combined = [
        ...portfolioSnap.map(d => ({ 
          ...d, 
          _isLesson: false,
          courseTitle: d.courseTitle || courseMap.get(d.courseId)?.title || 'كورس غير معروف',
          subject: d.subject || courseMap.get(d.courseId)?.subject || 'عام'
        })),
        ...lessonsSnap.filter(d => d.pdfUrl).map(d => ({ 
          ...d, 
          _isLesson: true,
          courseTitle: d.courseTitle || courseMap.get(d.courseId)?.title || 'كورس غير معروف',
          subject: d.subject || courseMap.get(d.courseId)?.subject || 'عام'
        }))
      ];

      combined.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setResources(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchResources();
  }, [user]);

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !courseId || !pdfUrl) {
      sendNotification({ type: 'error', title: 'خطأ', message: 'يرجى ملء جميع الحقول المطلوبة' });
      return;
    }

    const selectedCourse = courses.find((c) => c.id === courseId);
    if (!selectedCourse) return;

    setSaving(true);
    try {
      await addDoc(collection(db, 'PortfolioResources'), {
        title,
        pdfUrl,
        courseId,
        courseTitle: selectedCourse.title,
        subject: subject || selectedCourse.subject || 'عام',
        teacherId: user?.uid,
        createdAt: serverTimestamp(),
      });

      // Notify enrolled students
      await sendNotification({
        title: 'ملف جديد في الحقيبة التعليمية!',
        message: `المدرس أضاف مذكرة جديدة: "${title}" في كورس ${selectedCourse.title}`,
        type: 'info',
        targetGroupId: courseId, // to all enrolled students
        targetRole: 'student',
        link: `/portfolio`,
        senderName: profile?.displayName || 'المدرس',
      });

      setTitle('');
      setPdfUrl('');
      setIsAdding(false);
      fetchResources();
    } catch (err) {
      console.error(err);
      sendNotification({ type: 'error', title: 'خطأ', message: 'حدث خطأ أثناء حفظ الملف' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (res: any) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المذكرة؟')) return;
    try {
      if (res._isLesson) {
        const docRefLower = doc(getTenantDb(), 'lessons', res.id);
        const docRefUpper = doc(getTenantDb(), 'Lessons', res.id);
        await Promise.allSettled([
          updateDoc(docRefLower, { pdfUrl: "" }),
          updateDoc(docRefUpper, { pdfUrl: "" })
        ]);
        sendNotification({ type: 'info', title: 'تم الحذف', message: 'تم إزالة المذكرة من الدرس بنجاح' });
      } else {
        await deleteDoc(doc(getTenantDb(), 'PortfolioResources', res.id));
        sendNotification({ type: 'info', title: 'تم الحذف', message: 'تم حذف المذكرة من الحقيبة' });
      }
      setResources((prev) => prev.filter((r) => r.id !== res.id));
    } catch (err) {
      console.error(err);
      sendNotification({ type: 'error', title: 'خطأ', message: 'حدث خطأ أثناء محاولة حذف المذكرة' });
    }
  };

  const handleStartEdit = (res: any) => {
    setEditingResource(res);
    setEditTitle(res.title);
    setEditPdfUrl(res.pdfUrl);
    setEditSubject(res.subject || '');
    setEditCourseId(res.courseId || '');
  };

  const handleUpdateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResource || !editTitle || !editPdfUrl) {
      sendNotification({ type: 'error', title: 'خطأ', message: 'يرجى ملء الحقول المطلوبة' });
      return;
    }

    setEditSaving(true);
    try {
      if (editingResource._isLesson) {
        const docRefLower = doc(getTenantDb(), 'lessons', editingResource.id);
        const docRefUpper = doc(getTenantDb(), 'Lessons', editingResource.id);
        
        const updatePayload = {
          title: editTitle,
          pdfUrl: editPdfUrl,
          subject: editSubject,
        };

        await Promise.allSettled([
          updateDoc(docRefLower, updatePayload),
          updateDoc(docRefUpper, updatePayload)
        ]);
      } else {
        const docRef = doc(getTenantDb(), 'PortfolioResources', editingResource.id);
        const selectedCourse = courses.find((c) => c.id === editCourseId);
        
        await updateDoc(docRef, {
          title: editTitle,
          pdfUrl: editPdfUrl,
          courseId: editCourseId,
          courseTitle: selectedCourse?.title || editingResource.courseTitle || 'كورس غير معروف',
          subject: editSubject || selectedCourse?.subject || 'عام',
        });
      }

      setResources((prev) =>
        prev.map((r) =>
          r.id === editingResource.id
            ? {
                ...r,
                title: editTitle,
                pdfUrl: editPdfUrl,
                subject: editSubject,
                courseId: editCourseId,
                courseTitle: courses.find((c) => c.id === editCourseId)?.title || r.courseTitle,
              }
            : r
        )
      );

      sendNotification({ type: 'success', title: 'تم التحديث', message: 'تم تحديث تفاصيل المذكرة بنجاح' });
      setEditingResource(null);
    } catch (err) {
      console.error(err);
      sendNotification({ type: 'error', title: 'خطأ', message: 'حدث خطأ أثناء تحديث المذكرة' });
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white font-display tracking-tight flex items-center gap-4">
            <Library className="text-emerald-500" />
            إعدادات <span className="text-emerald-400">الحقيبة التعليمية</span>
          </h1>
          <p className="text-gray-400 font-bold mt-2">قم بإرسال ملازم ومذكرات PDF مباشرة لطلابك</p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black transition-all ${
            isAdding
              ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/20'
          }`}
        >
          {isAdding ? <X size={20} /> : <Plus size={20} />}
          {isAdding ? 'إلغاء' : 'إضافة مذكرة جديدة'}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form
              onSubmit={handleAddResource}
              className="bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 space-y-6"
            >
              <h2 className="text-xl font-black text-white flex items-center gap-2 mb-6">
                <FileText className="text-emerald-400" /> تفاصيل المذكرة
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    الكورس المستهدف *
                  </label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    required
                    className="w-full bg-space-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">اختر الكورس...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    التصنيف أو المادة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="مثال: فيزياء الحديثة"
                    className="w-full bg-space-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  عنوان المذكرة *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="مثال: ملخص قوانين الفصل الأول"
                  className="w-full bg-space-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  رابط ملف PDF *
                </label>
                <div className="relative">
                  <LinkIcon
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                    size={18}
                  />
                  <input
                    type="url"
                    value={pdfUrl}
                    onChange={(e) => setPdfUrl(e.target.value)}
                    required
                    placeholder="https://..."
                    className="w-full bg-space-900 border border-white/10 rounded-xl py-3 pr-12 pl-4 text-white font-bold focus:outline-none focus:border-emerald-500 text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <CheckCircle size={20} />
                )}
                {saving ? 'جاري الإرسال...' : 'إرسال المذكرة للحقيبة'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resources List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {resources.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white/5 border border-white/10 rounded-[2rem] border-dashed">
            <Library className="mx-auto text-gray-600 mb-4" size={48} />
            <h3 className="text-xl font-black text-white mb-2">لا توجد مذكرات مرفوعة</h3>
            <p className="text-gray-500 font-bold">
              لم تقم بإرسال أي مذكرات للحقيبة التعليمية بعد.
            </p>
          </div>
        ) : (
          resources.map((res) => (
            <motion.div
              key={res.id}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 relative group hover:border-emerald-500/30 transition-all shadow-lg"
            >
              <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={() => handleStartEdit(res)}
                  className="p-2 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white rounded-lg transition-colors"
                >
                  <Pen size={16} />
                </button>
                <button
                  onClick={() => handleDelete(res)}
                  className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center mb-4">
                <FileText size={24} />
              </div>

              <h3 className="text-lg font-black text-white mb-1 line-clamp-2">{res.title}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 font-bold">
                <BookOpen size={14} className="text-emerald-500" />
                <span>{res.courseTitle}</span>
              </div>

              <div className="flex items-center justify-between mt-auto">
                <span className="text-[10px] font-black text-gray-500 bg-space-900 px-3 py-1 rounded-lg uppercase tracking-widest">
                  {res.subject}
                </span>
                <a
                  href={res.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 font-bold text-sm flex items-center gap-1"
                >
                  عرض <ExternalLink size={14} />
                </a>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingResource && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f172a] border border-white/10 rounded-[2rem] p-6 md:p-8 w-full max-w-lg shadow-2xl relative"
            >
              <button
                onClick={() => setEditingResource(null)}
                className="absolute top-6 left-6 p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all"
              >
                <X size={20} />
              </button>

              <h2 className="text-xl font-black text-white flex items-center gap-2 mb-6">
                <FileText className="text-brand-blue" /> تعديل تفاصيل المذكرة
              </h2>

              <form onSubmit={handleUpdateResource} className="space-y-6">
                {!editingResource._isLesson && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                      الكورس المستهدف *
                    </label>
                    <select
                      value={editCourseId}
                      onChange={(e) => setEditCourseId(e.target.value)}
                      required
                      className="w-full bg-space-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-brand-blue"
                    >
                      <option value="">اختر الكورس...</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    العنوان أو المادة *
                  </label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    required
                    placeholder="مثال: فيزياء الحديثة"
                    className="w-full bg-space-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-brand-blue"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    عنوان المذكرة *
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    placeholder="مثال: ملخص قوانين الفصل الأول"
                    className="w-full bg-space-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-brand-blue"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    رابط ملف PDF *
                  </label>
                  <div className="relative">
                    <LinkIcon
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                      size={18}
                    />
                    <input
                      type="url"
                      value={editPdfUrl}
                      onChange={(e) => setEditPdfUrl(e.target.value)}
                      required
                      placeholder="https://..."
                      className="w-full bg-space-900 border border-white/10 rounded-xl py-3 pr-12 pl-4 text-white font-bold focus:outline-none focus:border-brand-blue text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingResource(null)}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-xl transition-all border border-white/5"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="flex-1 py-4 bg-brand-blue hover:bg-brand-blue/90 text-white font-black rounded-xl transition-all shadow-xl shadow-brand-blue/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {editSaving ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <CheckCircle size={20} />
                    )}
                    {editSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeacherPortfolio;
