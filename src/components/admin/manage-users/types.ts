// ─── Shared Types for ManageUsers ──────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | 'teacher' | 'admin';
  createdAt: string;
  status?: 'active' | 'inactive';
  deviceId?: string | null;
  deviceIds?: string[];
  maxDevicesAllowed?: number;
  level?: string;
  grade?: string;
  studentId?: string;
  walletBalance?: number;
  balance?: number;
  lastActive?: string;
  studentType?: 'online' | 'center';
  parentPhone?: string;
  centerName?: string;
  attendance?: string[];
  enrolledCourses?: string[];
  groupId?: string;
  defaultCommission?: number;
  devices?: Device[];
  accountStatus?: 'active' | 'blocked';
}

export interface Device {
  id: string;
  name?: string;
  lastLogin?: string;
}

export interface ProgressData {
  id: string;
  courseId: string;
  courseTitle?: string;
  completedLessons: string[];
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'purchase';
  amount: number;
  date: { seconds: number; nanoseconds: number } | null;
  courseName?: string;
  codeUsed?: string;
  userId: string;
  userName?: string;
  teacherShare?: number;
  platformShare?: number;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: 'active' | 'pending' | 'rejected';
  paymentMethod: string;
  createdAt: { seconds: number; nanoseconds: number } | null;
  userEmail?: string;
  courseTitle?: string;
}

export type SortField = 'displayName' | 'email' | 'role' | 'status' | 'createdAt';
export type SortOrder = 'asc' | 'desc';
export type ActiveTab = 'students' | 'transactions' | 'enrollments' | 'attendance';

export const LEVELS = [
  'أولى ثانوي',
  'تانية ثانوي',
  'تالتة ثانوي',
  'أولى إعدادي',
  'تانية إعدادي',
  'تالتة إعدادي',
];
