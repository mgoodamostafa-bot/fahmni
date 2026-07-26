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
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    const isExplicitStandalone = (window as any).VITE_STANDALONE_MODE === 'true' || (import.meta.env.VITE_STANDALONE_MODE as string) === 'true';
    if (isExplicitStandalone) return true;

    const isMaster = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost') || host === 'fahmni.me' || host.endsWith('.fahmni.me');
    return !isMaster || (import.meta.env.VITE_DB_TYPE as string)?.toLowerCase() === 'sqlite';
  },

  async getCollection(collectionName: keyof LocalDbSchema): Promise<any[]> {
    try {
      const res = await fetch(`/api/local-db/${String(collectionName)}`);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) {
          const data = JSON.parse(text);
          if (Array.isArray(data.items)) return data.items;
        }
      }
    } catch (e) {
      console.warn(`REST API unavailable for ${String(collectionName)}, using browser localStorage persistence.`, e);
    }
    // Fallback to browser LocalStorage persistence (e.g. on Vercel static deployments)
    try {
      const localStr = localStorage.getItem(`fahmni_local_db_${String(collectionName)}`);
      if (localStr) return JSON.parse(localStr);
    } catch (e) {}
    return [];
  },

  async saveItem(collectionName: keyof LocalDbSchema, item: any): Promise<boolean> {
    try {
      const res = await fetch(`/api/local-db/${String(collectionName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item })
      });
      if (res.ok) return true;
    } catch (e) {
      console.warn(`REST API save failed for ${String(collectionName)}, saving to browser localStorage.`, e);
    }
    // Fallback save to browser LocalStorage persistence
    try {
      const items = await this.getCollection(collectionName);
      const itemId = item.id || item.uid;
      const existingIdx = items.findIndex((i: any) => (i.id && i.id === itemId) || (i.uid && i.uid === itemId));
      if (existingIdx >= 0) {
        items[existingIdx] = { ...items[existingIdx], ...item };
      } else {
        items.push(item);
      }
      localStorage.setItem(`fahmni_local_db_${String(collectionName)}`, JSON.stringify(items));
      return true;
    } catch (e) {
      console.error(`LocalStorage save failed for ${String(collectionName)}`, e);
      return false;
    }
  },

  async deleteItem(collectionName: keyof LocalDbSchema, itemId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/local-db/${String(collectionName)}/${itemId}`, {
        method: 'DELETE'
      });
      if (res.ok) return true;
    } catch (e) {}
    try {
      let items = await this.getCollection(collectionName);
      items = items.filter((i: any) => i.id !== itemId && i.uid !== itemId);
      localStorage.setItem(`fahmni_local_db_${String(collectionName)}`, JSON.stringify(items));
      return true;
    } catch (e) {
      return false;
    }
  }
};
