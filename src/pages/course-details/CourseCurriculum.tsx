import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen, Play, Clock, Lock, Eye, ChevronDown
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────
interface CourseCurriculumProps {
  courseId: string;
  lessons: any[];
  isEnrolled: boolean;
}

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4 }
};

export const CourseCurriculum: React.FC<CourseCurriculumProps> = ({
  courseId, lessons, isEnrolled
}) => {
  const navigate = useNavigate();

  // Group lessons by unit
  const groupedLessons = useMemo(() => {
    return lessons.reduce((acc: Record<string, any[]>, lesson: any) => {
      const unitName = lesson.unitTitle || lesson.unit || 'دروس الكورس';
      if (!acc[unitName]) acc[unitName] = [];
      acc[unitName].push(lesson);
      return acc;
    }, {});
  }, [lessons]);

  return (
    <motion.section {...fadeIn} className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-3 text-white">
          <div className="w-1.5 h-8 bg-brand-yellow rounded-full" />
          المنهج الدراسي
        </h2>
        <span className="bg-white/5 text-brand-blue border border-brand-blue/15 px-4 py-2 rounded-xl text-xs font-black">
          {lessons.length} حصة تعليمية
        </span>
      </div>

      <div className="space-y-3">
        {Object.keys(groupedLessons).length > 0 ? (
          Object.entries(groupedLessons).map(([unitName, unitLessons], unitIdx) => (
            <details key={unitName} open={isEnrolled || unitIdx === 0}
              className="group bg-white/[0.02] rounded-2xl border border-white/5 overflow-hidden transition-all hover:border-white/10">
              <summary className="cursor-pointer p-5 sm:p-6 font-black text-lg flex items-center justify-between list-none hover:bg-white/[0.03] transition-colors select-none text-white">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-brand-blue rounded-full" />
                  <span>{unitName}</span>
                  <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-2.5 py-1 rounded-md border border-white/5 hidden sm:inline-block">
                    {(unitLessons as any[]).length} حصص
                  </span>
                </div>
                <ChevronDown className="group-open:rotate-180 transition-transform duration-300 text-brand-blue bg-brand-blue/10 p-1 rounded-lg" size={28} />
              </summary>
              <div className="p-3 sm:p-5 space-y-2 bg-[#060a16]/60 border-t border-white/5">
                {(unitLessons as any[]).map((lesson: any, idx: number) => {
                  const isAccessible = isEnrolled || lesson.isFreePreview;
                  return (
                    <div key={lesson.id} onClick={() => isAccessible && navigate(`/courses/${courseId}/learn/${lesson.id}`)}
                      className={`flex items-center justify-between p-4 rounded-xl transition-all border border-transparent gap-3
                        ${isAccessible
                          ? 'bg-white/[0.03] hover:border-brand-blue/20 cursor-pointer hover:bg-white/[0.05] text-white'
                          : 'bg-gray-900/30 opacity-60 border-dashed border-white/5 cursor-not-allowed text-gray-500'
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0
                          ${isAccessible ? 'bg-brand-blue/10 text-brand-blue' : 'bg-white/5 text-gray-600'}`}>
                          {String(idx + 1).padStart(2, '0')}
                        </div>
                        <div>
                          <h4 className={`font-black text-base sm:text-lg ${isAccessible ? 'text-white' : 'text-gray-500'}`}>
                            {lesson.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 mt-0.5">
                            {lesson.isFreePreview && !isEnrolled && (
                              <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-500/15">
                                <Eye size={10} /> مجاني
                              </span>
                            )}
                            <span className="flex items-center gap-1"><Clock size={11} /> {lesson.duration || (lesson.videoUrl ? 'فيديو' : 'حصة')}</span>
                            {lesson.pdfUrl && <span className="text-brand-blue bg-brand-blue/10 px-1.5 py-0.5 rounded-md text-[9px]">PDF</span>}
                            {(lesson.quizUrl || lesson.examId) && <span className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md text-[9px]">اختبار</span>}
                          </div>
                        </div>
                      </div>
                      {isAccessible ? (
                        <div className="bg-brand-blue/10 p-2.5 rounded-xl text-brand-blue shrink-0"><Play size={16} className="fill-current" /></div>
                      ) : (
                        <div className="bg-white/5 p-2.5 rounded-xl text-gray-600 shrink-0 border border-white/5"><Lock size={16} /></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          ))
        ) : (
          <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
            <BookOpen size={40} className="mx-auto text-gray-700 mb-3 opacity-40" />
            <p className="text-gray-500 font-bold text-sm">لم يتم رفع دروس لهذا الكورس بعد</p>
          </div>
        )}
      </div>
    </motion.section>
  );
};
