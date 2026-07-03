import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Search,
  Filter,
  Loader2,
  User,
  BookOpen,
  MessageSquare,
  Star,
  Award,
  ClipboardList,
  Download,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Submission {
  id: string;
  userId: string;
  displayName: string;
  courseId: string;
  lessonId: string;
  solutionUrl: string;
  submittedAt: any;
  status: 'pending' | 'approved' | 'rejected';
  type: 'file' | 'link';
  teacherId: string;
  grade?: number;
  feedback?: string;
  _lessonTitle?: string;
  _courseTitle?: string;
}

export const HomeworkSubmissions: React.FC = () => {
  const { user, profile } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchTerm, setSearchTerm] = useState('');

  // Review Modal States
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [grade, setGrade] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Solution Viewer Modal state
  const [viewerSub, setViewerSub] = useState<Submission | null>(null);

  const handleViewSolution = (sub: Submission) => {
    const url = sub.solutionUrl;
    if (url && url.startsWith('data:')) {
      setViewerSub(sub);
    } else if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      alert('لا يوجد رابط للحل مرفوع من الطالب');
    }
  };

  const getExtensionFromBase64 = (base64Data: string): string => {
    try {
      const mime = base64Data.split(';base64,')[0].split(':')[1];
      if (mime.includes('pdf')) return 'pdf';
      if (mime.includes('png')) return 'png';
      if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
      if (mime.includes('webp')) return 'webp';
      if (mime.includes('gif')) return 'gif';
      if (mime.includes('word') || mime.includes('officedocument.word')) return 'docx';
      if (mime.includes('sheet') || mime.includes('excel')) return 'xlsx';
      return 'bin';
    } catch {
      return 'bin';
    }
  };

  const downloadBase64File = (base64Data: string, fileName: string) => {
    try {
      const parts = base64Data.split(';base64,');
      if (parts.length < 2) return;
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      const blob = new Blob([uInt8Array], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download file:', err);
      alert('فشل تحميل الملف.');
    }
  };

  useEffect(() => {
    if (!user?.uid) return;

    // Fetch all submissions for this teacher
    const q = query(
      collection(db, 'submissions'),
      where('teacherId', '==', user.uid),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Submission);

        // Fetch enrichment data (Lesson/Course Titles) in parallel for efficiency
        const enriched = await Promise.all(
          data.map(async (sub) => {
            try {
              let lessonTitle = 'درس محذوف';
              if (sub.lessonId) {
                let lDoc = await getDoc(doc(db, 'Lessons', sub.lessonId));
                if (!lDoc.exists()) {
                  lDoc = await getDoc(doc(db, 'lessons', sub.lessonId));
                }
                if (lDoc.exists()) {
                  lessonTitle = lDoc.data()?.title || 'درس بدون عنوان';
                }
              }

              return {
                ...sub,
                _lessonTitle: lessonTitle,
                _courseTitle: 'كورس المعلم',
              };
            } catch (err) {
              console.error('Error enriching submission with lesson info:', err);
              return {
                ...sub,
                _lessonTitle: 'درس محذوف',
                _courseTitle: 'كورس المعلم',
              };
            }
          })
        );

        setSubmissions(enriched);
        setLoading(false);
      },
      (err) => {
        console.error('Submissions fetch error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedSub || submitting) return;

    setSubmitting(true);
    try {
      const subRef = doc(db, 'submissions', selectedSub.id);
      await updateDoc(subRef, {
        status,
        grade: Number(grade) || 0,
        feedback,
        reviewedAt: serverTimestamp(),
      });

      // Send Notification to Student
      await addDoc(collection(db, 'notifications'), {
        userId: selectedSub.userId,
        title: status === 'approved' ? 'تم قبول الواجب! 🎉' : 'تم مراجعة الواجب 📝',
        message:
          status === 'approved'
            ? `تم قبول واجبك في درس "${selectedSub._lessonTitle}" وحصلت على درجة: ${grade}/10`
            : `قام المعلم بترك ملاحظة على حل واجب "${selectedSub._lessonTitle}"`,
        type: status === 'approved' ? 'success' : 'info',
        read: false,
        createdAt: serverTimestamp(),
        link: `/courses/${selectedSub.courseId}/learn/${selectedSub.lessonId}`,
      });

      setSelectedSub(null);
      setGrade('');
      setFeedback('');
    } catch (err) {
      console.error('Review error:', err);
      alert('حدث خطأ أثناء التحديث');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = submissions.filter((s) => {
    const matchesFilter = filter === 'all' || s.status === filter;
    const matchesSearch =
      s.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s._lessonTitle?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
        <p className="text-gray-500 font-bold animate-pulse">جاري جلب تسليمات الواجب...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 text-right" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-brand-blue/10 text-brand-blue rounded-3xl flex items-center justify-center shrink-0 shadow-2xl border border-brand-blue/10">
            <ClipboardCheck size={36} />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white mb-2">تسليمات الواجب</h1>
            <p className="text-gray-400 font-bold opacity-80">
              تتبع درجات الطلاب وتقارير تسليم الواجب المنزلي
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Stats Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 glass-card p-4 flex flex-col md:flex-row items-center gap-4 border border-white/5">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث باسم الطالب أو الدرس..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 w-full md:w-auto overflow-x-auto no-scrollbar">
            {[
              {
                id: 'pending',
                label: 'قيد الانتظار',
                count: submissions.filter((s) => s.status === 'pending').length,
              },
              {
                id: 'approved',
                label: 'تم القبول',
                count: submissions.filter((s) => s.status === 'approved').length,
              },
              {
                id: 'rejected',
                label: 'مرفوض',
                count: submissions.filter((s) => s.status === 'rejected').length,
              },
              { id: 'all', label: 'الكل', count: submissions.length },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                  filter === f.id
                    ? 'bg-brand-blue text-white shadow-xl'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                {f.label}
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] ${filter === f.id ? 'bg-white/20' : 'bg-white/5'}`}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 border border-brand-blue/20 bg-brand-blue/5 flex items-center gap-5">
          <div className="w-12 h-12 bg-brand-blue rounded-2xl flex items-center justify-center text-white">
            <Star size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-brand-blue uppercase tracking-widest">
              متوسط الدرجات
            </p>
            <h4 className="text-2xl font-black text-white">8.5 / 10</h4>
          </div>
        </div>
      </div>

      {/* Submissions List */}
      <div className="grid gap-6">
        <AnimatePresence mode="popLayout">
          {filtered.map((sub) => (
            <motion.div
              key={sub.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-6 border border-white/5 hover:border-brand-blue/20 transition-all group relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6"
            >
              <div className="flex items-center gap-6 flex-1 min-w-0 w-full">
                <div className="w-16 h-16 rounded-[1.5rem] bg-brand-blue/10 flex items-center justify-center text-brand-blue shrink-0 group-hover:scale-110 transition-transform">
                  <User size={32} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-black text-white truncate mb-1">{sub.displayName}</h3>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-2 text-xs font-bold text-gray-400">
                      <BookOpen size={14} className="text-brand-blue" /> {sub._lessonTitle}
                    </span>
                    <span className="flex items-center gap-2 text-xs font-bold text-gray-500 border-r border-white/10 pr-4">
                      <Clock size={14} /> {new Date(sub.submittedAt).toLocaleString('ar-EG')}
                    </span>
                    {sub.grade !== undefined && (
                      <span className="flex items-center gap-2 text-xs font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/10">
                        <Award size={14} /> الدرجة: {sub.grade}/10
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto">
                <button
                  onClick={() => handleViewSolution(sub)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-4 rounded-2xl font-black border border-white/5 transition-all text-sm cursor-pointer"
                >
                  رؤية الحل <ExternalLink size={18} />
                </button>

                {sub.status === 'pending' ? (
                  <button
                    onClick={() => setSelectedSub(sub)}
                    className="flex-1 md:flex-none bg-brand-blue hover:bg-brand-blue/90 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-brand-blue/20 transition-all active:scale-95"
                  >
                    مراجعة وتقييم
                  </button>
                ) : (
                  <div
                    className={`flex items-center gap-2 font-black text-sm ${sub.status === 'approved' ? 'text-emerald-500' : 'text-red-500'} px-6 py-4`}
                  >
                    {sub.status === 'approved' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                    {sub.status === 'approved' ? 'مقبول' : 'مرفوض'}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="py-32 text-center glass-card border-dashed">
            <ClipboardCheck size={80} className="mx-auto text-white/5 mb-6" />
            <h3 className="text-2xl font-black text-gray-500">
              لا يوجد تسليمات بهذا التصنيف حالياً
            </h3>
            <p className="text-gray-600 font-bold mt-2">
              سيظهر تقرير مفصل هنا فور رفع الطلاب لواجبات الدروس.
            </p>
          </div>
        )}
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {selectedSub && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-6 sm:p-10"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSub(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />

            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0f1e] rounded-[3.5rem] p-10 shadow-[0_32px_100px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <ClipboardList size={300} />
              </div>

              <div className="relative z-10 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-brand-blue/10 rounded-2xl flex items-center justify-center text-brand-blue">
                      <Star size={32} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white">تقييم الواجب</h2>
                      <p className="text-gray-500 font-bold">الطالب: {selectedSub.displayName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSub(null)}
                    className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 transition-colors"
                  >
                    <XCircle size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest mr-2">
                        رؤية الحل المرفوع
                      </label>
                      <button
                        onClick={() => handleViewSolution(selectedSub)}
                        className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-all font-bold text-white group cursor-pointer"
                      >
                        <ExternalLink size={20} className="text-brand-blue" /> فتح رابط الحل
                      </button>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest mr-2">
                        الدرجة النهائية (من 10)
                      </label>
                      <input
                        type="number"
                        max="10"
                        min="0"
                        placeholder="10 / ..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-black text-center focus:ring-2 focus:ring-brand-blue/50 outline-none transition-all"
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest mr-2 flex items-center gap-2">
                      <MessageSquare size={14} /> ملاحظات المعلم للطلاب
                    </label>
                    <textarea
                      placeholder="اكتب ملاحظاتك على الحل هنا..."
                      className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-6 text-white font-bold min-h-[150px] outline-none focus:ring-2 focus:ring-white/10 transition-all"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => handleReview('rejected')}
                      disabled={submitting}
                      className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-5 rounded-3xl font-black border border-red-500/20 transition-all flex items-center justify-center gap-3"
                    >
                      {submitting ? <Loader2 className="animate-spin" /> : <XCircle size={24} />}
                      رفض الحل
                    </button>
                    <button
                      onClick={() => handleReview('approved')}
                      disabled={submitting}
                      className="flex-2 bg-emerald-500 hover:bg-emerald-600 text-white py-5 px-10 rounded-3xl font-black shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                      {submitting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={24} />
                      )}
                      اعتماد الدرجة وقبول الواجب
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Solution Viewer Modal */}
      <AnimatePresence>
        {viewerSub && (
          <div
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewerSub(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-4xl bg-[#0a0f1e] rounded-[2.5rem] overflow-hidden border border-white/10 flex flex-col max-h-[90vh] shadow-[0_0_50px_rgba(0,0,0,0.8)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 bg-white/5 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-brand-blue/10 rounded-2xl flex items-center justify-center text-brand-blue">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">عرض ملف الواجب المرفوع</h3>
                    <p className="text-xs text-gray-500 font-bold mt-0.5">الطالب: {viewerSub.displayName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewerSub(null)}
                  className="w-12 h-12 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-2xl flex items-center justify-center text-gray-400 transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 bg-black/20 flex-1 overflow-y-auto flex flex-col justify-center items-center">
                {viewerSub.solutionUrl.startsWith('data:image/') ? (
                  <div className="w-full flex justify-center p-2">
                    <img
                      src={viewerSub.solutionUrl}
                      alt="حل واجب الطالب"
                      className="max-w-full max-h-[60vh] object-contain rounded-2xl border border-white/5 shadow-2xl"
                    />
                  </div>
                ) : (
                  <div className="text-center py-16 space-y-6">
                    <div className="w-24 h-24 bg-brand-blue/10 rounded-3xl flex items-center justify-center text-brand-blue mx-auto border border-brand-blue/20">
                      <FileText size={48} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xl font-bold text-white">ملف الحل المرفوع</h4>
                      <p className="text-sm text-gray-400">هذا الملف مرفوع بصيغة مشفرة أو بصيغة PDF/مستندات</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-white/5 border-t border-white/5 flex gap-4 shrink-0">
                <button
                  onClick={() => {
                    const ext = getExtensionFromBase64(viewerSub.solutionUrl);
                    downloadBase64File(viewerSub.solutionUrl, `${viewerSub.displayName || 'student'}_homework.${ext}`);
                  }}
                  className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white py-4 rounded-2xl font-black shadow-lg shadow-brand-blue/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Download size={20} /> تحميل ملف الواجب
                </button>
                <button
                  onClick={() => setViewerSub(null)}
                  className="px-8 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-2xl font-bold transition-colors border border-white/5 cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
