import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  DocumentSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

interface UseFirestorePaginationOptions {
  collectionName: string;
  pageSize?: number;
  constraints?: QueryConstraint[];
  orderByField?: string;
  orderByDirection?: 'asc' | 'desc';
  realtime?: boolean;
}

interface UseFirestorePaginationResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalEstimated: number;
  page: number;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
}

export function useFirestorePagination<T extends { id: string }>({
  collectionName,
  pageSize = 25,
  constraints = [],
  orderByField = 'createdAt',
  orderByDirection = 'desc',
  realtime = false,
}: UseFirestorePaginationOptions): UseFirestorePaginationResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalEstimated, setTotalEstimated] = useState(0);

  // Store cursors for each page (startAfter document snapshots)
  const cursorsRef = useRef<Map<number, DocumentSnapshot>>(new Map());
  const currentPageRef = useRef(1);

  const fetchData = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);

      try {
        const colRef = collection(db, collectionName);
        const queryConstraints: QueryConstraint[] = [
          orderBy(orderByField, orderByDirection),
          ...constraints,
          limit(pageSize + 1), // Fetch one extra to check if there's more
        ];

        // If we have a cursor for this page, use it
        const cursor = cursorsRef.current.get(targetPage - 1);
        if (cursor) {
          queryConstraints.splice(constraints.length, 1, startAfter(cursor));
          // Re-add limit after startAfter
          queryConstraints.push(limit(pageSize + 1));
        }

        const q = query(colRef, ...queryConstraints);
        const snapshot = await getDocs(q);

        const docs = snapshot.docs;
        const hasMoreData = docs.length > pageSize;
        const items = docs.slice(0, pageSize).map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];

        // Store cursor for next page
        if (hasMoreData && docs[pageSize]) {
          cursorsRef.current.set(targetPage, docs[pageSize - 1]);
        }

        setData(items);
        setHasMore(hasMoreData);
        setTotalEstimated(targetPage * pageSize + (hasMoreData ? pageSize : 0));
        currentPageRef.current = targetPage;
      } catch (err: any) {
        console.error('Firestore pagination error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [collectionName, pageSize, constraints, orderByField, orderByDirection]
  );

  // Fetch data when page changes
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
    cursorsRef.current.clear();
    setPage(1);
    fetchData(1);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    hasMore,
    totalEstimated,
    page,
    setPage,
    nextPage,
    prevPage,
    refresh,
  };
}
