import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Upload,
  CheckCircle,
  X,
  ChevronDown,
  Loader,
  Trash2,
  Save,
  Eye,
  Clock,
  BookOpen,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  AlertCircle,
  ClipboardList,
  Calendar,
} from 'lucide-react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { extractTextFromPDF, parseMcqWithRegex } from '../../utils/pdf';
import { generateQuestionsFromAI, RawAIQuestion } from '../../lib/gemini';

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
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const DIFFICULTY_LABEL: Record<string, string> = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };

interface ExamQuestion {
  id: string;
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  explanation: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

const emptyQuestion = (): ExamQuestion => ({
  id: generateId(),
  questionText: '',
  options: ['', '', '', ''],
  correctOptionIndex: 0,
  explanation: '',
  chapter: '',
  difficulty: 'medium',
});

// ─── Preview Modal ────────────────────────────────────────────
const PreviewModal: React.FC<{ exam: any; questions: ExamQuestion[]; onClose: () => void }> = ({
  exam,
  questions,
  onClose,
}) => {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const q = questions[current];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[#0a0f1c] border border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-emerald-600/5">
          <div>
            <h2 className="text-xl font-black text-white">{exam.title || 'معاينة الامتحان'}</h2>
            <p className="text-emerald-400 text-xs font-bold mt-0.5">
              {exam.subject} · {exam.grade} · {exam.duration} دقيقة
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {/* Question */}
        {q ? (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
              <span>
                السؤال {current + 1} من {questions.length}
              </span>
              <span className="px-3 py-1 bg-white/5 rounded-full">
                {DIFFICULTY_LABEL[q.difficulty]}
              </span>
            </div>
            <p className="text-white font-bold text-lg leading-relaxed">
              {q.questionText || '(نص السؤال سيظهر هنا)'}
            </p>
            <div className="space-y-3">
              {(['أ', 'ب', 'ج', 'د'] as const).map((letter, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border font-bold text-right transition-all ${
                    selected === i
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:border-emerald-500/30'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      selected === i ? 'bg-emerald-600 text-white' : 'bg-white/5 text-gray-500'
                    }`}
                  >
                    {letter}
                  </span>
                  {q.options[i] || `(الاختيار ${letter})`}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                disabled={current === 0}
                onClick={() => {
                  setCurrent((c) => c - 1);
                  setSelected(null);
                }}
                className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-black rounded-xl disabled:opacity-30 hover:bg-white/10 transition-all"
              >
                ← السابق
              </button>
              <button
                disabled={current === questions.length - 1}
                onClick={() => {
                  setCurrent((c) => c + 1);
                  setSelected(null);
                }}
                className="flex-1 py-3 bg-emerald-600 text-white font-black rounded-xl disabled:opacity-30 hover:bg-emerald-500 transition-all"
              >
                التالي →
              </button>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-400 font-bold">لا توجد أسئلة للمعاينة</div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ─── Question Builder Card ─────────────────────────────────────
const QuestionCard: React.FC<{
  q: ExamQuestion;
  index: number;
  onChange: (id: string, field: string, val: any) => void;
  onRemove: (id: string) => void;
}> = ({ q, index, onChange, onRemove }) => {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-6 py-4 text-right hover:bg-white/5 transition-all"
      >
        <GripVertical size={18} className="text-gray-600" />
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">
            {q.questionText || `السؤال ${index + 1} (انقر للتحرير)`}
          </p>
          <p className="text-gray-500 text-xs font-bold mt-0.5">
            {DIFFICULTY_LABEL[q.difficulty]} · {q.chapter || 'الفصل غير محدد'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(q.id);
            }}
            className="p-2 text-gray-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10"
          >
            <Trash2 size={16} />
          </button>
          <ChevronDown
            size={18}
            className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-6 space-y-4">
              {/* Question text */}
              <textarea
                value={q.questionText}
                onChange={(e) => onChange(q.id, 'questionText', e.target.value)}
                rows={2}
                placeholder="نص السؤال..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 resize-none placeholder-gray-600 text-sm"
              />

              {/* Chapter + Difficulty */}
              <div className="grid grid-cols-2 gap-4">
                <input
                  value={q.chapter}
                  onChange={(e) => onChange(q.id, 'chapter', e.target.value)}
                  placeholder="الفصل / الوحدة"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-emerald-500/50 text-sm placeholder-gray-600"
                />
                <select
                  value={q.difficulty}
                  onChange={(e) => onChange(q.id, 'difficulty', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold appearance-none focus:outline-none focus:border-emerald-500/50 text-sm"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY_LABEL[d]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Options */}
              <div className="space-y-2">
                {(['أ', 'ب', 'ج', 'د'] as const).map((letter, i) => {
                  const opts = [...q.options] as [string, string, string, string];
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <button
                        onClick={() => onChange(q.id, 'correctOptionIndex', i)}
                        className={`w-8 h-8 rounded-lg font-black text-xs shrink-0 border transition-all ${
                          q.correctOptionIndex === i
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-white/5 border-white/10 text-gray-500 hover:border-emerald-500/40'
                        }`}
                      >
                        {letter}
                      </button>
                      <input
                        value={opts[i]}
                        onChange={(e) => {
                          opts[i] = e.target.value;
                          onChange(q.id, 'options', opts);
                        }}
                        placeholder={`الاختيار ${letter}`}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-emerald-500/50 text-sm placeholder-gray-600"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              <input
                value={q.explanation}
                onChange={(e) => onChange(q.id, 'explanation', e.target.value)}
                placeholder="شرح الحل (اختياري)..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-emerald-500/50 text-sm placeholder-gray-600"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────
export const AddExam: React.FC = () => {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [examMeta, setExamMeta] = useState({
    title: '',
    courseId: '',
    subject: '',
    grade: '',
    duration: 30,
    opensAt: '',
    isActive: true,
    allowRetake: false,
    retakeDelay: 0,
  });
  const [courses, setCourses] = useState<any[]>([]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([emptyQuestion()]);
  const [saving, setSaving] = useState(false);
  const { sendNotification } = useNotifications();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const [extractedRawText, setExtractedRawText] = useState('');
  const [showRawTextField, setShowRawTextField] = useState(false);

  React.useEffect(() => {
    const fetchCourses = async () => {
      if (!profile?.uid) return;
      try {
        const results: any[] = [];
        const collections = ['Courses', 'courses'];

        for (const collName of collections) {
          const q = query(collection(db, collName), where('teacherId', '==', profile.uid));
          const snap = await getDocs(q);
          snap.docs.forEach((d) => {
            if (!results.find((existing) => existing.id === d.id)) {
              results.push({ id: d.id, ...d.data() });
            }
          });
        }
        setCourses(results);
      } catch (err) {
        console.error('Failed to load courses with deep scan', err);
      }
    };
    fetchCourses();
  }, [profile?.uid]);

  const updateQuestion = (id: string, field: string, val: any) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, [field]: val } : q)));
  };
  const removeQuestion = (id: string) => setQuestions((qs) => qs.filter((q) => q.id !== id));
  const addQuestion = () => setQuestions((qs) => [...qs, emptyQuestion()]);

  const parseCSVQuestions = (text: string): ExamQuestion[] => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines
      .slice(1)
      .map((line) => {
        const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((h, i) => (obj[h] = vals[i] || ''));
        return {
          id: generateId(),
          questionText: obj.questionText || obj['السؤال'] || '',
          options: [
            obj.optionA || obj['أ'] || '',
            obj.optionB || obj['ب'] || '',
            obj.optionC || obj['ج'] || '',
            obj.optionD || obj['د'] || '',
          ] as [string, string, string, string],
          correctOptionIndex: parseInt(obj.correctOptionIndex || '0'),
          explanation: obj.explanation || obj['الشرح'] || '',
          chapter: obj.chapter || obj['الفصل'] || '',
          difficulty: (obj.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
        };
      })
      .filter((q) => q.questionText);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCSVQuestions(ev.target?.result as string);
        setQuestions((qs) => [...qs.filter((q) => q.questionText), ...parsed]);
      } catch {
        setError('خطأ في قراءة الملف');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleAiPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      setError('يرجى اختيار ملف PDF صحيح');
      return;
    }

    setAiLoading(true);
    setError('');
    try {
      // 1. Extract Text
      const fullText = await extractTextFromPDF(file);

      // 2. Generate Questions via Gemini (Direct)
      let aiQuestions: RawAIQuestion[] = [];
      setExtractedRawText(fullText); // Store text in case of failure

      try {
        aiQuestions = await generateQuestionsFromAI(fullText);
      } catch (aiErr) {
        console.warn('AI extraction failed, trying fallback pattern matcher...', aiErr);
        aiQuestions = parseMcqWithRegex(fullText);

        if (aiQuestions.length === 0) {
          setShowRawTextField(true); // Show the text to the teacher if both fail
          throw new Error(
            "تعذر تحديد الأسئلة تلقائياً. يمكنك نسخ النص من مربع 'النص الخام' أدناه وتنظيمه."
          );
        }

        sendNotification({
          title: 'تنبيه: تم استخدام المحرك البديل',
          message: 'تعذر الاتصال بالذكاء الاصطناعي، تم استخراج الأسئلة باستخدام المحلل النمطي.',
          type: 'info',
        });
      }

      // 3. Transform and Add
      const transformed: ExamQuestion[] = aiQuestions.map((q) => ({
        id: generateId(),
        questionText: q.question || '',
        options: (q.options?.length === 4 ? q.options : ['', '', '', '']) as [
          string,
          string,
          string,
          string,
        ],
        correctOptionIndex: parseInt(q.correctAnswer as any) || 0,
        explanation: q.explanation || '',
        chapter: q.category || '',
        difficulty: (q.difficulty || 'medium') as any,
      }));

      if (transformed.length === 0) throw new Error('لم يتم العثور على أسئلة واضحة في الملف.');

      setQuestions((qs) => [...qs.filter((q) => q.questionText), ...transformed]);
      sendNotification({
        title: 'تم الاستخراج بنجاح!',
        message: `تم استخراج ${transformed.length} أسئلة من ملف الـ PDF عبر الذكاء الاصطناعي.`,
        type: 'success',
      });
    } catch (err: any) {
      setError(err.message || 'فشل تحليل الملف بالذكاء الاصطناعي');
    } finally {
      setAiLoading(false);
      if (aiFileInputRef.current) aiFileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!examMeta.title || !examMeta.courseId || !examMeta.subject || !examMeta.grade) {
      setError('يرجى ملء عنوان الامتحان واختيار الكورس المرتبط به.');
      return;
    }
    if (questions.filter((q) => q.questionText).length === 0) {
      setError('يرجى إضافة سؤال واحد على الأقل');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const validQuestions = questions.filter((q) => q.questionText);
      await addDoc(collection(db, 'exams'), {
        ...examMeta,
        teacherId: profile?.uid,
        teacherName: profile?.displayName,
        questions: validQuestions,
        questionCount: validQuestions.length,
        isActive: examMeta.isActive,
        allowRetake: examMeta.allowRetake || false,
        createdAt: new Date().toISOString(),
      });
      // Send notification if Exam is active/published
      if (examMeta.isActive) {
        await sendNotification({
          title: 'اختبار جديد بانتظارك!',
          message: `تم إضافة اختبار "${examMeta.title}" في مادة ${examMeta.subject}.`,
          type: 'info',
          targetGroupId: examMeta.courseId || 'all',
          targetGrade: examMeta.grade,
          targetRole: 'student',
          link: '/revisions',
          senderName: profile?.displayName || 'مدرس المادة',
        });
      }

      setSuccess(true);
      setExamMeta({
        title: '',
        courseId: '',
        subject: '',
        grade: '',
        duration: 30,
        opensAt: '',
        isActive: true,
        allowRetake: false,
        retakeDelay: 0,
      });
      setQuestions([emptyQuestion()]);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!profile)
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-8 pb-20" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white font-display tracking-tight">
            إضافة <span className="text-emerald-400">امتحان</span>
          </h1>
          <p className="text-gray-400 font-bold mt-1">ابنِ امتحانًا كاملاً وارفعه للطلاب مباشرة</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 text-white font-black rounded-xl hover:bg-white/10 transition-all text-sm"
          >
            <Eye size={16} /> معاينة
          </button>
          <div className="w-14 h-14 bg-emerald-600/20 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            <FileText className="text-emerald-400 w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Exam Header Form */}
      <div className="bg-white/5 rounded-[2rem] border border-white/10 p-6 md:p-8 space-y-6">
        <h2 className="text-white font-black flex items-center gap-3">
          <BookOpen size={20} className="text-emerald-400" /> بيانات الامتحان الأساسية
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Title */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
              عنوان الامتحان *
            </label>
            <input
              value={examMeta.title}
              onChange={(e) => setExamMeta((m) => ({ ...m, title: e.target.value }))}
              placeholder="مثال: امتحان الفيزياء - الفصل الأول"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all placeholder-gray-600 text-lg"
            />
          </div>

          {/* Course */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
              الكورس المخصص للامتحان *
            </label>
            <div className="relative">
              <select
                value={examMeta.courseId}
                onChange={(e) => {
                  const selectedCourse = courses.find((c) => c.id === e.target.value);
                  if (selectedCourse) {
                    setExamMeta((m) => ({
                      ...m,
                      courseId: selectedCourse.id,
                      subject: selectedCourse.subject || 'مادة',
                      grade: selectedCourse.grade || 'صف',
                    }));
                  } else {
                    setExamMeta((m) => ({ ...m, courseId: e.target.value }));
                  }
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold appearance-none focus:outline-none focus:border-emerald-500/50 transition-all text-lg"
              >
                <option value="" className="bg-space-950 text-gray-400">
                  اختر الكورس ليتم ربط الطلاب به تلقائيًا...
                </option>
                {courses.map((c) => (
                  <option className="bg-space-950" key={c.id} value={c.id}>
                    {c.title} ({c.grade})
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={16}
              />
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
              المادة (تلقائي)
            </label>
            <div className="relative">
              <input
                value={examMeta.subject}
                onChange={(e) => setExamMeta((m) => ({ ...m, subject: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
          </div>

          {/* Grade */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
              الصف الدراسي (تلقائي)
            </label>
            <div className="relative">
              <input
                value={examMeta.grade}
                onChange={(e) => setExamMeta((m) => ({ ...m, grade: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Duration */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                <Clock size={12} className="inline ml-1" />
                مدة الامتحان (دقيقة)
              </label>
              <input
                type="number"
                min={5}
                max={180}
                value={examMeta.duration}
                onChange={(e) =>
                  setExamMeta((m) => ({ ...m, duration: parseInt(e.target.value) || 30 }))
                }
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>

            {/* Scheduled Opening Time */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                <Calendar size={12} className="inline ml-1" /> موعد الفتح (اختياري)
              </label>
              <input
                type="datetime-local"
                value={examMeta.opensAt}
                onChange={(e) => setExamMeta((m) => ({ ...m, opensAt: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-4 md:col-span-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
              إعدادات الظهور والإعادة
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setExamMeta((m) => ({ ...m, isActive: !m.isActive }))}
                className={`flex items-center justify-between px-5 py-4 rounded-2xl border font-black text-sm transition-all ${
                  examMeta.isActive
                    ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  {examMeta.isActive ? (
                    <ToggleRight size={22} className="text-emerald-400" />
                  ) : (
                    <ToggleLeft size={22} />
                  )}
                  <span>تفعيل الامتحان للطلاب</span>
                </div>
                <span className="text-[10px] opacity-60">
                  {examMeta.isActive ? 'نشط' : 'مسودة'}
                </span>
              </button>

              <button
                onClick={() => setExamMeta((m) => ({ ...m, allowRetake: !m.allowRetake }))}
                className={`flex items-center justify-between px-5 py-4 rounded-2xl border font-black text-sm transition-all ${
                  examMeta.allowRetake
                    ? 'bg-blue-600/10 border-blue-500/30 text-blue-400'
                    : 'bg-white/5 border-white/10 text-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  {examMeta.allowRetake ? (
                    <ToggleRight size={22} className="text-blue-400" />
                  ) : (
                    <ToggleLeft size={22} />
                  )}
                  <span>السماح بإعادة المحاولة</span>
                </div>
                <span className="text-[10px] opacity-60">
                  {examMeta.allowRetake ? 'مسموح' : 'مرة واحدة'}
                </span>
              </button>

              {examMeta.allowRetake && (
                <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase">
                      ساعات الانتظار للإعادة
                    </label>
                    <input
                      type="number"
                      value={examMeta.retakeDelay}
                      onChange={(e) =>
                        setExamMeta((m) => ({ ...m, retakeDelay: Number(e.target.value) }))
                      }
                      className="w-full bg-transparent text-white font-black text-sm focus:outline-none"
                      min="0"
                    />
                  </div>
                  <Clock size={20} className="text-gray-500" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Questions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black flex items-center gap-3">
            <ClipboardList size={20} className="text-emerald-400" />
            الأسئلة ({questions.filter((q) => q.questionText).length} / {questions.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => aiFileInputRef.current?.click()}
              disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-xl hover:bg-emerald-600/20 transition-all text-sm shadow-lg shadow-emerald-500/5 group"
            >
              {aiLoading ? (
                <Loader size={15} className="animate-spin" />
              ) : (
                <Upload size={15} className="group-hover:scale-110 transition-transform" />
              )}
              {aiLoading ? 'جاري التحليل...' : 'استيراد PDF (بالذكاء الاصطناعي)'}
            </button>
            <input
              ref={aiFileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleAiPdfUpload}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-gray-300 font-bold rounded-xl hover:border-emerald-500/40 transition-all text-sm"
            >
              <Upload size={15} /> CSV جماعي
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              onClick={addQuestion}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-xl hover:bg-emerald-600/20 transition-all text-sm"
            >
              <Plus size={15} /> سؤال جديد
            </button>
          </div>
        </div>

        {/* 📝 Raw Text Fallback Area */}
        <AnimatePresence>
          {showRawTextField && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-3 bg-amber-500/5 border border-amber-500/20 p-6 rounded-[2rem] overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <p className="text-amber-500 font-black text-xs flex items-center gap-2">
                  <AlertCircle size={14} /> النص المستخرج من الملف (Raw Text)
                </p>
                <button
                  onClick={() => setShowRawTextField(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <textarea
                value={extractedRawText}
                onChange={(e) => setExtractedRawText(e.target.value)}
                rows={6}
                className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-xs text-gray-400 font-medium font-mono focus:outline-none focus:border-amber-500/30"
                placeholder="الصق نص الامتحان هنا إذا فشل الاستخراج التلقائي..."
              />
              <p className="text-[10px] text-amber-500/60 font-bold italic">
                * يمكنك نسخ الأسئلة من هنا وإضافتها يدوياً باستخدام زر "سؤال جديد" أعلاه.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          <AnimatePresence>
            {questions.map((q, i) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <QuestionCard q={q} index={i} onChange={updateQuestion} onRemove={removeQuestion} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Add Question Button */}
        <button
          onClick={addQuestion}
          className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-gray-400 font-bold hover:border-emerald-500/30 hover:text-emerald-400 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={18} /> إضافة سؤال آخر
        </button>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-bold text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-5 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 font-black"
          >
            <CheckCircle size={20} />
            تم حفظ الامتحان بنجاح في Firestore! 🎉
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-2xl shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-3 text-lg"
      >
        {saving ? <Loader className="animate-spin" size={22} /> : <Save size={22} />}
        {saving ? 'جاري الحفظ...' : 'حفظ الامتحان كاملاً في Firestore'}
      </button>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <PreviewModal
            exam={examMeta}
            questions={questions}
            onClose={() => setShowPreview(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AddExam;
