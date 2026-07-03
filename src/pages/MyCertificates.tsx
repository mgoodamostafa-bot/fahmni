import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Award, BookOpen, Loader2, Download, CheckCircle2, Trophy, Clock, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CertificateGenerator } from '../components/CertificateGenerator';
import { Link } from 'react-router-dom';

interface CompletedCourse {
  id: string;
  title: string;
  imageUrl?: string;
  teacherId: string;
  completedAt: string;
  totalLessons: number;
}

export const MyCertificates: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
  const [selectedCert, setSelectedCert] = useState<CompletedCourse | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchCompletedCourses = async () => {
      setLoading(true);
      try {
        // 1. Get all active enrollments
        const enrollSnap = await getDocs(query(
          collection(db, 'Enrollments'), // Collection names might vary, standardizing on Upper 'Enrollments' as per previous edits
          where('userId', '==', user.uid),
          where('status', '==', 'active')
        ));

        const enrollmentList = enrollSnap.docs.map(d => ({ id: d.data().courseId }));
        const courses: CompletedCourse[] = [];

        for (const enroll of enrollmentList) {
          // 2. Get Lessons for this course
          const lessonsSnap = await getDocs(query(
            collection(db, 'Lessons'),
            where('courseId', '==', enroll.id)
          ));
          const totalLessons = lessonsSnap.size;

          if (totalLessons === 0) continue;

          // 3. Get Progress for this student in this course
          const progressSnap = await getDocs(query(
            collection(db, 'user_progress'),
            where('userId', '==', user.uid),
            where('courseId', '==', enroll.id),
            where('isCompleted', '==', true)
          ));
          const completedCount = progressSnap.size;

          // 4. If 100% complete, get course details
          if (completedCount === totalLessons) {
            const courseDoc = await getDoc(doc(db, 'Courses', enroll.id));
            if (courseDoc.exists()) {
              const courseData = courseDoc.data();
              courses.push({
                id: enroll.id,
                title: courseData.title,
                imageUrl: courseData.imageUrl || courseData.thumbnailUrl,
                teacherId: courseData.teacherId,
                totalLessons: totalLessons,
                completedAt: new Date().toLocaleDateString('ar-EG') // Fallback date
              });
            }
          }
        }

        setCompletedCourses(courses);
      } catch (err) {
        console.error("Error fetching certificates:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompletedCourses();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6" dir="rtl">
        <Loader2 className="w-16 h-16 text-brand-blue animate-spin" />
        <p className="text-white text-xl font-black">جاري جلب إنجازاتك...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24" dir="rtl">
      {/* Header Section */}
      <div className="relative overflow-hidden p-8 sm:p-12 bg-white/5 rounded-[2.5rem] border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/10 blur-[80px] -z-10 rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-gold/5 blur-[80px] -z-10 rounded-full" />
        
        <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-right">
          <div className="w-24 h-24 bg-accent-gold/20 text-accent-gold rounded-[2rem] flex items-center justify-center shadow-2xl shadow-accent-gold/10 border border-accent-gold/20">
            <Trophy size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black text-white font-display">لوحة الشهادات والتكريم</h1>
            <p className="text-gray-400 font-bold text-lg">هنا نجمع ثمار جهدك، مبارك لك كل خطوة نجاح</p>
          </div>
        </div>
      </div>

      {completedCourses.length === 0 ? (
        <div className="glass-card p-20 text-center flex flex-col items-center gap-8 bg-white/5">
           <div className="w-20 h-20 bg-white/5 text-gray-600 rounded-full flex items-center justify-center">
              <BookOpen size={40} />
           </div>
           <div className="space-y-4">
              <h3 className="text-2xl font-black text-white">لا توجد شهادات حالياً</h3>
              <p className="text-gray-500 font-bold max-w-md mx-auto line-clamp-2">
                استمر في المذاكرة وإنهاء دروس كورساتك لتصل إلى نسبة 100% وتظهر شهادتك هنا فوراً.
              </p>
           </div>
           <Link to="/my-courses" className="btn-primary">متابعة دروسي الآن</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {completedCourses.map((course) => (
             <motion.div 
               key={course.id}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="group glass-card border-brand-blue/20 hover:border-brand-blue/50 transition-all duration-500 overflow-hidden relative"
             >
                <div className="aspect-video w-full bg-black relative">
                   {course.imageUrl ? (
                     <img src={course.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-60" alt="" />
                   ) : (
                     <div className="w-full h-full bg-brand-blue/10 flex items-center justify-center">
                        <BookOpen size={48} className="text-brand-blue/30" />
                     </div>
                   )}
                   <div className="absolute inset-0 bg-gradient-to-t from-[#0a1220] to-transparent" />
                   <div className="absolute top-4 right-4 bg-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-emerald-400/20">
                      <CheckCircle2 size={12} /> مكتمل بنجاح
                   </div>
                </div>

                <div className="p-8 space-y-6">
                   <h3 className="text-xl font-black text-white group-hover:text-brand-blue transition-colors line-clamp-1">{course.title}</h3>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                         <p className="text-[10px] text-gray-500 font-black mb-1 uppercase tracking-widest">المحتوى</p>
                         <p className="text-sm font-bold text-white">{course.totalLessons} حصة</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                         <p className="text-[10px] text-gray-500 font-black mb-1 uppercase tracking-widest">تاريخ التخرج</p>
                         <p className="text-sm font-bold text-white">{course.completedAt}</p>
                      </div>
                   </div>

                   <button 
                     onClick={() => setSelectedCert(course)}
                     className="w-full bg-brand-blue text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all hover:bg-brand-blue/80 shadow-xl shadow-brand-blue/20 group-hover:scale-[1.02]"
                   >
                     <Award size={22} /> عرض الشهادة
                   </button>
                </div>
             </motion.div>
           ))}
        </div>
      )}

      {/* Recommended Section (If no certs or few certs) */}
      {completedCourses.length < 2 && (
         <div className="mt-20 glass-card p-10 bg-brand-blue/5 border-dashed border-2 border-brand-blue/20">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
               <div className="space-y-4">
                  <h4 className="text-2xl font-black text-white flex items-center gap-4">
                    <Clock className="text-brand-blue animate-spin-slow" /> قريباً في شهاداتك...
                  </h4>
                  <p className="text-gray-500 font-bold">لديك كورسات اقتربت من الانتهاء، أكملها الآن لتحصل على شهادة التقدير.</p>
               </div>
               <Link to="/courses" className="text-brand-blue font-black flex items-center gap-2 group">
                  اكتشف المزيد من الكورسات 
                  <ChevronLeft className="group-hover:-translate-x-2 transition-transform" />
               </Link>
            </div>
         </div>
      )}

      {/* Certificate Modal */}
      {selectedCert && (
        <CertificateGenerator 
          studentName={profile?.displayName || user?.displayName || user?.email || "طالب متميز"}
          courseTitle={selectedCert.title}
          date={selectedCert.completedAt}
          certificateId={`CERT-${selectedCert.id.slice(0,4)}-${user?.uid.slice(0,4)}`.toUpperCase()}
        />
      )}
    </div>
  );
};
