import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { centerStudentService, CenterStudent } from './centerStudentService';

// Data mapping helper: JS Object -> SQL DB Rows (snake_case)
export function mapStudentToSql(student: Partial<CenterStudent>) {
  const sql: any = {};
  if (student.uid !== undefined) sql.uid = student.uid;
  if (student.displayName !== undefined) sql.display_name = student.displayName;
  if (student.email !== undefined) sql.email = student.email;
  if (student.role !== undefined) sql.role = student.role;
  if (student.studentType !== undefined) sql.student_type = student.studentType;
  if (student.studentId !== undefined) sql.student_id = student.studentId;
  if (student.studentPhone !== undefined) sql.student_phone = student.studentPhone;
  if (student.fatherPhone !== undefined) sql.father_phone = student.fatherPhone;
  if (student.motherPhone !== undefined) sql.mother_phone = student.motherPhone;
  if (student.centerId !== undefined) sql.center_id = student.centerId;
  if (student.groupId !== undefined) sql.group_id = student.groupId;
  if (student.grade !== undefined) sql.grade = student.grade;
  if (student.level !== undefined) sql.level = student.level;
  if (student.schoolName !== undefined) sql.school_name = student.schoolName;
  if (student.walletBalance !== undefined) sql.wallet_balance = student.walletBalance;
  if (student.balance !== undefined) sql.balance = student.balance;
  if (student.teacherId !== undefined) sql.teacher_id = student.teacherId;
  if (student.teacherName !== undefined) sql.teacher_name = student.teacherName;
  if (student.imageUrl !== undefined) sql.image_url = student.imageUrl;
  if (student.packageName !== undefined) sql.package_name = student.packageName;
  if (student.packageId !== undefined) sql.package_id = student.packageId;
  if (student.remainingSessions !== undefined) sql.remaining_sessions = student.remainingSessions;
  if (student.pointsBalance !== undefined) sql.points_balance = student.pointsBalance;
  if (student.subscriptionType !== undefined) sql.subscription_type = student.subscriptionType;
  if (student.subscriptionStartDate !== undefined) sql.subscription_start_date = student.subscriptionStartDate === "" ? null : student.subscriptionStartDate;
  if (student.subscriptionEndDate !== undefined) sql.subscription_end_date = student.subscriptionEndDate === "" ? null : student.subscriptionEndDate;
  if (student.createdAt !== undefined) {
    sql.created_at = student.createdAt instanceof Date ? student.createdAt.toISOString() : student.createdAt;
  }
  return sql;
}

// Data mapping helper: SQL DB Rows (snake_case) -> JS Object (camelCase)
function mapSqlToStudent(sql: any): CenterStudent {
  return {
    uid: sql.uid,
    displayName: sql.display_name,
    email: sql.email,
    role: sql.role,
    studentType: sql.student_type,
    studentId: sql.student_id || sql.studentId || sql.student_code || sql.studentCode || sql.code || sql.uid,
    studentPhone: sql.student_phone,
    fatherPhone: sql.father_phone,
    motherPhone: sql.mother_phone,
    centerId: sql.center_id,
    groupId: sql.group_id,
    grade: sql.grade,
    level: sql.level,
    schoolName: sql.school_name,
    createdAt: sql.created_at,
    walletBalance: Number(sql.wallet_balance || 0),
    balance: Number(sql.balance || 0),
    teacherId: sql.teacher_id,
    teacherName: sql.teacher_name,
    imageUrl: sql.image_url,
    packageName: sql.package_name || sql.packageName,
    packageId: sql.package_id || sql.packageId,
    remainingSessions: Number(sql.remaining_sessions || sql.remainingSessions || 0),
    pointsBalance: Number(sql.points_balance || sql.pointsBalance || 0),
    subscriptionType: sql.subscription_type || sql.subscriptionType,
    subscriptionStartDate: sql.subscription_start_date || sql.subscriptionStartDate,
    subscriptionEndDate: sql.subscription_end_date || sql.subscriptionEndDate,
  };
}

// Helper to merge Firestore custom fields for package, points, and subscriptions
async function mergeFirestoreDataForStudents(students: CenterStudent[]): Promise<CenterStudent[]> {
  try {
    const firestoreStudents = await centerStudentService.getAllStudents();
    const fsMap = new Map(firestoreStudents.map(s => [s.uid, s]));
    return students.map(s => {
      const fsStud = fsMap.get(s.uid);
      if (fsStud) {
        return {
          ...s,
          packageId: fsStud.packageId || s.packageId,
          packageName: fsStud.packageName || s.packageName,
          remainingSessions: fsStud.remainingSessions !== undefined ? fsStud.remainingSessions : s.remainingSessions,
          pointsBalance: fsStud.pointsBalance !== undefined ? fsStud.pointsBalance : s.pointsBalance,
          subscriptionType: fsStud.subscriptionType || s.subscriptionType,
          subscriptionStartDate: fsStud.subscriptionStartDate || s.subscriptionStartDate,
          subscriptionEndDate: fsStud.subscriptionEndDate || s.subscriptionEndDate,
        };
      }
      return s;
    });
  } catch (err) {
    console.warn('⚡ [DB ROUTER] Failed to merge Firestore data:', err);
    return students;
  }
}

async function mergeFirestoreDataForStudent(student: CenterStudent | null): Promise<CenterStudent | null> {
  if (!student) return null;
  try {
    const fsStud = await centerStudentService.getStudentByUid(student.uid);
    if (fsStud) {
      return {
        ...student,
        packageId: fsStud.packageId || student.packageId,
        packageName: fsStud.packageName || student.packageName,
        remainingSessions: fsStud.remainingSessions !== undefined ? fsStud.remainingSessions : student.remainingSessions,
        pointsBalance: fsStud.pointsBalance !== undefined ? fsStud.pointsBalance : student.pointsBalance,
        subscriptionType: fsStud.subscriptionType || student.subscriptionType,
        subscriptionStartDate: fsStud.subscriptionStartDate || student.subscriptionStartDate,
        subscriptionEndDate: fsStud.subscriptionEndDate || student.subscriptionEndDate,
      };
    }
  } catch (err) {
    console.warn('⚡ [DB ROUTER] Failed to merge Firestore data for student:', err);
  }
  return student;
}

export const dbRouter = {
  // 1. Create student
  async createStudent(studentData: Omit<CenterStudent, 'uid'> & { uid?: string }): Promise<string> {
    if (isSupabaseConfigured() && supabase) {
      console.log('⚡ [DB ROUTER] Writing student to Supabase...');
      const uid = studentData.uid || `center_student_${Date.now()}`;
      const newStudent = {
        ...studentData,
        uid,
        role: 'student' as const,
        studentType: 'center' as const,
        createdAt: studentData.createdAt || new Date().toISOString(),
      };
      const sqlData = mapStudentToSql(newStudent);
      const { error } = await supabase.from('center_students').insert(sqlData);
      if (!error) {
        return uid;
      } else {
        console.error('Supabase write error, falling back:', error);
      }
    }
    return await centerStudentService.createStudent(studentData);
  },

  // 2. Get all students (merges Supabase and Firestore records to guarantee 100% full list)
  async getAllStudents(): Promise<CenterStudent[]> {
    let supabaseStudents: CenterStudent[] = [];
    if (isSupabaseConfigured() && supabase) {
      try {
        console.log('⚡ [DB ROUTER] Fetching all students from Supabase...');
        const { data, error } = await supabase.from('center_students').select('*');
        if (!error && data) {
          supabaseStudents = data.map(mapSqlToStudent);
        }
      } catch (err) {
        console.warn('⚡ [DB ROUTER] Supabase fetch error:', err);
      }
    }

    const firestoreStudents = await centerStudentService.getAllStudents();

    if (supabaseStudents.length === 0) {
      return firestoreStudents;
    }

    const map = new Map<string, CenterStudent>();
    
    // Add Firestore students first
    firestoreStudents.forEach((s) => {
      const key = (s.uid || s.studentId || s.displayName).trim();
      map.set(key, s);
    });

    // Merge Supabase students
    supabaseStudents.forEach((s) => {
      const key = (s.uid || s.studentId || s.displayName).trim();
      if (!map.has(key)) {
        map.set(key, s);
      } else {
        map.set(key, { ...map.get(key), ...s });
      }
    });

    return Array.from(map.values());
  },

  // 3. Get student by Uid
  async getStudentByUid(uid: string): Promise<CenterStudent | null> {
    if (isSupabaseConfigured() && supabase) {
      console.log('⚡ [DB ROUTER] Fetching student by UID from Supabase...');
      const { data, error } = await supabase
        .from('center_students')
        .select('*')
        .eq('uid', uid)
        .maybeSingle();
      if (!error && data) {
        const student = mapSqlToStudent(data);
        return await mergeFirestoreDataForStudent(student);
      }
    }
    return await centerStudentService.getStudentByUid(uid);
  },

  // 4. Get student by studentId code
  async getStudentByCode(studentId: string): Promise<CenterStudent | null> {
    if (isSupabaseConfigured() && supabase) {
      console.log('⚡ [DB ROUTER] Fetching student by code from Supabase...');
      const { data, error } = await supabase
        .from('center_students')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();
      if (!error && data) {
        const student = mapSqlToStudent(data);
        return await mergeFirestoreDataForStudent(student);
      }
    }
    return await centerStudentService.getStudentByCode(studentId);
  },

  // 5. Update student
  async updateStudent(uid: string, data: Partial<CenterStudent>): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      console.log('⚡ [DB ROUTER] Updating student in Supabase...');
      const sqlData = mapStudentToSql(data);
      const { error } = await supabase.from('center_students').update(sqlData).eq('uid', uid);
      if (error) {
        console.error('Supabase update error, falling back:', error);
      }
    }
    await centerStudentService.updateStudent(uid, data);
  },

  // 6. Delete student
  async deleteStudent(uid: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      console.log('⚡ [DB ROUTER] Deleting student from Supabase...');
      const { error } = await supabase.from('center_students').delete().eq('uid', uid);
      if (error) {
        console.error('Supabase delete error, falling back:', error);
      }
    }
    await centerStudentService.deleteStudent(uid);
  },

  // 7. Get students by center
  async getStudentsByCenter(centerId: string): Promise<CenterStudent[]> {
    if (isSupabaseConfigured() && supabase) {
      console.log('⚡ [DB ROUTER] Fetching students by center from Supabase...');
      const { data, error } = await supabase
        .from('center_students')
        .select('*')
        .eq('center_id', centerId);
      if (!error && data) {
        const students = data.map(mapSqlToStudent);
        return await mergeFirestoreDataForStudents(students);
      }
    }
    return await centerStudentService.getStudentsByCenter(centerId);
  },

  // 8. Get students by group
  async getStudentsByGroup(groupId: string): Promise<CenterStudent[]> {
    if (isSupabaseConfigured() && supabase) {
      console.log('⚡ [DB ROUTER] Fetching students by group from Supabase...');
      const { data, error } = await supabase
        .from('center_students')
        .select('*')
        .eq('group_id', groupId);
      if (!error && data) {
        const students = data.map(mapSqlToStudent);
        return await mergeFirestoreDataForStudents(students);
      }
    }
    return await centerStudentService.getStudentsByGroup(groupId);
  },
};
