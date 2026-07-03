import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, ShieldCheck, Zap, ChevronLeft, Sparkles, Lock, Eye, EyeOff, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { masterDb } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const MainLandingPage = () => {
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [correctPassword, setCorrectPassword] = useState('12345');
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<any>({
    heroTitle: 'منصتك التعليمية الخاصة',
    heroHighlight: 'بضغطة زر',
    heroSubtitle:
      'انضم إلى أقوى نظام لإدارة التعلم (SaaS). احصل على نطاقك الفرعي الخاص ولوحة تحكم معزولة للبدء في بيع دوراتك فوراً!',
    primaryButtonText: 'اشترك الآن واصنع منصتك',
    secondaryButtonText: 'تصفح الباقات',
    feature1Title: 'عزل تام للبيانات',
    feature1Desc: 'كل عميل يحصل على قاعدة بيانات معزولة وحماية تامة لمعلوماته.',
    feature2Title: 'إطلاق فوري',
    feature2Desc: 'بمجرد الاشتراك، يتم إنشاء المنصة وربط الدومين الفرعي تلقائياً.',
    feature3Title: 'لوحة تحكم متكاملة',
    feature3Desc: 'إدارة للطلاب، الكورسات، الامتحانات، والماليات في مكان واحد.',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(masterDb, 'super_admin', 'landing_page'));
        if (docSnap.exists()) {
          setSettings((prev: any) => ({ ...prev, ...docSnap.data() }));
        }
        // Fetch super admin password
        const passSnap = await getDoc(doc(masterDb, 'super_admin', 'config'));
        if (passSnap.exists() && passSnap.data().password) {
          setCorrectPassword(passSnap.data().password);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };
    fetchSettings();
  }, []);

  // Focus password input when modal opens
  useEffect(() => {
    if (showPasswordModal) {
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  }, [showPasswordModal]);

  const handlePasswordSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (password === correctPassword) {
      setShowPasswordModal(false);
      setPassword('');
      setPasswordError('');
      navigate('/owner-dashboard');
    } else {
      setPasswordError('كلمة المرور غير صحيحة!');
      setPassword('');
      setTimeout(() => passwordInputRef.current?.focus(), 50);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#0a0f1e] text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden"
      dir="rtl"
    >
      {/* Background Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-blue/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="max-w-4xl space-y-8 relative z-10 w-full"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          onDoubleClick={() => {
            setShowPasswordModal(true);
            setPassword('');
            setPasswordError('');
          }}
          className="w-24 h-24 bg-gradient-to-br from-brand-blue/20 to-brand-blue/5 border border-brand-blue/20 rounded-full flex items-center justify-center mx-auto mb-8 text-brand-blue cursor-pointer hover:scale-110 hover:shadow-[0_0_30px_rgba(37,99,235,0.3)] transition-all duration-300"
          title="لوحة الإدارة"
        >
          <GraduationCap size={44} strokeWidth={1.5} />
        </motion.div>

        <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight tracking-tight">
          {settings.heroTitle} <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-l from-brand-blue via-blue-400 to-emerald-400 inline-block mt-2 relative">
            {settings.heroHighlight}
            <Sparkles
              className="absolute -top-6 -right-8 text-yellow-400 animate-pulse"
              size={24}
            />
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-light">
          {settings.heroSubtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
          <button
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-brand-blue to-blue-600 text-white rounded-2xl font-bold text-lg hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group cursor-pointer"
          >
            {settings.primaryButtonText}
            <ChevronLeft className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => navigate('/courses')}
            className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold text-lg hover:bg-white/10 hover:scale-105 transition-all cursor-pointer"
          >
            {settings.secondaryButtonText}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-right"
        >
          <div className="p-8 bg-white/[0.02] border border-white/10 rounded-3xl backdrop-blur-sm hover:bg-white/[0.04] hover:-translate-y-2 transition-all duration-300 group">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck className="text-emerald-400" size={28} strokeWidth={2} />
            </div>
            <h3 className="font-bold text-xl mb-3 text-white">{settings.feature1Title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{settings.feature1Desc}</p>
          </div>

          <div className="p-8 bg-white/[0.02] border border-white/10 rounded-3xl backdrop-blur-sm hover:bg-white/[0.04] hover:-translate-y-2 transition-all duration-300 group">
            <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Zap className="text-yellow-400" size={28} strokeWidth={2} />
            </div>
            <h3 className="font-bold text-xl mb-3 text-white">{settings.feature2Title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{settings.feature2Desc}</p>
          </div>

          <div className="p-8 bg-white/[0.02] border border-white/10 rounded-3xl backdrop-blur-sm hover:bg-white/[0.04] hover:-translate-y-2 transition-all duration-300 group">
            <div className="w-14 h-14 bg-brand-blue/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <GraduationCap className="text-brand-blue" size={28} strokeWidth={2} />
            </div>
            <h3 className="font-bold text-xl mb-3 text-white">{settings.feature3Title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{settings.feature3Desc}</p>
          </div>
        </motion.div>
      </motion.div>

      {/* ═══ Password Modal ═══ */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasswordModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm bg-[#0c1225] border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-brand-blue/10"
            >
              {/* Header glow */}
              <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-brand-blue/10 to-transparent pointer-events-none" />

              <div className="relative p-8 text-center">
                {/* Close button */}
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="absolute top-4 left-4 p-1.5 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X size={16} />
                </button>

                {/* Lock icon */}
                <div className="w-16 h-16 bg-gradient-to-br from-brand-blue/20 to-purple-500/20 border border-brand-blue/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <Lock size={28} className="text-brand-blue" />
                </div>

                <h3 className="text-lg font-black text-white mb-1">لوحة التحكم المركزي</h3>
                <p className="text-xs text-gray-400 mb-6">أدخل كلمة المرور للوصول إلى Super Admin</p>

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="relative">
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError('');
                      }}
                      placeholder="كلمة المرور"
                      className={`w-full bg-black/40 border ${passwordError ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3.5 text-white text-center text-lg tracking-[0.3em] focus:border-brand-blue focus:outline-none transition-colors placeholder:tracking-normal placeholder:text-sm`}
                      dir="ltr"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {passwordError && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-xs font-bold"
                    >
                      {passwordError}
                    </motion.p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-brand-blue to-blue-600 text-white rounded-xl font-black text-base hover:shadow-lg hover:shadow-brand-blue/25 active:scale-[0.98] transition-all"
                  >
                    دخول
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
