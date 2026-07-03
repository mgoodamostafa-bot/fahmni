import React, { useState } from 'react';
import { collection, getDocs, deleteDoc, doc, writeBatch, query, where } from 'firebase/firestore';
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
              قاعدة البيانات تعمل بشكل مستقر حالياً. جميع النسخ الاحتياطية يتم تفعيلها تلقائياً عبر
              Firebase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
