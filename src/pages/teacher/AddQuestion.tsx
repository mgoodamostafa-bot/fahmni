import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Plus,
  Upload,
  CheckCircle,
  X,
  ChevronDown,
  Loader,
  FileText,
  Trash2,
  Save,
} from 'lucide-react';
import { collection, addDoc, writeBatch, doc, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { extractTextFromPDF, parseMcqWithRegex } from '../../utils/pdf';
import { generateQuestionsFromAI, RawAIQuestion } from '../../lib/gemini';
import { useNotifications } from '../../contexts/NotificationContext';

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
const DIFFICULTIES = [
  { value: 'easy', label: 'سهل', color: 'text-green-400' },
  { value: 'medium', label: 'متوسط', color: 'text-amber-400' },
  { value: 'hard', label: 'صعب', color: 'text-red-400' },
];

interface QuestionForm {
  courseId: string;
  grade: string;
  subject: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  explanation: string;
  imageUrl?: string;
  pdfLink?: string;
}

const emptyForm = (): QuestionForm => ({
  courseId: '',
  grade: '',
  subject: '',
  chapter: '',
  difficulty: 'medium',
  questionText: '',
  options: ['', '', '', ''],
  correctOptionIndex: 0,
  explanation: '',
  imageUrl: '',
  pdfLink: '',
});

export const AddQuestion: React.FC = () => {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<QuestionForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'ai'>('single');
  const [aiLoading, setAiLoading] = useState(false);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const { sendNotification } = useNotifications();
  const [courses, setCourses] = useState<any[]>([]);

  // Edit State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

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

  const updateOption = (i: number, val: string) => {
    const o = [...form.options] as [string, string, string, string];
    o[i] = val;
    setForm((f) => ({ ...f, options: o }));
  };

  const handleSave = async () => {
    if (
      !form.courseId ||
      !form.grade ||
      !form.subject ||
      !form.questionText ||
      form.options.some((o) => !o)
    ) {
      setError('يرجى ملء الكورس والسؤال والخيارات كمطلوب أدنى');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addDoc(collection(db, 'Questions'), {
        ...form,
        teacherId: profile?.uid,
        createdAt: new Date().toISOString(),
      });
      setSuccess(true);
      setForm(emptyForm());
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length < 2) return [];

    // Robust CSV parser using regex to handle quotes and commas inside them
    const parseLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const headers = parseLine(lines[0]);
    return lines.slice(1).map((line) => {
      const vals = parseLine(line);
      const obj: any = {};
      headers.forEach((h, i) => {
        const key = h.toLowerCase();
        obj[key] = vals[i] || '';
      });

      return {
        grade: obj.grade || obj['الصف'] || '',
        subject: obj.subject || obj['المادة'] || '',
        chapter: obj.chapter || obj['الفصل'] || '',
        difficulty: (obj.difficulty || obj['الصعوبة'] || 'medium').toLowerCase(),
        questionText: obj.questiontext || obj['السؤال'] || '',
        options: [
          obj.optiona || obj['أ'] || obj['a'] || '',
          obj.optionb || obj['ب'] || obj['b'] || '',
          obj.optionc || obj['ج'] || obj['c'] || '',
          obj.optiond || obj['د'] || obj['d'] || '',
        ],
        correctOptionIndex: parseInt(obj.correctoptionindex || obj['الإجابة الصحيحة'] || '0'),
        explanation: obj.explanation || obj['الشرح'] || '',
        imageUrl: obj.imageurl || obj['رابط الصورة'] || '',
        pdfLink: obj.pdflink || obj['رابط المرفق'] || '',
        teacherId: profile?.uid,
        createdAt: new Date().toISOString(),
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseCSV(text);
        setBulkPreview(parsed);
        setBulkDone(false);
      } catch {
        setError('خطأ في قراءة الملف. تأكد من أنه CSV صحيح.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleBulkUpload = async () => {
    if (!bulkPreview.length) return;
    setBulkUploading(true);
    setError('');
    try {
      const CHUNK = 500;
      for (let i = 0; i < bulkPreview.length; i += CHUNK) {
        const batch = writeBatch(db);
        bulkPreview.slice(i, i + CHUNK).forEach((q) => {
          // Ensure course mapping for AI items if needed
          const data = {
            ...q,
            courseId: q.courseId || form.courseId,
            grade: q.grade || form.grade,
            subject: q.subject || form.subject,
            teacherId: profile?.uid,
            createdAt: new Date().toISOString(),
          };
          batch.set(doc(collection(db, 'Questions')), data);
        });
        await batch.commit();
      }
      setBulkDone(true);
      setBulkPreview([]);
      sendNotification({
        title: 'تم الرفع بنجاح!',
        message: `تمت إضافة جميع الأسئلة إلى بنك الأسئلة بنجاح.`,
        type: 'success',
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBulkUploading(false);
    }
  };

  const handleAiPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      setError('يرجى اختيار ملف PDF صحيح');
      return;
    }

    if (!form.courseId) {
      setError('يرجى اختيار الكورس أولاً لربط الأسئلة به');
      return;
    }

    setAiLoading(true);
    setError('');
    setBulkDone(false);
    try {
      const fullText = await extractTextFromPDF(file);

      // 🔄 Direct Fetch + Regex Fallback Loop
      let aiQuestions: RawAIQuestion[] = [];
      try {
        aiQuestions = await generateQuestionsFromAI(fullText);
      } catch (aiErr) {
        console.warn('AI extraction failed, trying fallback pattern matcher...', aiErr);
        aiQuestions = parseMcqWithRegex(fullText);
        if (aiQuestions.length === 0) throw aiErr;

        sendNotification({
          title: 'تم استخدام المحرك السريع',
          message: 'تعذر الاتصال بالذكاء الاصطناعي، تم استخدام المحلل النمطي لاستخراج الأسئلة.',
          type: 'info',
        });
      }

      const parsed = aiQuestions.map((q) => ({
        grade: form.grade,
        subject: form.subject,
        chapter: q.category || '',
        difficulty: (q.difficulty || 'medium') as any,
        questionText: q.question || '',
        options: q.options?.length === 4 ? q.options : ['', '', '', ''],
        correctOptionIndex: parseInt(q.correctAnswer as any) || 0,
        explanation: q.explanation || '',
        courseId: form.courseId,
        teacherId: profile?.uid,
        createdAt: new Date().toISOString(),
      }));

      if (parsed.length === 0) throw new Error('لم يتم العثور على أسئلة في الملف.');

      setBulkPreview(parsed);
      sendNotification({
        title: 'تم استخراج الأسئلة!',
        message: `تم استخراج ${parsed.length} أسئلة بنجاح. يرجى المراجعة والضغط على "تأكيد".`,
        type: 'info',
      });
    } catch (err: any) {
      setError(err.message || 'فشل تحليل الملف بالذكاء الاصطناعي');
    } finally {
      setAiLoading(false);
      if (aiFileInputRef.current) aiFileInputRef.current.value = '';
    }
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...bulkPreview[index] });
  };

  const saveEdit = () => {
    if (editingIndex === null || !editForm) return;
    const newPreview = [...bulkPreview];
    newPreview[editingIndex] = editForm;
    setBulkPreview(newPreview);
    setEditingIndex(null);
    setEditForm(null);
  };

  const deletePreviewItem = (index: number) => {
    const newPreview = bulkPreview.filter((_, i) => i !== index);
    setBulkPreview(newPreview);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white font-display tracking-tight">
            إضافة <span className="text-emerald-400">أسئلة</span>
          </h1>
          <p className="text-gray-400 font-bold mt-1">
            أضف أسئلة لبنك الأسئلة يدوياً أو عبر ملف CSV
          </p>
        </div>
        <div className="w-14 h-14 bg-emerald-600/20 rounded-2xl flex items-center justify-center border border-emerald-500/20">
          <ClipboardList className="text-emerald-400 w-7 h-7" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white/5 rounded-2xl p-1.5 border border-white/10 w-fit">
        {[
          { id: 'single', label: 'سؤال واحد', icon: <Plus size={16} /> },
          { id: 'bulk', label: 'رفع CSV جماعي', icon: <Upload size={16} /> },
          { id: 'ai', label: 'استيراد PDF (AI)', icon: <FileText size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'single' && (
          <motion.div
            key="single"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white/5 rounded-[2rem] border border-white/10 p-6 md:p-10 space-y-8"
          >
            {/* Row 1: Course + Grade + Subject + Difficulty */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  الكورس الخاص بالسؤال *
                </label>
                <div className="relative">
                  <select
                    value={form.courseId}
                    onChange={(e) => {
                      const selectedCourse = courses.find((c) => c.id === e.target.value);
                      if (selectedCourse) {
                        setForm({
                          ...form,
                          courseId: selectedCourse.id,
                          subject: selectedCourse.subject || 'مادة',
                          grade: selectedCourse.grade || 'صف',
                        });
                      } else {
                        setForm({ ...form, courseId: e.target.value });
                      }
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold appearance-none focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                  >
                    <option value="" className="bg-space-950 text-gray-400">
                      اختر الكورس ليتم الربط التلقائي...
                    </option>
                    {courses.map((c) => (
                      <option className="bg-space-950 text-white" key={c.id} value={c.id}>
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

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  المادة (تلقائي)
                </label>
                <div className="relative">
                  <input
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  الصف (تلقائي)
                </label>
                <div className="relative">
                  <input
                    value={form.grade}
                    onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  الصعوبة
                </label>
                <div className="flex gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setForm((f) => ({ ...f, difficulty: d.value as any }))}
                      className={`flex-1 py-3 rounded-xl font-black text-sm border transition-all ${
                        form.difficulty === d.value
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chapter */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                الفصل / الوحدة
              </label>
              <input
                value={form.chapter}
                onChange={(e) => setForm((f) => ({ ...f, chapter: e.target.value }))}
                placeholder="مثال: الفصل الأول – الحركة"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all placeholder-gray-600"
              />
            </div>

            {/* Question Text */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                نص السؤال *
              </label>
              <textarea
                value={form.questionText}
                onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))}
                rows={3}
                placeholder="اكتب السؤال هنا..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all resize-none placeholder-gray-600"
              />
            </div>

            {/* Media Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  رابط صورة توضيحية (اختياري)
                </label>
                <input
                  value={form.imageUrl || ''}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://example.com/image.png"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all placeholder-gray-600"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  مرفق PDF (اختياري)
                </label>
                <input
                  value={form.pdfLink || ''}
                  onChange={(e) => setForm((f) => ({ ...f, pdfLink: e.target.value }))}
                  placeholder="https://example.com/file.pdf"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all placeholder-gray-600"
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                الاختيارات * (انقر على الزر لتحديد الإجابة الصحيحة)
              </label>
              {(['أ', 'ب', 'ج', 'د'] as const).map((letter, i) => (
                <div key={i} className="flex items-center gap-3">
                  <button
                    onClick={() => setForm((f) => ({ ...f, correctOptionIndex: i }))}
                    className={`w-10 h-10 rounded-xl font-black text-sm shrink-0 border transition-all ${
                      form.correctOptionIndex === i
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-emerald-500/50'
                    }`}
                  >
                    {letter}
                  </button>
                  <input
                    value={form.options[i]}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`الاختيار ${letter}`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all placeholder-gray-600"
                  />
                  {form.correctOptionIndex === i && (
                    <CheckCircle className="text-emerald-400 shrink-0" size={20} />
                  )}
                </div>
              ))}
            </div>

            {/* Explanation */}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                شرح الحل
              </label>
              <textarea
                value={form.explanation}
                onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
                rows={2}
                placeholder="اكتب شرح الإجابة الصحيحة..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500/50 transition-all resize-none placeholder-gray-600"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-bold text-sm">
                <X size={16} />
                {error}
              </div>
            )}

            {/* Success */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 font-bold text-sm"
                >
                  <CheckCircle size={16} />
                  تم حفظ السؤال بنجاح في Firestore! 🎉
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {saving ? <Loader className="animate-spin" size={20} /> : <Save size={20} />}
              {saving ? 'جاري الحفظ...' : 'حفظ السؤال في Firestore'}
            </button>
          </motion.div>
        )}

        {activeTab === 'bulk' && (
          <motion.div
            key="bulk"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-500/30 rounded-[2rem] p-16 text-center cursor-pointer hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-all group"
            >
              <div className="w-20 h-20 bg-emerald-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Upload className="text-emerald-400 w-10 h-10" />
              </div>
              <h3 className="text-white font-black text-2xl mb-2">ارفع ملف CSV هنا</h3>
              <p className="text-gray-400 font-bold max-w-sm mx-auto">
                تأكد أن الملف يحتوي على أعمدة (السؤال، أ، ب، ج، د، الإجابة الصحيحة)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {bulkPreview.length > 0 && (
              <div className="bg-white/5 rounded-[2rem] border border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-white font-black">معاينة الأسئلة ({bulkPreview.length})</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBulkPreview([])}
                      className="text-xs font-bold text-red-400 border border-red-500/20 px-4 py-2 rounded-xl hover:bg-red-500/10"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>

                <div className="max-h-[500px] overflow-y-auto space-y-3 custom-scrollbar px-2 mb-6">
                  {bulkPreview.map((q, i) => (
                    <div
                      key={i}
                      className="group bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:border-emerald-500/40 transition-all"
                    >
                      <span className="w-8 h-8 bg-emerald-600/20 text-emerald-400 rounded-xl flex items-center justify-center text-xs font-black shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm line-clamp-1">
                          {q.questionText}
                        </p>
                        <p className="text-emerald-500/70 text-[10px] font-black uppercase mt-1">
                          {['أ', 'ب', 'ج', 'د'][q.correctOptionIndex]} | {q.chapter || 'بدون فصل'}
                        </p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditing(i)}
                          className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500 text-white transition-all"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => deletePreviewItem(i)}
                          className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 text-white transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleBulkUpload}
                  disabled={bulkUploading}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-2xl shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-3 text-lg"
                >
                  {bulkUploading ? (
                    <Loader className="animate-spin" size={22} />
                  ) : (
                    <Save size={22} />
                  )}
                  {bulkUploading
                    ? 'جاري رفع البيانات...'
                    : `تأكيد ورفع ${bulkPreview.length} سؤال لبنك الأسئلة`}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'ai' && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* Course Selector (Required for AI) */}
            <div className="bg-white/5 rounded-[2rem] border border-white/10 p-6 md:p-8">
              <div className="max-w-md space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  اختر الكورس المستهدف للأسئلة *
                </label>
                <div className="relative">
                  <select
                    value={form.courseId}
                    onChange={(e) => {
                      const selectedCourse = courses.find((c) => c.id === e.target.value);
                      if (selectedCourse) {
                        setForm({
                          ...form,
                          courseId: selectedCourse.id,
                          subject: selectedCourse.subject || 'مادة',
                          grade: selectedCourse.grade || 'صف',
                        });
                      } else {
                        setForm({ ...form, courseId: e.target.value });
                      }
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold appearance-none focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
                  >
                    <option value="" className="bg-space-950 text-gray-400">
                      اختر الكورس...
                    </option>
                    {courses.map((c) => (
                      <option className="bg-space-950 text-white" key={c.id} value={c.id}>
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
            </div>

            {/* AI Upload Zone */}
            <div
              onClick={() => aiFileInputRef.current?.click()}
              className={`border-2 border-dashed ${aiLoading ? 'border-gray-500 bg-gray-500/5 cursor-not-allowed' : 'border-emerald-500/30 cursor-pointer hover:border-emerald-500/60 hover:bg-emerald-500/5'} rounded-[2rem] p-16 text-center transition-all group relative overflow-hidden`}
            >
              {aiLoading && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  className="absolute bottom-0 left-0 h-1 bg-emerald-500 shadow-[0_0_10px_#10b981]"
                />
              )}
              <div className="w-20 h-20 bg-emerald-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                {aiLoading ? (
                  <Loader className="text-emerald-400 w-10 h-10 animate-spin" />
                ) : (
                  <FileText className="text-emerald-400 w-10 h-10" />
                )}
              </div>
              <h3 className="text-white font-black text-2xl mb-2">
                {aiLoading ? 'جاري تحليل الملف بالذكاء الاصطناعي...' : 'ارفع ملف PDF هنا'}
              </h3>
              <p className="text-gray-400 font-bold max-w-sm mx-auto">
                سيقوم النظام باستخراج الأسئلة والاختيارات (MCQ) آلياً من ملفك ووضعها في بنك الأسئلة.
              </p>
              <input
                ref={aiFileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleAiPdfUpload}
                className="hidden"
                disabled={aiLoading}
              />
            </div>

            {/* AI Results Preview */}
            {bulkPreview.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-white font-black flex items-center gap-2">
                    <CheckCircle size={18} className="text-emerald-400" /> تمت المعالجة:{' '}
                    {bulkPreview.length} سؤال جاهز للرفع
                  </h4>
                  <button
                    onClick={() => setBulkPreview([])}
                    className="text-xs font-bold text-red-400 hover:text-red-300"
                  >
                    إلغاء الكل
                  </button>
                </div>

                <div className="max-h-[500px] overflow-y-auto space-y-3 custom-scrollbar px-2">
                  {bulkPreview.map((q, i) => (
                    <div
                      key={i}
                      className="group bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:border-emerald-500/40 transition-all"
                    >
                      <span className="w-8 h-8 bg-emerald-600/20 text-emerald-400 rounded-xl flex items-center justify-center text-xs font-black shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm line-clamp-1">
                          {q.questionText}
                        </p>
                        <p className="text-emerald-500/70 text-[10px] font-black uppercase mt-1">
                          الإجابة: {['أ', 'ب', 'ج', 'د'][q.correctOptionIndex]}
                        </p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditing(i)}
                          className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500 text-white transition-all"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => deletePreviewItem(i)}
                          className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 text-white transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleBulkUpload}
                  disabled={bulkUploading}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-2xl shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-3 text-lg"
                >
                  {bulkUploading ? (
                    <Loader className="animate-spin" size={22} />
                  ) : (
                    <Save size={22} />
                  )}
                  {bulkUploading
                    ? 'جاري رفع البيانات...'
                    : `تأكيد ورفع ${bulkPreview.length} سؤال لبنك الأسئلة`}
                </button>
              </motion.div>
            )}

            {bulkDone && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 px-6 py-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 font-black"
              >
                <CheckCircle size={20} />
                تمت عملية الاستيراد والحفظ بنجاح! 🎉
              </motion.div>
            )}
            {error && (
              <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-bold text-sm">
                <X size={16} />
                {error}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Edit Question Modal ─── */}
      <AnimatePresence>
        {editingIndex !== null && editForm && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingIndex(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#0d1425] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar text-right"
            >
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => setEditingIndex(null)}
                  className="p-2 bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
                <h3 className="text-2xl font-black text-white">تعديل السؤال</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    نص السؤال
                  </label>
                  <textarea
                    value={editForm.questionText}
                    onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-emerald-500/50 outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    الاختيارات
                  </label>
                  {(['أ', 'ب', 'ج', 'د'] as const).map((letter, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <button
                        onClick={() => setEditForm({ ...editForm, correctOptionIndex: i })}
                        className={`w-10 h-10 rounded-xl font-black shrink-0 border transition-all ${editForm.correctOptionIndex === i ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}
                      >
                        {letter}
                      </button>
                      <input
                        value={editForm.options[i]}
                        onChange={(e) => {
                          const o = [...editForm.options];
                          o[i] = e.target.value;
                          setEditForm({ ...editForm, options: o });
                        }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                      الصعوبة
                    </label>
                    <select
                      value={editForm.difficulty}
                      onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold outline-none"
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d.value} value={d.value} className="bg-space-950">
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                      الفصل
                    </label>
                    <input
                      value={editForm.chapter || ''}
                      onChange={(e) => setEditForm({ ...editForm, chapter: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    شرح الحل
                  </label>
                  <textarea
                    value={editForm.explanation || ''}
                    onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-emerald-500/50"
                  />
                </div>

                <button
                  onClick={saveEdit}
                  className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 transition-all"
                >
                  حفظ التعديلات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AddQuestion;
