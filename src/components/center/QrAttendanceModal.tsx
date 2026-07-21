import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  X,
  CheckCircle,
  AlertCircle,
  Search,
  User,
  Volume2,
  Clock,
  Sparkles,
  Camera,
  RefreshCw,
} from 'lucide-react';
import { Student } from '../../hooks/useCenterData';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { dbRouter } from '../../services/dbRouter';

interface QrAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCenterId: string;
  selectedGroupId: string;
  selectedDate: string;
  allStudents: Student[];
  onAttendanceRecorded: (studentUid: string, status: 'present') => void;
}

interface ScanRecord {
  id: string;
  studentName: string;
  studentId: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
  message: string;
}

export const QrAttendanceModal: React.FC<QrAttendanceModalProps> = ({
  isOpen,
  onClose,
  selectedCenterId,
  selectedGroupId,
  selectedDate,
  allStudents,
  onAttendanceRecorded,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [lastScanned, setLastScanned] = useState<Student | null>(null);
  const [statusState, setStatusState] = useState<{
    type: 'idle' | 'success' | 'warning' | 'error';
    message: string;
  }>({
    type: 'idle',
    message: 'قم بتوجيه الكاميرا إلى كود الـ QR الخاص بكارت الطالب',
  });
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synthesize pleasant success audio beep
  const playBeep = (freq = 880, type: OscillatorType = 'sine') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch (e) {
      // Audio context blocked or not supported
    }
  };

  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      if (!html5QrcodeRef.current) {
        html5QrcodeRef.current = new Html5Qrcode('qr-reader-element');
      }

      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        // Prefer back camera if available
        const backCamera = devices.find((d) =>
          d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
        ) || devices[0];

        await html5QrcodeRef.current.start(
          backCamera.id,
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
          },
          (decodedText) => {
            handleCodeScanned(decodedText);
          },
          (errorMessage) => {
            // Ignore scan attempt errors
          }
        );
        setIsCameraActive(true);
      } else {
        setStatusState({
          type: 'warning',
          message: 'لم يتم العثور على كاميرا. يمكنك استخدام إدخال الكود يدويًا أو القارئ الضوئي.',
        });
      }
    } catch (err: any) {
      console.warn('QR Camera initialization error:', err);
      setIsCameraActive(false);
      setStatusState({
        type: 'warning',
        message: 'تعذر تشغيل الكاميرا تلقائيًا. يمكنك إدخال كود الطالب يدويًا بالأعلى.',
      });
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn('Scanner stop error:', err);
      }
    }
    setIsCameraActive(false);
  };

  const processAttendance = async (student: Student) => {
    try {
      playBeep(880, 'sine');

      const docId = `${student.uid}_${selectedDate}`;
      const record = {
        studentUid: student.uid,
        studentName: student.displayName,
        studentId: student.studentId || '',
        centerId: selectedCenterId || student.centerId || '',
        groupId: selectedGroupId || student.groupId || '',
        date: selectedDate,
        status: 'present',
        timestamp: new Date().toISOString(),
      };

      // 1. Supabase Sync
      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('attendance').upsert({
            id: docId,
            student_uid: student.uid,
            student_name: student.displayName,
            student_id: student.studentId || '',
            center_id: selectedCenterId || student.centerId || '',
            group_id: selectedGroupId || student.groupId || '',
            date: selectedDate,
            status: 'present',
            timestamp: new Date().toISOString(),
          });
        } catch (sbErr) {
          console.warn('Supabase attendance scan sync error:', sbErr);
        }
      }

      // 2. Firestore Sync
      await setDoc(doc(db, 'attendance', docId), record, { merge: true });

      // Deduct session if applicable
      if ((student as any).packageName && (student as any).remainingSessions > 0) {
        const newSessions = Math.max(0, ((student as any).remainingSessions || 1) - 1);
        await dbRouter.updateStudent(student.uid, { remainingSessions: newSessions });
        (student as any).remainingSessions = newSessions;
      }

      onAttendanceRecorded(student.uid, 'present');
      setLastScanned(student);

      const msg = `تم تسجيل حضور: ${student.displayName}`;
      setStatusState({ type: 'success', message: msg });

      setScanHistory((prev) => [
        {
          id: Math.random().toString(),
          studentName: student.displayName,
          studentId: student.studentId || 'بدون كود',
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          status: 'success',
          message: 'تم تسجيل الحضور بنجاح',
        },
        ...prev,
      ]);
    } catch (err) {
      console.error('Error processing QR attendance:', err);
      playBeep(300, 'sawtooth');
      setStatusState({ type: 'error', message: 'فشل حفظ سجل الحضور للطالب' });
    }
  };

  const handleCodeScanned = (scannedText: string) => {
    const cleanText = scannedText.trim();
    if (!cleanText) return;

    // Search student by code, UID, or phone number
    const matchedStudent = allStudents.find(
      (s) =>
        s.studentId === cleanText ||
        s.uid === cleanText ||
        (s.studentPhone && s.studentPhone.replace(/\D/g, '') === cleanText.replace(/\D/g, ''))
    );

    if (matchedStudent) {
      processAttendance(matchedStudent);
    } else {
      playBeep(350, 'square');
      setStatusState({
        type: 'error',
        message: `لم يتم العثور على طالب بالكود: (${cleanText})`,
      });
      setScanHistory((prev) => [
        {
          id: Math.random().toString(),
          studentName: 'طالب غير معروف',
          studentId: cleanText,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          status: 'error',
          message: 'كود غير مسجل في النظام',
        },
        ...prev,
      ]);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleCodeScanned(manualCode);
    setManualCode('');
    if (inputRef.current) inputRef.current.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn" dir="rtl">
      <div className="bg-[#0b1329] border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
              <QrCode size={22} />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>مسح كارت QR للحضور السريع</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] rounded-full border border-emerald-500/30 font-bold">
                  تلقائي ⚡
                </span>
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                تاريخ الحصة المحدد: <span className="text-emerald-400 font-mono font-bold">{selectedDate}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin scrollbar-thumb-white/10">
          {/* Manual Input / Barcode Scanner Row */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                ref={inputRef}
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="أدخل كود الطالب أو استخدم قارئ الباركود اليدوي (مثل: 2026028)..."
                className="w-full pr-10 pl-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>تسجيل</span>
            </button>
          </form>

          {/* Camera Scan Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Live Camera Viewport */}
            <div className="relative bg-black/50 border border-white/10 rounded-2xl p-2 min-h-[240px] flex flex-col items-center justify-center overflow-hidden">
              <div id="qr-reader-element" className="w-full rounded-xl overflow-hidden min-h-[220px]"></div>

              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070c19] text-center p-4">
                  <Camera size={40} className="text-gray-600 mb-2 animate-pulse" />
                  <p className="text-xs text-gray-400 font-bold mb-3">الكاميرا غير نشطة حالياً</p>
                  <button
                    onClick={startScanner}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2"
                  >
                    <RefreshCw size={14} /> إعادة تشغيل الكاميرا
                  </button>
                </div>
              )}
            </div>

            {/* Live Status & Last Scanned Card */}
            <div className="space-y-4">
              {/* Notification Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${
                  statusState.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : statusState.type === 'error'
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : statusState.type === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-white/5 border-white/10 text-gray-300'
                }`}
              >
                {statusState.type === 'success' ? (
                  <CheckCircle size={24} className="shrink-0 text-emerald-400" />
                ) : statusState.type === 'error' ? (
                  <AlertCircle size={24} className="shrink-0 text-red-400" />
                ) : (
                  <Sparkles size={24} className="shrink-0 text-amber-400" />
                )}
                <p className="text-xs font-bold leading-relaxed">{statusState.message}</p>
              </div>

              {/* Scanned Student Profile Card */}
              {lastScanned ? (
                <div className="bg-white/5 border border-emerald-500/30 p-4 rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-lg">
                      {lastScanned.displayName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">{lastScanned.displayName}</h4>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                        كود: <span className="text-emerald-400 font-bold">{lastScanned.studentId || 'بدون كود'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-white/5">
                    <div className="bg-black/20 p-2 rounded-lg text-gray-300">
                      <span className="block text-gray-500 font-bold">الصف الدراسي:</span>
                      <span className="font-bold text-white">{lastScanned.grade || lastScanned.level || 'غير حدد'}</span>
                    </div>
                    <div className="bg-black/20 p-2 rounded-lg text-gray-300">
                      <span className="block text-gray-500 font-bold">الحالة:</span>
                      <span className="font-bold text-emerald-400">حاضر (تم التسجيل) ✅</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl text-center space-y-2">
                  <User size={32} className="mx-auto text-gray-600" />
                  <p className="text-xs text-gray-400 font-bold">في انتظار مسح كارت الطالب...</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Scanned Log Table */}
          {scanHistory.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h4 className="text-xs font-black text-white flex items-center gap-2">
                <Clock size={14} className="text-emerald-400" />
                <span>سجل الماسح للحصة الحالية ({scanHistory.length} طالب)</span>
              </h4>

              <div className="max-h-40 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
                {scanHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'
                        }`}
                      />
                      <span className="font-bold text-white">{item.studentName}</span>
                      <span className="text-[10px] text-gray-400 font-mono">({item.studentId})</span>
                    </div>

                    <span className="text-[10px] text-gray-500 font-mono">{item.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex justify-between items-center text-xs">
          <span className="text-gray-400 text-[11px]">
            يدعم قارئ QR وقارئ الباركود اليدوي بالسلك والـ Bluetooth.
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
