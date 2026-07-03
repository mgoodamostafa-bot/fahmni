import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  BookOpen,
  Award,
  MonitorPlay,
  CheckCircle2,
  Phone,
  LogIn,
  ArrowRight,
  Target,
  Users,
  Facebook,
  Youtube,
  Send,
  Instagram,
  Sparkles,
} from 'lucide-react';
import { collection, getDocs, query, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { TeachersGrid, Teacher, MOCK_TEACHERS } from '../components/themes/academy/TeachersGrid';
import { BookingCarousel } from '../components/themes/academy/BookingCarousel';

export const AcademyWelcome: React.FC = () => {
  const { settings } = useSettings();
  const { user } = useAuth();
  const { tenantData } = useTenant();
  const navigate = useNavigate();
  const [coursesCount, setCoursesCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(MOCK_TEACHERS[0]);
  const bookingSectionRef = useRef<HTMLDivElement>(null);

  // Dynamic settings
  const siteName = tenantData?.name || settings.siteName || 'أكاديمية فهمني';
  const slogan = tenantData?.slogan || settings.welcomeTitle || `مرحباً بك في ${siteName}`;
  const description =
    tenantData?.welcomeDescription ||
    settings.welcomeDescription ||
    'المنصة التعليمية الشاملة التي تجمع نخبة من أفضل المعلمين في مختلف المواد الدراسية. انضم إلينا اليوم وابدأ رحلة التفوق.';
  const logoUrl = tenantData?.logo || settings.logoUrl || '';
  const whatsapp = tenantData?.whatsapp || settings.whatsapp || '';
  const facebook = tenantData?.facebook || settings.facebook || '';
  const youtube = tenantData?.youtube || settings.youtube || '';
  const telegram = tenantData?.telegram || settings.telegram || '';
  const instagram = tenantData?.instagram || settings.instagram || '';
  const heroImage =
    tenantData?.heroImage ||
    settings.welcomeImageUrl ||
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop';

  // Scroll-based nav styling
  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 80], ['rgba(2, 6, 23, 0)', 'rgba(2, 6, 23, 0.95)']);
  const navBlur = useTransform(scrollY, [0, 80], ['blur(0px)', 'blur(20px)']);
  const navBorder = useTransform(
    scrollY,
    [0, 80],
    ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.08)']
  );

  // Fetch counts
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [coursesSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, 'courses'), limit(100))),
          getDocs(query(collection(db, 'users'), where('role', '==', 'student'), limit(500))),
        ]);
        setCoursesCount(coursesSnap.size);
        setStudentsCount(usersSnap.size);
      } catch (err) {
        console.warn('Stats fetch error:', err);
      }
    };
    fetchStats();
  }, []);

  const handleSelectTeacher = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    // Smooth scroll to scheduling area
    bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const features = [
    {
      icon: <Users size={28} />,
      title: 'نخبة المعلمين',
      desc: 'أفضل الكوادر التعليمية المتخصصة في كل مادة لضمان فهمك العميق.',
    },
    {
      icon: <MonitorPlay size={28} />,
      title: 'شروحات تفاعلية',
      desc: 'محتوى مرئي عالي الجودة مع أدوات تفاعلية تضمن تركيزك وتفوقك.',
    },
    {
      icon: <Target size={28} />,
      title: 'تقييم مستمر',
      desc: 'اختبارات دورية ومتابعة دقيقة لمستواك الدراسي ونقاط ضعفك.',
    },
  ];

  return (
    <div
      className="min-h-screen bg-[#020617] text-white overflow-x-hidden font-display selection:bg-brand-blue/30"
      dir="rtl"
    >
      {/* ═══════════════════ Navbar ═══════════════════ */}
      <motion.nav
        style={{ backgroundColor: navBg, backdropFilter: navBlur, borderBottomColor: navBorder }}
        className="fixed top-0 inset-x-0 z-[100] h-20 border-b flex items-center"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="w-full h-full object-cover rounded-full" />
              ) : (
                <div className="bg-brand-blue p-2.5 rounded-full shadow-lg shadow-brand-blue/20">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
            <span className="text-lg sm:text-xl font-black tracking-tight">{siteName}</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {whatsapp && (
              <a
                href={whatsapp.startsWith('http') ? whatsapp : `https://wa.me/${whatsapp.replace(/\+/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-2 text-sm text-slate-400 hover:text-green-400 transition-colors font-bold"
              >
                <Phone size={16} />
                تواصل معنا
              </a>
            )}
            {!user ? (
              <Link
                to="/login"
                className="flex items-center gap-2 text-sm font-black text-white bg-brand-blue hover:opacity-90 px-5 sm:px-8 py-2.5 sm:py-3 rounded-full shadow-lg shadow-brand-blue/30 transition-all hover:shadow-brand-blue/50 active:scale-95"
              >
                <LogIn size={16} />
                <span>دخول النظام</span>
              </Link>
            ) : (
              <Link
                to="/"
                className="bg-brand-blue hover:opacity-90 text-white text-sm font-black px-6 py-3 rounded-full transition-all"
              >
                لوحة التحكم
              </Link>
            )}
          </div>
        </div>
      </motion.nav>

      {/* ═══════════════════ Hero Section ═══════════════════ */}
      <main className="relative pt-28 pb-16 sm:pt-32 md:pt-40 lg:pt-0 lg:pb-0 px-4 sm:px-6 min-h-[100vh] flex items-center overflow-hidden">
        {/* Background accents */}
        <div className="absolute top-0 left-0 w-[60%] h-[60%] bg-brand-blue/10 blur-[150px] -z-10 rounded-full" />
        <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-brand-blue/10 blur-[150px] -z-10 rounded-full" />

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center mt-10 lg:mt-20">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-7 text-center lg:text-right space-y-6 sm:space-y-8"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-brand-blue/10 border border-brand-blue/20 px-5 py-2.5 rounded-full text-brand-blue text-sm font-bold mx-auto lg:mr-0">
              <Award size={16} />
              منصة تعليمية متكاملة
            </div>

            {/* Main Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight sm:leading-[1.1] tracking-tight text-white">
              {slogan}
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg lg:text-xl text-slate-400 leading-relaxed max-w-xl mx-auto lg:mr-0 lg:ml-auto font-medium">
              {description}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-center lg:justify-start pt-2">
              <button
                onClick={() => navigate(user ? '/' : '/register')}
                className="w-full sm:w-auto bg-brand-blue hover:opacity-90 text-white text-base sm:text-lg font-black px-8 sm:px-12 py-4 sm:py-5 rounded-2xl shadow-2xl shadow-brand-blue/30 transition-all hover:-translate-y-1 hover:shadow-brand-blue/50 active:scale-95 flex items-center justify-center gap-3 group cursor-pointer"
              >
                {user ? 'دخول الأكاديمية' : 'سجّل الآن مجاناً'}
                <ArrowRight
                  className="rotate-180 group-hover:-translate-x-2 transition-transform"
                  size={20}
                />
              </button>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-6 sm:gap-10 justify-center lg:justify-start pt-4 text-center">
              <div>
                <div className="text-xl sm:text-2xl font-black text-white">
                  {studentsCount || '500'}+
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 font-bold mt-1">
                  طالب مسجل
                </div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div>
                <div className="text-xl sm:text-2xl font-black text-white">
                  {coursesCount || '20'}+
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 font-bold mt-1">
                  دورة تعليمية
                </div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div>
                <div className="text-xl sm:text-2xl font-black text-brand-blue">نخبة</div>
                <div className="text-[10px] sm:text-xs text-slate-500 font-bold mt-1">
                  من المعلمين
                </div>
              </div>
            </div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="lg:col-span-5 relative w-full flex justify-center lg:justify-start"
          >
            <div className="relative z-10 w-full max-w-sm sm:max-w-md xl:max-w-lg">
              <div className="relative rounded-[2.5rem] p-1 bg-gradient-to-b from-brand-blue/30 to-slate-900 border border-white/10 overflow-hidden shadow-2xl shadow-brand-blue/20 group aspect-[4/3] w-full">
                <img
                  src={heroImage}
                  alt={siteName}
                  className="w-full h-full object-cover transition-transform duration-[3s] group-hover:scale-105 rounded-[2.2rem]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/20 to-transparent opacity-80" />
              </div>

              {/* Floating Element */}
              <div className="absolute -bottom-6 -left-6 sm:-left-10 bg-[#0f172a] border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-4 z-20">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={24} className="text-green-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">محتوى معتمد</p>
                  <p className="text-slate-400 text-xs">من أفضل الخبراء</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* ═══════════════════ Teachers Selection Section (NEW Integration) ═══════════════════ */}
      <section className="py-20 bg-slate-950/40 relative border-t border-white/5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-brand-blue/10 border border-brand-blue/20 px-4 py-2 rounded-full text-brand-blue text-xs sm:text-sm font-semibold">
              <Sparkles size={14} className="text-brand-blue animate-pulse" />
              <span>مدرسي المنصة المتخصصين</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">اختر معلمك المفضل</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              تصفح ملفات المعلمين واللغات، واستمع للتعريف الشخصي لكل معلم لمساعدتك على اختيار المدرس الأنسب لخطتك الدراسية.
            </p>
          </div>

          <TeachersGrid
            onSelectTeacher={handleSelectTeacher}
            selectedTeacherId={selectedTeacher?.id}
          />
        </div>
      </section>

      {/* 📅 Active Booking Slot Carousel Section (NEW Integration) ═══════════════════ */}
      <section ref={bookingSectionRef} className="py-16 bg-transparent px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="max-w-4xl mx-auto">
          {selectedTeacher && (
            <BookingCarousel
              teacherId={selectedTeacher.id}
              teacherName={selectedTeacher.name}
            />
          )}
        </div>
      </section>

      {/* ═══════════════════ Features ═══════════════════ */}
      <section className="py-20 bg-[#020617] relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-black text-white">لماذا تختار {siteName}؟</h2>
            <p className="text-slate-400">مميزات حصرية تضمن لك التفوق في جميع المواد</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/5 p-8 rounded-3xl hover:bg-white/10 transition-colors"
              >
                <div className="w-14 h-14 rounded-2xl bg-brand-blue/20 text-brand-blue flex items-center justify-center mb-6">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
                <p className="text-slate-400 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ Footer ═══════════════════ */}
      <footer className="border-t border-white/5 bg-[#010309]">
        <div className="max-w-7xl mx-auto px-6 py-12 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-center">
            {/* Logo */}
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={siteName}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="bg-brand-blue p-2.5 rounded-full shadow-lg shadow-brand-blue/20">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
                <span className="text-xl font-black">{siteName}</span>
              </div>
              <p className="text-slate-500 text-sm font-medium text-center md:text-right max-w-xs">
                منصتك الأولى للتفوق الدراسي مع أقوى المعلمين وأحدث الأدوات.
              </p>
            </div>

            {/* Quick Links */}
            <div className="flex justify-center gap-8 text-sm font-bold">
              <Link to="/login" className="text-slate-400 hover:text-brand-blue transition-colors">
                تسجيل الدخول
              </Link>
              <Link
                to="/register"
                className="text-slate-400 hover:text-brand-blue transition-colors"
              >
                حساب جديد
              </Link>
              <Link
                to="/courses"
                className="text-slate-400 hover:text-brand-blue transition-colors"
              >
                الدورات
              </Link>
            </div>

            {/* Social Links */}
            <div className="flex justify-center md:justify-end gap-3">
              {facebook && (
                <a
                  href={facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 transition-all"
                >
                  <Facebook size={18} />
                </a>
              )}
              {youtube && (
                <a
                  href={youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-600/10 transition-all"
                >
                  <Youtube size={18} />
                </a>
              )}
              {telegram && (
                <a
                  href={telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-sky-400 hover:bg-sky-600/10 transition-all"
                >
                  <Send size={18} />
                </a>
              )}
              {instagram && (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-pink-400 hover:bg-pink-600/10 transition-all"
                >
                  <Instagram size={18} />
                </a>
              )}
              {whatsapp && (
                <a
                  href={whatsapp.startsWith('http') ? whatsapp : `https://wa.me/${whatsapp.replace(/\+/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-green-400 hover:bg-green-600/10 transition-all"
                >
                  <Phone size={18} />
                </a>
              )}
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <p className="text-slate-600 text-xs font-bold">
              © {new Date().getFullYear()} {siteName}. جميع الحقوق محفوظة.
              <span className="text-slate-700 mr-2">مدعوم بواسطة فهمني</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
