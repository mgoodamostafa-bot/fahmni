import React, { useState } from 'react';
import { collection, getDocs, deleteDoc, doc, writeBatch, query, where } from '../../lib/dbRouter';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertTriangle,
  Trash2,
  RefreshCw,
  Loader2,
  ShieldAlert,
  CheckCircle,
  Database,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export const Maintenance: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [status, setStatus] = useState<string>('');

  const COLLECTIONS_TO_WIPE = [
    'users', // Excluding Admins
    'courses', // Redundant casing handled
    'Courses',
    'lessons',
    'Lessons',
    'enrollments',
    'Enrollments',
    'codes', // Unified activation/recharge codes
    'question_bank', // Added: AI Question bank
    'exams', // Added: Quizzes and Exams
    'results', // Added: Student scores
    'exam_sessions', // Added: Active live exams
    'transactions', // Financial history
    'attendance', // Attendance logs
    'user_progress', // Tracking
    'notifications', // System alerts
    'groups', // Classes/Groups
    'centers', // Branch data
    'offline_results', // Manual results
    'activity_logs', // System logs
    'contact_messages', // User inquiries
    'discussions', // Comments & Discussions
  ];

  const handleFormatSystem = async () => {
    if (confirmText !== 'FORMAT') {
      alert('يرجى كتابة كلمة FORMAT للتأكيد');
      return;
    }

    if (
      !window.confirm('WARNING: This will delete ALL data. This cannot be undone. Are you sure?')
    ) {
      return;
    }

    setLoading(true);
    setStatus('جاري بدء عملية تهيئة النظام...');

    try {
      for (const collName of COLLECTIONS_TO_WIPE) {
        setStatus(`جاري مسح مجموعة: ${collName}...`);
        const q =
          collName === 'users'
            ? query(collection(db, collName), where('role', '!=', 'admin'))
            : collection(db, collName);

        const snapshot = await getDocs(q);
        const batch = writeBatch(db);

        snapshot.docs.forEach((docSnap) => {
          batch.delete(doc(db, collName, docSnap.id));
        });

        await batch.commit();
      }

      setStatus('تم مسح جميع البيانات بنجاح!');
      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Format error:', error);
      alert('حدث خطأ أثناء التهيئة: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        غير مسموح لك بدخول هذه الصفحة
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 text-right" dir="rtl">
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center shadow-2xl border border-red-500/10">
          <ShieldAlert size={36} />
        </div>
        <div>
          <h1 className="text-4xl font-black text-white mb-2">صيانة النظام</h1>
          <p className="text-gray-400 font-bold">أدوات الإدارة المتقدمة والتهيئة الشاملة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Reset Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 border-2 border-red-500/20 bg-red-500/5 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trash2 size={120} />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4 text-red-500">
              <AlertTriangle size={32} />
              <h2 className="text-2xl font-black italic">منطقة الخطر: فورمات المنصة</h2>
            </div>

            <p className="text-gray-300 font-bold leading-relaxed">
              هذا الإجراء سيقوم بحذف **كافة** البيانات من المنصة (الطلاب، المدرسين، الكورسات، بنك
              الأسئلة، المبيعات والكوبونات).
              <br />
              <span className="text-red-400">
                * سيتم الإبقاء فقط على حسابات "المدير (Admin)" وإعدادات الموقع الأساسية.
              </span>
            </p>

            <div className="bg-black/40 p-6 rounded-2xl border border-red-500/30 space-y-4">
              <label className="block text-sm font-black text-red-400">
                لتأكيد المسح الشامل، اكتب كلمة <span className="underline">FORMAT</span> في الأسفل:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full bg-red-500/10 border border-red-500/30 rounded-xl py-4 text-center text-white font-black tracking-widest placeholder-red-500/30 focus:outline-none"
                placeholder="اكتب الكلمة هنا..."
              />

              <button
                onClick={handleFormatSystem}
                disabled={loading || confirmText !== 'FORMAT'}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white py-5 rounded-2xl font-black shadow-2xl shadow-red-600/30 transition-all flex items-center justify-center gap-3 mt-4"
              >
                {loading ? <Loader2 className="animate-spin" /> : <RefreshCw size={24} />}
                تهيئة المنصة بالكامل الآن
              </button>
            </div>

            {status && (
              <div className="flex items-center gap-3 text-sm font-bold text-yellow-500 bg-yellow-500/10 p-4 rounded-xl animate-pulse">
                <Database size={18} />
                {status}
              </div>
            )}
          </div>
        </motion.div>

        {/* Database Stats Card */}
        <div className="glass-card p-10 border border-white/10 space-y-6">
          <div className="flex items-center gap-4 text-brand-blue">
            <Database size={32} />
            <h2 className="text-2xl font-black">حالة قاعدة البيانات</h2>
          </div>

          <div className="space-y-4">
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
              <span className="text-gray-400 font-bold">إصدار النظام</span>
              <span className="text-white font-black">v2.4.0 (Trial Mode)</span>
            </div>
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
              <span className="text-gray-400 font-bold">آخر تهيئة للنظام</span>
              <span className="text-white font-black">-- / -- / ----</span>
            </div>
          </div>

          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4 text-emerald-400">
            <CheckCircle size={24} />
            <p className="text-xs font-bold">
              قاعدة البيانات تعمل بشكل محلي ومستقل 100%. التخزين آمن ومحمي ومجاني بدون أي فواتير.
            </p>
          </div>
        </div>
      </div>

      {/* Backup & Restore Section */}
      <BackupRestoreCard />
    </div>
  );
};

const BackupRestoreCard: React.FC = () => {
  const [stats, setStats] = useState<{ collections: string[]; totalRecords: number; sizeKB: number }>({ collections: [], totalRecords: 0, sizeKB: 0 });
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadStats = async () => {
    const { getDbStats } = await import('../../lib/dbRouter');
    setStats(getDbStats());
  };

  React.useEffect(() => {
    loadStats();
  }, []);

  const handleDownload = async () => {
    const { downloadBackup } = await import('../../lib/dbRouter');
    downloadBackup('fahmni_platform');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoring(true);
    setRestoreMsg(null);

    try {
      const text = await file.text();
      const { restoreFromBackup } = await import('../../lib/dbRouter');
      const res = restoreFromBackup(text);

      if (res.success) {
        setRestoreMsg({
          type: 'success',
          text: `تم استرجاع النسخة الاحتياطية بنجاح! (${res.collections} مجموعة - ${res.records} عنصر)`
        });
        loadStats();
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setRestoreMsg({ type: 'error', text: `فشل الاسترجاع: ${res.error}` });
      }
    } catch (err: any) {
      setRestoreMsg({ type: 'error', text: `خطأ في الملف: ${err.message}` });
    } finally {
      setRestoring(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="glass-card p-10 border border-brand-purple/30 bg-brand-purple/5 space-y-6 rounded-3xl shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-brand-purple">
          <Database size={36} />
          <div>
            <h2 className="text-2xl font-black text-white">النسخ الاحتياطي والاسترجاع الشامل (Backup & Restore)</h2>
            <p className="text-sm text-gray-400 font-bold">تصدير واسترجاع بيانات المنصة بالكامل بضغط زر واحدة</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 px-4 py-2 rounded-xl text-xs font-bold text-gray-300">
            السجلات: <span className="text-brand-purple font-black">{stats.totalRecords}</span>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl text-xs font-bold text-gray-300">
            الحجم: <span className="text-emerald-400 font-black">{stats.sizeKB} KB</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {/* Export Card */}
        <div className="bg-black/30 p-8 rounded-2xl border border-white/10 space-y-4 text-right">
          <h3 className="text-lg font-black text-emerald-400">📥 تصدير نسخة احتياطية (.JSON)</h3>
          <p className="text-xs text-gray-400 leading-relaxed font-bold">
            قم بتنزيل ملف يحتوي على كافة بيانات المنصة (الكورسات، الدروس، الحسابات، الامتحانات، النتائج).
          </p>
          <button
            onClick={handleDownload}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            تنزيل ملف النسخة الاحتياطية (.JSON)
          </button>
        </div>

        {/* Import Card */}
        <div className="bg-black/30 p-8 rounded-2xl border border-white/10 space-y-4 text-right">
          <h3 className="text-lg font-black text-brand-blue">📤 استرجاع نسخة احتياطية (.JSON)</h3>
          <p className="text-xs text-gray-400 leading-relaxed font-bold">
            اختر ملف نسخة احتياطية سابقة لاستعادة كافة محتويات المنصة فوراً.
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={restoring}
            className="w-full bg-brand-blue hover:bg-blue-600 disabled:opacity-50 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {restoring ? <Loader2 className="animate-spin" /> : null}
            رفع واسترجاع الملف (.JSON)
          </button>
        </div>
      </div>

      {restoreMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-bold text-center ${
            restoreMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
          }`}
        >
          {restoreMsg.text}
        </div>
      )}
    </div>
  );
};
