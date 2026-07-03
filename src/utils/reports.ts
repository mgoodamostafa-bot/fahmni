/**
 * Advanced Reports Utility
 * Provides functions for generating detailed reports
 */

import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Report types
export type ReportType =
  | 'student_progress'
  | 'course_analytics'
  | 'teacher_performance'
  | 'revenue'
  | 'attendance'
  | 'exam_results';

export interface ReportFilter {
  startDate?: Date;
  endDate?: Date;
  teacherId?: string;
  courseId?: string;
  studentId?: string;
  grade?: string;
}

export interface ReportData {
  type: ReportType;
  title: string;
  titleAr: string;
  generatedAt: Date;
  filters: ReportFilter;
  data: unknown[];
  summary?: ReportSummary;
}

export interface ReportSummary {
  totalStudents?: number;
  totalCourses?: number;
  totalRevenue?: number;
  averageRating?: number;
  completionRate?: number;
}

// Generate student progress report
export const generateStudentProgressReport = async (filters: ReportFilter): Promise<ReportData> => {
  const students = await getStudents(filters);
  const enrollments = await getEnrollments(filters);
  const progress = await getProgressData(filters);

  const summary: ReportSummary = {
    totalStudents: students.length,
    completionRate: calculateCompletionRate(progress),
  };

  return {
    type: 'student_progress',
    title: 'Student Progress Report',
    titleAr: 'تقرير تقدم الطلاب',
    generatedAt: new Date(),
    filters,
    data: students.map((student) => ({
      ...student,
      enrollments: enrollments.filter((e) => e.studentId === student.id),
      progress: progress.filter((p) => p.studentId === student.id),
    })),
    summary,
  };
};

// Generate course analytics report
export const generateCourseAnalyticsReport = async (filters: ReportFilter): Promise<ReportData> => {
  const courses = await getCourses(filters);
  const enrollments = await getEnrollments(filters);
  const reviews = await getCourseReviews(filters);

  const summary: ReportSummary = {
    totalCourses: courses.length,
    totalStudents: enrollments.length,
    averageRating: calculateAverageRating(reviews),
  };

  return {
    type: 'course_analytics',
    title: 'Course Analytics Report',
    titleAr: 'تقرير تحليلات الكورسات',
    generatedAt: new Date(),
    filters,
    data: courses.map((course) => ({
      ...course,
      enrollmentCount: enrollments.filter((e) => e.courseId === course.id).length,
      reviews: reviews.filter((r) => r.courseId === course.id),
    })),
    summary,
  };
};

// Generate revenue report
export const generateRevenueReport = async (filters: ReportFilter): Promise<ReportData> => {
  const transactions = await getTransactions(filters);

  const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const summary: ReportSummary = {
    totalRevenue,
  };

  return {
    type: 'revenue',
    title: 'Revenue Report',
    titleAr: 'تقرير الإيرادات',
    generatedAt: new Date(),
    filters,
    data: transactions,
    summary,
  };
};

// Helper functions
const getStudents = async (filters: ReportFilter): Promise<Record<string, any>[]> => {
  try {
    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching students:', error);
    return [];
  }
};

const getCourses = async (filters: ReportFilter): Promise<Record<string, any>[]> => {
  try {
    const q = query(collection(db, 'Courses'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching courses:', error);
    return [];
  }
};

const getEnrollments = async (filters: ReportFilter): Promise<Record<string, any>[]> => {
  try {
    const q = query(collection(db, 'Enrollments'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    return [];
  }
};

const getProgressData = async (filters: ReportFilter): Promise<Record<string, any>[]> => {
  try {
    const q = query(collection(db, 'progress'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching progress:', error);
    return [];
  }
};

const getTransactions = async (filters: ReportFilter): Promise<Record<string, any>[]> => {
  try {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
};

const getCourseReviews = async (filters: ReportFilter): Promise<Record<string, any>[]> => {
  try {
    const q = query(collection(db, 'courseReviews'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }
};

const calculateCompletionRate = (progress: unknown[]): number => {
  if (progress.length === 0) return 0;
  const completed = progress.filter((p: any) => p.completed).length;
  return (completed / progress.length) * 100;
};

const calculateAverageRating = (reviews: unknown[]): number => {
  if (reviews.length === 0) return 0;
  const total = reviews.reduce<number>((sum, r: any) => sum + (r.rating || 0), 0);
  return total / reviews.length;
};

// Export report as CSV
export const exportReportAsCsv = (report: ReportData): string => {
  if (report.data.length === 0) return '';

  const headers = Object.keys(report.data[0] as object);
  const rows = report.data.map((item) =>
    headers.map((h) => String((item as any)[h] || '')).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
};

// Download report
export const downloadReport = (report: ReportData, format: 'csv' | 'json' = 'csv'): void => {
  let content: string;
  let mimeType: string;
  let extension: string;

  if (format === 'csv') {
    content = exportReportAsCsv(report);
    mimeType = 'text/csv;charset=utf-8;';
    extension = 'csv';
  } else {
    content = JSON.stringify(report, null, 2);
    mimeType = 'application/json;charset=utf-8;';
    extension = 'json';
  }

  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${report.titleAr}_${new Date().toISOString().split('T')[0]}.${extension}`;
  link.click();
  URL.revokeObjectURL(link.href);
};
