import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  BookOpen,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Search,
  Key,
  Users,
  Percent,
  RefreshCw,
} from 'lucide-react';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pagination, usePagination } from '../../components/Pagination';

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  isPublished: boolean;
  teacherId: string;
  subject?: string;
  isPaid: boolean;
  status: 'pending' | 'approved' | 'rejected';
  commissionPercentage?: number;
  teacherName?: string;
}

export const AdminManageCourses: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [profitEditTarget, setProfitEditTarget] = useState<Course | null>(null);
  const [newCommission, setNewCommission] = useState<number>(100);
  const [updatingProfit, setUpdatingProfit] = useState(false);

  // --- Teacher First State ---
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [fetchingTeachers, setFetchingTeachers] = useState(false);

  const getYouTubeThumbnail = (url: string) => {
    const videoId = url.match(
      /(?:\byoutu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/
    )?.[1];
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
  };

  // Fail-safe load unfreezer
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setFetchingTeachers(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const { profile } = useAuth();

  const fetchCourses = async () => {
    try {
      const qUpper = query(collection(db, 'Courses'));
      const qLower = query(collection(db, 'courses'));

      const [snapUpper, snapLower] = await Promise.all([getDocs(qUpper), getDocs(qLower)]);

      const processDocs = (snap: any, collectionName: string) =>
        snap.docs.map(
          (doc: any) =>
            ({
              id: doc.id,
              ...doc.data(),
              _collection: collectionName,
            }) as any
        );

      const docsUpper = processDocs(snapUpper, 'Courses');
      const docsLower = processDocs(snapLower, 'courses');

      const allDocs = [...docsUpper];
      docsLower.forEach((d) => {
        if (!allDocs.find((ad) => ad.id === d.id)) allDocs.push(d);
      });

      // Fetch teacher names for each course
      const teacherIds = [...new Set(allDocs.map((c) => c.teacherId).filter(Boolean))];
      const teachersMap: Record<string, string> = {};

      await Promise.all(
        teacherIds.map(async (tid) => {
          const tDoc = await getDoc(doc(db, 'users', tid));
          if (tDoc.exists()) {
            teachersMap[tid] = tDoc.data().displayName || tDoc.data().email;
          }
        })
      );

      const coursesWithTeachers = allDocs.map((c) => ({
        ...c,
        teacherName: teachersMap[c.teacherId] || 'غير معروف',
      }));

      setCourses(coursesWithTeachers);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError('فشل تحميل الكورسات. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    if (profile?.role !== 'admin' && profile?.role !== 'teacher') return;
    setFetchingTeachers(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
      const snap = await getDocs(q);

      // Get all courses to count
      const cSnap1 = await getDocs(collection(db, 'Courses'));
      const cSnap2 = await getDocs(collection(db, 'courses'));
      const allCourses = [...cSnap1.docs, ...cSnap2.docs];

      const list = snap.docs
        .map((doc) => {
          const data = doc.data();
          const count = allCourses.filter((c) => c.data().teacherId === doc.id).length;
          return { id: doc.id, ...data, courseCount: count };
        })
        .sort((a, b) => b.courseCount - a.courseCount);

      setTeachersList(list);
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingTeachers(false);
    }
  };

  const updateCourseStatus = async (course: any, newStatus: 'approved' | 'rejected') => {
    try {
      const collectionName = course._collection || 'Courses';
      const courseId = typeof course === 'string' ? course : course.id;
      await updateDoc(doc(db, collectionName, courseId), {
        status: newStatus,
        isPublished: newStatus === 'approved' ? true : false,
      });
      fetchCourses();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('فشل تحديث حالة الكورس.');
    }
  };

  const handleQuickCommissionUpdate = async () => {
    if (!profitEditTarget) return;
    setUpdatingProfit(true);
    try {
      const collectionName = (profitEditTarget as any)._collection || 'Courses';
      await updateDoc(doc(db, collectionName, profitEditTarget.id), {
        commissionPercentage: newCommission,
      });
      setProfitEditTarget(null);
      fetchCourses();
    } catch (err) {
      console.error('Error updating commission:', err);
      alert('فشل تحديث النسبة.');
    } finally {
      setUpdatingProfit(false);
    }
  };

  const togglePublish = async (course: any) => {
    try {
      const collectionName = course._collection || 'Courses';
      await updateDoc(doc(db, collectionName, course.id), {
        isPublished: !course.isPublished,
      });
      fetchCourses();
    } catch (err) {
      console.error('Error toggling publish status:', err);
      alert('فشل تحديث حالة النشر.');
    }
  };

  useEffect(() => {
    if (profile?.role === 'admin' || profile?.role === 'teacher') {
      fetchTeachers();
      fetchCourses(); // Load all courses immediately for admin
    } else {
      setSelectedTeacherId(user?.uid || null);
      fetchCourses();
    }
  }, [profile]);

  useEffect(() => {
    if (selectedTeacherId && profile?.role !== 'admin' && profile?.role !== 'teacher') {
      fetchCourses();
    }
  }, [selectedTeacherId]);

  const handleDelete = async (id: string) => {
    try {
      const course = courses.find((c) => c.id === id);
      const collectionName = (course as any)?._collection || 'Courses';
      await deleteDoc(doc(db, collectionName, id));
      fetchCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
    }
    setCourseToDelete(null);
  };

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeacher = selectedTeacherId ? c.teacherId === selectedTeacherId : true;
    return matchesSearch && matchesTeacher;
  });

  const paginatedCourses = usePagination(filteredCourses, 20);

  if (loading || ((profile?.role === 'admin' || profile?.role === 'teacher') && fetchingTeachers)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
        <p className="text-slate-500 font-bold animate-pulse">جاري جلب البيانات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-purple-600/10 text-purple-500 rounded-3xl flex items-center justify-center shrink-0 shadow-2xl shadow-purple-500/5 border border-purple-500/10 transition-transform hover:scale-105 duration-500">
            <BookOpen size={36} />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white leading-none tracking-tight mb-2">
              إدارة الكورسات
            </h1>
            <p className="text-gray-400 text-xs md:text-sm font-bold opacity-80">
              {courses.length} كورس • قم بإضافة وتعديل الكورسات والمحتوى التعليمي
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCourses}
            disabled={loading}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all disabled:opacity-50"
            title="تحديث"
          >
            <RefreshCw size={20} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/teacher/courses/new"
            className="btn-primary px-8 py-4 flex items-center gap-3 text-lg"
          >
            <Plus size={24} /> إضافة كورس جديد
          </Link>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key="course-table"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="space-y-6"
        >
          {/* Teacher Filter Bar (admin only) */}
          {(profile?.role === 'admin' || profile?.role === 'teacher') && teachersList.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest">
                <Users size={16} /> فلتر حسب المدرس
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setSelectedTeacherId(null)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all border ${!selectedTeacherId ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/20' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'}`}
                >
                  كل الكورسات ({courses.length})
                </button>
                {teachersList.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeacherId(t.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all border ${selectedTeacherId === t.id ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/20' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'}`}
                  >
                    {t.photoURL && (
                      <img src={t.photoURL} className="w-5 h-5 rounded-full object-cover" alt="" />
                    )}
                    {t.displayName || t.email}
                    <span className="bg-white/10 px-1.5 py-0.5 rounded-full">{t.courseCount}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="flex items-center gap-4 max-w-md">
            <div className="relative flex-1">
              <Search
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="ابحث عن كورس..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white"
              />
            </div>
          </div>

          <div className="glass-card overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-gray-400 text-sm font-black uppercase tracking-widest">
                    <th className="p-6">الكورس</th>
                    <th className="p-6">المادة</th>
                    <th className="p-6">المدرس</th>
                    <th className="p-6 text-center">النسبة</th>
                    <th className="p-6">السعر</th>
                    <th className="p-6">الحالة</th>
                    <th className="p-6 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedCourses.items.map((course) => (
                    <tr key={course.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-white/5">
                            <img
                              src={
                                course.imageUrl ||
                                course.thumbnailUrl ||
                                (course.videoUrl ? getYouTubeThumbnail(course.videoUrl) : '') ||
                                'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80'
                              }
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src =
                                  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80';
                              }}
                            />
                          </div>
                          <div>
                            <p className="font-black text-white text-lg mb-1">{course.title}</p>
                            <p className="text-sm text-gray-400 font-bold line-clamp-1 max-w-xs">
                              {course.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="px-4 py-1.5 rounded-full bg-brand-blue/10 text-brand-blue text-sm font-black">
                          {course.subject || 'فيزياء'}
                        </span>
                      </td>
                      <td className="p-6">
                        <span className="text-sm font-bold text-gray-300">
                          {course.teacherName}
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <button
                          disabled={profile?.role !== 'admin' && profile?.role !== 'teacher'}
                          onClick={() => {
                            setProfitEditTarget(course);
                            setNewCommission(course.commissionPercentage ?? 100);
                          }}
                          className="px-3 py-1 bg-purple-500/10 text-purple-400 text-xs font-black rounded-lg border border-purple-500/20 hover:bg-purple-500/20 transition-all"
                        >
                          {course.commissionPercentage ?? 100}%
                        </button>
                      </td>
                      <td className="p-6 font-black text-brand-yellow text-lg">
                        {course.price} ج.م
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => togglePublish(course)}
                            disabled={course.status !== 'approved' && profile?.role !== 'admin' && profile?.role !== 'teacher'}
                            className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-black rounded-full transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                              course.isPublished
                                ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                : 'bg-gray-500/10 text-gray-400 border border-white/10'
                            }`}
                          >
                            <div
                              className={`w-2 h-2 rounded-full ${course.isPublished ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}
                            />
                            {course.isPublished ? 'منشور' : 'مسودة'}
                          </button>

                          {/* Course Status Tracking */}
                          <div className="flex gap-1">
                            <div
                              className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 text-[10px] font-black rounded-full border ${
                                course.status === 'approved'
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                  : course.status === 'rejected'
                                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              }`}
                            >
                              {course.status === 'approved'
                                ? 'مقبول ✅'
                                : course.status === 'rejected'
                                  ? 'مرفوض ❌'
                                  : 'قيد المراجعة ⏳'}
                            </div>

                            {(profile?.role === 'admin' || profile?.role === 'teacher') && course.status === 'pending' && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => updateCourseStatus(course, 'approved')}
                                  className="p-1.5 bg-emerald-500/20 text-emerald-500 rounded-lg hover:bg-emerald-500/30 transition-all"
                                  title="موافقة"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => updateCourseStatus(course, 'rejected')}
                                  className="p-1.5 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-all"
                                  title="رفض"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-6 text-left">
                        <div className="flex justify-end gap-3">
                          <Link
                            to={`/teacher/courses/${course.id}/edit`}
                            className="p-3 glass-card hover:bg-brand-blue/20 text-brand-blue transition-all"
                            title="تعديل الكورس"
                          >
                            <Edit2 size={20} />
                          </Link>
                          <Link
                            to={`/teacher/courses/${course.id}/lessons`}
                            className="p-3 glass-card hover:bg-purple-500/20 text-purple-500 transition-all"
                            title="إدارة الدروس"
                          >
                            <BookOpen size={20} />
                          </Link>
                          <Link
                            to={`/teacher/courses/${course.id}/codes`}
                            className="p-3 glass-card hover:bg-brand-yellow/20 text-brand-yellow transition-all"
                            title="إدارة الأكواد"
                          >
                            <Key size={20} />
                          </Link>
                          <button
                            onClick={() => setCourseToDelete(course.id)}
                            className="p-3 glass-card hover:bg-red-500/20 text-red-500 transition-all"
                            title="حذف الكورس"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCourses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="bg-white/5 p-6 rounded-full">
                            <BookOpen size={48} className="text-gray-600" />
                          </div>
                          <p className="text-gray-400 font-bold text-xl">لا توجد كورسات حالياً</p>
                          <Link
                            to="/teacher/courses/new"
                            className="text-brand-blue font-black hover:underline"
                          >
                            أضف أول كورس الآن
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination
            currentPage={paginatedCourses.page}
            totalPages={paginatedCourses.totalPages}
            onPageChange={paginatedCourses.setPage}
          />
        </motion.div>
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {courseToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-10 max-w-md w-full shadow-2xl border border-white/10 text-center"
            >
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={40} className="text-red-500" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4 font-display">حذف الكورس</h3>
              <p className="text-gray-400 font-bold mb-10 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف هذا الكورس؟ لا يمكن التراجع عن هذا الإجراء وسيتم حذف
                جميع الدروس المرتبطة به.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setCourseToDelete(null)}
                  className="flex-1 py-4 glass-card hover:bg-white/10 text-white font-black transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => handleDelete(courseToDelete)}
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-600/20"
                >
                  تأكيد الحذف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 📊 Quick Profit Edit Modal */}
      <AnimatePresence>
        {profitEditTarget && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-10 max-w-sm w-full shadow-2xl border border-white/10 text-right"
            >
              <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Percent size={40} className="text-purple-500" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2 text-center">تعديل نسبة المدرس</h3>
              <p className="text-gray-400 font-bold mb-8 text-center text-sm">
                تعديل النسبة لهذا الكورس فقط:
                <br />
                <span className="text-purple-400">{profitEditTarget.title}</span>
              </p>

              <div className="space-y-6">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newCommission}
                    onChange={(e) => setNewCommission(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/20 rounded-2xl py-5 text-center font-black text-4xl text-white outline-none focus:border-purple-500 transition-all font-mono"
                  />
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-purple-500 font-black text-xl">
                    %
                  </div>
                </div>

                {/* 💰 Live Breakdown */}
                {profitEditTarget.price > 0 && (
                  <div className="bg-white/5 rounded-2xl p-4 space-y-2 text-right border border-white/5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-emerald-400 font-mono font-black">
                        {((profitEditTarget.price * newCommission) / 100).toLocaleString('ar-EG')}{' '}
                        ج.م
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">نصيب المدرس:</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-blue-400 font-mono font-black">
                        {(
                          profitEditTarget.price -
                          (profitEditTarget.price * newCommission) / 100
                        ).toLocaleString('ar-EG')}{' '}
                        ج.م
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">صافي المنصة:</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    disabled={updatingProfit}
                    onClick={handleQuickCommissionUpdate}
                    className="flex-1 py-4 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50"
                  >
                    {updatingProfit ? 'جاري الحفظ...' : 'حفظ النسبة'}
                  </button>
                  <button
                    onClick={() => setProfitEditTarget(null)}
                    className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl transition-all"
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
  );
};
