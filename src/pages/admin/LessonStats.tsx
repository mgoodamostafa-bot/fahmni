import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Users,
  Play,
  Clock,
  TrendingUp,
  PieChart,
  Activity,
} from 'lucide-react';

export const LessonStats: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState<any>(null);

  useEffect(() => {
    const fetchLesson = async () => {
      if (!lessonId) return;
      try {
        const docSnap = await getDoc(doc(db, 'lessons', lessonId));
        if (docSnap.exists()) {
          setLesson(docSnap.data());
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
  }, [lessonId]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Activity className="animate-spin text-brand-blue" />
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 text-right" dir="rtl">
      <div className="flex items-center gap-4 mb-12">
        <button
          onClick={() => navigate(-1)}
          className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl transition-all border border-white/10"
        >
          <ArrowRight size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-white font-display">إحصائيات الدرس</h1>
          <p className="text-gray-400 font-bold mt-1">{lesson?.title || 'جاري التحميل...'}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <StatCard
          icon={<Users className="text-brand-blue" />}
          label="إجمالي المشاهدات"
          value="1,240"
          trend="+12%"
        />
        <StatCard
          icon={<Play className="text-brand-yellow" />}
          label="متوسط وقت المشاهدة"
          value="12:45"
          trend="+5%"
        />
        <StatCard
          icon={<TrendingUp className="text-emerald-500" />}
          label="معدل إكمال التقييم"
          value="85%"
          trend="+2%"
        />
      </div>

      <div className="glass-card p-12 text-center space-y-6">
        <BarChart3 size={64} className="mx-auto text-white/10" />
        <h2 className="text-2xl font-black text-white">تفاصيل المشاهدات والنمو القادم</h2>
        <p className="text-gray-500 font-bold max-w-lg mx-auto leading-relaxed">
          هذه الصفحة ستحتوي مستقبلاً على رسوم بيانية مفصلة توضح أوقات ذروة المشاهدة، وتفاعل الطلاب
          مع الاختبارات المرتبطة بهذا الدرس.
        </p>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, trend }: any) => (
  <motion.div whileHover={{ y: -5 }} className="glass-card p-8 space-y-4">
    <div className="flex justify-between items-start">
      <div className="p-3 bg-white/5 rounded-2xl">{icon}</div>
      <span className="text-emerald-500 text-xs font-black bg-emerald-500/10 px-2 py-1 rounded-lg">
        {trend}
      </span>
    </div>
    <div>
      <div className="text-gray-400 font-bold text-sm mb-1">{label}</div>
      <div className="text-3xl font-black text-white">{value}</div>
    </div>
  </motion.div>
);
