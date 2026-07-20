import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, masterDb } from '../../lib/firebase';
import {
  Settings,
  Save,
  RefreshCw,
  Image as ImageIcon,
  Type,
  Sparkles,
  Shield,
  GraduationCap,
  Play,
  BookOpen,
  Check,
  Video,
  Database,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { FRUIT_LIST, applyFruitTheme } from '../../constants/fruitThemes';
import type { FruitId } from '../../constants/fruitThemes';
import { generateLogo } from '../../services/logoService';
import { useAuth } from '../../contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { Upload, X, Loader2 } from 'lucide-react';

import { useSettings } from '../../contexts/SettingsContext';
import type { SiteSettings as GlobalSiteSettings } from '../../contexts/SettingsContext';
import { useTenant } from '../../contexts/TenantContext';
import { compressImage, removeWhiteBgFromBase64 } from '../../utils/imageCompression';

export const SiteSettings: React.FC = () => {
  const { user, profile } = useAuth();
  const { updateSettings } = useSettings();
  const { tenantId } = useTenant();
  const [settings, setSettings] = useState<GlobalSiteSettings>({
    siteName: 'فهمني',
    tagline: 'تعلم ببساطة',
    logoUrl: '',
    seoDescription: '',
    whatsapp: '',
    facebook: '',
    telegram: '',
    youtube: '',
    instagram: '',
    tiktok: '',
    contactUsUrl: '',
    supportPhone: '',
    teacherName: '',
    displayName: '',
    teacherTitle: '',
    teacherPhotoUrl: '',
    welcomeTitle: '',
    welcomeDescription: '',
    welcomeImageUrl: '',
    hideGradeSelection: false,
    studentGuideVideoUrl: '',
    teacherGuideVideoUrl: '',
    vodafoneCashNumber: '',
    fruitTheme: 'blueberry' as FruitId,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState<Record<string, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [previewBg, setPreviewBg] = useState<'transparent' | 'dark' | 'light'>('transparent');
  const [removeBg, setRemoveBg] = useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Featured courses state
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [featuredCourseIds, setFeaturedCourseIds] = useState<string[]>([]);
  const [showSuggestedCourses, setShowSuggestedCourses] = useState(true);

  useEffect(() => {
    if (logoFile) {
      handleLogoFile(logoFile);
    }
  }, [removeBg]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [globalSnap, configSnap, teacherSnap, welcomeSnap] = await Promise.all([
          getDoc(doc(db, 'siteSettings', 'global')),
          getDoc(doc(db, 'platform_config', 'settings')),
          getDoc(doc(db, 'siteSettings', 'teacher')),
          getDoc(doc(db, 'settings', 'welcome_page')),
        ]);

        const data = globalSnap.exists() ? globalSnap.data() : {};
        const configData = configSnap.exists() ? configSnap.data() : {};
        const teacherData = teacherSnap.exists() ? teacherSnap.data() : {};
        const welcomeData = welcomeSnap.exists() ? welcomeSnap.data() : {};

        // Also fetch fruit branding
        let fruitData: any = {};
        try {
          const fruitSnap = await getDoc(doc(db, 'platform_config', 'branding'));
          if (fruitSnap.exists()) fruitData = fruitSnap.data();
        } catch {}

        let finalLogo = data.logoUrl || '';
        if (finalLogo && finalLogo.startsWith('data:image/')) {
          try {
            const cleaned = await removeWhiteBgFromBase64(finalLogo);
            if (cleaned !== finalLogo) {
              finalLogo = cleaned;
              // Auto-save the cleaned transparent logo to Firestore immediately
              await setDoc(doc(db, 'siteSettings', 'global'), {
                ...data,
                logoUrl: cleaned,
              });

              // Also sync with the master database tenants collection if tenantId is defined
              if (tenantId) {
                try {
                  await setDoc(
                    doc(masterDb, 'tenants', tenantId),
                    {
                      logo: cleaned,
                    },
                    { merge: true }
                  );
                  console.log('Successfully synced cleaned logo to master tenant database.');
                } catch (tErr) {
                  console.warn('Failed to sync cleaned logo to master tenant database:', tErr);
                }
              }

              updateSettings({ logoUrl: cleaned });
              console.log('Automatically cleaned and saved logo transparency.');
            }
          } catch (e) {
            console.error('Failed to auto-clean existing logo:', e);
          }
        }

        setSettings(
          (prev) =>
            ({
              ...prev,
              ...data,
              logoUrl: finalLogo,
              ...configData,
              ...teacherData,
              ...welcomeData,
              displayName: teacherData.displayName || teacherData.teacherName || '',
              studentGuideVideoUrl: configData.studentGuideVideoUrl || '',
              teacherGuideVideoUrl: configData.teacherGuideVideoUrl || '',
              showStudentGuide: configData.showStudentGuide ?? true,
              showTeacherGuide: configData.showTeacherGuide ?? true,
              vodafoneCashNumber: configData.vodafoneCashNumber || '',
              fruitTheme: (fruitData.fruitTheme || 'blueberry') as FruitId,
            }) as any
        );
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // Fetch all courses from tenant DB + existing tenant config from masterDb
  useEffect(() => {
    const loadCourses = async () => {
      setLoadingCourses(true);
      try {
        const [snapUpper, snapLower] = await Promise.all([
          getDocs(collection(db, 'Courses')),
          getDocs(collection(db, 'courses')),
        ]);
        const allDocs = [...snapUpper.docs, ...snapLower.docs].map(d => ({ id: d.id, ...d.data() }));
        // Deduplicate by ID
        const uniqueMap = new Map();
        allDocs.forEach(c => {
          if (!uniqueMap.has(c.id)) uniqueMap.set(c.id, c);
        });
        setAllCourses(Array.from(uniqueMap.values()));
      } catch (err) {
        console.warn('Error fetching courses:', err);
      } finally {
        setLoadingCourses(false);
      }
    };

    const loadTenantConfig = async () => {
      if (!tenantId) {
        if (settings) {
          if (settings.featuredCourseIds) setFeaturedCourseIds(settings.featuredCourseIds);
          if (settings.showSuggestedCourses !== undefined) setShowSuggestedCourses(settings.showSuggestedCourses);
        }
        return;
      }
      try {
        const tenantSnap = await getDoc(doc(masterDb, 'tenants', tenantId));
        if (tenantSnap.exists()) {
          const data = tenantSnap.data();
          if (data.featuredCourseIds) setFeaturedCourseIds(data.featuredCourseIds);
          if (data.showSuggestedCourses !== undefined) setShowSuggestedCourses(data.showSuggestedCourses !== false);
          
          // Load hero texts if present
          setSettings(prev => ({
            ...prev,
            heroTitle1: data.heroTitle1 || prev.heroTitle1,
            heroTitle2: data.heroTitle2 || prev.heroTitle2,
            heroTitle3: data.heroTitle3 || prev.heroTitle3,
            heroDescription: data.heroDescription || prev.heroDescription,
          }));
        }
      } catch (err) {
        console.warn('Error fetching tenant config:', err);
      }
    };

    loadCourses();
    loadTenantConfig();
  }, [tenantId, settings]);

  const handleLogoFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صحيح (PNG, JPG, SVG)');
      return;
    }
    setLogoFile(file);

    // 🚀 Instant Preview Logic with Premium Quality and Smart Transparency
    try {
      // High-res preview compression (500x500 at 0.9 quality, passing removeBg)
      const previewUrl = await compressImage(file, 500, 500, 0.9, 'image/webp', removeBg);

      // Update both local state and global context for instant feedback
      setSettings((prev) => ({ ...prev, logoUrl: previewUrl }));
      updateSettings({ logoUrl: previewUrl });
    } catch (err) {
      console.error('Preview generation failed:', err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLogoFile(file);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      // High-res output (500x500 at 0.9 quality, passing removeBg)
      const compressedBase64 = await compressImage(file, 500, 500, 0.9, 'image/webp', removeBg);

      // Sync local/global state
      setSettings((prev) => ({ ...prev, logoUrl: compressedBase64 }));
      updateSettings({ logoUrl: compressedBase64 });

      // Background Storage Upload (Optional & Non-blocking to prevent timeouts)
      try {
        const storageRef = ref(storage, `course_images/logo_${Date.now()}_${file.name}`);
        uploadBytes(storageRef, file).catch((e) => {
          console.warn('Background storage upload failed:', e);
        });
      } catch (e) {
        console.warn('Background storage upload initialization failed:', e);
      }

      return compressedBase64;
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw new Error('فشل معالجة اللوجو. حاول مرة أخرى.');
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صحيح (PNG, JPG, SVG)');
      return;
    }

    setIsUploadingFiles((prev) => ({ ...prev, [field]: true }));
    try {
      const base64Url = await compressImage(file, 600, 600, 0.5, 'image/webp');
      setSettings((prev) => ({ ...prev, [field]: base64Url }));
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('فشل رفع الصورة. الرجاء المحاولة مرة أخرى.');
    } finally {
      setIsUploadingFiles((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleSave = async () => {
    if (!user) {
      alert('يجب تسجيل الدخول أولاً.');
      return;
    }
    if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
      alert('غير مصرح لك بحفظ الإعدادات. يرجى التأكد من أنك مدير أو معلم.');
      return;
    }

    if (!settings.displayName && !settings.teacherName) {
      alert('سيتم استخدام الاسم التلقائي للمنصة (مدرس المنصة المعتمد) لأن حقل الاسم فارغ.');
    }

    setSaving(true);

    // Create a timeout promise (Raised to 30 seconds as requested)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), 30000);
    });

    try {
      const saveOperation = async () => {
        const finalSettings = { ...settings };

        if (logoFile) {
          const uploadedUrl = await uploadLogo(logoFile);
          finalSettings.logoUrl = uploadedUrl;
          setLogoFile(null);
        }

        // 🛡️ Data Sanitization
        const brandingData = {
          siteName: finalSettings.siteName || '',
          tagline: finalSettings.tagline || '',
          logoUrl: finalSettings.logoUrl || '',
          seoDescription: finalSettings.seoDescription || '',
        };

        const configData = {
          whatsapp: finalSettings.whatsapp || '',
          facebook: finalSettings.facebook || '',
          telegram: finalSettings.telegram || '',
          youtube: finalSettings.youtube || '',
          instagram: finalSettings.instagram || '',
          tiktok: finalSettings.tiktok || '',
          contactUsUrl: finalSettings.contactUsUrl || '',
          supportPhone: finalSettings.supportPhone || '',
          hideGradeSelection: finalSettings.hideGradeSelection || false,
          studentGuideVideoUrl: finalSettings.studentGuideVideoUrl || '',
          teacherGuideVideoUrl: finalSettings.teacherGuideVideoUrl || '',
          showStudentGuide: finalSettings.showStudentGuide ?? true,
          showTeacherGuide: finalSettings.showTeacherGuide ?? true,
          vodafoneCashNumber: finalSettings.vodafoneCashNumber || '',
          showSuggestedCourses,
          featuredCourseIds,
        };

        const teacherData = {
          displayName: finalSettings.displayName || finalSettings.teacherName || '',
          teacherName: finalSettings.displayName || finalSettings.teacherName || '',
          teacherTitle: finalSettings.teacherTitle || '',
          teacherPhotoUrl: finalSettings.teacherPhotoUrl || '',
          teacherBio: (finalSettings as any).teacherBio || '',
          subject: (finalSettings as any).subject || '',
        };

        const welcomeData = {
          welcomeTitle: finalSettings.welcomeTitle || '',
          welcomeDescription: finalSettings.welcomeDescription || '',
          welcomeImageUrl: finalSettings.welcomeImageUrl || '',
        };

        const promises = [
          setDoc(doc(db, 'siteSettings', 'global'), brandingData),
          setDoc(doc(db, 'platform_config', 'settings'), configData),
          setDoc(doc(db, 'settings', 'social_links'), configData),
          setDoc(doc(db, 'siteSettings', 'teacher'), teacherData),
          setDoc(doc(db, 'settings', 'welcome_page'), welcomeData),
          setDoc(doc(db, 'platform_config', 'branding'), {
            fruitTheme: finalSettings.fruitTheme || 'blueberry',
          }),
        ];

        if (tenantId) {
          promises.push(
            setDoc(
              doc(masterDb, 'tenants', tenantId),
              {
                name: brandingData.siteName,
                logo: brandingData.logoUrl,
                fruitTheme: finalSettings.fruitTheme || 'blueberry',
                showSuggestedCourses,
                featuredCourseIds,
                heroTitle1: finalSettings.heroTitle1 || '',
                heroTitle2: finalSettings.heroTitle2 || '',
                heroTitle3: finalSettings.heroTitle3 || '',
                heroDescription: finalSettings.heroDescription || '',
                supabaseUrl: finalSettings.supabaseUrl || '',
                supabaseAnonKey: finalSettings.supabaseAnonKey || '',
              },
              { merge: true }
            )
          );
        }

        await Promise.all(promises);

        updateSettings({ ...brandingData, ...configData });
      };

      // Race against 30s timeout
      await Promise.race([saveOperation(), timeoutPromise]);

      alert('تم حفظ كافة الإعدادات بنجاح!');
    } catch (error) {
      console.error('Error saving settings:', error);
      if ((error as Error).message === 'TIMEOUT') {
        alert('فشل الحفظ: انتهى الوقت المسموح (30 ثانية). يرجى التأكد من اتصال الإنترنت.');
      } else {
        alert('حدث خطأ أثناء حفظ الإعدادات: ' + (error as Error).message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateLogo = async () => {
    setGenerating(true);
    try {
      const newLogo = await generateLogo();
      if (newLogo) {
        setSettings({ ...settings, logoUrl: newLogo });
      } else {
        alert('فشل توليد اللوجو. يرجى المحاولة مرة أخرى.');
      }
    } catch (error) {
      console.error('Error generating logo:', error);
      alert('حدث خطأ أثناء توليد اللوجو.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 text-right pb-24 p-6" dir="rtl">
      <div className="mb-6">
        <a href="/owner-dashboard" className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-2 transition-colors w-fit">
          <span className="text-xl">→</span> العودة إلى لوحة التحكم المركزية
        </a>
      </div>
      <div className="flex items-center gap-3 px-4">
        <Settings className="w-10 h-10 text-brand-blue" />
        <h1 className="text-4xl font-black text-white font-display">إعدادات الموقع</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-8 space-y-8"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-gray-400 font-bold mb-3 flex items-center gap-2">
                <Type size={18} className="text-brand-blue" />
                اسم الموقع
              </label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-brand-blue transition-colors"
                placeholder="أدخل اسم الموقع..."
              />
            </div>

            <div>
              <label className="block text-gray-400 font-bold mb-3 flex items-center gap-2">
                <Sparkles size={18} className="text-brand-yellow" />
                شعار الموقع (Tagline)
              </label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-brand-blue transition-colors"
                placeholder="أدخل شعار الموقع..."
              />
            </div>

            <div>
              <label className="block text-gray-400 font-bold mb-3 flex items-center gap-2">
                <Settings size={18} className="text-brand-blue" />
                وصف الـ SEO
              </label>
              <textarea
                value={settings.seoDescription}
                onChange={(e) => setSettings({ ...settings, seoDescription: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-brand-blue transition-colors min-h-[100px]"
                placeholder="أدخل وصف الموقع لمحركات البحث..."
              />
            </div>

            {/* Supabase Database Config */}
            <div className="pt-6 border-t border-white/10 space-y-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Database size={20} className="text-emerald-400" />
                <span>إعدادات قاعدة بيانات السوبابيس الفورية (Supabase Database Settings)</span>
              </h3>
              <p className="text-xs text-gray-400 font-bold">
                ربط ومعلومات السيرفر لقاعدة بيانات السناتر والنتائج الفورية
              </p>

              <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-2xl space-y-4">
                <div>
                  <label className="block text-gray-300 font-bold mb-1.5 text-xs">Supabase URL (رابط المشروع)</label>
                  <input
                    type="text"
                    value={settings.supabaseUrl || ''}
                    onChange={(e) => setSettings({ ...settings, supabaseUrl: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="https://your-project.supabase.co"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-bold mb-1.5 text-xs">Supabase Anon Key (المفتاح العام)</label>
                  <textarea
                    value={settings.supabaseAnonKey || ''}
                    onChange={(e) => setSettings({ ...settings, supabaseAnonKey: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 min-h-[70px]"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">نصوص صفحة الهبوط الرئيسية (للمدرس المنفرد)</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 font-bold mb-2 text-sm">العنوان الأول (مثال: مستقبلك قرار ...)</label>
                  <input
                    type="text"
                    value={settings.heroTitle1 || ''}
                    onChange={(e) => setSettings({ ...settings, heroTitle1: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand-blue"
                    placeholder="مستقبلك قرار ..."
                  />
                </div>
                
                <div>
                  <label className="block text-gray-400 font-bold mb-2 text-sm">العنوان الثاني (مثال: تقفيل الفيزياء معانا إجبار)</label>
                  <input
                    type="text"
                    value={settings.heroTitle2 || ''}
                    onChange={(e) => setSettings({ ...settings, heroTitle2: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand-blue"
                    placeholder="تقفيل الفيزياء معانا إجبار"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-400 font-bold mb-2 text-sm">الكلمة المضيئة (مثال: مش اختيار)</label>
                  <input
                    type="text"
                    value={settings.heroTitle3 || ''}
                    onChange={(e) => setSettings({ ...settings, heroTitle3: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand-blue"
                    placeholder="مش اختيار"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-bold mb-2 text-sm">الوصف أسفل العنوان</label>
                  <textarea
                    value={settings.heroDescription || ''}
                    onChange={(e) => setSettings({ ...settings, heroDescription: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-brand-blue min-h-[80px]"
                    placeholder="تعلم ببساطة مع أقوى الشروحات..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">أدلة الاستخدام (الدليل الشامل)</h3>
              
              <div className="space-y-6">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-gray-400 font-bold flex items-center gap-2">
                      <Video size={18} className="text-emerald-500" />
                      فيديو دليل الطالب
                    </label>
                    <div 
                      onClick={() => setSettings({ ...settings, showStudentGuide: settings.showStudentGuide === false ? true : false })}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <span className="text-sm font-bold text-gray-400">إظهار الدليل للطالب</span>
                      <div className={`w-12 h-6 rounded-full relative transition-colors ${settings.showStudentGuide !== false ? 'bg-emerald-500' : 'bg-gray-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.showStudentGuide !== false ? 'right-7' : 'right-1'}`} />
                      </div>
                    </div>
                  </div>
                  <input
                    type="url"
                    value={settings.studentGuideVideoUrl || ''}
                    onChange={(e) => setSettings({ ...settings, studentGuideVideoUrl: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="رابط فيديو اليوتيوب لدليل الطالب..."
                  />
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-gray-400 font-bold flex items-center gap-2">
                      <Video size={18} className="text-blue-500" />
                      فيديو دليل المدرس
                    </label>
                    <div 
                      onClick={() => setSettings({ ...settings, showTeacherGuide: settings.showTeacherGuide === false ? true : false })}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <span className="text-sm font-bold text-gray-400">إظهار الدليل للمدرس</span>
                      <div className={`w-12 h-6 rounded-full relative transition-colors ${settings.showTeacherGuide !== false ? 'bg-blue-500' : 'bg-gray-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.showTeacherGuide !== false ? 'right-7' : 'right-1'}`} />
                      </div>
                    </div>
                  </div>
                  <input
                    type="url"
                    value={settings.teacherGuideVideoUrl || ''}
                    onChange={(e) => setSettings({ ...settings, teacherGuideVideoUrl: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                    placeholder="رابط فيديو اليوتيوب لدليل المدرس..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <label className="block text-gray-400 font-bold mb-3 flex items-center gap-2">
                <ImageIcon size={18} className="text-purple-500" />
                لوجو المنصة
              </label>

              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleLogoFile(file);
                  }}
                  className={`w-full p-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                    isDragging
                      ? 'border-brand-blue bg-brand-blue/10 scale-[1.02] shadow-[0_0_30px_rgba(59,130,246,0.15)]'
                      : logoFile
                        ? 'border-brand-blue bg-brand-blue/5'
                        : 'border-white/10 hover:border-brand-blue/50 bg-white/[0.02]'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-brand-blue/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 duration-300 ${logoFile ? 'bg-brand-blue text-white' : 'bg-white/10 text-gray-400 group-hover:text-brand-blue'}`}
                  >
                    <Upload size={24} />
                  </div>

                  {logoFile ? (
                    <div className="text-center relative z-10 space-y-1">
                      <p className="font-black text-white text-sm truncate max-w-xs">
                        {logoFile.name}
                      </p>
                      <p className="text-xs text-brand-blue font-bold uppercase tracking-wider">
                        تم اختيار الملف بنجاح
                      </p>
                      <p className="text-[10px] text-gray-500 font-medium">
                        سيتم ضغطه بجودة عالية عند الحفظ
                      </p>
                    </div>
                  ) : (
                    <div className="text-center relative z-10 space-y-1">
                      <p className="font-black text-white text-sm">اسحب اللوجو الجديد هنا</p>
                      <p className="text-xs text-gray-500 font-bold">
                        أو اضغط لاختيار ملف من جهازك
                      </p>
                      <p className="text-[10px] text-gray-600 font-medium mt-2">
                        يدعم ملفات الصور الشفافة PNG, SVG, WEBP
                      </p>
                    </div>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                {/* 🧹 Background Removal Toggle */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between hover:bg-white/10 transition-all select-none">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                      <Sparkles size={16} />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-white">
                        إزالة الخلفية البيضاء تلقائياً
                      </p>
                      <p className="text-[10px] text-gray-500 font-bold">
                        يقوم بتحويل الخلفيات البيضاء المصمتة إلى شفافة (لوجو احترافي)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemoveBg(!removeBg)}
                    className={`w-12 h-6 rounded-full relative transition-all duration-300 cursor-pointer ${
                      removeBg ? 'bg-brand-blue' : 'bg-gray-700'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-300 ${
                        removeBg ? 'left-6.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={settings.logoUrl}
                      onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs focus:outline-none focus:border-brand-blue transition-colors"
                      placeholder="رابط الصورة (Manual URL)..."
                    />
                  </div>
                  <button
                    onClick={handleGenerateLogo}
                    disabled={generating}
                    className="bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white px-5 py-4 rounded-2xl flex items-center gap-2 transition-all border border-purple-600/20 disabled:opacity-50"
                  >
                    {generating ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <RefreshCw size={18} />
                    )}
                    <span className="text-xs font-black uppercase">ذكاء اصطناعي</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="w-full btn-primary flex items-center justify-center gap-3 py-6"
          >
            {saving || uploading ? (
              <RefreshCw size={24} className="animate-spin" />
            ) : (
              <Save size={24} />
            )}
            <span className="text-xl font-black">
              {saving || uploading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </span>
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-8 flex flex-col items-center justify-between text-center space-y-6 min-h-[500px]"
        >
          <div className="w-full flex flex-col items-center gap-6">
            <h2 className="text-2xl font-black text-white font-display">معاينة الهوية البصرية</h2>

            {/* Background selection tabs */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewBg('transparent')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${previewBg === 'transparent' ? 'bg-white/10 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                خلفية شفافة
              </button>
              <button
                type="button"
                onClick={() => setPreviewBg('dark')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${previewBg === 'dark' ? 'bg-white/10 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                خلفية كحلي
              </button>
              <button
                type="button"
                onClick={() => setPreviewBg('light')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${previewBg === 'light' ? 'bg-white/10 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                خلفية بيضاء
              </button>
            </div>

            {/* Logo Preview Container */}
            <div
              className={`w-64 h-64 rounded-3xl flex items-center justify-center overflow-hidden shadow-2xl border border-white/10 transition-all duration-300 relative group/preview`}
              style={
                previewBg === 'transparent'
                  ? {
                      backgroundColor: '#ffffff',
                      backgroundImage:
                        'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
                      backgroundSize: '20px 20px',
                      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                    }
                  : previewBg === 'dark'
                    ? { backgroundColor: '#0a0f1a' }
                    : { backgroundColor: '#ffffff' }
              }
            >
              {settings.logoUrl ? (
                <div className="p-8 w-full h-full flex items-center justify-center relative">
                  <img
                    src={settings.logoUrl}
                    alt="Logo Preview"
                    className="max-w-full max-h-full object-contain transition-transform group-hover/preview:scale-105 duration-300"
                  />
                  {logoFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoFile(null);
                        setSettings({ ...settings, logoUrl: '' });
                      }}
                      className="absolute top-3 right-3 p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover/preview:opacity-100 transition-opacity cursor-pointer shadow-lg"
                      title="إزالة الشعار المختار"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 flex flex-col items-center gap-2">
                  <ImageIcon size={48} className="opacity-30" />
                  <span className="text-xs font-bold opacity-50">لا يوجد لوجو حالياً</span>
                </div>
              )}
            </div>

            {/* Mock Header Preview */}
            <div className="w-full space-y-2 text-right">
              <span className="text-xs text-gray-500 font-bold mr-2">
                معاينة الهيدر (شريط التنقل العلوي):
              </span>
              <div className="w-full bg-[#0a0f1a]/80 backdrop-blur-md border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-auto flex items-center justify-center">
                    {settings.logoUrl ? (
                      <img
                        src={settings.logoUrl}
                        alt="Nav Logo"
                        className="h-8 w-auto object-contain"
                      />
                    ) : (
                      <GraduationCap className="text-brand-blue" size={24} />
                    )}
                  </div>
                  <span className="text-sm font-black text-white">
                    {settings.siteName || 'فهمني'}
                  </span>
                </div>
                <div className="flex gap-3 text-[10px] text-gray-500 font-bold">
                  <span>الرئيسية</span>
                  <span>كورساتي</span>
                  <span>الملف الشخصي</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full space-y-4">
            <div>
              <div className="text-3xl font-black text-white font-display mb-1">
                {settings.siteName}
              </div>
              <div className="text-brand-yellow font-bold text-sm">{settings.tagline}</div>
            </div>
            <div className="p-5 bg-white/5 rounded-2xl border border-white/10 text-xs text-gray-400 leading-relaxed">
              هذه المعاينة توضح كيف سيظهر اسم الموقع واللوجو في شريط التنقل والصفحات الرئيسية. تذكر
              استخدام لوجو شفاف (PNG أو SVG) بدون خلفية ملونة للحصول على مظهر احترافي للغاية.
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 🎯 Featured Courses for Landing Page                       */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-8 space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <GraduationCap size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white font-display">كورسات صفحة الهبوط</h2>
              <p className="text-xs text-gray-500 font-bold">تحكم في الكورسات التي تظهر للزوار في الصفحة الرئيسية</p>
            </div>
          </div>

          {/* Toggle: Show/Hide Courses Section on Landing */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-400">
              {showSuggestedCourses ? 'مفعّل' : 'معطّل'}
            </span>
            <button
              type="button"
              onClick={() => setShowSuggestedCourses(!showSuggestedCourses)}
              className={`w-14 h-7 rounded-full relative transition-all duration-300 cursor-pointer ${
                showSuggestedCourses ? 'bg-emerald-500' : 'bg-gray-700'
              }`}
            >
              <div
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-md ${
                  showSuggestedCourses ? 'left-7.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {showSuggestedCourses && (
          <>
            <div className="w-full h-px bg-white/5" />

            {/* Info hint */}
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex items-start gap-3">
              <BookOpen size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400 font-bold leading-relaxed">
                اختر الكورسات التي تريد عرضها في صفحة الهبوط. إذا لم تحدد أي كورس، سيتم عرض أول 8 كورسات تلقائياً.
                <span className="text-emerald-400 font-black"> الكورسات المحددة ({featuredCourseIds.length})</span>
              </p>
            </div>

            {/* Courses Grid */}
            {loadingCourses ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw size={24} className="animate-spin text-emerald-400" />
                <span className="text-sm text-gray-400 font-bold mr-3">جاري تحميل الكورسات...</span>
              </div>
            ) : allCourses.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">لا توجد كورسات حالياً</p>
                <p className="text-xs mt-1">أنشئ كورساً جديداً من صفحة الكورسات أولاً.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Select All / Deselect All */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-bold">
                    {allCourses.length} كورس متوفر
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFeaturedCourseIds(allCourses.map(c => c.id))}
                      className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                    >
                      تحديد الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeaturedCourseIds([])}
                      className="text-[10px] font-black text-gray-400 hover:text-white px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>

                {/* Courses List */}
                <div className="grid gap-2.5">
                  {allCourses.map((course: any) => {
                    const isSelected = featuredCourseIds.includes(course.id);
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => {
                          setFeaturedCourseIds(prev =>
                            isSelected
                              ? prev.filter(id => id !== course.id)
                              : [...prev, course.id]
                          );
                        }}
                        className={`w-full text-right p-4 rounded-2xl border transition-all flex items-center gap-4 group ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/30 shadow-md shadow-emerald-500/5'
                            : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.03]'
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all border ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-400 text-white'
                              : 'bg-white/5 border-white/10 text-gray-600 group-hover:border-white/20'
                          }`}
                        >
                          {isSelected && <Check size={16} />}
                        </div>

                        {/* Course Thumbnail */}
                        {course.thumbnailUrl || course.imageUrl ? (
                          <img
                            src={course.thumbnailUrl || course.imageUrl}
                            alt={course.title}
                            className="w-14 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            <BookOpen size={16} className="text-gray-600" />
                          </div>
                        )}

                        {/* Course Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-black truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                            {course.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {course.price !== undefined && (
                              <span className="text-[10px] font-bold text-gray-500">
                                {course.price > 0 ? `${course.price} ج.م` : 'مجاني'}
                              </span>
                            )}
                            {course.status && (
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                course.status === 'published'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                              }`}>
                                {course.status === 'published' ? 'منشور' : 'مسودة'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Visual indicator */}
                        {isSelected && (
                          <div className="text-emerald-400">
                            <Check size={18} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};
