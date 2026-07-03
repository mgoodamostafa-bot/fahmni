import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, HelpCircle, X, Sparkles, ShieldCheck } from 'lucide-react';

interface AccountGuideProps {
  videoUrl?: string;
  role: 'student' | 'teacher';
}

/**
 * Extracts a YouTube video ID from various URL formats:
 */
const getYoutubeId = (url: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?\s]*).*/;
  const match = trimmed.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

/**
 * Parses the video URL and returns the appropriate embed type and URL.
 */
const getEmbedInfo = (url: string) => {
  if (!url) return { type: 'unknown', url: '' };
  const trimmed = url.trim();

  // 1. YouTube
  const ytId = getYoutubeId(trimmed);
  if (ytId) {
    return {
      type: 'youtube',
      url: `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1&autoplay=1`,
      id: ytId
    };
  }

  // 2. Vimeo
  const vimeoMatch = trimmed.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  if (vimeoMatch) {
    return {
      type: 'vimeo',
      url: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&loop=0`,
      id: vimeoMatch[1]
    };
  }

  // 3. Google Drive
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return {
      type: 'drive',
      url: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
      id: driveMatch[1]
    };
  }

  // 4. Direct Video (mp4, webm, ogg)
  if (/\.(mp4|webm|ogg)(?:\?.*)?$/i.test(trimmed)) {
    return {
      type: 'direct',
      url: trimmed
    };
  }

  // Fallback
  return {
    type: 'unknown',
    url: trimmed
  };
};

export const AccountGuide: React.FC<AccountGuideProps> = ({ videoUrl, role }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(
    () => localStorage.getItem(`hide_guide_${role}`) === 'true'
  );

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHidden(true);
    localStorage.setItem(`hide_guide_${role}`, 'true');
  };

  // Determine the final video URL with fallback defaults
  const finalVideoUrl = useMemo(() => {
    const url = videoUrl?.trim();
    if (url && url.length > 5) return url;
    // Fallback defaults
    return role === 'student'
      ? 'https://www.youtube.com/watch?v=7u3S-5J2BIA'
      : 'https://www.youtube.com/watch?v=vpPH_E9X4p0';
  }, [videoUrl, role]);

  // Extract embed information
  const embedInfo = useMemo(() => getEmbedInfo(finalVideoUrl), [finalVideoUrl]);

  if (isHidden) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="relative group cursor-pointer w-full overflow-hidden rounded-[2.5rem] border border-white/5 bg-slate-900/40 shadow-2xl transition-all hover:border-brand-blue/30 hover:shadow-brand-blue/20"
        onClick={() => setIsOpen(true)}
      >
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-blue/10 via-transparent to-brand-blue/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand-blue/20 rounded-full blur-[80px] group-hover:bg-brand-blue/30 transition-colors duration-500" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px] group-hover:bg-purple-500/30 transition-colors duration-500" />

        <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-8 backdrop-blur-2xl p-6 md:p-8 rounded-[2.5rem]">
          {/* Dismiss Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 left-4 md:top-6 md:left-6 z-20 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center text-white/40 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 shadow-sm"
            title="إخفاء هذا الدليل"
          >
            <X size={18} />
          </button>

          {/* Icon Area */}
          <div className="relative shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-brand-blue/20 rounded-3xl blur-xl animate-pulse" />
            <div className="w-20 h-20 md:w-28 md:h-28 bg-gradient-to-br from-brand-blue to-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-brand-blue/20 relative z-10 border border-white/20 transform group-hover:rotate-3 transition-transform duration-500">
              <Play size={40} fill="currentColor" className="ml-2" />
            </div>
          </div>

          {/* Text Area */}
          <div className="flex-1 space-y-3 md:space-y-4 text-center md:text-right" dir="rtl">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-brand-blue bg-brand-blue/10 px-4 py-1.5 rounded-full border border-brand-blue/20 flex items-center gap-1.5 shadow-inner">
                <Sparkles size={12} className="animate-pulse" />
                فيديو تعليمي
              </span>
            </div>
            <h3 className="text-xl md:text-3xl font-black text-white leading-tight drop-shadow-sm">
              دليلك الشامل لاستخدام المنصة باحترافية
            </h3>
            <p className="text-gray-400 font-bold text-sm md:text-lg leading-relaxed max-w-3xl">
              {role === 'student'
                ? 'شرح كامل لكل مميزات حسابك وكيفية الوصول للكورسات، الامتحانات، ومتابعة تقدمك.'
                : 'دليل شامل لإدارة كورساتك، متابعة أداء الطلاب، رفع الدروس وبنوك الأسئلة بسهولة تامة.'}
            </p>
          </div>

          {/* Call to Action Button */}
          <div className="shrink-0 w-full md:w-auto mt-4 md:mt-0 flex justify-center">
            <div className="flex items-center justify-center gap-3 bg-white/5 border border-white/10 px-8 py-4 w-full md:w-auto rounded-2xl group-hover:bg-brand-blue group-hover:text-white transition-all duration-300 shadow-md">
              <span className="font-black text-sm uppercase tracking-widest">شاهد الآن</span>
              <HelpCircle size={22} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Video Modal — Fully Responsive */}
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-8"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-4xl bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col max-h-[95vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-5 md:p-6 bg-white/5 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-blue/10 rounded-xl sm:rounded-2xl flex items-center justify-center text-brand-blue border border-brand-blue/20 shadow-inner">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h4 className="text-base sm:text-lg font-black text-white">
                      دليل استخدام {role === 'student' ? 'الطالب' : 'المعلم'}
                    </h4>
                    <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                      فيديو الشرح التفصيلي
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-xl sm:rounded-2xl flex items-center justify-center text-gray-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Video Player Area */}
              <div className="p-3 sm:p-4 md:p-6 bg-black/20 flex-1 overflow-auto">
                <div className="relative w-full rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-white/5 bg-black" style={{ paddingTop: '56.25%' /* 16:9 aspect ratio */ }}>
                  {embedInfo.type === 'direct' ? (
                    <video
                      src={embedInfo.url}
                      controls
                      autoPlay
                      className="absolute inset-0 w-full h-full"
                    />
                  ) : embedInfo.type !== 'unknown' ? (
                    <iframe
                      src={embedInfo.url}
                      title={role === 'student' ? 'دليل الطالب' : 'دليل المعلم'}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                      style={{ border: 'none' }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <div className="text-center space-y-3 px-4">
                        <Play size={48} className="mx-auto opacity-30" />
                        <p className="text-sm font-bold text-white">رابط الفيديو غير مدعوم للتشغيل المباشر</p>
                        <p className="text-xs text-gray-400 max-w-md mx-auto">
                          يمكنك النقر على الزر بالأسفل لفتح الفيديو ومشاهدته مباشرة في علامة تبويب جديدة.
                        </p>
                        <a
                          href={finalVideoUrl}
                          target="_blank; noreferrer"
                          rel="noopener noreferrer"
                          className="inline-block mt-3 px-6 py-2.5 bg-brand-blue text-white rounded-xl text-xs font-bold hover:bg-brand-blue/90 transition-all shadow-md"
                        >
                          فتح مشاهدة الفيديو مباشرة ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 bg-white/5 text-center border-t border-white/5 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-gray-400 text-[10px] sm:text-xs md:text-sm font-bold leading-relaxed flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-brand-blue animate-pulse" />
                  إذا واجهتك أي صعوبة بعد مشاهدة الفيديو، يرجى التواصل مع الدعم الفني.
                </p>
                <a
                  href={finalVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-blue hover:text-brand-blue/80 font-bold underline transition-colors"
                >
                  رابط الفيديو الأصلي ↗
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
