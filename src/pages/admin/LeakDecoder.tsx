import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  Image as ImageIcon,
  RefreshCw,
  User,
  Phone,
  Mail,
  Calendar,
  Eye,
  Sliders,
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

  // Alignment points (A: top-left, B: top-right, C: bottom-left of the yellow grid)
  const [pointA, setPointA] = useState({ x: 100, y: 100 });
  const [pointB, setPointB] = useState({ x: 300, y: 100 });
  const [pointC, setPointC] = useState({ x: 100, y: 300 });
  const [activePoint, setActivePoint] = useState<'A' | 'B' | 'C' | null>(null);

  // Decoded Results
  const [decodedId, setDecodedId] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load image from upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setError(null);
    setStudent(null);
    setDecodedId(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        setImage(img);
        setImageSrc(img.src);
        // Default handles based on image size
        const w = img.width;
        const h = img.height;
        setPointA({ x: w * 0.5 - w * 0.05, y: h * 0.91 });
        setPointB({ x: w * 0.5 + w * 0.05, y: h * 0.91 });
        setPointC({ x: w * 0.5 - w * 0.05, y: h * 0.95 });
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

    // Match canvas size to image aspect ratio
    canvas.width = image.width;
    canvas.height = image.height;

    // Draw base image
    ctx.drawImage(image, 0, 0);

    if (filterMode === 'forensic') {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Forensic filter: Isolate blue channel and invert it to make yellow glow red
      for (let i = 0; i < data.length; i += 4) {
        const b = data[i + 2]; // Blue channel

        // Invert blue channel (yellow has low blue, so inverted is high/bright)
        const invertedBlue = 255 - b;

        // Apply contrast stretch: since barcode is extremely faint, any difference > 4 glows max red!
        const finalVal = invertedBlue > 4 ? 255 : 0;

        data[i] = finalVal; // R: glow red
        data[i + 1] = 0;    // G: black
        data[i + 2] = 0;    // B: black
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }, [image, filterMode]);

  // Handle canvas mouse/touch movements to drag alignment points
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasMousePos(e);
    const dist = (p: { x: number; y: number }) =>
      Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2);

    // Hit-test radius of 30px (scaled to image size)
    const hitRadius = (canvasRef.current?.width || 1000) * 0.03;

    if (dist(pointA) < hitRadius) {
      setActivePoint('A');
    } else if (dist(pointB) < hitRadius) {
      setActivePoint('B');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activePoint) return;
    const pos = getCanvasMousePos(e);

    if (activePoint === 'A') setPointA(pos);
    if (activePoint === 'B') setPointB(pos);
  };

  const handleMouseUp = () => {
    setActivePoint(null);
  };

  // Decode yellow barcode scanline from canvas
  const handleDecode = async () => {
    if (!canvasRef.current || !image) return;
    setDecoding(true);
    setError(null);
    setStudent(null);

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Sample original image bytes (not filtered)
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = canvas.width;
      sampleCanvas.height = canvas.height;
      const sCtx = sampleCanvas.getContext('2d')!;
      sCtx.drawImage(image, 0, 0);

      const imgData = sCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
      const data = imgData.data;

      // Scanline from Point A (start) to Point B (end)
      const dx = pointB.x - pointA.x;
      const dy = pointB.y - pointA.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 20) {
        throw new Error('يرجى تحديد بداية ونهاية الباركود بشكل صحيح بسحب النقطة الزرقاء والخضراء.');
      }

      // Number of samples along the scanline (proportional to distance)
      const numSamples = Math.round(dist * 2);
      const yellowValues: number[] = [];

      for (let i = 0; i < numSamples; i++) {
        const t = i / (numSamples - 1);
        const sx = Math.round(pointA.x + t * dx);
        const sy = Math.round(pointA.y + t * dy);

        if (sx >= 0 && sx < sampleCanvas.width && sy >= 0 && sy < sampleCanvas.height) {
          const idx = (sy * sampleCanvas.width + sx) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Yellow metric: (Red + Green) - 2 * Blue
          const yellowMetric = (r + g) - 2 * b;
          yellowValues.push(yellowMetric > 0 ? yellowMetric : 0);
        } else {
          yellowValues.push(0);
        }
      }

      // Smooth the signal using a moving average window to eliminate noise
      const smoothed: number[] = [];
      const windowSize = 3;
      for (let i = 0; i < yellowValues.length; i++) {
        let sum = 0;
        let count = 0;
        for (let w = -windowSize; w <= windowSize; w++) {
          if (i + w >= 0 && i + w < yellowValues.length) {
            sum += yellowValues[i + w];
            count++;
          }
        }
        smoothed.push(sum / count);
      }

      // Calculate dynamic threshold: 45% of maximum intensity
      const maxVal = Math.max(...smoothed);
      const minVal = Math.min(...smoothed);
      const threshold = minVal + (maxVal - minVal) * 0.45;

      // Binarize signal (1 = bar, 0 = space)
      const binary = smoothed.map(val => (val > threshold ? 1 : 0));

      // Find bars (run-length encoding of 1s)
      const runs: { start: number; end: number; width: number }[] = [];
      let inRun = false;
      let runStart = 0;

      for (let i = 0; i < binary.length; i++) {
        if (binary[i] === 1 && !inRun) {
          inRun = true;
          runStart = i;
        } else if (binary[i] === 0 && inRun) {
          inRun = false;
          const runEnd = i - 1;
          const width = runEnd - runStart + 1;
          // Filter out tiny noise runs
          if (width > dist * 0.005) {
            runs.push({ start: runStart, end: runEnd, width });
          }
        }
      }
      if (inRun) {
        runs.push({ start: runStart, end: binary.length - 1, width: binary.length - runStart });
      }

      console.log('Detected runs count:', runs.length, runs);

      if (runs.length !== 38) {
        throw new Error(`تم رصد عدد قضبان (${runs.length}) بدلاً من 38. يرجى محاذاة النقاط (أ) و (ب) بدقة أكبر على الباركود المضيء باللون الأحمر.`);
      }

      // Classify runs into narrow (0) and wide (1)
      const widths = runs.map(r => r.width);
      const minWidth = Math.min(...widths);
      const maxWidth = Math.max(...widths);
      const classificationThreshold = minWidth + (maxWidth - minWidth) * 0.4;

      const decodedBits = runs.map(r => (r.width > classificationThreshold ? 1 : 0));
      console.log('Decoded bits:', decodedBits);

      // Verify start and stop patterns: [1, 0, 1]
      const startPattern = decodedBits.slice(0, 3);
      const stopPattern = decodedBits.slice(-3);

      if (startPattern[0] !== 1 || startPattern[1] !== 0 || startPattern[2] !== 1) {
        console.warn('Start pattern mismatch:', startPattern);
      }
      if (stopPattern[0] !== 1 || stopPattern[1] !== 0 || stopPattern[2] !== 1) {
        console.warn('Stop pattern mismatch:', stopPattern);
      }

      // Decode the 8 digits (4 bits each, from index 3 to 34)
      let decodedId = '';
      for (let i = 0; i < 8; i++) {
        const bitIdx = 3 + i * 4;
        const b3 = decodedBits[bitIdx];
        const b2 = decodedBits[bitIdx + 1];
        const b1 = decodedBits[bitIdx + 2];
        const b0 = decodedBits[bitIdx + 3];
        
        const digit = (b3 << 3) | (b2 << 2) | (b1 << 1) | b0;
        if (digit >= 0 && digit <= 9) {
          decodedId += digit.toString();
        } else {
          decodedId += (digit % 10).toString();
        }
      }

      setDecodedId(decodedId);

      // Search database for student ID
      const tenantDb = getTenantDb();
      const q = query(collection(tenantDb, 'users'), where('studentId', '==', decodedId));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const stuData = snap.docs[0].data();
        setStudent({
          uid: snap.docs[0].id,
          ...stuData,
        } as StudentInfo);
        sendNotification({
          type: 'success',
          title: 'تم كشف المسرّب!',
          message: `تم فك التشفير بنجاح وتحديد الطالب: ${stuData.displayName}`,
        });
      } else {
        setError(`لم يتم العثور على طالب مسجل بالكود: ${decodedId}`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'فشل فك التشفير الجنائي. تأكد من مطابقة النقاط مع الباركود بشكل دقيق.');
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
          <p className="text-gray-400 font-bold mt-2">ارفع صورة الملزمة المسربة لفك شفرة البصمة المائية ومعرفة المسرّب</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Image viewer & Alignment handles */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
            {!imageSrc ? (
              <label className="flex flex-col items-center justify-center gap-4 py-20 cursor-pointer w-full group">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:border-red-500/30 transition-all group-hover:scale-105 duration-300">
                  <Upload size={32} className="text-gray-400 group-hover:text-red-500 transition-colors" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-white font-black text-lg">اضغط هنا لرفع صورة الملزمة المسربة</p>
                  <p className="text-gray-500 text-xs font-bold">يدعم صيغ JPG, PNG أو لقطات الشاشة المأخوذة بكاميرا الهاتف</p>
                </div>
              </label>
            ) : (
              <div className="relative w-full overflow-auto max-h-[600px] border border-white/10 rounded-2xl bg-black flex justify-center">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="cursor-crosshair max-w-full"
                />

                {/* Overlaid Vector alignment helpers */}
                <svg
                  className="absolute inset-0 pointer-events-none w-full h-full"
                  viewBox={`0 0 ${image?.width || 100} ${image?.height || 100}`}
                  preserveAspectRatio="none"
                >
                  {/* Barcode scanline illustration */}
                  <line x1={pointA.x} y1={pointA.y} x2={pointB.x} y2={pointB.y} stroke="rgba(239, 68, 68, 0.6)" strokeWidth="3" strokeDasharray="4" />

                  {/* Draw calibration points */}
                  <circle cx={pointA.x} cy={pointA.y} r="8" fill="#3b82f6" stroke="white" strokeWidth="2" />
                  <text x={pointA.x + 12} y={pointA.y - 12} fill="#3b82f6" fontSize="14" fontWeight="bold">أ (بداية الباركود)</text>

                  <circle cx={pointB.x} cy={pointB.y} r="8" fill="#10b981" stroke="white" strokeWidth="2" />
                  <text x={pointB.x + 12} y={pointB.y - 12} fill="#10b981" fontSize="14" fontWeight="bold">ب (نهاية الباركود)</text>
                </svg>
              </div>
            )}
          </div>

          {imageSrc && (
            <div className="bg-slate-900/20 border border-white/5 p-5 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="text-right space-y-2 max-w-xl">
                <p className="text-xs text-red-400 font-black">💡 دليل فك الباركود الجنائي المخفي:</p>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  1. الباركود الجنائي المخفي يقع دائماً في <span className="text-yellow-400 font-bold">منتصف أسفل الصفحة</span> (على بعد 2-3 سم من الحافة السفلية).
                </p>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  2. اضغط أولاً على زر <span className="text-red-500 font-bold">"فك قناة اللون"</span> بالجانب الأيسر لتتحول خطوط الباركود المخفية إلى <span className="text-red-400 font-bold">أعمدة حمراء مضيئة</span> واضحة للغاية.
                </p>
                <p className="text-xs text-gray-400 font-medium leading-relaxed">
                  3. قم بمطابقة الخط المتقطع مع الباركود: اسحب المقبض **الأزرق (أ)** وضعه على أول عمود مضيء جهة اليسار، والمقبض **الأخضر (ب)** على آخر عمود مضيء جهة اليمين.
                </p>
              </div>
              <button
                onClick={() => {
                  setImage(null);
                  setImageSrc(null);
                  setStudent(null);
                  setDecodedId(null);
                  setError(null);
                }}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shrink-0"
              >
                <RefreshCw size={12} /> رفع صورة أخرى
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Control Panel & Forensic results */}
        <div className="lg:col-span-4 space-y-6">
          {/* Settings & Decoding actions */}
          <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Sliders size={18} className="text-red-500" />
              لوحة التحكم والكشف
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
                  <Eye size={12} className="inline mr-1" /> طبيعي
                </button>
                <button
                  onClick={() => setFilterMode('forensic')}
                  className={`py-2 rounded-xl text-xs font-black transition-all ${
                    filterMode === 'forensic' ? 'bg-red-600 text-white shadow' : 'text-gray-400'
                  }`}
                  disabled={!imageSrc}
                >
                  <ShieldAlert size={12} className="inline mr-1" /> فك قناة اللون
                </button>
              </div>
            </div>

            <button
              onClick={handleDecode}
              disabled={!imageSrc || decoding}
              className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl transition-all shadow-xl shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {decoding ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>جاري قراءة البصمة الجنائية...</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={16} />
                  <span>كشف البصمة المائية للمسرّب</span>
                </>
              )}
            </button>
          </div>

          {/* Results Card */}
          <AnimatePresence mode="wait">
            {(student || decodedId || error) && (
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

                {decodedId && (
                  <div className="bg-black/40 p-4 rounded-xl border border-white/10 text-center space-y-1">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">الكود الرقمي المستخرج</p>
                    <p className="text-3xl font-mono font-black text-red-500 tracking-[0.2em]">{decodedId}</p>
                  </div>
                )}

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
                        <p className="text-gray-500 text-xs font-bold">تم العثور على صاحب الملف المسرّب</p>
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
