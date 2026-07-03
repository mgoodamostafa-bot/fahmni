import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  QueryConstraint,
  DocumentData,
  onSnapshot,
  Unsubscribe,
  limit as firestoreLimit,
  startAfter,
  orderBy,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useEffect, useState, useCallback } from 'react';

// ─── Basic Firestore Query Hook ────────────────────────────────
export function useFirestoreQuery<T = DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  options?: Omit<UseQueryOptions<T[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T[]>({
    queryKey: [collectionName, ...constraints.map((c) => c.toString())],
    queryFn: async () => {
      const q = query(collection(db, collectionName), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
    },
    staleTime: 30000,
    ...options,
  });
}

// ─── Single Document Hook ──────────────────────────────────────
export function useFirestoreDoc<T = DocumentData>(
  collectionName: string,
  docId: string | undefined,
  options?: Omit<UseQueryOptions<T | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T | null>({
    queryKey: [collectionName, docId],
    queryFn: async () => {
      if (!docId) return null;
      const d = await getDoc(doc(db, collectionName, docId));
      return d.exists() ? ({ id: d.id, ...d.data() } as T) : null;
    },
    enabled: !!docId,
    staleTime: 30000,
    ...options,
  });
}

// ─── Realtime Listener Hook ────────────────────────────────────
export function useFirestoreRealtime<T = DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, collectionName), ...constraints);
    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [collectionName]);

  return { data, loading, error };
}

// ─── Paginated Query Hook (Server-Side) ────────────────────────
interface UsePaginatedQueryOptions {
  pageSize?: number;
  orderByField?: string;
  orderByDirection?: 'asc' | 'desc';
  constraints?: QueryConstraint[];
  enabled?: boolean;
}

interface UsePaginatedQueryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
  totalEstimated: number;
}

export function usePaginatedFirestoreQuery<T extends { id: string }>(
  collectionName: string,
  options: UsePaginatedQueryOptions = {}
): UsePaginatedQueryResult<T> {
  const {
    pageSize = 25,
    orderByField = 'createdAt',
    orderByDirection = 'desc',
    constraints = [],
    enabled = true,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalEstimated, setTotalEstimated] = useState(0);
  const cursorsRef = useState<Map<number, DocumentSnapshot>>(new Map())[0];

  const fetchData = useCallback(
    async (targetPage: number) => {
      if (!enabled) return;
      setLoading(true);
      setError(null);

      try {
        const colRef = collection(db, collectionName);
        const queryConstraints: QueryConstraint[] = [
          orderBy(orderByField, orderByDirection),
          ...constraints,
          firestoreLimit(pageSize + 1),
        ];

        const cursor = cursorsRef.get(targetPage - 1);
        if (cursor) {
          // Replace orderBy + limit with startAfter + limit
          queryConstraints.length = 0;
          queryConstraints.push(
            orderBy(orderByField, orderByDirection),
            ...constraints,
            startAfter(cursor),
            firestoreLimit(pageSize + 1)
          );
        }

        const q = query(colRef, ...queryConstraints);
        const snapshot = await getDocs(q);

        const docs = snapshot.docs;
        const hasMoreData = docs.length > pageSize;
        const items = docs.slice(0, pageSize).map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];

        if (hasMoreData && docs[pageSize]) {
          cursorsRef.set(targetPage, docs[pageSize - 1]);
        }

        setData(items);
        setHasMore(hasMoreData);
        setTotalEstimated(targetPage * pageSize + (hasMoreData ? pageSize : 0));
      } catch (err: any) {
        console.error('Pagination error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [collectionName, pageSize, constraints, orderByField, orderByDirection, enabled]
  );

  useEffect(() => {
    fetchData(page);
  }, [page, fetchData]);

  const nextPage = useCallback(() => {
    if (hasMore) setPage((p) => p + 1);
  }, [hasMore]);

  const prevPage = useCallback(() => {
    if (page > 1) setPage((p) => p - 1);
  }, [page]);

  const refresh = useCallback(() => {
    cursorsRef.clear();
    setPage(1);
    fetchData(1);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    hasMore,
    page,
    setPage,
    nextPage,
    prevPage,
    refresh,
    totalEstimated,
  };
}
