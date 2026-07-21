import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { dbRouter } from '../../services/dbRouter';
import { CheckCircle, AlertCircle, User, Clock, QrCode, ArrowRight, Search, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface ScannedStudent {
  uid: string;
  displayName: string;
  studentId: string;
  photoURL?: string;
  level?: string;
  grade?: string;
  centerId?: string;
  groupId?: string;
  remainingSessions?: number;
  packageName?: string;
}

interface AttendanceRecord {
  id: string;
  studentName: string;
  studentId: string;
  timestamp: string;
}

export const AttendanceScanner: React.FC = () => {
  const navigate = useNavigate();
  const [scannedStudent, setScannedStudent] = useState<ScannedStudent | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string }>({
    type: 'idle',
    message: 'جاهز للمسح الضوئي الفوري ⚡ (يوجه كارت الطالب للكاميرا أو القارئ اليدوي)...',
  });
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [manualId, setManualId] = useState('');
  const [allStudentsMap, setAllStudentsMap] = useState<Map<string, any>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScannedTimeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Synthesize instant zero-latency audio chime
  const playChime = (freq = 880, type: OscillatorType = 'sine') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // Audio not supported
    }
  };

  // Build high-speed O(1) Student Lookup Map
  const buildStudentsIndex = (studentsList: any[]) => {
    const map = new Map<string, any>();
    studentsList.forEach((s) => {
      if (s.studentId) map.set(String(s.studentId).trim(), s);
      if (s.uid) map.set(String(s.uid).trim(), s);
      if (s.id) map.set(String(s.id).trim(), s);
      if (s.studentPhone) map.set(s.studentPhone.replace(/\D/g, ''), s);
    });
    setAllStudentsMap(map);
  };

  // Pre-load all center and platform students on mount
  useEffect(() => {
    const loadStudents = async () => {
      try {
        const students = await dbRouter.getAllStudents();
        buildStudentsIndex(students);
      } catch (err) {
        console.warn('Error preloading students in AttendanceScanner:', err);
      }
    };
    loadStudents();

    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 25, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      scanner.clear().catch((error) => {
        console.error('Failed to clear scanner: ', error);
      });
    };
  }, []);

  async function onScanSuccess(decodedText: string) {
    handleRecordAttendance(decodedText);
  }

  function onScanFailure(error: any) {
    // Silent fail for camera frames
  }

  // Background Database Save Task (Non-blocking)
  const saveAttendanceToDb = async (studentData: ScannedStudent) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const docId = `${studentData.uid}_${todayStr}`;
    const nowIso = new Date().toISOString();

    // 1. Supabase Async Save
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('attendance').upsert({
          id: docId,
          student_uid: studentData.uid,
          student_name: studentData.displayName,
          student_id: studentData.studentId,
          center_id: studentData.centerId || 'hossam_center',
          group_id: studentData.groupId || 'h6nm0P5BSUp5GfPyjsJZ',
          date: todayStr,
          status: 'present',
          timestamp: nowIso,
        });
      } catch (sbErr) {
        console.warn('Supabase attendance scanner upsert warning:', sbErr);
      }
    }

    // 2. Firestore Async Save
    await setDoc(
      doc(db, 'attendance', docId),
      {
        studentUid: studentData.uid,
        studentName: studentData.displayName,
        studentId: studentData.studentId,
        centerId: studentData.centerId || 'hossam_center',
        groupId: studentData.groupId || 'h6nm0P5BSUp5GfPyjsJZ',
        date: todayStr,
        status: 'present',
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );

    // Deduct remaining sessions if applicable
    if (studentData.packageName && (studentData.remainingSessions ?? 0) > 0) {
      const newSessions = Math.max(0, (studentData.remainingSessions || 1) - 1);
      await dbRouter.updateStudent(studentData.uid, { remainingSessions: newSessions });
    }
  };

  const handleRecordAttendance = async (identifier: string) => {
    const rawId = identifier.trim();
    if (!rawId) return;

    // Debounce duplicate scans within 2.5 seconds
    const now = Date.now();
    if (
      lastScannedTimeRef.current.code === rawId &&
      now - lastScannedTimeRef.current.time < 2500
    ) {
      return;
    }
    lastScannedTimeRef.current = { code: rawId, time: now };

    const cleanPhone = rawId.replace(/\D/g, '');

    // ⚡ INSTANT 0ms LOOKUP from memory
    let matched =
      allStudentsMap.get(rawId) ||
      (cleanPhone ? allStudentsMap.get(cleanPhone) : null);

    // Fallback dynamic lookup if not matched in pre-indexed map
    if (!matched) {
      try {
        const freshStudents = await dbRouter.getAllStudents();
        buildStudentsIndex(freshStudents);
        matched = freshStudents.find(
          (s: any) =>
            (s.studentId && String(s.studentId).trim() === rawId) ||
            (s.studentId && String(s.studentId).trim().replace(/^0+/, '') === rawId.replace(/^0+/, '')) ||
            (s.uid && String(s.uid).trim() === rawId) ||
            (s.id && String(s.id).trim() === rawId) ||
            (s.studentPhone && s.studentPhone.replace(/\D/g, '') === cleanPhone)
        );
      } catch (e) {
        console.warn('Error doing fallback student lookup:', e);
      }
    }

    if (!matched) {
      playChime(300, 'sawtooth');
      setStatus({ type: 'error', message: `لم يتم العثور على طالب بالكود: (${rawId})` });
      setScannedStudent(null);
      return;
    }

    const studentData: ScannedStudent = {
      uid: matched.uid || matched.id,
      displayName: matched.displayName || matched.name || 'طالب سنتر',
      studentId: matched.studentId || matched.code || rawId,
      photoURL: matched.photoURL || matched.avatar,
      level: matched.level || matched.grade || 'الصف الأول الثانوي',
      grade: matched.grade || matched.level || 'الصف الأول الثانوي',
      centerId: matched.centerId || 'hossam_center',
      groupId: matched.groupId || 'h6nm0P5BSUp5GfPyjsJZ',
      remainingSessions: matched.remainingSessions,
      packageName: matched.packageName,
    };

    // 🚀 1. INSTANT ZERO-LATENCY UI UPDATE (0ms)
    playChime(880, 'sine');
    setScannedStudent(studentData);
    setStatus({ type: 'success', message: `تم تسجيل حضور: ${studentData.displayName} بنجاح ✅` });

    setRecentRecords((prev) => [
      {
        id: Math.random().toString(),
        studentName: studentData.displayName,
        studentId: studentData.studentId,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...prev,
    ].slice(0, 8));

    setManualId('');
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // 🚀 2. ASYNCHRONOUS BACKGROUND DB SAVE (0ms Blocking)
    saveAttendanceToDb(studentData).catch((err) => {
      console.error('Async Attendance Save Error:', err);
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleRecordAttendance(manualId);
  };

  return (
    <div className="min-h-screen bg-[#070c19] text-right text-white" dir="rtl">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
        {/* Header */}
        <div className="flex justify-between items-center bg-white/[0.02] border border-white/10 p-5 rounded-3xl backdrop-blur-md">
          <div>
            <button
              onClick={() => navigate('/teacher')}
              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2 mb-1 transition-colors text-xs font-bold group"
            >
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              <span>العودة للوحة تحكم المعلم</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>نظام حضور السنتر الذكي السريع</span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] rounded-full border border-emerald-500/30 font-bold flex items-center gap-1">
                <Zap size={12} className="text-emerald-400 fill-emerald-400 animate-bounce" />
                فائق السرعة (0ms)
              </span>
            </h1>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center">
            <QrCode size={26} />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Scanner Side */}
          <div className="space-y-6">
            <div className="glass-card p-4 overflow-hidden relative border-emerald-500/30 border-2 rounded-3xl bg-black/40">
              <div id="reader" className="w-full rounded-2xl overflow-hidden shadow-2xl min-h-[240px]"></div>
              <div className="absolute top-4 right-4 bg-emerald-500/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black text-slate-950 flex items-center gap-1.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                <span>الماسح الذكي نشط (25 FPS)</span>
              </div>
            </div>

            {/* Live Status Notification Box */}
            <div
              className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${
                status.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-500/10'
                  : status.type === 'error'
                    ? 'bg-red-500/10 border-red-500/50 text-red-300'
                    : 'bg-white/5 border-white/10 text-gray-300'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle size={26} className="shrink-0 text-emerald-400" />
              ) : status.type === 'error' ? (
                <AlertCircle size={26} className="shrink-0 text-red-400" />
              ) : (
                <Clock size={26} className="shrink-0 text-amber-400 animate-spin-slow" />
              )}
              <span className="font-bold text-xs leading-relaxed">{status.message}</span>
            </div>

            {/* Manual Entry or Barcode Gun Scanner */}
            <div className="bg-white/[0.02] border border-white/10 p-5 rounded-3xl space-y-3">
              <h3 className="text-white font-black text-xs flex items-center gap-2">
                <Search size={16} className="text-emerald-400" />
                <span>إدخال كود الطالب أو القارئ الضوئي (Barcode Gun)</span>
              </h3>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={manualId}
                  onChange={(e) => {
                    setManualId(e.target.value);
                    // Fast auto-trigger for Barcode guns if code is 6+ digits
                    if (e.target.value.length >= 6) {
                      handleRecordAttendance(e.target.value);
                    }
                  }}
                  placeholder="أدخل كود الطالب (مثل: 2026028)..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs font-mono font-bold outline-none focus:border-emerald-500 transition-all"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!manualId.trim()}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-3 rounded-2xl font-black text-xs transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  تسجيل
                </button>
              </form>
            </div>
          </div>

          {/* Result Side */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {scannedStudent ? (
                <motion.div
                  key="student"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="bg-white/[0.03] border-2 border-emerald-500/40 p-6 rounded-3xl text-center space-y-4 shadow-2xl relative overflow-hidden"
                >
                  <div className="w-24 h-24 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-black text-3xl">
                    {scannedStudent.photoURL ? (
                      <img
                        src={scannedStudent.photoURL}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{scannedStudent.displayName.charAt(0)}</span>
                    )}
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-white">
                      {scannedStudent.displayName}
                    </h2>
                    <p className="text-emerald-400 font-mono font-bold text-xs mt-1">
                      الكود: {scannedStudent.studentId}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-black/30 p-3 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-400 font-bold mb-1">الصف الدراسي</p>
                      <p className="font-black text-white">
                        {scannedStudent.grade || scannedStudent.level || 'غير محدد'}
                      </p>
                    </div>
                    <div className="bg-black/30 p-3 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-400 font-bold mb-1">حالة الحضور</p>
                      <p className="font-black text-emerald-400 flex items-center justify-center gap-1">
                        <CheckCircle size={14} /> تم الحضور ✅
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-white/[0.02] border border-dashed border-white/10 p-10 rounded-3xl flex flex-col items-center justify-center text-gray-500 text-center min-h-[220px]">
                  <User size={54} className="opacity-20 mb-3" />
                  <p className="font-bold text-xs text-gray-400">في انتظار مسح كارت الطالب...</p>
                  <p className="text-[11px] text-gray-600 mt-1">بيانات الطالب الفورية ستظهر هنا بدون أي تأخير ⚡</p>
                </div>
              )}
            </AnimatePresence>

            {/* Recent History */}
            <div className="bg-white/[0.02] border border-white/10 p-5 rounded-3xl space-y-4">
              <h3 className="text-white font-black text-xs border-b border-white/5 pb-3 flex items-center justify-between">
                <span>آخر عمليات التسجيل بالماسح الفوري</span>
                <span className="text-emerald-400 font-mono text-[10px] font-bold">({recentRecords.length} طالب)</span>
              </h3>
              <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {recentRecords.length > 0 ? (
                  recentRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-white/[0.02] rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                          <CheckCircle size={16} />
                        </div>
                        <div>
                          <p className="font-black text-white">{record.studentName}</p>
                          <p className="text-[10px] text-gray-400 font-mono">الكود: {record.studentId}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500">{record.timestamp}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-6 text-gray-500 text-xs">لا يوجد تسجيلات سابقة حتى الآن</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
