import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StudentHome } from '../components/student/StudentHome';

export const Home: React.FC = () => {
  const { user, profile, loading, authError, authLogs } = useAuth();
  const [waitingTooLong, setWaitingTooLong] = useState(false);

  // If profile doesn't arrive after 10s, show a quiet retry option (not a scary error)
  useEffect(() => {
    if (!loading && user && !profile) {
      const timer = setTimeout(() => setWaitingTooLong(true), 10000);
      return () => clearTimeout(timer);
    }
    // Reset if profile arrives
    setWaitingTooLong(false);
  }, [loading, user, profile]);

  // 1. Still loading auth → clean spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-brand-blue" size={40} />
          <p className="text-white/30 text-sm font-bold">جاري تسجيل الدخول...</p>
        </div>
      </div>
    );
  }

  // 2. No user → go to welcome
  if (!user) {
    return <Navigate to="/welcome" replace />;
  }

  // 3. Profile loaded → redirect based on role
  if (profile) {
    const role = profile.role?.toLowerCase();
    if (role === 'admin') return <Navigate to="/teacher" replace />;
    if (role === 'teacher') return <Navigate to="/teacher" replace />;

    // If Student has grade, show StudentHome, otherwise direct to selection
    if (role === 'student') {
      if (profile.grade) {
        return <StudentHome />;
      }
      return <Navigate to="/grade-selection" replace />;
    }
  }

  // 4. User exists but profile not yet loaded → show a clean spinner
  //    (NOT a scary error — profile is on its way!)
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a] p-6" dir="rtl">
      <div className="flex flex-col items-center gap-6 text-center w-full max-w-lg">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 bg-brand-blue/20 blur-2xl rounded-full animate-pulse" />
          <Loader2 className="relative w-full h-full animate-spin text-brand-blue" />
        </div>
        <p className="text-white/40 font-bold animate-pulse">جاري تحميل بياناتك...</p>

        {waitingTooLong && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-4 w-full"
          >
            <p className="text-white/30 text-xs">الاتصال بطيء، جرب إعادة التحميل</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-bold text-sm transition-all"
            >
              إعادة تحميل
            </button>
          </motion.div>
        )}

        {authError && <p className="text-red-400/60 text-xs font-mono mt-2">{authError}</p>}
      </div>
    </div>
  );
};
