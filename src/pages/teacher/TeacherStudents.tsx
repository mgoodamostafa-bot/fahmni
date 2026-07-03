import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Search, Mail, BookOpen, Calendar, CheckCircle, Clock, Loader2, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

interface StudentData {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  studentEmail: string;
  createdAt: any;
  status: string;
  allowedViews?: number;
}

export const TeacherStudents: React.FC = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchStudents = async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      // 1. Fetch teacher's courses (Dual Case)
      const [qUp, qLo] = await Promise.all([
        getDocs(query(collection(db, 'Courses'), where('teacherId', '==', profile.uid))),
        getDocs(query(collection(db, 'courses'), where('teacherId', '==', profile.uid))),
      ]);

      const courseMap = new Map();
      [...qUp.docs, ...qLo.docs].forEach((doc) => {
        courseMap.set(doc.id.toLowerCase(), { id: doc.id, title: doc.data().title });
      });

      const courseIds = Array.from(courseMap.values()).map((c) => c.id);
      if (courseIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // 2. Fetch Enrollments (Deep Scan / Multi-collection)
      const enrollmentColls = ['Enrollments', 'enrollments'];
      const allEnrollments: StudentData[] = [];
      const userCache = new Map();

      // Chunk IDs to avoid Firestore IN limits
      for (let i = 0; i < courseIds.length; i += 10) {
        const chunk = courseIds.slice(i, i + 10);

        for (const coll of enrollmentColls) {
          const fields = ['courseId', 'CourseId']; // Try both casings
          for (const field of fields) {
            const snap = await getDocs(query(collection(db, coll), where(field, 'in', chunk)));

            for (const enrollDoc of snap.docs) {
              const data = enrollDoc.data();
              const userId = data.userId || data.uid || enrollDoc.id.split('_')[0];
              if (!userId) continue;

              // Avoid duplicates per student-course pairing
              const pairKey = `${userId}_${data.courseId || data.CourseId}`.toLowerCase();
              if (allEnrollments.some((e) => `${e.userId}_${e.courseId}`.toLowerCase() === pairKey))
                continue;

              let studentInfo = userCache.get(userId);
              if (!studentInfo) {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                  studentInfo = {
                    name: userDoc.data().displayName || 'طالب غامض',
                    email: userDoc.data().email || '',
                  };
                  userCache.set(userId, studentInfo);
                }
              }

              const courseRef = courseMap.get((data.courseId || data.CourseId || '').toLowerCase());

              allEnrollments.push({
                id: enrollDoc.id,
                userId: userId,
                courseId: data.courseId || data.CourseId,
                courseTitle: courseRef?.title || 'كورس غير معروف',
                studentName: studentInfo?.name || 'طالب غامض',
                studentEmail: studentInfo?.email || '',
                createdAt: data.createdAt,
                status: data.status || 'active',
                allowedViews: data.allowedViews || 5,
              });
            }
          }
        }
      }

      setStudents(
        allEnrollments.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      );
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [profile?.uid]);

  const updateAllowedViews = async (enrollmentId: string, value: string) => {
    try {
      const num = parseInt(value);
      if (isNaN(num)) return;
      // Try both collection names for update
      await Promise.all([
        updateDoc(doc(db, 'Enrollments', enrollmentId), { allowedViews: num }).catch(() => {}),
        updateDoc(doc(db, 'enrollments', enrollmentId), { allowedViews: num }).catch(() => {}),
      ]);
      setStudents((prev) =>
        prev.map((s) => (s.id === enrollmentId ? { ...s, allowedViews: num } : s))
      );
    } catch (err) {
      console.error('Error updating allowedViews:', err);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.courseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
        <p className="text-white/40 font-black text-xs uppercase tracking-widest">
          جاري سحب كشوف الحسابات...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl font-black text-white font-display tracking-tight leading-tight">
            طلاب المشتركين
          </h1>
          <p className="text-gray-500 font-bold flex items-center gap-3 text-lg opacity-80">
            <Users size={20} className="text-emerald-500" />
            إجمالي {students.length} طالب مسجل في مساحتك التعليمية.
          </p>
        </div>

        <div className="relative w-full md:w-96 group">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors"
            size={20}
          />
          <input
            type="text"
            placeholder="ابحث عن اسم طالب أو اسم كورس..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-bold text-white placeholder:text-gray-600"
          />
        </div>
      </div>

      <div className="grid gap-6">
        <AnimatePresence mode="popLayout">
          {filteredStudents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-20 text-center border-dashed border-2 border-white/10 bg-transparent rounded-[3rem]"
            >
              <div className="w-24 h-24 bg-emerald-600/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
                <Users className="w-12 h-12 text-emerald-500" />
              </div>
              <h3 className="text-3xl font-black text-white mb-4">لا يوجد طلاب مسجلون حالياً</h3>
              <p className="text-gray-500 font-bold text-lg">
                بمجرد اشتراك الطلاب في كورساتك ستظهر بياناتهم هنا تلقائياً.
              </p>
            </motion.div>
          ) : (
            filteredStudents.map((student, i) => (
              <motion.div
                layout
                key={student.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group flex flex-col md:flex-row md:items-center gap-8 p-8 bg-white/5 border border-white/10 rounded-[2.5rem] hover:bg-white/10 hover:border-emerald-500/20 transition-all duration-500 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-600/5 blur-[100px] -z-10 group-hover:bg-emerald-600/10 transition-all" />

                <Link to={`/teacher/students/${student.userId}`} className="flex items-center gap-6 min-w-[320px] group/link cursor-pointer hover:bg-white/5 p-2 rounded-2xl transition-all">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-700/20 flex items-center justify-center text-emerald-500 border border-emerald-500/10 shrink-0 group-hover/link:scale-110 transition-transform duration-500 shadow-2xl relative">
                    {student.studentName.charAt(0)}
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover/link:opacity-100 transition-opacity">
                      <ArrowUpRight size={14} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-2xl font-black text-white group-hover/link:text-emerald-500 transition-colors uppercase tracking-tight flex items-center gap-2">
                      {student.studentName}
                    </h4>
                    <p className="text-sm text-gray-500 font-bold flex items-center gap-2">
                      <Mail size={14} className="opacity-50 text-emerald-500" />
                      {student.studentEmail}
                    </p>
                  </div>
                </Link>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:pr-10 border-r border-white/5">
                  <div className="space-y-2 pr-4">
                    <span className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em]">
                      الكورس المسجل
                    </span>
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <BookOpen size={18} className="text-emerald-500" />
                      <span className="truncate max-w-[180px]">{student.courseTitle}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pr-4">
                    <span className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em]">
                      تاريخ الانضمام
                    </span>
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <Calendar size={18} className="text-emerald-500" />
                      <span>
                        {student.createdAt?.seconds
                          ? new Date(student.createdAt.seconds * 1000).toLocaleDateString('ar-EG', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : '---'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 pr-4">
                    <span className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.2em]">
                      المشاهدات
                    </span>
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 border border-white/10 group-hover:border-emerald-500/30 transition-colors w-fit">
                      <input
                        type="number"
                        defaultValue={student.allowedViews || 5}
                        onBlur={(e) => updateAllowedViews(student.id, e.target.value)}
                        className="bg-transparent text-white font-black w-10 outline-none text-center tabular-nums"
                      />
                      <span className="text-[9px] text-gray-500 font-black uppercase">مرة</span>
                    </div>
                  </div>

                  <div className="space-y-1 flex flex-col justify-center items-end">
                    <div
                      className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl ${
                        student.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-500 shadow-emerald-500/5'
                          : student.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {student.status === 'active' ? (
                        <CheckCircle size={14} />
                      ) : (
                        <Clock size={14} />
                      )}
                      {student.status === 'active'
                        ? 'حساب مفعل'
                        : student.status === 'pending'
                          ? 'قيد المراجعة'
                          : 'موقوف'}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
