import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Users, GraduationCap, ArrowLeft, CheckCircle2, Rocket } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTenant } from '../contexts/TenantContext';

export const GradeSelection: React.FC = () => {
  const { user, profile, needsGradeSelection } = useAuth();
  const { settings } = useSettings();
  const { tenantData } = useTenant();
  const [step, setStep] = useState(1); // 1: Stage, 2: Grade
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && profile && !needsGradeSelection) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, profile, needsGradeSelection, navigate]);

  const stages = [
    {
      id: 'primary',
      name: 'المرحلة الابتدائية',
      icon: <BookOpen size={48} />,
      color: 'bg-blue-600',
    },
    { id: 'prep', name: 'المرحلة الإعدادية', icon: <Users size={48} />, color: 'bg-emerald-500' },
    {
      id: 'secondary',
      name: 'المرحلة الثانوية',
      icon: <GraduationCap size={48} />,
      color: 'bg-orange-500',
    },
    {
      id: 'general',
      name: 'كورسات ومهارات عامة',
      icon: <Rocket size={48} />,
      color: 'bg-purple-600',
    },
  ];

  const grades: Record<string, { id: string; name: string }[]> = {
    primary: [
      { id: '1', name: 'الصف الأول الابتدائي' },
      { id: '2', name: 'الصف الثاني الابتدائي' },
      { id: '3', name: 'الصف الثالث الابتدائي' },
      { id: '4', name: 'الصف الرابع الابتدائي' },
      { id: '5', name: 'الصف الخامس الابتدائي' },
      { id: '6', name: 'الصف السادس الابتدائي' },
    ],
    prep: [
      { id: '1', name: 'الصف الأول الإعدادي' },
      { id: '2', name: 'الصف الثاني الإعدادي' },
      { id: '3', name: 'الصف الثالث الإعدادي' },
    ],
    secondary: [
      { id: '1', name: 'الصف الأول الثانوي - علوم متكاملة' },
      { id: '2', name: 'الصف الثاني الثانوي' },
      { id: '3', name: 'الصف الثالث الثانوي' },
    ],
  };

  const handleGradeSelect = async (gradeId: string, bypassStage?: string) => {
    if (loading) return;
    setLoading(true);

    const finalStage = bypassStage || selectedStage;

    try {
      if (user) {
        // Update Firestore if user is logged in
        await updateDoc(doc(db, 'users', user.uid), {
          level: finalStage,
          grade: gradeId,
        });

        // Persist selection for the session/guest
        localStorage.setItem('selectedLevel', finalStage || '');
        localStorage.setItem('selectedGrade', gradeId);

        navigate('/dashboard', { replace: true });
      } else {
        // Redirect to register if guest
        localStorage.setItem('selectedLevel', finalStage || '');
        localStorage.setItem('selectedGrade', gradeId);
        navigate(`/register?level=${finalStage}&grade=${gradeId}`);
      }
    } catch (err) {
      console.error('Error updating grade:', err);
      setError('حدث خطأ أثناء حفظ اختيارك. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleStageSelect = (stageId: string) => {
    setSelectedStage(stageId);
    if (stageId === 'general') {
      handleGradeSelect('all', stageId);
    } else {
      setStep(2);
    }
  };

  return (
    <div
      className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] p-6 sm:p-12 flex flex-col items-center justify-center font-display"
      dir="rtl"
    >
      <div className="max-w-5xl w-full">
        <div className="mb-12 flex items-center justify-between">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 text-[var(--text-main)]/50 hover:text-[var(--text-main)] transition-colors font-black"
            >
              <ArrowLeft size={20} className="rotate-180" /> رجوع
            </button>
          )}
          <div className="text-2xl font-black text-brand-blue">
            {tenantData?.logo ? (
              <img
                src={tenantData.logo}
                alt={tenantData?.name}
                className="h-10 w-auto object-contain inline-block ml-3"
              />
            ) : null}
            {tenantData?.name || settings.siteName}
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-sm font-bold text-center flex items-center justify-between"
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 font-black px-2 cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="space-y-12"
            >
              <div className="text-center">
                <h1 className="text-4xl sm:text-6xl font-black mb-4">اختار مرحلتك الدراسية</h1>
                <p className="text-[var(--text-main)]/60 text-xl font-bold">
                  ابدأ رحلة النجاح مع أفضل المدرسين في مصر
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {stages.map((stage) => (
                  <motion.div
                    key={stage.id}
                    whileHover={{ scale: 1.05, y: -10 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleStageSelect(stage.id)}
                    className="glass-card p-10 cursor-pointer border-brand-blue/10 hover:border-brand-blue bg-white/5 flex flex-col items-center text-center space-y-6"
                  >
                    <div
                      className={`${stage.color} p-6 rounded-3xl shadow-2xl shadow-black/20 text-white`}
                    >
                      {stage.icon}
                    </div>
                    <h3 className="text-2xl font-black">{stage.name}</h3>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="space-y-12"
            >
              <div className="text-center">
                <h1 className="text-4xl sm:text-6xl font-black mb-4">في أي صف دراسي؟</h1>
                <p className="text-[var(--text-main)]/60 text-xl font-bold">
                  نجهز لك أفضل المحتوى التعليمي لعامك الدراسي
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {selectedStage &&
                  grades[selectedStage].map((grade) => (
                    <motion.div
                      key={grade.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleGradeSelect(grade.id)}
                      className="glass-card p-8 cursor-pointer border-white/10 hover:border-brand-blue bg-white/5 text-center group transition-all"
                    >
                      <div className="flex items-center justify-center gap-4">
                        <h3 className="text-xl font-black group-hover:text-brand-blue transition-colors">
                          {grade.name}
                        </h3>
                        <CheckCircle2
                          size={24}
                          className="opacity-0 group-hover:opacity-100 text-brand-blue transition-all"
                        />
                      </div>
                    </motion.div>
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
