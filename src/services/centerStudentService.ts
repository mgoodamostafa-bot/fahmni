import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  serverTimestamp 
} from 'firebase/firestore';
import { getTenantDb } from '../lib/firebase';

export interface CenterStudent {
  uid: string;
  displayName: string;
  email?: string;
  role: 'student';
  studentType: 'center';
  studentId: string;
  studentPhone?: string;
  fatherPhone?: string;
  motherPhone?: string;
  centerId?: string;
  groupId?: string;
  grade: string;
  level: string;
  schoolName?: string;
  createdAt?: any;
  walletBalance?: number;
  balance?: number;
  teacherId?: string;
  teacherName?: string;
  imageUrl?: string;
  subscriptionType?: 'sessions' | 'monthly';
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  packageName?: string;
  packageId?: string;
  remainingSessions?: number;
  pointsBalance?: number;
}

export const centerStudentService = {
  // Create a new center student in 'center_students' collection
  async createStudent(studentData: Omit<CenterStudent, 'uid'> & { uid?: string }): Promise<string> {
    const db = getTenantDb();
    const uid = studentData.uid || `center_student_${Date.now()}`;
    await setDoc(doc(db, 'center_students', uid), {
      ...studentData,
      uid,
      role: 'student',
      studentType: 'center',
      createdAt: studentData.createdAt || serverTimestamp(),
    });
    return uid;
  },

  // Get all center students with fallback mapping and auto-repair
  async getAllStudents(): Promise<CenterStudent[]> {
    const db = getTenantDb();
    const snap = await getDocs(collection(db, 'center_students'));
    const yearStr = String(new Date().getFullYear());
    const students: CenterStudent[] = [];

    const batch = writeBatch(db);
    let needsBatchCommit = false;
    let autoCounter = 1;

    for (const d of snap.docs) {
      const data = d.data();
      let code = data.studentId || data.student_id || data.studentCode || data.student_code || data.code;
      
      // If code is missing or literally "undefined", auto-assign a clean code
      if (!code || code === 'undefined' || code === 'null') {
        code = yearStr + String(autoCounter).padStart(3, '0');
        autoCounter++;
        batch.update(doc(db, 'center_students', d.id), { studentId: code });
        needsBatchCommit = true;
      }

      students.push({
        uid: d.id,
        ...data,
        studentId: code,
      } as CenterStudent);
    }

    if (needsBatchCommit) {
      try {
        await batch.commit();
        console.log('⚡ [centerStudentService] Auto-repaired missing student codes in Firestore');
      } catch (err) {
        console.warn('⚡ [centerStudentService] Could not batch commit repaired student codes:', err);
      }
    }

    return students;
  },

  // Get student by document ID
  async getStudentByUid(uid: string): Promise<CenterStudent | null> {
    const db = getTenantDb();
    const snap = await getDoc(doc(db, 'center_students', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    const code = data.studentId || data.student_id || data.studentCode || data.student_code || data.code || snap.id;
    return { uid: snap.id, ...data, studentId: code } as CenterStudent;
  },

  // Get student by studentId code with fallback search
  async getStudentByCode(studentId: string): Promise<CenterStudent | null> {
    const db = getTenantDb();
    const cleanCode = studentId.trim();
    let q = query(collection(db, 'center_students'), where('studentId', '==', cleanCode));
    let snap = await getDocs(q);
    
    if (snap.empty) {
      q = query(collection(db, 'center_students'), where('studentCode', '==', cleanCode));
      snap = await getDocs(q);
    }
    if (snap.empty) {
      q = query(collection(db, 'center_students'), where('code', '==', cleanCode));
      snap = await getDocs(q);
    }
    if (snap.empty) {
      q = query(collection(db, 'center_students'), where('student_id', '==', cleanCode));
      snap = await getDocs(q);
    }

    if (snap.empty) return null;
    const data = snap.docs[0].data();
    const resolvedCode = data.studentId || data.student_id || data.studentCode || data.student_code || data.code || snap.docs[0].id;
    return { uid: snap.docs[0].id, ...data, studentId: resolvedCode } as CenterStudent;
  },

  // Update student
  async updateStudent(uid: string, data: Partial<CenterStudent>): Promise<void> {
    const db = getTenantDb();
    const { uid: _, ...updateData } = data as any;
    await setDoc(doc(db, 'center_students', uid), updateData, { merge: true });
  },

  // Delete student
  async deleteStudent(uid: string): Promise<void> {
    const db = getTenantDb();
    await deleteDoc(doc(db, 'center_students', uid));
  },

  // Get students by center
  async getStudentsByCenter(centerId: string): Promise<CenterStudent[]> {
    const db = getTenantDb();
    const q = query(collection(db, 'center_students'), where('centerId', '==', centerId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() } as CenterStudent));
  },

  // Get students by group
  async getStudentsByGroup(groupId: string): Promise<CenterStudent[]> {
    const db = getTenantDb();
    const q = query(collection(db, 'center_students'), where('groupId', '==', groupId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() } as CenterStudent));
  },

  // MIGRATION: Move legacy center students from 'users' to 'center_students'
  async migrateLegacyStudents(): Promise<{ migrated: number; errors: string[] }> {
    const db = getTenantDb();
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('studentType', '==', 'center')
    );
    const snap = await getDocs(q);
    let migrated = 0;
    const errors: string[] = [];
    
    // Process in batches
    const batch = writeBatch(db);
    for (const docSnap of snap.docs) {
      try {
        const data = docSnap.data();
        // Write to center_students
        batch.set(doc(db, 'center_students', docSnap.id), {
          ...data,
          uid: docSnap.id,
          migratedAt: serverTimestamp(),
        });
        // Delete from users
        batch.delete(doc(db, 'users', docSnap.id));
        migrated++;
      } catch (err: any) {
        errors.push(`${docSnap.id}: ${err.message}`);
      }
    }
    
    if (migrated > 0) {
      await batch.commit();
    }
    
    return { migrated, errors };
  },
};
