import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { initTenantApp, masterDb } from '../lib/firebase';
import { initTenantSupabase } from '../lib/supabase';
import { doc, getDoc } from 'firebase/firestore';
import { applyFruitTheme } from '../constants/fruitThemes';
import type { FruitId } from '../constants/fruitThemes';
import { WifiOff } from 'lucide-react';

interface TenantContextType {
  tenantId: string | null;
  isMainSite: boolean;
  isLoading: boolean;
  tenantData: any | null;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: null,
  isMainSite: true,
  isLoading: true,
  tenantData: null,
});

// ═══════════════════════════════════════════════════════════════
// 🚀 CACHE HELPERS: Load instantly from localStorage on repeat visits
// ═══════════════════════════════════════════════════════════════
const CACHE_KEY_PREFIX = 'fahmni_tenant_';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days (loaded instantly even if offline)

const getCachedTenant = (subdomain: string): any | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + subdomain);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached._cachedAt > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY_PREFIX + subdomain);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
};

const setCachedTenant = (subdomain: string, data: any) => {
  try {
    localStorage.setItem(
      CACHE_KEY_PREFIX + subdomain,
      JSON.stringify({ ...data, _cachedAt: Date.now() })
    );
  } catch {
    /* storage full - ignore */
  }
};

// ═══════════════════════════════════════════════════════════════
// Apply tenant branding (theme/color)
// ═══════════════════════════════════════════════════════════════
const applyTenantBranding = (data: any) => {
  if (data.fruitTheme) {
    applyFruitTheme(data.fruitTheme as FruitId);
  } else if (data.primaryColor) {
    document.documentElement.style.setProperty('--color-brand-600', data.primaryColor);
    document.documentElement.style.setProperty('--color-brand-500', data.primaryColor);
    document.documentElement.style.setProperty('--color-brand-blue', data.primaryColor);
    document.documentElement.style.setProperty('--brand-primary', data.primaryColor);
  }
};

// ═══════════════════════════════════════════════════════════════
// Parse and init Firebase from tenant config
// ═══════════════════════════════════════════════════════════════
const initFirebaseFromTenantData = (data: any) => {
  let configObj: any = null;
  if (data.firebaseConfig && typeof data.firebaseConfig === 'string' && data.firebaseConfig.trim() !== '') {
    try {
      let configStr = data.firebaseConfig.trim();
      const match = configStr.match(/\{[\s\S]*\}/);
      if (match) configStr = match[0];
      configStr = configStr
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
        .replace(/'/g, '"')
        .replace(/,\s*\}/g, '}');
      configObj = JSON.parse(configStr);
      if (configObj.firestoreDatabaseId === '') {
          delete configObj.firestoreDatabaseId;
      }
    } catch (e) {
      console.error('Failed to parse firebaseConfig:', e);
    }
  } else if (data.firebaseConfig && typeof data.firebaseConfig === 'object') {
     configObj = data.firebaseConfig;
     if (configObj.firestoreDatabaseId === '') {
        delete configObj.firestoreDatabaseId;
    }
  }

  if (configObj && configObj.apiKey) {
    initTenantApp(configObj);
  } else {
    initTenantApp();
  }
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isMainSite, setIsMainSite] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantNotFound, setTenantNotFound] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [tenantData, setTenantData] = useState<any | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    // 🛡️ GLOBAL FAILSAFE: No matter what happens, force-unblock after 5s
    const globalFailsafe = setTimeout(() => {
      console.warn('TenantContext: GLOBAL FAILSAFE triggered');
      setIsLoading(false);
    }, 5000);

    const hostname = window.location.hostname;
    const parts = hostname.split('.');

    let extractedTenant: string | null = null;
    let mainSite = true;

    // Detect if localhost or main domain
    if (
      hostname === 'fahmni.me' ||
      hostname === 'www.fahmni.me' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    ) {
      mainSite = true;
    } else if (parts.length >= 3 && parts[1] === 'fahmni' && parts[2] === 'me') {
      extractedTenant = parts[0];
      if (extractedTenant === 'www') {
        mainSite = true;
        extractedTenant = null;
      } else {
        mainSite = false;
      }
    } else if (parts.length === 2 && parts[1] === 'localhost') {
      extractedTenant = parts[0];
      mainSite = false;
    } else if (parts.length >= 3) {
      extractedTenant = parts[0];
      mainSite = false;
    }

    // 💥 FORCE ALIAS/REDIRECT: dr -> mostafa
    if (extractedTenant === 'dr') {
      localStorage.removeItem(CACHE_KEY_PREFIX + 'dr');
      window.location.href = `https://mostafa.${parts.slice(1).join('.')}`;
      return;
    }

    setTenantId(extractedTenant);
    setIsMainSite(mainSite);

    if (mainSite) {
      initTenantApp();
      setIsLoading(false);
      clearTimeout(globalFailsafe);
      return;
    }

    if (!extractedTenant) {
      initTenantApp();
      setIsLoading(false);
      clearTimeout(globalFailsafe);
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // 🚀 PHASE 1: Instant load from cache (0ms delay)
    // ═══════════════════════════════════════════════════════════
    const cached = getCachedTenant(extractedTenant);
    if (cached) {
      console.log('⚡ TenantContext: Loaded from cache instantly');
      const { _cachedAt, ...cleanData } = cached;
      setTenantData(cleanData);
      applyTenantBranding(cleanData);
      initFirebaseFromTenantData(cleanData);
      initTenantSupabase(cleanData);
      setIsLoading(false);
      clearTimeout(globalFailsafe);
      // Continue to fetch fresh data in background (silent refresh)
    }

    // ═══════════════════════════════════════════════════════════
    // 🔄 PHASE 2: Fetch from Firestore (with silent auto-retry)
    // ═══════════════════════════════════════════════════════════
    const fetchTenant = async (attempt: number): Promise<void> => {
      try {
        const tenantRef = doc(masterDb, 'tenants', extractedTenant!);

        // Timeout: 4500ms first attempt, 6000ms for retries
        const timeoutMs = attempt === 0 ? 4500 : 6000;
        const snapshot = await Promise.race([
          getDoc(tenantRef),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
          ),
        ]);

        if (snapshot.exists()) {
          const data = snapshot.data();
          setTenantId(extractedTenant);
          setTenantData(data);
          applyTenantBranding(data);
          initFirebaseFromTenantData(data);
          initTenantSupabase(data);
          // Cache for next visit
          setCachedTenant(extractedTenant!, data);
        } else {
          // Document truly doesn't exist - only then show not found
          if (!cached) {
            console.warn(`Tenant ${extractedTenant} not found in Firestore.`);
            setTenantNotFound(true);
          }
        }
      } catch (err: any) {
        console.warn(`TenantContext fetch attempt ${attempt + 1} failed:`, err.message);

        // 🔄 Silent auto-retry on network/timeout errors
        if (attempt < MAX_RETRIES - 1) {
          retryCountRef.current = attempt + 1;
          // Exponential backoff: 2s, 4s
          await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
          return fetchTenant(attempt + 1);
        }

        // All retries failed — if no cache, use master as fallback (DON'T show error page on main site, but show connection error on tenant subdomains)
        if (!cached) {
          if (mainSite) {
            console.warn('TenantContext: All retries failed. Using master fallback.');
            initTenantApp();
          } else {
            console.warn('TenantContext: All retries failed on tenant subdomain. Displaying connection error.');
            setConnectionFailed(true);
          }
        }
      } finally {
        setIsLoading(false);
        clearTimeout(globalFailsafe);
      }
    };

    fetchTenant(0);
  }, []);

  if (tenantNotFound) {
    return (
      <div
        className="min-h-screen bg-[#0a0f1e] text-white flex flex-col items-center justify-center p-6 text-center"
        dir="rtl"
      >
        <h1 className="text-4xl font-black mb-4 text-red-500">عذراً، هذه المنصة غير موجودة!</h1>
        <p className="text-gray-400 mb-8 text-lg">
          الرابط الذي تحاول الدخول إليه غير مسجل لدينا. تأكد من صحة الرابط أو تواصل مع الإدارة.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (connectionFailed) {
    return (
      <div
        className="min-h-screen bg-[#0a0f1e] text-white flex flex-col items-center justify-center p-6 text-center"
        dir="rtl"
      >
        <div className="w-20 h-20 bg-blue-500/10 text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
          <WifiOff size={40} />
        </div>
        <h1 className="text-3xl font-black mb-4 text-white">ضعف في الاتصال بالإنترنت</h1>
        <p className="text-gray-400 mb-8 text-lg max-w-md">
          لم نتمكن من الاتصال بالمنصة. يرجى التحقق من اتصالك بالشبكة ثم إعادة المحاولة.
        </p>
        <button
          onClick={() => {
            setConnectionFailed(false);
            setIsLoading(true);
            window.location.reload();
          }}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-blue-600/20 active:scale-95"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <TenantContext.Provider value={{ tenantId, isMainSite, isLoading, tenantData }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
