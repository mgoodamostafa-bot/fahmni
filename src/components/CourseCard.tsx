import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Clock, BookOpen, Star, ChevronLeft, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ProgressBar } from './ProgressBar';

interface Course {
  id: string;
  title: string;
  subject: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  price: number;
  progress?: number;
  lessonCount?: number;
  duration?: string;
  teacherName?: string;
  teacherPhotoURL?: string;
}

interface CourseCardProps {
  course: Course;
  showProgress?: boolean;
  isEnrolled?: boolean;
  onClick?: () => void;
  actualLessonCount?: number | null;
  enrolledCount?: number;
}

export const CourseCard = React.memo<CourseCardProps>(({ 
  course, 
  showProgress = false, 
  isEnrolled = false, 
  onClick,
  actualLessonCount = null,
  enrolledCount = 0
}) => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [lessonsCount, setLessonsCount] = React.useState<number | null>(null);
  const [hasPdf, setHasPdf] = React.useState(false);
  const [hasQuiz, setHasQuiz] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const fetchLessonsInfo = async () => {
      try {
        const qUpper = query(collection(db, 'Lessons'), where('courseId', '==', course.id));
        const snapUpper = await getDocs(qUpper);
        let docs = snapUpper.docs;

        if (docs.length === 0) {
          const qLower = query(collection(db, 'lessons'), where('courseId', '==', course.id));
          const snapLower = await getDocs(qLower);
          docs = snapLower.docs;
        }

        if (!active) return;
        setLessonsCount(docs.length);

        let pdf = false;
        let quiz = false;
        docs.forEach((d) => {
          const data = d.data();
          if (data.pdfUrl) pdf = true;
          if (data.quizUrl || data.examId) quiz = true;
        });
        setHasPdf(pdf);
        setHasQuiz(quiz);
      } catch (err) {
        console.error('Error fetching lessons info:', err);
      }
    };
    fetchLessonsInfo();
    return () => {
      active = false;
    };
  }, [course.id]);
  
  const subjectFallbacks: Record<string, string> = {
    'العلوم المتكاملة': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80',
    'علوم متكاملة': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80',
    'الفيزياء': 'https://images.unsplash.com/photo-1636466484294-4758b901f8a5?w=800&q=80',
    'فيزياء': 'https://images.unsplash.com/photo-1636466484294-4758b901f8a5?w=800&q=80',
    'الكيمياء': 'https://images.unsplash.com/photo-1532187863486-abf51ad982d7?w=800&q=80',
    'كيمياء': 'https://images.unsplash.com/photo-1532187863486-abf51ad982d7?w=800&q=80',
    'الرياضيات': 'https://images.unsplash.com/photo-1509228468518-180dd482180c?w=800&q=80',
    'رياضيات': 'https://images.unsplash.com/photo-1509228468518-180dd482180c?w=800&q=80',
    'الأحياء': 'https://images.unsplash.com/photo-1530026405186-ed1b0ca67b0b?w=800&q=80',
    'أحياء': 'https://images.unsplash.com/photo-1530026405186-ed1b0ca67b0b?w=800&q=80',
    'الجيولوجيا والعلوم البيئية': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
    'جيولوجيا': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
    'اللغة العربية': 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=800&q=80',
    'لغة عربية': 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=800&q=80',
    'اللغة الإنجليزية': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80',
    'لغة إنجليزية': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80',
    'الفلسفة والمنطق': 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80',
    'فلسفة': 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80',
    'علم النفس والاجتماع': 'https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?w=800&q=80',
    'علم نفس': 'https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?w=800&q=80',
  };

  const getYouTubeThumbnail = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|list=)([^#&?]*).*/;
    const match = url.match(regExp);
    let videoId = (match && match[2].length === 11) ? match[2] : null;
    
    if (!videoId && url.includes('list=')) {
        const urlObj = new URL(url);
        videoId = urlObj.searchParams.get('v');
    }
    
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
  };

  const isYoutube = (url: string) => url.includes('youtube.com') || url.includes('youtu.be');

  let displayImage = subjectFallbacks[course.subject] || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80';
  
  if (course.imageUrl && !isYoutube(course.imageUrl)) {
    displayImage = course.imageUrl;
  } else if (course.imageUrl && isYoutube(course.imageUrl)) {
    const thumb = getYouTubeThumbnail(course.imageUrl);
    if (thumb) displayImage = thumb;
  } else if (course.videoUrl) {
    const thumb = getYouTubeThumbnail(course.videoUrl);
    if (thumb) displayImage = thumb;
  } else if (course.thumbnailUrl) {
    displayImage = course.thumbnailUrl;
  }

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/courses/${course.id}`);
    }
  };

  const finalLessonsCount = actualLessonCount !== null ? actualLessonCount : (lessonsCount !== null ? lessonsCount : (course.lessonCount || 0));

  return (
    <div 
      onClick={handleCardClick}
      className="group bg-[var(--bg-glass-card)] backdrop-blur-md rounded-[2.5rem] overflow-hidden border border-[var(--border-glass-card)] shadow-[var(--shadow-glass-card)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.15)] hover:-translate-y-1 transition-all duration-500 flex flex-col h-full cursor-pointer relative transition-colors duration-300"
    >
      {/* Course Image & Badge */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={displayImage}
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
        
        {/* Lectures/Hours Badge */}
        <div className="absolute bottom-4 right-4 left-4 flex justify-between items-center">
            <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-lg">
               <span className="text-[10px] font-black text-white flex items-center gap-1">
                  <Play size={10} className="text-brand-blue fill-current animate-pulse" />
                  {finalLessonsCount} حصة
                </span>
                <div className="w-0.5 h-2 bg-white/20 rounded-full" />
                <span className="text-[10px] font-black text-white/80 flex items-center gap-1">
                   <Clock size={10} className="text-brand-blue" />
                   {course.duration && course.duration !== '---' 
                     ? course.duration 
                     : hasPdf && hasQuiz 
                       ? 'شرح + ملخصات + اختبارات' 
                       : hasPdf 
                         ? 'شرح + ملخصات PDF' 
                         : hasQuiz 
                           ? 'شرح + اختبارات' 
                           : 'شرح بالفيديو'}
                </span>
             </div>
             
             <div className="bg-brand-blue text-white p-2 rounded-xl shadow-lg ring-4 ring-brand-blue/10">
                <Star size={12} fill="white" />
             </div>
         </div>
       </div>
       
       <div className="p-6 sm:p-8 flex flex-col flex-1 space-y-4">
         {/* Title & Subject */}
         <div>
            <p className="text-brand-blue text-[10px] font-black uppercase tracking-widest mb-1">{course.subject}</p>
            <h3 className="text-lg font-Cairo font-black text-[var(--text-main)] line-clamp-2 leading-tight group-hover:text-brand-blue transition-colors duration-300">
              {course.title}
            </h3>
         </div>
 
         {/* Instructor & Rating Strip */}
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
               {course.teacherPhotoURL ? (
                <img src={course.teacherPhotoURL} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-white/10 shrink-0" loading="lazy" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-brand-blue/15 flex items-center justify-center ring-2 ring-white/10 shrink-0">
                  <span className="text-[10px] font-black text-brand-blue">{(course.teacherName || 'م')[0]}</span>
                </div>
              )}
              <span className="text-[11px] font-bold text-[var(--text-muted)] truncate transition-colors duration-300">{course.teacherName || 'مدرس المنصة'}</span>
            </div>
            {enrolledCount > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Users size={12} className="text-brand-yellow" />
                <span className="text-[10px] font-black text-[var(--text-muted)] transition-colors duration-300">{enrolledCount} طالب</span>
              </div>
            )}
         </div>
   
         {showProgress && course.progress !== undefined && (
            <div className="p-3 bg-[var(--bg-main)]/50 rounded-2xl border border-[var(--border-main)] transition-colors duration-300">
              <div className="flex justify-between items-center mb-2 text-[9px] font-black">
                <span className="text-[var(--text-muted)] transition-colors duration-300">تقدمك</span>
                <span className="text-brand-blue">{course.progress}%</span>
              </div>
              <ProgressBar progress={course.progress} className="h-1.5 rounded-full" />
            </div>
         )}
         
        {/* Footer: Price & CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-main)] transition-colors duration-300">
             <div className="flex flex-col">
                <p className="text-[9px] text-[var(--text-muted)] font-bold mb-0.5 transition-colors duration-300">سعر الاشتراك</p>
                <p className="text-lg font-black text-brand-blue tracking-tight">
                  {Number(course.price) === 0 ? 'مجاني' : `${Number(course.price).toLocaleString('ar-EG')} ج.م`}
                </p>
             </div>
             
             <button 
               onClick={(e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 if (isEnrolled || showProgress) {
                   navigate(`/courses/${course.id}/learn`);
                 } else {
                   navigate(`/courses/${course.id}`);
                 }
               }}
               className="px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all flex items-center gap-2 shadow-lg z-20 bg-brand-blue text-white shadow-brand-blue/20 hover:scale-105 active:scale-95"
             >
                {isEnrolled || showProgress ? 'دخول الحصة' : 'اشترك الآن'}
                <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
             </button>
        </div>
      </div>
    </div>
  );
});
