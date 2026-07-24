import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FRUIT_LIST } from '../../constants/fruitThemes';
import type { FruitId } from '../../constants/fruitThemes';
import { masterDb } from '../../lib/firebase';
import JSZip from 'jszip';
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc, getFirestore, writeBatch } from 'firebase/firestore';
import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getStorage, ref as storageRef, deleteObject } from 'firebase/storage';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  Settings,
  CheckCircle2,
  X,
  Database,
  Shield,
  Zap,
  Lock,
  KeyRound,
  Users,
  Activity,
  Upload,
  Loader2,
  LogOut,
  Layout,
  BookOpen,
  Check,
  ExternalLink,
  Trash2,
  Edit3,
  Globe,
  Eye,
  EyeOff,
  ChevronLeft,
  Palette,
  UserCircle,
  Share2,
  SlidersHorizontal,
  FileText,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { compressImage, removeWhiteBgFromBase64 } from '../../utils/imageCompression';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  package: string;
  firebaseConfig: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  loyaltySystem: boolean;
  customSubdomain: boolean;
  slogan?: string;
  logo?: string;
  primaryColor?: string;
  fruitTheme?: string;
  platformMode?: 'single' | 'academy';
  educationStage?: string;
  showSuggestedCourses?: boolean;
  teacherName?: string;
  teacherTitle?: string;
  teacherPhoto?: string;
  teacherBio?: string;
  heroImage?: string;
  subject?: string;
  welcomeDescription?: string;
  whatsapp?: string;
  facebook?: string;
  youtube?: string;
  telegram?: string;
  instagram?: string;
  tiktok?: string;
  hideMotherPhone?: boolean;
  hideFatherPhone?: boolean;
  hideSchoolName?: boolean;
  featuredCourseIds?: string[];
  heroTitle1?: string;
  heroTitle2?: string;
  heroTitle3?: string;
  heroDescription?: string;
  removeTeacherPhotoBg?: boolean;
  vodafoneCashNumber?: string;
  instapayAddress?: string;
  customDomain?: string;
  isStandalone?: boolean;
  createdAt: any;
}

type TabId = 'basics' | 'branding' | 'landing' | 'teacher' | 'social' | 'controls' | 'standalone';

export const SuperAdminDashboard = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<TabId>('basics');
  const [saving, setSaving] = useState(false);

  // Password gate state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [correctPassword, setCorrectPassword] = useState('12345');
  const [loadingPassword, setLoadingPassword] = useState(true);
  const passwordInputRef = React.useRef<HTMLInputElement>(null);

  // Change password modal states
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Storage monitoring states
  const [selectedStorageTenant, setSelectedStorageTenant] = useState<Tenant | null>(null);
  const [fetchingStorage, setFetchingStorage] = useState(false);
  const [clearingStorage, setClearingStorage] = useState(false);
  const [storageStats, setStorageStats] = useState<{
    totalSubmissions: number;
    firebaseFiles: number;
    externalLinks: number;
    estimatedSpaceMB: number;
  } | null>(null);

  // Standalone release publisher & exporter states
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [releaseVersion, setReleaseVersion] = useState('v2.5.0');
  const [releaseNotes, setReleaseNotes] = useState('تحديث شامل لنظام الحضور الذكي بالـ QR، زيادة سرعة الماسح، وإصلاح إحصائيات المجموعات وربط الدومينات الخاصة.');
  const [releaseZipUrl, setReleaseZipUrl] = useState('');
  const [publishingRelease, setPublishingRelease] = useState(false);
  const [exporterTenant, setExporterTenant] = useState<Tenant | null>(null);
  const [tenantFilter, setTenantFilter] = useState<'all' | 'saas' | 'standalone'>('all');
  const [generatingZip, setGeneratingZip] = useState(false);

  const downloadCompleteZipBundle = async (tenant: Tenant) => {
    setGeneratingZip(true);
    try {
      const res = await fetch('/api/export-standalone-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tenant)
      });
      if (!res.ok) {
        let errMsg = res.statusText;
        try {
          const errJson = await res.json();
          if (errJson?.error) errMsg = errJson.error;
        } catch (e) {}
        throw new Error(`فشل استخراج ملفات المنصة (${errMsg})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fahmni_standalone_${tenant.subdomain}_full_bundle.zip`;
      a.click();
      URL.revokeObjectURL(url);
      alert(`🎉 تم إنشاء وتنزيل حزمة المنصة المكتملة المجهزة بالكامل (${tenant.name}) بنجاح! تحتوي الحزمة على كافة الأصول والملفات المترجمة، وجاهزة للرفع المباشر على Vercel أو Hostinger أو Netlify.`);
    } catch (err: any) {
      console.error('ZIP generation error:', err);
      alert('حدث خطأ أثناء إنشاء حزمة ZIP: ' + err.message);
    } finally {
      setGeneratingZip(false);
    }
  };

  const downloadSqlMigration = async (tenant: Tenant) => {
    try {
      const res = await fetch('/api/generate-tenant-sql-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant, subdomain: tenant.subdomain })
      });
      if (!res.ok) throw new Error('فشل توليد ملف هجرة SQL');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fahmni_tenant_${tenant.subdomain}_migration.sql`;
      a.click();
      URL.revokeObjectURL(url);
      alert('🎉 تم توليد وتنزيل ملف استيراد SQL بنجاح! يمكن وضعه في MySQL على Hostinger أو Vercel Postgres.');
    } catch (err: any) {
      alert('خطأ في توليد ملف SQL: ' + err.message);
    }
  };

  const generateStandaloneGuide = (tenant: Tenant) => {
    return `# 🚀 دليل استضافة وتشغيل المنصة المستقلة للمعلم: ${tenant.name}
تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}
الدومين المستهدف: ${tenant.customDomain || tenant.subdomain + '.fahmni.me'}

---

## 📌 الخطوة 1: تجهيز ملف البيئة (.env)
تأكد من وجود ملف \`.env\` في المجلد الرئيسي للمشروع وتحقّق من تضمين البيانات التالية:

\`\`\`env
VITE_TENANT_ID=${tenant.subdomain}
VITE_CUSTOM_DOMAIN=${tenant.customDomain || tenant.subdomain + '.fahmni.me'}
VITE_FIREBASE_CONFIG='${tenant.firebaseConfig || ''}'
VITE_SUPABASE_URL=${tenant.supabaseUrl || ''}
VITE_SUPABASE_ANON_KEY=${tenant.supabaseAnonKey || ''}
VITE_STANDALONE_MODE=true
\`\`\`

---

## 📌 الخطوة 2: الخيارات المتاحة للاستضافة (Deployment Options)

### 1️⃣ الاستضافة على Hostinger / CPanel (استضافة مشتركة)
1. قم بتشغيل الأمر \`npm run build\` على جهازك لتوليد مجلد الإنتاج \`dist\`.
2. قم بضغط محتويات مجلد \`dist\` في ملف ZIP.
3. افتح لوحة تحكم CPanel أو Hostinger واذهب إلى **File Manager -> public_html**.
4. ارفع محتويات المجلد داخل \`public_html\`.
5. أنشئ ملف باسم \`.htaccess\` وضع به الكود التالي لضمان عمل الروابط بشكل صحيح (SPA Rewrite):

\`\`\`apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
\`\`\`

---

### 2️⃣ الاستضافة المجانية أو السحابية على Vercel / Netlify / Cloudflare Pages
1. قم برفع كود المشروع على حساب GitHub الخاص بك.
2. افتح [Vercel](https://vercel.com) أو [Netlify](https://netlify.com) واختيار **Import Project**.
3. أضف المتغيرات الموجودة بملف \`.env\` في قسم **Environment Variables**.
4. اضغط **Deploy** وسيتم تشغيل المنصة في ثوانٍ!

---

### 3️⃣ الاستضافة على سيرفر خاص (VPS / Nginx)
1. ثبت Node.js و Nginx على السيرفر.
2. قم بعمل \`npm run build\` ثم تشغيل سيرفر المعاينة بواسطة Nginx:

\`\`\`nginx
server {
    listen 80;
    server_name ${tenant.customDomain || tenant.subdomain + '.fahmni.me'};

    location / {
        root /var/www/fahmni/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
\`\`\`

---

🎉 **تهانينا! منصة ${tenant.name} الآن تعمل بحريّة كاملة وعلى استضافتك الخاصة!**
`;
  };

  const downloadEnvFile = (tenant: Tenant) => {
    const envContent = `# =======================================================
# Standalone Environment Config for Tenant: ${tenant.name}
# Subdomain / ID: ${tenant.subdomain}
# Custom Domain: ${tenant.customDomain || tenant.subdomain + '.fahmni.me'}
# Generated Date: ${new Date().toLocaleString('ar-EG')}
# =======================================================

VITE_TENANT_ID=${tenant.subdomain}
VITE_CUSTOM_DOMAIN=${tenant.customDomain || tenant.subdomain + '.fahmni.me'}
VITE_FIREBASE_CONFIG=${tenant.firebaseConfig || ''}
VITE_SUPABASE_URL=${tenant.supabaseUrl || ''}
VITE_SUPABASE_ANON_KEY=${tenant.supabaseAnonKey || ''}
VITE_STANDALONE_MODE=true
`;
    const blob = new Blob([envContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `.env`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFirebaseJson = (tenant: Tenant) => {
    let jsonStr = tenant.firebaseConfig || '{}';
    try {
      jsonStr = JSON.stringify(JSON.parse(tenant.firebaseConfig), null, 2);
    } catch (e) {}
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firebase-applet-config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadDeploymentGuide = (tenant: Tenant) => {
    const guideText = generateStandaloneGuide(tenant);
    const blob = new Blob([guideText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DEPLOYMENT_GUIDE_${tenant.subdomain}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExportScript = (tenant: Tenant) => {
    const scriptContent = `@echo off
echo =======================================================
echo  Publishing & Exporting Standalone Package: ${tenant.name}
echo =======================================================
echo.
echo 1. Cleaning past builds...
call npm run clean 2>nul
echo 2. Building production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Check console errors.
    pause
    exit /b %errorlevel%
)
echo.
echo 3. Packaging dist directory into standalone ZIP...
powershell -Command "Compress-Archive -Path dist/* -DestinationPath standalone-bundle-${tenant.subdomain}.zip -Force"
echo.
echo [SUCCESS] Package created successfully: standalone-bundle-${tenant.subdomain}.zip
pause
`;
    const blob = new Blob([scriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-standalone-${tenant.subdomain}.bat`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportStandalonePackage = (tenant: Tenant) => {
    const envContent = `# =======================================================
# Standalone Environment Config for Tenant: ${tenant.name}
# Subdomain / ID: ${tenant.subdomain}
# Custom Domain: ${tenant.customDomain || tenant.subdomain + '.fahmni.me'}
# Generated Date: ${new Date().toLocaleString('ar-EG')}
# =======================================================

VITE_TENANT_ID=${tenant.subdomain}
VITE_CUSTOM_DOMAIN=${tenant.customDomain || tenant.subdomain + '.fahmni.me'}
VITE_FIREBASE_CONFIG=${tenant.firebaseConfig || ''}
VITE_SUPABASE_URL=${tenant.supabaseUrl || ''}
VITE_SUPABASE_ANON_KEY=${tenant.supabaseAnonKey || ''}
VITE_STANDALONE_MODE=true
`;

    const blob = new Blob([envContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `standalone-config-${tenant.subdomain}.env`;
    a.click();
    URL.revokeObjectURL(url);
    alert(`✅ تم تصدير حزمة إعدادات المنصة المستقلة (${tenant.name}) بنجاح!`);
  };

  const handlePublishRelease = async () => {
    if (!releaseVersion || !releaseNotes) {
      alert('يرجى إدخال رقم الإصدار وملاحظات التحديث');
      return;
    }
    setPublishingRelease(true);
    const releaseData = {
      version: releaseVersion,
      notes: releaseNotes,
      zipUrl: releaseZipUrl,
      publishedAt: new Date().toISOString(),
    };

    // 1. Always store locally in release cache
    try {
      localStorage.setItem('latest_system_release', JSON.stringify(releaseData));
      localStorage.setItem('system_release_' + releaseVersion.replace(/\./g, '_'), JSON.stringify(releaseData));
    } catch (e) {
      console.warn('LocalStorage release cache info:', e);
    }

    // 2. Save release info to Firestore
    try {
      await setDoc(doc(masterDb, 'system_releases', releaseVersion.replace(/\./g, '_')), releaseData, { merge: true });
      await setDoc(doc(masterDb, 'system_releases', 'latest'), releaseData, { merge: true });
    } catch (err: any) {
      console.warn('Firestore release write notice:', err);
    }

    alert(`🚀 تم نشر وتطبيق التحديث (${releaseVersion}) بنجاح لجميع المنصات المستقلة!`);
    setIsReleaseModalOpen(false);
    setPublishingRelease(false);
  };

  const getTenantFirebaseApp = (tenant: Tenant) => {
    if (!tenant.firebaseConfig) return null;
    try {
      let config: any;
      if (typeof tenant.firebaseConfig === 'object') {
        config = tenant.firebaseConfig;
      } else {
        let cleaned = tenant.firebaseConfig.trim();
        
        // If they pasted the entire "const firebaseConfig = { ... };" code block, extract only the object part
        if (cleaned.includes('{')) {
          const startIdx = cleaned.indexOf('{');
          const endIdx = cleaned.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
            cleaned = cleaned.substring(startIdx, endIdx + 1);
          }
        }
        
        // Try parsing using safe evaluation (handles unquoted keys, single quotes, trailing commas)
        try {
          config = new Function(`return ${cleaned};`)();
        } catch (evalErr) {
          console.warn('Failed evaluation parsing, attempting standard JSON parse:', evalErr);
          config = JSON.parse(cleaned);
        }
      }

      if (!config || !config.apiKey || !config.projectId) {
        console.error('Invalid firebase config structure:', config);
        return null;
      }

      const appName = `tenant_app_${tenant.id}`;
      const apps = getApps();
      const existing = apps.find(app => app.name === appName);
      if (existing) return existing;
      return initializeApp(config, appName);
    } catch (err) {
      console.error('Failed to init dynamic firebase app:', err);
      return null;
    }
  };

  const fetchStorageStats = async (tenant: Tenant) => {
    setFetchingStorage(true);
    setStorageStats(null);
    try {
      const app = getTenantFirebaseApp(tenant);
      if (!app) {
        alert('حدث خطأ: تعذر تهيئة الاتصال ببيانات المنصة.');
        setFetchingStorage(false);
        return;
      }
      const tenantDb = getFirestore(app);
      // Query submissions
      const submissionsSnap = await getDocs(collection(tenantDb, 'submissions'));
      const submissions = submissionsSnap.docs.map(doc => doc.data());
      
      let firebaseCount = 0;
      let externalCount = 0;
      
      submissions.forEach(sub => {
        const url = sub.solutionUrl || '';
        if (url.startsWith('https://firebasestorage')) {
          firebaseCount++;
        } else if (url) {
          externalCount++;
        }
      });
      
      // Calculate estimated space: average 1.5MB per Firebase storage file
      const estSpace = firebaseCount * 1.5;
      
      setStorageStats({
        totalSubmissions: submissions.length,
        firebaseFiles: firebaseCount,
        externalLinks: externalCount,
        estimatedSpaceMB: estSpace
      });
    } catch (err: any) {
      console.error('Failed to fetch storage stats:', err);
      alert('فشل جلب إحصائيات التخزين: ' + err.message);
    } finally {
      setFetchingStorage(false);
    }
  };

  const handleResetStorageAndCycle = async (tenant: Tenant) => {
    if (!window.confirm(`⚠️ تحذير هام جداً:
هل أنت متأكد من رغبتك في حذف جميع واجبات الطلاب المرفوعة لهذا العام الدراسي وتصفير سعة التخزين؟
هذا الإجراء سيقوم بحذف الملفات السحابية تماماً وتصفير التخزين لبدء دورة دراسية جديدة ولا يمكن التراجع عنه.`)) {
      return;
    }

    setClearingStorage(true);
    try {
      const app = getTenantFirebaseApp(tenant);
      if (!app) {
        alert('حدث خطأ في الاتصال بالمنصة.');
        setClearingStorage(false);
        return;
      }
      
      const tenantDb = getFirestore(app);
      const tenantStorage = getStorage(app);
      
      // 1. Fetch all submissions
      const submissionsSnap = await getDocs(collection(tenantDb, 'submissions'));
      const docsToDelete = submissionsSnap.docs;
      
      let deletedFilesCount = 0;
      
      // 2. Delete files from Firebase Storage if hosted there
      for (const docSnap of docsToDelete) {
        const data = docSnap.data();
        const url = data.solutionUrl || '';
        
        if (url.startsWith('https://firebasestorage')) {
          try {
            const fileRef = storageRef(tenantStorage, url);
            await deleteObject(fileRef);
            deletedFilesCount++;
          } catch (deleteErr) {
            console.warn('Failed to delete storage file, continuing:', url, deleteErr);
          }
        }
      }
      
      // 3. Delete Firestore documents in batches
      const batchSize = 400;
      for (let i = 0; i < docsToDelete.length; i += batchSize) {
        const batch = writeBatch(tenantDb);
        const chunk = docsToDelete.slice(i, i + batchSize);
        chunk.forEach(snap => {
          batch.delete(snap.ref);
        });
        await batch.commit();
      }
      
      alert(`تمت العملية بنجاح!
- تم حذف عدد ${deletedFilesCount} ملف واجب من سيرفر التخزين.
- تم تصفير وحذف عدد ${docsToDelete.length} واجب للطلاب بنجاح.
- المنصة الآن جاهزة لبدء دورة دراسية جديدة بسعة 0 بايت!`);
      
      fetchStorageStats(tenant);
    } catch (err: any) {
      console.error('Failed to reset storage:', err);
      alert('فشل تصفير التخزين وبدء الدورة الجديدة: ' + err.message);
    } finally {
      setClearingStorage(false);
    }
  };


  const [isEditingLandingPage, setIsEditingLandingPage] = useState(false);
  const [landingPageSettings, setLandingPageSettings] = useState<any>({
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

  // Check if already authenticated from session, and fetch password from Firestore
  useEffect(() => {
    const checkAuth = async () => {
      // Check sessionStorage first
      if (sessionStorage.getItem('super_admin_auth') === 'true') {
        setIsAuthenticated(true);
      }
      // Fetch password from Firestore
      try {
        const passSnap = await getDoc(doc(masterDb, 'super_admin', 'config'));
        if (passSnap.exists() && passSnap.data().password) {
          setCorrectPassword(passSnap.data().password);
        }
      } catch (err) {
        console.error('Error fetching super admin config:', err);
      }
      setLoadingPassword(false);
    };
    checkAuth();
  }, []);

  // Focus password input
  useEffect(() => {
    if (!isAuthenticated && !loadingPassword) {
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  }, [isAuthenticated, loadingPassword]);

  // Fetch data only after authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchTenants();
      fetchLandingPageSettings();
    }
  }, [isAuthenticated]);

  const fetchLandingPageSettings = async () => {
    try {
      const docSnap = await getDoc(doc(masterDb, 'super_admin', 'landing_page'));
      if (docSnap.exists()) {
        setLandingPageSettings((prev: any) => ({ ...prev, ...docSnap.data() }));
      }
    } catch (err) {
      console.error('Error fetching landing page settings:', err);
    }
  };

  const saveLandingPageSettings = async () => {
    try {
      await setDoc(doc(masterDb, 'super_admin', 'landing_page'), landingPageSettings, {
        merge: true,
      });
      alert('تم حفظ إعدادات الصفحة الرئيسية بنجاح!');
      setIsEditingLandingPage(false);
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ الإعدادات: ' + err.message);
    }
  };

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(masterDb, 'tenants'));
      const data = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Tenant);
      setTenants(data);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        alert('تنبيه: قواعد Firestore تمنع قراءة العملاء (Permission Denied).');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveTenant = async (tenantData: Partial<Tenant>) => {
    if (!tenantData.subdomain) {
      alert('النطاق الفرعي مطلوب لأنه يمثل معرف العميل.');
      return;
    }
    const safeSubdomain = tenantData.subdomain
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '');
    const dataToSave = { ...tenantData };
    delete dataToSave.id;

    try {
      await setDoc(
        doc(masterDb, 'tenants', safeSubdomain),
        {
          ...dataToSave,
          subdomain: safeSubdomain,
          createdAt: tenantData.createdAt || new Date(),
        },
        { merge: true }
      );
      if (editingTenant && editingTenant.id && editingTenant.id !== safeSubdomain) {
        await deleteDoc(doc(masterDb, 'tenants', editingTenant.id));
      }
      fetchTenants();
      setEditingTenant(null);
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ: ' + err.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof Tenant) => {
    const file = e.target.files?.[0];
    if (!file || !editingTenant) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صحيح (PNG, JPG, SVG)');
      return;
    }

    setIsUploading((prev) => ({ ...prev, [field]: true }));
    try {
      const isLogo = field === 'logo';
      const isTeacherPhoto = field === 'teacherPhoto';
      const shouldRemoveBg = isLogo || (isTeacherPhoto && editingTenant.removeTeacherPhotoBg !== false);
      
      const maxWidth = isLogo ? 600 : 1200;
      const maxHeight = isLogo ? 600 : 1200;
      const quality = isLogo ? 0.6 : 0.8;

      const base64Url = await compressImage(file, maxWidth, maxHeight, quality, 'image/webp', shouldRemoveBg);
      setEditingTenant({ ...editingTenant, [field]: base64Url });
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('فشل رفع الصورة. الرجاء المحاولة مرة أخرى.');
    } finally {
      setIsUploading((prev) => ({ ...prev, [field]: false }));
    }
  };

  const renderImageField = (
    label: string,
    field: keyof Tenant,
    placeholder: string
  ) => {
    if (!editingTenant) return null;
    const value = (editingTenant[field] as string) || '';
    const isBase64 = value.startsWith('data:image/');

    return (
      <div className="space-y-2">
        <label className="text-xs text-gray-400 font-bold">{label}</label>
        <div className="flex gap-4 items-start">
          <label className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 hover:border-brand-blue/50 flex items-center justify-center overflow-hidden flex-shrink-0 relative group cursor-pointer transition-all">
            {value ? (
              <img src={value} alt={label} className="w-full h-full object-contain" />
            ) : (
              <span className="text-[10px] text-gray-500 font-bold text-center p-1">لا توجد صورة</span>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
              <Upload size={16} className="text-white" />
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageUpload(e, field)}
              disabled={isUploading[field]}
            />
          </label>

          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              {isBase64 ? (
                <div className="flex-1 flex items-center justify-between bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-emerald-400 text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    صورة مرفوعة بنجاح
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(value);
                        alert('تم نسخ نص الصورة بنجاح!');
                      }}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[10px] transition-colors"
                    >
                      نسخ
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTenant({ ...editingTenant, [field]: '' })}
                      className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] transition-colors"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ) : (
                <input
                  value={value}
                  onChange={(e) => setEditingTenant({ ...editingTenant, [field]: e.target.value })}
                  className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue text-left text-xs"
                  placeholder={placeholder}
                  dir="ltr"
                />
              )}

              <label className="flex-shrink-0 w-12 h-[46px] bg-brand-blue/10 hover:bg-brand-blue/20 border border-brand-blue/20 rounded-xl flex items-center justify-center cursor-pointer transition-colors relative">
                {isUploading[field] ? (
                  <Loader2 size={20} className="animate-spin text-brand-blue" />
                ) : (
                  <Upload size={20} className="text-brand-blue" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, field)}
                  disabled={isUploading[field]}
                />
              </label>
            </div>

            {value && !isBase64 && (
              <button
                type="button"
                onClick={() => setEditingTenant({ ...editingTenant, [field]: '' })}
                className="text-[10px] text-red-400 hover:underline font-bold"
              >
                إزالة الرابط الحالي
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const openNewTenantModal = () => {
    setActiveTab('basics');
    setEditingTenant({
      id: '',
      name: 'منصة جديدة',
      subdomain: '',
      package: 'الباقة الأساسية',
      firebaseConfig: '',
      loyaltySystem: false,
      customSubdomain: true,
      slogan: 'عد إلى رحلتك التعليمية الممتعة',
      primaryColor: '#2563eb',
      fruitTheme: '',
      platformMode: 'single',
      educationStage: 'secondary',
      tiktok: '',
      hideMotherPhone: false,
      hideFatherPhone: false,
      hideSchoolName: false,
      heroTitle1: 'مستقبلك قرار ...',
      heroTitle2: 'تقفيل المادة معانا إجبار',
      heroTitle3: 'مش اختيار 💪',
      heroDescription: 'تعلم ببساطة مع أقوى الشروحات، الامتحانات التفاعلية، والمتابعة الدورية للوصول للدرجة النهائية.',
      createdAt: new Date(),
    });
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'basics', label: 'أساسي', icon: <Globe size={14} /> },
    { id: 'branding', label: 'البصرية', icon: <Palette size={14} /> },
    { id: 'landing', label: 'الرئيسية', icon: <FileText size={14} /> },
    { id: 'teacher', label: 'المدرس', icon: <UserCircle size={14} /> },
    { id: 'social', label: 'التواصل', icon: <Share2 size={14} /> },
    { id: 'controls', label: 'التحكم', icon: <SlidersHorizontal size={14} /> },
  ];

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === correctPassword) {
      sessionStorage.setItem('super_admin_auth', 'true');
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('كلمة المرور غير صحيحة!');
      setPasswordInput('');
      setTimeout(() => passwordInputRef.current?.focus(), 50);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('super_admin_auth');
    setIsAuthenticated(false);
    setPasswordInput('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      alert('الرجاء إدخال كلمة المرور الجديدة');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      alert('كلمتا المرور غير متطابقتين');
      return;
    }
    setUpdatingPassword(true);
    try {
      await setDoc(doc(masterDb, 'super_admin', 'config'), {
        password: newPassword
      }, { merge: true });
      setCorrectPassword(newPassword);
      alert('تم تغيير كلمة المرور بنجاح!');
      setIsChangePasswordOpen(false);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء تغيير كلمة المرور: ' + err.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loadingPassword) {
    return (
      <div className="min-h-screen bg-[#060b18] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#060b18] flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-brand-blue/8 blur-[150px] rounded-full" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/6 blur-[150px] rounded-full" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative z-10 w-full max-w-sm bg-[#0c1225]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-brand-blue/20 to-emerald-500/20 border border-brand-blue/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock size={36} className="text-brand-blue" />
          </div>
          
          <h2 className="text-2xl font-black text-white mb-2">التحكم المركزي</h2>
          <p className="text-sm text-gray-400 mb-8">أدخل كلمة المرور الخاصة بالمسؤول</p>

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError('');
                }}
                placeholder="كلمة المرور"
                className={`w-full bg-black/40 border ${passwordError ? 'border-red-500/50' : 'border-white/10'} rounded-2xl px-5 py-4 text-white text-center text-xl tracking-[0.3em] focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all placeholder:tracking-normal placeholder:text-sm`}
                dir="ltr"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {passwordError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400 text-sm font-bold"
              >
                {passwordError}
              </motion.p>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-brand-blue to-blue-600 text-white rounded-2xl font-black text-lg hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              دخول <ChevronLeft size={20} />
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060b18] text-white" dir="rtl">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-brand-blue/8 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/6 blur-[150px] rounded-full" />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-emerald-500/4 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* ═══ Header ═══ */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-bl from-white/[0.06] via-white/[0.02] to-transparent border border-white/[0.08] p-6 sm:p-8 rounded-3xl shadow-2xl backdrop-blur-xl"
        >
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-brand-blue to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-blue/20">
                <Server size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  التحكم المركزي{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-l from-brand-blue to-purple-400 text-lg sm:text-xl">
                    (Super Admin)
                  </span>
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                  إدارة المنصات، قواعد البيانات وتراخيص العملاء (SaaS)
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <button
                onClick={handleLogout}
                className="px-5 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 group"
              >
                <LogOut size={16} />
                تسجيل الخروج
              </button>
              <button
                onClick={() => setIsChangePasswordOpen(true)}
                className="px-5 py-3.5 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue border border-brand-blue/20 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 group"
              >
                <KeyRound size={16} />
                تغيير كلمة المرور
              </button>
              <Link
                to="/owner-dashboard/settings"
                className="px-5 py-3.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 group"
              >
                <Settings size={16} className="group-hover:text-emerald-400 transition-colors" />
                إعدادات المنصة
              </Link>
              <button
                onClick={() => setIsReleaseModalOpen(true)}
                className="px-5 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 rounded-2xl font-black shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload size={16} /> نشر تحديث للمنصات المستقلة
              </button>
              <button
                onClick={openNewTenantModal}
                className="px-6 py-3.5 bg-gradient-to-r from-brand-blue to-blue-600 text-white rounded-2xl font-black shadow-lg shadow-brand-blue/25 hover:shadow-xl hover:shadow-brand-blue/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap size={16} /> إضافة منصة جديدة
              </button>
            </div>
          </div>
        </motion.div>

        {/* ═══ Analytics Cards ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {[
            {
              label: 'العملاء النشطين',
              value: tenants.length,
              color: 'emerald',
              icon: <Users size={24} />,
            },
            {
              label: 'قواعد بيانات معزولة',
              value: tenants.filter((t) => t.firebaseConfig).length,
              color: 'blue',
              icon: <Database size={24} />,
            },
            {
              label: 'حالة النظام',
              value: 'مستقر 100%',
              color: 'purple',
              icon: <Activity size={24} />,
              isText: true,
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:bg-white/[0.05] transition-all duration-300 group`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${card.color}-500/10 text-${card.color}-400 border border-${card.color}-500/20 group-hover:scale-110 transition-transform`}
              >
                {card.icon}
              </div>
              <div>
                <p className="text-gray-400 text-xs font-bold mb-0.5">{card.label}</p>
                <h3
                  className={`text-2xl font-black ${card.isText ? 'text-emerald-400 text-xl' : 'text-white'}`}
                >
                  {card.value}
                </h3>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/[0.02] border border-white/[0.06] p-4 rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-400">تصفية المنصات:</span>
            <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setTenantFilter('all')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tenantFilter === 'all' ? 'bg-brand-blue text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                جميع المنصات ({tenants.length})
              </button>
              <button
                type="button"
                onClick={() => setTenantFilter('saas')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tenantFilter === 'saas' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                سحابية SaaS ({tenants.filter((t) => !t.isStandalone).length})
              </button>
              <button
                type="button"
                onClick={() => setTenantFilter('standalone')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tenantFilter === 'standalone' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                مستقلة مباعة Standalone ({tenants.filter((t) => t.isStandalone).length})
              </button>
            </div>
          </div>
        </div>

        {/* ═══ Tenants Grid ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {tenants
            .filter((t) => {
              if (tenantFilter === 'saas') return !t.isStandalone;
              if (tenantFilter === 'standalone') return t.isStandalone;
              return true;
            })
            .map((tenant, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              key={tenant.id}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-4 hover:border-brand-blue/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(37,99,235,0.08)] group relative overflow-hidden"
            >
              {/* Top accent */}
              <div
                className="absolute top-0 inset-x-0 h-0.5 opacity-40 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: tenant.primaryColor || '#2563eb' }}
              />

              <div className="flex justify-between items-start">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-lg text-white truncate">{tenant.name}</h3>
                    {tenant.isStandalone ? (
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                        مستقلة 🏷️
                      </span>
                    ) : (
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
                        سحابية ☁️
                      </span>
                    )}
                  </div>

                  <a
                    href={`https://${tenant.subdomain}.fahmni.me`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-brand-blue hover:text-blue-400 transition-colors font-medium"
                    dir="ltr"
                  >
                    {tenant.subdomain}.fahmni.me
                    <ExternalLink size={12} />
                  </a>

                  {tenant.customDomain && (
                    <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5" dir="ltr">
                      <Globe size={12} /> {tenant.customDomain}
                    </div>
                  )}
                </div>

                <div className="flex gap-1.5 mr-3" dir="ltr">
                  <button
                    onClick={() => setExporterTenant(tenant)}
                    className="p-2 bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white rounded-lg transition-all cursor-pointer"
                    title="تصدير حزمة المنصة المستقلة للمعلم (1-Click Standalone Exporter)"
                  >
                    <Download size={15} />
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        window.confirm(
                          `هل أنت متأكد من حذف منصة ${tenant.name}؟ هذا الإجراء لا يمكن التراجع عنه.`
                        )
                      ) {
                        try {
                          const docId = tenant.id || tenant.subdomain;
                          if (!docId) throw new Error('لا يوجد معرف للمنصة');
                          await deleteDoc(doc(masterDb, 'tenants', docId));
                          fetchTenants();
                        } catch (err: any) {
                          console.error('Error deleting tenant:', err);
                          alert('حدث خطأ أثناء حذف المنصة: ' + err.message);
                        }
                      }
                    }}
                    className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                    title="حذف المنصة"
                  >
                    <Trash2 size={15} />
                  </button>
                  {tenant.firebaseConfig && (
                    <button
                      onClick={() => {
                        setSelectedStorageTenant(tenant);
                        fetchStorageStats(tenant);
                      }}
                      className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg transition-all cursor-pointer"
                      title="إدارة التخزين والدورة الدراسية"
                    >
                      <Database size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActiveTab('basics');
                      setEditingTenant(tenant);
                    }}
                    className="p-2 bg-brand-blue/10 hover:bg-brand-blue text-brand-blue hover:text-white rounded-lg transition-all cursor-pointer"
                    title="تعديل المنصة"
                  >
                    <Edit3 size={15} />
                  </button>
                </div>
              </div>

              <div className="pt-3 mt-auto border-t border-white/[0.05] space-y-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      tenant.firebaseConfig
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-white/5 text-gray-500'
                    }`}
                  >
                    <Database size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-bold">قاعدة البيانات</span>
                    <span className="text-white text-xs font-medium">
                      {tenant.firebaseConfig ? 'معزولة' : 'عامة (مشتركة)'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Shield size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-bold">الباقة</span>
                    <span className="text-white text-xs font-medium">{tenant.package}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {loading && (
            <div className="col-span-full py-20 text-center text-gray-400 flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-brand-blue" size={32} />
              <span>جاري تحميل العملاء...</span>
            </div>
          )}
          {!loading && tenants.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white/[0.02] border border-white/[0.05] rounded-2xl">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
                <Server size={28} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">لا يوجد أي عملاء حتى الآن</h3>
              <p className="text-gray-400 text-sm">انقر على "إضافة منصة جديدة" للبدء</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ═══ Edit Tenant Modal ═══ */}
      {/* ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {editingTenant && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTenant(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0f1e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/[0.06] flex items-center justify-between bg-gradient-to-l from-brand-blue/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-blue/10 border border-brand-blue/20 rounded-xl flex items-center justify-center text-brand-blue">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {editingTenant.id ? 'تعديل منصة' : 'إنشاء منصة جديدة'}
                    </h2>
                    <p className="text-xs text-gray-400">
                      {editingTenant.name || editingTenant.subdomain}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingTenant(null)}
                  className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tab Headers */}
              <div className="flex gap-1 p-2.5 bg-black/20 border-b border-white/[0.05] overflow-x-auto" dir="rtl">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
                        : 'bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 text-right" dir="rtl">
                {/* 1. Basics Tab */}
                {activeTab === 'basics' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-bold">اسم العميل</label>
                        <input
                          value={editingTenant.name}
                          onChange={(e) =>
                            setEditingTenant({ ...editingTenant, name: e.target.value })
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-bold">تغيير الباقة</label>
                        <select
                          value={editingTenant.package}
                          onChange={(e) =>
                            setEditingTenant({ ...editingTenant, package: e.target.value })
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                        >
                          <option value="الباقة الأساسية">الباقة الأساسية</option>
                          <option value="الباقة الاحترافية">الباقة الاحترافية</option>
                          <option value="VIP">VIP</option>
                        </select>
                      </div>
                    </div>

                    {/* Platform Mode */}
                    <div className="space-y-2 p-4 bg-brand-blue/[0.03] border border-brand-blue/15 rounded-2xl">
                      <label className="text-sm font-black text-white flex items-center gap-2 mb-1">
                        نوع المنصة
                      </label>
                      <p className="text-[11px] text-gray-400 mb-3">
                        حدد ما إذا كانت المنصة لمعلم واحد أو أكاديمية متعددة المعلمين
                      </p>
                      <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 w-fit">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingTenant({ ...editingTenant, platformMode: 'single' })
                          }
                          className={`px-5 py-2 rounded-lg font-bold text-sm transition-all ${
                            !editingTenant.platformMode || editingTenant.platformMode === 'single'
                              ? 'bg-brand-blue text-white shadow-lg'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          مدرس فردي
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingTenant({ ...editingTenant, platformMode: 'academy' })
                          }
                          className={`px-5 py-2 rounded-lg font-bold text-sm transition-all ${
                            editingTenant.platformMode === 'academy'
                              ? 'bg-purple-600 text-white shadow-lg'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          أكاديمية
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-400 font-bold">
                        النطاق الفرعي (Subdomain)
                      </label>
                      <div className="flex items-center">
                        <input
                          value={editingTenant.subdomain}
                          onChange={(e) =>
                            setEditingTenant({ ...editingTenant, subdomain: e.target.value })
                          }
                          className="flex-1 bg-black/30 border border-white/10 rounded-r-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                          placeholder="math-academy"
                          dir="ltr"
                        />
                        <div
                          className="bg-white/5 border border-r-0 border-white/10 rounded-l-xl px-4 py-3 text-gray-500 font-bold text-sm"
                          dir="ltr"
                        >
                          .fahmni.me
                        </div>
                      </div>
                    </div>

                    {/* Custom Domain */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                        <Globe size={13} /> الدومين الخاص بالمعلم (Custom Domain)
                      </label>
                      <input
                        value={editingTenant.customDomain || ''}
                        onChange={(e) =>
                          setEditingTenant({ ...editingTenant, customDomain: e.target.value })
                        }
                        className="w-full bg-black/30 border border-emerald-500/20 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none text-sm transition-colors"
                        placeholder="مثال: hossamalsalhy.com أو eng.fahmni.me"
                        dir="ltr"
                      />
                      <p className="text-[10px] text-gray-500">
                        ربط النطاق الخاص المباشر بدلاً من النطاق الفرعي
                      </p>
                    </div>

                    {/* Firebase Config */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-400 font-bold">
                        إعدادات قاعدة البيانات (Firebase Config)
                      </label>
                      <textarea
                        value={editingTenant.firebaseConfig}
                        onChange={(e) =>
                          setEditingTenant({ ...editingTenant, firebaseConfig: e.target.value })
                        }
                        className="w-full bg-black/50 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 font-mono text-xs h-24 focus:border-emerald-500 focus:outline-none resize-none transition-colors"
                        placeholder={`{"apiKey": "...", "projectId": "..."}`}
                        dir="ltr"
                      />
                      <p className="text-[10px] text-gray-500 text-center">
                        يجب أن تكون بتنسيق JSON صحيح
                      </p>
                    </div>

                    {/* Supabase Database Settings */}
                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl space-y-3">
                      <h4 className="text-xs font-black text-emerald-400 flex items-center gap-2">
                        <span>⚡ إعدادات قاعدة البيانات الفورية (Supabase Database Settings)</span>
                      </h4>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-300 font-bold">Supabase URL (رابط المشروع)</label>
                          <input
                            type="text"
                            value={editingTenant.supabaseUrl || ''}
                            onChange={(e) =>
                              setEditingTenant({ ...editingTenant, supabaseUrl: e.target.value })
                            }
                            placeholder="https://your-project.supabase.co"
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                            dir="ltr"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-300 font-bold">Supabase Anon Key (المفتاح العام)</label>
                          <textarea
                            value={editingTenant.supabaseAnonKey || ''}
                            onChange={(e) =>
                              setEditingTenant({ ...editingTenant, supabaseAnonKey: e.target.value })
                            }
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-xs h-16 focus:border-emerald-500 focus:outline-none resize-none"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Branding Tab */}
                {activeTab === 'branding' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-bold">هوية الفاكهة</label>
                        <select
                          value={editingTenant.fruitTheme || ''}
                          onChange={(e) => {
                            const newFruit = e.target.value as FruitId;
                            const updates: any = { fruitTheme: newFruit };
                            if (newFruit) {
                              const fruitObj = FRUIT_LIST.find((f) => f.id === newFruit);
                              if (fruitObj) {
                                updates.primaryColor = fruitObj.colors.primary;
                              }
                            }
                            setEditingTenant({ ...editingTenant, ...updates });
                          }}
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                        >
                          <option value="">-- بدون فاكهة --</option>
                          {FRUIT_LIST.map((fruit) => (
                            <option key={fruit.id} value={fruit.id}>
                              {fruit.emoji} {fruit.nameAr}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-bold">اللون الأساسي</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={editingTenant.primaryColor || '#2563eb'}
                            onChange={(e) =>
                              setEditingTenant({ ...editingTenant, primaryColor: e.target.value })
                            }
                            className={`w-12 h-12 rounded-xl cursor-pointer bg-black/30 border border-white/10 ${editingTenant.fruitTheme ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!!editingTenant.fruitTheme}
                          />
                          <input
                            type="text"
                            value={editingTenant.primaryColor || '#2563eb'}
                            onChange={(e) =>
                              setEditingTenant({ ...editingTenant, primaryColor: e.target.value })
                            }
                            className={`flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white uppercase focus:outline-none ${editingTenant.fruitTheme ? 'opacity-50 cursor-not-allowed' : 'focus:border-brand-blue'} transition-colors`}
                            dir="ltr"
                            disabled={!!editingTenant.fruitTheme}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-400 font-bold">النص الترحيبي (Slogan)</label>
                      <input
                        value={editingTenant.slogan || ''}
                        onChange={(e) =>
                          setEditingTenant({ ...editingTenant, slogan: e.target.value })
                        }
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                        placeholder="عد إلى رحلتك التعليمية الممتعة"
                      />
                    </div>

                    {renderImageField('الشعار (Logo)', 'logo', 'https://example.com/logo.png')}

                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-400 font-bold">وصف الصفحة الرئيسية</label>
                      <input
                        value={editingTenant.welcomeDescription || ''}
                        onChange={(e) =>
                          setEditingTenant({
                            ...editingTenant,
                            welcomeDescription: e.target.value,
                          })
                        }
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                        placeholder="وجهتك الأولى للتفوق الدراسي..."
                      />
                    </div>
                  </div>
                )}

                {/* 3. Landing Tab */}
                {activeTab === 'landing' && (
                  <div className="space-y-5">
                    <div className="space-y-4 p-5 bg-blue-500/[0.03] border border-blue-500/15 rounded-2xl">
                      <label className="text-sm font-black text-white block">
                        نصوص الصفحة الرئيسية (Hero Section)
                      </label>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs text-gray-400 font-bold">
                            العنوان الأول (مثال: مستقبلك قرار ...)
                          </label>
                          <input
                            value={editingTenant.heroTitle1 || ''}
                            onChange={(e) =>
                              setEditingTenant({ ...editingTenant, heroTitle1: e.target.value })
                            }
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-gray-400 font-bold">
                            العنوان الثاني (الأساسي)
                          </label>
                          <input
                            value={editingTenant.heroTitle2 || ''}
                            onChange={(e) =>
                              setEditingTenant({ ...editingTenant, heroTitle2: e.target.value })
                            }
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none font-bold text-lg transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-gray-400 font-bold">
                            العنوان الثالث
                          </label>
                          <input
                            value={editingTenant.heroTitle3 || ''}
                            onChange={(e) =>
                              setEditingTenant({ ...editingTenant, heroTitle3: e.target.value })
                            }
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-gray-400 font-bold">الوصف</label>
                          <textarea
                            value={editingTenant.heroDescription || ''}
                            onChange={(e) =>
                              setEditingTenant({
                                ...editingTenant,
                                heroDescription: e.target.value,
                              })
                            }
                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none h-24 resize-none transition-colors"
                            placeholder="اكتب وصفاً جذاباً للمنصة..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Teacher Tab */}
                {activeTab === 'teacher' && (
                  <div className="space-y-5">
                    {renderImageField('صورة المدرس', 'teacherPhoto', 'https://example.com/photo.png')}
                    {renderImageField('صورة الخلفية (Hero)', 'heroImage', 'https://example.com/hero.png')}
                    
                    {/* Remove White Background Toggle */}
                    <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                      <div className="space-y-0.5">
                        <label className="text-xs font-bold text-gray-400">إزالة الخلفية البيضاء لصورة المدرس</label>
                        <p className="text-[10px] text-gray-500 font-medium">قم بتفعيل هذا الخيار لدمج خلفية صورة المدرس وجعلها شفافة بشكل تلقائي لمنع المربعات البيضاء</p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${(editingTenant as any).removeTeacherPhotoBg !== false ? 'bg-brand-blue' : 'bg-white/10'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${(editingTenant as any).removeTeacherPhotoBg !== false ? 'right-4' : 'right-0.5'}`} />
                        </div>
                        <input 
                          type="checkbox" 
                          checked={(editingTenant as any).removeTeacherPhotoBg !== false} 
                          onChange={(e) => setEditingTenant({ ...editingTenant, removeTeacherPhotoBg: e.target.checked } as any)} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-bold">اسم المدرس</label>
                        <input
                          value={editingTenant.teacherName || ''}
                          onChange={(e) =>
                            setEditingTenant({ ...editingTenant, teacherName: e.target.value })
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                          placeholder="د/ مصطفى"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-bold">لقب المدرس</label>
                        <input
                          value={editingTenant.teacherTitle || ''}
                          onChange={(e) =>
                            setEditingTenant({ ...editingTenant, teacherTitle: e.target.value })
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                          placeholder="مدرس الفيزياء"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-400 font-bold">المادة الدراسية</label>
                      <input
                        value={editingTenant.subject || ''}
                        onChange={(e) =>
                          setEditingTenant({ ...editingTenant, subject: e.target.value })
                        }
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                        placeholder="الفيزياء"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-400 font-bold">نبذة عن المدرس</label>
                      <textarea
                        value={editingTenant.teacherBio || ''}
                        onChange={(e) =>
                          setEditingTenant({ ...editingTenant, teacherBio: e.target.value })
                        }
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none h-24 resize-none transition-colors"
                        placeholder="اكتب نبذة مختصرة عن المدرس..."
                      />
                    </div>
                    
                    {/* Vodafone Cash & InstaPay fields */}
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-bold font-mono">رقم فودافون كاش للمنصة</label>
                        <input
                          value={editingTenant.vodafoneCashNumber || ''}
                          onChange={(e) =>
                            setEditingTenant({ ...editingTenant, vodafoneCashNumber: e.target.value })
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                          placeholder="مثال: 01005813308"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-bold font-mono">عنوان انستا باي للمنصة</label>
                        <input
                          value={editingTenant.instapayAddress || ''}
                          onChange={(e) =>
                            setEditingTenant({ ...editingTenant, instapayAddress: e.target.value })
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                          placeholder="مثال: name@instapay"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Social Tab */}
                {activeTab === 'social' && (
                  <div className="space-y-3">
                    {[
                      { label: 'واتساب', field: 'whatsapp', placeholder: 'https://wa.me/20xxxxxxxxxx' },
                      { label: 'فيسبوك', field: 'facebook', placeholder: 'https://facebook.com/...' },
                      { label: 'يوتيوب', field: 'youtube', placeholder: 'https://youtube.com/@...' },
                      { label: 'تليجرام', field: 'telegram', placeholder: 'https://t.me/...' },
                      { label: 'انستجرام', field: 'instagram', placeholder: 'https://instagram.com/...' },
                      { label: 'تيك توك', field: 'tiktok', placeholder: 'https://tiktok.com/@...' },
                    ].map((item) => (
                      <div key={item.field} className="space-y-1">
                        <label className="text-xs text-gray-400 font-bold">{item.label}</label>
                        <input
                          value={(editingTenant as any)[item.field] || ''}
                          onChange={(e) =>
                            setEditingTenant({ ...editingTenant, [item.field]: e.target.value })
                          }
                          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none text-sm transition-colors"
                          placeholder={item.placeholder}
                          dir="ltr"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* 6. Controls Tab */}
                {activeTab === 'controls' && (
                  <div className="space-y-5">
                    {/* Education Stage */}
                    <div className="space-y-3 p-4 bg-purple-500/[0.03] border border-purple-500/15 rounded-2xl">
                      <label className="text-sm font-black text-white">المرحلة الدراسية</label>
                      <p className="text-[11px] text-gray-400">
                        تحدد السنوات الدراسية المعروضة في الصفحة الرئيسية
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/20 p-4 rounded-xl border border-white/10">
                        {[
                          { id: 'primary', label: 'ابتدائي (الرابع - الخامس - السادس)' },
                          { id: 'preparatory', label: 'إعدادي (الأول - الثاني - الثالث)' },
                          { id: 'secondary', label: 'ثانوي (الأول - الثاني - الثالث)' },
                          { id: 'general', label: 'عامة / كورسات متنوعة' },
                        ].map((stage) => {
                          const currentStages = (editingTenant.educationStage || 'secondary').split(',');
                          const isChecked = currentStages.includes(stage.id);
                          return (
                            <label key={stage.id} className="flex items-center gap-2 text-xs text-white cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  let newStages = [...currentStages];
                                  if (e.target.checked) {
                                    if (!newStages.includes(stage.id)) newStages.push(stage.id);
                                  } else {
                                    newStages = newStages.filter((s) => s !== stage.id);
                                  }
                                  const finalStages = newStages.filter(Boolean).join(',');
                                  setEditingTenant({ ...editingTenant, educationStage: finalStages || 'secondary' });
                                }}
                                className="rounded border-white/20 bg-black/40 text-brand-blue focus:ring-brand-blue cursor-pointer"
                              />
                              {stage.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Registration Field Toggles */}
                    <div className="space-y-3 p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                      <label className="text-sm font-black text-white">حقول التسجيل</label>
                      <p className="text-[11px] text-gray-400 mb-2">
                        تحكم في الحقول المعروضة في صفحة تسجيل الطالب
                      </p>
                      {[
                        { label: 'إخفاء رقم هاتف الأم', field: 'hideMotherPhone' },
                        { label: 'إخفاء رقم هاتف الأب', field: 'hideFatherPhone' },
                        { label: 'إخفاء اسم المدرسة', field: 'hideSchoolName' },
                      ].map((item) => (
                        <div
                          key={item.field}
                          onClick={() =>
                            setEditingTenant({
                              ...editingTenant,
                              [item.field]: !(editingTenant as any)[item.field],
                            })
                          }
                          className="flex items-center justify-between p-3 bg-black/20 rounded-xl cursor-pointer hover:bg-black/30 transition-colors"
                        >
                          <span className="text-sm text-gray-300">{item.label}</span>
                          <div
                            className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${
                              (editingTenant as any)[item.field] ? 'bg-red-500' : 'bg-white/10'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                                (editingTenant as any)[item.field]
                                  ? 'translate-x-5'
                                  : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                     {/* Comprehensive Guide */}
                     <div className="space-y-4 p-4 bg-blue-500/[0.03] border border-blue-500/15 rounded-2xl">
                       <label className="text-sm font-black text-white">الدليل الشامل</label>
                       <div className="space-y-4">
                         {/* Student Guide */}
                         <div className="space-y-2">
                           <div className="flex items-center justify-between">
                             <label className="text-xs font-bold text-gray-400">فيديو دليل الطالب</label>
                             <div 
                               onClick={() => setEditingTenant({ 
                                 ...editingTenant, 
                                 showStudentGuide: (editingTenant as any).showStudentGuide === false ? true : false 
                               } as any)}
                               className="flex items-center gap-2 cursor-pointer"
                             >
                               <span className="text-xs font-bold text-gray-400">إظهار للطالب</span>
                               <div className={`w-8 h-4 rounded-full relative transition-colors ${(editingTenant as any).showStudentGuide !== false ? 'bg-brand-blue' : 'bg-white/10'}`}>
                                 <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${(editingTenant as any).showStudentGuide !== false ? 'right-4' : 'right-0.5'}`} />
                               </div>
                             </div>
                           </div>
                           <input
                             type="url"
                             value={(editingTenant as any).studentGuideVideoUrl || ''}
                             onChange={(e) => setEditingTenant({ ...editingTenant, studentGuideVideoUrl: e.target.value } as any)}
                             className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                             placeholder="رابط فيديو اليوتيوب لدليل الطالب..."
                             dir="ltr"
                           />
                         </div>

                         {/* Teacher Guide */}
                         <div className="space-y-2">
                           <div className="flex items-center justify-between">
                             <label className="text-xs font-bold text-gray-400">فيديو دليل المدرس</label>
                             <div 
                               onClick={() => setEditingTenant({ 
                                 ...editingTenant, 
                                 showTeacherGuide: (editingTenant as any).showTeacherGuide === false ? true : false 
                               } as any)}
                               className="flex items-center gap-2 cursor-pointer"
                             >
                               <span className="text-xs font-bold text-gray-400">إظهار للمدرس</span>
                               <div className={`w-8 h-4 rounded-full relative transition-colors ${(editingTenant as any).showTeacherGuide !== false ? 'bg-brand-blue' : 'bg-white/10'}`}>
                                 <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${(editingTenant as any).showTeacherGuide !== false ? 'right-4' : 'right-0.5'}`} />
                               </div>
                             </div>
                           </div>
                           <input
                             type="url"
                             value={(editingTenant as any).teacherGuideVideoUrl || ''}
                             onChange={(e) => setEditingTenant({ ...editingTenant, teacherGuideVideoUrl: e.target.value } as any)}
                             className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                             placeholder="رابط فيديو اليوتيوب لدليل المدرس..."
                             dir="ltr"
                           />
                         </div>
                       </div>
                     </div>

                    {/* External Homework Storage Settings */}
                    <div className="space-y-4 p-4 bg-emerald-500/[0.03] border border-emerald-500/15 rounded-2xl">
                      <label className="text-sm font-black text-white">استضافة الواجبات الخارجية (لتوفير مساحة السيرفر)</label>
                      <div className="space-y-4">
                        {/* ImgBB Hosting Toggle */}
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <label className="text-xs font-bold text-gray-400">استخدام استضافة صور مجانية (ImgBB)</label>
                            <p className="text-[10px] text-gray-500">يتم رفع صور واجبات الطلاب على موقع ImgBB لتوفير مساحتك بالكامل</p>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <div className={`w-8 h-4 rounded-full relative transition-colors ${(editingTenant as any).useFreeImageHosting === true ? 'bg-brand-blue' : 'bg-white/10'}`}>
                              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${(editingTenant as any).useFreeImageHosting === true ? 'right-4' : 'right-0.5'}`} />
                            </div>
                            <input 
                              type="checkbox" 
                              checked={(editingTenant as any).useFreeImageHosting === true} 
                              onChange={(e) => setEditingTenant({ ...editingTenant, useFreeImageHosting: e.target.checked } as any)} 
                              className="hidden" 
                            />
                          </label>
                        </div>

                        {/* ImgBB API Key Input */}
                        {((editingTenant as any).useFreeImageHosting === true) && (
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-gray-400">مفتاح API Key لـ ImgBB</label>
                            <input
                              type="text"
                              value={(editingTenant as any).imgbbApiKey || ''}
                              onChange={(e) => setEditingTenant({ ...editingTenant, imgbbApiKey: e.target.value } as any)}
                              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors text-xs"
                              placeholder="أدخل مفتاح API الخاص بـ ImgBB..."
                              dir="ltr"
                            />
                          </div>
                        )}

                        {/* Free File Hosting Toggle */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <div className="space-y-0.5">
                            <label className="text-xs font-bold text-gray-400">استخدام استضافة ملفات مجانية (Catbox)</label>
                            <p className="text-[10px] text-gray-500">يتم رفع ملفات PDF والمستندات على سيرفرات Catbox مجاناً لتوفير مساحتك</p>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <div className={`w-8 h-4 rounded-full relative transition-colors ${(editingTenant as any).useFreeFileHosting === true ? 'bg-brand-blue' : 'bg-white/10'}`}>
                              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${(editingTenant as any).useFreeFileHosting === true ? 'right-4' : 'right-0.5'}`} />
                            </div>
                            <input 
                              type="checkbox" 
                              checked={(editingTenant as any).useFreeFileHosting === true} 
                              onChange={(e) => setEditingTenant({ ...editingTenant, useFreeFileHosting: e.target.checked } as any)} 
                              className="hidden" 
                            />
                          </label>
                        </div>

                        {/* Emergency Fallback Info Alert */}
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
                          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-gray-400 font-bold leading-normal">
                            <span className="text-amber-500 block mb-0.5">ملاحظة أمان وتأمين الواجبات:</span>
                            في حال حدوث أي عطل أو مشكلة في السيرفرات الخارجية (مثل بطء الإنترنت، أو تعطل خادم الصور ImgBB، أو إدخال مفتاح API خاطئ)، سيقوم النظام تلقائياً وبشكل صامت بالتبديل والرفع على سيرفر <span className="text-white">Firebase Storage</span> الأساسي لمنع توقف الطلاب. يمكنك إغلاق التفعيلات أعلاه يدوياً في أي وقت لإجبار النظام على استخدام سيرفرك الخاص مباشرة.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. Standalone Exporter & Domains Tab */}
                {activeTab === 'standalone' && (
                  <div className="space-y-5">
                    {/* Standalone Export & Config Card */}
                    <div className="p-5 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <Upload size={20} />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-white">تصدير المنصة المستقلة للمعلم</h4>
                          <p className="text-xs text-gray-400">
                            توليد ملفات الإعدادات والربط السحابي لهذه المنصة لبيعها كنسخة مدى الحياة
                          </p>
                        </div>
                      </div>

                      {/* Custom domain input inside standalone tab */}
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        <label className="text-xs font-bold text-emerald-400">الدومين الخاص المربوط بالمنصة</label>
                        <input
                          type="text"
                          value={editingTenant.customDomain || ''}
                          onChange={(e) => setEditingTenant({ ...editingTenant, customDomain: e.target.value })}
                          className="w-full bg-black/40 border border-emerald-500/30 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 focus:outline-none"
                          placeholder="مثال: hossamalsalhy.com أو eng.fahmni.me"
                          dir="ltr"
                        />
                      </div>

                      {/* Is Standalone Toggle */}
                      <div className="flex items-center justify-between p-3 bg-black/30 rounded-xl border border-white/5">
                        <div>
                          <span className="text-xs font-bold text-white block">حالة الاستضافة المباشرة</span>
                          <span className="text-[10px] text-gray-400">تحديد هذه المنصة كمنصة مستقلة على استضافة خاصة</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingTenant({ ...editingTenant, isStandalone: !editingTenant.isStandalone })}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            editingTenant.isStandalone
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                              : 'bg-white/10 text-gray-400'
                          }`}
                        >
                          {editingTenant.isStandalone ? 'مستقلة (Self-Hosted)' : 'سحابية (SaaS Shared)'}
                        </button>
                      </div>

                      {/* Action Button */}
                      <button
                        type="button"
                        onClick={() => handleExportStandalonePackage(editingTenant)}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                      >
                        <Download size={16} /> تصدير حزمة إعدادات (.env) المنصة المستقلة
                      </button>
                    </div>

                    {/* Information Box */}
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-2">
                      <h5 className="text-xs font-black text-blue-400">💡 كيفية تشغيل التحديثات للمنصات المستقلة</h5>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        تتيح لك منصة فهمان نشر التحديثات البرمجية فورياً من زر <strong>"🚀 نشر تحديث للمنصات المستقلة"</strong> الموجود بأعلى لوحة تحكم السوبر أدمن. تتلقى جميع المنصات المباعة التحديثات تلقائياً من خادم Firestore الموحد دون الحاجة لتعديل أكواد المعلم.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-white/[0.06] bg-black/20 flex gap-3">
                <button
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await saveTenant(editingTenant);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="flex-1 py-3.5 bg-brand-blue text-white rounded-xl font-black text-base hover:bg-blue-600 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
                      حفظ التعديلات
                    </>
                  )}
                </button>
                <button
                  onClick={() => setEditingTenant(null)}
                  className="px-6 py-3.5 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ═══ Landing Page Settings Modal ═══ */}
      {/* ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isEditingLandingPage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsEditingLandingPage(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[#0a0f1e] border border-white/10 p-6 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-white flex items-center gap-3">
                  <Layout className="text-emerald-400" />
                  إعدادات الصفحة الرئيسية
                </h3>
                <button
                  onClick={() => setIsEditingLandingPage(false)}
                  className="p-2 bg-white/5 rounded-xl hover:bg-white/10 text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto pr-2 space-y-6 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Hero Section Settings */}
                  <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4">
                    <h4 className="font-bold text-brand-blue text-lg mb-2">القسم الرئيسي (Hero)</h4>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">العنوان الأساسي</label>
                      <input
                        value={landingPageSettings.heroTitle}
                        onChange={(e) =>
                          setLandingPageSettings({
                            ...landingPageSettings,
                            heroTitle: e.target.value,
                          })
                        }
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">الكلمة المميزة (متدرجة اللون)</label>
                      <input
                        value={landingPageSettings.heroHighlight}
                        onChange={(e) =>
                          setLandingPageSettings({
                            ...landingPageSettings,
                            heroHighlight: e.target.value,
                          })
                        }
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">الوصف الفرعي</label>
                      <textarea
                        value={landingPageSettings.heroSubtitle}
                        onChange={(e) =>
                          setLandingPageSettings({
                            ...landingPageSettings,
                            heroSubtitle: e.target.value,
                          })
                        }
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none h-24 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Buttons Settings */}
                  <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4">
                    <h4 className="font-bold text-emerald-400 text-lg mb-2">الأزرار</h4>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">نص الزر الرئيسي</label>
                      <input
                        value={landingPageSettings.primaryButtonText}
                        onChange={(e) =>
                          setLandingPageSettings({
                            ...landingPageSettings,
                            primaryButtonText: e.target.value,
                          })
                        }
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">نص الزر الثانوي</label>
                      <input
                        value={landingPageSettings.secondaryButtonText}
                        onChange={(e) =>
                          setLandingPageSettings({
                            ...landingPageSettings,
                            secondaryButtonText: e.target.value,
                          })
                        }
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Features Settings */}
                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-6">
                  <h4 className="font-bold text-purple-400 text-lg mb-2">
                    المميزات (البطاقات الثلاث)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((num) => (
                      <div
                        key={num}
                        className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5"
                      >
                        <h5 className="font-bold text-sm text-gray-300">ميزة {num}</h5>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">العنوان</label>
                          <input
                            value={landingPageSettings[`feature${num}Title`]}
                            onChange={(e) =>
                              setLandingPageSettings({
                                ...landingPageSettings,
                                [`feature${num}Title`]: e.target.value,
                              })
                            }
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-blue focus:outline-none text-sm transition-colors"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">الوصف</label>
                          <textarea
                            value={landingPageSettings[`feature${num}Desc`]}
                            onChange={(e) =>
                              setLandingPageSettings({
                                ...landingPageSettings,
                                [`feature${num}Desc`]: e.target.value,
                              })
                            }
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-blue focus:outline-none text-sm h-20 transition-colors"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => setIsEditingLandingPage(false)}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={saveLandingPageSettings}
                  className="px-8 py-3 bg-brand-blue hover:bg-blue-600 text-white rounded-xl font-bold transition-all flex items-center gap-2"
                >
                  <CheckCircle2 size={20} />
                  حفظ الإعدادات
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {isChangePasswordOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChangePasswordOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0f1e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <KeyRound className="text-brand-blue" size={20} />
                  تغيير كلمة المرور للتحكم المركزي
                </h3>
                <button
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-bold">كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="********"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors text-center text-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-bold">تأكيد كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="********"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-blue focus:outline-none transition-colors text-center text-lg"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsChangePasswordOpen(false)}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="px-6 py-2.5 bg-brand-blue hover:bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-brand-blue/20 transition-all flex items-center gap-1.5"
                  >
                    {updatingPassword ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    تحديث كلمة المرور
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ Storage Management & Reset Modal ═══ */}
      <AnimatePresence>
        {selectedStorageTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStorageTenant(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-lg bg-[#0c1225] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Background gradient decor */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-l from-emerald-500 to-teal-500" />
              
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">إدارة التخزين وبدء دورة جديدة</h3>
                    <p className="text-[10px] text-gray-500 font-bold">منصة: {selectedStorageTenant.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStorageTenant(null)}
                  className="w-8 h-8 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {fetchingStorage ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={36} className="animate-spin text-emerald-500" />
                  <span className="text-xs text-gray-400 font-bold">جاري حساب حجم التخزين وفحص الملفات...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Storage stats panel */}
                  {storageStats && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center space-y-1">
                        <span className="text-[10px] text-gray-500 font-bold block">إجمالي تسليمات الواجبات</span>
                        <span className="text-2xl font-black text-white">{storageStats.totalSubmissions}</span>
                        <span className="text-[9px] text-gray-400 block">واجب مرفوع</span>
                      </div>
                      
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center space-y-1">
                        <span className="text-[10px] text-gray-500 font-bold block">مساحة Firebase المستهلكة</span>
                        <span className="text-2xl font-black text-emerald-400">
                          {storageStats.estimatedSpaceMB >= 1024 
                            ? `${(storageStats.estimatedSpaceMB / 1024).toFixed(2)} GB` 
                            : `${storageStats.estimatedSpaceMB.toFixed(1)} MB`
                          }
                        </span>
                        <span className="text-[9px] text-gray-400 block">من إجمالي 5.0 GB مجانية</span>
                      </div>

                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center col-span-2 flex justify-around items-center divide-x divide-white/5">
                        <div className="text-center flex-1">
                          <span className="text-[9px] text-gray-500 font-bold block">ملفات Firebase Storage</span>
                          <span className="text-base font-black text-white">{storageStats.firebaseFiles}</span>
                        </div>
                        <div className="text-center flex-1">
                          <span className="text-[9px] text-gray-500 font-bold block">روابط ImgBB / استضافة مجانية</span>
                          <span className="text-base font-black text-emerald-500">{storageStats.externalLinks}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Warning Box */}
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3">
                    <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-red-400">تحذير إعادة تهيئة الواجبات وبدء الدورة الجديدة:</h4>
                      <p className="text-[10px] text-gray-400 font-bold leading-relaxed">
                        عند الضغط على الزر بالأسفل، سيتم حذف جميع إجابات الطلاب المسجلة في قاعدة البيانات، وكذلك سيتم مسح وحذف كافة الملفات والصور المرفوعة على سيرفر <span className="text-white">Firebase Storage</span> نهائياً لتفريغ المساحة تماماً لبدء دورة دراسية جديدة. لا يمكن التراجع عن هذا الإجراء!
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-white/5 flex gap-3">
                    <button
                      onClick={() => setSelectedStorageTenant(null)}
                      disabled={clearingStorage}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={() => handleResetStorageAndCycle(selectedStorageTenant)}
                      disabled={clearingStorage || !storageStats || storageStats.totalSubmissions === 0}
                      className="flex-2 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      {clearingStorage ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> جاري التصفير والحذف...
                        </>
                      ) : (
                        <>
                          <Trash2 size={14} /> تصفير الواجبات وحذف الملفات
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ═══ Standalone Update Release Publisher Modal ═══ */}
      {/* ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isReleaseModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReleaseModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-[#0a0f1e] border border-emerald-500/20 rounded-3xl p-6 shadow-2xl space-y-5 text-right overflow-hidden"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Upload size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">نشر وتطبيق تحديث سحابي جديد</h3>
                    <p className="text-xs text-gray-400">إرسال التحديث لجميع المنصات المستقلة المشتراة</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsReleaseModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300">رقم الإصدار (Version Tag)</label>
                  <input
                    type="text"
                    value={releaseVersion}
                    onChange={(e) => setReleaseVersion(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="v2.5.0"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300">ملاحظات التحديث والميزات الجديدة</label>
                  <textarea
                    value={releaseNotes}
                    onChange={(e) => setReleaseNotes(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs h-28 focus:border-emerald-500 focus:outline-none resize-none"
                    placeholder="تفاصيل التحديث والميزات الجديدة المضافة..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300">رابط حزمة التحديث المباشرة (ZIP Package URL - اختياري)</label>
                  <input
                    type="url"
                    value={releaseZipUrl}
                    onChange={(e) => setReleaseZipUrl(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                    placeholder="https://releases.fahmni.me/v2.5.0.zip"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-gray-500">
                    يمكن ترك هذا الرابط فارغاً في حالة التحديثات السحابية الفورية المنشورة على GitHub / Vercel
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsReleaseModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={publishingRelease}
                  onClick={handlePublishRelease}
                  className="flex-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {publishingRelease ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> جاري نشر التحديث...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />🚀 نشر التحديث الآن للمنصات المستقلة
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ═══ 1-Click Standalone Exporter Suite Modal ═══ */}
      {/* ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {exporterTenant && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExporterTenant(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0f1e] border border-purple-500/30 rounded-3xl p-6 shadow-2xl space-y-6 text-right overflow-hidden max-h-[92vh] flex flex-col"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                    <Download size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">مركز تصدير وتمليك المنصة المستقلة</h3>
                    <p className="text-xs text-purple-300 font-bold">
                      منصة: {exporterTenant.name} ({exporterTenant.customDomain || exporterTenant.subdomain + '.fahmni.me'})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExporterTenant(null)}
                  className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                {/* Information Alert */}
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-start gap-3">
                  <Zap size={20} className="text-purple-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <span className="font-black text-purple-300 block">حزمة البيع والتمليك المكتملة للمعلم:</span>
                    <p className="text-gray-300 leading-relaxed">
                      هذا المركز يتيح لك استخراج كافة ملفات الضبط والإعداد السحابي الخاصة بالمعلم وتسليمها له لرفع منصته على استضافته ودومينه الخاص بالكامل مع إمكانية تحديثها سحابياً.
                    </p>
                  </div>
                </div>

                {/* 🚀 Main Full ZIP Download Button */}
                <div className="p-5 bg-gradient-to-r from-purple-600/20 via-brand-blue/20 to-emerald-500/20 border border-purple-500/30 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-white flex items-center gap-2">
                        <Download size={18} className="text-purple-400" />
                        تنزيل حزمة المنصة الشاملة (.ZIP Bundle)
                      </h4>
                      <p className="text-xs text-gray-300 mt-1">
                        تنزيل ملف مضغوط كامل يحتوي على السورس كود وملف dist الجاهز للاستضافة وملفات الإعدادات والدليل المعماري.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={generatingZip}
                    onClick={() => downloadCompleteZipBundle(exporterTenant)}
                    className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-brand-blue to-emerald-500 hover:from-purple-500 hover:to-emerald-400 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {generatingZip ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> جاري تجميع وتنزيل حزمة المنصة ZIP...
                      </>
                    ) : (
                      <>
                        <Download size={18} /> 📦 تنزيل حزمة المنصة المكتملة سورس + جاهزة (.ZIP Package)
                      </>
                    )}
                  </button>
                </div>

                {/* Grid of Downloadable Resources */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Option 1: .env File */}
                  <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2.5 hover:border-emerald-500/40 transition-all group">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <FileText size={15} className="text-emerald-400" /> ملف البيئة (.env)
                      </span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md font-bold">مسبق الإعداد</span>
                    </div>
                    <p className="text-[11px] text-gray-400">يتضمن مفاتيح Firebase & Supabase والمعرف الخاص بالمنصة.</p>
                    <button
                      type="button"
                      onClick={() => downloadEnvFile(exporterTenant)}
                      className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download size={14} /> تنزيل ملف .env
                    </button>
                  </div>

                  {/* Option 2: firebase-applet-config.json */}
                  <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2.5 hover:border-blue-500/40 transition-all group">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <Database size={15} className="text-blue-400" /> إعدادات Firebase JSON
                      </span>
                      <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md font-bold">JSON</span>
                    </div>
                    <p className="text-[11px] text-gray-400">ملف الإعدادات المباشر المخصص لقاعدة بيانات المعلم.</p>
                    <button
                      type="button"
                      onClick={() => downloadFirebaseJson(exporterTenant)}
                      className="w-full py-2.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download size={14} /> تنزيل ملف Config JSON
                    </button>
                  </div>

                  {/* Option 3: DEPLOYMENT_GUIDE.md */}
                  <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2.5 hover:border-amber-500/40 transition-all group">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <BookOpen size={15} className="text-amber-400" /> دليل التثبيت والتسليم
                      </span>
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md font-bold">MD Guide</span>
                    </div>
                    <p className="text-[11px] text-gray-400">دليل الاستضافة الشامل لرفع المنصة على Hostinger, CPanel, Vercel, VPS.</p>
                    <button
                      type="button"
                      onClick={() => downloadDeploymentGuide(exporterTenant)}
                      className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download size={14} /> تنزيل دليل الاستضافة (MD)
                    </button>
                  </div>

                  {/* Option 4: Packaging Batch Script */}
                  <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2.5 hover:border-purple-500/40 transition-all group">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <Zap size={15} className="text-purple-400" /> سكربت التجميع الآلي (.bat)
                      </span>
                      <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-md font-bold">Automatic ZIP</span>
                    </div>
                    <p className="text-[11px] text-gray-400">سكربت تنفيذي يبني ويضغط محتويات المشروع لـ ZIP جاهز للتسليم.</p>
                    <button
                      type="button"
                      onClick={() => downloadExportScript(exporterTenant)}
                      className="w-full py-2.5 bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download size={14} /> تنزيل سكربت التجميع (.bat)
                    </button>
                  </div>

                  {/* Option 5: MySQL / PostgreSQL Migration .SQL File */}
                  <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2.5 hover:border-cyan-500/40 transition-all group col-span-1 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <Database size={15} className="text-cyan-400" /> هجرة واستيراد قواعد بيانات MySQL / PostgreSQL (.sql)
                      </span>
                      <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-md font-bold">SQL Import</span>
                    </div>
                    <p className="text-[11px] text-gray-400">توليد ملف استعلامات SQL كامل ونقل كافة الطلاب والدروس والنتائج إلى سيرفر Hostinger أو Vercel Postgres الخاص بالمعلم.</p>
                    <button
                      type="button"
                      onClick={() => downloadSqlMigration(exporterTenant)}
                      className="w-full py-2.5 bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download size={14} /> 🔄 توليد وتنزيل ملف هجرة SQL (.sql)
                    </button>
                  </div>
                </div>

                {/* Direct Link to Test */}
                <div className="p-4 bg-black/40 border border-white/10 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-white block">تجربة وتشغيل المنصة محلياً:</span>
                    <span className="text-[11px] text-brand-blue font-mono">http://{exporterTenant.subdomain}.localhost:3000</span>
                  </div>
                  <a
                    href={`http://${exporterTenant.subdomain}.localhost:3000`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    فتح للتجربة <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setExporterTenant(null)}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
