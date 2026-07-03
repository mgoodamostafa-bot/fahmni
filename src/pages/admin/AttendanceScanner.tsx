import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CheckCircle, AlertCircle, User, Clock, QrCode, ArrowRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface ScannedStudent {
  uid: string;
  displayName: string;
  studentId: string;
  photoURL?: string;
  level?: string;
  grade?: string;
}

interface AttendanceRecord {
  id: string;
  studentName: string;
  studentId: string;
  timestamp: any;
}

export const AttendanceScanner: React.FC = () => {
  const navigate = useNavigate();
  const [scannedStudent, setScannedStudent] = useState<ScannedStudent | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string }>({
    type: 'idle',
    message: 'جاهز للمسح...',
  });
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [manualId, setManualId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
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
    // Expected format: Student Unique ID or Student ID Number
    handleRecordAttendance(decodedText);
  }

  function onScanFailure(error: any) {
    // console.warn(`Code scan error = ${error}`);
  }

  const handleRecordAttendance = async (identifier: string) => {
    if (loading) return;
    setLoading(true);
    setStatus({ type: 'idle', message: 'جاري التحقق...' });

    try {
      // 1. Find Student (Check by UID or StudentID)
      let studentSnap = await getDocs(
        query(collection(db, 'users'), where('studentId', '==', identifier))
      );

      if (studentSnap.empty) {
        // Try fallback search by UID if the QR contains the Firebase UID
        const userDoc = await getDoc(doc(db, 'users', identifier));
        if (userDoc.exists()) {
          // Wrapped in a dummy snapshot-like structure for consistency
          studentSnap = { docs: [userDoc] } as any;
        }
      }

      if (studentSnap.empty) {
        setStatus({ type: 'error', message: 'لم يتم العثور على الطالب' });
        setScannedStudent(null);
        setLoading(false);
        return;
      }

      const studentData = studentSnap.docs[0].data() as ScannedStudent;
      studentData.uid = studentSnap.docs[0].id;
      setScannedStudent(studentData);

      // 2. Record Attendance
      const record = {
        studentUid: studentData.uid,
        studentName: studentData.displayName,
        studentId: studentData.studentId,
        timestamp: serverTimestamp(),
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      };

      await addDoc(collection(db, 'attendance'), record);

      setStatus({ type: 'success', message: 'تم تسجيل الحضور بنجاح' });

      // Add to local recent list
      setRecentRecords((prev) =>
        [
          {
            id: Math.random().toString(),
            studentName: studentData.displayName,
            studentId: studentData.studentId,
            timestamp: new Date(),
          },
          ...prev,
        ].slice(0, 5)
      );

      // Reset after 3 seconds
      setTimeout(() => {
        setScannedStudent(null);
        setStatus({ type: 'idle', message: 'جاهز للمسح...' });
      }, 3000);
    } catch (err) {
      console.error('Attendance Error:', err);
      setStatus({ type: 'error', message: 'حدث خطأ أثناء التسجيل' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-right" dir="rtl">
      <div className="max-w-4xl mx-auto p-6 space-y-8 pb-24">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <button
              onClick={() => navigate('/teacher')}
              className="text-brand-blue hover:text-brand-yellow flex items-center gap-2 mb-2 transition-colors group"
            >
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              <span>العودة للوحة التحكم</span>
            </button>
            <h1 className="text-3xl font-black text-white">نظام حضور السنتر الذكي</h1>
          </div>
          <div className="w-12 h-12 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center">
            <QrCode size={28} />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Scanner Side */}
          <div className="space-y-6">
            <div className="glass-card p-4 overflow-hidden relative border-brand-blue/20 border-2">
              <div id="reader" className="w-full rounded-xl overflow-hidden shadow-2xl"></div>
              <div className="absolute top-4 right-4 bg-brand-blue/80 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-black text-white animate-pulse">
                الكاميرا نشطة الآن
              </div>
            </div>

            <div
              className={`p-6 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                status.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'
                  : status.type === 'error'
                    ? 'bg-red-500/10 border-red-500/50 text-red-500'
                    : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle size={24} />
              ) : status.type === 'error' ? (
                <AlertCircle size={24} />
              ) : (
                <Clock size={24} className="animate-spin-slow" />
              )}
              <span className="font-black">{status.message}</span>
            </div>

            {/* Manual Entry */}
            <div className="glass-card p-6">
              <h3 className="text-white font-black mb-4 flex items-center gap-2 text-sm">
                <Search size={18} /> إدخال كود الطالب يدوياً
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="مثال: 126107"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-brand-blue transition-all"
                />
                <button
                  onClick={() => handleRecordAttendance(manualId)}
                  disabled={loading || !manualId}
                  className="bg-brand-blue text-white px-6 py-3 rounded-xl font-black hover:bg-brand-blue/80 transition-all disabled:opacity-50"
                >
                  تسجيل
                </button>
              </div>
            </div>
          </div>

          {/* Result Side */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {scannedStudent ? (
                <motion.div
                  key="student"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass-card p-8 border-emerald-500/30 border-2 text-center"
                >
                  <div className="w-32 h-32 mx-auto mb-6 rounded-[2.5rem] overflow-hidden border-4 border-emerald-500 shadow-2xl">
                    {scannedStudent.photoURL ? (
                      <img
                        src={scannedStudent.photoURL}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center text-gray-500">
                        <User size={64} />
                      </div>
                    )}
                  </div>
                  <h2 className="text-2xl font-black text-white mb-2">
                    {scannedStudent.displayName}
                  </h2>
                  <p className="text-brand-blue font-bold tracking-widest mb-6">
                    ID: {scannedStudent.studentId}
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <p className="text-[10px] text-gray-500 font-black mb-1">المرحلة</p>
                      <p className="text-sm font-bold text-white">
                        {scannedStudent.level || 'غير محدد'}
                      </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <p className="text-[10px] text-gray-500 font-black mb-1">الصف</p>
                      <p className="text-sm font-bold text-white">
                        {scannedStudent.grade || 'غير محدد'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="glass-card p-12 border-dashed border-white/10 flex flex-col items-center justify-center text-gray-500 text-center">
                  <User size={64} className="opacity-10 mb-6" />
                  <p className="font-bold">في انتظار مسح الكود...</p>
                  <p className="text-xs opacity-50 mt-2">بيانات الطالب ستظهر هنا فور المسح</p>
                </div>
              )}
            </AnimatePresence>

            {/* Recent History */}
            <div className="glass-card p-6">
              <h3 className="text-white font-black mb-6 border-b border-white/5 pb-4">
                آخر عمليات التسجيل
              </h3>
              <div className="space-y-4">
                {recentRecords.length > 0 ? (
                  recentRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-emerald-500/30 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                          <CheckCircle size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">{record.studentName}</p>
                          <p className="text-[10px] text-gray-500">ID: {record.studentId}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-gray-500">
                        {record.timestamp.toLocaleTimeString('ar-EG')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-6 text-gray-600 text-sm">لا يوجد سجلات حالية</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
