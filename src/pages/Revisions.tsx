import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  Clock,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader,
  CheckCircle,
  X,
  AlertCircle,
  Trophy,
  BarChart2,
  Zap,
  RefreshCw,
  Play,
  Send,
  Lock,
} from 'lucide-react';
import { collection, getDocs, query, where, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ExamSheet } from '../components/ExamSheet';

// ─── Types ────────────────────────────────────────────────────
interface Exam {
  id: string;
  title: string;
  subject: string;
  grade: string;
  duration: number;
  questionCount: number;
  isActive: boolean;
  teacherName: string;
  questions: ExamQuestion[];
  opensAt?: string | null;
  courseId?: string;
  teacherId?: string;
  allowRetake?: boolean;
  retakeDelay?: number;
}

interface ExamQuestion {
  id: string;
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex?: number;
  explanation?: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface Answer {
  questionId: string;
  selectedIndex: number | null;
}

interface ScoreCard {
  totalCorrect: number;
  totalQuestions: number;
  percentage: number;
  level: string;
  chapterBreakdown: {
    chapter: string;
    correct: number;
    total: number;
    percentage: number;
    level: string;
  }[];
  details: {
    questionId: string;
    correct: boolean;
    correctIndex: number;
    explanation: string;
    chapter: string;
  }[];
  resultId?: string;
}

// ─── Level Config ─────────────────────────────────────────────
const LEVEL_CONFIG: Record<string, { color: string; bg: string; emoji: string }> = {
  متفوق: {
    color: 'text-emerald-400',
    bg: 'from-emerald-600/20 to-emerald-800/10 border-emerald-500/30',
    emoji: '🏆',
  },
  'جيد جداً': {
    color: 'text-blue-400',
    bg: 'from-blue-600/20 to-blue-800/10 border-blue-500/30',
    emoji: '⭐',
  },
  جيد: {
    color: 'text-cyan-400',
    bg: 'from-cyan-600/20 to-cyan-800/10 border-cyan-500/30',
    emoji: '👍',
  },
  متوسط: {
    color: 'text-amber-400',
    bg: 'from-amber-600/20 to-amber-800/10 border-amber-500/30',
    emoji: '📚',
  },
  ضعيف: {
    color: 'text-red-400',
    bg: 'from-red-600/20 to-red-800/10 border-red-500/30',
    emoji: '💪',
  },
};
const getLevelConfig = (level: string) => LEVEL_CONFIG[level] || LEVEL_CONFIG['متوسط'];

// Arabic grade name -> { level, grade number } for reverse lookup
const ARABIC_TO_LEVEL: Record<string, { level: string; grade: string }> = {
  'أول ابتدائي': { level: 'primary', grade: '1' },
  'ثاني ابتدائي': { level: 'primary', grade: '2' },
  'ثالث ابتدائي': { level: 'primary', grade: '3' },
  'رابع ابتدائي': { level: 'primary', grade: '4' },
  'خامس ابتدائي': { level: 'primary', grade: '5' },
  'سادس ابتدائي': { level: 'primary', grade: '6' },
  'أول إعدادي': { level: 'prep', grade: '1' },
  'ثاني إعدادي': { level: 'prep', grade: '2' },
  'ثالث إعدادي': { level: 'prep', grade: '3' },
  'أول ثانوي': { level: 'secondary', grade: '1' },
  'ثاني ثانوي': { level: 'secondary', grade: '2' },
  'ثالث ثانوي': { level: 'secondary', grade: '3' },
};

const mapStudentGrade = (level?: string, gradeId?: string) => {
  if (!level || !gradeId) return gradeId;
  const cleanGradeId = gradeId.split('-')[0];
  if (level === 'secondary') {
    if (cleanGradeId === '1') return 'أول ثانوي';
    if (cleanGradeId === '2') return 'ثاني ثانوي';
    if (cleanGradeId === '3') return 'ثالث ثانوي';
  } else if (level === 'prep') {
    if (cleanGradeId === '1') return 'أول إعدادي';
    if (cleanGradeId === '2') return 'ثاني إعدادي';
    if (cleanGradeId === '3') return 'ثالث إعدادي';
  } else if (level === 'primary') {
    if (cleanGradeId === '1') return 'أول ابتدائي';
    if (cleanGradeId === '2') return 'ثاني ابتدائي';
    if (cleanGradeId === '3') return 'ثالث ابتدائي';
    if (cleanGradeId === '4') return 'رابع ابتدائي';
    if (cleanGradeId === '5') return 'خامس ابتدائي';
    if (cleanGradeId === '6') return 'سادس ابتدائي';
  }
  return gradeId;
};

// ─── Exam List View ───────────────────────────────────────────
const ExamList: React.FC<{ onStart: (exam: Exam, results: Record<string, any>) => void }> = ({
  onStart,
}) => {
  const { profile, user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [userResults, setUserResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [debugExams, setDebugExams] = useState<{ exam: Exam; reason: string }[]>([]);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const isStudent = profile?.role === 'student' || !profile?.role;

        // Build all queries upfront and run them in parallel
        const examsQuery = getDocs(
          query(collection(db, 'exams'), where('isActive', '==', true))
        );

        const parallelQueries: Promise<any>[] = [examsQuery];

        if (isStudent && user) {
          // Enrollments (both collection name casing) + results — all in parallel
          parallelQueries.push(
            getDocs(
              query(
                collection(db, 'Enrollments'),
                where('userId', '==', user.uid),
                where('status', '==', 'active')
              )
            ),
            getDocs(
              query(
                collection(db, 'enrollments'),
                where('userId', '==', user.uid),
                where('status', '==', 'active')
              )
            ),
            getDocs(
              query(collection(db, 'results'), where('userId', '==', user.uid))
            )
          );
        }

        const results = await Promise.all(parallelQueries);
        const allActiveSnap = results[0];
        const allActive = allActiveSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }) as Exam);

        if (isStudent) {
          const studentArabicGrade = mapStudentGrade(profile?.level, profile?.grade);
          const studentGradeId = profile?.grade;
          const studentLevel = profile?.level;

          let enrollmentsIds: string[] = [];
          if (user) {
            const snap1 = results[1];
            const snap2 = results[2];
            const ids1 = snap1.docs.map((doc: any) => doc.data().courseId);
            const ids2 = snap2.docs.map((doc: any) => doc.data().courseId);
            enrollmentsIds = Array.from(new Set([...ids1, ...ids2]));
          }

          const filtered: { exam: Exam; reason: string }[] = [];
          const cleanStudentGrade = String(studentGradeId).split('-')[0];

          const visible = allActive.filter((exam) => {
            // If student is enrolled in the exam's course, show it regardless of grade
            const isEnrolledInCourse = exam.courseId && enrollmentsIds.includes(exam.courseId);
            if (isEnrolledInCourse) {
              return true;
            }

            const examGrade = String(exam.grade);

            // Normalize exam grade: if it's an Arabic name, extract level+grade
            const examLookup = ARABIC_TO_LEVEL[examGrade];
            const examLevel = examLookup?.level;
            const examGradeNum = examLookup?.grade || examGrade.split('-')[0];

            let gradeMatches = false;

            if (examLookup) {
              // Exam grade is an Arabic name like "ثالث إعدادي"
              // Match both level AND grade number
              gradeMatches = examLevel === studentLevel && examGradeNum === cleanStudentGrade;
            } else {
              // Exam grade is a numeric/ID format (e.g. "3", "3-prep", etc.)
              gradeMatches =
                examGrade === String(studentGradeId) ||
                examGrade === String(studentArabicGrade) ||
                examGradeNum === cleanStudentGrade;
            }

            if (!gradeMatches) {
              // If exam has a courseId but student isn't enrolled, also filter out
              if (exam.courseId) {
                filtered.push({ exam, reason: `غير مشترك في الكورس` });
              } else {
                filtered.push({
                  exam,
                  reason: `الصف الدراسي: ${examGrade} لا يطابق ${studentArabicGrade}`,
                });
              }
              return false;
            }

            // Grade matches but check course enrollment if exam has a courseId
            const enrollmentMatches = !exam.courseId || enrollmentsIds.includes(exam.courseId);
            if (!enrollmentMatches) {
              filtered.push({ exam, reason: `الاشتراك: غير مشترك في الكورس المخصص` });
              return false;
            }

            return true;
          });

          setExams(visible);
          setDebugExams(filtered);

          if (user) {
            const resultsSnap = results[3];
            const resMap: Record<string, any> = {};
            resultsSnap.docs.forEach((doc: any) => {
              const data = doc.data();
              if (!resMap[data.examId] || data.timestamp > resMap[data.examId].timestamp) {
                resMap[data.examId] = data;
              }
            });
            setUserResults(resMap);
          }
        } else {
          setExams(allActive);
        }
      } catch (e: any) {
        setError('تعذّر تحميل البيانات: ' + e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, [profile, user]);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader className="animate-spin text-brand-blue" size={32} />
        <p className="text-gray-500 font-bold">جاري تحميل الاختبارات...</p>
      </div>
    );

  if (error)
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 font-bold flex items-center gap-2">
        <AlertCircle size={20} /> {error}
      </div>
    );

  return (
    <div className="space-y-12">
      {exams.length === 0 && debugExams.length === 0 ? (
        <div className="py-20 text-center text-gray-500 font-bold border-2 border-dashed border-white/10 rounded-[3rem]">
          لا توجد امتحانات متاحة حالياً لصفّك الدراسي.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam, i) => {
            const result = userResults[exam.id];

            const now = new Date();
            const opensAtDate = exam.opensAt ? new Date(exam.opensAt) : null;
            const isLocked = opensAtDate && opensAtDate > now;
            const formattedDate = opensAtDate
              ? new Intl.DateTimeFormat('ar-EG', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(opensAtDate)
              : '';

            return (
              <motion.div
                key={exam.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white/5 border border-white/10 rounded-[2rem] p-6 hover:border-brand-blue/30 transition-all group"
              >
                <div className="flex flex-col h-full gap-4">
                  <div className="space-y-3">
                    <h3 className="text-xl font-black text-white group-hover:text-brand-blue transition-colors line-clamp-2">
                      {exam.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-bold">
                      <span className="flex items-center gap-1.5">
                        <BookOpen size={14} />
                        {exam.subject}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Star size={14} />
                        {exam.grade}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} />
                        {exam.duration} د دقيقة
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-white/5">
                    {isLocked ? (
                      <div className="w-full py-3 bg-white/5 text-gray-400 border border-white/10 rounded-2xl text-center font-black flex flex-col items-center gap-1 cursor-not-allowed">
                        <span className="flex items-center gap-2">
                          <Lock size={16} /> يفتح في
                        </span>
                        <span className="text-[10px] text-brand-blue">{formattedDate}</span>
                      </div>
                    ) : result && !exam.allowRetake ? (
                      <div className="w-full py-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl text-center font-black">
                        تم الإرسال ({result.score}%)
                      </div>
                    ) : (
                      <button
                        onClick={() => onStart(exam, userResults)}
                        className="w-full bg-brand-blue text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
                      >
                        <Play size={16} /> {result ? 'إعادة الاختبار' : 'ابدأ الآن'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Debug UI - Only visible to admins/teachers, hidden from students */}
    </div>
  );
};

// Removed ExamEngine

// ─── Scorecard View ───────────────────────────────────────────
const ScorecardView: React.FC<{ sc: ScoreCard; examTitle: string; onRetry: () => void }> = ({
  sc,
  examTitle,
  onRetry,
}) => {
  const lvl = getLevelConfig(sc.level);
  return (
    <div className="max-w-4xl mx-auto text-center space-y-12 pb-24" dir="rtl">
      <div className={`p-12 rounded-[3.5rem] bg-gradient-to-br ${lvl.bg} border border-white/10`}>
        <div className="text-7xl mb-6">{lvl.emoji}</div>
        <h2 className="text-5xl font-black text-white mb-2">{sc.percentage}%</h2>
        <p className={`text-xl font-black ${lvl.color}`}>{sc.level}</p>
        <p className="mt-6 text-gray-400 font-bold max-w-md mx-auto">
          لقد أتممت "{examTitle}" بنجاح. إليك تحليل أدائك.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sc.chapterBreakdown.map((ch, i) => (
          <div key={i} className="bg-white/5 p-6 rounded-[2rem] border border-white/10 text-right">
            <h4 className="text-white font-black mb-1">{ch.chapter}</h4>
            <div className="flex justify-between items-end mt-4">
              <span className="text-brand-blue font-black text-2xl">{ch.percentage}%</span>
              <span className="text-gray-500 text-sm">
                ({ch.correct} / {ch.total})
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onRetry}
        className="w-full bg-white text-gray-900 py-5 rounded-[2rem] font-black text-lg shadow-xl"
      >
        العودة للمركز الرئيسي
      </button>
    </div>
  );
};

// ─── Main Hub ─────────────────────────────────────────────────
export const Exams: React.FC = () => {
  const { user, profile } = useAuth();
  const [stage, setStage] = useState<'list' | 'exam' | 'score'>('list');
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [scorecard, setScorecard] = useState<ScoreCard | null>(null);

  useEffect(() => {
    if (stage === 'exam') {
      document.body.classList.add('taking-exam');
    } else {
      document.body.classList.remove('taking-exam');
    }
    return () => {
      document.body.classList.remove('taking-exam');
    };
  }, [stage]);

  const handleStart = (exam: Exam, results: Record<string, any>) => {
    const prev = results[exam.id];
    if (prev) {
      if (!exam.allowRetake) {
        alert('غير مسموح بإعادة هذا الاختبار.');
        return;
      }
      if (exam.retakeDelay) {
        const hoursPassed = (Date.now() - prev.timestamp) / (1000 * 3600);
        if (hoursPassed < exam.retakeDelay) {
          alert(`يرجى الانتظار ${Math.ceil(exam.retakeDelay - hoursPassed)} ساعة قبل الإعادة.`);
          return;
        }
      }
    }
    setActiveExam(exam);
    setStage('exam');
  };

  const handleExamSubmit = async (data: any) => {
    if (!user || !activeExam) return;
    
    try {
      let totalCorrect = 0;
      const details: any[] = [];
      const chapterStats: Record<string, { correct: number; total: number }> = {};
      const questions = activeExam.questions || [];
      const answers = data.answers || [];

      questions.forEach((q) => {
        // Find the answer for this question ID from the payload
        const answer = answers.find((a: any) => a.questionId === q.id);
        const selected = answer ? answer.selectedIndex : -1;
        const correctIndex = q.correctOptionIndex !== undefined ? q.correctOptionIndex : 0;
        
        const isCorrect = selected === correctIndex;
        if (isCorrect) totalCorrect++;
        
        const chap = q.chapter || 'عام';
        if (!chapterStats[chap]) chapterStats[chap] = { correct: 0, total: 0 };
        chapterStats[chap].total++;
        if (isCorrect) chapterStats[chap].correct++;
        
        details.push({
          questionId: q.id,
          correct: isCorrect,
          correctIndex,
          explanation: q.explanation || '',
          chapter: chap,
        });
      });

      const percentage =
        questions.length > 0 ? Math.round((totalCorrect / questions.length) * 100) : 0;
      let level = 'متوسط';
      if (percentage >= 90) level = 'متفوق';
      else if (percentage >= 75) level = 'جيد جداً';
      else if (percentage >= 65) level = 'جيد';
      else if (percentage >= 50) level = 'متوسط';
      else level = 'ضعيف';

      const chapterBreakdown = Object.keys(chapterStats).map((chap) => ({
        chapter: chap,
        correct: chapterStats[chap].correct,
        total: chapterStats[chap].total,
        percentage: Math.round((chapterStats[chap].correct / chapterStats[chap].total) * 100),
        level: 'متوسط',
      }));

      const sc: ScoreCard = {
        totalCorrect,
        totalQuestions: questions.length,
        percentage,
        level,
        chapterBreakdown,
        details,
      };

      await addDoc(collection(db, 'results'), {
        examId: activeExam.id,
        examTitle: activeExam.title,
        subject: activeExam.subject || '',
        courseId: activeExam.courseId || '',
        teacherId: activeExam.teacherId || '',
        userId: user.uid,
        studentId: user.uid,
        studentName: profile?.displayName || user.email || 'طالب',
        score: percentage,
        percentage,
        level,
        totalCorrect,
        totalQuestions: questions.length,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        timeTaken: data.timeTaken || 0
      });

      setScorecard(sc);
      setStage('score');
    } catch (error) {
      console.error('Error saving exam results:', error);
      alert('خطأ أثناء الحفظ');
    }
  };

  return (
    <div className="pb-24 max-w-5xl mx-auto px-6" dir="rtl">
      {stage === 'list' && (
        <div className="pt-12 mb-12 text-right">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            مركز <span className="text-brand-blue">الاختبارات</span>
          </h1>
          <p className="text-gray-500 font-bold text-lg">
            اختبر مستواك وتعرف على نقاط قوتك بدقة ✨
          </p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {stage === 'list' && (
          <motion.div key="list">
            <ExamList onStart={handleStart} />
          </motion.div>
        )}
        {stage === 'exam' && activeExam && user && (
          <motion.div key="exam">
              <ExamSheet
                examId={activeExam.id}
                userId={user.uid}
                title={activeExam.title}
                durationMinutes={activeExam.duration}
                questions={(activeExam.questions || []).map(q => ({
                  id: q.id,
                  text: q.questionText,
                  options: q.options
                }))}
                onComplete={handleExamSubmit}
              />
          </motion.div>
        )}
        {stage === 'score' && scorecard && activeExam && (
          <motion.div key="score">
            <ScorecardView
              sc={scorecard}
              examTitle={activeExam.title}
              onRetry={() => setStage('list')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


