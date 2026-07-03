import React, { useState } from 'react';
import {
  FileUp,
  Database,
  BrainCircuit,
  Loader2,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Save,
  Plus,
  ChevronDown,
  Search,
  BookOpen,
  GraduationCap,
  LayoutGrid,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { extractTextFromPDF } from '../../utils/pdf';
import { generateQuestionsFromAI, RawAIQuestion } from '../../lib/gemini';

interface ReviewQuestion extends RawAIQuestion {
  id: string;
  selected: boolean;
}

const GRADES = [
  'أولى ثانوي',
  'تانية ثانوي',
  'تالتة ثانوي',
  'أولى إعدادي',
  'تانية إعدادي',
  'تالتة إعدادي',
];
const SUBJECTS = [
  'كيمياء',
  'فيزياء',
  'أحياء',
  'رياضيات',
  'لغة عربية',
  'لغة إنجليزية',
  'جيولوجيا',
  'تاريخ',
  'جغرافيا',
];

export const QuestionBank: React.FC = () => {
  const { profile } = useAuth();
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');

  // Metadata
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [lessonName, setLessonName] = useState('');

  // Processing state
  const [file, setFile] = useState<File | null>(null);
  const [processStatus, setProcessStatus] = useState('');
  const [progress, setProgress] = useState(0);

  // Questions state
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const startAIProcessing = async () => {
    if (!file || !grade || !subject) {
      setError('يرجى اختيار الملف وتحديد المرحلة والمادة أولاً');
      return;
    }

    setStep('processing');
    setError(null);
    try {
      // Step 1: Extract Text
      setProcessStatus('جاري استخراج النصوص من ملف PDF...');
      setProgress(20);
      const extractedText = await extractTextFromPDF(file);

      // Step 2: AI Analysis
      setProcessStatus('جاري تحليل المحتوى وتوليد الأسئلة بواسطة الذكاء الاصطناعي...');
      setProgress(50);
      const aiResults = await generateQuestionsFromAI(extractedText);

      // Step 3: Preparation
      setProcessStatus('جاري تجهيز قائمة المراجعة...');
      setProgress(80);

      const formatted = aiResults.map((q, idx) => ({
        ...q,
        id: `q-${Date.now()}-${idx}`,
        selected: true,
      }));

      setQuestions(formatted);
      if (formatted.length > 0 && formatted[0].category) {
        setLessonName(formatted[0].category);
      }

      setProgress(100);
      setTimeout(() => setStep('review'), 500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ أثناء المعالجة');
      setStep('upload');
    }
  };

  const toggleSelect = (id: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, selected: !q.selected } : q)));
  };

  const updateQuestion = (id: string, updates: Partial<ReviewQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const saveToFirestore = async () => {
    const selected = questions.filter((q) => q.selected);
    if (selected.length === 0) {
      setError('يرجى تحديد سؤال واحد على الأقل للحفظ');
      return;
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);

      selected.forEach((q) => {
        const qRef = doc(collection(db, 'question_bank'));
        // Map correct text back to index to match platform logic
        const correctIndex = q.options.findIndex((opt) => opt === q.correctAnswer);

        batch.set(qRef, {
          question: q.question,
          options: q.options,
          correctIndex: correctIndex === -1 ? 0 : correctIndex,
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          lessonName: lessonName || q.category || 'عام',
          grade,
          subject,
          teacherId: profile?.uid,
          teacherName: profile?.displayName || 'مدرس',
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();
      setSaveSuccess(true);
      setTimeout(() => {
        setStep('upload');
        setQuestions([]);
        setSaveSuccess(false);
        setFile(null);
      }, 3000);
    } catch (err) {
      console.error(err);
      setError('فشل حفظ الأسئلة في قاعدة البيانات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 text-right pb-20" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-indigo-600/10 text-indigo-500 rounded-3xl flex items-center justify-center shrink-0 shadow-2xl shadow-indigo-500/5 border border-indigo-500/10 transition-transform hover:scale-105 duration-500">
            <BrainCircuit size={36} />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white leading-none tracking-tight mb-2">
              بنك الأسئلة الذكي
            </h1>
            <p className="text-gray-400 text-xs md:text-sm font-bold opacity-80">
              حول ملفات PDF إلى أسئلة احترافية في ثوانٍ باستخدام Gemini AI
            </p>
          </div>
        </div>

        {step === 'review' && (
          <div className="flex gap-4">
            <button
              onClick={() => setStep('upload')}
              className="bg-white/5 hover:bg-white/10 text-white px-6 py-4 rounded-2xl font-black border border-white/5 transition-all text-sm"
            >
              إلغاء والمعالجة مرة أخرى
            </button>
            <button
              onClick={saveToFirestore}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-indigo-600/30 flex items-center gap-3 active:scale-95 transition-all"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Database size={20} />}
              {saving ? 'جاري الحفظ...' : 'اعتماد وحفظ بالبنك'}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="grid lg:grid-cols-12 gap-10"
          >
            <div className="lg:col-span-4 space-y-6">
              <div className="glass-card p-8 border border-white/5 space-y-6">
                <h3 className="text-xl font-black text-indigo-400 flex items-center gap-2">
                  <LayoutGrid size={22} /> تصنيف الأسئلة
                </h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest mr-1">
                      المرحلة الدراسية
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-indigo-500 transition-all appearance-none"
                    >
                      <option value="">اختر المرحلة...</option>
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest mr-1">
                      المادة
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-indigo-500 transition-all appearance-none"
                    >
                      <option value="">اختر المادة...</option>
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest mr-1">
                      اسم الدرس (يتم استنتاجه تلقائياً)
                    </label>
                    <input
                      type="text"
                      value={lessonName}
                      onChange={(e) => setLessonName(e.target.value)}
                      placeholder="اتركه فارغاً للاستنتاج..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 bg-indigo-600/10 border border-indigo-600/20 rounded-3xl flex items-start gap-4">
                <Info className="text-indigo-400 shrink-0" size={24} />
                <p className="text-indigo-300 text-xs font-bold leading-relaxed">
                  نظام الذكاء الاصطناعي يقوم بتحليل النصوص واستخراج الأفكار الرئيسية وتحويلها لأسئلة
                  MCQ متوافقة مع النظام الجديد. تأكد من أن الملف بصيغة PDF قابلة للقراءة.
                </p>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div
                className={`h-full min-h-[400px] border-4 border-dashed rounded-[3rem] p-12 flex flex-col items-center justify-center gap-6 transition-all group relative overflow-hidden
                  ${file ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/5 hover:border-white/20'}`}
              >
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />

                <div
                  className={`w-24 h-24 rounded-[2rem] flex items-center justify-center transition-all
                    ${file ? 'bg-indigo-600 text-white animate-bounce' : 'bg-white/5 text-gray-500 group-hover:scale-110 group-hover:text-indigo-500 group-hover:bg-indigo-500/10'}`}
                >
                  <FileUp size={48} />
                </div>

                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-black text-white">
                    {file ? file.name : 'اسحب ملف الـ PDF هنا'}
                  </h3>
                  <p className="text-gray-500 font-bold">أو اضغط لاختيار الملف من جهازك</p>
                </div>

                {file && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startAIProcessing();
                    }}
                    className="mt-6 bg-white text-indigo-600 px-12 py-5 rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all relative z-20"
                  >
                    بدء التحليل الذكي
                  </button>
                )}

                {error && (
                  <p className="text-red-500 font-black text-sm mt-4 flex items-center gap-2">
                    <AlertCircle size={18} /> {error}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-20 text-center space-y-10 border border-white/10 overflow-hidden"
          >
            <div className="relative w-32 h-32 mx-auto">
              <div className="absolute inset-0 border-8 border-indigo-600/10 rounded-full" />
              <div className="absolute inset-0 border-8 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 text-indigo-500 flex items-center justify-center">
                <BrainCircuit size={48} className="animate-pulse" />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-black text-white">{processStatus}</h2>
              <p className="text-gray-500 font-black animate-pulse">
                يرجى عدم غلق الصفحة حتى تنتهي المعالجة...
              </p>
            </div>

            <div className="max-w-md mx-auto h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.5)]"
              />
            </div>
          </motion.div>
        )}

        {/* Step 3: Review Queue */}
        {step === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="bg-indigo-600/10 border border-indigo-600/20 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl">
                  {questions.length}
                </div>
                <div>
                  <p className="text-sm font-black text-indigo-400">
                    نم استخراج {questions.length} سؤال بنجاح
                  </p>
                  <p className="text-xs text-gray-500 font-bold">
                    يرجى مراجعة الأسئلة وتعديلها قبل الاعتماد النهائي
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400">تصفية حسب الصعوبة:</span>
                {['easy', 'medium', 'hard'].map((d) => (
                  <button
                    key={d}
                    className="px-3 py-1 bg-white/5 text-gray-400 text-[10px] font-black uppercase rounded-lg border border-white/5 hover:border-indigo-500/50"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {questions.map((q, qIndex) => (
                <div
                  key={q.id}
                  className={`glass-card p-8 border transition-all ${q.selected ? 'border-indigo-600/30 ring-1 ring-indigo-600/10' : 'border-white/5 opacity-60'}`}
                >
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleSelect(q.id)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${q.selected ? 'bg-indigo-600 text-white' : 'bg-white/5 border border-white/10 text-transparent'}`}
                      >
                        <CheckCircle2 size={20} />
                      </button>
                      <h4 className="text-2xl font-black text-white font-display">
                        السؤال {qIndex + 1}
                      </h4>
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${q.difficulty === 'hard' ? 'bg-red-500/10 text-red-500' : q.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-emerald-500/10 text-emerald-500'}`}
                      >
                        {q.difficulty}
                      </span>
                    </div>
                    <button
                      onClick={() => removeQuestion(q.id)}
                      className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 transition-all hover:text-white"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <input
                      value={q.question}
                      onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-indigo-500"
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      {q.options.map((opt, oIndex) => (
                        <div
                          key={oIndex}
                          className={`flex items-center gap-3 p-3 rounded-2xl border ${opt === q.correctAnswer ? 'bg-indigo-600/10 border-indigo-600/50' : 'bg-white/5 border-white/10'}`}
                        >
                          <button
                            onClick={() => updateQuestion(q.id, { correctAnswer: opt })}
                            className={`w-6 h-6 rounded-lg transition-all ${opt === q.correctAnswer ? 'bg-indigo-600 shadow-lg' : 'bg-white/10'}`}
                          />
                          <input
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...q.options];
                              newOpts[oIndex] = e.target.value;
                              updateQuestion(q.id, {
                                options: newOpts,
                                correctAnswer:
                                  opt === q.correctAnswer ? e.target.value : q.correctAnswer,
                              });
                            }}
                            className="flex-1 bg-transparent border-none text-white text-sm font-bold outline-none"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Info size={14} /> شرح الحل (Explanation)
                      </p>
                      <textarea
                        value={q.explanation}
                        onChange={(e) => updateQuestion(q.id, { explanation: e.target.value })}
                        className="w-full bg-transparent border-none text-gray-400 text-sm font-bold outline-none resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-indigo-600 p-12 rounded-[3.5rem] text-center space-y-6 shadow-[0_32px_100px_-16px_rgba(79,70,229,0.5)]"
            >
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto text-indigo-600 shadow-2xl">
                <CheckCircle2 size={64} />
              </div>
              <h2 className="text-4xl font-black text-white">تم الحفظ بنجاح!</h2>
              <p className="text-indigo-100 font-bold max-w-sm">
                تمت إضافة الأسئلة بنجاح إلى بنك الأسئلة الخاص بك وهي متاحة الآن عند إنشاء
                الامتحانات.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
