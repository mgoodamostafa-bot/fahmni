import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BookOpen,
  ChevronLeft,
  Facebook,
  Youtube,
  Send,
  Instagram,
  MessageCircle,
  Globe,
} from 'lucide-react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { getTenantDb, db as firebaseDb, masterDb } from '../lib/firebase';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { AcademyWelcome } from './AcademyWelcome';
import { SingleTeacherHero } from '../components/themes/single/SingleTeacherHero';

export const Welcome: React.FC = () => {
  const { settings } = useSettings();
  const { user } = useAuth();
  const { tenantData } = useTenant();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<any[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  const platformMode = tenantData?.platformMode || settings.platformMode || 'single';
  const educationStage = tenantData?.educationStage || 'secondary';
  const showSuggestedCourses = tenantData?.showSuggestedCourses !== undefined
    ? tenantData.showSuggestedCourses !== false
    : settings.showSuggestedCourses !== false;

  // Dynamic settings
  const siteName = tenantData?.name || settings.siteName || 'أحمد عبد المنعم';
  const logoUrl = tenantData?.logo || settings.logoUrl || '';
  const facebook = tenantData?.facebook || settings.facebook || '';
  const youtube = tenantData?.youtube || settings.youtube || '';
  const telegram = tenantData?.telegram || settings.telegram || '';
  const instagram = tenantData?.instagram || settings.instagram || '';
  const whatsapp = tenantData?.whatsapp || settings.whatsapp || '';
  const tiktok = tenantData?.tiktok || settings.tiktok || '';
  const teacherPhoto = tenantData?.teacherPhoto || settings.teacherPhotoUrl || '';
  const subject = tenantData?.subject || settings.subject || 'الفيزياء';

  // Fetch courses from a specific db instance
  const fetchFromDb = async (database: any): Promise<any[]> => {
    const [snapUpper, snapLower] = await Promise.all([
      getDocs(query(collection(database, 'Courses'), limit(100))),
      getDocs(query(collection(database, 'courses'), limit(100)))
    ]);
    const allDocs = [...snapUpper.docs, ...snapLower.docs].map(d => ({ id: d.id, ...d.data() }));
    const uniqueMap = new Map();
    allDocs.forEach(c => { if (!uniqueMap.has(c.id)) uniqueMap.set(c.id, c); });
    return Array.from(uniqueMap.values());
  };

  // Fetch courses from db with retry and masterDb fallback
  const fetchCourses = useCallback(async (retryCount = 0) => {
    try {
      const currentDb = getTenantDb() || firebaseDb;
      if (!currentDb) {
        if (retryCount < 3) {
          setTimeout(() => fetchCourses(retryCount + 1), 500 * (retryCount + 1));
        } else {
          setCoursesLoading(false);
        }
        return;
      }

      let list = await fetchFromDb(currentDb);
      console.log(`[Welcome] Fetched ${list.length} courses from tenant db`);

      // If tenant db returned 0 and it's first attempt, retry after 1.5s
      // (tenant db might not be initialized yet)
      if (list.length === 0 && retryCount === 0) {
        setTimeout(() => fetchCourses(1), 1500);
        return;
      }

      // Filter by featured courses if specified
      const featuredIds = tenantData?.featuredCourseIds && tenantData.featuredCourseIds.length > 0
        ? tenantData.featuredCourseIds
        : settings.featuredCourseIds;
      
      if (featuredIds && Array.isArray(featuredIds) && featuredIds.length > 0) {
        const filtered = list.filter((c: any) => featuredIds.includes(c.id));
        setCourses(filtered);
      } else {
        setCourses(list.slice(0, 8));
      }
    } catch (err) {
      console.warn('Courses fetch error:', err);
    } finally {
      setCoursesLoading(false);
    }
  }, [tenantData, settings]);

  useEffect(() => {
    setCoursesLoading(true);
    fetchCourses();
  }, [fetchCourses]);


  // 🔀 Academy Theme Redirect
  if (platformMode === 'academy') {
    return <AcademyWelcome />;
  }

  // Dynamic grades data based on educationStage
  let stageTitle = 'السنوات الدراسية';
  let stageSubtitle = `ابدأ مذاكرة ${subject} على أي جهاز في أي وقت`;

  interface GradeCard {
    num: string;
    stageLabel: string;
    title: string;
    desc: string;
    gradient: string;
  }

  let gradeCards: GradeCard[] = [];
  const activeStages = tenantData?.educationStage || 'secondary';

  if (activeStages.includes('primary')) {
    gradeCards.push(
      {
        num: '4th',
        stageLabel: 'primary',
        title: 'الصف الرابع الابتدائي',
        desc: 'منهج الصف الرابع الابتدائي المطور والحديث',
        gradient: 'from-teal-500 to-emerald-700',
      },
      {
        num: '5th',
        stageLabel: 'primary',
        title: 'الصف الخامس الابتدائي',
        desc: 'منهج الصف الخامس الابتدائي المطور والحديث',
        gradient: 'from-indigo-500 to-purple-700',
      },
      {
        num: '6th',
        stageLabel: 'primary',
        title: 'الصف السادس الابتدائي',
        desc: 'منهج الصف السادس الابتدائي المطور والحديث',
        gradient: 'from-rose-500 to-red-700',
      }
    );
  }
  if (activeStages.includes('preparatory') || activeStages.includes('prep')) {
    gradeCards.push(
      {
        num: '1st',
        stageLabel: 'preparatory',
        title: 'الصف الأول الإعدادي',
        desc: 'منهج الصف الأول الإعدادي المطور',
        gradient: 'from-teal-500 to-emerald-700',
      },
      {
        num: '2nd',
        stageLabel: 'preparatory',
        title: 'الصف الثاني الإعدادي',
        desc: 'منهج الصف الثاني الإعدادي المطور',
        gradient: 'from-indigo-500 to-purple-700',
      },
      {
        num: '3rd',
        stageLabel: 'preparatory',
        title: 'الصف الثالث الإعدادي',
        desc: 'منهج الصف الثالث الإعدادي - الشهادة الإعدادية',
        gradient: 'from-rose-500 to-red-700',
      }
    );
  }
  if (activeStages.includes('secondary')) {
    gradeCards.push(
      {
        num: '1st',
        stageLabel: 'secondary',
        title: 'الصف الأول الثانوي - علوم متكاملة',
        desc: 'منهج الصف الأول الثانوي المطور كامل',
        gradient: 'from-teal-500 to-emerald-700',
      },
      {
        num: '2nd',
        stageLabel: 'secondary',
        title: 'الصف الثاني الثانوي',
        desc: 'منهج الصف الثاني الثانوي كامل',
        gradient: 'from-indigo-500 to-purple-700',
      },
      {
        num: '3rd',
        stageLabel: 'secondary',
        title: 'الصف الثالث الثانوي',
        desc: 'منهج الصف الثالث الثانوي (الثانوية العامة)',
        gradient: 'from-rose-500 to-red-700',
      }
    );
  }
  if (activeStages.includes('general')) {
    gradeCards.push(
      {
        num: 'Beg',
        stageLabel: 'general',
        title: 'المستوى المبتدئ',
        desc: 'كورسات تأسيسية ومبادئ أساسية للمبتدئين',
        gradient: 'from-teal-500 to-emerald-700',
      },
      {
        num: 'Int',
        stageLabel: 'general',
        title: 'المستوى المتوسط',
        desc: 'كورسات متوسطة لتطوير وتحسين المهارات',
        gradient: 'from-indigo-500 to-purple-700',
      },
      {
        num: 'Adv',
        stageLabel: 'general',
        title: 'المستوى المتقدم',
        desc: 'كورسات احترافية متقدمة وتطبيقات عملية',
        gradient: 'from-rose-500 to-red-700',
      }
    );
  }

  // Fallback if none matches
  if (gradeCards.length === 0) {
    gradeCards = [
      {
        num: '1st',
        stageLabel: 'secondary',
        title: 'الصف الأول الثانوي - علوم متكاملة',
        desc: 'منهج الصف الأول الثانوي المطور كامل',
        gradient: 'from-teal-500 to-emerald-700',
      },
      {
        num: '2nd',
        stageLabel: 'secondary',
        title: 'الصف الثاني الثانوي',
        desc: 'منهج الصف الثاني الثانوي كامل',
        gradient: 'from-indigo-500 to-purple-700',
      },
      {
        num: '3rd',
        stageLabel: 'secondary',
        title: 'الصف الثالث الثانوي',
        desc: 'منهج الصف الثالث الثانوي (الثانوية العامة)',
        gradient: 'from-rose-500 to-red-700',
      },
    ];
  }

  return (
    <div
      className="min-h-screen bg-[#000000] text-white overflow-x-hidden font-display selection:bg-brand-500/30"
      dir="rtl"
    >

      
      {/* ═══════════════════ Navbar ═══════════════════ */}
      <nav className="fixed top-0 inset-x-0 z-[100] h-20 border-b border-white/5 bg-[#000000]/95 backdrop-blur-md flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex justify-between items-center">
          
          {/* Logo */}
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
              <span className="text-sm sm:text-base font-black tracking-tight text-white uppercase">
                {tenantData?.teacherName || tenantData?.name || 'AHMED ABD-ELMONEM'}
              </span>
              <span className="text-[10px] text-brand-500 font-extrabold tracking-widest leading-none uppercase">
                {tenantData?.subject || 'PHYSICS TEACHER'}
              </span>
            </div>
          </Link>

          {/* Left Navigation Actions */}
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm font-bold text-white hover:text-brand-500 transition-colors"
            >
              تسجيل الدخول
            </Link>
            
            <button
              onClick={() => navigate(user ? '/' : '/register')}
              className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-black rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-brand-500/15"
            >
              إنشاء حساب
            </button>
          </div>
        </div>
      </nav>

      {/* Spacer for Fixed Nav */}
      <div className="h-20" />

      {/* ═══════════════════ Hero Section ═══════════════════ */}
      <SingleTeacherHero />

      {/* ═══════════════════ Features Section ═══════════════════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#000000] relative">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white flex items-center justify-center gap-3">
              <span>إيه اللي هتلاقيه على</span>
              <span className="bg-brand-500 text-white px-5 py-2 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                المنصة؟
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            
            <div className="bg-[#13131c]/60 border border-white/5 p-6 rounded-[2rem] space-y-4 hover:border-brand-500/25 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 text-2xl font-bold">
                🎯
              </div>
              <h3 className="text-lg font-black text-white">شرح مبسط ومركز</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-semibold">
                شرح النظريات والمفاهيم زي ما بتفهمها في حياتك اليومية، بعيد عن التعقيد الأكاديمي.
              </p>
            </div>

            <div className="bg-[#13131c]/60 border border-white/5 p-6 rounded-[2rem] space-y-4 hover:border-brand-500/25 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 text-2xl font-bold">
                📝
              </div>
              <h3 className="text-lg font-black text-white">نماذج امتحانات بنفس النظام</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-semibold">
                امتحانات تفاعلية بنفس شكل امتحانات الثانوية العامة، عشان تعيش جو الامتحان على المنصة.
              </p>
            </div>

            <div className="bg-[#13131c]/60 border border-white/5 p-6 rounded-[2rem] space-y-4 hover:border-brand-500/25 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 text-2xl font-bold">
                  👨‍👩‍👦
                </div>
                <h3 className="text-lg font-black text-white">بوابة ولي الأمر للمتابعة</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-semibold">
                  لوحة إحصائيات وتقارير تفاعلية تمكن أولياء الأمور من متابعة درجات الامتحانات والواجبات والمحفظة أولاً بأول.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2 text-xs font-black">
                <Link
                  to="/parent-center"
                  className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                >
                  <span>🏫 بوابة ولي أمر السنتر</span>
                  <span>←</span>
                </Link>
                <Link
                  to="/parent"
                  className="inline-flex items-center gap-1.5 text-brand-500 hover:text-brand-400 hover:underline cursor-pointer"
                >
                  <span>🌐 بوابة ولي أمر المنصة</span>
                  <span>←</span>
                </Link>
              </div>
            </div>

            <div className="bg-[#13131c]/60 border border-white/5 p-6 rounded-[2rem] space-y-4 hover:border-brand-500/25 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 text-2xl font-bold">
                🎬
              </div>
              <h3 className="text-lg font-black text-white">فيديوهات مراجعة مركزة</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-semibold">
                فيديوهات مراجعة قصيرة مركزة على أهم النقاط اللي محتاج تذاكرها قبل ما تدخل قاعة الامتحان.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ═══════════════════ Academic Years Section ═══════════════════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#000000] border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column */}
          <div className="lg:col-span-4 text-right space-y-6">
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">{stageTitle}</h2>
            <p className="text-slate-400 text-sm sm:text-base font-semibold leading-relaxed">
              {stageSubtitle}
            </p>
            <button
              onClick={() => navigate(user ? '/' : '/register')}
              className="px-8 py-3.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-black rounded-xl transition-all cursor-pointer shadow-lg shadow-brand-500/10"
            >
              إنشاء حساب
            </button>
          </div>

          {/* Right Column: Dynamic Stage/Grade Cards */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {gradeCards.map((card) => (
              <div
                key={card.num}
                className="bg-[#13131c]/60 border border-white/5 rounded-3xl overflow-hidden flex flex-col group hover:border-brand-500/20 transition-all"
              >
                <div className={`h-32 bg-gradient-to-br ${card.gradient} p-6 flex flex-col justify-between text-right relative`}>
                  <span className="text-white/20 text-5xl font-black absolute left-4 bottom-2 select-none">{card.num}</span>
                  <span className="text-[10px] font-extrabold text-white/80 uppercase tracking-widest">{card.stageLabel}</span>
                  <h4 className="text-base font-black text-white">{card.title}</h4>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between items-start">
                  <p className="text-xs text-slate-300 font-bold text-right mb-6">{card.desc}</p>
                  <Link
                    to="/courses"
                    className="text-xs font-black text-brand-500 hover:text-brand-400 flex items-center gap-1 mt-auto"
                  >
                    <span>الدخول للكورسات</span>
                    <ChevronLeft size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ═══════════════════ Suggested Courses Section ═══════════════════ */}
      {showSuggestedCourses && (
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#000000] border-t border-white/5 relative">
          <div className="max-w-7xl mx-auto space-y-12">
            
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-black text-white">الكورسات المقترحة</h2>
            </div>

            {coursesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1,2,3,4].map(i => (
                  <div key={i} className="bg-[#13131c]/80 border border-white/5 rounded-3xl overflow-hidden animate-pulse">
                    <div className="aspect-video bg-slate-800" />
                    <div className="p-5 space-y-3">
                      <div className="h-4 bg-slate-800 rounded w-3/4" />
                      <div className="h-3 bg-slate-800 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 text-sm font-bold">لا توجد كورسات متاحة حالياً</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-[#13131c]/80 border border-white/5 rounded-3xl overflow-hidden flex flex-col group hover:border-brand-500/20 transition-all"
                >
                  
                  {/* Thumbnail Image */}
                  <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                    <img
                      src={(() => {
                        const isYoutube = (url: string) => url.includes('youtube.com') || url.includes('youtu.be');
                        const getYtThumb = (url: string) => {
                          const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
                          const vid = (match && match[2].length === 11) ? match[2] : null;
                          return vid ? `https://img.youtube.com/vi/${vid}/maxresdefault.jpg` : null;
                        };
                        if (course.imageUrl && !isYoutube(course.imageUrl)) return course.imageUrl;
                        if (course.imageUrl && isYoutube(course.imageUrl)) { const t = getYtThumb(course.imageUrl); if (t) return t; }
                        if (course.coverImage) return course.coverImage;
                        if (course.thumbnailUrl) return course.thumbnailUrl;
                        if (course.videoUrl) { const t = getYtThumb(course.videoUrl); if (t) return t; }
                        return 'https://images.unsplash.com/photo-1636466484294-4758b901f8a5?w=800&q=80';
                      })()}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1636466484294-4758b901f8a5?w=800&q=80'; }}
                    />
                    {(course.grade || course.stage || educationStage) && (
                      <span className="absolute top-3 right-3 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-lg text-[10px] font-bold text-white/90">
                        {course.grade || course.stage || (
                          educationStage === 'primary' ? 'ابتدائي' :
                          educationStage === 'preparatory' ? 'إعدادي' :
                          educationStage === 'general' ? 'عام' :
                          'ثانوي'
                        )}
                      </span>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between text-right space-y-4">
                    
                    <div className="space-y-2">
                      <h4 className="text-sm sm:text-base font-black text-white leading-tight min-h-[44px] line-clamp-2">
                        {course.title}
                      </h4>
                      <p className="text-xs text-slate-400 font-semibold line-clamp-1">
                        {course.description}
                      </p>
                    </div>

                    {/* Actions Row */}
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => navigate(`/courses/${course.id}`)}
                          className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center"
                        >
                          اشترك
                        </button>
                        <button
                          onClick={() => navigate(`/courses/${course.id}`)}
                          className="py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center"
                        >
                          دخول
                        </button>
                      </div>

                      <div className="text-center">
                        <span className="text-sm font-black text-yellow-500">
                          {typeof course.price === 'number' ? `${course.price.toFixed(2)} جنيه` : `${course.price} جنيه`}
                        </span>
                      </div>
                    </div>

                  </div>

                </div>
              ))}
            </div>
            )}

          </div>
        </section>
      )}

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
                    <div className="bg-brand-blue p-2.5 rounded-full shadow-lg shadow-brand-500/20">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-base font-black text-white">{tenantData?.teacherName || tenantData?.name || 'أحمد عبد المنعم'}</span>
                  <span className="text-[9px] text-brand-500 font-extrabold tracking-wider leading-none uppercase">{tenantData?.subject || 'PHYSICS TEACHER'}</span>
                </div>
              </div>
              <p className="text-slate-500 text-xs font-semibold text-center md:text-right max-w-xs leading-relaxed">
                منصتك الأولى لتفوقك الدراسي مع أفضل الشروحات وأحدث نظم المتابعة الدورية.
              </p>
            </div>

            {/* Quick Links */}
            <div className="flex justify-center gap-8 text-sm font-bold">
              <Link to="/login" className="text-slate-400 hover:text-brand-500 transition-colors">
                تسجيل الدخول
              </Link>
              <Link
                to="/register"
                className="text-slate-400 hover:text-brand-500 transition-colors"
              >
                حساب جديد
              </Link>
              <Link to="/courses" className="text-slate-400 hover:text-brand-500 transition-colors">
                الدورات
              </Link>
            </div>

            {/* Social Icons */}
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
                  <MessageCircle size={18} />
                </a>
              )}
              {tiktok && (
                <a
                  href={tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 hover:text-gray-200 hover:bg-white/10 transition-all"
                >
                  <Globe size={18} />
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
