import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { 
  ChevronLeft, Loader2, User, Mail, Phone, BookOpen, Trophy, 
  BarChart2, Clock, CheckCircle, Calendar, GraduationCap 
} from 'lucide-react';
import { motion } from 'framer-motion';

const translateLevel = (level: string) => {
  if (!level) return '';
  const map: Record<string, string> = {
    primary: 'الابتدائية',
    prep: 'الإعدادية',
    preparatory: 'الإعدادية',
    secondary: 'الثانوية',
  };
  return map[level.toLowerCase()] || level;
};

const translateGrade = (grade: string) => {
  if (!grade) return '';
  const map: Record<string, string> = {
    'primary-1': 'الصف الأول الابتدائي',
    'primary-2': 'الصف الثاني الابتدائي',
    'primary-3': 'الصف الثالث الابتدائي',
    'primary-4': 'الصف الرابع الابتدائي',
    'primary-5': 'الصف الخامس الابتدائي',
    'primary-6': 'الصف السادس الابتدائي',
    'prep-1': 'الصف الأول الإعدادي',
    'prep-2': 'الصف الثاني الإعدادي',
    'prep-3': 'الصف الثالث الإعدادي',
    'sec-1': 'الصف الأول الثانوي - علوم متكاملة',
    'sec-2': 'الصف الثاني الثانوي',
    'sec-3': 'الصف الثالث الثانوي',
  };
  return map[grade.toLowerCase()] || grade;
};

export const TeacherStudentDetails: React.FC = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { settings } = useSettings();

  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [examResults, setExamResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!studentId || !profile?.uid) return;
      setLoading(true);

      try {
        // 1. Fetch User Info
        const userDoc = await getDoc(doc(db, 'users', studentId));
        if (userDoc.exists()) {
          setStudentInfo({ id: userDoc.id, ...userDoc.data() });
        } else {
          setStudentInfo({ id: studentId, displayName: 'طالب مجهول', email: 'غير متوفر' });
        }

        // 2. Fetch Enrollments
        const enrollmentsData: any[] = [];
        for (const collName of ['Enrollments', 'enrollments']) {
          const snaps = await getDocs(query(collection(db, collName), where('userId', '==', studentId)));
          snaps.docs.forEach(d => enrollmentsData.push({ id: d.id, ...d.data() }));
          
          const snapsUid = await getDocs(query(collection(db, collName), where('uid', '==', studentId)));
          snapsUid.docs.forEach(d => enrollmentsData.push({ id: d.id, ...d.data() }));
        }

        // De-duplicate enrollments by courseId
        const uniqueEnrollments = Array.from(new Map(enrollmentsData.map(e => [e.courseId || e.CourseId, e])).values());
        
        // Fetch Course Titles for enrollments
        const finalEnrollments = await Promise.all(uniqueEnrollments.map(async (e) => {
          let courseTitle = 'كورس غير معروف';
          if (e.courseId || e.CourseId) {
            const cid = e.courseId || e.CourseId;
            const cUp = await getDoc(doc(db, 'Courses', cid));
            if (cUp.exists()) courseTitle = cUp.data().title;
            else {
              const cLo = await getDoc(doc(db, 'courses', cid));
              if (cLo.exists()) courseTitle = cLo.data().title;
            }
          }
          return { ...e, courseTitle };
        }));
        
        setEnrollments(finalEnrollments);

        // 3. Fetch Exam Results
        const resultsData: any[] = [];
        for (const collName of ['Results', 'results']) {
          const snaps = await getDocs(query(collection(db, collName), where('userId', '==', studentId)));
          snaps.docs.forEach(d => resultsData.push({ id: d.id, ...d.data() }));
        }
        
        const resultsWithSubject = await Promise.all(resultsData.map(async (r) => {
          let subject = r.subject || '';
          if (!subject && r.examId) {
            try {
              const examSnap = await getDoc(doc(db, 'exams', r.examId));
              if (examSnap.exists()) {
                subject = examSnap.data().subject || '';
              }
            } catch (e) {
              console.warn(`Failed to fetch exam for subject mapping:`, e);
            }
          }
          if (!subject) {
            subject = settings?.subject || 'علوم';
          }
          return { ...r, subject };
        }));

        setExamResults(resultsWithSubject.sort((a, b) => {
          const tA = a.submittedAt?.seconds || a.timestamp?.seconds || 0;
          const tB = b.submittedAt?.seconds || b.timestamp?.seconds || 0;
          return tB - tA;
        }));

      } catch (err) {
        console.error("Error fetching student details", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, profile?.uid]);

  const avgScore = examResults.length 
    ? Math.round(examResults.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / examResults.length)
    : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
        <p className="text-white/40 font-black tracking-widest">جاري تحميل بيانات الطالب...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all shrink-0"
        >
          <ChevronLeft className="rotate-180" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-white">ملف الطالب</h1>
          <p className="text-gray-500 font-bold">التقارير والمتابعة الشاملة</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="glass-card p-8 border border-white/10 rounded-[2.5rem] bg-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 blur-[100px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10">
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/40 flex items-center justify-center border border-emerald-500/20 shrink-0 shadow-2xl">
            <User size={48} className="text-emerald-500" />
          </div>
          <div className="flex-1 space-y-4 text-center md:text-right">
            <div>
              <h2 className="text-3xl font-black text-white">{studentInfo?.displayName || studentInfo?.name || 'بدون اسم'}</h2>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2">
                {studentInfo?.email && (
                  <p className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <Mail size={16} className="text-emerald-500" /> {studentInfo.email}
                  </p>
                )}
                {studentInfo?.studentPhone && (
                  <p className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <Phone size={16} className="text-emerald-500" /> هاتف الطالب: {studentInfo.studentPhone}
                  </p>
                )}
                {studentInfo?.fatherPhone && (
                  <p className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <Phone size={16} className="text-emerald-500" /> هاتف الأب: {studentInfo.fatherPhone}
                  </p>
                )}
                {studentInfo?.motherPhone && (
                  <p className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <Phone size={16} className="text-emerald-500" /> هاتف الأم: {studentInfo.motherPhone}
                  </p>
                )}
                {studentInfo?.schoolName && (
                  <p className="flex items-center gap-2 text-sm font-bold text-gray-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                    <BookOpen size={14} className="text-emerald-500" /> مدرسة: {studentInfo.schoolName}
                  </p>
                )}
                {studentInfo?.level && (
                  <p className="flex items-center gap-2 text-sm font-bold text-gray-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                    <GraduationCap size={14} className="text-emerald-500" /> المرحلة: {translateLevel(studentInfo.level)}
                  </p>
                )}
                {studentInfo?.grade && (
                  <p className="flex items-center gap-2 text-sm font-bold text-gray-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                    <BookOpen size={14} className="text-emerald-500" /> الصف: {translateGrade(studentInfo.grade)}
                  </p>
                )}
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-black/20 p-4 rounded-2xl border border-white/5 text-center">
                <BookOpen size={20} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-2xl font-black text-white">{enrollments.length}</p>
                <p className="text-[10px] text-gray-500 font-black uppercase">كورسات مسجلة</p>
              </div>
              <div className="bg-black/20 p-4 rounded-2xl border border-white/5 text-center">
                <BarChart2 size={20} className="mx-auto text-purple-400 mb-2" />
                <p className="text-2xl font-black text-white">{examResults.length}</p>
                <p className="text-[10px] text-gray-500 font-black uppercase">امتحانات مجتازة</p>
              </div>
              <div className="bg-black/20 p-4 rounded-2xl border border-white/5 text-center">
                <Trophy size={20} className="mx-auto text-amber-400 mb-2" />
                <p className="text-2xl font-black text-white">{avgScore}%</p>
                <p className="text-[10px] text-gray-500 font-black uppercase">متوسط الدرجات</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Enrollments Section */}
        <div className="space-y-6">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <BookOpen className="text-emerald-500" /> الكورسات المشترك بها
          </h3>
          <div className="space-y-4">
            {enrollments.length === 0 ? (
              <p className="text-gray-500 font-bold p-6 bg-white/5 rounded-2xl border border-white/5 text-center">لا توجد كورسات مسجلة</p>
            ) : (
              enrollments.map((e, idx) => (
                <motion.div key={idx} initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay: idx*0.05}} 
                  className="p-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-blue/10 rounded-xl flex items-center justify-center">
                      <BookOpen className="text-brand-blue" />
                    </div>
                    <div>
                      <h4 className="font-black text-white">{e.courseTitle}</h4>
                      <p className="text-xs text-gray-500 font-bold mt-1 flex items-center gap-2">
                        <Calendar size={12} />
                        {e.createdAt?.seconds ? new Date(e.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : 'حديث'}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className={`px-3 py-1 rounded-xl text-xs font-black ${e.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {e.status === 'active' ? 'مفعل' : 'قيد الانتظار'}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Exams Section */}
        <div className="space-y-6">
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <Trophy className="text-amber-500" /> نتائج الاختبارات
          </h3>
          <div className="space-y-4 h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {examResults.length === 0 ? (
              <p className="text-gray-500 font-bold p-6 bg-white/5 rounded-2xl border border-white/5 text-center">لم يقم الطالب بأي امتحانات بعد</p>
            ) : (
              examResults.map((r, idx) => (
                <motion.div key={r.id || idx} initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay: idx*0.05}} 
                  className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-white text-lg">{r.examTitle || 'امتحان'}</h4>
                      <p className="text-xs text-gray-500 font-bold mt-1">{r.subject || 'بدون مادة'}</p>
                    </div>
                    <div className="text-left">
                      <p className={`text-2xl font-black ${r.percentage >= 85 ? 'text-emerald-400' : r.percentage >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        {r.percentage}%
                      </p>
                      <p className="text-xs text-gray-400 font-bold mt-1">{r.totalCorrect} / {r.totalQuestions} صحيح</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-gray-400 bg-black/20 p-2 rounded-xl border border-white/5">
                    <span className="flex items-center gap-1"><Clock size={12} className="text-brand-blue" /> {r.timeTaken} دقيقة</span>
                    <span className="flex items-center gap-1"><Calendar size={12} className="text-brand-blue" /> {
                      (r.submittedAt?.seconds || r.timestamp?.seconds) 
                        ? new Date((r.submittedAt?.seconds || r.timestamp?.seconds) * 1000).toLocaleDateString('ar-EG') 
                        : 'حديث'
                    }</span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
