import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  addDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Library,
  Folder,
  ChevronLeft,
  Trash2,
  Edit2,
  PlayCircle,
  X,
  Search,
  FileText,
  Loader2,
  Save,
  MoreVertical,
  BookOpen,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Question {
  id: string;
  courseId?: string;
  subject: string;
  grade: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  explanation: string;
}

interface BankGroup {
  id: string; // subject_chapter
  subject: string;
  grade: string;
  chapter: string;
  questions: Question[];
  courseId?: string;
}

export const TeacherQuestionBanks: React.FC = () => {
  const { profile, user } = useAuth();
  const { sendNotification } = useNotifications();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<BankGroup[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCourseTitle, setSelectedCourseTitle] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankGroup | null>(null);
  
  // Modals state
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingBank, setEditingBank] = useState<BankGroup | null>(null);
  
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [examMeta, setExamMeta] = useState({ title: '', duration: 30 });

  const fetchBanks = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'Questions'), where('teacherId', '==', user.uid));
      const snap = await getDocs(q);
      const allQs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question);

      const groups = new Map<string, BankGroup>();
      allQs.forEach((q) => {
        const courseId = q.courseId || 'general';
        const key = `${courseId}_${q.chapter || 'بدون فصل'}`;
        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            subject: q.subject || 'مادة عامة',
            grade: q.grade || 'عام',
            chapter: q.chapter || 'بنك مجمع',
            courseId: q.courseId,
            questions: [],
          });
        }
        groups.get(key)!.questions.push(q);
      });

      const banksList = Array.from(groups.values());
      setBanks(banksList);

      // Sync active selectedBank if open
      if (selectedBank) {
        const updated = banksList.find((b) => b.id === selectedBank.id);
        if (updated) {
          setSelectedBank(updated);
        } else {
          setSelectedBank(null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user?.uid) return;
      try {
        const qUpper = query(collection(db, 'Courses'), where('teacherId', '==', user.uid));
        const qLower = query(collection(db, 'courses'), where('teacherId', '==', user.uid));
        const [snapUpper, snapLower] = await Promise.all([getDocs(qUpper), getDocs(qLower)]);
        const list: any[] = [];
        snapUpper.docs.forEach(d => list.push({ id: d.id, ...d.data() }));
        snapLower.docs.forEach(d => {
          if (!list.find(item => item.id === d.id)) {
            list.push({ id: d.id, ...d.data() });
          }
        });
        setCourses(list);
      } catch (err) {
        console.error('Error fetching courses:', err);
      }
    };
    fetchCourses();
    fetchBanks();
  }, [user]);

  const handleDeleteQuestion = async (qId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السؤال؟')) return;
    
    // Optimistic Update
    if (selectedBank) {
      setSelectedBank({
        ...selectedBank,
        questions: selectedBank.questions.filter((q) => q.id !== qId),
      });
    }

    try {
      await deleteDoc(doc(db, 'Questions', qId));
      await fetchBanks();
      sendNotification({ type: 'success', title: 'تم الحذف', message: 'تم حذف السؤال بنجاح.' });
    } catch (err) {
      console.error(err);
      fetchBanks(); // Revert on failure
    }
  };

  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    
    const { id, ...data } = editingQuestion;

    // Optimistic Update
    if (selectedBank) {
      setSelectedBank({
        ...selectedBank,
        questions: selectedBank.questions.map((q) => (q.id === id ? editingQuestion : q)),
      });
    }
    setEditingQuestion(null);

    try {
      await updateDoc(doc(db, 'Questions', id), data as any);
      await fetchBanks();
      sendNotification({
        type: 'success',
        title: 'تم التعديل',
        message: 'تم حفظ تعديلات السؤال بنجاح.',
      });
    } catch (err) {
      console.error(err);
      fetchBanks(); // Revert on failure
    }
  };

  // --- New Bank CRUD Operations ---
  const handleDeleteBank = async (bank: BankGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`هل أنت متأكد من حذف بنك "${bank.chapter}" بالكامل؟ (سيتم حذف ${bank.questions.length} سؤال)`)) return;
    
    // Optimistic Update
    setBanks((prev) => prev.filter((b) => b.id !== bank.id));
    if (selectedBank?.id === bank.id) setSelectedBank(null);

    try {
      const batch = writeBatch(db);
      bank.questions.forEach((q) => {
        batch.delete(doc(db, 'Questions', q.id));
      });
      await batch.commit();
      await fetchBanks();
      sendNotification({ type: 'success', title: 'تم حذف البنك', message: 'تم حذف جميع أسئلة البنك بنجاح.' });
    } catch (err) {
      console.error('Error deleting bank:', err);
      sendNotification({ type: 'error', title: 'خطأ', message: 'حدث خطأ أثناء حذف البنك.' });
      fetchBanks(); // Revert on failure
    }
  };

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank) return;

    // Optimistic Update
    setBanks((prev) =>
      prev.map((b) => (b.id === editingBank.id ? { ...b, ...editingBank } : b))
    );
    if (selectedBank?.id === editingBank.id) {
      setSelectedBank({ ...editingBank });
    }
    const currentEditingBank = editingBank;
    setEditingBank(null);

    try {
      const batch = writeBatch(db);
      currentEditingBank.questions.forEach((q) => {
        batch.update(doc(db, 'Questions', q.id), {
          subject: currentEditingBank.subject,
          chapter: currentEditingBank.chapter,
          grade: currentEditingBank.grade
        });
      });
      await batch.commit();
      await fetchBanks();
      sendNotification({ type: 'success', title: 'تم تعديل البنك', message: 'تم تحديث تصنيف جميع أسئلة البنك بنجاح.' });
    } catch (err) {
      console.error('Error updating bank:', err);
      sendNotification({ type: 'error', title: 'خطأ', message: 'حدث خطأ أثناء تحديث البنك.' });
      fetchBanks(); // Revert on failure
    }
  };

  const handleCreateExam = async () => {
    if (!selectedBank) return;
    if (!examMeta.title) {
      sendNotification({ type: 'error', title: 'تنبيه', message: 'يرجى كتابة عنوان للامتحان.' });
      return;
    }
    setIsCreatingExam(true);
    try {
      await addDoc(collection(db, 'exams'), {
        title: examMeta.title,
        courseId: selectedBank.courseId || '',
        subject: selectedBank.subject,
        grade: selectedBank.grade,
        duration: examMeta.duration,
        isActive: true, // Default to true
        allowRetake: false,
        opensAt: '',
        teacherId: user?.uid,
        teacherName: profile?.displayName,
        questions: selectedBank.questions,
        questionCount: selectedBank.questions.length,
        createdAt: new Date().toISOString(),
      });
      sendNotification({
        type: 'success',
        title: 'تم إنشاء الامتحان',
        message: 'تم تحويل البنك إلى امتحان بنجاح!',
      });
      setIsCreatingExam(false);
      navigate('/teacher/exams'); // Redirect to exams page
    } catch (err) {
      console.error(err);
      setIsCreatingExam(false);
    }
  };

  const filteredBanks = banks.filter(
    (b) =>
      b.subject.toLowerCase().includes(search.toLowerCase()) ||
      b.chapter.toLowerCase().includes(search.toLowerCase())
  );

  // Group banks by course Folder
  const courseFolderList = courses.map(c => {
    const courseBanks = filteredBanks.filter(b => b.courseId === c.id);
    return {
      id: c.id,
      title: c.title,
      banksCount: courseBanks.length,
      questionsCount: courseBanks.reduce((acc, b) => acc + b.questions.length, 0),
    };
  }).filter(folder => folder.banksCount > 0); // Only show folders that have banks!

  // Also include general folder if there are general banks matching the search
  const generalBanks = filteredBanks.filter(b => !b.courseId || !courses.find(c => c.id === b.courseId));
  if (generalBanks.length > 0) {
    courseFolderList.push({
      id: 'general',
      title: 'أسئلة عامة (غير مرتبطة بكورس)',
      banksCount: generalBanks.length,
      questionsCount: generalBanks.reduce((acc, b) => acc + b.questions.length, 0),
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="relative">
          <div className="absolute inset-0 bg-brand-blue/20 blur-xl rounded-full"></div>
          <Loader2 className="w-12 h-12 text-brand-blue animate-spin relative z-10" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12" dir="rtl">
      {/* Premium Header */}
      <div className="relative bg-gradient-to-r from-brand-blue/20 to-purple-500/10 rounded-[2.5rem] p-8 md:p-12 border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-white font-display flex items-center gap-4 mb-4">
              <div className="p-4 bg-brand-blue/20 rounded-2xl border border-brand-blue/30 backdrop-blur-md">
                <Library className="text-brand-blue w-8 h-8" />
              </div>
              <div>
                بنوك <span className="text-transparent bg-clip-text bg-gradient-to-l from-brand-blue to-purple-400">الأسئلة</span>
              </div>
            </h1>
            <p className="text-gray-400 font-bold text-lg max-w-xl">
              إدارة احترافية شاملة لأسئلتك. يمكنك تعديل البنوك، حذفها، أو تحويلها إلى اختبارات جاهزة للطلاب بضغطة زر.
            </p>
          </div>
        </div>
      </div>

      {!selectedBank ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto">
            <div className="absolute inset-y-0 right-0 flex items-center pr-5 pointer-events-none">
              <Search className="w-6 h-6 text-brand-blue" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المادة أو الفصل أو البنك..."
              className="w-full bg-[#0d1321]/80 backdrop-blur-xl border border-white/10 hover:border-brand-blue/50 focus:border-brand-blue rounded-[2rem] py-5 pr-14 pl-6 text-white text-lg font-bold transition-all outline-none shadow-xl shadow-black/20"
            />
          </div>

          {selectedCourseId === null ? (
            // Course Folder Selection View
            courseFolderList.length === 0 ? (
              <div className="py-24 text-center bg-[#0d1321]/50 border border-white/5 rounded-[3rem] backdrop-blur-sm">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Folder className="text-gray-600 w-12 h-12" />
                </div>
                <h3 className="text-2xl font-black text-white mb-3">لا توجد بنوك أسئلة</h3>
                <p className="text-gray-500 font-bold text-lg">لم تقم بإضافة أي أسئلة أو بنوك بعد.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courseFolderList.map((folder) => (
                  <motion.div
                    key={folder.id}
                    whileHover={{ y: -5, scale: 1.02 }}
                    onClick={() => {
                      setSelectedCourseId(folder.id);
                      setSelectedCourseTitle(folder.title);
                    }}
                    className="group relative bg-[#0d1321]/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 transition-all shadow-xl hover:shadow-brand-blue/10 overflow-hidden cursor-pointer flex flex-col justify-between min-h-[220px]"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 blur-[50px] rounded-full group-hover:bg-brand-blue/10 transition-colors"></div>

                    <div className="relative z-10 flex justify-between items-start">
                      <div className="p-5 bg-gradient-to-br from-brand-blue/20 to-blue-600/10 text-brand-blue rounded-[1.5rem] border border-brand-blue/20">
                        <Folder size={36} className="group-hover:scale-110 transition-transform text-brand-blue" />
                      </div>
                      <div className="bg-black/40 border border-white/5 px-4 py-2.5 rounded-2xl text-center">
                        <span className="block text-2xl font-black text-white leading-none mb-1">
                          {folder.banksCount}
                        </span>
                        <span className="block text-[10px] text-gray-500 font-black">بنك أسئلة</span>
                      </div>
                    </div>

                    <div className="relative z-10 mt-6 text-right">
                      <h3 className="text-xl font-black text-white group-hover:text-brand-blue transition-colors line-clamp-2">
                        {folder.title}
                      </h3>
                      <p className="text-xs text-gray-400 font-bold mt-2">
                        إجمالي الأسئلة: {folder.questionsCount} سؤال
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          ) : (
            // Banks Inside Selected Course Folder View
            <div className="space-y-6">
              {/* Back Breadcrumb Header */}
              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-3xl p-4 md:px-6">
                <button
                  onClick={() => {
                    setSelectedCourseId(null);
                    setSelectedCourseTitle('');
                  }}
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors flex items-center justify-center text-gray-400 hover:text-white"
                  title="العودة للمجلدات الرئيسية"
                >
                  <ChevronLeft size={20} className="rotate-180" />
                </button>
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 font-black block uppercase tracking-wider">مجلدات الكورسات</span>
                  <h2 className="text-lg font-black text-white">{selectedCourseTitle}</h2>
                </div>
              </div>

              {/* Grid of banks inside selected course folder */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredBanks
                  .filter(b => {
                    if (selectedCourseId === 'general') {
                      return !b.courseId || !courses.find(c => c.id === b.courseId);
                    }
                    return b.courseId === selectedCourseId;
                  })
                  .map((bank) => (
                    <motion.div
                      key={bank.id}
                      whileHover={{ y: -5, scale: 1.01 }}
                      className="group relative bg-[#0d1321]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 transition-all shadow-xl hover:shadow-brand-blue/10 overflow-hidden cursor-pointer"
                      onClick={() => setSelectedBank(bank)}
                    >
                      {/* Decorative Gradient */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 blur-[50px] rounded-full group-hover:bg-brand-blue/10 transition-colors"></div>
                      
                      {/* Bank Actions */}
                      <div className="absolute top-6 left-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingBank(bank); }}
                          className="p-2.5 bg-blue-500/10 text-brand-blue hover:bg-brand-blue hover:text-white rounded-xl transition-colors shadow-lg"
                          title="تعديل بيانات البنك"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteBank(bank, e)}
                          className="p-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-colors shadow-lg"
                          title="حذف البنك بالكامل"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                          <div className="p-4 bg-gradient-to-br from-brand-blue/20 to-blue-600/10 text-brand-blue rounded-2xl border border-brand-blue/20">
                            <Folder size={28} className="group-hover:scale-110 transition-transform" />
                          </div>
                          <div className="bg-black/40 border border-white/5 px-4 py-2 rounded-xl text-center">
                            <span className="block text-2xl font-black text-white leading-none mb-1">
                              {bank.questions.length}
                            </span>
                            <span className="block text-xs text-gray-500 font-bold">سؤال</span>
                          </div>
                        </div>

                        <h3 className="text-2xl font-black text-white mb-4 line-clamp-1 group-hover:text-brand-blue transition-colors">{bank.chapter}</h3>
                        
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300 font-bold">
                          <span className="bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                            <BookOpen size={14} className="text-brand-blue" />
                            {bank.subject}
                          </span>
                          <span className="bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
                            {bank.grade}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedBank(null)}
              className="flex items-center gap-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-xl font-bold transition-all border border-white/5"
            >
              <ChevronLeft size={20} /> العودة للبنوك
            </button>
            
            <div className="flex gap-2">
               <button
                  onClick={() => setEditingBank(selectedBank)}
                  className="flex items-center gap-2 text-brand-blue hover:text-white bg-brand-blue/10 hover:bg-brand-blue px-5 py-2.5 rounded-xl font-bold transition-all"
                >
                  <Settings size={18} /> إعدادات البنك
                </button>
            </div>
          </div>

          <div className="bg-[#0d1321]/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-2xl">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 border-b border-white/5 pb-10 mb-10">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-gradient-to-br from-brand-blue to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-blue/20 shrink-0">
                   <Library className="text-white w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white mb-3">{selectedBank.chapter}</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-brand-blue font-bold text-sm bg-brand-blue/10 border border-brand-blue/20 px-4 py-1.5 rounded-full flex items-center gap-2">
                      <BookOpen size={14} /> {selectedBank.subject}
                    </span>
                    <span className="text-gray-300 font-bold text-sm bg-white/5 border border-white/5 px-4 py-1.5 rounded-full">
                       {selectedBank.grade}
                    </span>
                    <span className="text-purple-400 font-bold text-sm bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full">
                       {selectedBank.questions.length} أسئلة
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-black/30 p-5 w-full xl:w-auto flex flex-col sm:flex-row gap-4 rounded-[1.5rem] border border-white/5 shadow-inner">
                <input
                  type="text"
                  placeholder="عنوان الامتحان..."
                  value={examMeta.title}
                  onChange={(e) => setExamMeta({ ...examMeta, title: e.target.value })}
                  className="bg-black/50 border border-white/10 rounded-xl px-5 py-3 text-white font-bold outline-none focus:border-brand-blue focus:bg-white/5 transition-all w-full sm:w-64"
                />
                <button
                  onClick={handleCreateExam}
                  disabled={isCreatingExam}
                  className="bg-brand-blue hover:bg-brand-blue/80 text-white px-8 py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-blue/20 whitespace-nowrap"
                >
                  {isCreatingExam ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <PlayCircle size={20} />
                  )}
                  إنشاء كاختبار
                </button>
              </div>
            </div>

            <div className="space-y-5">
              {selectedBank.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white/5 border border-white/5 rounded-2xl p-6 relative group hover:bg-white/10 hover:border-white/10 transition-all duration-300"
                >
                  <div className="absolute top-6 left-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingQuestion(q)}
                      className="p-2 bg-blue-500/10 text-brand-blue hover:bg-brand-blue hover:text-white rounded-lg transition-colors shadow-sm"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors shadow-sm"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="flex gap-5">
                    <div className="w-10 h-10 bg-brand-blue/10 border border-brand-blue/20 rounded-xl flex items-center justify-center font-black text-brand-blue shrink-0 shadow-inner">
                      {idx + 1}
                    </div>
                    <div className="space-y-5 flex-1 pr-2">
                      <p className="text-xl font-black text-white leading-relaxed">{q.questionText}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                        {['أ', 'ب', 'ج', 'د'].map((letter, i) => (
                          <div
                            key={i}
                            className={`p-4 rounded-xl border-2 text-base font-bold flex items-center transition-all ${
                              i === q.correctOptionIndex
                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-sm shadow-emerald-500/10'
                                : 'bg-black/40 border-white/5 text-gray-300 hover:border-white/10'
                            }`}
                          >
                            <span className={`ml-3 w-8 h-8 flex items-center justify-center rounded-lg font-black shrink-0 ${
                              i === q.correctOptionIndex ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-gray-500'
                            }`}>
                              {letter}
                            </span>
                            {q.options[i]}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Edit Question Modal */}
      <AnimatePresence>
        {editingQuestion && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setEditingQuestion(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-[#0a0f18] border border-white/10 rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] z-10"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-blue to-purple-500"></div>
              
              <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-white/5">
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <div className="p-2.5 bg-brand-blue/20 text-brand-blue rounded-xl">
                    <Edit2 size={24} />
                  </div>
                  تعديل السؤال
                </h2>
                <button
                  onClick={() => setEditingQuestion(null)}
                  className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 hover:rotate-90 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateQuestion} className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                <div>
                  <label className="block text-base font-black text-gray-300 mb-3 flex items-center gap-2">
                    <FileText size={18} className="text-brand-blue"/> نص السؤال
                  </label>
                  <textarea
                    value={editingQuestion.questionText}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, questionText: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-white font-bold text-lg focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue min-h-[120px] transition-all resize-none shadow-inner"
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-base font-black text-gray-300 mb-4 flex items-center gap-2">
                    <Library size={18} className="text-purple-400"/> الاختيارات (اختر الإجابة الصحيحة)
                  </label>
                  {['أ', 'ب', 'ج', 'د'].map((l, i) => (
                    <div key={i} className="flex gap-4">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingQuestion({ ...editingQuestion, correctOptionIndex: i })
                        }
                        className={`w-14 rounded-2xl flex items-center justify-center font-black text-xl transition-all ${
                          editingQuestion.correctOptionIndex === i
                            ? 'bg-emerald-500 border-2 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border-2 border-transparent'
                        }`}
                      >
                        {l}
                      </button>
                      <input
                        value={editingQuestion.options[i]}
                        onChange={(e) => {
                          const o = [...editingQuestion.options] as [
                            string,
                            string,
                            string,
                            string,
                          ];
                          o[i] = e.target.value;
                          setEditingQuestion({ ...editingQuestion, options: o });
                        }}
                        className={`flex-1 bg-black/40 border-2 rounded-2xl p-5 text-white font-bold focus:outline-none transition-all shadow-inner ${
                          editingQuestion.correctOptionIndex === i
                            ? 'border-emerald-500/40 focus:border-emerald-500 bg-emerald-500/5'
                            : 'border-white/5 focus:border-brand-blue hover:border-white/10'
                        }`}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 pt-8 border-t border-white/5 mt-8">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-brand-blue to-blue-600 hover:from-blue-600 hover:to-brand-blue text-white py-5 rounded-2xl font-black text-lg shadow-[0_0_30px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                  >
                    <Save size={22} /> حفظ التعديلات
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingQuestion(null)}
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-white py-5 rounded-2xl font-black text-lg hover:scale-[1.02]"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Bank Modal */}
      <AnimatePresence>
        {editingBank && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setEditingBank(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-[#0a0f18] border border-white/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col z-10"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-blue to-purple-500"></div>
              
              <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-white/5">
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <div className="p-2.5 bg-brand-blue/20 text-brand-blue rounded-xl">
                    <Settings size={24} />
                  </div>
                  إعدادات البنك
                </h2>
                <button
                  onClick={() => setEditingBank(null)}
                  className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 hover:rotate-90 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateBank} className="p-8 space-y-6">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex gap-4 text-yellow-500 font-bold mb-6">
                  <AlertTriangle className="shrink-0 w-6 h-6" />
                  <p className="text-sm leading-relaxed text-yellow-400">تعديل بيانات البنك سيؤدي إلى تغيير تصنيف <span className="font-black text-white mx-1">{editingBank.questions.length}</span> سؤال موجود داخل هذا البنك.</p>
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-400 mb-2">اسم المادة</label>
                  <input
                    type="text"
                    value={editingBank.subject}
                    onChange={(e) => setEditingBank({ ...editingBank, subject: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold focus:outline-none focus:border-brand-blue transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-400 mb-2">الصف الدراسي</label>
                  <input
                    type="text"
                    value={editingBank.grade}
                    onChange={(e) => setEditingBank({ ...editingBank, grade: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold focus:outline-none focus:border-brand-blue transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-400 mb-2">اسم الفصل / الوحدة</label>
                  <input
                    type="text"
                    value={editingBank.chapter}
                    onChange={(e) => setEditingBank({ ...editingBank, chapter: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold focus:outline-none focus:border-brand-blue transition-all"
                    required
                  />
                </div>

                <div className="flex gap-4 pt-6 border-t border-white/5 mt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white py-4 rounded-xl font-black shadow-[0_0_20px_rgba(59,130,246,0.2)] flex items-center justify-center gap-2 transition-all hover:scale-105"
                  >
                    <Save size={20} /> تطبيق التعديلات
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
