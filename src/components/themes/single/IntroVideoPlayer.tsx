import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Volume2, Shield, Sparkles, Clock, Monitor } from 'lucide-react';

interface IntroVideoPlayerProps {
  videoUrl?: string; // YouTube link or direct video file path
  posterUrl?: string; // Cover image
  title?: string;
  durationText?: string;
}

export const IntroVideoPlayer: React.FC<IntroVideoPlayerProps> = ({
  videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // default placeholder
  posterUrl = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop',
  title = 'شاهد طريقتنا المبتكرة في الشرح والتبسيط',
  durationText = '٢:٣٠ دقيقة',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Helper to extract YouTube Video ID
  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const youtubeId = getYoutubeId(videoUrl);
  const isYoutube = !!youtubeId;

  const handlePlayClick = () => {
    setIsPlaying(true);
  };

  return (
    <section 
      className="relative py-16 sm:py-24 bg-transparent text-white px-4 sm:px-6 lg:px-8 overflow-hidden"
      dir="rtl"
    >
      {/* Background soft ambient lights */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[60%] h-[40%] bg-brand-500/5 blur-[120px] -z-10 rounded-full" />
      <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] bg-indigo-500/5 blur-[100px] -z-10 rounded-full" />

      <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
        


        {/* Magnificent Frosted Glassmorphism Shell */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, type: 'spring', bounce: 0.2 }}
          className="relative max-w-4xl mx-auto p-3 sm:p-5 md:p-6 rounded-[2.5rem] bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40 overflow-hidden group"
        >
          {/* Glass glare effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none -z-10" />

          {/* Aspect-video Core Player Wrapper */}
          <div className="relative aspect-video w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 shadow-inner group">
            
            <AnimatePresence mode="wait">
              {!isPlaying ? (
                // 🖼️ Poster Frame / Overlay Mode
                <motion.div
                  key="poster-overlay"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 z-20 cursor-pointer flex flex-col justify-between p-6 sm:p-8"
                  onClick={handlePlayClick}
                >
                  {/* Poster Image */}
                  <img
                    src={posterUrl}
                    alt={title}
                    className="absolute inset-0 w-full h-full object-cover scale-100 group-hover:scale-103 transition-transform duration-700 ease-out"
                  />
                  
                  {/* Dark Vignette Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/30 group-hover:opacity-90 transition-opacity duration-300" />

                  {/* Top Badges */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold border border-white/5">
                      <Clock size={12} className="text-brand-400" />
                      {durationText}
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-brand-500/80 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-black border border-white/10 text-white shadow-lg shadow-brand-500/20">
                      <Volume2 size={12} />
                      تأكد من تشغيل الصوت
                    </span>
                  </div>

                  {/* Centered Glowing Play Trigger */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-brand-600/90 text-white border border-brand-400/50 flex items-center justify-center shadow-2xl pointer-events-auto"
                    >
                      {/* Pulse waves */}
                      <div className="absolute inset-0 rounded-full bg-brand-500/30 animate-ping duration-1500 opacity-75" />
                      <div className="absolute -inset-4 rounded-full bg-brand-600/10 animate-pulse duration-2000" />

                      <Play size={36} className="fill-white translate-x-[-2px] relative z-10 group-hover:scale-110 transition-transform duration-300" />
                    </motion.div>
                  </div>

                  {/* Bottom Text info */}
                  <div className="relative z-10 text-right space-y-1 sm:space-y-2">
                    <span className="text-xs text-brand-300 font-extrabold uppercase tracking-widest block">مقدمة المنصة</span>
                    <span className="text-base sm:text-xl font-black text-white block">ابدأ بمشاهدة الفيديو التعريفي للمادة وطريقة الشرح المبتكرة</span>
                  </div>
                </motion.div>
              ) : (
                // 🎬 Active Playing Mode
                <motion.div
                  key="video-frame"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="w-full h-full"
                >
                  {isYoutube ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&showinfo=0`}
                      title={title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={videoUrl}
                      controls
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>

        {/* Feature/Trust Badges under the player */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl text-right hover:border-brand-500/20 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 shrink-0">
              <Monitor size={22} />
            </div>
            <div>
              <h4 className="text-sm font-black text-white">جودة بث فائقة</h4>
              <p className="text-xs text-slate-400 mt-0.5">تقنيات تكيف ذكية تعمل مع سرعات الإنترنت المختلفة.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl text-right hover:border-indigo-500/20 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
              <Shield size={22} />
            </div>
            <div>
              <h4 className="text-sm font-black text-white">تشفير وحماية للمحتوى</h4>
              <p className="text-xs text-slate-400 mt-0.5">شاهد دروسك بأمان تام مع أعلى حماية وتشفير ضد النسخ.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl text-right hover:border-purple-500/20 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
              <Sparkles size={22} />
            </div>
            <div>
              <h4 className="text-sm font-black text-white">أسلوب تفاعلي ذكي</h4>
              <p className="text-xs text-slate-400 mt-0.5">اختبارات مدمجة ومتابعة مستمرة تضمن استيعابك للمعلومات.</p>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
};
