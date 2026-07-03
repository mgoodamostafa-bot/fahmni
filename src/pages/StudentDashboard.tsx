import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { smartGetDocs } from '../utils/firestore';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  BookOpen, 
  LayoutDashboard, 
  Book, 
  Globe, 
  FlaskConical, 
  Atom, 
  Microscope, 
  Calculator,
  ChevronLeft,
  Star,
  Zap,
  Filter,
  Play,
  Clock,
  RotateCcw
} from 'lucide-react';
import { CourseCard } from '../components/CourseCard';
import { CourseCardSkeleton } from '../components/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { AccountGuide } from '../components/AccountGuide';
import { useSettings } from '../contexts/SettingsContext';

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
}

const SUBJECTS = [
  { id: 'كل المواد', label: 'كل المواد', icon: <LayoutDashboard size={20} /> },
  { id: 'لغة عربية', label: 'اللغة العربية', icon: <Book size={20} /> },
  { id: 'إنجليزي', label: 'إنجليزي', icon: <Globe size={20} /> },
  { id: 'كيمياء', label: 'كيمياء', icon: <FlaskConical size={20} /> },
  { id: 'فيزياء', label: 'فيزياء', icon: <Atom size={20} /> },
  { id: 'أحياء', label: 'أحياء', icon: <Microscope size={20} /> },
  { id: 'رياضة', label: 'رياضة', icon: <Calculator size={20} /> },
];

export const StudentDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [teachers, setTeachers] = useState<Record<string, { displayName: string; photoURL: string }>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('كل المواد');
  const [searchTerm, setSearchTerm] = useState('');
  const [continueWatching, setContinueWatching] = useState<Array<{
    courseId: string;
    courseTitle: string;
    courseImage: string;
    lastLessonTitle: string;
    lastLessonId: string;
    progress: number;
    subject: string;
  }>>([]);
  const [loadingContinue, setLoadingContinue] = useState(true);
  
  const studentName = profile?.displayName || 'طالبنا المتميز';

  // Fetch "Continue where you left off" data
  useEffect(() => {
    const fetchContinueWatching = async () => {
      if (!user) { setLoadingContinue(false); return; }
      try {
        // Fetch active enrollments with lastLessonId
        const enrollQ1 = query(collection(db, 'Enrollments'), where('userId', '==', user.uid), where('status', '==', 'active'));
        const enrollQ2 = query(collection(db, 'enrollments'), where('userId', '==', user.uid), where('status', '==', 'active'));
        const [s1, s2] = await Promise.all([getDocs(enrollQ1).catch(() => ({ docs: [] })), getDocs(enrollQ2).catch(() => ({ docs: [] }))]);
        const allEnrollments = [...s1.docs, ...s2.docs];
        const uniqueEnrollments = Array.from(new Map(allEnrollments.map(d => [d.id, d.data()])).values())
          .filter((e: any) => e.lastLessonId && (e.progress || 0) < 100)
          .sort((a: any, b: any) => (b.lastWatchedAt || '').localeCompare(a.lastWatchedAt || ''))
          .slice(0, 6);

        if (uniqueEnrollments.length === 0) { setLoadingContinue(false); return; }

        // Batch-fetch course + lesson data in parallel
        const items = await Promise.all(uniqueEnrollments.map(async (enrollment: any) => {
          try {
            let courseDoc = await getDoc(doc(db, 'Courses', enrollment.courseId));
            if (!courseDoc.exists()) courseDoc = await getDoc(doc(db, 'courses', enrollment.courseId));
            if (!courseDoc.exists()) return null;
            const courseData = courseDoc.data();
            
            let lessonTitle = 'درس';
            if (enrollment.lastLessonId) {
              let lessonDoc = await getDoc(doc(db, 'Lessons', enrollment.lastLessonId));
              if (!lessonDoc.exists()) lessonDoc = await getDoc(doc(db, 'lessons', enrollment.lastLessonId));
              if (lessonDoc.exists()) lessonTitle = lessonDoc.data().title || lessonTitle;
            }
            
            return {
              courseId: enrollment.courseId,
              courseTitle: courseData.title || 'كورس',
              courseImage: courseData.imageUrl || courseData.thumbnailUrl || '',
              lastLessonTitle: lessonTitle,
              lastLessonId: enrollment.lastLessonId,
              progress: enrollment.progress || 0,
              subject: courseData.subject || ''
            };
          } catch { return null; }
        }));

        setContinueWatching(items.filter(Boolean) as any);
      } catch (err) {
        console.error('Error fetching continue watching:', err);
      } finally {
        setLoadingContinue(false);
      }
    };
    fetchContinueWatching();
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Parallelize initial independent fetches
        const [fetchedCourses, enrolledDocs] = await Promise.all([
          smartGetDocs('Courses', [where('isPublished', '==', true), orderBy('createdAt', 'desc'), limit(50)]),
          smartGetDocs('Enrollments', [where('userId', '==', user.uid)])
        ]);

        const enrolledIds = new Set(enrolledDocs.map(d => d.courseId));
        setEnrolledCourseIds(enrolledIds);

        // Fetch Teacher Profiles
        const teacherIds = Array.from(new Set(fetchedCourses.map(c => (c as any).teacherId).filter(Boolean)));
        const teacherData: Record<string, { displayName: string; photoURL: string }> = {};
        
        if (teacherIds.length > 0) {
          // Chunk teacher IDs if they are more than 10 (smartGetDocs handles single batches well)
          const teachersSnapshot = await getDocs(query(
            collection(db, 'users'),
            where('uid', 'in', teacherIds.slice(0, 10))
          ));
          
          teachersSnapshot.forEach(doc => {
            const data = doc.data();
            teacherData[doc.id] = {
              displayName: data.displayName || 'مدرس المنصة',
              photoURL: data.photoURL || ''
            };
          });
        }
        
        setTeachers(teacherData);
        setCourses(fetchedCourses as Course[]);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const filteredCourses = courses.filter(c => {
    const matchesSubject = selectedSubject === 'كل المواد' || c.subject === selectedSubject;
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-right font-sans" dir="rtl">
      
      {/* 🔥 Continue Where You Left Off — Udemy Style */}
      {!loadingContinue && continueWatching.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
              <RotateCcw size={20} />
            </div>
            <h2 className="text-2xl font-black text-white">أكمل من حيث توقفت</h2>
          </div>
          
          <div className="flex gap-5 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory -mx-4 px-4">
            {continueWatching.map((item, idx) => (
              <motion.div
                key={item.courseId}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => navigate(`/courses/${item.courseId}/learn/${item.lastLessonId}`)}
                className="flex-shrink-0 w-[320px] sm:w-[380px] snap-start bg-white/[0.03] backdrop-blur-sm rounded-[2rem] border border-white/[0.06] overflow-hidden cursor-pointer group hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500 active:scale-[0.98]"
              >
                {/* Course Thumbnail */}
                <div className="relative h-40 overflow-hidden">
                  {item.courseImage ? (
                    <img src={item.courseImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand-blue/20 to-emerald-500/20 flex items-center justify-center">
                      <BookOpen size={40} className="text-white/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 transform group-hover:scale-110 transition-transform">
                      <Play size={24} fill="white" className="text-white mr-[-2px]" />
                    </div>
                  </div>
                  
                  {/* Progress Bar on image bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
                
                {/* Info */}
                <div className="p-5 space-y-3">
                  <div>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">{item.subject}</p>
                    <h3 className="text-base font-black text-white line-clamp-1 group-hover:text-emerald-400 transition-colors">{item.courseTitle}</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-white/40 flex items-center gap-1.5">
                      <Clock size={12} />
                      {item.lastLessonTitle}
                    </p>
                    <span className="text-xs font-black text-emerald-500">{item.progress}%</span>
                  </div>
                  <button className="w-full bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 border border-emerald-500/20 hover:border-emerald-500">
                    متابعة المشاهدة
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Loading skeleton for continue watching */}
      {loadingContinue && (
        <div className="flex gap-5 overflow-hidden">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-shrink-0 w-[320px] sm:w-[380px] bg-white/5 rounded-[2rem] overflow-hidden animate-pulse">
              <div className="h-40 bg-white/5" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-white/5 rounded-full w-3/4" />
                <div className="h-3 bg-white/5 rounded-full w-1/2" />
                <div className="h-10 bg-white/5 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search & Hero Section - High End Mesh Gradient Banner */}
      <div className="relative group perspective-1000">
          <div className="absolute inset-0 bg-brand-blue/20 blur-[60px] opacity-20 pointer-events-none" />
          
          <div className="mesh-gradient-bg p-10 md:p-16 rounded-[4rem] border border-white/10 shadow-3xl relative overflow-hidden flex flex-col items-center text-center gap-10">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
            
            <motion.div 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               className="relative z-10 max-w-3xl"
            >
              <h1 className="text-4xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-tight">
                مستقبلك يبدأ <span className="text-brand-blue drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]">من هنا</span>
              </h1>
              <p className="text-white/60 font-bold text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed">
                اكتشف نخبة من المدرسين المتميزين وانضم لأكبر منصة تعليمية ذكية في الشرق الأوسط.
              </p>
            </motion.div>
            
            <div className="relative w-full md:w-full max-w-2xl group z-20">
                <div className="absolute inset-x-0 -bottom-2 h-px bg-gradient-to-r from-transparent via-brand-blue to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm" />
                <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-brand-blue transition-all" size={24} />
                <input 
                  type="text" 
                  placeholder="ابحث عن كورس، مادة، أو مدرس..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 backdrop-blur-md border-2 border-white/5 rounded-[2.5rem] py-6 pr-16 pl-6 focus:outline-none focus:border-brand-blue/50 focus:ring-8 focus:ring-brand-blue/5 shadow-2xl transition-all font-black text-xl text-white placeholder:text-white/20"
                />
            </div>
          </div>

          {/* Horizontal Subject Filter Bar - Premium Glassmorphism */}
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-10 -mx-4 px-4 sticky top-0 z-40 bg-[var(--bg-main)]/50 backdrop-blur-lg">
            {SUBJECTS.map((subject) => (
              <button
                key={subject.id}
                onClick={() => setSelectedSubject(subject.id)}
                className={`flex items-center gap-3 px-8 py-5 rounded-[2rem] font-black text-base transition-all whitespace-nowrap border-2 relative overflow-hidden group/btn ${
                  selectedSubject === subject.id
                    ? 'bg-brand-blue border-brand-blue text-white shadow-[0_20px_40px_rgba(59,130,246,0.3)] scale-105'
                    : 'bg-white/5 border-white/5 text-white/40 hover:border-brand-blue/30 hover:bg-brand-blue/5 hover:text-white'
                }`}
              >
                <div className={`transition-transform duration-300 group-hover/btn:scale-110 ${selectedSubject === subject.id ? 'text-white' : 'text-brand-blue'}`}>
                  {subject.icon}
                </div>
                {subject.label}
                {selectedSubject === subject.id && (
                  <motion.div layoutId="subject-active" className="absolute inset-0 bg-white/10" />
                )}
              </button>
            ))}
          </div>
      </div>

      {/* Account Guide Section */}
      {settings?.showStudentGuide !== false && (
        <AccountGuide 
          videoUrl={settings?.studentGuideVideoUrl} 
          role="student" 
        />
      )}

      {/* Main Grid Section */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center text-brand-blue">
                 <Zap size={20} fill="currentColor" />
              </div>
              <h2 className="text-2xl font-black text-white">أحدث الكورسات</h2>
           </div>
           <p className="text-sm font-bold text-white/40">عرض {filteredCourses.length} كورس</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => <CourseCardSkeleton key={i} />)}
          </div>
        ) : filteredCourses.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            <AnimatePresence mode="popLayout">
              {filteredCourses.map((course) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                >
                  <CourseCard 
                    course={{
                      ...course,
                      teacherName: teachers[(course as any).teacherId]?.displayName,
                      teacherPhotoURL: teachers[(course as any).teacherId]?.photoURL,
                    }} 
                    isEnrolled={enrolledCourseIds.has(course.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="py-32 text-center bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-12 h-12 text-white/20" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">لم نجد أي نتائج للطالب الذكي!</h3>
            <p className="text-white/60 font-bold mb-8">جرب البحث بكلمات أخرى أو اختر مادة مختلفة.</p>
            <button 
              onClick={() => { setSelectedSubject('كل المواد'); setSearchTerm(''); }}
              className="btn-primary text-sm px-10 py-4"
            >
              إعادة تهيئة الفلاتر
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
