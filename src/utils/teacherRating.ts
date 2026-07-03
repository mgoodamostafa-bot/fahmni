/**
 * Teacher Rating System
 * Provides functionality for rating and reviewing teachers
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TeacherRating {
  id: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  rating: number; // 1-5
  review?: string;
  courseId?: string;
  courseName?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface TeacherStats {
  teacherId: string;
  averageRating: number;
  totalRatings: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

// Get teacher ratings
export const getTeacherRatings = async (teacherId: string): Promise<TeacherRating[]> => {
  try {
    const ratingsRef = collection(db, 'teacherRatings');
    const q = query(ratingsRef, where('teacherId', '==', teacherId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as TeacherRating[];
  } catch (error) {
    console.error('Error fetching teacher ratings:', error);
    return [];
  }
};

// Get teacher stats
export const getTeacherStats = async (teacherId: string): Promise<TeacherStats> => {
  const ratings = await getTeacherRatings(teacherId);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRating = 0;
  let totalReviews = 0;

  ratings.forEach((rating) => {
    distribution[rating.rating as keyof typeof distribution]++;
    totalRating += rating.rating;
    if (rating.review) totalReviews++;
  });

  return {
    teacherId,
    averageRating: ratings.length > 0 ? totalRating / ratings.length : 0,
    totalRatings: ratings.length,
    totalReviews,
    ratingDistribution: distribution,
  };
};

// Add a rating
export const addRating = async (
  rating: Omit<TeacherRating, 'id' | 'createdAt'>
): Promise<string | null> => {
  try {
    // Check if student already rated this teacher
    const existingRating = await checkExistingRating(rating.teacherId, rating.studentId);
    if (existingRating) {
      throw new Error('لقد قمت بتقييم هذا المدرس بالفعل');
    }

    const ratingsRef = collection(db, 'teacherRatings');
    const docRef = await addDoc(ratingsRef, {
      ...rating,
      createdAt: serverTimestamp(),
    });

    // Update teacher stats
    await updateTeacherStats(rating.teacherId);

    return docRef.id;
  } catch (error) {
    console.error('Error adding rating:', error);
    return null;
  }
};

// Update a rating
export const updateRating = async (
  ratingId: string,
  updates: Partial<Pick<TeacherRating, 'rating' | 'review'>>
): Promise<boolean> => {
  try {
    const ratingRef = doc(db, 'teacherRatings', ratingId);
    await updateDoc(ratingRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    // Get the rating to update stats
    const ratingDoc = await getDoc(ratingRef);
    if (ratingDoc.exists()) {
      await updateTeacherStats(ratingDoc.data().teacherId);
    }

    return true;
  } catch (error) {
    console.error('Error updating rating:', error);
    return false;
  }
};

// Check if student already rated this teacher
const checkExistingRating = async (teacherId: string, studentId: string): Promise<boolean> => {
  try {
    const ratingsRef = collection(db, 'teacherRatings');
    const q = query(
      ratingsRef,
      where('teacherId', '==', teacherId),
      where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking existing rating:', error);
    return false;
  }
};

// Update teacher stats in Firestore
const updateTeacherStats = async (teacherId: string): Promise<void> => {
  const stats = await getTeacherStats(teacherId);

  try {
    const teacherRef = doc(db, 'users', teacherId);
    await updateDoc(teacherRef, {
      'stats.averageRating': stats.averageRating,
      'stats.totalRatings': stats.totalRatings,
      'stats.totalReviews': stats.totalReviews,
      'stats.ratingDistribution': stats.ratingDistribution,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating teacher stats:', error);
  }
};

// Get top-rated teachers
export const getTopRatedTeachers = async (limit: number = 10): Promise<TeacherStats[]> => {
  try {
    const teachersRef = collection(db, 'users');
    const q = query(teachersRef, where('role', '==', 'teacher'));
    const snapshot = await getDocs(q);

    const teachers = snapshot.docs.map((doc) => ({
      teacherId: doc.id,
      ...doc.data(),
    }));

    const statsPromises = teachers.map((teacher) => getTeacherStats(teacher.teacherId));
    const stats = await Promise.all(statsPromises);

    return stats
      .filter((s) => s.totalRatings > 0)
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching top rated teachers:', error);
    return [];
  }
};
