import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  Eye,
  RefreshCw,
  User,
  Phone,
  Mail,
  Calendar,
  Search,
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getTenantDb } from '../../lib/firebase';
import { useNotifications } from '../../contexts/NotificationContext';

interface StudentInfo {
  uid: string;
  displayName: string;
  email: string;
  studentPhone?: string;
  fatherPhone?: string;
  studentId: string;
  createdAt: string;
  role: string;
}

export const LeakDecoder: React.FC = () => {
  const { sendNotification } = useNotifications();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [filterMode, setFilterMode] = useState<'normal' | 'forensic'>('normal');

  // Input for the student ID seen by the teacher
  const [searchId, setSearchId] = useState('');
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load image from upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setError(null);
    setStudent(null);
    setSearchId('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        setImage(img);
        setImageSrc(img.src);
        setFilterMode('forensic'); // Automatically enable forensic filter for immediate glow!
        setProcessing(false);
      };
    };
    reader.readAsDataURL(file);
  };

  // Re-draw canvas with selected filters
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = image.width;
    canvas.height = image.height;

    // Draw base image
    ctx.drawImage(image, 0, 0);

    if (filterMode === 'forensic') {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Forensic filter: Isolate blue channel and invert it to make yellow text glow bright red
      for (let i = 0; i < data.length; i += 4) {
        const b = data[i + 2]; // Blue channel
        const invertedBlue = 255 - b;

        // Apply high-contrast amplification: if blue differs even slightly, make it glow red!
        const finalVal = invertedBlue > 4 ? 255 : 0;

        data[i] = finalVal; // R: glow red
        data[i + 1] = 0;    // G: black
        data[i + 2] = 0;    // B: black
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }, [image, filterMode]);

  // Search database for student ID or Email
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;

    setDecoding(true);
    setError(null);
    setStudent(null);

    try {
      const queryValue = searchId.trim();
      const tenantDb = getTenantDb();

      // Query by student ID
      let q = query(collection(tenantDb, 'users'), where('studentId', '==', queryValue));
      let snap = await getDocs(q);

      // Fallback: Query by email
      if (snap.empty) {
        q = query(collection(tenantDb, 'users'), where('email', '==', queryValue));
        snap = await getDocs(q);
      }

      if (!snap.empty) {
        const stuData = snap.docs[0].data();
        setStudent({
          uid: snap.docs[0].id,
          ...stuData,
        } as StudentInfo);
        sendNotification({
          type: 'success',
          title: 'تم العثور على المسرب!',
          message: `تم تحديد الطالب بنجاح: ${stuData.displayName}`,
        });
      } else {
        setError(`لم يتم العثور على طالب مسجل بالكود أو البريد الإلكتروني: ${queryValue}`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'فشل البحث في قاعدة البيانات.');
    } finally {
      setDecoding(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white font-display tracking-tight flex items-center gap-4">
            <ShieldAlert className="text-red-500 animate-pulse" />
            كاشف التسريبات الجنائي <span className="text-red-500 text-xs px-2.5 py-1 bg-red-500/10 rounded-full font-mono font-black">PRO</span>
          </h1>
          <p className="text-gray-400 font-bold mt-2">افك شفرة البصمة المائية المخفية ومعرفة صاحب الملف المسرب بدون أخطاء</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Image viewer */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
            {!imageSrc ? (
              <label className="flex flex-col items-center justify-center gap-4 py-20 cursor-pointer w-full group">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:border-red-500/30 transition-all group-hover:scale-105 duration-300">
                  <Upload size={32} className="text-gray-400 group-hover:text-red-500 transition-colors" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-white font-black text-lg">اضغط هنا لرفع صورة الجزء السفلي للملزمة المسربة</p>
                  <p className="text-gray-500 text-xs font-bold">قم بتصوير أو قص الجزء السفلي للملزمة (حوالي 3 سم الأخيرة) لقطة شاشة</p>
                </div>
              </label>
            ) : (
              <div className="relative w-full overflow-auto max-h-[600px] border border-white/10 rounded-2xl bg-black flex justify-center">
                <canvas ref={canvasRef} className="max-w-full" />
              </div>
            )}
          </div>

          {imageSrc && (
            <div className="bg-slate-900/20 border border-white/5 p-5 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="text-right space-y-2 max-w-xl">
                <p className="text-xs text-red-400 font-black">💡 دليل فك البصمة الجنائية:</p>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  1. البصمة الجنائية تقع في <span className="text-yellow-400 font-bold">منتصف أسفل الصفحة</span> (أعلى الهامش السفلي مباشرة).
                </p>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  2. عند تفعيل زر <span className="text-red-500 font-bold">"فك قناة اللون"</span>، ستظهر لك أرقام وإيميل صاحب الحساب مضيئة باللون الأحمر الساطع بشكل مقروء في أسفل الصفحة.
                </p>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  3. انقل الكود أو الإيميل المضيء واكتبه في خانة البحث على اليسار لكشف هويته بالكامل من قاعدة البيانات.
                </p>
              </div>
              <button
                onClick={() => {
                  setImage(null);
                  setImageSrc(null);
                  setStudent(null);
                  setSearchId('');
                  setError(null);
                }}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shrink-0"
              >
                <RefreshCw size={12} /> رفع صورة أخرى
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Search & investigation */}
        <div className="lg:col-span-4 space-y-6">
          {/* Controls */}
          <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Eye size={18} className="text-red-500" />
              التحكم والتحقيق
            </h3>

            {/* Filter Toggle */}
            <div className="space-y-2 text-right">
              <label className="text-xs text-gray-400 font-black">الفلتر الجنائي</label>
              <div className="grid grid-cols-2 gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10">
                <button
                  onClick={() => setFilterMode('normal')}
                  className={`py-2 rounded-xl text-xs font-black transition-all ${
                    filterMode === 'normal' ? 'bg-white/10 text-white shadow' : 'text-gray-400'
                  }`}
                  disabled={!imageSrc}
                >
                  طبيعي
                </button>
                <button
                  onClick={() => setFilterMode('forensic')}
                  className={`py-2 rounded-xl text-xs font-black transition-all ${
                    filterMode === 'forensic' ? 'bg-red-600 text-white shadow' : 'text-gray-400'
                  }`}
                  disabled={!imageSrc}
                >
                  فك قناة اللون
                </button>
              </div>
            </div>

            {/* Search Input Form */}
            <form onSubmit={handleSearch} className="space-y-3 text-right">
              <label className="text-xs text-gray-400 font-black">أدخل الكود المضيء المكتوب باللون الأحمر:</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="مثال: 1261034 أو الإيميل"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono font-bold placeholder:text-gray-600 focus:outline-none focus:border-red-500"
                />
              </div>
              <button
                type="submit"
                disabled={decoding || !searchId.trim()}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl transition-all shadow-xl shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {decoding ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>جاري الاستعلام...</span>
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    <span>كشف بيانات المسرب</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results Card */}
          <AnimatePresence mode="wait">
            {(student || error) && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 shadow-xl space-y-6 overflow-hidden relative"
              >
                {student && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                )}

                <h3 className="text-lg font-black text-white">النتيجة والتحقيق</h3>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-xs font-bold text-red-400 text-center">
                    {error}
                  </div>
                )}

                {student && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <CheckCircle2 size={24} />
                      </div>
                      <div className="text-right">
                        <h4 className="text-white font-black text-md">{student.displayName}</h4>
                        <p className="text-gray-500 text-xs font-bold">صاحب الحساب المسرب</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-1 border-b border-white/5 text-sm">
                        <span className="text-gray-500 font-bold flex items-center gap-1"><User size={14} /> كود الطالب</span>
                        <span className="text-white font-black font-mono">{student.studentId}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5 text-sm">
                        <span className="text-gray-500 font-bold flex items-center gap-1"><Mail size={14} /> البريد الإلكتروني</span>
                        <span className="text-white font-bold font-mono">{student.email}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5 text-sm">
                        <span className="text-gray-500 font-bold flex items-center gap-1"><Phone size={14} /> هاتف الطالب</span>
                        <span className="text-white font-bold font-mono">{student.studentPhone || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5 text-sm">
                        <span className="text-gray-500 font-bold flex items-center gap-1"><Phone size={14} /> هاتف الأب</span>
                        <span className="text-white font-bold font-mono">{student.fatherPhone || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5 text-sm">
                        <span className="text-gray-500 font-bold flex items-center gap-1"><Calendar size={14} /> تاريخ التسجيل</span>
                        <span className="text-white font-bold">
                          {student.createdAt ? new Date(student.createdAt).toLocaleDateString('ar-EG') : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
