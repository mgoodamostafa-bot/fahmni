import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  BookOpen,
  Clock,
  Activity,
  ArrowUpRight,
  Play,
  CheckCircle,
  Plus,
  TrendingUp,
  Award,
  MessageSquare,
  ClipboardList,
  Loader2,
  AlertTriangle,
  X,
  Wallet,
  ChevronLeft,
  DollarSign,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { AccountGuide } from '../../components/AccountGuide';
import { useSettings } from '../../contexts/SettingsContext';

interface CourseEarning {
  courseId: string;
  courseTitle: string;
  courseImage?: string;
  sales: number; // Number of purchases
  totalRevenue: number; // Price * sales
  commission: number; // Percentage
  teacherShare: number; // What teacher gets
}

export const TeacherDashboard: React.FC = () => {
  const { profile, user, isOwner } = useAuth();
  const { settings } = useSettings();
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeCourses: 0,
    totalLessons: 0,
    completionRate: 0,
    totalSubmissions: 0,
    totalEarnings: 0,
    totalRevenue: 0,
  });
  const [recentCourses, setRecentCourses] = useState<any[]>([]);
  const [recentDiscussions, setRecentDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [courseEarnings, setCourseEarnings] = useState<CourseEarning[]>([]);

  useEffect(() => {
    if (!user?.uid) return;

    const fetchAllData = async () => {
      setLoading(true);
      try {
        // 1. Get Courses (Dual Case)
        const [qUp, qLo] = await Promise.all([
          getDocs(query(collection(db, 'Courses'), where('teacherId', '==', user.uid))),
          getDocs(query(collection(db, 'courses'), where('teacherId', '==', user.uid))),
        ]);

        const allCourses = [...qUp.docs, ...qLo.docs].map((d) => ({
          id: d.id,
          ...d.data(),
          _lessonCount: 0,
          _studentCount: 0,
          _students: new Set(),
        }));

        // Deduplicate
        const courseMap = new Map();
        allCourses.forEach((c) => {
          if (!courseMap.has(c.id)) courseMap.set(c.id, c);
        });
        const uniqueCourses = Array.from(courseMap.values());
        const courseIds = uniqueCourses.map((c) => c.id);

        if (courseIds.length === 0) {
          setStats({
            activeCourses: 0,
            totalStudents: 0,
            totalLessons: 0,
            totalSubmissions: 0,
            totalEarnings: 0,
            totalRevenue: 0,
            completionRate: 0,
          });
          setLoading(false);
          return;
        }

        // 2. Aggregate Lessons & Enrollments in parallel
        let globalTotalLessonsCount = 0;
        const globalTotalStudentsSet = new Set<string>();

        const chunks = [];
        for (let i = 0; i < courseIds.length; i += 10) chunks.push(courseIds.slice(i, i + 10));

        await Promise.all(
          chunks.map(async (chunk) => {
            // Parallel fetch Lessons for this chunk
            const [lUp, lLo] = await Promise.all([
              getDocs(query(collection(db, 'Lessons'), where('courseId', 'in', chunk))),
              getDocs(query(collection(db, 'lessons'), where('courseId', 'in', chunk))),
            ]);

            const seenLessonsInChunk = new Set<string>();
            [...lUp.docs, ...lLo.docs].forEach((d) => {
              if (!seenLessonsInChunk.has(d.id)) {
                seenLessonsInChunk.add(d.id);
                globalTotalLessonsCount++;
                const course = uniqueCourses.find((c) => c.id === d.data().courseId);
                if (course) course._lessonCount++;
              }
            });

            // Parallel fetch Enrollments for this chunk
            await Promise.all(
              ['Enrollments', 'enrollments'].map(async (coll) => {
                try {
                  const snap = await getDocs(
                    query(collection(db, coll), where('courseId', 'in', chunk))
                  );
                  snap.docs.forEach((d) => {
                    const data = d.data();
                    const sid = data.userId || data.uid;
                    if (sid) {
                      globalTotalStudentsSet.add(sid);
                      const course = uniqueCourses.find((c) => c.id === data.courseId);
                      if (course) {
                        if (!course._students) course._students = new Set();
                        course._students.add(sid);
                        course._studentCount = course._students.size;
                      }
                    }
                  });
                } catch {}
              })
            );
          })
        );

        // 3. Compute real earnings from transactions collection
        let totalTeacherEarnings = 0;
        let totalPlatformRevenue = 0;
        const earningsByCourse: Record<string, CourseEarning> = {};

        try {
          const txSnap = await getDocs(
            query(collection(db, 'transactions'), where('type', 'in', ['purchase', 'activation_code']))
          );

          txSnap.docs.forEach((d) => {
            const tx = d.data();
            // Only count transactions for this teacher's courses
            const course = uniqueCourses.find((c) => c.id === tx.courseId);
            if (!course) return;

            const rawAmount = Number(tx.amount ?? tx.price ?? 0);
            const amount = Math.abs(isNaN(rawAmount) ? 0 : rawAmount);
            // Prioritize: Course-specific % > Transaction-specific % > Teacher-profile default % > 100%
            const rawCommission =
              (course as any).commissionPercentage ??
              tx.commissionPercentage ??
              profile?.defaultCommission ??
              100;
            const commission = isNaN(Number(rawCommission)) ? 100 : Number(rawCommission);

            // Use stored teacherShare if valid, otherwise calculate from amount * commission
            let share = Math.abs(Number(tx.teacherShare));
            if (isNaN(share) || share <= 0) {
              share = (amount * commission) / 100;
            }

            totalTeacherEarnings += share;
            totalPlatformRevenue += amount;

            if (!earningsByCourse[course.id]) {
              earningsByCourse[course.id] = {
                courseId: course.id,
                courseTitle: (course as any).title || tx.courseName || 'كورس',
                courseImage: (course as any).imageUrl || (course as any).thumbnailUrl,
                sales: 0,
                totalRevenue: 0,
                commission,
                teacherShare: 0,
              };
            }
            earningsByCourse[course.id].sales += 1;
            earningsByCourse[course.id].totalRevenue += amount;
            earningsByCourse[course.id].teacherShare += share;
          });
        } catch (err) {
          console.error('Earnings fetch error:', err);
        }

        const earningsList = Object.values(earningsByCourse).sort(
          (a, b) => b.teacherShare - a.teacherShare
        );
        setCourseEarnings(earningsList);

        // 4. Submissions
        const [sub1, sub2] = await Promise.all([
          getDocs(query(collection(db, 'submissions'), where('teacherId', '==', user.uid))),
          getDocs(query(collection(db, 'Submissions'), where('teacherId', '==', user.uid))),
        ]);
        const totalSubmissions = new Set([
          ...sub1.docs.map((d) => d.id),
          ...sub2.docs.map((d) => d.id),
        ]).size;

        setStats({
          activeCourses: uniqueCourses.length,
          totalLessons: globalTotalLessonsCount,
          totalStudents: globalTotalStudentsSet.size,
          totalSubmissions,
          totalEarnings: totalTeacherEarnings,
          totalRevenue: totalPlatformRevenue,
          completionRate: 0,
        });
        setRecentCourses(
          uniqueCourses
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
            .slice(0, 3)
        );
      } catch (err) {
        console.error('Dashboard calculation error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();

    const unsubDisc = onSnapshot(
      query(collection(db, 'Discussions'), limit(5), orderBy('createdAt', 'desc')),
      (s) => {
        setRecentDiscussions(
          s.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt:
              (d.data() as any).createdAt?.toDate?.()?.toISOString() || (d.data() as any).createdAt,
          }))
        );
      }
    );

    return () => unsubDisc();
  }, [user?.uid, profile?.defaultCommission]);

  if (loading && stats.activeCourses === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <Loader2 className="w-16 h-16 text-emerald-500 animate-spin" />
        <p className="text-white text-xl font-black">جاري تحديث البيانات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-16 animate-in fade-in duration-700 pb-20 overflow-x-hidden">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 px-2">
        <div className="space-y-4 text-right w-full" dir="rtl">
          <h1 className="text-4xl sm:text-6xl font-black text-white font-display tracking-tight leading-tight">
            أهلاً بك، أ. {profile?.displayName?.split(' ')?.[0] || 'المعلم'} 👋
          </h1>
          <p className="text-gray-400 font-bold flex items-center justify-end gap-3 text-lg opacity-80">
            {stats.activeCourses} كورس | {stats.totalStudents} طالب | {stats.totalLessons} حصة
            <Activity className="text-emerald-500 animate-pulse" size={20} />
          </p>
        </div>
        <Link
          to="/teacher/add-course"
          className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 shadow-emerald-600/20 !py-4 !px-10 text-xl font-black w-full md:w-auto text-center justify-center flex items-center gap-3 transition-all hover:scale-105"
        >
          <Plus size={24} /> إضافة كورس
        </Link>
      </div>

      {settings?.showTeacherGuide !== false && (
        <AccountGuide videoUrl={settings?.teacherGuideVideoUrl} role="teacher" />
      )}

      {/* Grid Stats */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isOwner ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-6 md:gap-10`} dir="rtl">
        {/* Revenue Card (Only for Platform Owner) */}
        {isOwner && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="group relative p-8 bg-blue-900/20 border border-blue-500/20 rounded-[2.5rem] hover:bg-blue-900/40 shadow-2xl transition-all duration-500 text-right overflow-hidden ring-1 ring-blue-500/10"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-[40px] -z-10 group-hover:bg-blue-500/20 transition-all" />
            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center mb-6 border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-lg">
              <DollarSign size={28} />
            </div>
            <div className="space-y-1">
              <p className="text-blue-400/70 font-black text-[10px] uppercase tracking-[0.2em]">
                إجمالي مبيعات المنصة
              </p>
              <h3 className="text-3xl md:text-4xl font-black text-blue-400 font-display tabular-nums group-hover:text-white transition-colors">
                {(stats?.totalRevenue || 0).toLocaleString('ar-EG')} <span className="text-lg">ج.م</span>
              </h3>
            </div>
          </motion.div>
        )}

        {/* Earnings Card — clickable */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => setShowEarningsModal(true)}
          className="group relative p-8 bg-emerald-900/20 border border-emerald-500/20 rounded-[2.5rem] hover:bg-emerald-900/40 shadow-2xl transition-all duration-500 text-right overflow-hidden ring-1 ring-emerald-500/10 cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-[40px] -z-10 group-hover:bg-emerald-500/20 transition-all" />
          <div className="absolute top-3 left-3 text-[9px] font-black text-emerald-500/60 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">
            اضغط للتفاصيل
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500 shadow-lg">
            <TrendingUp size={28} />
          </div>
          <div className="space-y-1">
            <p className="text-emerald-400/70 font-black text-[10px] uppercase tracking-[0.2em]">
              رصيد أرباحي
            </p>
            <h3 className="text-3xl md:text-4xl font-black text-emerald-400 font-display tabular-nums group-hover:text-white transition-colors">
              {(stats?.totalEarnings || 0).toLocaleString('ar-EG')} <span className="text-lg">ج.م</span>
            </h3>
          </div>
        </motion.div>

        {/* Other Stats */}
        {[
          { label: 'إجمالي الطلاب', value: stats.totalStudents, icon: <Users />, delay: 0 },
          { label: 'إجمالي الدروس', value: stats.totalLessons, icon: <Play />, delay: 0.2 },
          {
            label: 'تسلّمات الواجبات',
            value: stats.totalSubmissions,
            icon: <ClipboardList />,
            delay: 0.3,
          },
        ].map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: card.delay }}
            className="group relative p-8 bg-white/5 border border-white/10 rounded-[2.5rem] hover:bg-white/10 shadow-2xl transition-all duration-500 text-right overflow-hidden ring-1 ring-white/5"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 blur-[40px] -z-10 group-hover:bg-emerald-500/10 transition-all" />
            <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 text-emerald-500 flex items-center justify-center mb-6 border border-emerald-500/10 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500 shadow-lg shadow-emerald-500/10">
              {React.cloneElement(card.icon as React.ReactElement, { size: 28 } as any)}
            </div>
            <div className="space-y-1">
              <p className="text-gray-500 font-black text-[10px] uppercase tracking-[0.2em]">
                {card.label}
              </p>
              <h3 className="text-3xl md:text-4xl font-black text-white font-display tabular-nums group-hover:text-emerald-500 transition-colors">
                {card.value}
              </h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Course List */}
      <div className="grid lg:grid-cols-12 gap-12 text-right" dir="rtl">
        <div className="lg:col-span-8 space-y-10">
          <h2 className="text-3xl font-black font-display tracking-tight flex items-center gap-4 px-4">
            <span className="w-2.5 h-10 bg-emerald-600 rounded-full" />
            أحدث الكورسات
          </h2>
          <div className="grid gap-6">
            {recentCourses.length === 0 ? (
              <div className="glass-card p-20 text-center border-dashed border-2 border-white/10 bg-transparent rounded-[3rem]">
                <p className="text-gray-500 font-bold text-xl font-display">
                  ابدأ برحلتك التعليمية وأضف كورس الآن!
                </p>
              </div>
            ) : (
              recentCourses.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group flex flex-col sm:flex-row items-center gap-6 p-6 bg-white/5 border border-white/10 rounded-[2.5rem] hover:bg-white/8 transition-all duration-500 relative overflow-hidden"
                >
                  <div className="w-full sm:w-40 h-28 rounded-2xl overflow-hidden shadow-2xl shrink-0">
                    <img
                      src={
                        c.imageUrl ||
                        c.thumbnailUrl ||
                        (c.videoUrl
                          ? `https://img.youtube.com/vi/${c.videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1]}/maxresdefault.jpg`
                          : 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500')
                      }
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      alt=""
                    />
                  </div>
                  <div className="flex-1 space-y-3 text-center sm:text-right">
                    <h4 className="text-xl font-black text-white group-hover:text-emerald-500 transition-colors">
                      {c.title}
                    </h4>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-xs font-bold text-gray-500">
                      <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl">
                        <Users size={14} className="text-emerald-500" />{' '}
                        {c._studentCount || c.enrolledCount || 0} طالب
                      </span>
                      <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl">
                        <Play size={14} className="text-emerald-500" />{' '}
                        {c._lessonCount || c.lessonCount || 0} درس
                      </span>
                      <span className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                        <TrendingUp size={14} /> عمولتي: {c.commissionPercentage ?? 100}%
                      </span>
                      {courseEarnings.find((e) => e.courseId === c.id) && (
                        <span className="flex items-center gap-2 bg-brand-blue/10 text-brand-blue px-3 py-1.5 rounded-xl border border-brand-blue/20">
                          <DollarSign size={14} /> أرباح:{' '}
                          {courseEarnings
                            .find((e) => e.courseId === c.id)
                            ?.teacherShare?.toLocaleString('ar-EG') || '0'}{' '}
                          ج.م
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    to={`/teacher/courses/${c.id}/lessons`}
                    className="p-4 bg-emerald-600/10 text-emerald-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-600 hover:text-white shrink-0"
                  >
                    <ArrowUpRight size={24} />
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-10">
          <h2 className="text-3xl font-black font-display tracking-tight flex items-center gap-4 px-4">
            <span className="w-2.5 h-10 bg-brand-blue rounded-full" />
            المناقشات
          </h2>
          <div className="glass-card p-10 space-y-8 border-none bg-white/5 shadow-2xl rounded-[3rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/10 blur-[60px] -z-10" />
            {recentDiscussions.length === 0 ? (
              <p className="text-gray-500 font-bold text-center">لا توجد رسائل جديدة.</p>
            ) : (
              recentDiscussions.map((disc) => (
                <div
                  key={disc.id}
                  className="flex gap-4 items-start border-b border-white/5 pb-6 last:border-0 last:pb-0 hover:translate-x-[-5px] transition-transform group/disc"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0 group-hover/disc:bg-brand-blue group-hover/disc:text-white transition-all">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white mb-1">{disc.userName}</p>
                    <p className="text-[10px] text-gray-500 font-bold line-clamp-2 leading-relaxed">
                      {disc.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── Earnings Details Modal ─── */}
      <AnimatePresence>
        {showEarningsModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEarningsModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#0a1220] border border-emerald-500/20 w-full max-w-lg p-8 rounded-[2.5rem] shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setShowEarningsModal(false)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
                <div className="text-right">
                  <h3 className="text-2xl font-black text-white flex items-center gap-3 justify-end">
                    <TrendingUp className="text-emerald-400" size={24} />
                    تفاصيل أرباحك
                  </h3>
                  <p className="text-slate-400 text-sm font-bold">
                    إجمالي:{' '}
                    <span className="text-emerald-400 font-black">
                      {(stats?.totalEarnings || 0).toLocaleString('ar-EG')} ج.م
                    </span>
                  </p>
                </div>
              </div>

              {/* Course breakdown */}
              <div className="overflow-y-auto flex-1 space-y-3 custom-scrollbar pl-1">
                {courseEarnings.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Wallet size={32} className="text-emerald-500/50" />
                    </div>
                    <p className="text-slate-500 font-bold">لا توجد مبيعات مسجلة حتى الآن</p>
                    <p className="text-slate-600 text-xs font-bold mt-1">
                      عند بيع أول كورس ستظهر أرباحك هنا
                    </p>
                  </div>
                ) : (
                  courseEarnings.map((e, i) => (
                    <motion.div
                      key={e.courseId}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-white/5 border border-white/10 hover:border-emerald-500/30 p-5 rounded-2xl transition-all"
                    >
                      <div className="flex items-center gap-4">
                        {e.courseImage && (
                          <img
                            src={e.courseImage}
                            className="w-14 h-14 rounded-xl object-cover shrink-0"
                            alt=""
                          />
                        )}
                        <div className="flex-1 text-right">
                          <p className="text-white font-black text-sm line-clamp-1">
                            {e.courseTitle}
                          </p>
                          <div className="flex items-center justify-end gap-3 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-500 font-bold">
                              {e.sales} مبيعة
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">|</span>
                            <span className="text-[10px] text-slate-500 font-bold">
                              إيراد: {(e?.totalRevenue || 0).toLocaleString('ar-EG')} ج
                            </span>
                            <span className="text-[10px] bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full border border-brand-blue/20 font-black">
                              {e.commission}%
                            </span>
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <p className="text-emerald-400 font-black text-xl tabular-nums">
                            {(e?.teacherShare || 0).toLocaleString('ar-EG')}
                          </p>
                          <p className="text-[10px] text-slate-500 font-bold">ج.م</p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Footer summary */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
                  <span className="text-emerald-400 font-black text-2xl tabular-nums">
                    {(stats?.totalEarnings || 0).toLocaleString('ar-EG')} ج.م
                  </span>
                  <span className="text-emerald-400/70 text-sm font-black">إجمالي الأرباح</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
