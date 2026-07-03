import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { getTenantDb } from '../lib/firebase';
import { useTenant } from '../contexts/TenantContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  BookOpen,
  GraduationCap,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Award,
  Wallet,
  LogOut,
  Phone,
  ShieldCheck,
  Loader2,
  FileSpreadsheet,
  ChevronLeft
} from 'lucide-react';

interface StudentData {
  uid: string;
  displayName: string;
  studentId: string;
  grade: string;
  level: string;
  fatherPhone?: string;
  motherPhone?: string;
  studentPhone?: string;
  walletBalance?: number;
  balance?: number;
}

interface Enrollment {
  courseId: string;
  courseTitle: string;
  createdAt: any;
}

interface ExamResult {
  id: string;
  title: string;
  score: number;
  totalQuestions: number;
  createdAt: any;
  type: 'online' | 'offline';
}

interface HomeworkSubmission {
  id: string;
  lessonTitle: string;
  status: 'pending' | 'approved' | 'rejected';
  grade: number;
  feedback: string;
  createdAt: any;
}

export const ParentPortal: React.FC = () => {
  const { tenantData } = useTenant();
  const [parentPhone, setParentPhone] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Authenticated student state
  const [student, setStudent] = useState<StudentData | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Load from sessionStorage if already logged in
  useEffect(() => {
    const cachedStudent = sessionStorage.getItem('parent_portal_student');
    if (cachedStudent) {
      const parsed = JSON.parse(cachedStudent);
      setStudent(parsed);
      loadStudentDetails(parsed.uid);
    }
  }, []);

  const cleanPhone = (p: string) => {
    return p.replace(/[\s-+]/g, '').replace(/^0+/, '');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentPhone.trim() || !studentId.trim()) {
      setAuthError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      // Query the student by studentId
      const q = query(
        collection(getTenantDb(), 'users'),
        where('studentId', '==', studentId.trim())
      );
      
      const snap = await getDocs(q);
      if (snap.empty) {
        setAuthError('كود الطالب غير صحيح أو غير مسجل بالمنصة');
        setLoading(false);
        return;
      }

      const studentDoc = snap.docs[0];
      const studentData = { uid: studentDoc.id, ...studentDoc.data() } as StudentData;

      const fPhone = studentData.fatherPhone || '';
      const mPhone = studentData.motherPhone || '';
      const sPhone = studentData.studentPhone || '';
      
      const inputPhoneCleaned = cleanPhone(parentPhone);

      const isMatch = (fPhone && cleanPhone(fPhone) === inputPhoneCleaned) ||
                      (mPhone && cleanPhone(mPhone) === inputPhoneCleaned) ||
                      (sPhone && cleanPhone(sPhone) === inputPhoneCleaned);

      if (!isMatch) {
        setAuthError('رقم الهاتف المدخل غير مطابق لبيانات ولي الأمر المسجلة لهذا الطالب');
        setLoading(false);
        return;
      }

      // Successful Auth
      setStudent(studentData);
      sessionStorage.setItem('parent_portal_student', JSON.stringify(studentData));
      
      // Load all detailed stats
      await loadStudentDetails(studentData.uid);
    } catch (err: any) {
      console.error('Parent Login Error:', err);
      setAuthError('حدث خطأ غير متوقع أثناء عملية التحقق');
    } finally {
      setLoading(false);
    }
  };

  const loadStudentDetails = async (studentUid: string) => {
    setLoadingData(true);
    try {
      // 1. Fetch Enrollments
      const enrollmentsQuery = query(
        collection(getTenantDb(), 'Enrollments'),
        where('userId', '==', studentUid)
      );
      const enrollmentsSnap = await getDocs(enrollmentsQuery);
      const enrollmentDocs = enrollmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Resolve course titles
      const resolvedEnrollments = await Promise.all(
        enrollmentDocs.map(async (en: any) => {
          try {
            const cDoc = await getDoc(doc(getTenantDb(), 'Courses', en.courseId));
            if (cDoc.exists()) {
              return { courseId: en.courseId, courseTitle: cDoc.data().title, createdAt: en.createdAt };
            }
            const cDocLower = await getDoc(doc(getTenantDb(), 'courses', en.courseId));
            return {
              courseId: en.courseId,
              courseTitle: cDocLower.exists() ? cDocLower.data().title : 'كورس محذوف',
              createdAt: en.createdAt
            };
          } catch {
            return { courseId: en.courseId, courseTitle: 'كورس غير معروف', createdAt: en.createdAt };
          }
        })
      );
      setEnrollments(resolvedEnrollments);

      // 2. Fetch Online Quiz results
      const resultsQuery = query(
        collection(getTenantDb(), 'results'),
        where('userId', '==', studentUid)
      );
      const resultsSnap = await getDocs(resultsQuery);
      const examResults = await Promise.all(resultsSnap.docs.map(async (d) => {
        const data = d.data();
        let quizTitle = data.examTitle || data.title || 'امتحان غير معروف';
        
        if (quizTitle === 'امتحان غير معروف') {
          try {
            const examId = data.examId || data.quizId || '';
            if (examId) {
              const qDoc = await getDoc(doc(getTenantDb(), 'exams', examId));
              if (qDoc.exists()) {
                quizTitle = qDoc.data().title;
              }
            }
          } catch {}
        }

        const score = data.totalCorrect !== undefined ? data.totalCorrect : (data.score || 0);
        const totalQuestions = data.totalCorrect !== undefined ? (data.totalQuestions || 0) : (data.score !== undefined ? 100 : 0);

        return {
          id: d.id,
          title: quizTitle,
          score,
          totalQuestions,
          createdAt: data.createdAt || data.timestamp || null,
          type: 'online'
        } as ExamResult;
      }));

      // 3. Fetch Offline Exam results
      const offlineQuery = query(
        collection(getTenantDb(), 'offline_results'),
        where('studentId', '==', studentUid)
      );
      const offlineSnap = await getDocs(offlineQuery);
      const offlineResults = offlineSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.examTitle || 'امتحان ورقي',
          score: data.score || 0,
          totalQuestions: data.totalQuestions || 100,
          createdAt: data.createdAt || null,
          type: 'offline'
        } as ExamResult;
      });

      // Combine all exam results and sort by time
      const allResults = [...examResults, ...offlineResults].sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || a.createdAt?.seconds * 1000 || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || b.createdAt?.seconds * 1000 || 0;
        return timeB - timeA;
      });
      setResults(allResults);

      // 4. Fetch Homework Submissions
      const submissionsQuery = query(
        collection(getTenantDb(), 'submissions'),
        where('userId', '==', studentUid)
      );
      const submissionsSnap = await getDocs(submissionsQuery);
      const resolvedSubmissions = await Promise.all(submissionsSnap.docs.map(async (d) => {
        const data = d.data();
        let lessonTitle = 'درس غير معروف';
        try {
          const lDoc = await getDoc(doc(getTenantDb(), 'lessons', data.lessonId || ''));
          if (lDoc.exists()) lessonTitle = lDoc.data().title;
          else {
            const lDocUpper = await getDoc(doc(getTenantDb(), 'Lessons', data.lessonId || ''));
            if (lDocUpper.exists()) lessonTitle = lDocUpper.data().title;
          }
        } catch {}
        return {
          id: d.id,
          lessonTitle,
          status: data.status || 'pending',
          grade: data.grade || 0,
          feedback: data.feedback || '',
          createdAt: data.createdAt || null
        } as HomeworkSubmission;
      }));
      setSubmissions(resolvedSubmissions.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || a.createdAt?.seconds * 1000 || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || b.createdAt?.seconds * 1000 || 0;
        return timeB - timeA;
      }));

    } catch (err) {
      console.error('Error fetching student stats details:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogout = () => {
    setStudent(null);
    setParentPhone('');
    setStudentId('');
    setEnrollments([]);
    setResults([]);
    setSubmissions([]);
    sessionStorage.removeItem('parent_portal_student');
  };

  const translateGrade = (g: string) => {
    const map: Record<string, string> = {
      'primary-4': 'الصف الرابع الابتدائي',
      'primary-5': 'الصف الخامس الابتدائي',
      'primary-6': 'الصف السادس الابتدائي',
      'prep-1': 'الصف الأول الإعدادي',
      'prep-2': 'الصف الثاني الإعدادي',
      'prep-3': 'الصف الثالث الإعدادي',
      'sec-1': 'الصف الأول الثانوي - علوم متكاملة',
      'sec-2': 'الصف الثاني الثانوي',
      'sec-3': 'الصف الثالث الثانوي',
      '1': 'الصف الأول الثانوي - علوم متكاملة',
      '2': 'الصف الثاني الثانوي',
      '3': 'الصف الثالث الثانوي',
    };
    return map[g] || g;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'غير محدد';
    let date: Date;
    if (timestamp.toDate) date = timestamp.toDate();
    else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
    else date = new Date(timestamp);
    
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#050508] to-[#010103] text-white font-display pb-16" dir="rtl">
      
      {/* Dynamic Header */}
      <header className="border-b border-white/5 bg-black/30 backdrop-blur-md sticky top-0 z-[60] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-blue/15 border border-brand-blue/30 text-brand-blue flex items-center justify-center font-bold">
              👨‍👩‍👦
            </div>
            <div>
              <h1 className="font-black text-base md:text-lg tracking-tight">بوابة ولي الأمر</h1>
              <p className="text-[10px] text-gray-500 font-bold">متابعة فورية لمستوى وتحصيل الأبناء</p>
            </div>
          </div>
          {student && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-xs font-bold cursor-pointer"
            >
              <LogOut size={14} />
              <span>خروج البوابة</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12">
        <AnimatePresence mode="wait">
          {!student ? (
            /* Login Form View */
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.5 }}
              className="max-w-md mx-auto"
            >
              <div className="bg-white/[0.02] border border-white/10 backdrop-blur-xl rounded-[2.5rem] p-8 sm:p-10 shadow-3xl space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/10 rounded-full blur-3xl" />
                
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 bg-brand-blue/10 text-brand-blue rounded-3xl flex items-center justify-center mx-auto border border-brand-blue/10 shadow-inner">
                    <ShieldCheck size={32} />
                  </div>
                  <h2 className="text-2xl font-black text-white">التحقق من الهوية</h2>
                  <p className="text-gray-400 text-xs font-bold leading-relaxed">
                    يرجى إدخال رقم الهاتف المسجل لولي الأمر وكود الطالب لمتابعة التقارير والدرجات بأمان.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-300 mr-1">
                      رقم هاتف ولي الأمر (الأب / الأم)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        placeholder="مثال: 01012345678"
                        className="w-full bg-white/5 border border-white/10 focus:border-brand-blue rounded-2xl px-5 py-4 outline-none font-bold text-sm text-right pr-12 text-white"
                      />
                      <Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-300 mr-1">
                      كود الطالب الفرعي
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="مثال: 126108"
                        className="w-full bg-white/5 border border-white/10 focus:border-brand-blue rounded-2xl px-5 py-4 outline-none font-bold text-sm text-right pr-12 text-white"
                      />
                      <GraduationCap size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                  </div>

                  {authError && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 flex items-center gap-3 font-bold text-xs leading-relaxed"
                    >
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{authError}</span>
                    </motion.div>
                  )}

                  <button
                    disabled={loading}
                    type="submit"
                    className="w-full btn-primary !py-4.5 rounded-2xl shadow-xl shadow-brand-blue/30 disabled:opacity-50 flex items-center justify-center gap-3 font-black text-sm cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        <span>دخول ومتابعة التقارير</span>
                        <ChevronLeft size={16} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          ) : (
            /* Dashboard View */
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5 }}
              className="space-y-10"
            >
              {/* Profile Overview Card */}
              <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/5 rounded-full blur-3xl" />
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-brand-blue to-blue-700 rounded-3xl flex items-center justify-center shrink-0 shadow-2xl border border-white/10">
                      <GraduationCap size={44} className="text-white" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl md:text-3xl font-black text-white">{student.displayName}</h2>
                        <span className="text-[10px] font-black text-brand-blue bg-brand-blue/10 border border-brand-blue/20 px-3 py-1 rounded-full">
                          {translateGrade(student.grade)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-bold">
                        كود الطالب الفريد: <span className="text-white font-black">{student.studentId}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-white/2 border border-white/5 rounded-2xl px-6 py-4 flex items-center gap-4 shadow-inner">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <Wallet size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold">رصيد محفظة الطالب</p>
                        <p className="text-lg font-black text-emerald-400">
                          {student.walletBalance !== undefined ? student.walletBalance : (student.balance || 0)} ج.م
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {loadingData ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="animate-spin text-brand-blue" size={48} />
                  <p className="text-sm text-gray-500 font-bold">جاري تحميل بيانات المتابعة والتقارير...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Stats & Subscribed Courses */}
                  <div className="space-y-8">
                    {/* Stats Highlights */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-xl space-y-1">
                        <p className="text-[10px] text-gray-500 font-bold">الامتحانات المؤداة</p>
                        <p className="text-3xl font-black text-brand-blue">{results.length}</p>
                      </div>
                      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 shadow-xl space-y-1">
                        <p className="text-[10px] text-gray-500 font-bold">الواجبات المسلمة</p>
                        <p className="text-3xl font-black text-amber-500">{submissions.length}</p>
                      </div>
                    </div>

                    {/* Subscribed Courses */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 shadow-xl space-y-6">
                      <h3 className="text-lg font-black text-white flex items-center gap-3">
                        <BookOpen className="text-brand-blue" size={20} />
                        <span>الكورسات والمجموعات المشتركة</span>
                      </h3>
                      {enrollments.length > 0 ? (
                        <div className="space-y-3">
                          {enrollments.map((en, index) => (
                            <div
                              key={index}
                              className="p-4 bg-white/2 border border-white/5 rounded-2xl flex justify-between items-center hover:bg-white/5 transition-all"
                            >
                              <div className="space-y-1">
                                <h4 className="font-extrabold text-sm text-white">{en.courseTitle}</h4>
                                <p className="text-[9px] text-gray-500 font-bold">تاريخ الاشتراك: {formatDate(en.createdAt)}</p>
                              </div>
                              <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                                مشترك
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 font-bold text-center py-6">لم يتم الاشتراك in أي كورس بعد.</p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Exams & Homework reports */}
                  <div className="lg:col-span-2 space-y-8">
                    
                    {/* Exam Results Table */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 sm:p-8 shadow-xl space-y-6">
                      <h3 className="text-lg font-black text-white flex items-center gap-3">
                        <Award className="text-brand-blue" size={20} />
                        <span>نتائج الامتحانات (أونلاين وورقي)</span>
                      </h3>

                      {results.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-right border-collapse">
                            <thead>
                              <tr className="border-b border-white/10 text-gray-400 text-xs font-bold pb-3">
                                <th className="pb-3 pr-2">اسم الامتحان</th>
                                <th className="pb-3">النوع</th>
                                <th className="pb-3">التاريخ</th>
                                <th className="pb-3 text-left pl-2">الدرجة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {results.map((r) => {
                                const percentage = r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0;
                                const isPassed = percentage >= 50;
                                return (
                                  <tr key={r.id} className="text-sm font-bold hover:bg-white/[0.02] transition-colors">
                                    <td className="py-4 pr-2 text-white font-extrabold">{r.title}</td>
                                    <td className="py-4">
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                                        r.type === 'online' ? 'bg-brand-blue/10 text-brand-blue border border-brand-blue/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                      }`}>
                                        {r.type === 'online' ? 'إلكتروني' : 'ورقي'}
                                      </span>
                                    </td>
                                    <td className="py-4 text-xs text-gray-400">{formatDate(r.createdAt)}</td>
                                    <td className="py-4 text-left pl-2">
                                      <div className="flex flex-col items-end">
                                        <span className={`font-black ${isPassed ? 'text-emerald-400' : 'text-red-400'}`}>
                                          {r.score} / {r.totalQuestions}
                                        </span>
                                        <span className="text-[9px] text-gray-500 font-bold">({percentage}%)</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 font-bold text-center py-8">لا توجد محاولات امتحانات مسجلة لهذا الطالب.</p>
                      )}
                    </div>

                    {/* Homework Submissions Report */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 sm:p-8 shadow-xl space-y-6">
                      <h3 className="text-lg font-black text-white flex items-center gap-3">
                        <FileSpreadsheet className="text-brand-blue" size={20} />
                        <span>تقارير تسليم وتقييم الواجبات</span>
                      </h3>

                      {submissions.length > 0 ? (
                        <div className="space-y-4">
                          {submissions.map((sub) => (
                            <div
                              key={sub.id}
                              className="p-5 bg-white/2 border border-white/5 rounded-2xl space-y-3 hover:bg-white/5 transition-all"
                            >
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <h4 className="font-extrabold text-sm text-white">{sub.lessonTitle}</h4>
                                  <p className="text-[10px] text-gray-500 font-bold">تاريخ التسليم: {formatDate(sub.createdAt)}</p>
                                </div>
                                <span className={`text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 ${
                                  sub.status === 'approved' 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                    : sub.status === 'rejected'
                                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {sub.status === 'approved' && <CheckCircle size={12} />}
                                  {sub.status === 'rejected' && <XCircle size={12} />}
                                  {sub.status === 'pending' && <Clock size={12} />}
                                  {sub.status === 'approved' ? 'مقبول' : sub.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                                </span>
                              </div>
                              
                              {sub.status === 'approved' && (
                                <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-white/5">
                                  <span className="text-gray-400">درجة الواجب:</span>
                                  <span className="text-emerald-400 font-black">{sub.grade} / 10</span>
                                </div>
                              )}

                              {sub.feedback && (
                                <div className="p-3 bg-white/2 rounded-xl text-xs font-medium text-gray-300 leading-relaxed border-r-2 border-brand-blue mt-2">
                                  <span className="font-black text-brand-blue block mb-1">ملاحظة المعلم:</span>
                                  {sub.feedback}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 font-bold text-center py-8">لم يقم الطالب برفع أي واجبات بعد.</p>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
