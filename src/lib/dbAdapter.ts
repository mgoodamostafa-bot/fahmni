// ============================================================
// FAHMNI UNIVERSAL DATABASE ADAPTER (FIREBASE + MYSQL / POSTGRES)
// ============================================================

export type DatabaseEngineType = 'firebase' | 'mysql' | 'postgres' | 'supabase';

export interface DatabaseConfig {
  engine: DatabaseEngineType;
  firebaseConfig?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  mysqlHost?: string;
  mysqlUser?: string;
  mysqlPassword?: string;
  mysqlDatabase?: string;
}

/**
 * Resolves current tenant's active database engine configuration
 */
export function getActiveDatabaseEngine(): DatabaseEngineType {
  const envEngine = (import.meta.env.VITE_DB_TYPE as string)?.toLowerCase();
  if (envEngine === 'mysql' || envEngine === 'postgres' || envEngine === 'supabase') {
    return envEngine as DatabaseEngineType;
  }
  
  const windowTenant = (window as any).VITE_TENANT_DATA;
  if (windowTenant?.dbEngine) {
    return windowTenant.dbEngine;
  }
  
  return 'firebase';
}

/**
 * Universal Database Utility Helper
 */
export const DbAdapter = {
  getEngine(): DatabaseEngineType {
    return getActiveDatabaseEngine();
  },

  isSqlEngine(): boolean {
    const engine = this.getEngine();
    return engine === 'mysql' || engine === 'postgres' || engine === 'supabase';
  },

  isFirebaseEngine(): boolean {
    return this.getEngine() === 'firebase';
  }
};
