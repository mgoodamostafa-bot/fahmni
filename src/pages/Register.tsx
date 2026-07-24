import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Facebook, Youtube, ShieldAlert, Award, User, Phone, Book, Mail, Lock, Sparkles, Send } from 'lucide-react';
import { getTenantAuth, getTenantDb } from '../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useSettings } from '../contexts/SettingsContext';

export const Register: React.FC = () => {
  const { loading: authLoading } = useAuth();
  const { tenantData } = useTenant();
  const { settings } = useSettings();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Name field
  const [name, setName] = useState('');

  // Phone numbers
  const [studentPhone, setStudentPhone] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');

  // Other info
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState(searchParams.get('grade') || localStorage.getItem('selectedGrade') || '');

  // Auth fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fallback defaults
  const siteName = tenantData?.name || settings.siteName || 'أحمد عبد المنعم';
  const logoUrl = tenantData?.logo || settings.logoUrl || '';
  const facebook = tenantData?.facebook || settings.facebook || '';
  const youtube = tenantData?.youtube || settings.youtube || '';
  const telegram = tenantData?.telegram || settings.telegram || '';
  const tiktok = tenantData?.tiktok || settings.tiktok || '';

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validations
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      setLoading(false);
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (password.length < 6) {
      setError('يجب أن تكون كلمة المرور مكونة من 6 أحرف على الأقل.');
      setLoading(false);
      return;
    }
    if (!hasLetter || !hasNumber) {
      setError('يجب أن تحتوي كلمة المرور على حروف وأرقام معاً (ليست أرقاماً فقط).');
      setLoading(false);
      return;
    }

    if (!name || name.trim().split(/\s+/).length < 2) {
      setError('الرجاء إدخال الاسم بالكامل (ثلاثي أو رباعي على الأقل).');
      setLoading(false);
      return;
    }

    // Get stage/level reliably from the selected grade
    let stage = 'secondary';
    if (grade.includes('-pri')) {
      stage = 'primary';
    } else if (grade.includes('-prep')) {
      stage = 'prep';
    } else if (grade === 'beg' || grade === 'int' || grade === 'adv') {
      stage = 'general';
    } else {
      stage = 'secondary';
    }

    // Notify AuthContext that a registration is in progress
    sessionStorage.setItem('is_registering', 'true');

    try {
      const result = await createUserWithEmailAndPassword(getTenantAuth(), email, password);

      // Update Auth Profile immediately
      await updateProfile(result.user, { displayName: name.trim() });

      // 🆔 Reliable Sequential ID Generation (12610 + Transaction Counter)
      let newStudentId = '';
      try {
        newStudentId = await runTransaction(getTenantDb(), async (transaction) => {
          const counterRef = doc(getTenantDb(), 'system', 'counters');
          const counterSnap = await transaction.get(counterRef);

          let lastId = 7;
          if (counterSnap.exists()) {
            lastId = counterSnap.data().lastStudentId || 7;
          }

          const nextSeq = lastId + 1;
          transaction.set(counterRef, { lastStudentId: nextSeq }, { merge: true });
          return `12610${nextSeq}`;
        });
      } catch (e) {
        console.error('ID Generation Transaction failed:', e);
        newStudentId = `12610${Date.now().toString().slice(-4)}`;
      }

      // Check if this is the first user — they become the teacher/owner
      let userRole = 'student';
      let isFirstUser = false;
      try {
        const { collection, getDocs, query, limit } = await import('firebase/firestore');
        const usersSnap = await getDocs(query(collection(getTenantDb(), 'users'), limit(1)));
        if (usersSnap.empty) {
          userRole = 'teacher';
          isFirstUser = true;
        }
      } catch (checkErr) {
        console.warn('Could not check for existing users, defaulting to student.', checkErr);
      }

      // Save user to Firestore with all detailed form data
      await setDoc(doc(getTenantDb(), 'users', result.user.uid), {
        uid: result.user.uid,
        email: email.trim(),
        displayName: name.trim(),
        role: userRole,
        ...(isFirstUser ? { isOwner: true } : {}),
        studentId: newStudentId,
        level: stage,
        grade: grade,
        createdAt: new Date().toISOString(),
        joinedAt: serverTimestamp(),
        balance: 0,
        walletBalance: 0,
        
        // Student info fields
        studentPhone: studentPhone.trim(),
        motherPhone: motherPhone.trim(),
        fatherPhone: fatherPhone.trim(),
        schoolName: schoolName.trim(),
      });

      if (isFirstUser || userRole === 'teacher' || userRole === 'admin') {
        alert('🎉 مرحباً بك! تم تعيين وتفعيل حسابك كمدير وصاحب هذه المنصة المستقلة بنجاح.');
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      console.error('Registration Error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('هذا البريد الإلكتروني مستخدم بالفعل. حاول تسجيل الدخول.');
      } else if (err.code === 'auth/weak-password') {
        setError('كلمة المرور ضعيفة جداً. يجب أن تكون 6 أحرف على الأقل.');
      } else if (err.code === 'auth/invalid-email') {
        setError('البريد الإلكتروني غير صالح.');
      } else {
        setError('فشل إنشاء الحساب: ' + (err.message || 'خطأ غير معروف'));
      }
    } finally {
      sessionStorage.removeItem('is_registering');
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
            x: [0, 35, 0],
            y: [0, -60, 0],
          }}
          transition={{
            duration: 16,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-40 -right-40 w-96 h-96 bg-brand-500/15 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{
            scale: [1, 1.15, 1],
            x: [0, -35, 0],
            y: [0, 35, 0],
          }}
          transition={{
            duration: 19,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute bottom-[10%] left-[-200px] w-96 h-96 bg-purple-500/10 rounded-full blur-[150px]" 
        />
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
              أهلاً بك في رحلة التعلم والتفوق
            </div>
            <h2 className="text-4xl font-black leading-tight text-white">
              أنشئ حسابك الآن مجاناً وابدأ الدراسة فوراً
            </h2>
            <p className="text-slate-400 text-sm font-semibold leading-relaxed">
              انضم لآلاف الطلاب وتصفح باقة من أقوى الشروحات والامتحانات التفاعلية. املأ بياناتك لبدء مسار تفوقك الأكاديمي.
            </p>
          </div>

          {/* Feature Badges list */}
          <div className="flex flex-col gap-4">
            {[
              {
                icon: "🎓",
                title: "محتوى تعليمي متكامل",
                desc: "منهج كامل بأسلوب مبسط ومحاضرات تدعم الفهم العميق والتطبيق العملي.",
                color: "from-brand-500/10 to-brand-500/5",
                borderColor: "border-brand-500/20"
              },
              {
                icon: "🏆",
                title: "جوائز وتكريمات للمتفوقين",
                desc: "نظام نقاط وجوائز للمتميزين لزيادة الحافز والمنافسة الإيجابية بين الطلاب.",
                color: "from-purple-500/10 to-purple-500/5",
                borderColor: "border-purple-500/20"
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

        {/* Right Column: Premium Glassmorphic Registration Form */}
        <div className="lg:col-span-7 flex justify-center w-full">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-2xl bg-[#0f1224]/50 backdrop-blur-2xl border border-white/10 p-8 sm:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
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
              <h3 className="text-2xl font-black text-white">إنشاء حساب جديد</h3>
              <p className="text-slate-400 text-xs font-bold mt-1.5">املأ الحقول التالية بالبيانات الصحيحة لتسجيل حسابك</p>
            </div>

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-6 relative z-10">
              
              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs font-bold text-right"
                >
                  {error}
                </motion.div>
              )}

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* الاسم بالكامل */}
                <div className="space-y-2 text-right md:col-span-2">
                  <label className="text-xs sm:text-sm font-black text-slate-300 mr-1">الاسم بالكامل</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="الاسم ثلاثي أو رباعي بالعربية"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-12 pr-5 py-4 bg-slate-950/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-bold transition-all focus:bg-slate-950/80"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <User size={18} />
                    </div>
                  </div>
                </div>

                {/* Student Phone */}
                <div className="space-y-2 text-right">
                  <label className="text-xs sm:text-sm font-black text-slate-300 mr-1">رقم هاتف الطالب</label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="رقم الهاتف المحمول"
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(e.target.value)}
                      className="w-full pl-12 pr-5 py-4 bg-slate-950/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-bold transition-all focus:bg-slate-950/80"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <Phone size={18} />
                    </div>
                  </div>
                </div>

                {/* Mother Phone */}
                <div className="space-y-2 text-right">
                  <label className="text-xs sm:text-sm font-black text-slate-300 mr-1">رقم هاتف الأم</label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="رقم هاتف والدتك"
                      value={motherPhone}
                      onChange={(e) => setMotherPhone(e.target.value)}
                      className="w-full pl-12 pr-5 py-4 bg-slate-950/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-bold transition-all focus:bg-slate-950/80"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <Phone size={18} />
                    </div>
                  </div>
                </div>

                {/* Father Phone */}
                <div className="space-y-2 text-right">
                  <label className="text-xs sm:text-sm font-black text-slate-300 mr-1">رقم هاتف الأب</label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="رقم هاتف والدك"
                      value={fatherPhone}
                      onChange={(e) => setFatherPhone(e.target.value)}
                      className="w-full pl-12 pr-5 py-4 bg-slate-950/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-bold transition-all focus:bg-slate-950/80"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <Phone size={18} />
                    </div>
                  </div>
                </div>

                {/* School Name */}
                <div className="space-y-2 text-right">
                  <label className="text-xs sm:text-sm font-black text-slate-300 mr-1">المدرسة</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="اسم مدرستك الحالية"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="w-full pl-12 pr-5 py-4 bg-slate-950/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-bold transition-all focus:bg-slate-950/80"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <BookOpen size={18} />
                    </div>
                  </div>
                </div>

                {/* Grade / Academic Year */}
                <div className="space-y-2 text-right md:col-span-2">
                  <label className="text-xs sm:text-sm font-black text-slate-300 mr-1">الصف الدراسي</label>
                  <div className="relative">
                    <select
                      required
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-950/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-bold transition-all focus:bg-slate-950/80 cursor-pointer appearance-none"
                    >
                      <option value="" className="bg-[#0f1224] text-slate-400">اختر صفك الدراسي</option>
                      {(() => {
                        const stages = (tenantData?.educationStage || 'secondary').split(',').map(s => s.trim());
                        const showPrimary = stages.includes('primary');
                        const showPrep = stages.includes('preparatory') || stages.includes('prep');
                        const showSec = stages.includes('secondary');
                        const showGen = stages.includes('general');

                        return (
                          <>
                            {showPrimary && (
                              <optgroup label="المرحلة الابتدائية" className="bg-[#0f1224] text-slate-300 font-bold">
                                <option value="4-pri">الصف الرابع الابتدائي</option>
                                <option value="5-pri">الصف الخامس الابتدائي</option>
                                <option value="6-pri">الصف السادس الابتدائي</option>
                              </optgroup>
                            )}
                            {showPrep && (
                              <optgroup label="المرحلة الإعدادية" className="bg-[#0f1224] text-slate-300 font-bold">
                                <option value="1-prep">الصف الأول الإعدادي</option>
                                <option value="2-prep">الصف الثاني الإعدادي</option>
                                <option value="3-prep">الصف الثالث الإعدادي</option>
                              </optgroup>
                            )}
                            {showSec && (
                              <optgroup label="المرحلة الثانوية" className="bg-[#0f1224] text-slate-300 font-bold">
                                <option value="1">الصف الأول الثانوي - علوم متكاملة</option>
                                <option value="2">الصف الثاني الثانوي</option>
                                <option value="3">الصف الثالث الثانوي</option>
                              </optgroup>
                            )}
                            {showGen && (
                              <optgroup label="كورسات عامة ومهارات" className="bg-[#0f1224] text-slate-300 font-bold">
                                <option value="beg">المستوى المبتدئ</option>
                                <option value="int">المستوى المتوسط</option>
                                <option value="adv">المستوى المتقدم</option>
                              </optgroup>
                            )}
                          </>
                        );
                      })()}
                    </select>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <Book size={18} />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2 text-right md:col-span-2">
                  <label className="text-xs sm:text-sm font-black text-slate-300 mr-1">البريد الإلكتروني</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="بريدك الإلكتروني (لتسجيل الدخول)"
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
                  <label className="text-xs sm:text-sm font-black text-slate-300 mr-1">كلمة السر</label>
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

                {/* Confirm Password */}
                <div className="space-y-2 text-right">
                  <label className="text-xs sm:text-sm font-black text-slate-300 mr-1">تأكيد كلمة السر</label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="*********"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
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
                      <span>جاري إنشاء الحساب...</span>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </>
                  ) : (
                    <>
                      <span>إنشاء حساب جديد</span>
                      <User size={18} />
                    </>
                  )}
                </button>

                <p className="text-sm font-bold text-slate-400">
                  يوجد لديك حساب بالفعل؟{' '}
                  <Link to="/login" className="text-brand-500 hover:text-brand-600 font-black transition-colors">
                    ادخل إلى حسابك الآن !
                  </Link>
                </p>
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
