import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { submitExamSchema, SubmitExamPayload } from '../lib/validations';
import { Clock, CheckCircle2, AlertCircle, Loader2, Send, ChevronLeft, ChevronRight, Hash } from 'lucide-react';
import clsx from 'clsx';

export interface Question {
  id: string;
  text: string;
  options: string[];
}

export interface ExamSheetProps {
  examId: string;
  userId: string;
  title: string;
  questions: Question[];
  durationMinutes: number;
  onComplete: (data: SubmitExamPayload) => Promise<void>;
}

export const ExamSheet: React.FC<ExamSheetProps> = ({
  examId,
  userId,
  title,
  questions,
  durationMinutes,
  onComplete
}) => {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [hasStarted] = useState(Date.now());
  const [currentQ, setCurrentQ] = useState(0);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isSubmitted }
  } = useForm<SubmitExamPayload>({
    resolver: zodResolver(submitExamSchema),
    defaultValues: {
      examId,
      userId,
      timeTaken: 0,
      answers: questions.map(q => ({
        questionId: q.id,
        selectedIndex: -1
      }))
    }
  });

  const currentAnswers = watch('answers') || [];
  const answeredCount = currentAnswers.filter(a => a.selectedIndex >= 0).length;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  const unansweredIndexes = currentAnswers
    .map((ans, idx) => (ans.selectedIndex < 0 ? idx + 1 : -1))
    .filter(idx => idx !== -1);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit(onSubmit)();
      return;
    }
    const timerId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, handleSubmit]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const onSubmit = async (data: SubmitExamPayload) => {
    const timeTaken = Math.floor((Date.now() - hasStarted) / 1000);
    try {
      await onComplete({ ...data, timeTaken });
    } catch (error) {
      console.error('Submission failed', error);
    }
  };

  const scrollToQuestion = (idx: number) => {
    setCurrentQ(idx);
    questionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const goNext = () => { if (currentQ < questions.length - 1) scrollToQuestion(currentQ + 1); };
  const goPrev = () => { if (currentQ > 0) scrollToQuestion(currentQ - 1); };

  // Timer urgency
  const timerUrgent = timeLeft < 60;
  const timerWarning = timeLeft < 300 && !timerUrgent;

  // Timer ring progress
  const totalTime = durationMinutes * 60;
  const timerPercent = (timeLeft / totalTime) * 100;
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - (timerPercent / 100) * circumference;

  return (
    <div className="min-h-screen pb-32" dir="rtl" style={{ background: 'var(--bg-main, #050a18)' }}>

      {/* ─── STICKY HEADER ─── */}
      <div className="sticky top-0 z-50 backdrop-blur-2xl border-b border-white/5" style={{ background: 'rgba(5,10,24,0.85)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">

            {/* Title + Progress */}
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-black text-white truncate">{title}</h1>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs font-bold text-gray-400 whitespace-nowrap">
                  {answeredCount} / {questions.length}
                </span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[200px]">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${progressPercent}%`,
                      background: progressPercent === 100
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Timer with ring */}
            <div className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded-2xl border font-black text-sm sm:text-base tabular-nums tracking-tight transition-all duration-500 shrink-0",
              timerUrgent && "border-red-500/40 bg-red-500/10 text-red-400 animate-pulse",
              timerWarning && "border-amber-500/30 bg-amber-500/10 text-amber-400",
              !timerUrgent && !timerWarning && "border-white/10 bg-white/5 text-white/80"
            )}>
              <svg width="28" height="28" viewBox="0 0 40 40" className="shrink-0 -rotate-90">
                <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.15" />
                <circle
                  cx="20" cy="20" r="18" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── QUESTION MAP (scrollable pills) ─── */}
      <div className="sticky top-[72px] sm:top-[76px] z-40 backdrop-blur-xl border-b border-white/5" style={{ background: 'rgba(5,10,24,0.7)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {questions.map((_, idx) => {
              const isAnswered = currentAnswers[idx]?.selectedIndex >= 0;
              const isCurrent = currentQ === idx;
              const isErrored = isSubmitted && !isAnswered;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => scrollToQuestion(idx)}
                  className={clsx(
                    "shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 border",
                    isCurrent && "scale-110 shadow-lg shadow-blue-500/20",
                    isErrored
                      ? "border-red-500/50 bg-red-500/20 text-red-400"
                      : isAnswered
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                        : isCurrent
                          ? "border-blue-500/50 bg-blue-500/20 text-blue-400"
                          : "border-white/5 bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300"
                  )}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── QUESTIONS ─── */}
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-5">

        {questions.map((question, qIndex) => {
          const isError = isSubmitted && currentAnswers[qIndex]?.selectedIndex < 0;
          const isActive = currentQ === qIndex;

          return (
            <div
              key={question.id}
              ref={el => { questionRefs.current[qIndex] = el; }}
              onClick={() => setCurrentQ(qIndex)}
              className={clsx(
                "rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-7 border transition-all duration-500",
                isError
                  ? "border-red-500/40 bg-red-500/5 ring-1 ring-red-500/20"
                  : isActive
                    ? "border-blue-500/20 bg-white/[0.04] shadow-xl shadow-blue-500/5"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
              )}
            >
              {/* Question header */}
              <div className="flex items-start gap-3 sm:gap-4 mb-5 sm:mb-6">
                <span className={clsx(
                  "flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-sm font-black shrink-0 transition-colors",
                  currentAnswers[qIndex]?.selectedIndex >= 0
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                    : isActive
                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                      : "bg-white/5 text-gray-500 border border-white/5"
                )}>
                  {qIndex + 1}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white/90 leading-relaxed pt-1.5 flex-1">
                  {question.text}
                </h3>
              </div>

              {/* Options */}
              <div className="space-y-2.5 sm:space-y-3 sm:pr-14 pr-0">
                <Controller
                  name={`answers.${qIndex}.selectedIndex`}
                  control={control}
                  render={({ field }) => (
                    <>
                      {question.options.map((opt, optIndex) => {
                        const isSelected = field.value === optIndex;
                        const letter = String.fromCharCode(65 + optIndex);

                        return (
                          <label
                            key={optIndex}
                            className={clsx(
                              "group relative flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border cursor-pointer transition-all duration-300 select-none",
                              isSelected
                                ? "border-blue-500/40 bg-blue-500/10 shadow-lg shadow-blue-500/5"
                                : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
                            )}
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              checked={isSelected}
                              onChange={() => {
                                field.onChange(optIndex);
                                // Auto-advance to next question
                                if (qIndex < questions.length - 1) {
                                  setTimeout(() => scrollToQuestion(qIndex + 1), 400);
                                }
                              }}
                            />

                            {/* Letter badge */}
                            <div className={clsx(
                              "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-xs sm:text-sm font-black border transition-all duration-300 shrink-0",
                              isSelected
                                ? "bg-blue-500 border-blue-400 text-white shadow-md shadow-blue-500/30 scale-110"
                                : "bg-white/5 border-white/10 text-gray-400 group-hover:border-white/20 group-hover:text-gray-300"
                            )}>
                              {letter}
                            </div>

                            {/* Option text */}
                            <span className={clsx(
                              "text-sm sm:text-base flex-1 transition-colors duration-300 leading-relaxed",
                              isSelected ? "text-white font-bold" : "text-gray-300 group-hover:text-white/80"
                            )}>
                              {opt}
                            </span>

                            {/* Checkmark */}
                            <div className={clsx(
                              "transition-all duration-300 shrink-0",
                              isSelected ? "opacity-100 scale-100" : "opacity-0 scale-50"
                            )}>
                              <CheckCircle2 className="w-5 h-5 text-blue-400" />
                            </div>
                          </label>
                        );
                      })}
                    </>
                  )}
                />
              </div>
            </div>
          );
        })}

        {/* ─── VALIDATION ALERT ─── */}
        {isSubmitted && unansweredIndexes.length > 0 && (
          <div className="rounded-2xl p-5 border border-red-500/20 bg-red-500/5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-black text-red-400">لا يمكن التسليم بعد</h4>
              <p className="text-sm text-red-400/70 mt-1 font-bold">
                يرجى الإجابة على الأسئلة التالية:{' '}
                <span className="text-red-400 font-black">{unansweredIndexes.join('، ')}</span>
              </p>
            </div>
          </div>
        )}

        {/* ─── NAVIGATION + SUBMIT FOOTER ─── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-2xl border-t border-white/5" style={{ background: 'rgba(5,10,24,0.9)' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">

            {/* Next (appears on right in RTL) */}
            <button
              type="button"
              onClick={goPrev}
              disabled={currentQ <= 0}
              className={clsx(
                "flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm font-black transition-all",
                currentQ <= 0
                  ? "opacity-30 cursor-not-allowed text-gray-500"
                  : "text-white/70 hover:text-white hover:bg-white/10 border border-white/5"
              )}
            >
              <ChevronRight className="w-4 h-4" />
              <span className="hidden sm:inline">السابق</span>
            </button>

            {/* Question counter */}
            <span className="text-xs sm:text-sm font-black text-gray-400 tabular-nums">
              {currentQ + 1} / {questions.length}
            </span>

            {/* Submit or Next */}
            {currentQ === questions.length - 1 || answeredCount === questions.length ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className={clsx(
                  "flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm font-black transition-all",
                  isSubmitting
                    ? "bg-blue-500/30 text-blue-300 cursor-not-allowed"
                    : "bg-gradient-to-l from-blue-600 to-blue-500 text-white hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-100"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري التسليم...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    تسليم الاختبار
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm font-black text-white/70 hover:text-white hover:bg-white/10 border border-white/5 transition-all"
              >
                <span className="hidden sm:inline">التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </form>
    </div>
  );
};
