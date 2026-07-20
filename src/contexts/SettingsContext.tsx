import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { applyFruitTheme, DEFAULT_FRUIT } from '../constants/fruitThemes';
import type { FruitId } from '../constants/fruitThemes';
import { useTenant } from './TenantContext';
import { useRef } from 'react';
import { FALLBACKS } from '../constants/fallbacks';

export interface SiteSettings {
  siteName: string;
  tagline: string;
  logoUrl: string;
  seoDescription: string;
  platformMode?: 'single' | 'academy';
  vodafoneCashNumber?: string;
  instapayAddress?: string;
  // Add teacher settings
  teacherName?: string;
  displayName?: string;
  teacherTitle?: string;
  teacherPhotoUrl?: string;
  teacherBio?: string;
  subject?: string;
  // Add contact settings
  whatsapp?: string;
  facebook?: string;
  telegram?: string;
  youtube?: string;
  instagram?: string;
  tiktok?: string;
  contactUsUrl?: string;
  supportPhone?: string;
  hideGradeSelection?: boolean;
  studentGuideVideoUrl?: string;
  teacherGuideVideoUrl?: string;
  showStudentGuide?: boolean;
  showTeacherGuide?: boolean;
  useFreeImageHosting?: boolean;
  imgbbApiKey?: string;
  useFreeFileHosting?: boolean;
  welcomeImageUrl?: string;
  welcomeTitle?: string;
  welcomeDescription?: string;
  removeTeacherPhotoBg?: boolean;
  fruitTheme?: FruitId;
  showSuggestedCourses?: boolean;
  featuredCourseIds?: string[];
  heroTitle1?: string;
  heroTitle2?: string;
  heroTitle3?: string;
  heroDescription?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

interface SettingsContextType {
  settings: SiteSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<SiteSettings>) => void;
}

const defaultSettings: SiteSettings = {
  siteName: 'فهمني',
  tagline: 'تعلم ببساطة',
  logoUrl: '',
  seoDescription: ''
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: true,
  updateSettings: () => {}
});

export const useSettings = () => useContext(SettingsContext);

const CACHE_KEY = 'fahmni_site_settings';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in ms

interface CachedSettings {
  data: SiteSettings;
  timestamp: number;
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenantData } = useTenant();
  const [settings, setSettings] = useState<SiteSettings>({
    siteName: FALLBACKS.SITE_NAME,
    tagline: FALLBACKS.TAGLINE,
    logoUrl: FALLBACKS.LOGO_URL,
    seoDescription: ''
  });
  const [loading, setLoading] = useState(true);
  const tenantFruitRef = useRef(tenantData?.fruitTheme);
  const tenantDataRef = useRef(tenantData);

  useEffect(() => {
    tenantDataRef.current = tenantData;
  }, [tenantData]);

  useEffect(() => {
    tenantFruitRef.current = tenantData?.fruitTheme;
    if (tenantData?.fruitTheme) {
       setSettings(prev => {
         const newSet = { ...prev, fruitTheme: tenantData.fruitTheme as FruitId };
         applyFruitTheme(tenantData.fruitTheme as FruitId);
         return newSet;
       });
    }
  }, [tenantData?.fruitTheme]);

  useEffect(() => {
    if (tenantData) {
      setSettings(prev => {
        const siteName = tenantData.name || prev.siteName || FALLBACKS.SITE_NAME;
        const logoUrl = tenantData.logo || prev.logoUrl || FALLBACKS.LOGO_URL;
        const welcomeTitle = tenantData.slogan || prev.welcomeTitle;
        const welcomeImageUrl = tenantData.heroImage || prev.welcomeImageUrl || '';
        const platformMode = tenantData.platformMode || prev.platformMode || 'single';
        const vodafoneCashNumber = tenantData.vodafoneCashNumber || prev.vodafoneCashNumber;
        const instapayAddress = tenantData.instapayAddress || prev.instapayAddress;
        
        const teacherName = tenantData.teacherName || prev.teacherName || FALLBACKS.TEACHER_NAME;
        const teacherTitle = tenantData.teacherTitle || prev.teacherTitle || FALLBACKS.TEACHER_TITLE;
        const teacherPhotoUrl = tenantData.teacherPhoto || prev.teacherPhotoUrl || FALLBACKS.TEACHER_PHOTO;
        const teacherBio = tenantData.teacherBio || prev.teacherBio || '';
        const subject = tenantData.subject || prev.subject || '';

        const whatsapp = tenantData.whatsapp !== undefined ? tenantData.whatsapp : prev.whatsapp || '';
        const facebook = tenantData.facebook !== undefined ? tenantData.facebook : prev.facebook || '';
        const telegram = tenantData.telegram !== undefined ? tenantData.telegram : prev.telegram || '';
        const youtube = tenantData.youtube !== undefined ? tenantData.youtube : prev.youtube || '';
        const instagram = tenantData.instagram !== undefined ? tenantData.instagram : prev.instagram || '';
        const tiktok = tenantData.tiktok !== undefined ? tenantData.tiktok : prev.tiktok || '';
        
        const showSuggestedCourses = tenantData.showSuggestedCourses !== undefined ? tenantData.showSuggestedCourses : prev.showSuggestedCourses;
        const featuredCourseIds = tenantData.featuredCourseIds || prev.featuredCourseIds || [];

        const updated = {
          ...prev,
          siteName,
          logoUrl,
          vodafoneCashNumber,
          instapayAddress,
          displayName: teacherName,
          teacherName,
          teacherTitle,
          teacherPhotoUrl,
          teacherBio,
          subject,
          whatsapp,
          facebook,
          telegram,
          youtube,
          instagram,
          tiktok,
          platformMode,
          showSuggestedCourses,
          featuredCourseIds,
          welcomeTitle,
          welcomeImageUrl,
          welcomeDescription: tenantData.welcomeDescription || prev.welcomeDescription,
          studentGuideVideoUrl: tenantData.studentGuideVideoUrl !== undefined ? tenantData.studentGuideVideoUrl : prev.studentGuideVideoUrl,
          teacherGuideVideoUrl: tenantData.teacherGuideVideoUrl !== undefined ? tenantData.teacherGuideVideoUrl : prev.teacherGuideVideoUrl,
          showStudentGuide: tenantData.showStudentGuide !== undefined ? tenantData.showStudentGuide : prev.showStudentGuide,
          showTeacherGuide: tenantData.showTeacherGuide !== undefined ? tenantData.showTeacherGuide : prev.showTeacherGuide,
          removeTeacherPhotoBg: tenantData.removeTeacherPhotoBg !== undefined ? tenantData.removeTeacherPhotoBg : prev.removeTeacherPhotoBg,
          useFreeImageHosting: tenantData.useFreeImageHosting !== undefined ? tenantData.useFreeImageHosting : prev.useFreeImageHosting,
          imgbbApiKey: tenantData.imgbbApiKey !== undefined ? tenantData.imgbbApiKey : prev.imgbbApiKey,
          useFreeFileHosting: tenantData.useFreeFileHosting !== undefined ? tenantData.useFreeFileHosting : prev.useFreeFileHosting,
        };

        // Persist to localStorage cache immediately so it stays in sync
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: updated, timestamp: Date.now() }));
        } catch (e) {
          console.warn("Error updating settings cache from tenantData:", e);
        }

        return updated;
      });
    }
  }, [tenantData]);

  const updateSettings = useCallback((newSettings: Partial<SiteSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      // Update cache
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: updated, timestamp: Date.now() }));
      } catch (e) {
        console.warn("Error updating settings cache:", e);
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      // 1. Try to load from localStorage cache first
      try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
          const cached: CachedSettings = JSON.parse(cachedStr);
          if (Date.now() - cached.timestamp < CACHE_TTL) {
            setSettings(cached.data);
            setLoading(false);
            
            // Background fetch to silently update the cache
            fetchFromFirestoreSilently();
            return;
          }
        }
      } catch (e) {
        console.warn("Error reading settings cache:", e);
      }

      // 2. Fetch from Firestore if no valid cache
      await fetchFromFirestore();
    };

    const mergeSettings = (
      prev: SiteSettings,
      globalData: any,
      teacherData: any,
      socialData: any,
      configData: any,
      welcomeData: any,
      brandingData: any
    ): SiteSettings => {
      // Prioritize tenantData from Super Admin over the local tenant DB
      const siteName = tenantDataRef.current?.name || globalData.siteName || FALLBACKS.SITE_NAME;
      const logoUrl = tenantDataRef.current?.logo || globalData.logoUrl || FALLBACKS.LOGO_URL;
      const welcomeTitle = tenantDataRef.current?.slogan || welcomeData.welcomeTitle || prev.welcomeTitle;
      const welcomeImageUrl = tenantDataRef.current?.heroImage || welcomeData.welcomeImageUrl || '';
      const platformMode = tenantDataRef.current?.platformMode || configData.platformMode || 'single';
      const vodafoneCashNumber = tenantDataRef.current?.vodafoneCashNumber || globalData.vodafoneCashNumber || '';
      const instapayAddress = tenantDataRef.current?.instapayAddress || globalData.instapayAddress || '';
      
      const teacherName = tenantDataRef.current?.teacherName || teacherData.teacherName || teacherData.displayName || FALLBACKS.TEACHER_NAME;
      const teacherTitle = tenantDataRef.current?.teacherTitle || teacherData.teacherTitle || FALLBACKS.TEACHER_TITLE;
      const teacherPhotoUrl = tenantDataRef.current?.teacherPhoto || teacherData.teacherPhotoUrl || FALLBACKS.TEACHER_PHOTO;
      const teacherBio = tenantDataRef.current?.teacherBio || teacherData.teacherBio || '';
      const subject = tenantDataRef.current?.subject || teacherData.subject || '';

      const whatsapp = tenantDataRef.current?.whatsapp !== undefined ? tenantDataRef.current.whatsapp : socialData?.whatsapp || '';
      const facebook = tenantDataRef.current?.facebook !== undefined ? tenantDataRef.current.facebook : socialData?.facebook || '';
      const telegram = tenantDataRef.current?.telegram !== undefined ? tenantDataRef.current.telegram : socialData?.telegram || '';
      const youtube = tenantDataRef.current?.youtube !== undefined ? tenantDataRef.current.youtube : socialData?.youtube || '';
      const instagram = tenantDataRef.current?.instagram !== undefined ? tenantDataRef.current.instagram : socialData?.instagram || '';
      const tiktok = tenantDataRef.current?.tiktok !== undefined ? tenantDataRef.current.tiktok : socialData?.tiktok || '';
      
      const showSuggestedCourses = tenantDataRef.current?.showSuggestedCourses !== undefined ? tenantDataRef.current.showSuggestedCourses : configData?.showSuggestedCourses;
      const featuredCourseIds = tenantDataRef.current?.featuredCourseIds || configData?.featuredCourseIds || [];

      const tenantFruit = tenantFruitRef.current;
      let fruitTheme = brandingData.fruitTheme || undefined;
      if (tenantFruit) {
        fruitTheme = tenantFruit;
      }
      if (fruitTheme) {
        applyFruitTheme(fruitTheme as FruitId);
      }

      return {
        ...prev,
        siteName,
        tagline: globalData.tagline || FALLBACKS.TAGLINE,
        logoUrl,
        seoDescription: globalData.seoDescription || '',
        vodafoneCashNumber,
        instapayAddress,
        
        displayName: teacherName,
        teacherName,
        teacherTitle,
        teacherPhotoUrl,
        teacherBio,
        subject,
        
        ...socialData,
        whatsapp,
        facebook,
        telegram,
        youtube,
        instagram,
        tiktok,
        
        ...configData,
        platformMode,
        hideGradeSelection: configData.hideGradeSelection === true,
        studentGuideVideoUrl: tenantDataRef.current?.studentGuideVideoUrl !== undefined ? tenantDataRef.current.studentGuideVideoUrl : (configData.studentGuideVideoUrl || ''),
        teacherGuideVideoUrl: tenantDataRef.current?.teacherGuideVideoUrl !== undefined ? tenantDataRef.current.teacherGuideVideoUrl : (configData.teacherGuideVideoUrl || ''),
        showStudentGuide: tenantDataRef.current?.showStudentGuide !== undefined ? tenantDataRef.current.showStudentGuide : (configData.showStudentGuide ?? true),
        showTeacherGuide: tenantDataRef.current?.showTeacherGuide !== undefined ? tenantDataRef.current.showTeacherGuide : (configData.showTeacherGuide ?? true),
        removeTeacherPhotoBg: tenantDataRef.current?.removeTeacherPhotoBg !== undefined ? tenantDataRef.current.removeTeacherPhotoBg : (configData.removeTeacherPhotoBg ?? false),
        useFreeImageHosting: tenantDataRef.current?.useFreeImageHosting !== undefined ? tenantDataRef.current.useFreeImageHosting : (configData.useFreeImageHosting ?? false),
        imgbbApiKey: tenantDataRef.current?.imgbbApiKey !== undefined ? tenantDataRef.current.imgbbApiKey : (configData.imgbbApiKey || ''),
        useFreeFileHosting: tenantDataRef.current?.useFreeFileHosting !== undefined ? tenantDataRef.current.useFreeFileHosting : (configData.useFreeFileHosting ?? false),
        showSuggestedCourses,
        featuredCourseIds,
        
        welcomeTitle,
        welcomeDescription: tenantDataRef.current?.welcomeDescription || welcomeData.welcomeDescription || prev.welcomeDescription,
        welcomeImageUrl,
        
        fruitTheme: fruitTheme as FruitId
      };
    };

    const saveToCache = (data: SiteSettings) => {
      try {
        const cacheObj: CachedSettings = {
          data,
          timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
      } catch (e) {
        console.warn("Failed to write settings to cache:", e);
      }
    };

    function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms)
        )
      ]);
    }

    const fetchFromFirestore = async () => {
      try {
        const timeoutMs = 4000;
        const results = await Promise.allSettled([
          withTimeout(getDoc(doc(db, 'siteSettings', 'global')), timeoutMs, 'global'),
          withTimeout(getDoc(doc(db, 'siteSettings', 'teacher')), timeoutMs, 'teacher'),
          withTimeout(getDoc(doc(db, 'settings', 'social_links')), timeoutMs, 'social'),
          withTimeout(getDoc(doc(db, 'platform_config', 'settings')), timeoutMs, 'config'),
          withTimeout(getDoc(doc(db, 'settings', 'welcome_page')), timeoutMs, 'welcome'),
          withTimeout(getDoc(doc(db, 'platform_config', 'branding')), timeoutMs, 'branding')
        ]);

        const globalSnap = results[0].status === 'fulfilled' ? results[0].value : null;
        const teacherSnap = results[1].status === 'fulfilled' ? results[1].value : null;
        const socialSnap = results[2].status === 'fulfilled' ? results[2].value : null;
        const configSnap = results[3].status === 'fulfilled' ? results[3].value : null;
        const welcomeSnap = results[4].status === 'fulfilled' ? results[4].value : null;
        const brandingSnap = results[5].status === 'fulfilled' ? results[5].value : null;

        setSettings(prev => {
          const merged = mergeSettings(
            prev,
            globalSnap && globalSnap.exists() ? globalSnap.data() : {},
            teacherSnap && teacherSnap.exists() ? teacherSnap.data() : {},
            socialSnap && socialSnap.exists() ? socialSnap.data() : {},
            configSnap && configSnap.exists() ? configSnap.data() : {},
            welcomeSnap && welcomeSnap.exists() ? welcomeSnap.data() : {},
            brandingSnap && brandingSnap.exists() ? brandingSnap.data() : {}
          );
          saveToCache(merged);
          return merged;
        });
      } catch (error) {
        console.error("Error fetching site settings from Firestore:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchFromFirestoreSilently = async () => {
      try {
        const timeoutMs = 4000;
        const results = await Promise.allSettled([
          withTimeout(getDoc(doc(db, 'siteSettings', 'global')), timeoutMs, 'global'),
          withTimeout(getDoc(doc(db, 'siteSettings', 'teacher')), timeoutMs, 'teacher'),
          withTimeout(getDoc(doc(db, 'settings', 'social_links')), timeoutMs, 'social'),
          withTimeout(getDoc(doc(db, 'platform_config', 'settings')), timeoutMs, 'config'),
          withTimeout(getDoc(doc(db, 'settings', 'welcome_page')), timeoutMs, 'welcome'),
          withTimeout(getDoc(doc(db, 'platform_config', 'branding')), timeoutMs, 'branding')
        ]);

        const globalSnap = results[0].status === 'fulfilled' ? results[0].value : null;
        const teacherSnap = results[1].status === 'fulfilled' ? results[1].value : null;
        const socialSnap = results[2].status === 'fulfilled' ? results[2].value : null;
        const configSnap = results[3].status === 'fulfilled' ? results[3].value : null;
        const welcomeSnap = results[4].status === 'fulfilled' ? results[4].value : null;
        const brandingSnap = results[5].status === 'fulfilled' ? results[5].value : null;

        setSettings(prev => {
          const merged = mergeSettings(
            prev,
            globalSnap && globalSnap.exists() ? globalSnap.data() : {},
            teacherSnap && teacherSnap.exists() ? teacherSnap.data() : {},
            socialSnap && socialSnap.exists() ? socialSnap.data() : {},
            configSnap && configSnap.exists() ? configSnap.data() : {},
            welcomeSnap && welcomeSnap.exists() ? welcomeSnap.data() : {},
            brandingSnap && brandingSnap.exists() ? brandingSnap.data() : {}
          );
          saveToCache(merged);
          return merged;
        });
      } catch (error) {
        console.error("Error silently fetching site settings:", error);
      }
    };

    fetchSettings();
  }, []);

  const contextValue = useMemo(() => ({ settings, loading, updateSettings }), [settings, loading, updateSettings]);

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};
