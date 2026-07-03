import React from 'react';
import { ClipboardList, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export const Assignments: React.FC = () => {
  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center"
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 max-w-lg w-full border-white/10 shadow-2xl"
      >
        <div className="w-24 h-24 bg-brand-blue/10 text-brand-blue rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <ClipboardList size={48} />
        </div>

        <h1 className="text-3xl font-black text-white mb-4">التكليفات والواجبات</h1>
        <p className="text-slate-400 mb-8 leading-relaxed text-lg">
          لا يوجد تكليفات حالية لك. سيقوم المدرس بإضافة التكليفات قريباً لمتابعة مستواك الدراسي.
        </p>

        <Link
          to="/courses"
          className="inline-flex items-center gap-3 px-8 py-4 bg-brand-blue text-white rounded-2xl font-black hover:bg-brand-blue/90 transition-all shadow-xl shadow-brand-blue/20 group"
        >
          <BookOpen size={20} className="group-hover:scale-110 transition-transform" />
          تصفح الكورسات المتاحة
        </Link>
      </motion.div>
    </div>
  );
};
