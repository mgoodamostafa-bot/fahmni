import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Zap, Search, ArrowRight, ChevronLeft, LayoutDashboard } from 'lucide-react';
import { CourseCard } from '../components/CourseCard';
import { CourseCardSkeleton } from '../components/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';

interface Course {
  id: string;
  title: string;
  subject: string;
  description: string;
  imageUrl: string;
  thumbnailUrl?: string;
  price: number;
  progress?: number;
  lessonCount?: number;
  duration?: string;
  teacherName?: string;
  teacherPhotoURL?: string;
  isPublished: boolean;
  teacherId?: string;
}

export const MyCourses: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchMyCourses = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        // 1. Fetch Enrollments (Double check Uppercase and lowercase)
        const qUpper = query(collection(db, 'Enrollments'), where('userId', '==', user.uid), where('status', '==', 'active'));
        const qLower = query(collection(db, 'enrollments'), where('userId', '==', user.uid), where('status', '==', 'active'));
        
        const [snapUpper, snapLower] = await Promise.all([getDocs(qUpper), getDocs(qLower)]);
        const courseIds = Array.from(new Set([
          ...snapUpper.docs.map(doc => doc.data().courseId),
          ...snapLower.docs.map(doc => doc.data().courseId)
        ]));

        if (courseIds.length === 0) {
          setCourses([]);
          setLoading(false);
          return;
        }

        const coursePromises = courseIds.filter(id => !!id).map(async (id) => {
          // Primarily use Uppercase 'Courses'
          let courseDoc = await getDoc(doc(db, 'Courses', id));
          if (!courseDoc.exists()) {
            // Fallback for legacy data
            courseDoc = await getDoc(doc(db, 'courses', id));
          }
          
          if (!courseDoc.exists()) return null;
          
          const courseData = { id: courseDoc.id, ...courseDoc.data() } as Course;
          
          // Fetch teacher info
          if (courseData.teacherId) {
            const teacherDoc = await getDoc(doc(db, 'users', courseData.teacherId));
            if (teacherDoc.exists()) {
              const teacherData = teacherDoc.data();
              courseData.teacherName = teacherData.displayName || 'مدرس المنصة';
              courseData.teacherPhotoURL = teacherData.photoURL || '';
            }
          }
          
          return courseData;
        });

        const fetchedCourses = (await Promise.all(coursePromises)).filter(Boolean) as Course[];
        setCourses(fetchedCourses);
      } catch (error) {
        console.error("Error fetching enrolled courses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyCourses();
  }, [user]);

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-right font-sans" dir="rtl">
      
      {/* 🛡️ IMMERSIVE PLATINUM HEADER - Compacted for better fit */}
      <div className="relative group">
          <div className="absolute inset-x-0 -top-20 h-64 bg-brand-blue/20 blur-[120px] opacity-20 pointer-events-none" />
          
          <div className="mesh-gradient-bg p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] border border-white/10 shadow-3xl relative overflow-hidden flex flex-col items-center text-center gap-6">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
            
            <motion.div 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               className="relative z-10"
            >
              <h1 className="text-3xl md:text-6xl font-black text-white mb-2 tracking-tighter leading-tight">
                كورساتي <span className="text-brand-blue drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]">التعليمية</span>
              </h1>
              <p className="text-white/60 font-bold text-sm md:text-xl max-w-2xl mx-auto leading-relaxed">
                تابع تقدّمك الأكاديمي للوصول إلى القمة.
              </p>
            </motion.div>
            
            <div className="relative w-full max-w-2xl group z-20">
                <div className="absolute inset-x-0 -bottom-1 h-px bg-gradient-to-r from-transparent via-brand-blue to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm" />
                <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-brand-blue transition-all" size={20} />
                <input 
                  type="text" 
                  placeholder="ابحث في كورساتك المشترك بها..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 backdrop-blur-3xl border-2 border-white/5 rounded-[2rem] py-5 pr-14 pl-5 focus:outline-none focus:border-brand-blue/50 focus:ring-8 focus:ring-brand-blue/5 shadow-2xl transition-all font-black text-lg text-white placeholder:text-white/20"
                />
            </div>
          </div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center text-brand-blue">
            <Zap size={20} fill="currentColor" />
          </div>
          <h2 className="text-2xl font-black text-white">المحتوى التعليمي</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => <CourseCardSkeleton key={i} />)}
          </div>
        ) : filteredCourses.length > 0 ? (
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            <AnimatePresence mode="popLayout">
              {filteredCourses.map((course) => (
                <motion.div
                  key={course.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <CourseCard course={course} isEnrolled={true} showProgress={true} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-32 text-center bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10 flex flex-col items-center gap-8 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-brand-blue/5 blur-3xl rounded-full translate-y-1/2 opacity-20" />
            
            <div className="w-24 h-24 bg-brand-blue/10 text-brand-blue rounded-3xl flex items-center justify-center shadow-2xl relative z-10">
               <BookOpen size={48} />
            </div>

            <div className="space-y-4 relative z-10">
               <h3 className="text-3xl font-black text-white">لا توجد كورسات حالياً</h3>
               <p className="text-white/60 font-bold max-w-md mx-auto leading-relaxed">لم تشترك في أي كورسات بعد. استكشف أفضل الكورسات التعليمية وابدأ رحلتك نحو التميّز الآن!</p>
            </div>

            <button 
              onClick={() => navigate('/courses')}
              className="btn-primary group relative z-10"
            >
              استكشف الكتالوج الآن
              <ChevronLeft size={20} className="group-hover:-translate-x-2 transition-transform" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MyCourses;
