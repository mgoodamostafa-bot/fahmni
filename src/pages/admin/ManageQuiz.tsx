import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, Trash2, ArrowLeft, Save, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
}

interface Quiz {
  id: string;
  lessonId: string;
  questions: Question[];
}

export const ManageQuiz: React.FC = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!lessonId) return;
      try {
        const q = query(collection(db, 'quizzes'), where('lessonId', '==', lessonId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const quizData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Quiz;
          setQuiz(quizData);
          setQuestions(quizData.questions || []);
        }
      } catch (error) {
        console.error('Error fetching quiz:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [lessonId]);

  const handleAddQuestion = () => {
    setQuestions([...questions, { question: '', options: ['', '', '', ''], correctIndex: 0 }]);
  };

  const handleRemoveQuestion = (index: number) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions);
  };

  const handleQuestionChange = (index: number, field: string, value: any) => {
    const newQuestions = [...questions];
    (newQuestions[index] as any)[field] = value;
    setQuestions(newQuestions);
  };

  const handleOptionChange = (qIndex: number, oIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuestions(newQuestions);
  };

  const handleSave = async () => {
    if (!lessonId) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      if (quiz) {
        await updateDoc(doc(db, 'quizzes', quiz.id), { questions });
      } else {
        const docRef = await addDoc(collection(db, 'quizzes'), { lessonId, questions });
        setQuiz({ id: docRef.id, lessonId, questions });
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving quiz:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 text-right" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <Link
            to={`/teacher/courses/${courseId}/lessons`}
            className="text-brand-blue hover:underline flex items-center gap-2 mb-4 font-bold"
          >
            <ArrowLeft size={20} className="rotate-180" /> العودة للدروس
          </Link>
          <h1 className="text-4xl font-black text-white font-display mb-2">إدارة الاختبار</h1>
          <p className="text-gray-400 font-bold">قم بإضافة وتعديل الأسئلة لهذا الدرس</p>
        </div>

        <div className="flex items-center gap-4">
          <AnimatePresence>
            {saveStatus === 'success' && (
              <motion.span
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-green-500 font-black flex items-center gap-2 bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20"
              >
                <CheckCircle2 size={20} /> تم الحفظ بنجاح
              </motion.span>
            )}
            {saveStatus === 'error' && (
              <motion.span
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-500 font-black flex items-center gap-2 bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20"
              >
                <AlertCircle size={20} /> فشل الحفظ
              </motion.span>
            )}
          </AnimatePresence>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-8 py-4 flex items-center gap-3 text-lg shadow-lg shadow-brand-blue/20"
          >
            <Save size={24} /> {saving ? 'جاري الحفظ...' : 'حفظ الاختبار'}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {questions.map((q, qIndex) => (
          <motion.div
            key={qIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: qIndex * 0.1 }}
            className="glass-card p-8 border border-white/10 relative group"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-blue/20 flex items-center justify-center text-brand-blue font-black text-xl">
                  {qIndex + 1}
                </div>
                <h3 className="text-2xl font-black text-white font-display">السؤال {qIndex + 1}</h3>
              </div>
              <button
                onClick={() => handleRemoveQuestion(qIndex)}
                className="p-3 glass-card hover:bg-red-500/20 text-red-500 transition-all opacity-0 group-hover:opacity-100"
                title="حذف السؤال"
              >
                <Trash2 size={24} />
              </button>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <label className="block text-sm font-black text-gray-400 mr-2">نص السؤال</label>
                <div className="relative">
                  <HelpCircle
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                    size={20}
                  />
                  <input
                    type="text"
                    value={q.question}
                    onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white text-lg"
                    placeholder="اكتب سؤالك هنا..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-black text-gray-400 mr-2">
                  الخيارات (اختر الإجابة الصحيحة)
                </label>
                <div className="grid md:grid-cols-2 gap-4">
                  {q.options.map((opt, oIndex) => (
                    <div
                      key={oIndex}
                      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                        q.correctIndex === oIndex
                          ? 'bg-brand-blue/10 border-brand-blue shadow-lg shadow-brand-blue/5'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="relative flex items-center justify-center cursor-pointer">
                        <input
                          type="radio"
                          name={`correct-${qIndex}`}
                          checked={q.correctIndex === oIndex}
                          onChange={() => handleQuestionChange(qIndex, 'correctIndex', oIndex)}
                          className="w-6 h-6 border-2 border-white/20 rounded-full checked:bg-brand-blue checked:border-brand-blue transition-all cursor-pointer accent-brand-blue"
                        />
                      </div>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                        className="flex-1 bg-transparent border-none focus:outline-none font-bold text-white"
                        placeholder={`الخيار ${oIndex + 1}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 font-bold mt-4 flex items-center gap-2">
                  <AlertCircle size={16} /> قم بتحديد الدائرة بجانب الإجابة الصحيحة.
                </p>
              </div>
            </div>
          </motion.div>
        ))}

        <button
          onClick={handleAddQuestion}
          className="w-full py-10 border-2 border-dashed border-white/10 rounded-3xl text-gray-500 hover:bg-white/5 hover:border-brand-blue hover:text-brand-blue transition-all flex items-center justify-center gap-4 font-black text-xl group"
        >
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-brand-blue/20 transition-colors">
            <Plus size={32} />
          </div>
          إضافة سؤال جديد
        </button>
      </div>
    </div>
  );
};
