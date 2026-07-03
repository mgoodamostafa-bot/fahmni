import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  getCountFromServer,
  QueryConstraint,
  DocumentData,
  QuerySnapshot,
} from 'firebase/firestore';
import { getTenantDb } from '../lib/firebase';

/**
 * Queries a Firestore collection, trying lowercase first, then falling back to uppercase.
 * All NEW data should use lowercase collection names only.
 */
export async function smartGetDocs(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<DocumentData[]> {
  const lower = collectionName.charAt(0).toLowerCase() + collectionName.slice(1);
  const upper = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

  try {
    if (lower === upper) return await queryCollection(lower, constraints);
    const [lowerSnap, upperSnap] = await Promise.allSettled([
      queryCollection(lower, constraints),
      queryCollection(upper, constraints),
    ]);
    const map = new Map<string, DocumentData>();
    for (const result of [lowerSnap, upperSnap]) {
      if (result.status === 'fulfilled') {
        result.value.forEach((d) => map.set(d.id, d));
      }
    }
    return Array.from(map.values());
  } catch (error) {
    console.error(`Error querying ${collectionName}:`, error);
    return [];
  }
}

async function queryCollection(
  name: string,
  constraints: QueryConstraint[]
): Promise<DocumentData[]> {
  const snap = await getDocs(query(collection(getTenantDb(), name), ...constraints));
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Fetches a single document, checking lowercase collection first, then falling back to uppercase.
 */
export async function smartGetDoc(
  collectionName: string,
  docId: string
): Promise<DocumentData | null> {
  const lower = collectionName.charAt(0).toLowerCase() + collectionName.slice(1);
  const upper = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

  try {
    const docRefLower = doc(getTenantDb(), lower, docId);
    const snapLower = await getDoc(docRefLower);
    if (snapLower.exists()) {
      return { id: snapLower.id, ...snapLower.data() };
    }
    if (lower !== upper) {
      const docRefUpper = doc(getTenantDb(), upper, docId);
      const snapUpper = await getDoc(docRefUpper);
      if (snapUpper.exists()) {
        return { id: snapUpper.id, ...snapUpper.data() };
      }
    }
  } catch (error) {
    console.error(`Error fetching document ${docId} from ${collectionName}:`, error);
  }
  return null;
}

/**
 * Counts documents in a collection (and its uppercase fallback if they differ) matching the constraints.
 */
export async function smartCount(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<number> {
  const lower = collectionName.charAt(0).toLowerCase() + collectionName.slice(1);
  const upper = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

  try {
    if (lower === upper) {
      const q = query(collection(getTenantDb(), lower), ...constraints);
      const snap = await getCountFromServer(q);
      return snap.data().count;
    }
    const [lowerCount, upperCount] = await Promise.allSettled([
      getCountFromServer(query(collection(getTenantDb(), lower), ...constraints)),
      getCountFromServer(query(collection(getTenantDb(), upper), ...constraints)),
    ]);
    let count = 0;
    if (lowerCount.status === 'fulfilled') count += lowerCount.value.data().count;
    if (upperCount.status === 'fulfilled') count += upperCount.value.data().count;
    return count;
  } catch (error) {
    console.error(`Error counting ${collectionName}:`, error);
    return 0;
  }
}

/**
 * Chunks a large array into smaller pieces (useful for Firestore 'in' queries limited to 10 or 30).
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

