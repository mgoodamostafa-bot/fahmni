import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight, RefreshCcw, Award } from 'lucide-react';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface QuizProps {
  quiz: {
    id: string;
    title: string;
    questions: Question[];
  };
  onComplete?: (score: number) => void;
}

export const Quiz: React.FC<QuizProps> = ({ quiz, onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const handleAnswer = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
    setShowResult(true);
    if (index === quiz.questions[currentQuestion].correctAnswer) {
      setScore((prev) => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setIsFinished(true);
      if (onComplete) onComplete(score);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setIsFinished(false);
  };

  if (!quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
        <p className="text-gray-400 text-xl">لا توجد أسئلة متاحة</p>
        <button onClick={resetQuiz} className="btn-secondary px-8 py-3 flex items-center gap-2 mt-4">
          <RefreshCcw size={20} /> إعادة المحاولة
        </button>
      </div>
    );
  }

  if (isFinished) {
    const percentage = Math.round((score / quiz.questions.length) * 100);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full h-full flex flex-col items-center justify-center p-8 text-center"
      >
        <div className="w-24 h-24 bg-brand-yellow/20 text-brand-yellow rounded-full flex items-center justify-center mb-6">
          <Award size={48} />
        </div>
        <h2 className="text-4xl font-black text-white mb-2 font-display">نتيجة الاختبار</h2>
        <p className="text-gray-400 text-xl mb-8">
          لقد أجبت على {score} من أصل {quiz.questions.length} أسئلة بشكل صحيح.
        </p>

        <div className="w-full max-w-xs bg-white/5 rounded-full h-4 mb-8 overflow-hidden border border-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            className={`h-full ${percentage >= 50 ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
        </div>

        <div className="text-5xl font-black text-white mb-12">{percentage}%</div>

        <div className="flex gap-4">
          <button onClick={resetQuiz} className="btn-secondary px-8 py-3 flex items-center gap-2">
            <RefreshCcw size={20} /> إعادة المحاولة
          </button>
        </div>
      </motion.div>
    );
  }

  const question = quiz.questions[currentQuestion];

  return (
    <div className="w-full h-full flex flex-col p-8" dir="rtl">
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="text-gray-400 font-bold">
          السؤال {currentQuestion + 1} من {quiz.questions.length}
        </div>
        <div className="flex gap-1">
          {quiz.questions.map((_, i) => (
            <div
              key={i}
              className={`w-8 h-1.5 rounded-full transition-all ${
                i === currentQuestion
                  ? 'bg-brand-yellow w-12'
                  : i < currentQuestion
                    ? 'bg-emerald-500'
                    : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="flex-1 flex flex-col"
        >
          <h3 className="text-2xl md:text-3xl font-black text-white mb-10 leading-tight">
            {question.text}
          </h3>

          <div className="grid gap-4">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = index === question.correctAnswer;
              const showCorrect = showResult && isCorrect;
              const showWrong = showResult && isSelected && !isCorrect;

              return (
                <button
                  key={index}
                  disabled={showResult}
                  onClick={() => handleAnswer(index)}
                  className={`p-5 rounded-2xl text-right font-bold text-lg transition-all flex items-center justify-between border-2 ${
                    showCorrect
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : showWrong
                        ? 'bg-red-500/20 border-red-500 text-red-400'
                        : isSelected
                          ? 'bg-brand-blue/20 border-brand-blue text-brand-blue'
                          : 'bg-white/5 border-transparent text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <span>{option}</span>
                  {showCorrect && <CheckCircle2 size={24} />}
                  {showWrong && <XCircle size={24} />}
                </button>
              );
            })}
          </div>

          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-6 bg-white/5 rounded-2xl border border-white/10"
            >
              <div className="flex items-center gap-3 mb-2">
                {selectedAnswer === question.correctAnswer ? (
                  <span className="text-emerald-400 font-black flex items-center gap-2">
                    <CheckCircle2 size={20} /> أحسنت! إجابة صحيحة
                  </span>
                ) : (
                  <span className="text-red-400 font-black flex items-center gap-2">
                    <XCircle size={20} /> إجابة خاطئة
                  </span>
                )}
              </div>
              {question.explanation && (
                <p className="text-gray-400 text-sm leading-relaxed">{question.explanation}</p>
              )}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex justify-end">
        <button
          disabled={!showResult}
          onClick={nextQuestion}
          className="btn-primary px-10 py-4 flex items-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {currentQuestion === quiz.questions.length - 1 ? 'إنهاء الاختبار' : 'السؤال التالي'}
          <ArrowLeft size={20} />
        </button>
      </div>
    </div>
  );
};
