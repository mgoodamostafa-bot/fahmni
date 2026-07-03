import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Video, BookOpen, Clock, Heart, ArrowUpRight, Play, Info } from 'lucide-react';

export interface Teacher {
  id: string;
  name: string;
  photo: string;
  subject: string;
  languages: string[];
  rating: number;
  reviewsCount: number;
  hourlyRate: string;
  videoUrl?: string;
  bio: string;
  isOnline: boolean;
}

export const MOCK_TEACHERS: Teacher[] = [
  {
    id: 't1',
    name: 'أ. أحمد عبد المنعم',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=2064&auto=format&fit=crop',
    subject: 'اللغة الإنجليزية',
    languages: ['الإنجليزية (شرح بالعامية)', 'الإنجليزية الأكاديمية (IELTS)'],
    rating: 4.95,
    reviewsCount: 342,
    hourlyRate: '٢٠٠ ج.م',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    bio: 'خبير تدريس مناهج اللغات الأجنبية والتحضير للاختبارات الدولية بخبرة تفوق الـ ١٢ عاماً.',
    isOnline: true,
  },
  {
    id: 't2',
    name: 'د. سارة المنصوري',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=2069&auto=format&fit=crop',
    subject: 'اللغة الفرنسية',
    languages: ['الفرنسية المتقدمة', 'الفرنسية للتأسيس'],
    rating: 4.88,
    reviewsCount: 198,
    hourlyRate: '٢٥٠ ج.م',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    bio: 'حاصلة على الدكتوراه في اللغويات المقارنة من جامعة السوربون، متخصصة في تبسيط النطق والقواعد.',
    isOnline: true,
  },
  {
    id: 't3',
    name: 'أ. محمود الشافعي',
    photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=2074&auto=format&fit=crop',
    subject: 'اللغة الألمانية',
    languages: ['الألمانية (A1 - C1)', 'ألمانية الأعمال'],
    rating: 4.91,
    reviewsCount: 215,
    hourlyRate: '٢٨٠ ج.م',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    bio: 'مدرس معتمد لدى معهد جوته، خبرة كبيرة في تأهيل الطلاب للسفر والدراسة في ألمانيا.',
    isOnline: false,
  },
  {
    id: 't4',
    name: 'أ. رانيا يوسف',
    photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=2061&auto=format&fit=crop',
    subject: 'اللغة الإيطالية',
    languages: ['الإيطالية للمبتدئين', 'المحادثة الحرة'],
    rating: 4.79,
    reviewsCount: 89,
    hourlyRate: '٢٢٠ ج.م',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    bio: 'مغرمة بالثقافة الإيطالية وشغوفة بنقلها لطلابي بأساليب تفاعلية مرحة وألعاب لغوية ممتعة.',
    isOnline: true,
  },
];

interface TeachersGridProps {
  onSelectTeacher?: (teacher: Teacher) => void;
  selectedTeacherId?: string;
}

export const TeachersGrid: React.FC<TeachersGridProps> = ({
  onSelectTeacher,
  selectedTeacherId,
}) => {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="w-full space-y-8" dir="rtl">
      
      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {MOCK_TEACHERS.map((teacher) => {
          const isSelected = selectedTeacherId === teacher.id;
          const isFav = !!favorites[teacher.id];

          return (
            <motion.div
              key={teacher.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              whileHover={{ y: -6 }}
              className={`relative flex flex-col rounded-3xl backdrop-blur-xl bg-white/5 border transition-all duration-300 overflow-hidden cursor-pointer ${
                isSelected
                  ? 'border-brand-500 shadow-2xl shadow-brand-500/10 bg-white/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
              onClick={() => onSelectTeacher?.(teacher)}
            >
              
              {/* Media Section (Photo & Hover Video preview) */}
              <div 
                className="relative aspect-[4/3] w-full bg-slate-950 overflow-hidden"
                onMouseEnter={() => setHoveredVideoId(teacher.id)}
                onMouseLeave={() => setHoveredVideoId(null)}
              >
                {/* Profile Photo */}
                <img
                  src={teacher.photo}
                  alt={teacher.name}
                  className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                />

                {/* Micro-interaction: Hover Preview Overlay */}
                <AnimatePresence>
                  {hoveredVideoId === teacher.id && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-4 text-center z-10"
                    >
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center text-white mb-2 shadow-lg shadow-brand-500/30"
                      >
                        <Play size={18} className="fill-white translate-x-[-1px]" />
                      </motion.div>
                      <span className="text-xs text-white font-bold">مشاهدة الفيديو التعريفي</span>
                      <span className="text-[10px] text-slate-400 mt-1">{teacher.subject}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Top Actions over Image */}
                <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10">
                  {/* Online/Offline Badge */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/40 backdrop-blur-md border border-white/5">
                    <span className={`w-2 h-2 rounded-full ${teacher.isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                    {teacher.isOnline ? 'متصل الآن' : 'غير متصل'}
                  </span>

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => toggleFavorite(teacher.id, e)}
                    className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 border border-white/5 flex items-center justify-center backdrop-blur-md text-white transition-colors"
                  >
                    <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : 'text-slate-300'} />
                  </button>
                </div>

                {/* Bottom Subject Overlay */}
                <div className="absolute bottom-3 right-3 z-10">
                  <span className="bg-brand-600/90 text-white text-[11px] font-black px-3 py-1 rounded-lg border border-brand-500/30 backdrop-blur-sm">
                    {teacher.subject}
                  </span>
                </div>
              </div>

              {/* Details Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-white hover:text-brand-300 transition-colors">
                      {teacher.name}
                    </h3>
                    {/* Hourly rate display */}
                    <div className="text-left">
                      <span className="text-sm font-black text-brand-400">{teacher.hourlyRate}</span>
                      <span className="text-[10px] text-slate-500 block font-bold">/ ساعة</span>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center text-yellow-500">
                      <Star size={12} className="fill-yellow-500" />
                    </div>
                    <span className="text-xs font-black text-white">{teacher.rating.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500 font-bold">({teacher.reviewsCount} تقييم)</span>
                  </div>

                  {/* Bio brief */}
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 font-medium">
                    {teacher.bio}
                  </p>
                </div>

                {/* Language / Specialty Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {teacher.languages.map((lang, idx) => (
                    <span
                      key={idx}
                      className="text-[9px] font-bold px-2 py-1 bg-white/[0.03] border border-white/[0.05] text-slate-300 rounded-md"
                    >
                      {lang}
                    </span>
                  ))}
                </div>

                {/* Card CTA Actions */}
                <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                  <button 
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected 
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-600/30' 
                        : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                    }`}
                  >
                    <span>{isSelected ? 'تعديل الموعد المختار' : 'حجز حصة تجريبية'}</span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>

              </div>

            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
