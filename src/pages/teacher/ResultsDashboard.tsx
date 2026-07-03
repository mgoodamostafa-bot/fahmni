import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Search,
  BarChart2,
  Users,
  Trophy,
  Loader,
  ChevronLeft,
  BookOpen,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Send,
} from 'lucide-react';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

interface StudentResult {
  id: string;
  studentName: string;
  examTitle: string;
  courseId?: string;
  subject: string;
  grade: string;
  percentage: number;
  level: string;
  timeTaken: number;
  totalQuestions: number;
  totalCorrect: number;
  submittedAt: any;
  timestamp?: any;
  userId?: string;
}

interface CourseCard {
  id: string;
  title: string;
  imageUrl?: string;
  subject?: string;
  examCount: number;
  avgScore: number;
  studentCount: number;
}

const parseDate = (val: any) => {
  if (!val) return new Date(0);
  if (typeof val === 'object' && val.seconds) return new Date(val.seconds * 1000);
  if (val?.toDate) return val.toDate();
  return new Date(val);
};

const gradeColor = (pct: number) => {
  if (pct >= 85)
    return {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      bar: 'bg-emerald-500',
      label: 'متفوق',
    };
  if (pct >= 50)
    return { bg: 'bg-amber-500/10', text: 'text-amber-400', bar: 'bg-amber-500', label: 'مقبول' };
  return { bg: 'bg-red-500/10', text: 'text-red-400', bar: 'bg-red-500', label: 'ضعيف' };
};

export const ResultsDashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const { sendNotification } = useNotifications();
  const [allResults, setAllResults] = useState<StudentResult[]>([]);
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalEnrolledStudents, setTotalEnrolledStudents] = useState(0);
  const [search, setSearch] = useState('');

  // -- Messaging State --
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<StudentResult | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const handleSendMessage = async () => {
    if (!selectedResult || !messageText) return;
    setSendingMessage(true);
    try {
      await sendNotification({
        title: 'تهنئة خاصة! 🎉',
        message: messageText,
        type: 'success',
        userId: selectedResult.userId, // Ensure Result object has userId
        senderName: profile?.displayName || 'معلمك',
      });
      setShowMessageModal(false);
      setMessageText('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    if (!profile?.uid && !user?.uid) return;
    const uid = profile?.uid || user?.uid!;
    setLoading(true);

    const fetchAll = async () => {
      try {
        // 1) Get teacher's courses
        const [cUp, cLo] = await Promise.all([
          getDocs(query(collection(db, 'Courses'), where('teacherId', '==', uid))),
          getDocs(query(collection(db, 'courses'), where('teacherId', '==', uid))),
        ]);
        const courseMap = new Map<string, any>();
        [...cUp.docs, ...cLo.docs].forEach((d) => {
          if (!courseMap.has(d.id)) courseMap.set(d.id, { id: d.id, ...d.data() });
        });
        const teacherCourses = Array.from(courseMap.values());

        // 2) Get all results for this teacher
        const [r1, r2] = await Promise.all([
          getDocs(query(collection(db, 'results'), where('teacherId', '==', uid))),
          getDocs(query(collection(db, 'Results'), where('teacherId', '==', uid))),
        ]);
        const resMap = new Map<string, StudentResult>();
        [...r1.docs, ...r2.docs].forEach((d) => {
          const data = d.data() as StudentResult;
          // Security/Consistency: Only include results that belong to one of the teacher's courses
          // Ensure we don't match on undefined/empty fields & handle case-insensitivity
          const isRelated = teacherCourses.some((c) => {
            const courseIdMatch = data.courseId && c.id === data.courseId;
            const subjectMatch =
              data.subject &&
              c.subject &&
              c.subject.trim().toLowerCase() === data.subject.trim().toLowerCase();
            const titleMatch =
              data.subject &&
              c.title &&
              c.title.trim().toLowerCase() === data.subject.trim().toLowerCase();
            return courseIdMatch || subjectMatch || titleMatch;
          });

          if (isRelated) {
            resMap.set(d.id, { id: d.id, ...data });
          }
        });
        const results = Array.from(resMap.values()).sort(
          (a, b) =>
            parseDate(b.submittedAt || b.timestamp).getTime() -
            parseDate(a.submittedAt || a.timestamp).getTime()
        );
        setAllResults(results);

        // 3) Calculate Real Unique Student Count (from Enrollments)
        const courseIdsList = Array.from(courseMap.keys());
        const enrolledStudentsSet = new Set<string>();
        if (courseIdsList.length > 0) {
          const chunks = [];
          for (let i = 0; i < courseIdsList.length; i += 10)
            chunks.push(courseIdsList.slice(i, i + 10));

          await Promise.all(
            ['Enrollments', 'enrollments'].map(async (collName) => {
              try {
                await Promise.all(
                  chunks.map(async (chunk) => {
                    const eSnap = await getDocs(
                      query(collection(db, collName), where('courseId', 'in', chunk))
                    );
                    eSnap.docs.forEach((ed) => {
                      const sId = ed.data().userId || ed.data().uid;
                      if (sId) enrolledStudentsSet.add(sId);
                    });
                  })
                );
              } catch (err) {
                console.error(`Enrollment fetch error context (${collName}):`, err);
              }
            })
          );
        }
        setTotalEnrolledStudents(enrolledStudentsSet.size);

        // 4) Build course cards with exam stats
        const builtCourses: CourseCard[] = teacherCourses.map((c) => {
          const cResults = results.filter((r) => {
            const courseIdMatch = r.courseId && c.id === r.courseId;
            const subjectMatch =
              r.subject &&
              c.subject &&
              c.subject.trim().toLowerCase() === r.subject.trim().toLowerCase();
            const titleMatch =
              r.subject &&
              c.title &&
              c.title.trim().toLowerCase() === r.subject.trim().toLowerCase();
            return courseIdMatch || subjectMatch || titleMatch;
          });
          const avg = cResults.length
            ? Math.round(cResults.reduce((acc, r) => acc + r.percentage, 0) / cResults.length)
            : 0;
          const students = new Set(cResults.map((r) => r.studentName)).size;
          return {
            id: c.id,
            title: c.title,
            imageUrl: c.imageUrl || c.thumbnailUrl,
            subject: c.subject,
            examCount: cResults.length,
            avgScore: avg,
            studentCount: students,
          };
        });

        // Sort by exam count descending
        builtCourses.sort((a, b) => b.examCount - a.examCount);
        setCourses(builtCourses);
      } catch (err) {
        console.error('Results fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [profile?.uid, user?.uid]);

  const courseResults = selectedCourse
    ? allResults.filter(
        (r) =>
          r.courseId === selectedCourse.id ||
          r.subject === selectedCourse.subject ||
          r.subject === selectedCourse.title
      )
    : [];

  const filteredResults = courseResults.filter(
    (r) =>
      !search ||
      r.studentName?.toLowerCase().includes(search.toLowerCase()) ||
      r.examTitle?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Global stats
  const totalStudents = new Set(allResults.map((r) => r.studentName)).size;
  const avgAll = allResults.length
    ? Math.round(allResults.reduce((a, r) => a + r.percentage, 0) / allResults.length)
    : 0;

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader className="animate-spin text-brand-blue" size={40} />
        <p className="text-gray-500 font-bold">جاري تحميل النتائج...</p>
      </div>
    );

  return (
    <div className="space-y-8 pb-20" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          {selectedCourse ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedCourse(null);
                  setSearch('');
                }}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
              >
                <ChevronLeft size={20} className="rotate-180" />
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white">
                  نتائج: <span className="text-brand-blue">{selectedCourse.title}</span>
                </h1>
                <p className="text-gray-500 font-bold text-sm">
                  {filteredResults.length} محاولة امتحان
                </p>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-black text-white">
                لوحة <span className="text-brand-blue">النتائج</span>
              </h1>
              <p className="text-gray-500 font-bold">اختر كورساً لعرض نتائج امتحاناته</p>
            </>
          )}
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'إجمالي الطلاب',
            value: totalEnrolledStudents,
            icon: <Users size={22} className="text-brand-blue" />,
          },
          {
            label: 'محاولات الامتحانات',
            value: allResults.length,
            icon: <BarChart2 size={22} className="text-purple-400" />,
          },
          {
            label: 'متوسط الدرجات',
            value: `${avgAll}%`,
            icon: <Trophy size={22} className="text-amber-400" />,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white/5 border border-white/10 p-5 rounded-[2rem] space-y-2 text-center"
          >
            <div className="flex justify-center">{s.icon}</div>
            <p className="text-2xl font-black text-white">{s.value}</p>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ════════════════════════════════════════════
            VIEW 1 — Course Cards Grid
        ════════════════════════════════════════════ */}
        {!selectedCourse && (
          <motion.div
            key="courses"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {courses.length === 0 ? (
              <div className="col-span-full py-24 text-center border-2 border-dashed border-white/10 rounded-[3rem]">
                <BookOpen size={48} className="mx-auto text-slate-700 mb-4" />
                <p className="text-slate-500 font-bold text-xl">لا توجد كورسات مسجلة</p>
              </div>
            ) : (
              courses.map((c, i) => (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => setSelectedCourse(c)}
                  className="group text-right bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden hover:border-brand-blue/40 hover:bg-white/8 transition-all duration-400 shadow-xl relative"
                >
                  {/* Thumbnail */}
                  <div className="w-full h-44 overflow-hidden relative">
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-brand-blue/20 to-purple-600/20 flex items-center justify-center">
                        <BookOpen size={40} className="text-brand-blue/40" />
                      </div>
                    )}
                    {/* Exam count badge */}
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black px-3 py-1.5 rounded-xl border border-white/10">
                      {c.examCount} محاولة
                    </div>
                    {c.subject && (
                      <div className="absolute top-3 right-3 bg-brand-blue/80 text-white text-[10px] font-black px-3 py-1.5 rounded-xl">
                        {c.subject}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-6">
                    <h3 className="text-lg font-black text-white group-hover:text-brand-blue transition-colors mb-4 line-clamp-1">
                      {c.title}
                    </h3>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white/5 rounded-2xl p-2">
                        <p className="text-brand-blue font-black text-lg">{c.examCount}</p>
                        <p className="text-[9px] text-slate-500 font-black uppercase">محاولة</p>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-2">
                        <p className="text-purple-400 font-black text-lg">{c.studentCount}</p>
                        <p className="text-[9px] text-slate-500 font-black uppercase">طالب</p>
                      </div>
                      <div className={`rounded-2xl p-2 ${gradeColor(c.avgScore).bg}`}>
                        <p className={`font-black text-lg ${gradeColor(c.avgScore).text}`}>
                          {c.avgScore}%
                        </p>
                        <p className="text-[9px] text-slate-500 font-black uppercase">متوسط</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-brand-blue text-xs font-black group-hover:gap-3 transition-all opacity-60 group-hover:opacity-100">
                      <span>عرض النتائج</span>
                      <ArrowUpRight size={16} />
                    </div>
                  </div>
                </motion.button>
              ))
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════════
            VIEW 2 — Exam Results for selected course
        ════════════════════════════════════════════ */}
        {selectedCourse && (
          <motion.div
            key="results"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="space-y-6"
          >
            {/* Search */}
            <div className="relative">
              <Search
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                size={18}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="البحث باسم الطالب أو الامتحان..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pr-12 pl-4 text-white font-bold focus:outline-none focus:border-brand-blue/50 transition-all placeholder-slate-600"
              />
            </div>

            {/* Results */}
            {filteredResults.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-white/10 rounded-[3rem]">
                <ClipboardList size={48} className="mx-auto text-slate-700 mb-4" />
                <p className="text-slate-500 font-bold text-xl">
                  لا توجد نتائج لهذا الكورس حتى الآن
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredResults.map((r, i) => {
                  const g = gradeColor(r.percentage);
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="bg-white/5 border border-white/10 hover:border-white/20 rounded-[2rem] p-5 transition-all"
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* Avatar */}
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-blue/30 to-purple-600/30 flex items-center justify-center text-white font-black text-lg shrink-0">
                          {r.studentName?.charAt(0)}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-black text-sm">{r.studentName}</p>
                          <p className="text-slate-500 text-[11px] font-bold line-clamp-1">
                            {r.examTitle}
                          </p>
                        </div>
                        {/* Score bar */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${g.bar}`}
                              style={{ width: `${r.percentage}%` }}
                            />
                          </div>
                          <span className={`text-sm font-black ${g.text}`}>{r.percentage}%</span>
                          <span
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-black ${g.bg} ${g.text}`}
                          >
                            {r.level || g.label}
                          </span>
                        </div>
                        {/* Message Action */}
                        <button
                          onClick={() => {
                            setSelectedResult(r);
                            setMessageText(`بطل! مبروك لتقفيل امتحان ${r.examTitle} 🌟`);
                            setShowMessageModal(true);
                          }}
                          className="p-2.5 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white rounded-xl transition-all shrink-0"
                          title="إرسال رسالة تشجيع"
                        >
                          <MessageSquare size={18} />
                        </button>
                        {/* Date */}
                        <p className="text-slate-600 text-[10px] font-black shrink-0">
                          {parseDate(r.submittedAt || r.timestamp).toLocaleDateString('ar-EG', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Message Student Modal ── */}
      <AnimatePresence>
        {showMessageModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMessageModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#0a1220] border border-brand-blue/20 w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-6 text-right">
                <div className="w-12 h-12 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">إرسال رسالة تشجيع</h3>
                  <p className="text-slate-500 text-xs font-bold">
                    إلى: {selectedResult?.studentName}
                  </p>
                </div>
              </div>

              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm font-bold h-32 outline-none focus:border-brand-blue/50 transition-all resize-none"
              />

              <div className="flex gap-3 mt-6">
                <button
                  disabled={sendingMessage}
                  onClick={handleSendMessage}
                  className="flex-1 bg-brand-blue text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/20 disabled:opacity-50"
                >
                  {sendingMessage ? (
                    <Loader className="animate-spin" size={20} />
                  ) : (
                    <Send size={20} />
                  )}
                  إرسال الآن
                </button>
                <button
                  onClick={() => setShowMessageModal(false)}
                  className="px-6 bg-white/5 text-slate-400 py-4 rounded-xl font-black hover:bg-white/10 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
