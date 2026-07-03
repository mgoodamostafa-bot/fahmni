import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit2, Trash2, BookOpen, Search, Key, ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  isPublished: boolean;
  teacherId: string;
  subject?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export const TeacherManageCourses: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const getYouTubeThumbnail = (url: string) => {
    const videoId = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/
    )?.[1];
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
  };

  const fetchCourses = async () => {
    if (!user) return;
    try {
      const qUpper = query(collection(db, 'Courses'), where('teacherId', '==', user.uid));
      const qLower = query(collection(db, 'courses'), where('teacherId', '==', user.uid));

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

      setCourses(allDocs);
    } catch (err) {
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [user]);

  const togglePublish = async (course: any) => {
    if (course.status !== 'approved' && course.status !== undefined) {
      alert('لا يمكنك نشر الكورس حتى يتم قبوله من قبل الإدارة.');
      return;
    }
    // Optimistic Update
    setCourses((prev) =>
      prev.map((c) => (c.id === course.id ? { ...c, isPublished: !c.isPublished } : c))
    );
    try {
      const collectionName = course._collection || 'Courses';
      await updateDoc(doc(db, collectionName, course.id), {
        isPublished: !course.isPublished,
      });
      // fetchCourses();
    } catch (err) {
      console.error(err);
      fetchCourses(); // Revert on failure
    }
  };

  const handleDelete = async (id: string) => {
    // Optimistic Update
    setCourses((prev) => prev.filter((c) => c.id !== id));
    setCourseToDelete(null);
    try {
      const course = courses.find((c) => c.id === id);
      const collectionName = (course as any)?._collection || 'Courses';
      await deleteDoc(doc(db, collectionName, id));
    } catch (error) {
      console.error(error);
      fetchCourses(); // Revert on failure
    }
  };

  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    );

  return (
    <div className="space-y-8 text-right p-4 md:p-8" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <Link
            to="/teacher"
            className="p-3 bg-white/5 rounded-2xl text-gray-400 hover:text-white transition-all"
          >
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white">كورساتي التعليمية</h1>
            <p className="text-gray-400 text-sm">إدارة المحتوى والدروس والطلاب المشتركين</p>
          </div>
        </div>
        <Link
          to="/teacher/add-course"
          className="btn-primary px-8 py-4 flex items-center gap-3 font-black"
        >
          <Plus size={24} /> إضافة كورس جديد
        </Link>
      </div>

      <div className="max-w-md">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="ابحث في كورساتك..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 text-white font-bold"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course) => (
          <motion.div
            key={course.id}
            className="glass-card overflow-hidden border border-white/10 group"
          >
            <div className="aspect-video relative overflow-hidden bg-white/5">
              <img
                src={
                  course.imageUrl || (course as any).thumbnailUrl || (course as any).videoUrl
                    ? getYouTubeThumbnail((course as any).videoUrl)
                    : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80'
                }
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src =
                    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80';
                }}
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black ${
                    course.status === 'approved'
                      ? 'bg-green-500 text-white'
                      : course.status === 'rejected'
                        ? 'bg-red-500 text-white'
                        : 'bg-amber-500 text-white'
                  }`}
                >
                  {course.status === 'approved'
                    ? 'مقبول'
                    : course.status === 'rejected'
                      ? 'مرفوض'
                      : 'قيد المراجعة'}
                </span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-black text-white">{course.title}</h2>
              <div className="flex items-center justify-between">
                <span className="text-brand-yellow font-black">{course.price} ج.م</span>
                <button
                  onClick={() => togglePublish(course)}
                  className={`text-[10px] font-black px-3 py-1 rounded-lg border ${
                    course.isPublished
                      ? 'border-green-500/50 text-green-500'
                      : 'border-white/10 text-gray-500'
                  }`}
                >
                  {course.isPublished ? 'منشور للطلاب' : 'مسودة'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/5">
                <Link
                  to={`/teacher/courses/${course.id}/edit`}
                  className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-brand-blue/20 text-brand-blue rounded-xl transition-all"
                >
                  <Edit2 size={16} /> <span className="text-xs font-black">تعديل</span>
                </Link>
                <Link
                  to={`/teacher/courses/${course.id}/lessons`}
                  className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-purple-500/20 text-purple-500 rounded-xl transition-all"
                >
                  <BookOpen size={16} /> <span className="text-xs font-black">الدروس</span>
                </Link>
                <Link
                  to={`/teacher/courses/${course.id}/codes`}
                  className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-amber-500/20 text-amber-500 rounded-xl transition-all"
                >
                  <Key size={16} /> <span className="text-xs font-black">الأكواد</span>
                </Link>
                <button
                  onClick={() => setCourseToDelete(course.id)}
                  className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-red-500/20 text-red-500 rounded-xl transition-all"
                >
                  <Trash2 size={16} /> <span className="text-xs font-black">حذف</span>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
