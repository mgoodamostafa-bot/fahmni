import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion } from 'framer-motion';
import {
  Video,
  HelpCircle,
  FileText,
  ListOrdered,
  Check,
  ArrowRight,
  Loader2,
  Save,
  Trash2,
  Type,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

export const EditLesson: React.FC = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { sendNotification } = useNotifications();
  const isEditing = !!lessonId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    videoUrl: '',
    pdfUrl: '',
    quizUrl: '',
    examId: '',
    pdfPrice: 0,
    summary: '',
    order: 1,
    isFreePreview: false,
    allowedViews: 5,
  });
  const [activeLessonColl, setActiveLessonColl] = useState<'Lessons' | 'lessons'>('Lessons');
  const [quizType, setQuizType] = useState<'none' | 'internal' | 'bank' | 'external'>('none');
  const [exams, setExams] = useState<any[]>([]);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');

  useEffect(() => {
    const fetchExams = async () => {
      if (!user?.uid) return;
      try {
        const q = query(
          collection(db, 'exams'),
          where('teacherId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(d => ({
          id: d.id,
          title: d.data().title || 'امتحان بدون عنوان',
        }));
        setExams(list);
      } catch (err) {
        console.error('Error fetching exams:', err);
      }
    };
    const fetchBankQuestions = async () => {
      if (!user?.uid) return;
      try {
        const q = query(
          collection(db, 'Questions'),
          where('teacherId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setBankQuestions(list);
      } catch (err) {
        console.error('Error fetching bank questions:', err);
      }
    };
    fetchExams();
    fetchBankQuestions();
  }, [user]);

  useEffect(() => {
    if (isEditing && lessonId && bankQuestions.length > 0) {
      const matchExistingQuiz = async () => {
        try {
          const quizSnap = await getDocs(query(collection(db, 'quizzes'), where('lessonId', '==', lessonId)));
          if (!quizSnap.empty) {
            const quizData = quizSnap.docs[0].data();
            const existingQuizQuestions = quizData.questions || [];
            const matchedIds: string[] = [];
            existingQuizQuestions.forEach((eq: any) => {
              const eqText = eq.question || eq.questionText || '';
              const found = bankQuestions.find(bq => (bq.questionText || bq.question || '') === eqText);
              if (found) {
                matchedIds.push(found.id);
              }
            });
            setSelectedQuestionIds(matchedIds);
          }
        } catch (error) {
          console.error('Error matching existing quiz:', error);
        }
      };
      matchExistingQuiz();
    }
  }, [bankQuestions, lessonId, isEditing]);

  useEffect(() => {
    if (isEditing && lessonId) {
      const fetchLesson = async () => {
        try {
          let docSnap = await getDoc(doc(db, 'Lessons', lessonId));
          let coll: 'Lessons' | 'lessons' = 'Lessons';

          if (!docSnap.exists()) {
            docSnap = await getDoc(doc(db, 'lessons', lessonId));
            coll = 'lessons';
          }

          if (docSnap.exists()) {
            const data = docSnap.data();
            let type: 'none' | 'internal' | 'bank' | 'external' = 'none';
            if (data.examId) {
              type = 'internal';
            } else if (data.quizUrl) {
              type = 'external';
            } else {
              const quizSnap = await getDocs(query(collection(db, 'quizzes'), where('lessonId', '==', lessonId)));
              if (!quizSnap.empty) {
                type = 'bank';
              }
            }
            setQuizType(type);
            setFormData({
              title: data.title || '',
              videoUrl: data.videoUrl || '',
              pdfUrl: data.pdfUrl || '',
              quizUrl: data.quizUrl || '',
              examId: data.examId || '',
              pdfPrice: data.pdfPrice || 0,
              summary: data.summary || '',
              order: data.order || 1,
              isFreePreview: data.isFreePreview || false,
              allowedViews: data.allowedViews || 5,
            });
            setActiveLessonColl(coll);
          }
        } catch (error) {
          console.error('Error fetching lesson:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchLesson();
    }
  }, [lessonId, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalExamId = formData.examId;
      let finalQuizUrl = formData.quizUrl;

      if (quizType === 'none') {
        finalExamId = '';
        finalQuizUrl = '';
      } else if (quizType === 'internal') {
        finalQuizUrl = '';
      } else if (quizType === 'bank') {
        finalExamId = '';
        finalQuizUrl = '';
      } else if (quizType === 'external') {
        finalExamId = '';
      }

      const lessonData = {
        ...formData,
        examId: finalExamId,
        quizUrl: finalQuizUrl,
      };

      let resolvedLessonId = lessonId;

      if (isEditing && lessonId) {
        await updateDoc(doc(db, activeLessonColl, lessonId), {
          ...lessonData,
          updatedAt: serverTimestamp(),
        });
      } else if (courseId) {
        const docRef = await addDoc(collection(db, 'Lessons'), {
          ...lessonData,
          courseId,
          teacherId: user?.uid,
          createdAt: serverTimestamp(),
        });
        resolvedLessonId = docRef.id;

        // Notify enrolled students
        await sendNotification({
          title: 'درس جديد متاح!',
          message: `تمت إضافة درس جديد: "${formData.title}"`,
          type: 'info',
          targetGroupId: courseId, // only for enrolled students
          targetRole: 'student',
          link: `/courses/${courseId}/learn`,
          senderName: profile?.displayName || 'المدرس',
        });
      }

      // Handle quizzes collection updates/creation based on quizType
      if (resolvedLessonId) {
        const quizzesColl = collection(db, 'quizzes');
        const qSnap = await getDocs(query(quizzesColl, where('lessonId', '==', resolvedLessonId)));
        
        if (quizType === 'bank') {
          const selectedQuestions = bankQuestions.filter(bq => selectedQuestionIds.includes(bq.id));
          const mappedQuestions = selectedQuestions.map(q => ({
            question: q.questionText || q.question || '',
            options: q.options || [],
            correctIndex: q.correctOptionIndex !== undefined ? q.correctOptionIndex : (q.correctIndex !== undefined ? q.correctIndex : 0)
          }));

          if (!qSnap.empty) {
            await updateDoc(doc(db, 'quizzes', qSnap.docs[0].id), {
              questions: mappedQuestions
            });
          } else {
            await addDoc(quizzesColl, {
              lessonId: resolvedLessonId,
              questions: mappedQuestions
            });
          }
        } else {
          // If type is not bank, remove any quizzes document associated with this lesson to avoid conflicts
          if (!qSnap.empty) {
            await deleteDoc(doc(db, 'quizzes', qSnap.docs[0].id));
          }
        }
      }

      alert('تم حفظ البيانات بنجاح!');
      navigate(-1);
    } catch (error) {
      console.error('Error saving lesson:', error);
      alert('حدث خطأ أثناء حفظ الدرس');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl transition-all border border-white/10"
          >
            <ArrowRight size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-white font-display">
              {isEditing ? 'تعديل الدرس' : 'إضافة درس جديد'}
            </h1>
            <p className="text-gray-400 font-bold mt-1">تعديل محتوى الحصة التعليمية وتفاصيلها</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 md:p-12 space-y-10"
        >
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-gray-400 font-bold flex items-center gap-2">
                <Type className="text-brand-blue" size={18} />
                عنوان الدرس
              </label>
              <input
                required
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-brand-blue transition-colors text-lg"
              />
            </div>

            <div className="space-y-4">
              <label className="text-gray-400 font-bold flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Video className="text-brand-yellow" size={18} />
                    رابط الفيديو (YouTube / Google Drive / MP4)
                  </span>
                  {formData.videoUrl && (
                    <span className="text-xs font-black px-2 py-1 rounded bg-white/10">
                      {/youtube\.com|youtu\.be/.test(formData.videoUrl)
                        ? '🔴 YouTube'
                        : /drive\.google\.com/.test(formData.videoUrl)
                          ? '🟢 Google Drive'
                          : '🔵 MP4 Direct'}
                    </span>
                  )}
                </div>
              </label>
              <input
                required
                type="url"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-brand-blue transition-colors text-left"
                dir="ltr"
              />
              {/drive\.google\.com/.test(formData.videoUrl) && (
                <p className="text-emerald-400 text-xs font-bold bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                  💡 تأكد أن رابط Drive مشارك للجميع (Anyone with the link can view)
                </p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-gray-400 font-bold flex items-center gap-2">
                <FileText className="text-emerald-500" size={18} />
                رابط الملزمة (PDF)
              </label>
              <input
                type="url"
                value={formData.pdfUrl}
                onChange={(e) => setFormData({ ...formData, pdfUrl: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-brand-blue transition-colors text-left"
                dir="ltr"
              />
            </div>

            <div className="space-y-4">
              <label className="text-gray-400 font-bold flex items-center gap-2">
                <FileText className="text-brand-yellow" size={18} />
                سعر الملزمة (0 يعني مجانية)
              </label>
              <input
                type="number"
                min="0"
                value={formData.pdfPrice}
                onChange={(e) => setFormData({ ...formData, pdfPrice: Math.max(0, Number(e.target.value)) })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-brand-blue transition-colors text-left"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-4 bg-white/5 p-6 rounded-[2rem] border border-white/5">
            <label className="text-gray-200 font-black flex items-center gap-2 text-base">
              <HelpCircle className="text-purple-500" size={20} />
              الاختبار الدوري للدرس
            </label>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-gray-400 font-bold text-xs">مصدر الاختبار</label>
                <select
                  value={quizType}
                  onChange={(e) => {
                    const val = e.target.value as 'none' | 'internal' | 'bank' | 'external';
                    setQuizType(val);
                    if (val === 'none') {
                      setFormData(prev => ({ ...prev, examId: '', quizUrl: '' }));
                    } else if (val === 'internal') {
                      setFormData(prev => ({ ...prev, quizUrl: '' }));
                    } else if (val === 'bank') {
                      setFormData(prev => ({ ...prev, examId: '', quizUrl: '' }));
                    } else {
                      setFormData(prev => ({ ...prev, examId: '' }));
                    }
                  }}
                  className="w-full bg-[#0a0f1c] border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-brand-blue"
                >
                  <option value="none">بدون اختبار</option>
                  <option value="internal">اختبار تفاعلي من المنصة (اختر امتحان جاهز)</option>
                  <option value="bank">تحديد أسئلة مخصصة من بنك الأسئلة</option>
                  <option value="external">رابط اختبار خارجي (مثال: Google Forms)</option>
                </select>
              </div>

              {quizType === 'internal' && (
                <div className="space-y-2">
                  <label className="text-gray-400 font-bold text-xs">اختر الامتحان من المنصة</label>
                  <select
                    value={formData.examId}
                    onChange={(e) => setFormData(prev => ({ ...prev, examId: e.target.value }))}
                    className="w-full bg-[#0a0f1c] border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-brand-blue"
                  >
                    <option value="">-- اختر الامتحان --</option>
                    {exams.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {quizType === 'external' && (
                <div className="space-y-2">
                  <label className="text-gray-400 font-bold text-xs">رابط الاختبار الخارجي</label>
                  <input
                    type="url"
                    value={formData.quizUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, quizUrl: e.target.value }))}
                    className="w-full bg-[#0a0f1c] border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-brand-blue text-left"
                    dir="ltr"
                    placeholder="https://docs.google.com/forms/..."
                  />
                </div>
              )}

              {quizType === 'bank' && (
                <div className="space-y-4 col-span-2">
                  <label className="text-gray-400 font-bold text-xs">تحديد الأسئلة من بنك الأسئلة ({selectedQuestionIds.length} محددة)</label>
                  
                  {/* Search and Filter */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="بحث في نص السؤال..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-[#0a0f1c] border border-white/10 rounded-2xl p-3 text-white focus:outline-none focus:border-brand-blue text-sm"
                    />
                    <select
                      value={selectedChapter}
                      onChange={(e) => setSelectedChapter(e.target.value)}
                      className="bg-[#0a0f1c] border border-white/10 rounded-2xl p-3 text-white focus:outline-none focus:border-brand-blue text-sm"
                    >
                      <option value="">جميع الفصول / الأبواب</option>
                      {Array.from(new Set(bankQuestions.map(bq => bq.chapter).filter(Boolean))).map((ch: any) => (
                        <option key={ch} value={ch}>{ch}</option>
                      ))}
                    </select>
                  </div>

                  {/* Questions List */}
                  <div className="max-h-[300px] overflow-y-auto border border-white/10 rounded-2xl divide-y divide-white/5 bg-black/20 p-2">
                    {bankQuestions
                      .filter(bq => {
                        const matchText = (bq.questionText || bq.question || '').toLowerCase().includes(searchQuery.toLowerCase());
                        const matchChapter = !selectedChapter || bq.chapter === selectedChapter;
                        return matchText && matchChapter;
                      })
                      .map(bq => {
                        const isChecked = selectedQuestionIds.includes(bq.id);
                        return (
                          <div
                            key={bq.id}
                            onClick={() => {
                              setSelectedQuestionIds(prev => 
                                isChecked ? prev.filter(id => id !== bq.id) : [...prev, bq.id]
                              );
                            }}
                            className={`flex items-start gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-xl ${isChecked ? 'bg-brand-blue/5' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="mt-1 accent-brand-blue cursor-pointer"
                            />
                            <div className="flex-1 text-right">
                              <p className="font-bold text-sm text-white">{bq.questionText || bq.question}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {bq.chapter && (
                                  <span className="text-[10px] bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded">
                                    الفصل: {bq.chapter}
                                  </span>
                                )}
                                <span className="text-[10px] bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded">
                                  {bq.difficulty === 'easy' ? 'سهل' : (bq.difficulty === 'hard' ? 'صعب' : 'متوسط')}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    {bankQuestions.length === 0 && (
                      <p className="text-gray-500 text-xs text-center py-8 italic">لا توجد أسئلة في بنك الأسئلة الخاص بك حالياً.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-gray-400 font-bold">وصف الدرس للمناقشة</label>
            <textarea
              rows={6}
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white focus:outline-none focus:border-brand-blue transition-colors resize-none text-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-white/5">
            <div className="space-y-4">
              <label className="text-gray-400 font-bold flex items-center gap-2">
                <ListOrdered className="text-gray-500" size={18} />
                الترتيب
              </label>
              <input
                required
                type="number"
                min="1"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-brand-blue transition-colors w-32 text-center text-xl font-black"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="relative inline-flex items-center cursor-pointer group p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-brand-blue/30 transition-all">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formData.isFreePreview}
                  onChange={(e) => setFormData({ ...formData, isFreePreview: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1.25rem] after:right-[1.25rem] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-blue"></div>
                <span className="mr-3 text-sm font-black text-gray-400 group-hover:text-white transition-colors">
                  متاح للمعاينة بدون اشتراك
                </span>
              </label>
            </div>
          </div>

          {/* 📺 View Count Override */}
          <div className="p-8 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10 space-y-4">
            <h4 className="text-emerald-500 font-black flex items-center gap-2">
              <Video className="animate-pulse" size={20} />
              التحكم في عدد المشاهدات
            </h4>
            <div className="flex items-center gap-6">
              <div className="space-y-1">
                <p className="text-gray-500 text-xs font-bold leading-relaxed">
                  حدد عدد المرات المسموح للطالب بمشاهدة هذا الدرس فيها قبل أن يتم قفله تلقائياً.
                </p>
              </div>
              <div className="flex items-center gap-3 bg-black/40 p-2 rounded-2xl border border-white/10">
                <input
                  type="number"
                  min="1"
                  value={formData.allowedViews}
                  onChange={(e) =>
                    setFormData({ ...formData, allowedViews: Number(e.target.value) })
                  }
                  className="bg-transparent text-white font-black w-16 text-center text-2xl outline-none"
                />
                <span className="text-gray-500 font-bold ml-2">مشاهدة</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white py-6 rounded-[2rem] text-xl font-black shadow-2xl shadow-brand-blue/30 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
            {isEditing ? 'حفظ التغييرات' : 'إضافة الدرس'}
          </button>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-10 bg-white/5 hover:bg-white/10 text-white rounded-[2rem] font-bold transition-all border border-white/10"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
};
