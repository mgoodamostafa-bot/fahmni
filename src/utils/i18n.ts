/**
 * Internationalization (i18n) Utility
 * Provides basic Arabic/English translation support
 */

export type Language = 'ar' | 'en';

export interface Translation {
  [key: string]: string | Translation;
}

// Default translations
const translations: Record<Language, Translation> = {
  ar: {
    common: {
      loading: 'جاري التحميل...',
      error: 'حدث خطأ',
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تعديل',
      add: 'إضافة',
      search: 'بحث',
      filter: 'تصفية',
      export: 'تصدير',
      refresh: 'تحديث',
      confirm: 'تأكيد',
      yes: 'نعم',
      no: 'لا',
    },
    auth: {
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      forgotPassword: 'نسيت كلمة المرور؟',
      resetPassword: 'إعادة تعيين كلمة المرور',
    },
    navigation: {
      home: 'الرئيسية',
      courses: 'الكورسات',
      students: 'الطلاب',
      teachers: 'المدرسين',
      settings: 'الإعدادات',
      dashboard: 'لوحة التحكم',
    },
    courses: {
      title: 'الكورسات',
      enroll: 'اشتراك',
      unenroll: 'إلغاء الاشتراك',
      lessons: 'الدروس',
      progress: 'التقدم',
      certificate: 'الشهادة',
    },
    students: {
      title: 'الطلاب',
      attendance: 'الحضور',
      grades: 'الدرجات',
      wallet: 'المحفظة',
    },
  },
  en: {
    common: {
      loading: 'Loading...',
      error: 'An error occurred',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      search: 'Search',
      filter: 'Filter',
      export: 'Export',
      refresh: 'Refresh',
      confirm: 'Confirm',
      yes: 'Yes',
      no: 'No',
    },
    auth: {
      login: 'Login',
      logout: 'Logout',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot Password?',
      resetPassword: 'Reset Password',
    },
    navigation: {
      home: 'Home',
      courses: 'Courses',
      students: 'Students',
      teachers: 'Teachers',
      settings: 'Settings',
      dashboard: 'Dashboard',
    },
    courses: {
      title: 'Courses',
      enroll: 'Enroll',
      unenroll: 'Unenroll',
      lessons: 'Lessons',
      progress: 'Progress',
      certificate: 'Certificate',
    },
    students: {
      title: 'Students',
      attendance: 'Attendance',
      grades: 'Grades',
      wallet: 'Wallet',
    },
  },
};

// Current language state
let currentLanguage: Language = 'ar';

// Get nested translation
function getNestedValue(obj: Translation, path: string): string {
  const keys = path.split('.');
  let value: string | Translation = obj;

  for (const key of keys) {
    if (typeof value === 'object' && value !== null) {
      value = value[key];
    } else {
      return path; // Return path if not found
    }
  }

  return typeof value === 'string' ? value : path;
}

// Translation function
export const t = (key: string): string => {
  return getNestedValue(translations[currentLanguage], key);
};

// Set language
export const setLanguage = (lang: Language) => {
  currentLanguage = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
};

// Get current language
export const getLanguage = (): Language => currentLanguage;

// Toggle between Arabic and English
export const toggleLanguage = () => {
  setLanguage(currentLanguage === 'ar' ? 'en' : 'ar');
};

// RTL support
export const isRTL = (): boolean => currentLanguage === 'ar';

// Format number based on language
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat(currentLanguage === 'ar' ? 'ar-EG' : 'en-US').format(num);
};

// Format date based on language
export const formatDate = (date: Date | { seconds: number }): string => {
  const d = date instanceof Date ? date : new Date(date.seconds * 1000);
  return new Intl.DateTimeFormat(currentLanguage === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
};
