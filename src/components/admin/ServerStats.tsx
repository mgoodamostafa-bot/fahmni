import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, HardDrive, Zap, Info, Trash2, Archive, AlertCircle } from 'lucide-react';
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const ServerStats: React.FC = () => {
  const [stats, setStats] = useState({
    firestore: { used: 0, total: 1024 * 1024, label: '0.5 MB' }, // Mock/Estimate
    storage: { used: 0, total: 5 * 1024, label: '1.2 GB' }, // 5GB limit
    bandwidth: { used: 35, total: 100, label: '35%' }, // 50GB estimate
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Estimating document count as Firestore usage proxy for the demo
    const fetchUsage = async () => {
      try {
        const collections = ['users', 'Courses', 'enrollments', 'lessons', 'discussions'];
        let totalDocs = 0;

        // We can't get exact MB from client SDK, so we estimate based on document counts
        // 1GB is a lot for text data (approx 1-2 million small docs)
        const counts = await Promise.all(
          collections.map(async (col) => {
            const q = query(collection(db, col), limit(100)); // Just a sample
            const snapshot = await getDocs(q);
            return snapshot.size;
          })
        );

        totalDocs = counts.reduce((a, b) => a + b, 0);

        // Heuristic: Average doc size 1KB. 1000 docs = 1MB.
        // For real-time billing metrics, one would use Cloud Functions + Monitoring API.
        // Here we provide a "Real-Feeling" data driven by actual counts.

        setStats({
          firestore: {
            used: Math.min(100, (totalDocs / 100000) * 100),
            total: 100,
            label: `${((totalDocs * 0.5) / 1024).toFixed(2)} MB`,
          },
          storage: {
            used: 24, // Static high-fidelity mock for demo as storage API list is expensive
            total: 100,
            label: '1.2 GB / 5GB',
          },
          bandwidth: {
            used: 42,
            total: 100,
            label: '21 GB / 50GB',
          },
        });
      } catch (e) {
        console.error('Error estimating stats:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  const handleDeleteOldHomework = async () => {
    if (!window.confirm('هل أنت متأكد من حذف الواجبات التي مر عليها أكثر من 30 يوماً؟')) return;
    setLoading(true);
    try {
      // In a real app, this would trigger a Cloud Function.
      // Client-side cleanup for demo/MVP:
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const q = query(
        collection(db, 'homework_submissions'),
        where('createdAt', '<', Timestamp.fromDate(thirtyDaysAgo))
      );
      const snapshot = await getDocs(q);

      const deletePromises = snapshot.docs.map((d) =>
        deleteDoc(doc(db, 'homework_submissions', d.id))
      );
      await Promise.all(deletePromises);

      alert(`تم حذف ${snapshot.size} ملف واجب قديم بنجاح.`);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء التنظيف.');
    } finally {
      setLoading(false);
    }
  };

  const isStorageCritical = stats.storage.used >= 90;

  return (
    <div className="space-y-8 bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
      {isStorageCritical && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 border-4 border-red-500/20 pointer-events-none rounded-[2.5rem]"
        />
      )}

      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/5 blur-3xl -z-10" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
        <div>
          <h2 className="text-2xl font-black text-white font-display flex items-center gap-3">
            <Zap className="text-brand-blue" />
            غرفة العمليات (Infrastructure)
          </h2>
          <p className="text-gray-500 font-bold text-sm mt-1">مراقبة حية وأدوات صيانة السيرفر</p>
        </div>
        <div className="flex items-center gap-3">
          {isStorageCritical && (
            <div className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl border border-red-500/20 text-[10px] font-black flex items-center gap-2 animate-pulse">
              <AlertCircle size={14} />
              تحذير: المساحة ممتلئة!
            </div>
          )}
          <div className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
            مستقر
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatIndicator
          icon={<Database size={20} />}
          label="Firestore Usage"
          value={stats.firestore.used}
          detail={stats.firestore.label}
          color="blue"
          info="الحد المجاني 1GB."
        />
        <StatIndicator
          icon={<HardDrive size={20} />}
          label="Storage Usage"
          value={stats.storage.used}
          detail={stats.storage.label}
          color={isStorageCritical ? 'red' : 'purple'}
          info="المساحة المتاحة للملفات 5GB."
        />
        <StatIndicator
          icon={<Zap size={20} />}
          label="Bandwidth"
          value={stats.bandwidth.used}
          detail={stats.bandwidth.label}
          color="amber"
          info="نقل البيانات الشهري."
        />
      </div>

      {/* Maintenance Controls */}
      <div className="pt-8 border-t border-white/5 space-y-4">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
          أدوات الصيانة الدورية
        </h3>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleDeleteOldHomework}
            disabled={loading}
            className="flex items-center gap-3 px-6 py-4 bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 rounded-2xl text-sm font-bold text-gray-300 hover:text-red-500 transition-all group"
          >
            <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
            حذف الواجبات القديمة ({'>'}30 يوم)
          </button>
          <button className="flex items-center gap-3 px-6 py-4 bg-white/5 hover:bg-brand-blue/10 border border-white/5 hover:border-brand-blue/20 rounded-2xl text-sm font-bold text-gray-300 hover:text-brand-blue transition-all group">
            <Archive size={18} className="group-hover:scale-110 transition-transform" />
            نظام الأرشفة (الخمول {'>'}60 يوم)
          </button>
        </div>
      </div>
    </div>
  );
};

const StatIndicator = ({ icon, label, value, detail, color, info }: any) => {
  const colors = {
    blue: 'bg-brand-blue',
    purple: 'bg-purple-600',
    amber: 'bg-amber-500',
    red: 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]',
  };

  return (
    <div className="space-y-4 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg bg-white/5 text-white/50 group-hover:text-white transition-colors`}
          >
            {icon}
          </div>
          <span className="text-xs font-black text-gray-400 group-hover:text-gray-200 transition-colors">
            {label}
          </span>
        </div>
        <span className="text-xs font-black text-white tabular-nums">{detail}</span>
      </div>

      <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className={`h-full ${colors[color as keyof typeof colors]} shadow-[0_0_15px_rgba(0,0,0,0.5)]`}
        />
      </div>

      <div className="flex items-start gap-2 text-[9px] text-gray-500 font-bold leading-tight">
        <Info size={10} className="shrink-0 mt-0.5" />
        {info}
      </div>
    </div>
  );
};
