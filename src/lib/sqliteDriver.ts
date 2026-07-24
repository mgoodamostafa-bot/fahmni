// ============================================================
// FAHMNI SELF-HOSTED LOCAL ENGINE (SQLITE & LOCAL FILE STORE)
// ============================================================

export interface LocalDbSchema {
  tenants: any[];
  users: any[];
  center_students: any[];
  attendance_logs: any[];
  groups: any[];
  center_branches: any[];
  offline_results: any[];
  courses: any[];
  lessons: any[];
  homework_submissions: any[];
  question_banks: any[];
  questions: any[];
  exams: any[];
  examResults: any[];
  certificates: any[];
  chargeCards: any[];
  walletTransactions: any[];
  site_settings: any[];
  notifications: any[];
  revisions: any[];
}

export function createInitialLocalSchema(): LocalDbSchema {
  return {
    tenants: [],
    users: [],
    center_students: [],
    attendance_logs: [],
    groups: [],
    center_branches: [],
    offline_results: [],
    courses: [],
    lessons: [],
    homework_submissions: [],
    question_banks: [],
    questions: [],
    exams: [],
    examResults: [],
    certificates: [],
    chargeCards: [],
    walletTransactions: [],
    site_settings: [],
    notifications: [],
    revisions: []
  };
}

/**
 * Universal Local Storage Helper for Standalone Server Deployments
 */
export const LocalDbDriver = {
  isSelfHosted(): boolean {
    return (import.meta.env.VITE_DB_TYPE as string)?.toLowerCase() === 'sqlite' ||
           (import.meta.env.VITE_STANDALONE_MODE as string) === 'true';
  },

  async getCollection(collectionName: keyof LocalDbSchema): Promise<any[]> {
    try {
      const res = await fetch(`/api/local-db/${String(collectionName)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    } catch (e) {
      console.warn(`LocalDbDriver fetch failed for ${String(collectionName)}`, e);
      return [];
    }
  },

  async saveItem(collectionName: keyof LocalDbSchema, item: any): Promise<boolean> {
    try {
      const res = await fetch(`/api/local-db/${String(collectionName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item })
      });
      return res.ok;
    } catch (e) {
      console.error(`LocalDbDriver save failed for ${String(collectionName)}`, e);
      return false;
    }
  },

  async deleteItem(collectionName: keyof LocalDbSchema, itemId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/local-db/${String(collectionName)}/${itemId}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (e) {
      console.error(`LocalDbDriver delete failed for ${String(collectionName)}`, e);
      return false;
    }
  }
};
