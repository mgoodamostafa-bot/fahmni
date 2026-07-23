import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { dbRouter } from '../services/dbRouter';

export interface Center {
  id: string;
  name: string;
  location: string;
  contact?: string;
}

export interface Group {
  id: string;
  name: string;
  centerId: string;
  day: string;
  time: string;
  capacity?: number;
  subjectId?: string;
  teacherId?: string;
}

export interface Student {
  uid: string;
  displayName: string;
  studentId: string;
  studentPhone?: string;
  fatherPhone?: string;
  motherPhone?: string;
  centerId?: string;
  groupId?: string;
  grade: string;
  level: string;
  schoolName?: string;
  createdAt?: string;
  walletBalance?: number;
  balance?: number;
}

export const useCenterData = () => {
  const [centers, setCenters] = useState<Center[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [allCenterStudents, setAllCenterStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch centers
      const centersSnap = await getDocs(collection(db, 'centers'));
      const centersList = centersSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Center
      );
      setCenters(centersList);

      // 2. Fetch groups
      const groupsSnap = await getDocs(collection(db, 'groups'));
      const groupsList = groupsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Group
      );
      setGroups(groupsList);

      // 3. Fetch center students
      const studentsList = (await dbRouter.getAllStudents()) as Student[];
      setAllCenterStudents(studentsList);
    } catch (err: any) {
      console.error('Error loading center system data:', err);
      setError(err.message || 'فشل تحميل بيانات السنتر');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    centers,
    groups,
    allCenterStudents,
    loading,
    error,
    refreshData: loadData,
  };
};
