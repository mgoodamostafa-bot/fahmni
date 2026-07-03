/**
 * Multi-tenant Utilities
 * Provides enhanced tenant management and isolation
 */

import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { masterDb, initTenantApp } from '../lib/firebase';

export interface TenantConfig {
  id: string;
  name: string;
  subdomain: string;
  logo?: string;
  primaryColor?: string;
  fruitTheme?: string;
  firebaseConfig?: string;
  teacherName?: string;
  teacherTitle?: string;
  teacherPhoto?: string;
  slogan?: string;
  subject?: string;
  whatsapp?: string;
  facebook?: string;
  youtube?: string;
  telegram?: string;
  instagram?: string;
  heroImage?: string;
  platformMode?: 'single' | 'multi';
  status?: 'active' | 'inactive' | 'suspended';
  createdAt?: Date;
  updatedAt?: Date;
}

// Tenant cache for performance
const tenantCache = new Map<string, { data: TenantConfig; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get tenant by subdomain
 */
export const getTenantBySubdomain = async (subdomain: string): Promise<TenantConfig | null> => {
  // Check cache first
  const cached = tenantCache.get(subdomain);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const tenantRef = doc(masterDb, 'tenants', subdomain);
    const snapshot = await getDoc(tenantRef);

    if (snapshot.exists()) {
      const data = { id: snapshot.id, ...snapshot.data() } as TenantConfig;
      tenantCache.set(subdomain, { data, timestamp: Date.now() });
      return data;
    }

    return null;
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return null;
  }
};

/**
 * Get all active tenants
 */
export const getAllTenants = async (): Promise<TenantConfig[]> => {
  try {
    const tenantsRef = collection(masterDb, 'tenants');
    const q = query(tenantsRef, where('status', '==', 'active'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as TenantConfig[];
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return [];
  }
};

/**
 * Update tenant configuration
 */
export const updateTenant = async (
  tenantId: string,
  data: Partial<TenantConfig>
): Promise<boolean> => {
  try {
    const tenantRef = doc(masterDb, 'tenants', tenantId);
    await setDoc(tenantRef, { ...data, updatedAt: new Date() }, { merge: true });

    // Invalidate cache
    tenantCache.delete(tenantId);

    return true;
  } catch (error) {
    console.error('Error updating tenant:', error);
    return false;
  }
};

/**
 * Validate tenant subdomain
 */
export const validateSubdomain = (subdomain: string): { valid: boolean; error?: string } => {
  if (!subdomain) {
    return { valid: false, error: 'الرابط الفرعي مطلوب' };
  }

  if (subdomain.length < 3) {
    return { valid: false, error: 'الرابط الفرعي يجب أن يكون 3 أحرف على الأقل' };
  }

  if (subdomain.length > 30) {
    return { valid: false, error: 'الرابط الفرعي يجب أن يكون 30 حرف على الأكثر' };
  }

  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    return {
      valid: false,
      error: 'الرابط الفرعي يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط',
    };
  }

  const reserved = ['www', 'admin', 'api', 'mail', 'ftp', 'support'];
  if (reserved.includes(subdomain)) {
    return { valid: false, error: 'هذا الرابط محجوز ولا يمكن استخدامه' };
  }

  return { valid: true };
};

/**
 * Extract tenant from hostname
 */
export const extractTenantFromHostname = (hostname: string): string | null => {
  const parts = hostname.split('.');

  // Main domain
  if (hostname === 'fahmni.me' || hostname === 'www.fahmni.me') {
    return null;
  }

  // Subdomain: tenant.fahmni.me
  if (parts.length >= 3 && parts[1] === 'fahmni' && parts[2] === 'me') {
    const subdomain = parts[0];
    return subdomain === 'www' ? null : subdomain;
  }

  // Localhost: tenant.localhost
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0];
  }

  return null;
};

/**
 * Initialize tenant Firebase app
 */
export const initializeTenant = async (tenantId: string): Promise<boolean> => {
  const tenant = await getTenantBySubdomain(tenantId);

  if (!tenant) {
    return false;
  }

  if (tenant.firebaseConfig) {
    initTenantApp(tenant.firebaseConfig);
  }

  return true;
};
