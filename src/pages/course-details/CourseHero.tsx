import React from 'react';
import { motion } from 'framer-motion';
import {
  Star, Users, Play, Zap, GraduationCap
} from 'lucide-react';
import { FALLBACKS } from '../../constants/fallbacks';

// ─── Subject Hero Images ────────────────────────────────────────
const SUBJECT_IMAGES: Record<string, string> = {
  'العلوم المتكاملة': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&q=80',
  'الفيزياء': 'https://images.unsplash.com/photo-1636466484294-4758b901f8a5?w=1200&q=80',
  'الكيمياء': 'https://images.unsplash.com/photo-1532187863486-abf51ad982d7?w=1200&q=80',
  'الرياضيات': 'https://images.unsplash.com/photo-1509228468518-180dd482180c?w=1200&q=80',
  'الأحياء': 'https://images.unsplash.com/photo-1530026405186-ed1b0ca67b0b?w=1200&q=80',
  'الجيولوجيا': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80',
  'اللغة العربية': 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=1200&q=80',
  'اللغة الإنجليزية': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&q=80',
  'الفلسفة': 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&q=80',
  'علم النفس': 'https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?w=1200&q=80',
};
const DEFAULT_HERO = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200';

export const getSubjectImage = (subject?: string) => {
  if (!subject) return DEFAULT_HERO;
  const match = Object.entries(SUBJECT_IMAGES).find(([k]) => subject.includes(k));
  return match?.[1] || DEFAULT_HERO;
};

// ─── Types ──────────────────────────────────────────────────────
interface CourseHeroProps {
  course: {
    title: string;
    subject: string;
    coverImage?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    price: number;
    rating?: number;
  };
  lessonsCount: number;
  enrolledCount: number;
  teacherName: string;
  children: React.ReactNode; // Purchase Card / Continue Learning slot
}

// ─── Animation variants ─────────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }
};

export const CourseHero: React.FC<CourseHeroProps> = ({
  course, lessonsCount, enrolledCount, teacherName, children
}) => {
  const heroImage = course.coverImage || course.imageUrl || course.thumbnailUrl || getSubjectImage(course.subject);

  return (
    <motion.div
      {...fadeUp}
      className="relative rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden group shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] min-h-[460px] sm:min-h-[520px] flex items-end"
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3000ms] ease-out"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e] via-[#0a0f1e]/70 to-[#0a0f1e]/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f1e]/40 to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 w-full p-6 sm:p-10 lg:p-14 flex flex-col lg:flex-row justify-between items-stretch lg:items-end gap-8 lg:gap-12">
        {/* Left: Course Info */}
        <div className="flex-1 text-right">
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="flex flex-wrap items-center gap-2.5 mb-6 justify-center lg:justify-start"
          >
            <span className="bg-brand-blue/20 text-brand-blue text-[11px] font-black px-4 py-1.5 rounded-full backdrop-blur-xl border border-brand-blue/30 tracking-tight">
              {course.subject}
            </span>
            {lessonsCount > 0 && (
              <span className="bg-white/5 text-gray-300 text-[11px] font-black px-4 py-1.5 rounded-full backdrop-blur-xl border border-white/10 flex items-center gap-1.5">
                <Play size={12} className="fill-current" /> {lessonsCount} حصة
              </span>
            )}
            {course.price === 0 && (
              <span className="bg-emerald-500/20 text-emerald-400 text-[11px] font-black px-4 py-1.5 rounded-full backdrop-blur-xl border border-emerald-500/30 flex items-center gap-1.5">
                <Zap size={12} /> مجاني
              </span>
            )}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-black mb-6 leading-[1.15] text-white tracking-tight drop-shadow-2xl font-display"
          >
            {course.title}
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
            className="flex flex-wrap items-center gap-3 sm:gap-4 text-gray-400 font-bold justify-center lg:justify-start"
          >
            <div className="flex items-center gap-2 px-3.5 py-2 bg-white/5 rounded-xl border border-white/5 backdrop-blur-md">
              <Star size={16} className="text-brand-yellow fill-current" />
              <span className="text-white text-sm">{course.rating || '4.9'}</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 bg-white/5 rounded-xl border border-white/5 backdrop-blur-md">
              <Users size={16} className="text-brand-blue" />
              <span className="text-white text-sm">{enrolledCount || 0} طالب</span>
            </div>
            {teacherName !== FALLBACKS.TEACHER_NAME && (
              <div className="flex items-center gap-2 px-3.5 py-2 bg-white/5 rounded-xl border border-white/5 backdrop-blur-md">
                <GraduationCap size={16} className="text-purple-400" />
                <span className="text-white text-sm">{teacherName}</span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Right: Purchase Card Slot */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="w-full lg:max-w-sm shrink-0"
        >
          {children}
        </motion.div>
      </div>
    </motion.div>
  );
};
