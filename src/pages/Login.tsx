import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, BookOpen, Facebook, Youtube, ShieldAlert, Award, ArrowLeft, Send, Sparkles } from 'lucide-react';
import { getTenantAuth } from '../lib/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useSettings } from '../contexts/SettingsContext';

export const Login: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { tenantData } = useTenant();
  const { settings } = useSettings();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGhostAccount, setIsGhostAccount] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const navigate = useNavigate();

  // Fallback defaults
  const siteName = tenantData?.name || settings.siteName || 'أحمد عبد المنعم';
  const logoUrl = tenantData?.logo || settings.logoUrl || '';
  const facebook = tenantData?.facebook || settings.facebook || '';
  const youtube = tenantData?.youtube || settings.youtube || '';
  const telegram = tenantData?.telegram || settings.telegram || '';
  const tiktok = tenantData?.tiktok || settings.tiktok || '';

  const handleForgotPassword = async () => {
    if (!email) {
      setError('الرجاء كتابة البريد الإلكتروني أولاً في الحقل المخصص.');
      setResetSuccess('');
      return;
    }
    setError('');
    setResetSuccess('');
    try {
      await sendPasswordResetEmail(getTenantAuth(), email);
      setResetSuccess('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.');
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('لا يوجد حساب مسجل بهذا البريد الإلكتروني.');
      } else if (err.code === 'auth/invalid-email') {
        setError('البريد الإلكتروني غير صالح.');
      } else {
        setError(err.message || 'حدث خطأ أثناء محاولة إرسال البريد الإلكتروني.');
      }
    }
  };

  useEffect(() => {
    if (user && profile && !authLoading) {
      navigate('/', { replace: true });
    }

    // Check if account was deleted (Ghost Account)
    if (user && !profile && !authLoading) {
      setIsGhostAccount(true);
      setError('البريد الإلكتروني غير مسجل بالمنصة.');
    }

    const pendingError = sessionStorage.getItem('auth_error');
    if (pendingError) {
      setError(pendingError);
      sessionStorage.removeItem('auth_error');
    }
  }, [user, profile, authLoading, navigate]);

  const handleStartFresh = async () => {
    if (!getTenantAuth().currentUser) return;
    setLoading(true);
    try {
      const { deleteUser, signOut } = await import('firebase/auth');
      await deleteUser(getTenantAuth().currentUser!);
      await signOut(getTenantAuth());
      navigate('/register', { replace: true });
    } catch (err: any) {
      console.error('Fresh start failed:', err);
      const { signOut } = await import('firebase/auth');
      await signOut(getTenantAuth());
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setIsGhostAccount(false);
    try {
      const userCredential = await signInWithEmailAndPassword(getTenantAuth(), email, password);
      
      // Verify that user profile exists in Firestore
      const { doc, getDoc } = await import('firebase/firestore');
      const { getTenantDb } = await import('../lib/firebase');
      const docRef = doc(getTenantDb(), 'users', userCredential.user.uid);
      const s = await getDoc(docRef);
      if (!s.exists()) {
        const { signOut } = await import('firebase/auth');
        await signOut(getTenantAuth());
        setError('البريد الإلكتروني غير مسجل بالمنصة.');
      }
    } catch (err: any) {
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('فشل تسجيل الدخول. البريد الإلكتروني غير مسجل أو كلمة المرور خاطئة.');
      } else {
        setError('فشل تسجيل الدخول. تأكد من البريد الإلكتروني وكلمة المرور.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060814] text-white flex flex-col overflow-x-hidden font-display relative selection:bg-brand-500/30" dir="rtl">
      
      {/* ═══════════════════ Background Ambient Orbs ═══════════════════ */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 30, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-40 -right-40 w-96 h-96 bg-brand-500/15 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{
            scale: [1, 1.15, 1],
            x: [0, -40, 0],
            y: [0, 40, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/2 left-[-200px] w-96 h-96 bg-purple-500/10 rounded-full blur-[150px]" 
        />
        <div className="absolute bottom-[-100px] right-10 w-80 h-80 bg-brand-blue/10 rounded-full blur-[100px]" />
      </div>

      {/* ═══════════════════ Header Navbar ═══════════════════ */}
      <nav className="h-20 border-b border-white/5 bg-[#060814]/80 backdrop-blur-md flex items-center z-50 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex justify-between items-center">
          
          {/* Logo with high-visibility backing */}
          <Link to="/" className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="w-full h-full object-cover rounded-full" />
              ) : (
                <div className="bg-brand-blue p-2.5 rounded-full shadow-lg shadow-brand-500/20">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
            <div className="flex flex-col text-right">
              <span className="text-sm sm:text-base font-black tracking-tight text-white uppercase leading-tight">
                {tenantData?.teacherName || settings.teacherName || settings.displayName || settings.siteName || 'AHMED ABD-ELMONEM'}
              </span>
              <span className="text-[10px] text-brand-500 font-extrabold tracking-widest leading-none uppercase mt-0.5">
                {tenantData?.subject || settings.subject || 'TEACHER'}
              </span>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-black text-white hover:text-brand-500 transition-colors">
              تسجيل الدخول
            </Link>
            <button
              onClick={() => navigate('/register')}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs sm:text-sm font-black rounded-xl transition-all shadow-lg shadow-brand-500/15 hover:shadow-brand-500/30 active:scale-95 cursor-pointer"
            >
              إنشاء حساب
            </button>
          </div>
        </div>
      </nav>

      {/* ═══════════════════ Main Form Body ═══════════════════ */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Column: Stunning SaaS style educational features */}
        <div className="lg:col-span-5 hidden lg:flex flex-col space-y-8 pr-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 px-4 py-1.5 rounded-full text-brand-500 text-xs font-bold">
              <Sparkles size={14} className="animate-pulse" />
              بوابتك للتفوق الأكاديمي
            </div>
            <h2 className="text-4xl font-black leading-tight text-white">
              تعلم بذكاء، تفوق بتميز مع أقوى منصة تعليمية
            </h2>
            <p className="text-slate-400 text-sm font-semibold leading-relaxed">
              نوفر لك تجربة تعليمية فريدة مصممة خصيصاً لمساعدتك على استيعاب المناهج بأسهل الطرق والوصول للدرجات النهائية.
            </p>
          </div>

          {/* Feature Badges list */}
          <div className="flex flex-col gap-4">
            {[
              {
                icon: "🎬",
                title: "شروحات تفاعلية مميزة",
                desc: "شاهد المحاضرات والدروس مسجلة بأعلى جودة وإمكانيات عرض متطورة.",
                color: "from-brand-500/10 to-brand-500/5",
                borderColor: "border-brand-500/20"
              },
              {
                icon: "📝",
                title: "امتحانات وتدريبات ذكية",
                desc: "امتحانات تفاعلية فورية لتقييم مستواك وتحديد نقاط القوة والضعف.",
                color: "from-purple-500/10 to-purple-500/5",
                borderColor: "border-purple-500/20"
              },
              {
                icon: "📈",
                title: "متابعة دورية مستمرة",
                desc: "تقارير أداء دورية لك ولولي الأمر لمتابعة تقدمك يوماً بيوم.",
                color: "from-emerald-500/10 to-emerald-500/5",
                borderColor: "border-emerald-500/20"
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.5 }}
                className={`flex gap-4 p-5 bg-gradient-to-r ${feature.color} border ${feature.borderColor} rounded-2xl shadow-sm hover:translate-x-2 transition-transform duration-300`}
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-[#060814] flex items-center justify-center text-2xl border border-white/5 shadow-inner">
                  {feature.icon}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-white">{feature.title}</h4>
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Column: Premium Glassmorphic Login Form */}
        <div className="lg:col-span-7 flex justify-center w-full">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-xl bg-[#0f1224]/50 backdrop-blur-2xl border border-white/10 p-8 sm:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
          >
            {/* Glowing inner accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl" />

            {/* Central Form Logo & Title */}
            <div className="flex flex-col items-center text-center mb-8 relative z-10">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="h-20 w-20 shrink-0 flex items-center justify-center overflow-hidden mb-4"
              >
                {logoUrl ? (
                  <img src={logoUrl} alt={siteName} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="bg-brand-blue p-5 rounded-full shadow-xl shadow-brand-500/20">
                    <BookOpen className="w-10 h-10 text-white" />
                  </div>
                )}
              </motion.div>
              <h3 className="text-2xl font-black text-white">تسجيل الدخول</h3>
              <p className="text-slate-400 text-xs font-bold mt-1.5">أهلاً بك مجدداً! سجل الدخول لمتابعة دروسك</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-6 relative z-10">
              
              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs font-bold text-right space-y-3"
                >
                  <p>{error}</p>
                  {isGhostAccount && (
                    <button
                      type="button"
                      onClick={handleStartFresh}
                      className="w-full bg-red-600 text-white py-2.5 rounded-xl hover:bg-red-700 transition-all font-black text-xs cursor-pointer shadow-lg shadow-red-600/15"
                    >
                      بدء حياة تعليمية جديدة (إنشاء حساب جديد)
                    </button>
                  )}
                </motion.div>
              )}

              {resetSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-xs font-bold text-right"
                >
                  {resetSuccess}
                </motion.div>
              )}

              {/* Form Fields */}
              <div className="space-y-5">
                
                {/* Email */}
                <div className="space-y-2 text-right">
                  <label className="text-xs sm:text-sm font-black text-slate-300 mr-1">البريد الإلكتروني</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-5 py-4 bg-slate-950/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-bold transition-all focus:bg-slate-950/80"
                      dir="ltr"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <Mail size={18} />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2 text-right">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs sm:text-sm font-black text-slate-300">كلمة السر</label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs text-brand-500 font-bold hover:underline cursor-pointer transition-colors"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="*********"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-5 py-4 bg-slate-950/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-bold transition-all focus:bg-slate-950/80"
                      dir="ltr"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <Lock size={18} />
                    </div>
                  </div>
                </div>

              </div>

              {/* Actions */}
              <div className="space-y-5 pt-4 text-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-brand-blue hover:opacity-95 text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-brand-blue/20 hover:shadow-brand-blue/30 active:scale-95 duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span>جاري تسجيل الدخول...</span>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </>
                  ) : (
                    <>
                      <span>تسجيل الدخول</span>
                      <LogIn size={18} />
                    </>
                  )}
                </button>

                <p className="text-sm font-bold text-slate-400">
                  ليس لديك حساب؟{' '}
                  <Link to="/register" className="text-brand-500 hover:text-brand-600 font-black transition-colors">
                    انضم إلينا الآن !
                  </Link>
                </p>

                <div className="pt-4 border-t border-white/5 text-center">
                  <p className="text-xs font-bold text-slate-500">
                    هل أنت ولي أمر؟{' '}
                    <Link to="/parent" className="text-brand-blue hover:underline font-black transition-colors">
                      تابع مستوى وتحصيل ابنك من هنا
                    </Link>
                  </p>
                </div>
              </div>

            </form>
          </motion.div>
        </div>

      </div>

      {/* ═══════════════════ Footer ═══════════════════ */}
      <footer className="bg-[#03050f] text-white py-12 px-6 border-t border-white/5 mt-auto relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-6 text-center">
          
          {/* Social icons */}
          <div className="flex gap-4">
            {tiktok && (
              <a href={tiktok} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center transition-all hover:scale-105">
                <span className="text-white text-sm">🎵</span>
              </a>
            )}
            {youtube && (
              <a href={youtube} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center transition-all hover:scale-105">
                <Youtube size={18} className="text-white" />
              </a>
            )}
            {facebook && (
              <a href={facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center transition-all hover:scale-105">
                <Facebook size={18} className="text-white" />
              </a>
            )}
            {telegram && (
              <a href={telegram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center transition-all hover:scale-105">
                <Send size={18} className="text-white" />
              </a>
            )}
          </div>

          <p className="text-sm font-bold text-white/40">
            © {new Date().getFullYear()} {siteName} • جميع الحقوق محفوظة
          </p>

        </div>
      </footer>

    </div>
  );
};
