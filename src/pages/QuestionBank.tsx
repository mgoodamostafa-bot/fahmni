import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Search,
  Filter,
  CheckCircle,
  X,
  ChevronDown,
  Loader,
  BookOpen,
  Zap,
  Star,
  AlertCircle,
  RefreshCw,
  BrainCircuit,
  FileUp,
  Loader2,
  Database,
  Trash2,
  Info,
  LayoutGrid,
  CheckCircle2,
  GraduationCap,
  ChevronRight,
} from 'lucide-react';
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { smartGetDocs, chunkArray } from '../utils/firestore';
import { extractTextFromPDF } from '../utils/pdf';
import { generateQuestionsFromAI, RawAIQuestion } from '../lib/gemini';
import { useNavigate } from 'react-router-dom';

const GRADES = [
  'أول ثانوي',
  'ثاني ثانوي',
  'ثالث ثانوي',
  'أول إعدادي',
  'ثاني إعدادي',
  'ثالث إعدادي',
];
const SUBJECTS = [
  'رياضيات',
  'فيزياء',
  'كيمياء',
  'أحياء',
  'لغة عربية',
  'لغة إنجليزية',
  'تاريخ',
  'جغرافيا',
  'علوم',
];
const DIFF_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  easy: { label: 'سهل', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  medium: { label: 'متوسط', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  hard: { label: 'صعب', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

interface Question {
  id: string;
  grade: string;
  subject: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex?: number;
  explanation?: string;
  imageUrl?: string;
  pdfLink?: string;
}

interface AnswerFeedback {
  correct: boolean;
  correctIndex: number;
  explanation: string;
}

interface ReviewQuestion extends RawAIQuestion {
  id: string;
  selected: boolean;
}

// ─── Single Question Card (Practice Mode) ────────────────────
const QuestionCard: React.FC<{
  q: Question;
  index: number;
  userId: string;
}> = ({ q, index, userId }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [loading, setLoading] = useState(false);

  const diff = DIFF_CONFIG[q.difficulty] || DIFF_CONFIG.medium;
  const optionLetters = ['أ', 'ب', 'ج', 'د'];

  const handleAnswer = async (optionIndex: number) => {
    if (feedback || loading) return;
    setSelected(optionIndex);
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      // Use server-side verification instead of client-side comparison
      const response = await fetch('/api/questions/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: q.id,
          selectedIndex: optionIndex,
          userId: userId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to verify answer');
      }

      const result = await response.json();
      setFeedback({
        correct: result.correct,
        correctIndex: result.correctIndex,
        explanation:
          result.explanation ||
          (result.correct
            ? 'إجابة عبقرية! استمر هكذا.'
            : 'لا بأس، الخطأ طريق التعلم. الإجابة الصحيحة هي ' +
              optionLetters[result.correctIndex]),
      });
    } catch (err) {
      console.error(err);
      if (q.correctOptionIndex !== undefined) {
        const isCorrect = q.correctOptionIndex === optionIndex;
        setFeedback({
          correct: isCorrect,
          correctIndex: q.correctOptionIndex,
          explanation:
            q.explanation ||
            (isCorrect
              ? 'إجابة عبقرية! استمر هكذا.'
              : 'لا بأس، الخطأ طريق التعلم. الإجابة الصحيحة هي ' + optionLetters[q.correctOptionIndex]),
        });
      } else {
        // Fallback: show error message
        setFeedback({
          correct: false,
          correctIndex: 0,
          explanation: 'حدث خطأ أثناء التحقق. يرجى المحاولة مرة أخرى.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative group bg-[#0f172a]/40 backdrop-blur-xl border-2 rounded-[2.5rem] p-8 transition-all duration-500 ${
        feedback
          ? feedback.correct
            ? 'border-emerald-500/30'
            : 'border-red-500/30'
          : 'border-white/5 hover:border-white/10'
      }`}
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white font-black text-sm border border-white/10">
            {index + 1}
          </div>
          <div className="space-y-1">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              {q.subject}
            </h4>
            <div className="flex items-center gap-2">
              <BookOpen size={12} className="text-brand-blue" />
              <span className="text-xs font-bold text-gray-400">{q.chapter}</span>
            </div>
          </div>
        </div>
        <span
          className={`px-4 py-1.5 rounded-xl text-[10px] font-black border tracking-widest uppercase ${diff.bg} ${diff.color}`}
        >
          {diff.label}
        </span>
      </div>

      <p className="text-xl md:text-2xl font-black text-white leading-relaxed mb-10 text-right">
        {q.questionText}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {q.options.map((opt, i) => {
          const isCorrect = !!feedback && feedback.correctIndex === i;
          const isWrong = !!feedback && selected === i && !feedback.correct;
          const isSelected = selected === i;

          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={!!feedback || loading}
              className={`relative flex items-center gap-4 p-5 rounded-[1.8rem] border-2 transition-all font-bold text-right group/opt ${
                feedback && isCorrect
                  ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                  : feedback && isWrong
                    ? 'bg-red-500/10 border-red-500 text-white'
                    : isSelected
                      ? 'bg-brand-blue/10 border-brand-blue text-white'
                      : 'bg-white/2 border-white/5 text-gray-400 hover:border-white/10 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-transform group-hover/opt:scale-110 ${
                  feedback && isCorrect
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : feedback && isWrong
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                      : isSelected
                        ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
                        : 'bg-white/5 text-gray-500'
                }`}
              >
                {optionLetters[i]}
              </div>
              <span className="text-base truncate">{opt}</span>
              {loading && isSelected && !feedback && (
                <Loader2 className="absolute left-4 animate-spin text-brand-blue" size={18} />
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-8 p-6 rounded-[2rem] border-2 flex items-start gap-5 text-right ${
              feedback.correct
                ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                : 'bg-red-500/5 border-red-500/10 text-red-400'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center ${feedback.correct ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}
            >
              {feedback.correct ? <CheckCircle2 size={24} /> : <X size={24} />}
            </div>
            <div className="space-y-1">
              <h5 className="font-black text-sm uppercase tracking-widest">
                {feedback.correct ? 'إجابة نموذجية' : 'محاولة جيدة'}
              </h5>
              <p className="text-white/60 text-sm leading-relaxed font-bold">
                {feedback.explanation}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────
export const QuestionBank: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'teacher';

  const [activeMode, setActiveMode] = useState<'practice' | 'ai-import'>('practice');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [search, setSearch] = useState('');

  // AI Import States
  const [aiStep, setAiStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [aiQuestions, setAiQuestions] = useState<ReviewQuestion[]>([]);
  const [processStatus, setProcessStatus] = useState('');
  const [aiProgress, setAiProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [importGrade, setImportGrade] = useState('');
  const [importSubject, setImportSubject] = useState('');
  const [importLesson, setImportLesson] = useState('');

  // Dynamic Filter States
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  useEffect(() => {
    if (isAdmin) {
      setAvailableGrades(GRADES);
      setAvailableSubjects(SUBJECTS);
      return;
    }

    const fetchStudentOptions = async () => {
      if (!user?.uid) return;

      try {
        // 1. Fetch Enrollments using smart utility
        const enrollmentDocs = await smartGetDocs('Enrollments', [where('userId', '==', user.uid)]);

        const enrolledCourseIds = Array.from(
          new Set(
            enrollmentDocs.filter((d) => d.status === 'active' || !d.status).map((d) => d.courseId)
          )
        ).filter((id) => !!id) as string[];

        if (enrolledCourseIds.length === 0) {
          setAvailableGrades([]);
          setAvailableSubjects([]);
          return;
        }

        // 2. Fetch Course Details (Chunked and smart)
        const idChunks = chunkArray(enrolledCourseIds, 30);
        const grades = new Set<string>();
        const subjects = new Set<string>();

        const courseSnapshots = await Promise.all(
          idChunks.map((chunk) => smartGetDocs('Courses', [where('__name__', 'in', chunk)]))
        );

        courseSnapshots.flat().forEach((data) => {
          if (data.grade) grades.add(data.grade);
          if (data.subject) subjects.add(data.subject);
        });

        setAvailableGrades(Array.from(grades).sort());
        setAvailableSubjects(Array.from(subjects).sort());
      } catch (e) {
        console.error('Error fetching student options:', e);
      }
    };

    fetchStudentOptions();
  }, [user?.uid, profile?.role, isAdmin]);

  const fetchQuestions = useCallback(async () => {
    if (!profile && !isAdmin) return; // Wait for profile
    setLoading(true);
    try {
      const qColl = collection(db, 'Questions');
      const filters = [];

      if (selectedGrade) {
        filters.push(where('grade', '==', selectedGrade));
      } else if (!isAdmin && availableGrades.length > 0) {
        // Automatically restrict to student's grades if none selected
        // Firestore 'in' limit is 10
        filters.push(where('grade', 'in', availableGrades.slice(0, 10)));
      }

      if (selectedSubject) {
        // Handle Al-prefix variations for Arabic subjects
        const variants = [selectedSubject];
        if (selectedSubject.startsWith('ال')) {
          variants.push(selectedSubject.substring(2));
        } else {
          variants.push('ال' + selectedSubject);
        }
        filters.push(where('subject', 'in', variants));
      } else if (!isAdmin && availableSubjects.length > 0) {
        // Expand available subjects with variants then chunk
        const expandedSubjects = new Set<string>();
        availableSubjects.forEach((s) => {
          expandedSubjects.add(s);
          if (s.startsWith('ال')) expandedSubjects.add(s.substring(2));
          else expandedSubjects.add('ال' + s);
        });
        filters.push(where('subject', 'in', Array.from(expandedSubjects).slice(0, 30)));
      }

      // If student has no enrollments and not admin, don't fetch anything (should be caught by guard anyway)
      if (!isAdmin && availableGrades.length === 0 && availableSubjects.length === 0) {
        if (profile) {
          setQuestions([]);
          setLoading(false);
        }
        return;
      }

      const snap = await getDocs(filters.length ? query(qColl, ...filters) : query(qColl));
      const qs = snap.docs.map((d) => {
        const data = d.data();
        // Include correctOptionIndex for local fallback verification since backend API is down
        return {
          id: d.id,
          questionText: data.questionText || data.question || '',
          options: data.options || [],
          chapter: data.chapter || data.lessonName || '',
          ...data,
        } as Question;
      });
      setQuestions(qs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedGrade, selectedSubject, availableGrades, availableSubjects, isAdmin, profile]);

  useEffect(() => {
    if (activeMode === 'practice') fetchQuestions();
  }, [activeMode, fetchQuestions]);

  const handleAIProcess = async () => {
    if (!file || !importGrade || !importSubject) return;
    setAiStep('processing');
    try {
      setProcessStatus('جاري استخراج النصوص...');
      setAiProgress(30);
      const text = await extractTextFromPDF(file);

      setProcessStatus('جاري تحليل المحتوى بالذكاء الاصطناعي...');
      setAiProgress(60);
      const results = await generateQuestionsFromAI(text);

      setAiQuestions(
        results.map((q, i) => ({ ...q, id: `ai-${Date.now()}-${i}`, selected: true }))
      );
      if (results.length > 0 && results[0].category) setImportLesson(results[0].category);

      setAiProgress(100);
      setTimeout(() => setAiStep('review'), 500);
    } catch (e) {
      alert('حدث خطأ أثناء المعالجة: ' + (e as Error).message);
      setAiStep('upload');
    }
  };

  const saveAIQuestions = async () => {
    const selected = aiQuestions.filter((q) => q.selected);
    if (selected.length === 0) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      selected.forEach((q) => {
        const ref = doc(collection(db, 'Questions'));
        const correctIndex = q.options.findIndex((opt) => opt === q.correctAnswer);
        batch.set(ref, {
          questionText: q.question,
          options: q.options,
          correctOptionIndex: correctIndex === -1 ? 0 : correctIndex,
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          chapter: importLesson || q.category || 'عام',
          grade: importGrade,
          subject: importSubject,
          teacherId: user?.uid,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
      alert('تم حفظ الأسئلة بنجاح!');
      setAiStep('upload');
      setAiQuestions([]);
      setActiveMode('practice');
    } catch (e) {
      alert('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const filtered = questions.filter(
    (q) =>
      !search ||
      q.questionText?.toLowerCase().includes(search.toLowerCase()) ||
      q.grade?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Standalone Navigation/Header */}
      <div className="flex items-center justify-between p-6 md:px-10 border-b border-white/5 bg-white/5 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          {activeMode === 'practice' ? (
            <Zap className="text-brand-blue" />
          ) : (
            <BrainCircuit className="text-indigo-400" />
          )}
          <h1 className="text-xl md:text-2xl font-black font-display">
            {activeMode === 'practice' ? 'بنك الأسئلة' : 'توليد الأسئلة بالذكاء الاصطناعي'}
          </h1>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all font-bold text-sm text-gray-300 hover:text-white"
        >
          <span>العودة للمنصة</span>
          <X size={18} />
        </button>
      </div>

      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <p className="text-gray-400 font-bold">
            {activeMode === 'practice'
              ? 'تدرب على أسئلة حقيقية بمختلف المستويات'
              : 'حول ملفات PDF إلى أسئلة MCQ في ثوانٍ'}
          </p>
        </div>

        {isAdmin && (
          <div className="flex p-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
            <button
              onClick={() => setActiveMode('practice')}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeMode === 'practice' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              ممارسة
            </button>
            <button
              onClick={() => setActiveMode('ai-import')}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeMode === 'ai-import' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              AI Import
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeMode === 'practice' ? (
          <motion.div
            key="practice"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Filters (Search/Grade/Subject) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="ابحث..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pr-12 pl-4 text-white font-bold focus:ring-2 focus:ring-brand-blue/20 outline-none"
                />
              </div>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-2xl p-3 text-white font-bold outline-none"
              >
                <option value="">{isAdmin ? 'كل الصفوف' : 'صفوفك المسجلة'}</option>
                {availableGrades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-2xl p-3 text-white font-bold outline-none"
              >
                <option value="">{isAdmin ? 'كل المواد' : 'موادك المشترك بها'}</option>
                {availableSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-brand-blue" size={40} />
                <p className="text-gray-500 font-bold">جاري تحميل الأسئلة...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                <p className="text-gray-500 font-bold">لا توجد أسئلة تطابق بحثك</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filtered.map((q, i) => (
                  <QuestionCard key={q.id} q={q} index={i} userId={user?.uid || ''} />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="ai"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {aiStep === 'upload' && (
              <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-4">
                  <div className="glass-card p-6 space-y-6 border border-white/10">
                    <h3 className="text-lg font-black text-indigo-400 flex items-center gap-2">
                      <LayoutGrid size={20} /> تصنيف المعالجة
                    </h3>
                    <div className="space-y-4">
                      <select
                        value={importGrade}
                        onChange={(e) => setImportGrade(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-indigo-500"
                      >
                        <option value="">اختر الصف...</option>
                        {GRADES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                      <select
                        value={importSubject}
                        onChange={(e) => setImportSubject(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-indigo-500"
                      >
                        <option value="">اختر المادة...</option>
                        {SUBJECTS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="اسم الدرس (تلقائي)..."
                        value={importLesson}
                        onChange={(e) => setImportLesson(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-8 h-full min-h-[350px] border-4 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center gap-6 relative group overflow-hidden">
                  <input
                    type="file"
                    accept="application/pdf"
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <div
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all ${file ? 'bg-indigo-600 text-white animate-bounce' : 'bg-white/5 text-gray-500 group-hover:text-indigo-400'}`}
                  >
                    <FileUp size={40} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-black text-white">
                      {file ? file.name : 'اسحب ملف الـ PDF هنا'}
                    </h3>
                    <p className="text-gray-500 font-bold">انقر لاختيار ملف من جهازك</p>
                  </div>
                  {file && (
                    <button
                      onClick={handleAIProcess}
                      className="mt-4 bg-white text-indigo-600 px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all z-20"
                    >
                      بدء التحليل الذكي
                    </button>
                  )}
                </div>
              </div>
            )}

            {aiStep === 'processing' && (
              <div className="glass-card p-16 text-center space-y-8 border border-white/10">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-indigo-600/10 rounded-full" />
                  <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <BrainCircuit
                    className="absolute inset-0 m-auto text-indigo-500 animate-pulse"
                    size={40}
                  />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-white">{processStatus}</h2>
                  <p className="text-gray-500 font-black animate-pulse">
                    فضلاً انتظر حتى تنتهي عملية التحليل الفني...
                  </p>
                </div>
                <div className="max-w-md mx-auto h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div
                    className="h-full bg-indigo-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${aiProgress}%` }}
                  />
                </div>
              </div>
            )}

            {aiStep === 'review' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-indigo-600/10 border border-indigo-600/20 p-5 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black">
                      {aiQuestions.length}
                    </div>
                    <p className="text-sm font-black text-indigo-400">
                      تأكد من مراجعة الأسئلة قبل الحفظ
                    </p>
                  </div>
                  <button
                    onClick={saveAIQuestions}
                    disabled={saving}
                    className="bg-white text-indigo-600 px-8 py-3 rounded-xl font-black flex items-center gap-2 hover:scale-105 transition-all"
                  >
                    <Database size={18} /> {saving ? 'جاري الحفظ...' : 'اعتماد وحفظ'}
                  </button>
                </div>
                {aiQuestions.map((q, idx) => (
                  <div key={q.id} className="glass-card p-6 border border-white/5 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <span className="text-indigo-400 font-black"># {idx + 1}</span>
                        <h4 className="text-lg font-black text-white leading-tight">
                          {q.question}
                        </h4>
                      </div>
                      <button
                        onClick={() => setAiQuestions((prev) => prev.filter((x) => x.id !== q.id))}
                        className="text-red-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      {q.options.map((opt, oi) => (
                        <div
                          key={oi}
                          className={`p-3 rounded-xl border text-sm font-bold ${opt === q.correctAnswer ? 'bg-indigo-600/20 border-indigo-600/50 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <div className="p-3 bg-white/5 rounded-xl text-xs text-gray-500 leading-relaxed">
                        <Info size={14} className="inline ml-1" /> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


