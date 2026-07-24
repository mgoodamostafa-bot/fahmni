// ============================================================
// FAHMNI SELF-HOSTED LOCAL ENGINE (SQLITE & LOCAL FILE STORE)
// ============================================================

export interface LocalDbSchema {
  tenants: any[];
  users: any[];
  courses: any[];
  lessons: any[];
  exams: any[];
  questions: any[];
  examResults: any[];
  chargeCards: any[];
  walletTransactions: any[];
}

export function createInitialLocalSchema(): LocalDbSchema {
  return {
    tenants: [],
    users: [],
    courses: [],
    lessons: [],
    exams: [],
    questions: [],
    examResults: [],
    chargeCards: [],
    walletTransactions: []
  };
}

/**
 * Universal Local Storage Helper for Standalone Server Deployments
 */
export const LocalDbDriver = {
  isSelfHosted(): boolean {
    return (import.meta.env.VITE_DB_TYPE as string)?.toLowerCase() === 'sqlite' ||
           (import.meta.env.VITE_STANDALONE_MODE as string) === 'true';
  }
};
