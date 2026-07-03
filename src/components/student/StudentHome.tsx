import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Clock, 
  BookOpen, 
  Star, 
  ChevronLeft, 
  TrendingUp, 
  Award, 
  Wallet,
  Bell,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { CourseCard } from '../CourseCard';
import { ProgressBar } from '../ProgressBar';
import { AccountGuide } from '../AccountGuide';
import { useSettings } from '../../contexts/SettingsContext';
import { useTenant } from '../../contexts/TenantContext';

export const StudentHome: React.FC = () => {
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const { tenantData } = useTenant();
  const { notifications } = useNotifications();
  const navigate = useNavigate();
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [lastLesson, setLastLesson] = useState<any>(null);
  const [stats, setStats] = useState({
    enrolledCount: 0,
    completedLessons: 0
  });
  const [recommendedCourses, setRecommendedCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // 1. Listen to Enrollments
    const fetchEnrollments = async () => {
      const qUpper = query(collection(db, 'Enrollments'), where('userId', '==', user.uid));
      const qLower = query(collection(db, 'enrollments'), where('userId', '==', user.uid));

      const unsubUpper = onSnapshot(qUpper, async (snapUpper) => {
        try {
          const snapLower = await getDocs(qLower);
          const allDocs = [...snapUpper.docs, ...snapLower.docs];
          
          const enrolledCourseIds = Array.from(new Set(
            allDocs
              .filter(d => {
                const status = d.data().status;
                return status === 'active' || !status;
              })
              .map(d => d.data().courseId)
          )).filter(id => !!id);
          const count = enrolledCourseIds.length;
          setStats(prev => ({ ...prev, enrolledCount: count }));

          if (count > 0) {
            try {
              // Optimization: Use 'in' query to fetch all courses in one go (batching)
              const idsToFetch = enrolledCourseIds.slice(0, 30); // Firestore 'in' limit is 30
              const coursesQuery = query(collection(db, 'Courses'), where('__name__', 'in', idsToFetch));
              const coursesQueryLower = query(collection(db, 'courses'), where('__name__', 'in', idsToFetch));
              
              const [snap1, snap2] = await Promise.all([getDocs(coursesQuery), getDocs(coursesQueryLower)]);
              
              const coursesMap = new Map();
              snap1.docs.forEach(d => coursesMap.set(d.id, { id: d.id, ...d.data() }));
              snap2.docs.forEach(d => coursesMap.set(d.id, { id: d.id, ...d.data() }));
              
              setMyCourses(Array.from(coursesMap.values()));
            } catch (error) {
              console.error("Error fetching courses in batch:", error);
            }
          } else {
            setMyCourses([]);
          }
        } catch (error) {
          console.error("Error in Enrollments snapshot handler:", error);
        } finally {
          setLoading(false);
        }
      }, (error) => {
        console.error("Error listening to Enrollments:", error);
        setLoading(false);
      });

      return unsubUpper;
    };

    const unsubscribeEnrollmentsPromise = fetchEnrollments();

    // 2. Listen to Completed Lessons (user_progress with isCompleted: true)
    const progressQuery = query(
      collection(db, 'user_progress'),
      where('userId', '==', user.uid),
      where('isCompleted', '==', true)
    );

    const unsubscribeProgress = onSnapshot(progressQuery, (snapshot) => {
      setStats(prev => ({ ...prev, completedLessons: snapshot.size }));
    }, (error) => {
      console.error("Error listening to user progress:", error);
    });

    // 3. Listen to Last Viewed Lesson (user_progress)
    const lastViewedQuery = query(
      collection(db, 'user_progress'),
      where('userId', '==', user.uid),
      orderBy('lastViewedAt', 'desc'),
      limit(1)
    );

    const unsubscribeLastViewed = onSnapshot(lastViewedQuery, async (snapshot) => {
      try {
        if (!snapshot.empty) {
          const progressData = snapshot.docs[0].data();
          // Check both collection casings for the lesson itself
          let lessonDoc = await getDoc(doc(db, 'Lessons', progressData.lessonId));
          if (!lessonDoc.exists()) {
             lessonDoc = await getDoc(doc(db, 'lessons', progressData.lessonId));
          }

          if (lessonDoc.exists()) {
            // Fetch course thumbnail for better visual reference
            let courseThumbnail = '';
            const courseDoc = await getDoc(doc(db, 'Courses', progressData.courseId));
            if (courseDoc.exists()) {
              courseThumbnail = courseDoc.data().thumbnailUrl || courseDoc.data().imageUrl;
            } else {
               const courseDocLower = await getDoc(doc(db, 'courses', progressData.courseId));
               if (courseDocLower.exists()) {
                 courseThumbnail = courseDocLower.data().thumbnailUrl || courseDocLower.data().imageUrl;
               }
            }

            setLastLesson({
              ...lessonDoc.data(),
              id: lessonDoc.id,
              progress: progressData.progress,
              courseId: progressData.courseId,
              courseThumbnail: courseThumbnail // Added course thumbnail
            });
          }
        } else {
          setLastLesson(null);
        }
      } catch (error) {
        console.error("Error loading last viewed lesson details:", error);
      }
    }, (error) => {
      console.error("Error listening to last viewed lesson:", error);
    });

    // 4. Fetch Recommended Courses (Same Grade)
    const fetchRecommendations = async () => {
      if (!profile?.level && !profile?.grade) return;
      
      try {
        const q = query(
          collection(db, 'Courses'),
          where('level', '==', profile.level),
          where('grade', '==', profile.grade),
          limit(4)
        );
        
        const snapshot = await getDocs(q);
        const recs = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(c => !myCourses.some(mc => mc.id === c.id)); // Don't recommend what they already have
        
        setRecommendedCourses(recs);
      } catch (error) {
        console.error("Error fetching recommendations:", error);
      }
    };

    fetchRecommendations();

    return () => {
      unsubscribeEnrollmentsPromise.then(unsub => unsub());
      unsubscribeProgress();
      unsubscribeLastViewed();
    };
  }, [user?.uid, profile?.level, profile?.grade]);

  const latestNotification = notifications[0];

  if (loading) {
     return (
        <div className="w-full space-y-10 pb-20 animate-pulse" dir="rtl">
           <div className="h-48 md:h-64 bg-white/[0.06] rounded-[2.5rem] w-full" />
           <div className="h-16 bg-white/[0.06] rounded-2xl w-full" />
           <div className="space-y-6">
              <div className="h-8 bg-white/[0.06] rounded-lg w-48" />
              <div className="h-64 bg-white/[0.06] rounded-[2rem] w-full" />
           </div>
           <div className="space-y-6">
              <div className="flex justify-between">
                 <div className="h-8 bg-white/[0.06] rounded-lg w-48" />
                 <div className="h-6 bg-white/[0.06] rounded-lg w-24" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {[1, 2, 3].map(i => <div key={i} className="h-80 bg-white/[0.06] rounded-[2rem]" />)}
              </div>
           </div>
        </div>
     );
  }

  return (
    <div className="w-full space-y-12 pb-20 px-0 sm:px-6 lg:px-8" dir="rtl">
      {/* 1. Personalized Hero Section */}
      <section className="relative overflow-hidden bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[2rem] sm:rounded-[3rem] p-6 md:p-10 text-[var(--text-main)] transition-colors duration-300 shadow-2xl mx-4 sm:mx-0">
         {/* Premium background mesh gradients */}
         <div className="absolute inset-0 opacity-15 pointer-events-none">
            <div className="absolute top-[-20%] left-[-15%] w-[60%] h-[60%] bg-brand-blue blur-[70px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-15%] w-[60%] h-[60%] bg-violet-600 blur-[70px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
         </div>
  
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10">
            {/* Student Avatar & Greeting */}
            <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto">
               <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 md:border-4 border-brand-blue/30 shadow-2xl bg-[var(--bg-main)] shrink-0 relative group">
                  <img 
                    src={profile?.photoURL || profile?.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || 'طالب')}&background=0a1220&color=2563eb`} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    alt="Student Avatar" 
                  />
               </div>
               <div className="text-right space-y-1.5">
                  {/* Platform Name Badge */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black text-brand-blue bg-brand-blue/10 border border-brand-blue/20 shadow-sm shadow-brand-blue/5">
                    ✨ {tenantData?.name || settings.siteName || 'منصة فهمني'}
                  </span>
                  <h1 className="text-xl sm:text-2xl md:text-4xl font-black text-white leading-tight tracking-tight">
                    أهلاً بك، <span className="text-brand-yellow drop-shadow-lg">{profile?.displayName?.split(' ')[0] || 'طالبنا'}</span> 👋
                  </h1>
                  <p className="text-slate-400 font-bold text-[10px] sm:text-xs md:text-sm leading-relaxed">أنت الآن في رحلة نحو التميز.. هل أنت مستعد للدرس التالي؟</p>
               </div>
            </div>

            {/* Teacher Branding Photo ("الصورة الأخرى") */}
            {(tenantData?.logo || settings.logoUrl) && (
               <div className="flex items-center gap-3 shrink-0 self-end md:self-center border-t border-white/5 md:border-t-0 md:border-r md:border-white/5 pt-4 md:pt-0 md:pr-8 w-full md:w-auto justify-end">
                  <div className="text-right">
                     <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">تحت إشراف</p>
                     <p className="text-xs font-black text-white mt-0.5">{tenantData?.teacherName || settings.teacherName || 'معلمك'}</p>
                  </div>
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-brand-blue/30 shadow-2xl bg-[var(--bg-main)] shrink-0 relative group">
                     <img 
                       src={tenantData?.logo || settings.logoUrl} 
                       className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                       alt="Teacher Avatar" 
                     />
                  </div>
               </div>
            )}
         </div>
      </section>

      
      {/* Account Guide Section */}
      <div className="px-4 sm:px-0">
        <AccountGuide 
          videoUrl={settings.studentGuideVideoUrl} 
          role="student" 
        />
      </div>

      {/* 2. Key Statistics */}
      <section className="px-4 sm:px-0">
         <div className="grid grid-cols-3 gap-3 md:gap-6 w-full">
            <StatCard 
              icon={<BookOpen className="text-brand-yellow" size={20} />} 
              value={stats?.enrolledCount || 0} 
              label="كورس مشترك" 
            />
            <StatCard 
              icon={<CheckCircle2 className="text-emerald-500" size={20} />} 
              value={stats?.completedLessons || 0} 
              label="درس تم إنجازه" 
            />
            <StatCard 
              icon={<Wallet className="text-brand-yellow" size={20} />} 
              value={`${(profile?.walletBalance || 0).toLocaleString('ar-EG')}`} 
              label="رصيد المحفظة" 
            />
         </div>
      </section>

      {/* 3. Continue Watching */}
      {lastLesson && (
        <section className="space-y-6">
           <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-3 transition-colors duration-300">
                 <Clock className="text-brand-blue" />
                 أكمل مشاهدتك
              </h2>
           </div>
 
            <div className="bg-[var(--bg-card)] rounded-[2rem] p-6 border border-[var(--border-main)] shadow-xl flex flex-col md:flex-row items-center gap-8 group hover:border-brand-blue/20 transition-all transition-colors duration-300 mx-4 sm:mx-0">
              <div className="relative w-full md:w-64 aspect-video rounded-2xl overflow-hidden shadow-lg">
                  <img 
                    src={lastLesson.courseThumbnail || lastLesson.thumbnailUrl || Object.entries({
                      'الفيزياء': 'https://images.unsplash.com/photo-1636466484294-4758b901f8a5?w=800&q=80',
                      'الكيمياء': 'https://images.unsplash.com/photo-1532187863486-abf51ad982d7?w=800&q=80',
                      'الرياضيات': 'https://images.unsplash.com/photo-1509228468518-180dd482180c?w=800&q=80',
                      'الأحياء': 'https://images.unsplash.com/photo-1530026405186-ed1b0ca67b0b?w=800&q=80',
                      'اللغة العربية': 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=800&q=80',
                      'اللغة الإنجليزية': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80',
                    }).find(([k]) => lastLesson.subject?.includes(k))?.[1] || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80'} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    alt="Course"
                  />
                 <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-brand-blue rounded-full flex items-center justify-center text-white shadow-xl shadow-brand-blue/50">
                       <Play fill="white" size={20} className="ml-1" />
                    </div>
                 </div>
              </div>
              
              <div className="flex-1 space-y-4 w-full text-right">
                 <div>
                    <p className="text-brand-blue text-[10px] font-black uppercase mb-1">آخر درس شاهدته</p>
                    <h3 className="text-xl font-black text-[var(--text-main)] transition-colors duration-300">{lastLesson.title}</h3>
                 </div>
 
                 <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black">
                       <span className="text-[var(--text-muted)] transition-colors duration-300">تقدم المشاهدة</span>
                       <span className="text-brand-blue">{Math.round(lastLesson.progress || 0)}%</span>
                    </div>
                    <ProgressBar progress={lastLesson.progress || 0} className="h-2 rounded-full" />
                 </div>
 
                 <button 
                   onClick={() => navigate(`/courses/${lastLesson.courseId}/learn/${lastLesson.id}`)}
                   className="bg-brand-blue hover:bg-brand-blue/80 text-white px-8 py-3 rounded-2xl font-black shadow-lg transition-all flex items-center gap-3 group/btn w-full sm:w-auto justify-center sm:justify-start"
                 >
                    استكمال الحصة
                    <ArrowRight size={18} className="group-hover:-translate-x-1 transition-transform" />
                 </button>
              </div>
            </div>
        </section>
      )}
 
      {/* 4. My Courses Section */}
      <section className="space-y-6">
         <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-3 transition-colors duration-300">
               <Award className="text-brand-blue" />
               كورساتي المشترك بها
            </h2>
            <Link to="/my-courses" className="text-sm font-black text-brand-blue hover:underline flex items-center gap-1">
               عرض الكل
               <ChevronLeft size={16} />
            </Link>
         </div>
 
         {myCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 px-4 sm:px-0">
               {myCourses.map(course => (
                  <CourseCard key={course.id} course={course} isEnrolled={true} />
               ))}
            </div>
         ) : (
            <div className="bg-[var(--bg-card)] rounded-[2.5rem] p-12 text-center border-2 border-dashed border-[var(--border-main)] mx-4 sm:mx-0 transition-colors duration-300">
               <div className="w-20 h-20 bg-black/5 dark:bg-white/5 rounded-3xl flex items-center justify-center shadow-lg mx-auto mb-6 text-[var(--text-muted)]/40 transition-colors duration-300">
                  <Star size={40} />
               </div>
               <h3 className="text-xl font-black text-[var(--text-main)] mb-2 transition-colors duration-300">لم تشترك في أي كورس بعد</h3>
               <p className="text-[var(--text-muted)] font-bold mb-8 transition-colors duration-300">ابدأ رحلتك التعليمية الآن باختيار كورس من الكتالوج</p>
               <Link to="/courses" className="btn-primary px-10 py-4 inline-flex text-white">تصفح الكورسات</Link>
            </div>
         )}
      </section>
   
      {/* 5. Recommended Section */}
      {recommendedCourses.length > 0 && (
        <section className="space-y-6">
           <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-3 transition-colors duration-300">
                 <TrendingUp className="text-brand-yellow" />
                 {profile?.level === 'general' ? 'ترشيحات لتطوير مهاراتك' : 'ترشيحات لصفّك الدراسي'}
              </h2>
           </div>
   
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 px-4 sm:px-0">
              {recommendedCourses.map(course => (
                 <CourseCard key={course.id} course={course} />
              ))}
           </div>
        </section>
      )}
    </div>
  );
};
 
const StatCard = React.memo<{ icon: React.ReactNode; value: string | number; label: string; bgColor?: string }>(({ icon, value, label, bgColor = "bg-[var(--bg-card)] border border-[var(--border-main)]" }) => (
  <div className={`${bgColor} backdrop-blur-sm rounded-2xl sm:rounded-3xl p-2.5 sm:p-5 text-right flex flex-col sm:flex-row items-center gap-1.5 sm:gap-4 transition-all hover:bg-white/5 hover:scale-[1.02] shadow-xl group transition-colors duration-300`}>
     <div className="bg-brand-blue/10 p-2 sm:p-3 rounded-xl sm:rounded-2xl group-hover:scale-110 transition-transform shrink-0">
        {icon}
     </div>
     <div className="flex flex-col items-center sm:items-start text-center sm:text-right min-w-0 w-full">
        <div className="text-sm sm:text-2xl font-black text-[var(--text-main)] transition-colors duration-300 truncate w-full">{value}</div>
        <div className="text-[8px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-0.5 transition-colors duration-300 truncate w-full">{label}</div>
     </div>
  </div>
));