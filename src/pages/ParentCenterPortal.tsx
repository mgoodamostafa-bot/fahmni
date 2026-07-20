import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, getDoc, doc, limit, onSnapshot } from 'firebase/firestore';
import { getTenantDb, getTenantAuth } from '../lib/firebase';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useTenant } from '../contexts/TenantContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  BookOpen,
  GraduationCap,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Award,
  Wallet,
  LogOut,
  Phone,
  ShieldCheck,
  Loader2,
  FileSpreadsheet,
  ChevronLeft,
  Calendar,
  Star,
  MapPin,
  TrendingUp,
  RefreshCcw,
  MessageCircle,
  Send,
  X,
  MessageSquare,
  School,
  Lock,
  User,
  Video,
  Laptop,
  FileText,
} from 'lucide-react';
import { PrintableReport } from '../components/PrintableReport';
import { messagingService, Message } from '../services/messagingService';
import { ChatBubble } from '../components/ChatBubble';

interface StudentData {
  uid: string;
  displayName: string;
  studentId: string;
  grade: string;
  level: string;
  fatherPhone?: string;
  motherPhone?: string;
  studentPhone?: string;
  walletBalance?: number;
  balance?: number;
  centerId?: string;
  groupId?: string;
  teacherId?: string;
  teacherName?: string;
  packageName?: string;
  packagePrice?: number;
  remainingSessions?: number;
  packageStatus?: string;
  pointsBalance?: number;
}

interface Enrollment {
  courseId: string;
  courseTitle: string;
  createdAt: any;
}

interface ExamResult {
  id: string;
  title: string;
  score: number;
  totalQuestions: number;
  createdAt: any;
  type: 'online' | 'offline';
}

interface HomeworkSubmission {
  id: string;
  lessonTitle: string;
  status: 'pending' | 'approved' | 'rejected';
  grade: number;
  feedback: string;
  createdAt: any;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'excused';
  timestamp: any;
}

interface EvaluationRecord {
  id: string;
  date: string;
  quizGrade: number;
  quizTotal: number;
  homeworkStatus: 'submitted' | 'incomplete' | 'not_submitted' | string;
  behaviorRating: number;
  teacherRemarks: string;
  createdAt: any;
}

interface PaymentRecord {
  id: string;
  title: string;
  type: 'subscription' | 'booklet' | 'installment' | string;
  amount: number;
  status: 'paid' | 'pending';
  date: string;
  remarks: string;
  timestamp: any;
}

export const ParentCenterPortal: React.FC = () => {
  const { tenantData } = useTenant();
  const [parentPhone, setParentPhone] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Authenticated student state
  const [student, setStudent] = useState<StudentData | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [resultsError, setResultsError] = useState<string | null>(null);
  
  // Chat Widget States
  const [chatOpen, setChatOpen] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [isResolvingConvo, setIsResolvingConvo] = useState(false);
  const [chatTeacherName, setChatTeacherName] = useState('المعلم');
  const [parentUnreadCount, setParentUnreadCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [studentProgress, setStudentProgress] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  // Load from sessionStorage if already logged in - BUT wait for tenantData to ensure DB is ready
  useEffect(() => {
    if (!tenantData) {
      return;
    }
    const cachedStudent = sessionStorage.getItem('parent_portal_student_center');
    if (cachedStudent && !dataLoaded) {
      const parsed = JSON.parse(cachedStudent);
      setStudent(parsed);
      loadStudentDetails(parsed.uid, parsed.studentId);
    }
  }, [tenantData]);

  // Initialize Parent Conversation when student is loaded
  useEffect(() => {
    if (!student) {
      setConvoId(null);
      setChatMessages([]);
      return;
    }

    const initChat = async () => {
      setIsResolvingConvo(true);
      try {
        let teacherUid = student.teacherId || '';
        let teacherDisplayName = student.teacherName || 'معلم الكورس';

        if (!teacherUid) {
          const db = getTenantDb();
          const teachersQuery = query(
            collection(db, 'users'),
            where('role', '==', 'teacher'),
            limit(1)
          );
          const teachersSnap = await getDocs(teachersQuery);
          if (!teachersSnap.empty) {
            teacherUid = teachersSnap.docs[0].id;
            teacherDisplayName = teachersSnap.docs[0].data().displayName || 'معلم الكورس';
          } else {
            const adminsQuery = query(
              collection(db, 'users'),
              where('role', '==', 'admin'),
              limit(1)
            );
            const adminsSnap = await getDocs(adminsQuery);
            if (!adminsSnap.empty) {
              teacherUid = adminsSnap.docs[0].id;
              teacherDisplayName = adminsSnap.docs[0].data().displayName || 'الإدارة';
            } else {
              const ownersQuery = query(
                collection(db, 'users'),
                where('role', '==', 'owner'),
                limit(1)
              );
              const ownersSnap = await getDocs(ownersQuery);
              if (!ownersSnap.empty) {
                teacherUid = ownersSnap.docs[0].id;
                teacherDisplayName = ownersSnap.docs[0].data().displayName || 'المصطفى';
              }
            }
          }
        }

        if (!teacherUid) {
          console.warn('No teacher or admin found to chat with.');
          setIsResolvingConvo(false);
          return;
        }

        setChatTeacherName(teacherDisplayName);

        // Get parent phone
        const parentPhoneNum = parentPhone || student.fatherPhone || student.motherPhone || student.studentPhone || 'غير حدد';

        // Get/Create conversation
        const cId = await messagingService.getOrCreateConversation(
          teacherUid,
          teacherDisplayName,
          student.uid,
          student.displayName,
          parentPhoneNum,
          tenantData?.id
        );

        setConvoId(cId);
      } catch (err) {
        console.error('Error initializing chat for parent:', err);
      } finally {
        setIsResolvingConvo(false);
      }
    };

    initChat();
  }, [student]);

  // Subscribe to messages
  useEffect(() => {
    if (!convoId) return;
    const unsub = messagingService.subscribeToMessages(convoId, (data) => {
      setChatMessages(data);
      // Mark read when open
      if (chatOpen) {
        messagingService.markMessagesAsRead(convoId, 'parent');
      }
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    // Also get conversation document for unread status
    const db = getTenantDb();
    const unsubConvo = onSnapshot(doc(db, 'conversations', convoId), (snapshot) => {
      if (snapshot.exists()) {
        setParentUnreadCount(snapshot.data().unreadByParent || 0);
      }
    });

    return () => {
      unsub();
      unsubConvo();
    };
  }, [convoId, chatOpen]);

  const cleanPhone = (p: any) => {
    if (!p) return '';
    return String(p).replace(/[\s-+]/g, '').replace(/^0+/, '');
  };

  const attemptSilentAuth = async () => {
    const authInstance = getTenantAuth();
    if (!authInstance) {
      return null;
    }
    
    // 1. Try email/password silent login
    try {
      const cred = await signInWithEmailAndPassword(authInstance, 'parent_viewer@fahmni.me', 'parent123456');
      return cred.user;
    } catch (authErr: any) {
      
      // If user not found, try creating it
      if (
        authErr.code === 'auth/user-not-found' ||
        authErr.code === 'auth/invalid-credential' ||
        authErr.code === 'auth/wrong-password'
      ) {
        try {
          const cred = await createUserWithEmailAndPassword(authInstance, 'parent_viewer@fahmni.me', 'parent123456');
          return cred.user;
        } catch (regErr: any) {
        }
      }
      
      // Fallback: Try anonymous login
      try {
        const { signInAnonymously } = await import('firebase/auth');
        const cred = await signInAnonymously(authInstance);
        return cred.user;
      } catch (anonErr: any) {
      }
    }
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentPhone.trim() || !studentId.trim()) {
      setAuthError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      const dbInstance = getTenantDb();

      await attemptSilentAuth();

      let studentData: any = null;

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('center_students')
            .select('*')
            .eq('student_id', studentId.trim())
            .limit(1);
          if (error) throw error;
          if (data && data.length > 0) {
            const row = data[0];
            studentData = {
              uid: row.uid,
              displayName: row.display_name,
              studentId: row.student_id,
              grade: row.grade,
              level: row.level,
              fatherPhone: row.father_phone,
              motherPhone: row.mother_phone,
              studentPhone: row.student_phone,
              walletBalance: Number(row.wallet_balance || 0),
              balance: Number(row.balance || 0),
              centerId: row.center_id,
              groupId: row.group_id,
              teacherId: row.teacher_id,
              teacherName: row.teacher_name,
              packageName: row.package_name,
              packageId: row.package_id,
              remainingSessions: Number(row.remaining_sessions || 0),
              pointsBalance: Number(row.points_balance || 0),
              subscriptionType: row.subscription_type,
              subscriptionStartDate: row.subscription_start_date,
              subscriptionEndDate: row.subscription_end_date,
            };

            // DUAL-LOAD: Merge package/points data from Firestore
            try {
              const fsSnap = await getDoc(doc(dbInstance, 'center_students', studentData.uid));
              if (fsSnap.exists()) {
                const fsData = fsSnap.data();
                studentData = {
                  ...studentData,
                  packageName: fsData.packageName || studentData.packageName,
                  packageId: fsData.packageId || studentData.packageId,
                  remainingSessions: fsData.remainingSessions !== undefined ? Number(fsData.remainingSessions) : studentData.remainingSessions,
                  pointsBalance: fsData.pointsBalance !== undefined ? Number(fsData.pointsBalance) : studentData.pointsBalance,
                  subscriptionType: fsData.subscriptionType || studentData.subscriptionType,
                  subscriptionStartDate: fsData.subscriptionStartDate || studentData.subscriptionStartDate,
                  subscriptionEndDate: fsData.subscriptionEndDate || studentData.subscriptionEndDate,
                };
              }
            } catch (fsErr) {
              console.warn('⚡ [ParentCenterPortal] Failed to merge Firestore custom package fields:', fsErr);
            }
          }
        } catch (sErr) {
          console.warn('⚡ [ParentCenterPortal] Fetching student from Supabase failed, falling back to Firestore:', sErr);
        }
      }

      if (!studentData) {
        const cleanCode = studentId.trim();
        let snap = await getDocs(query(
          collection(dbInstance, 'center_students'),
          where('studentId', '==', cleanCode)
        ));
        if (snap.empty) {
          snap = await getDocs(query(
            collection(dbInstance, 'center_students'),
            where('studentCode', '==', cleanCode)
          ));
        }
        if (snap.empty) {
          snap = await getDocs(query(
            collection(dbInstance, 'center_students'),
            where('code', '==', cleanCode)
          ));
        }
        if (snap.empty) {
          snap = await getDocs(query(
            collection(dbInstance, 'center_students'),
            where('student_id', '==', cleanCode)
          ));
        }

        if (snap.empty) {
          setAuthError('كود الطالب غير صحيح أو غير مسجل في السناتر');
          setLoading(false);
          return;
        }
        const studentDoc = snap.docs[0];
        const sData = studentDoc.data();
        const resolvedCode = sData.studentId || sData.studentCode || sData.code || sData.student_id || studentDoc.id;
        studentData = { uid: studentDoc.id, ...sData, studentId: resolvedCode } as any;
      }

      const fPhone = studentData.fatherPhone || '';
      const mPhone = studentData.motherPhone || '';
      const sPhone = studentData.studentPhone || '';
      
      const inputPhoneCleaned = cleanPhone(parentPhone);

      const isMatch = (fPhone && cleanPhone(fPhone) === inputPhoneCleaned) ||
                      (mPhone && cleanPhone(mPhone) === inputPhoneCleaned) ||
                      (sPhone && cleanPhone(sPhone) === inputPhoneCleaned);

      if (!isMatch) {
        setAuthError('رقم الهاتف المدخل غير مطابق لبيانات ولي الأمر المسجلة لهذا الطالب');
        setLoading(false);
        return;
      }

      // Successful Auth
      setStudent(studentData);
      sessionStorage.setItem('parent_portal_student_center', JSON.stringify(studentData));
      
      // Load all detailed stats
      await loadStudentDetails(studentData.uid, studentData.studentId);
    } catch (err: any) {
      console.error('Parent Login Error:', err);
      let errMsg = err.message || err.toString();
      if (errMsg.includes('permission')) {
        setAuthError('خطأ في الصلاحيات: يرجى التأكد من أن المعلم قام برفع وتفعيل ملف firestore.rules الجديد في لوحة تحكم Firebase.');
      } else {
        setAuthError(`حدث خطأ غير متوقع أثناء عملية التحقق: ${errMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStudentDetails = async (studentUid: string, studentCode?: string) => {
    setLoadingData(true);
    setResultsError(null);
    try {
      await attemptSilentAuth();

      // Wait briefly for Firestore to recognize the auth state
      await new Promise(resolve => setTimeout(resolve, 500));

      const currentDb = getTenantDb();

      // 2. Fetch Enrollments
      try {
        const enrollmentsQuery = query(
          collection(currentDb, 'Enrollments'),
          where('userId', '==', studentUid)
        );
        const enrollmentsSnap = await getDocs(enrollmentsQuery);
        const enrollmentDocs = enrollmentsSnap.docs.map(d2 => ({ id: d2.id, ...d2.data() }));
        
        const resolvedEnrollments = await Promise.all(
          enrollmentDocs.map(async (en: any) => {
            try {
              const cDoc = await getDoc(doc(currentDb, 'Courses', en.courseId));
              if (cDoc.exists()) {
                return { courseId: en.courseId, courseTitle: cDoc.data().title, createdAt: en.createdAt };
              }
              const cDocLower = await getDoc(doc(currentDb, 'courses', en.courseId));
              return {
                courseId: en.courseId,
                courseTitle: cDocLower.exists() ? cDocLower.data().title : 'كورس محذوف',
                createdAt: en.createdAt
              };
            } catch {
              return { courseId: en.courseId, courseTitle: 'كورس غير معروف', createdAt: en.createdAt };
            }
          })
        );
        setEnrollments(resolvedEnrollments);
      } catch (err: any) {
        console.error('Error loading enrollments:', err);
      }

      // 3. Fetch Online Quiz results
      let examResults: ExamResult[] = [];
      try {
        const resultsQuery = query(
          collection(currentDb, 'results'),
          where('userId', '==', studentUid)
        );
        const resultsSnap = await getDocs(resultsQuery);
        examResults = await Promise.all(resultsSnap.docs.map(async (d2) => {
          const data = d2.data();
          let quizTitle = data.examTitle || data.title || 'امتحان غير معروف';
          
          if (quizTitle === 'امتحان غير معروف') {
            try {
              const examId = data.examId || data.quizId || '';
              if (examId) {
                const qDoc = await getDoc(doc(currentDb, 'exams', examId));
                if (qDoc.exists()) {
                  quizTitle = qDoc.data().title;
                }
              }
            } catch {}
          }

          const score = data.totalCorrect !== undefined ? data.totalCorrect : (data.score || 0);
          const totalQuestions = data.totalCorrect !== undefined ? (data.totalQuestions || 0) : (data.score !== undefined ? 100 : 0);

          return {
            id: d2.id,
            title: quizTitle,
            score,
            totalQuestions,
            createdAt: data.createdAt || data.timestamp || null,
            type: 'online'
          } as ExamResult;
        }));
      } catch (err: any) {
        console.error('Error loading online quiz results:', err);
        setResultsError('Online Quiz: ' + (err.message || err.toString()));
      }

      // 4. Fetch Offline Exam results
      let offlineResults: ExamResult[] = [];
      const offlineMap = new Map<string, ExamResult>();

      try {
        try {
          const offlineQuery = query(
          collection(currentDb, 'offline_results'),
          where('studentUid', '==', studentUid)
        );
        const offlineSnap = await getDocs(offlineQuery);
        offlineSnap.docs.forEach(d2 => {
          const data = d2.data();
          offlineMap.set(d2.id, {
            id: d2.id,
            title: data.examTitle || 'امتحان ورقي',
            score: data.score || 0,
            totalQuestions: data.maxScore || data.totalQuestions || 100,
            createdAt: data.createdAt || null,
            type: 'offline'
          } as ExamResult);
        });
      } catch (fsErr) {
        console.warn('⚡ [ParentCenterPortal] Firestore offline results load error:', fsErr);
      }

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('offline_results')
            .select('*')
            .eq('student_uid', studentUid);
          if (!error && data) {
            data.forEach((row: any) => {
              offlineMap.set(row.id, {
                id: row.id,
                title: row.exam_title || 'امتحان ورقي',
                score: Number(row.score || 0),
                totalQuestions: Number(row.max_score || 100),
                createdAt: row.created_at || null,
                type: 'offline'
              });
            });
          }
        } catch (sErr) {
          console.warn('⚡ [ParentCenterPortal] Supabase offline results load error:', sErr);
        }
      }
      offlineResults = Array.from(offlineMap.values());

        // Smart secondary fallback: query by numeric studentCode if still empty
        if (offlineResults.length === 0 && studentCode) {
          console.log('⚡ [ParentCenterPortal] Firestore query by studentId returned empty, trying secondary fallback by studentCode:', studentCode);
          const fallbackQuery = query(
            collection(currentDb, 'offline_results'),
            where('studentCode', '==', studentCode)
          );
          const fallbackSnap = await getDocs(fallbackQuery);
          offlineResults = fallbackSnap.docs.map(d2 => {
            const data = d2.data();
            return {
              id: d2.id,
              title: data.examTitle || 'امتحان ورقي',
              score: data.score || 0,
              totalQuestions: data.maxScore || data.totalQuestions || 100,
              createdAt: data.createdAt || null,
              type: 'offline'
            } as ExamResult;
          });
        }
      } catch (fErr: any) {
        console.error('Error fetching offline results from Firestore:', fErr);
        setResultsError('Firestore: ' + (fErr.message || fErr.toString()));
      }

      // Combine and set results
      const allResults = [...examResults, ...offlineResults].sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || a.createdAt?.seconds * 1000 || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || b.createdAt?.seconds * 1000 || 0;
        return timeB - timeA;
      });
      setResults(allResults);

      // 5. Fetch Homework Submissions
      try {
        const submissionsQuery = query(
          collection(currentDb, 'submissions'),
          where('userId', '==', studentUid)
        );
        const submissionsSnap = await getDocs(submissionsQuery);
        const resolvedSubmissions = await Promise.all(submissionsSnap.docs.map(async (d2) => {
          const data = d2.data();
          let lessonTitle = 'درس غير معروف';
          try {
            const lDoc = await getDoc(doc(currentDb, 'lessons', data.lessonId || ''));
            if (lDoc.exists()) lessonTitle = lDoc.data().title;
            else {
              const lDocUpper = await getDoc(doc(currentDb, 'Lessons', data.lessonId || ''));
              if (lDocUpper.exists()) lessonTitle = lDocUpper.data().title;
            }
          } catch {}
          return {
            id: d2.id,
            lessonTitle,
            status: data.status || 'pending',
            grade: data.grade || 0,
            feedback: data.feedback || '',
            createdAt: data.createdAt || null
          } as HomeworkSubmission;
        }));
        setSubmissions(resolvedSubmissions.sort((a, b) => {
          const timeA = a.createdAt?.toDate?.()?.getTime() || a.createdAt?.seconds * 1000 || 0;
          const timeB = b.createdAt?.toDate?.()?.getTime() || b.createdAt?.seconds * 1000 || 0;
          return timeB - timeA;
        }));
      } catch (err: any) {
        console.error('Error loading submissions:', err);
      }

      // 6. Fetch Attendance history
      try {
        let resolvedAttendance: AttendanceRecord[] = [];
        const attMap = new Map<string, AttendanceRecord>();

        try {
          const attendanceQuery = query(
            collection(currentDb, 'attendance'),
            where('studentUid', '==', studentUid)
          );
          const attendanceSnap = await getDocs(attendanceQuery);
          attendanceSnap.docs.forEach(d2 => {
            const data = d2.data();
            attMap.set(d2.id, {
              id: d2.id,
              date: data.date,
              status: data.status || 'present',
              timestamp: data.timestamp || null
            } as AttendanceRecord);
          });
        } catch (fsErr) {
          console.warn('⚡ [ParentCenterPortal] Firestore load attendance warning:', fsErr);
        }

        if (isSupabaseConfigured() && supabase) {
          try {
            const { data, error } = await supabase
              .from('attendance')
              .select('*')
              .eq('student_uid', studentUid);
            if (!error && data) {
              data.forEach((row: any) => {
                attMap.set(row.id, {
                  id: row.id,
                  date: row.date,
                  status: row.status || 'present',
                  timestamp: row.timestamp || null
                });
              });
            }
          } catch (sErr) {
            console.warn('⚡ [ParentCenterPortal] Supabase load attendance warning:', sErr);
          }
        }
        resolvedAttendance = Array.from(attMap.values()).sort((a, b) => b.date.localeCompare(a.date));
        setAttendance(resolvedAttendance);
      } catch (err: any) {
        console.error('Error loading attendance:', err);
      }

      // 7. Fetch Evaluations history
      try {
        let resolvedEvaluations: EvaluationRecord[] = [];
        const evalMap = new Map<string, EvaluationRecord>();

        try {
          const evaluationsQuery = query(
            collection(currentDb, 'evaluations'),
            where('studentUid', '==', studentUid)
          );
          const evaluationsSnap = await getDocs(evaluationsQuery);
          evaluationsSnap.docs.forEach(d2 => {
            const data = d2.data();
            evalMap.set(d2.id, {
              id: d2.id,
              date: data.date,
              quizGrade: data.quizGrade || 0,
              quizTotal: data.quizTotal || 10,
              homeworkStatus: data.homeworkStatus || 'submitted',
              behaviorRating: data.behaviorRating || 5,
              teacherRemarks: data.teacherRemarks || '',
              createdAt: data.createdAt || null
            } as EvaluationRecord);
          });
        } catch (fsErr) {
          console.warn('⚡ [ParentCenterPortal] Firestore load evaluations warning:', fsErr);
        }

        if (isSupabaseConfigured() && supabase) {
          try {
            const { data, error } = await supabase
              .from('evaluations')
              .select('*')
              .eq('student_uid', studentUid);
            if (!error && data) {
              data.forEach((row: any) => {
                evalMap.set(row.id, {
                  id: row.id,
                  date: row.date,
                  quizGrade: Number(row.quiz_grade || 0),
                  quizTotal: Number(row.quiz_total || 10),
                  homeworkStatus: row.homework_status || 'submitted',
                  behaviorRating: Number(row.behavior_rating || 5),
                  teacherRemarks: row.teacher_remarks || '',
                  createdAt: row.timestamp || null
                });
              });
            }
          } catch (sErr) {
            console.warn('⚡ [ParentCenterPortal] Supabase load evaluations warning:', sErr);
          }
        }
        resolvedEvaluations = Array.from(evalMap.values()).sort((a, b) => b.date.localeCompare(a.date));
        setEvaluations(resolvedEvaluations);
      } catch (err: any) {
        console.error('Error loading evaluations:', err);
      }

      // 8. Fetch Financial payments & installments
      try {
        let resolvedPayments: PaymentRecord[] = [];
        const payMap = new Map<string, PaymentRecord>();

        try {
          const paymentsQuery = query(
            collection(currentDb, 'center_payments'),
            where('studentUid', '==', studentUid)
          );
          const paymentsSnap = await getDocs(paymentsQuery);
          paymentsSnap.docs.forEach(d2 => {
            const data = d2.data();
            payMap.set(d2.id, {
              id: d2.id,
              title: data.title || data.invoiceTypeStr || 'اشتراك شهري',
              type: data.type || data.invoiceType || 'subscription',
              amount: data.amount || data.amountPaid || 0,
              status: data.status || 'paid',
              date: data.date || '',
              remarks: data.remarks || data.notes || '',
              timestamp: data.timestamp || null
            } as PaymentRecord);
          });
        } catch (fsErr) {
          console.warn('⚡ [ParentCenterPortal] Firestore load payments warning:', fsErr);
        }

        if (isSupabaseConfigured() && supabase) {
          try {
            const { data, error } = await supabase
              .from('center_payments')
              .select('*')
              .eq('student_uid', studentUid);
            if (!error && data) {
              data.forEach((row: any) => {
                payMap.set(row.id, {
                  id: row.id,
                  title: row.title || 'اشتراك شهري',
                  type: row.type || 'subscription',
                  amount: Number(row.amount || 0),
                  status: row.status || 'paid',
                  date: row.date || '',
                  remarks: row.remarks || '',
                  timestamp: row.timestamp || null
                });
              });
            }
          } catch (sErr) {
            console.warn('⚡ [ParentCenterPortal] Supabase load payments warning:', sErr);
          }
        }
        resolvedPayments = Array.from(payMap.values()).sort((a, b) => b.date.localeCompare(a.date));
        setPayments(resolvedPayments);
      } catch (err: any) {
        console.error('Error loading payments:', err);
      }

      // 9. Fetch Video progress analytics
      try {
        const progressQuery = query(
          collection(currentDb, 'user_progress'),
          where('userId', '==', studentUid)
        );
        const progressSnap = await getDocs(progressQuery);
        const resolvedProgress = progressSnap.docs.map(d2 => {
          const data = d2.data();
          return {
            id: d2.id,
            lessonId: data.lessonId || '',
            progress: Math.round(data.progress || 0),
            isCompleted: !!data.isCompleted,
            lastViewedAt: data.lastViewedAt || null
          };
        });
        setStudentProgress(resolvedProgress);
      } catch (err: any) {
        console.error('Error loading student progress analytics:', err);
      }

    } catch (err) {
      console.error('Error in loadStudentDetails:', err);
    } finally {
      setLoadingData(false);
      setDataLoaded(true);
    }
  };

  const handleLogout = () => {
    setStudent(null);
    setParentPhone('');
    setStudentId('');
    setEnrollments([]);
    setResults([]);
    setSubmissions([]);
    setAttendance([]);
    setEvaluations([]);
    setPayments([]);
    setDataLoaded(false);
    sessionStorage.removeItem('parent_portal_student_center');
  };

  const translateGrade = (g: string) => {
    const map: Record<string, string> = {
      'primary-4': 'الصف الرابع الابتدائي',
      'primary-5': 'الصف الخامس الابتدائي',
      'primary-6': 'الصف السادس الابتدائي',
      'prep-1': 'الصف الأول الإعدادي',
      'prep-2': 'الصف الثاني الإعدادي',
      'prep-3': 'الصف الثالث الإعدادي',
      'sec-1': 'الصف الأول الثانوي - علوم متكاملة',
      'sec-2': 'الصف الثاني الثانوي',
      'sec-3': 'الصف الثالث الثانوي',
      '1': 'الصف الأول الثانوي - علوم متكاملة',
      '2': 'الصف الثاني الثانوي',
      '3': 'الصف الثالث الثانوي',
    };
    return map[g] || g;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'غير محدد';
    let date: Date;
    if (timestamp.toDate) date = timestamp.toDate();
    else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
    else date = new Date(timestamp);
    
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleSendParentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim() || !convoId || !student) return;

    try {
      await messagingService.sendMessage(
        convoId,
        student.uid,
        'parent',
        'ولي الأمر',
        chatInputText
      );
      setChatInputText('');
    } catch (err) {
      console.error('Error sending parent message:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] text-white font-display pb-16" dir="rtl">
      
      {/* Dynamic Header */}
      <header className="border-b border-white/5 bg-[#060913]/90 backdrop-blur-md sticky top-0 z-[60] px-6 py-4">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
              <School size={20} />
            </div>
            <div>
              <h1 className="font-black text-base md:text-lg tracking-tight">بوابة ولي الأمر (السناتر)</h1>
              <p className="text-[10px] text-gray-500 font-bold">متابعة فورية للحضور والتقييمات والماليات بالسنتر</p>
            </div>
          </div>
          {student && (
            <div className="flex gap-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-xs font-bold cursor-pointer"
              >
                <LogOut size={14} />
                <span>خروج البوابة</span>
              </button>
              <button
                onClick={() => {
                  if (student) {
                    setLoadingData(true);
                    loadStudentDetails(student.uid, student.studentId);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all text-xs font-bold cursor-pointer"
              >
                <RefreshCcw size={14} />
                <span>تحديث البيانات</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="w-full px-6 pt-12">
        <AnimatePresence mode="wait">
          {!student ? (
            /* Login Form View */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto"
            >
              <div className="bg-[#060913] border border-white/5 backdrop-blur-xl rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="text-center space-y-3 mb-8">
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-inner text-2xl">
                    <Lock size={24} className="text-emerald-400" />
                  </div>
                  <h2 className="text-lg font-black text-white">التحقق من الهوية (بوابة السنتر)</h2>
                  <p className="text-[10px] text-gray-500 font-bold max-w-[280px] mx-auto leading-relaxed">
                    يرجى إدخال رقم الهاتف المسجل لولي الأمر وكود طالب السنتر الرقمي لمتابعة التقارير بأمان.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-300 block">رقم هاتف ولي الأمر (الأب / الأم)</label>
                    <div className="relative">
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                        <Phone size={14} />
                      </span>
                      <input
                        type="tel"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        placeholder="01xxxxxxxxx"
                        className="w-full bg-black/40 border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-2xl py-3 pr-10 pl-4 text-xs text-white placeholder-gray-600 outline-none transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-300 block">كود الطالب السنتر (الرقمي)</label>
                    <div className="relative">
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                        <GraduationCap size={14} />
                      </span>
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="مثال: 2026001"
                        className="w-full bg-black/40 border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-2xl py-3 pr-10 pl-4 text-xs text-white placeholder-gray-600 outline-none transition-all font-bold"
                      />
                    </div>
                  </div>

                  {authError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black rounded-2xl flex gap-2.5 items-start">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <span className="leading-relaxed">{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50 text-slate-950 font-black text-xs rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <>
                        <span>دخول ومتابعة التقارير</span>
                        <ChevronLeft size={14} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          ) : (
            /* Dashboard View */
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Profile Card */}
              <div className="bg-[#060913] border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center rounded-2xl">
                    <User size={24} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white">{student.displayName}</h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1">
                      <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                        <GraduationCap size={12} className="text-emerald-500" />
                        <span>كود الطالب: {student.studentId}</span>
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                        <Calendar size={12} className="text-emerald-500" />
                        <span>{translateGrade(student.grade)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <PrintableReport
                    studentName={student.displayName}
                    studentId={student.studentId}
                    grade={translateGrade(student.grade)}
                    platformName={tenantData?.siteName || 'فهمني'}
                    results={results}
                    attendance={attendance}
                    evaluations={evaluations}
                    submissions={submissions || []}
                  />
                  <div className="px-4 py-2.5 bg-white/2 border border-white/5 rounded-xl text-center min-w-[90px]">
                    <span className="text-[8px] text-gray-500 font-black block">إجمالي الحضور</span>
                    <span className="text-xs font-black text-emerald-400 mt-0.5 block">
                      {attendance.filter(r => r.status === 'present').length} حصة
                    </span>
                  </div>
                  <div className="px-4 py-2.5 bg-white/2 border border-white/5 rounded-xl text-center min-w-[90px]">
                    <span className="text-[8px] text-gray-500 font-black block">الغياب</span>
                    <span className="text-xs font-black text-red-400 mt-0.5 block">
                      {attendance.filter(r => r.status === 'absent').length} حصة
                    </span>
                  </div>
                  <div className="px-4 py-2.5 bg-white/2 border border-white/5 rounded-xl text-center min-w-[90px]">
                    <span className="text-[8px] text-gray-500 font-black block">إجمالي الامتحانات</span>
                    <span className="text-xs font-black text-brand-blue mt-0.5 block">
                      {results.length} اختبار
                    </span>
                  </div>
                </div>
              </div>

              {/* Premium Student Subscriptions & Points Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* 1. Subscription Package Card */}
                <div className="bg-[#060913] border border-white/5 p-5 rounded-3xl relative overflow-hidden shadow-xl flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Award size={20} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-500 font-black block uppercase tracking-wider">الباقة النشطة بالسنتر</span>
                    <h4 className="text-xs font-black text-white">{student.packageName || "بدون باقة نشطة"}</h4>
                    {student.packageName ? (
                      (student as any).subscriptionType === 'monthly' ? (
                        (() => {
                          if (!(student as any).subscriptionEndDate) {
                            return (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                غير نشط ❌
                              </span>
                            );
                          }
                          const expiry = new Date((student as any).subscriptionEndDate);
                          const today = new Date();
                          expiry.setHours(0,0,0,0);
                          today.setHours(0,0,0,0);
                          const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                          
                          if (diffDays < 0) {
                            return (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                منتهي منذ {Math.abs(diffDays)} يوم ⚠️
                              </span>
                            );
                          } else if (diffDays <= 3) {
                            return (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                ينتهي خلال {diffDays} يوم ⏳
                              </span>
                            );
                          } else {
                            return (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                نشط (متبقي {diffDays} يوم) ✅
                              </span>
                            );
                          }
                        })()
                      ) : (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          (student.remainingSessions ?? 0) <= 0
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          الرصيد المتبقي: {student.remainingSessions ?? 0} حصص
                        </span>
                      )
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">
                        بدون رصيد
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Gamification / Points Card */}
                <div className="bg-[#060913] border border-white/5 p-5 rounded-3xl relative overflow-hidden shadow-xl flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Star size={20} className="fill-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-500 font-black block uppercase tracking-wider">نقاط التميز والمكافآت</span>
                    <h4 className="text-xs font-black text-white">{student.pointsBalance ?? 0} نقطة تميز</h4>
                    <span className="text-[8px] text-gray-400 font-bold block">
                      تمنح تلقائياً عند التفوق والالتزام بالسلوك والواجبات
                    </span>
                  </div>
                </div>

                {/* 3. Installments Card */}
                {(() => {
                  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
                  return (
                    <div className="bg-[#060913] border border-white/5 p-5 rounded-3xl relative overflow-hidden shadow-xl flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        totalPending > 0
                          ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      }`}>
                        <Wallet size={20} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-gray-500 font-black block uppercase tracking-wider">الأقساط والمبالغ المستحقة</span>
                        <h4 className="text-xs font-black text-white">{totalPending} ج.م</h4>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          totalPending > 0
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {totalPending > 0 ? "مستحق الدفع قريباً" : "خالص بالكامل"}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {loadingData ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="animate-spin text-emerald-400" size={32} />
                  <p className="text-[10px] text-gray-500 font-bold">جاري تحميل تقارير الطالب بالكامل...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Right Column (2/3 width): Exams and Financial Ledger */}
                  <div className="lg:col-span-2 space-y-8">
                    
                    {/* Exam Results List */}
                    <div className="bg-[#060913] border border-white/5 rounded-3xl p-6 space-y-4">
                      <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3">
                        <Award size={14} className="text-emerald-400" />
                        <span>نتائج كشوف الامتحانات</span>
                      </h3>

                      {resultsError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
                          <p className="text-[9px] text-red-400 font-bold leading-relaxed">خطأ في التحميل: {resultsError}</p>
                        </div>
                      )}

                      {results.length === 0 ? (
                        <p className="text-[10px] text-gray-500 font-bold py-6 text-center">لا توجد نتائج امتحانات مسجلة.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {results.map((res, index) => {
                            const pct = res.totalQuestions > 0 ? Math.round((res.score / res.totalQuestions) * 100) : 0;
                            const isHigh = pct >= 85;
                            const isMedium = pct >= 60 && pct < 85;
                            const colorClass = isHigh 
                              ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' 
                              : isMedium 
                                ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' 
                                : 'text-rose-400 border-rose-500/20 bg-rose-500/5';
                            const barColor = isHigh ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : isMedium ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]';
                            const isOffline = res.type === 'offline';

                            return (
                              <motion.div
                                key={res.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                className="p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-emerald-500/20 rounded-2xl flex flex-col gap-3 transition-all duration-300"
                              >
                                <div className="flex justify-between items-center gap-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`p-2 rounded-xl bg-white/5 border border-white/10 ${isOffline ? 'text-violet-400' : 'text-cyan-400'}`}>
                                      {isOffline ? <FileText size={16} /> : <Laptop size={16} />}
                                    </div>
                                    <div className="space-y-0.5">
                                      <span className="text-xs font-black text-white block">{res.title}</span>
                                      <span className="text-[9px] text-gray-400 font-bold flex items-center gap-1">
                                        <span>{isOffline ? '📝 امتحان ورقي بالسنتر' : '💻 امتحان أونلاين على المنصة'}</span>
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-left shrink-0">
                                    <div className={`px-2.5 py-1 rounded-xl border font-mono font-black text-xs inline-flex items-center ${colorClass}`}>
                                      <span dir="ltr">{res.score} / {res.totalQuestions}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Progress bar and percentage */}
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center text-[9px] font-bold text-gray-500">
                                    <span>التحصيل الدراسي</span>
                                    <span className={isHigh ? 'text-emerald-400' : isMedium ? 'text-amber-400' : 'text-rose-400'}>{pct}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${pct}%` }}
                                      transition={{ duration: 0.5, delay: index * 0.05 + 0.2 }}
                                      className={`h-full rounded-full ${barColor}`} 
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>



                    {/* Financial ledger */}
                    <div className="bg-[#060913] border border-white/5 rounded-3xl p-6 space-y-4">
                      <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3">
                        <Wallet size={14} className="text-emerald-400" />
                        <span>سجل المدفوعات والاشتراكات بالسنتر</span>
                      </h3>

                      {payments.length === 0 ? (
                        <p className="text-[10px] text-gray-500 font-bold py-6 text-center">لا توجد سجلات مالية مسجلة بعد.</p>
                      ) : (
                        <div className="space-y-3">
                          {/* Financial Summary */}
                          {(() => {
                            const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
                            const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
                            return (
                              <div className="flex gap-3 mb-2">
                                <div className="flex-1 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-center">
                                  <span className="text-[8px] text-gray-500 font-black block">إجمالي المدفوع</span>
                                  <span className="text-xs font-black text-emerald-400 block mt-0.5">{totalPaid} ج.م</span>
                                </div>
                                {totalPending > 0 && (
                                  <div className="flex-1 p-3 bg-red-500/5 border border-red-500/10 rounded-2xl text-center">
                                    <span className="text-[8px] text-gray-500 font-black block">أقساط مستحقة</span>
                                    <span className="text-xs font-black text-red-400 block mt-0.5">{totalPending} ج.م</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {payments.map((pay) => (
                            <div key={pay.id} className="p-3.5 bg-white/2 border border-white/5 rounded-2xl space-y-2">
                              <div className="flex justify-between items-center text-[10px] font-black">
                                <span className="text-white">{pay.title}</span>
                                <span className={pay.status === 'paid' ? 'text-emerald-400' : 'text-red-400'}>{pay.amount} ج.م</span>
                              </div>
                              <div className="flex justify-between items-center text-[8px] text-gray-500">
                                <span>التاريخ: {pay.date}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
                                    {pay.type === 'booklet' ? 'ملازم ومطبوعات' :
                                     pay.type === 'installment' ? 'قسط مالي' : 'اشتراك شهري'}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded font-bold ${
                                    pay.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                  }`}>
                                    {pay.status === 'paid' ? 'مدفوع ✅' : 'مستحق ❌'}
                                  </span>
                                </div>
                              </div>
                              {pay.remarks && (
                                <p className="text-[8px] text-gray-400 bg-black/10 p-1.5 rounded-lg border border-white/5">
                                  {pay.remarks}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Left Column (1/3 width): Attendance & Daily Evaluations */}
                  <div className="space-y-8">
                    
                    {/* Attendance Log */}
                    <div className="bg-[#060913] border border-white/5 rounded-3xl p-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <h3 className="text-xs font-black text-white flex items-center gap-2">
                          <CheckCircle size={14} className="text-emerald-400" />
                          <span>سجل الحضور والغياب اليومي</span>
                        </h3>
                        <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-bold">
                          نسبة حضور {attendance.length ? Math.round((attendance.filter(r => r.status === 'present').length / attendance.length) * 100) : 100}%
                        </span>
                      </div>

                      {attendance.length === 0 ? (
                        <p className="text-[10px] text-gray-500 font-bold py-6 text-center">لا توجد سجلات حضور مسجلة بعد.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {attendance.slice(0, 12).map((rec) => (
                            <div
                              key={rec.id}
                              className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                                rec.status === 'present'
                                  ? 'bg-emerald-500/5 border-emerald-500/10'
                                  : rec.status === 'absent'
                                    ? 'bg-red-500/5 border-red-500/10'
                                    : 'bg-amber-500/5 border-amber-500/10'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <span className="text-[9px] font-black text-white block">{rec.date}</span>
                                <span className="text-[7px] text-gray-500 font-bold block">
                                  {rec.timestamp ? formatDate(rec.timestamp) : 'بدون توقيت'}
                                </span>
                              </div>
                              <span>
                                {rec.status === 'present' ? (
                                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs">✓</span>
                                ) : rec.status === 'absent' ? (
                                  <span className="w-5 h-5 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center text-xs">✗</span>
                                ) : (
                                  <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-xs">!</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Daily evaluations */}
                    <div className="bg-[#060913] border border-white/5 rounded-3xl p-6 space-y-4">
                      <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3">
                        <TrendingUp size={14} className="text-emerald-400" />
                        <span>تقييمات الحصص والسلوكيات اليومية</span>
                      </h3>

                      {evaluations.length === 0 ? (
                        <p className="text-[10px] text-gray-500 font-bold py-6 text-center">لا توجد تقييمات يومية مسجلة بعد.</p>
                      ) : (
                        <div className="space-y-3.5">
                          {evaluations.map((evalRec) => (
                            <div key={evalRec.id} className="p-4 bg-white/2 border border-white/5 rounded-2xl space-y-3">
                              <div className="flex justify-between items-center text-[10px] font-black border-b border-white/5 pb-2">
                                <span className="text-emerald-400">{evalRec.date}</span>
                                <span className="text-gray-400">تقييم الحصة</span>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-2.5 bg-black/20 rounded-xl">
                                  <span className="text-[8px] text-gray-500 font-black block">درجة اختبار الحصة</span>
                                  <span className="text-xs font-black text-white block mt-0.5" dir="ltr">
                                    {evalRec.quizGrade} / {evalRec.quizTotal}
                                  </span>
                                </div>
                                <div className="p-2.5 bg-black/20 rounded-xl">
                                  <span className="text-[8px] text-gray-500 font-black block">تسليم الواجب المنزلي</span>
                                  <span className="text-xs font-black text-white block mt-0.5">
                                    {evalRec.homeworkStatus === 'submitted' ? 'تم التسليم بالكامل' :
                                     evalRec.homeworkStatus === 'incomplete' ? 'ناقص / غير مكتمل' : 'لم يسلم الواجب'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-2 items-center">
                                <span className="text-[8px] text-gray-500 font-black">تقييم سلوك الطالب:</span>
                                <div className="flex gap-0.5">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      size={10}
                                      className={i < evalRec.behaviorRating ? "text-amber-400 fill-amber-400" : "text-gray-600"}
                                    />
                                  ))}
                                </div>
                              </div>

                              {evalRec.teacherRemarks && (
                                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-[10px] text-emerald-300 leading-normal">
                                  <strong>ملاحظة المعلم:</strong> {evalRec.teacherRemarks}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Chat Widget for Parent-Teacher Communication */}
      {student && convoId && (
        <div className="fixed bottom-6 left-6 z-[100]" dir="rtl">
          {/* Badge & Toggle Button */}
          {!chatOpen && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setChatOpen(true);
                messagingService.markMessagesAsRead(convoId, 'parent');
              }}
              className="relative w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center shadow-2xl shadow-emerald-600/30 cursor-pointer animate-bounce"
            >
              <MessageCircle size={26} />
              {parentUnreadCount > 0 && (
                <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse border border-[#0a0a0f]">
                  {parentUnreadCount}
                </span>
              )}
            </motion.button>
          )}

          {/* Chat Window Panel */}
          <AnimatePresence>
            {chatOpen && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                className="w-[320px] sm:w-[360px] h-[450px] bg-[#0d0d16] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="p-4 bg-emerald-600/10 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-600/20 text-emerald-400 rounded-xl flex items-center justify-center font-bold">
                      💬
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-white">محادثة {chatTeacherName}</h4>
                      <p className="text-[9px] text-emerald-400 font-bold leading-none">متاح الآن للرد على استفساراتكم</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setChatOpen(false)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Messages scrolling */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white/[0.01]">
                  {chatMessages.length > 0 ? (
                    chatMessages.map((msg) => (
                      <ChatBubble
                        key={msg.id}
                        message={msg}
                        isOwn={msg.senderRole === 'parent'}
                      />
                    ))
                  ) : (
                    <div className="py-20 text-center space-y-2">
                      <MessageSquare size={32} className="text-gray-700 mx-auto animate-pulse" />
                      <p className="text-[11px] text-gray-500 font-bold">ارسل رسالة لبدء التحدث مع المعلم بخصوص الطالب</p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input form */}
                <form onSubmit={handleSendParentMessage} className="p-3 border-t border-white/5 bg-black/40 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="اكتب رسالتك هنا..."
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600/50 focus:bg-white/10 transition-all text-right"
                  />
                  <button
                    type="submit"
                    disabled={!chatInputText.trim()}
                    className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl shadow-lg transition-all cursor-pointer"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
