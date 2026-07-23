import { createClient, SupabaseClient } from '@supabase/supabase-js';

export let supabase: SupabaseClient | null = null;

export const getTenantSupabase = () => supabase;

export const isSupabaseConfigured = () => supabase !== null;

export const initTenantSupabase = (tenantData?: any) => {
  const url = tenantData?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = tenantData?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  if (url && anonKey) {
    try {
      supabase = createClient(url, anonKey);
      console.log('⚡ [SYSTEM VERIFIED] TENANT SUPABASE CLIENT INITIALIZED');
    } catch (err) {
      console.error('Error initializing Supabase client:', err);
      supabase = null;
    }
  } else {
    supabase = null;
  }
};
