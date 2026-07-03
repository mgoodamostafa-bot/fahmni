import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  onSnapshot,
  setDoc,
  getDoc,
  addDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Shield,
  ShieldAlert,
  Trash2,
  Activity,
  X,
  Search,
  User,
  Mail,
  Calendar,
  AlertCircle,
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  CheckCircle2,
  BookOpen,
  MonitorSmartphone,
  GraduationCap,
  Eye,
  Save,
  ChevronLeft,
  Smartphone,
  RefreshCw,
  Users,
  CreditCard,
  Hash,
  Wallet,
  Clock,
  PlusCircle,
  BookMarked,
  LogIn,
  Filter,
  SortAsc,
  Zap,
  Award,
  Crown,
  Percent,
  History,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { Pagination, usePagination } from '../../components/Pagination';
import { SearchInput } from '../../components/SearchInput';
import { downloadCsv, formatDateForCsv, CsvColumn } from '../../utils/csv';
import { AttendanceTab } from '../../components/admin/manage-users/AttendanceTab';
import { TransactionsTab } from '../../components/admin/manage-users/TransactionsTab';
import { EnrollmentsTab } from '../../components/admin/manage-users/EnrollmentsTab';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
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
  attendance?: string[]; // Array of dates: YYYY-MM-DD
  enrolledCourses?: string[];
  groupId?: string;
  defaultCommission?: number;
  devices?: any[];
  accountStatus?: 'active' | 'blocked';
  screenshotWarnings?: number;
}

interface ProgressData {
  id: string;
  courseId: string;
  courseTitle?: string;
  completedLessons: string[];
}

interface Transaction {
  id: string;
  type: 'deposit' | 'purchase';
  amount: number;
  date: any;
  courseName?: string;
  codeUsed?: string;
  userId: string;
  userName?: string;
}

interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: 'active' | 'pending' | 'rejected';
  paymentMethod: string;
  createdAt: any;
  userEmail?: string;
  courseTitle?: string;
}

type SortField = 'displayName' | 'email' | 'role' | 'status' | 'createdAt';
type SortOrder = 'asc' | 'desc';
type ActiveTab = 'students' | 'transactions' | 'enrollments' | 'attendance';

const LEVELS = [
  'أولى ثانوي',
  'تانية ثانوي',
  'تالتة ثانوي',
  'أولى إعدادي',
  'تانية إعدادي',
  'تالتة إعدادي',
];

// ─── Video Views Editor ────────────────────────────────────────────────────────

const CourseViewsEditor: React.FC<{
  studentId: string;
  courseId: string;
  courseTitle: string;
  onBack: () => void;
}> = ({ studentId, courseId, courseTitle, onBack }) => {
  const [lessons, setLessons] = useState<any[]>([]);
  const [progressData, setProgressData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    const loadViews = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'Lessons'), where('courseId', '==', courseId));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        setLessons(fetched);

        fetched.forEach((lesson: any) => {
          const pRef = doc(db, 'user_progress', `${studentId}_${lesson.id}`);
          const unsub = onSnapshot(pRef, (snap) => {
            const val = snap.exists() ? (snap.data().remainingViews ?? 5) : 5;
            setProgressData((prev) => ({ ...prev, [lesson.id]: val }));
            setInputValues((prev) => ({ ...prev, [lesson.id]: String(val) }));
          });
          unsubs.push(unsub);
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadViews();
    return () => unsubs.forEach((fn) => fn());
  }, [studentId, courseId]);

  const handleUpdate = async (lessonId: string, directValue?: number) => {
    let newCount =
      directValue !== undefined ? directValue : parseInt(inputValues[lessonId] ?? '0', 10);
    if (isNaN(newCount) || newCount < 0) newCount = 0;
    setSaving(lessonId);
    try {
      const pRef = doc(db, 'user_progress', `${studentId}_${lessonId}`);
      await setDoc(
        pRef,
        {
          userId: studentId,
          courseId,
          lessonId,
          remainingViews: newCount,
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(null);
    }
  };

  if (loading)
    return (
      <div className="text-center p-10">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400">جاري تحميل بيانات الفيديوهات...</p>
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Eye size={18} className="text-blue-400" />
            إدارة مشاهدات الفيديوهات
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{courseTitle} — الحد الأقصى 5 مشاهدات</p>
        </div>
      </div>
      {lessons.length === 0 ? (
        <p className="text-slate-500 text-center py-6">لا توجد دروس في هذا الكورس.</p>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson: any, idx: number) => {
            const current = progressData[lesson.id] ?? 5;
            const isExhausted = current <= 0;
            return (
              <div
                key={lesson.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row gap-3 sm:items-center justify-between ${isExhausted ? 'bg-red-500/5 border-red-500/20' : 'bg-[#0a1220] border-white/8 hover:border-blue-500/30'}`}
              >
                <div className="flex-1">
                  <p className="font-bold text-white text-sm line-clamp-1">
                    {String(idx + 1).padStart(2, '0')}. {lesson.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-4 h-1.5 rounded-full ${i <= current ? 'bg-blue-500' : 'bg-white/10'}`}
                        />
                      ))}
                    </div>
                    <span
                      className={`text-xs font-black ${isExhausted ? 'text-red-400' : 'text-slate-400'}`}
                    >
                      متبقي {current}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newCount = current + 5;
                      setInputValues((prev) => ({ ...prev, [lesson.id]: String(newCount) }));
                      handleUpdate(lesson.id, newCount);
                    }}
                    className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl font-black text-xs hover:bg-blue-500/20"
                  >
                    +5 مشاهدات
                  </button>
                  <input
                    type="number"
                    value={inputValues[lesson.id] || 0}
                    onChange={(e) =>
                      setInputValues((prev) => ({ ...prev, [lesson.id]: e.target.value }))
                    }
                    className="w-16 bg-white/5 border border-white/15 rounded-xl px-2 py-1.5 text-center text-white font-black"
                  />
                  <button
                    onClick={() => handleUpdate(lesson.id)}
                    disabled={saving === lesson.id}
                    className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl"
                  >
                    {saving === lesson.id ? (
                      <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Transactions Tab (inline) ─────────────────────────────────────────────────

export const ManageUsers: React.FC = () => {
  const { user } = useAuth();

  // ── State ──
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher'>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [activeTab, setActiveTab] = useState<ActiveTab>('students');
  const [studentTypeFilter, setStudentTypeFilter] = useState<'all' | 'online' | 'center'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Modals ──
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [gradeEditTarget, setGradeEditTarget] = useState<UserProfile | null>(null);
  const [newLevel, setNewLevel] = useState('');
  const [progressUser, setProgressUser] = useState<UserProfile | null>(null);
  const [userProgress, setUserProgress] = useState<ProgressData[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [selectedCourseViews, setSelectedCourseViews] = useState<{
    studentId: string;
    courseId: string;
    courseTitle: string;
  } | null>(null);

  // ── ID Editing State ──
  const [editingIdUid, setEditingIdUid] = useState<string | null>(null);
  const [tempIdValue, setTempIdValue] = useState('');

  // ── CMS State ──
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showCardStudent, setShowCardStudent] = useState<UserProfile | null>(null);
  const [activationTarget, setActivationTarget] = useState<UserProfile | null>(null);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [attendanceMsg, setAttendanceMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [balanceEditTarget, setBalanceEditTarget] = useState<UserProfile | null>(null);
  const [newBalance, setNewBalance] = useState<number>(0);
  const [depositTarget, setDepositTarget] = useState<UserProfile | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositNote, setDepositNote] = useState('شحن يدوي بالسنتر');
  const [depositing, setDepositing] = useState(false);
  const [deviceManageTarget, setDeviceManageTarget] = useState<UserProfile | null>(null);
  const [newMaxDevices, setNewMaxDevices] = useState<number>(2);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [groupAssignTarget, setGroupAssignTarget] = useState<UserProfile | null>(null);

  const [commissionEditTarget, setCommissionEditTarget] = useState<UserProfile | null>(null);
  const [newDefaultCommission, setNewDefaultCommission] = useState<number>(100);
  const [updatingCommission, setUpdatingCommission] = useState(false);

  // ── Fetch Users (using getDocs for better performance instead of onSnapshot) ──
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const all = snap.docs.map(
        (d) =>
          ({
            uid: d.id,
            ...d.data(),
          }) as UserProfile
      );
      setUsers(all);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();

    // Fetch all courses for activation
    getDocs(collection(db, 'Courses')).then((snap) => {
      setAllCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // Groups can stay as realtime since they're smaller
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snap) => {
      setAllGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsubGroups();
  }, [fetchUsers]);

  // ── Helper: Is Online ──
  const isOnline = (lastActive?: string) => {
    if (!lastActive) return false;
    const lastTime = new Date(lastActive).getTime();
    const now = new Date().getTime();
    return now - lastTime < 5 * 60 * 1000; // Active within last 5 mins
  };

  // ── Export Users to CSV ──
  const exportUsersToCsv = () => {
    const columns: CsvColumn<UserProfile>[] = [
      { header: 'الاسم', accessor: 'displayName' },
      { header: 'الإيميل', accessor: 'email' },
      { header: 'الكود', accessor: 'studentId' },
      {
        header: 'الدور',
        accessor: 'role',
        formatter: (v) => (v === 'student' ? 'طالب' : v === 'teacher' ? 'مدرس' : 'admin'),
      },
      {
        header: 'النوع',
        accessor: 'studentType',
        formatter: (v) => (v === 'online' ? 'أونلاين' : v === 'center' ? 'سنتر' : '—'),
      },
      { header: 'المرحلة', accessor: 'level' },
      { header: 'الصف', accessor: 'grade' },
      { header: 'الرصيد', accessor: 'walletBalance', formatter: (v) => `${v ?? 0} ج` },
      {
        header: 'تاريخ التسجيل',
        accessor: 'createdAt',
        formatter: (v) => formatDateForCsv(v as string),
      },
      {
        header: 'آخر نشاط',
        accessor: 'lastActive',
        formatter: (v) => formatDateForCsv(v as string),
      },
    ];

    downloadCsv(users, columns, 'قائمة_الطلاب.csv');
  };

  // ── Sequential ID Generation (Dual Track) ──
  const generateAllMissingCodes = async () => {
    const missing = users.filter((u) => u.role === 'student' && !u.studentId);
    if (missing.length === 0) {
      alert('جميع الطلاب لديهم أكواد بالفعل');
      return;
    }
    if (
      !window.confirm(
        `توليد أكواد لـ ${missing.length} طالب بشكل تسلسلي؟ (سيتم فصل الأونلاين عن السنتر)`
      )
    )
      return;

    setLoading(true);
    try {
      const batch = writeBatch(db);

      // Separate tracks
      const onlineIds = users
        .filter((u) => u.studentType !== 'center')
        .map((u) => u.studentId)
        .filter((id) => id?.startsWith('STU-2026-'));
      const centerIds = users
        .filter((u) => u.studentType === 'center')
        .map((u) => u.studentId)
        .filter((id) => id?.startsWith('STU-CEN-2026-'));

      let maxOnline = onlineIds
        .map((id) => parseInt(id!.split('-')[2], 10))
        .filter((n) => !isNaN(n))
        .reduce((a, b) => Math.max(a, b), 0);
      let maxCenter = centerIds
        .map((id) => parseInt(id!.split('-', 4)[3], 10))
        .filter((n) => !isNaN(n))
        .reduce((a, b) => Math.max(a, b), 0);

      missing.forEach((u) => {
        if (u.studentType === 'center') {
          maxCenter++;
          const newCode = `STU-CEN-2026-${String(maxCenter).padStart(3, '0')}`;
          batch.update(doc(db, 'users', u.uid), { studentId: newCode, studentType: 'center' });
        } else {
          maxOnline++;
          const newCode = `STU-2026-${String(maxOnline).padStart(3, '0')}`;
          batch.update(doc(db, 'users', u.uid), { studentId: newCode, studentType: 'online' });
        }
      });

      await batch.commit();
      alert(`تم توليد الأكواد بنجاح`);
    } catch (e) {
      alert('حدث خطأ أثناء التوليد');
    } finally {
      setLoading(false);
    }
  };

  // ── Re-order All IDs (Dual Track) ──
  const reorderAllIDs = async () => {
    const students = users
      .filter((u) => u.role === 'student')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (students.length === 0) return;
    if (
      !window.confirm(
        `تحذير: سيتم إعادة ترتيب كافة أكواد الطلاب (أونلاين وسنتر) بشكل منفصل حسب تاريخ الانضمام. هل تريد المتابعة؟`
      )
    )
      return;

    setLoading(true);
    try {
      const batch = writeBatch(db);
      let onlineCounter = 0;
      let centerCounter = 0;

      students.forEach((u) => {
        if (u.studentType === 'center') {
          centerCounter++;
          const newCode = `STU-CEN-2026-${String(centerCounter).padStart(3, '0')}`;
          batch.update(doc(db, 'users', u.uid), { studentId: newCode });
        } else {
          onlineCounter++;
          const newCode = `STU-2026-${String(onlineCounter).padStart(3, '0')}`;
          batch.update(doc(db, 'users', u.uid), { studentId: newCode });
        }
      });
      await batch.commit();
      alert('تمت إعادة الترتيب بنجاح');
    } catch (e) {
      alert('حدث خطأ أثناء إعادة الترتيب');
    } finally {
      setLoading(false);
    }
  };

  // ── Save Individual ID ──
  const saveIndividualId = async (uid: string) => {
    if (!tempIdValue.trim()) return;
    try {
      await updateDoc(doc(db, 'users', uid), { studentId: tempIdValue.trim().toUpperCase() });
      setEditingIdUid(null);
    } catch (e) {
      alert('خطأ في حفظ الكود');
    }
  };

  // ── Fetch Progress ──
  const loadProgress = async (targetUser: UserProfile) => {
    setProgressUser(targetUser);
    setProgressLoading(true);
    setSelectedCourseViews(null);
    try {
      const q = query(collection(db, 'user_progress'), where('userId', '==', targetUser.uid));
      const snap = await getDocs(q);
      const grouped: Record<string, ProgressData> = {};
      for (const d of snap.docs) {
        const data = d.data();
        const cId = data.courseId;
        if (!grouped[cId]) {
          let courseTitle = 'كورس';
          try {
            const cDoc = await getDoc(doc(db, 'Courses', cId));
            if (cDoc.exists()) courseTitle = cDoc.data().title;
          } catch {}
          grouped[cId] = { id: cId, courseId: cId, courseTitle, completedLessons: [] };
        }
        if (data.viewCount > 0) grouped[cId].completedLessons.push(data.lessonId);
      }
      setUserProgress(Object.values(grouped));
    } catch (e) {
      console.error(e);
    } finally {
      setProgressLoading(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: any) => {
    await updateDoc(doc(db, 'users', uid), { role: newRole });
  };

  const handleStatusToggle = async (u: UserProfile) => {
    const n = u.status === 'active' ? 'inactive' : 'active';
    await updateDoc(doc(db, 'users', u.uid), { status: n });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      const { uid } = deleteTarget;
      const batch = writeBatch(db);

      // 1. Mark as permanently deleted
      batch.set(doc(db, 'deleted_accounts', uid), {
        uid,
        email: deleteTarget.email,
        deletedAt: serverTimestamp(),
        reason: 'حذف من قبل المسؤول',
      });

      // 2. Fetch and delete Enrollments
      const enrollSnap = await getDocs(
        query(collection(db, 'Enrollments'), where('userId', '==', uid))
      );
      enrollSnap.forEach((d) => batch.delete(d.ref));

      // 3. Fetch and delete user_progress
      const progSnap = await getDocs(
        query(collection(db, 'user_progress'), where('userId', '==', uid))
      );
      progSnap.forEach((d) => batch.delete(d.ref));

      // 4. Fetch and delete transactions
      const transSnap = await getDocs(
        query(collection(db, 'transactions'), where('userId', '==', uid))
      );
      transSnap.forEach((d) => batch.delete(d.ref));

      // 5. Fetch and delete attendance
      const attSnap = await getDocs(
        query(collection(db, 'attendance'), where('studentId', '==', uid))
      );
      attSnap.forEach((d) => batch.delete(d.ref));

      // 6. Delete the main profile
      batch.delete(doc(db, 'users', uid));

      await batch.commit();
      setDeleteTarget(null);
      alert('تم حذف الحساب وكافة البيانات المرتبطة به بنجاح');
    } catch (e) {
      console.error('Delete failed:', e);
      alert('فشل حذف الحساب');
    } finally {
      setLoading(false);
    }
  };

  const handleGradeSave = async () => {
    if (!gradeEditTarget) return;
    await updateDoc(doc(db, 'users', gradeEditTarget.uid), { level: newLevel });
    setGradeEditTarget(null);
  };

  // ── CMS Logic ──
  const handleScanSuccess = async (decodedText: string) => {
    setIsScannerOpen(false);
    setAttendanceMsg(null);
    try {
      const q = query(
        collection(db, 'users'),
        where('studentId', '==', decodedText.trim().toUpperCase())
      );
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('الطالب غير موجود');

      const studentDoc = snap.docs[0];
      const studentData = studentDoc.data();
      const today = new Date().toISOString().split('T')[0];

      // Check if already in attendance collection
      const attQ = query(
        collection(db, 'attendance'),
        where('studentId', '==', studentDoc.id),
        where('dateString', '==', today)
      );
      const attSnap = await getDocs(attQ);
      if (!attSnap.empty) throw new Error('الطالب مسجل حضور بالفعل اليوم');

      const batch = writeBatch(db);
      // 1. Add log to attendance collection
      batch.set(doc(collection(db, 'attendance')), {
        studentId: studentDoc.id,
        studentName: studentData.displayName,
        studentCode: decodedText.toUpperCase(),
        timestamp: serverTimestamp(),
        dateString: today,
      });
      // 2. Update user array
      batch.update(doc(db, 'users', studentDoc.id), {
        attendance: [today, ...(studentData.attendance || [])].slice(0, 50),
      });

      await batch.commit();
      setAttendanceMsg({
        type: 'success',
        text: `تم تسجيل حضور ${studentData.displayName} بنجاح ✅`,
      });

      // Success Sound (optional if browser allows)
      try {
        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play();
      } catch (e) {}
    } catch (err: any) {
      setAttendanceMsg({ type: 'error', text: err.message });
      try {
        new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3').play();
      } catch (e) {}
    }
  };

  const activateCourseForStudent = async (studentId: string, courseId: string) => {
    try {
      await updateDoc(doc(db, 'users', studentId), {
        enrolledCourses: [
          courseId,
          ...(users.find((u) => u.uid === studentId)?.enrolledCourses || []),
        ],
      });
      // Also create an enrollment document
      await setDoc(doc(db, 'Enrollments', `${studentId}_${courseId}`), {
        userId: studentId,
        courseId,
        status: 'active',
        paymentMethod: 'center',
        createdAt: serverTimestamp(),
      });
      setActivationTarget(null);
      alert('تم تفعيل الكورس للطالب بنجاح');
    } catch (e) {
      alert('خطأ في تفعيل الكورس');
    }
  };

  const handleBlockToggle = async (u: UserProfile) => {
    const isBlocked = u.accountStatus === 'blocked';
    const newStatus = isBlocked ? 'active' : 'blocked';
    if (
      !window.confirm(
        `هل أنت متأكد من ${isBlocked ? 'إلغاء حظر' : 'حظر'} هذا الطالب من الدخول للمنصة؟`
      )
    )
      return;

    try {
      await updateDoc(doc(db, 'users', u.uid), { 
        accountStatus: newStatus,
        ...(newStatus === 'active' && { screenshotWarnings: 0 })
      });
      alert(isBlocked ? 'تم إلغاء الحظر بنجاح' : 'تم حظر الطالب بنجاح');
    } catch (e) {
      alert('حدث خطأ أثناء تغيير حالة الحساب');
    }
  };

  const handleManualDeposit = async () => {
    if (!depositTarget || depositAmount <= 0) return;
    setDepositing(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', depositTarget.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('المستخدم غير موجود');

        const currentBalance = userSnap.data().walletBalance ?? userSnap.data().balance ?? 0;
        const newBalance = currentBalance + depositAmount;

        transaction.update(userRef, {
          walletBalance: newBalance,
          balance: newBalance,
        });

        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          userId: depositTarget.uid,
          userName: depositTarget.displayName || depositTarget.email,
          type: 'deposit',
          amount: depositAmount,
          method: 'manual',
          note: depositNote,
          date: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      });

      setDepositTarget(null);
      setDepositAmount(0);
      setDepositNote('شحن يدوي بالسنتر');
      alert('تم إيداع المبلغ بنجاح وتحديث المحفظة');
    } catch (e: any) {
      alert('حدث خطأ: ' + e.message);
    } finally {
      setDepositing(false);
    }
  };

  const handleBalanceUpdate = async () => {
    if (!balanceEditTarget) return;
    await updateDoc(doc(db, 'users', balanceEditTarget.uid), {
      walletBalance: newBalance,
      balance: newBalance,
    });
    setBalanceEditTarget(null);
  };

  const handleCommissionUpdate = async () => {
    if (!commissionEditTarget) return;
    setUpdatingCommission(true);
    try {
      await updateDoc(doc(db, 'users', commissionEditTarget.uid), {
        defaultCommission: newDefaultCommission,
      });
      setCommissionEditTarget(null);
      alert('تم تحديث النسبة الافتراضية للمدرس بنجاح');
    } catch (e) {
      alert('حدث خطأ أثناء التحديث');
    } finally {
      setUpdatingCommission(false);
    }
  };

  const handleMaxDevicesUpdate = async (uid: string, maxVal: number) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        maxDevicesAllowed: maxVal,
      });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, maxDevicesAllowed: maxVal } : u));
      if (deviceManageTarget && deviceManageTarget.uid === uid) {
        setDeviceManageTarget(prev => prev ? { ...prev, maxDevicesAllowed: maxVal } : null);
      }
      alert('تم تحديث الحد الأقصى للأجهزة بنجاح');
    } catch (e: any) {
      alert('حدث خطأ: ' + e.message);
    }
  };

  const handleDeviceStatusUpdate = async (uid: string, deviceId: string, isBlocked: boolean) => {
    try {
      if (!deviceManageTarget) return;
      const updatedDevices = (deviceManageTarget.devices || []).map((dev: any) => {
        if (dev.id === deviceId) {
          return { ...dev, isBlocked };
        }
        return dev;
      });

      await updateDoc(doc(db, 'users', uid), {
        devices: updatedDevices,
      });

      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, devices: updatedDevices } : u));
      setDeviceManageTarget(prev => prev ? { ...prev, devices: updatedDevices } : null);
      alert(isBlocked ? 'تم حظر الجهاز بنجاح' : 'تم فك حظر الجهاز بنجاح');
    } catch (e: any) {
      alert('حدث خطأ: ' + e.message);
    }
  };

  const handleClearDevices = async (uid: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف جميع الأجهزة المرتبطة بهذا الطالب؟ سيتمكن الطالب من الدخول من أجهزة جديدة.')) return;
    try {
      await updateDoc(doc(db, 'users', uid), {
        devices: [],
      });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, devices: [] } : u));
      setDeviceManageTarget(prev => prev ? { ...prev, devices: [] } : null);
      alert('تم حذف جميع الأجهزة بنجاح');
    } catch (e: any) {
      alert('حدث خطأ: ' + e.message);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const displayUsers = useMemo(() => {
    return users
      .filter((u) => {
        const q = searchQuery.toLowerCase();
        const mS =
          !q ||
          u.displayName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.studentId?.toLowerCase().includes(q);
        const mL = !levelFilter || u.level === levelFilter;
        const mR = roleFilter === 'all' || u.role === roleFilter;
        const mT =
          studentTypeFilter === 'all' ||
          (studentTypeFilter === 'center'
            ? u.studentType === 'center'
            : u.studentType !== 'center');
        return mS && mL && mR && mT;
      })
      .sort((a, b) => {
        const av = (a as any)[sortField] || '';
        const bv = (b as any)[sortField] || '';
        const cmp = String(av).localeCompare(String(bv), 'ar');
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [users, searchQuery, levelFilter, roleFilter, sortField, sortOrder]);

  const paginatedUsers = usePagination(displayUsers, 25);

  return (
    <div dir="rtl" className="min-h-screen space-y-6 text-right">
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-3xl flex items-center justify-center shrink-0 shadow-2xl shadow-blue-500/5 border border-blue-500/10 transition-transform hover:scale-105 duration-500">
            <Users size={36} />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl md:text-4xl font-black text-white leading-none tracking-tight">
              إدارة المستخدمين
            </h1>
            <p className="text-slate-500 text-xs md:text-sm font-bold opacity-80">
              تحكم كامل في الطلاب، المعلمين، والعمليات المالية • {users.length} مستخدم
            </p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="mr-auto p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw size={20} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-5 rounded-[1.5rem] font-black shadow-xl shadow-emerald-500/20 transition-all text-sm group"
          >
            <Smartphone size={20} className="group-hover:scale-110 transition-transform" />
            <span>ماسح الحضور</span>
          </button>

          <button
            onClick={generateAllMissingCodes}
            className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-6 py-5 rounded-[1.5rem] font-black shadow-xl shadow-blue-500/20 transition-all text-sm group"
          >
            <Zap size={20} className="group-hover:scale-110 transition-transform" />
            <span>توليد أكواد</span>
          </button>

          <button
            onClick={reorderAllIDs}
            className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white px-6 py-5 rounded-[1.5rem] font-black border border-white/10 transition-all text-sm group sm:col-span-2 lg:col-span-1"
          >
            <ArrowUpDown
              size={20}
              className="group-hover:rotate-180 transition-transform duration-500"
            />
            <span>إعادة ترتيب</span>
          </button>

          <button
            onClick={exportUsersToCsv}
            className="flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-5 rounded-[1.5rem] font-black shadow-xl shadow-emerald-500/20 transition-all text-sm group"
          >
            <Download size={20} className="group-hover:scale-110 transition-transform" />
            <span>تصدير CSV</span>
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-white/5 border border-white/8 rounded-2xl w-fit overflow-x-auto">
        {[
          { id: 'students', label: 'الطلاب', icon: Users },
          { id: 'attendance', label: 'تبويب الغياب', icon: CheckSquare },
          { id: 'transactions', label: 'المالية', icon: Wallet },
          { id: 'enrollments', label: 'الاشتراكات', icon: BookMarked },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'students' && (
          <motion.div
            key="st"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="ابحث بالاسم، الإيميل، أو الكود..."
                  className="w-full"
                />
              </div>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 text-white appearance-none"
              >
                <option value="">كل المراحل</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                value={studentTypeFilter}
                onChange={(e) => setStudentTypeFilter(e.target.value as any)}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 text-white appearance-none"
              >
                <option value="all">كل الطلاب</option>
                <option value="online">طلاب الأونلاين</option>
                <option value="center">طلاب السنتر (VIP)</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-white/8 bg-[#0a1220]/50 backdrop-blur-sm shadow-2xl">
              <table className="w-full text-right min-w-[1000px]">
                <thead>
                  <tr className="bg-white/5 border-b border-white/8 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <th className="px-6 py-5">المستخدم</th>
                    <th className="px-6 py-5">حالة الاتصال</th>
                    <th className="px-6 py-5">الكود</th>
                    <th className="px-6 py-5 text-center">الدور</th>
                    <th className="px-6 py-5 text-center">الحالة</th>
                    <th className="px-6 py-5 text-center">المرحلة</th>
                    <th className="px-6 py-5 text-center">الرصيد</th>
                    <th className="px-6 py-5 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedUsers.items.map((u) => (
                    <tr key={u.uid} className="hover:bg-white/3 transition-colors group">
                      <td className="px-6 py-4">
                        <Link to={`/teacher/students/${u.uid}`} className="flex items-center gap-3 group/link hover:bg-white/5 p-2 rounded-xl transition-colors cursor-pointer">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black group-hover/link:scale-110 transition-transform shadow-lg relative">
                            {u.displayName?.charAt(0)}
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover/link:opacity-100 transition-opacity">
                              <span className="text-[10px]">↗</span>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-white font-bold text-sm group-hover/link:text-blue-400 transition-colors">{u.displayName}</p>
                              {u.studentType === 'center' && (
                                <span className="flex items-center gap-0.5 bg-amber-500/10 text-amber-500 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-amber-500/20">
                                  <Award size={8} className="fill-current" /> سنتر
                                </span>
                              )}
                            </div>
                            <p className="text-slate-500 text-xs">{u.email}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {isOnline(u.lastActive) ? (
                          <div className="flex items-center gap-2">
                            <div className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </div>
                            <span className="text-emerald-400 text-[10px] font-black uppercase tracking-wide">
                              متصل الآن
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px] font-bold">
                            نشط منذ{' '}
                            {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'فترة'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingIdUid === u.uid ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={tempIdValue}
                              onChange={(e) => setTempIdValue(e.target.value)}
                              autoFocus
                              className="w-32 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-all uppercase"
                            />
                            <button
                              onClick={() => saveIndividualId(u.uid)}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              onClick={() => setEditingIdUid(null)}
                              className="p-1 text-red-400 hover:text-red-300"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingIdUid(u.uid);
                              setTempIdValue(u.studentId || '');
                            }}
                            className="cursor-pointer group/id flex items-center gap-2"
                          >
                            {u.studentId ? (
                              <code className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-lg font-mono text-xs group-hover/id:border-blue-500/50 transition-all">
                                {u.studentId}
                              </code>
                            ) : (
                              <span className="text-slate-700 text-[10px] font-black group-hover:text-slate-500">
                                + أضف كود
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black border appearance-none bg-transparent ${u.role === 'admin' ? 'text-red-400 border-red-500/20' : u.role === 'teacher' ? 'text-yellow-400 border-yellow-500/20' : 'text-blue-400 border-blue-500/20'}`}
                        >
                          <option value="student">طالب</option>
                          <option value="teacher">معلم</option>
                          <option value="admin">أدمن</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <button
                            onClick={() => handleBlockToggle(u)}
                            className={`px-3 py-1 rounded-xl text-[10px] font-black border transition-all ${u.accountStatus === 'blocked' ? 'bg-red-500/10 text-red-500 border-red-500/20 shadow-md shadow-red-500/10' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'}`}
                          >
                            {u.accountStatus === 'blocked' ? 'محظور' : 'نشط'}
                          </button>
                          {(u.screenshotWarnings || 0) > 0 && (
                            <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20" title="عدد محاولات تصوير الشاشة">
                              إنذارات تصوير: {u.screenshotWarnings}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            setGradeEditTarget(u);
                            setNewLevel(u.level || '');
                          }}
className="bg-white/5 border border-white/10 px-3 py-1 rounded-xl text-[10px] text-slate-400 hover:text-white transition-all"
                        >
                          {u.level || 'غير محدد'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-emerald-400 font-black text-sm">
                            {(u.walletBalance ?? u.balance ?? 0).toLocaleString('ar-EG')} ج
                          </span>
                          <button
                            onClick={() => {
                              setDepositTarget(u);
                              setDepositAmount(0);
                            }}
                            className="p-1 text-emerald-500 hover:text-emerald-400 transition-colors"
                            title="إيداع رصيد (كاش)"
                          >
                            <PlusCircle size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setBalanceEditTarget(u);
                              setNewBalance(u.walletBalance ?? u.balance ?? 0);
                            }}
                            className="p-1 text-slate-500 hover:text-white transition-colors"
                            title="تعديل الرصيد مباشرة"
                          >
                            <Wallet size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => loadProgress(u)}
                            className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all"
                            title="عرض التقدم"
                          >
                            <Activity size={18} />
                          </button>

                          <button
                            onClick={() => setGroupAssignTarget(u)}
                            className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all"
                            title="تحديد المجموعة"
                          >
                            <Users size={18} />
                          </button>

                          {u.role === 'student' && (
                            <button
                              onClick={() => {
                                setDeviceManageTarget(u);
                                setNewMaxDevices(u.maxDevicesAllowed || 2);
                              }}
                              className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                              title="إدارة الأجهزة"
                            >
                              <Smartphone size={18} />
                            </button>
                          )}

                          {u.studentType === 'center' && (
                            <>
                              <button
                                onClick={() => setShowCardStudent(u)}
                                className="p-2 text-amber-400 hover:bg-amber-500/10 rounded-xl transition-all"
                                title="عرض الكارنيه"
                              >
                                <CreditCard size={18} />
                              </button>
                              <button
                                onClick={() => setActivationTarget(u)}
                                className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all"
                                title="تفعيل شهر / كورس"
                              >
                                <Zap size={18} />
                              </button>
                            </>
                          )}

                          {u.role === 'teacher' && (
                            <button
                              onClick={() => {
                                setCommissionEditTarget(u);
                                setNewDefaultCommission(u.defaultCommission ?? 100);
                              }}
                              className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all"
                              title="تحديد النسبة الافتراضية"
                            >
                              <Percent size={18} />
                            </button>
                          )}

                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                            title="حذف"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={paginatedUsers.page}
              totalPages={paginatedUsers.totalPages}
              onPageChange={paginatedUsers.setPage}
            />
          </motion.div>
        )}

        {activeTab === 'attendance' && (
          <motion.div key="att">
            <AttendanceTab />
          </motion.div>
        )}
        {activeTab === 'transactions' && (
          <motion.div key="tr">
            <TransactionsTab />
          </motion.div>
        )}
        {activeTab === 'enrollments' && (
          <motion.div key="en">
            <EnrollmentsTab />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {progressUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#0a1220] border border-white/10 rounded-[3rem] w-full max-w-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/3">
                <h2 className="text-2xl font-black text-white">
                  إدارة مشاهدات {progressUser.displayName}
                </h2>
                <button
                  onClick={() => setProgressUser(null)}
                  className="p-2 text-slate-500 hover:text-white"
                >
                  <X size={28} />
                </button>
              </div>
              <div className="p-8 max-h-[70vh] overflow-y-auto">
                {selectedCourseViews ? (
                  <CourseViewsEditor
                    courseId={selectedCourseViews.courseId}
                    courseTitle={selectedCourseViews.courseTitle}
                    studentId={progressUser.uid}
                    onBack={() => setSelectedCourseViews(null)}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {userProgress.map((p) => (
                      <div
                        key={p.id}
                        className="p-5 bg-white/3 rounded-[2rem] border border-white/10 hover:border-blue-500 transition-all group"
                      >
                        <p className="font-bold text-white mb-4 line-clamp-1">{p.courseTitle}</p>
                        <button
                          onClick={() =>
                            setSelectedCourseViews({
                              studentId: progressUser.uid,
                              courseId: p.courseId,
                              courseTitle: p.courseTitle || '',
                            })
                          }
                          className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-blue-500/20"
                        >
                          تعديل المشاهدات
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-[#0a1220] p-10 rounded-[3rem] border border-red-500/20 text-center max-w-sm w-full"
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-white mb-2">حذف المستخدم</h3>
              <p className="text-slate-400 text-sm mb-8">
                هل أنت متأكد من حذف حساب {deleteTarget.displayName}؟
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="bg-white/5 p-4 rounded-2xl text-white font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleDelete}
                  className="bg-red-600 p-4 rounded-2xl text-white font-bold shadow-xl shadow-red-500/20"
                >
                  حذف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gradeEditTarget && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-[#0a1220] p-10 rounded-[3rem] border border-white/10 max-w-sm w-full text-right"
            >
              <h3 className="text-xl font-black text-white mb-6">تغيير المرحلة</h3>
              <select
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
                className="w-full bg-white/5 border border-white/15 p-4 rounded-2xl text-white mb-8"
              >
                <option value="">اختار المرحلة</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setGradeEditTarget(null)}
                  className="bg-white/5 p-4 rounded-2xl text-white font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleGradeSave}
                  className="bg-blue-600 p-4 rounded-2xl text-white font-bold"
                >
                  حفظ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* 📋 QR ID Card Modal */}
        {showCardStudent && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCardStudent(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white text-black p-8 rounded-[2rem] shadow-2xl max-w-sm w-full print:p-0 print:shadow-none min-h-[500px] flex flex-col justify-between overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16" />

              <div className="text-center relative z-10">
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl text-center leading-10">
                    ف
                  </div>
                  <span className="text-xl font-black tracking-tight text-slate-900">
                    منصة فهمني
                  </span>
                </div>

                <div className="w-32 h-32 mx-auto rounded-3xl border-4 border-slate-100 overflow-hidden mb-6 bg-slate-50 flex items-center justify-center text-slate-300">
                  <User size={48} />
                </div>

                <h3 className="text-2xl font-black mb-1 text-slate-900">
                  {showCardStudent.displayName}
                </h3>
                <p className="text-blue-600 font-bold mb-8 uppercase tracking-widest text-sm">
                  كود الطالب: {showCardStudent.studentId || 'N/A'}
                </p>

                <div className="bg-slate-50 p-6 rounded-[2rem] inline-block border-2 border-slate-100 mb-8">
                  <QRCodeSVG value={showCardStudent.studentId || 'N/A'} size={150} level="H" />
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest border-t border-slate-100 pt-6">
                بطاقة عضوية السنتر المعتمدة — 2026/2025
              </div>

              <div className="flex gap-2 mt-6 print:hidden">
                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-sm shadow-lg"
                >
                  طباعة الكارت
                </button>
                <button
                  onClick={() => setShowCardStudent(null)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black text-sm"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 📷 QR Scanner Modal */}
        {isScannerOpen && (
          <ScannerDialog
            onClose={() => setIsScannerOpen(false)}
            onScanSuccess={handleScanSuccess}
          />
        )}

        {/* ⚡ Course/Month Activation Modal */}
        {activationTarget && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActivationTarget(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#0d1425] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full"
            >
              <h3 className="text-2xl font-black text-white mb-2">تفعيل كورس يدوياً</h3>
              <p className="text-slate-400 text-sm mb-6">
                تفعيل الوصول لكورس للطالب:{' '}
                <span className="text-white font-bold">{activationTarget.displayName}</span>
              </p>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {allCourses.map((course) => {
                  const isEnrolled = activationTarget.enrolledCourses?.includes(course.id);
                  return (
                    <button
                      key={course.id}
                      disabled={isEnrolled}
                      onClick={() => activateCourseForStudent(activationTarget.uid, course.id)}
                      className={`w-full p-4 rounded-2xl border text-right transition-all flex items-center justify-between group ${isEnrolled ? 'opacity-50 grayscale bg-white/5 border-white/5' : 'bg-white/5 border-white/10 hover:border-emerald-500/50'}`}
                    >
                      <div>
                        <p className="text-white font-bold text-sm">{course.title}</p>
                        <p className="text-[10px] text-slate-500 font-bold">
                          {course.subject} — {course.price} ج
                        </p>
                      </div>
                      {isEnrolled ? (
                        <CheckCircle2 size={20} className="text-emerald-500" />
                      ) : (
                        <Zap
                          size={20}
                          className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-all"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setActivationTarget(null)}
                className="w-full mt-6 py-4 bg-white/5 text-slate-400 rounded-2xl font-black hover:text-white transition-all"
              >
                إلغاء
              </button>
            </motion.div>
          </div>
        )}

        {/* 📢 Attendance Feedback Notification */}
        {attendanceMsg && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-10 left-10 z-[3000] p-6 rounded-2xl shadow-2xl border flex items-center gap-4 bg-gray-900 border-white/10 min-w-[300px]"
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${attendanceMsg.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}
            >
              {attendanceMsg.type === 'success' ? (
                <CheckCircle2 size={24} />
              ) : (
                <AlertCircle size={24} />
              )}
            </div>
            <div>
              <p
                className={`font-black ${attendanceMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {attendanceMsg.type === 'success' ? 'عملية ناجحة' : 'حدث خطأ'}
              </p>
              <p className="text-white text-sm font-bold">{attendanceMsg.text}</p>
            </div>
            <button
              onClick={() => setAttendanceMsg(null)}
              className="ml-auto text-slate-500 hover:text-white p-2"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* 💰 Wallet Balance Edit Modal */}
        {balanceEditTarget && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBalanceEditTarget(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#0d1425] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-right"
            >
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Wallet size={32} />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">تعديل رصيد المحفظة</h3>
              <p className="text-slate-400 text-sm mb-8">
                تعديل رصيد الطالب:{' '}
                <span className="text-white font-bold">{balanceEditTarget.displayName}</span>
              </p>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="number"
                    value={newBalance}
                    onChange={(e) => setNewBalance(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/15 p-4 rounded-2xl text-white text-center font-black text-xl appearance-none"
                  />
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                    ج
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleBalanceUpdate}
                    className="bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-emerald-500/20"
                  >
                    حفظ الرصيد
                  </button>
                  <button
                    onClick={() => setBalanceEditTarget(null)}
                    className="bg-white/5 text-slate-400 py-4 rounded-2xl font-black"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* 💰 Deposit Modal */}

        {depositTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDepositTarget(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#0f172a] border border-emerald-500/20 w-full max-w-md p-8 rounded-[2rem] shadow-2xl"
            >
              <h3 className="text-xl font-black text-white mb-2 flex items-center gap-3">
                <Wallet className="text-emerald-500" /> إيداع رصيد للطالب
              </h3>
              <p className="text-slate-400 text-xs mb-6 font-bold">
                {depositTarget.displayName} ({depositTarget.email})
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 mr-2">
                    المبلغ المودع (ج.م)
                  </label>
                  <input
                    type="number"
                    value={depositAmount || ''}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-emerald-400 font-black text-xl"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 mr-2">ملاحظات الإيداع</label>
                  <input
                    type="text"
                    value={depositNote}
                    onChange={(e) => setDepositNote(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    disabled={depositing || depositAmount <= 0}
                    onClick={handleManualDeposit}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {depositing ? 'جاري الإيداع...' : 'تأكيد الإيداع'}
                  </button>
                  <button
                    onClick={() => setDepositTarget(null)}
                    className="px-6 bg-white/5 text-slate-300 rounded-2xl font-black hover:bg-white/10 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* 📊 Teacher Default Commission Modal */}
        {commissionEditTarget && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCommissionEditTarget(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#0d1425] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-right"
            >
              <div className="w-16 h-16 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Percent size={32} />
              </div>
              <h3 className="text-2xl font-black text-white mb-2 text-center">
                النسبة الافتراضية للمدرس
              </h3>
              <p className="text-slate-400 text-sm mb-8 text-center px-4">
                حدد حصة المدرس الافتراضية من مبيعات كورساته.{' '}
                <span className="text-white font-bold">{commissionEditTarget.displayName}</span>
              </p>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newDefaultCommission}
                    onChange={(e) => setNewDefaultCommission(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/15 p-4 rounded-2xl text-white text-center font-black text-3xl appearance-none"
                  />
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-purple-500 font-bold">
                    %
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-bold text-center">
                  هذه النسبة ستُستخدم كقيمة افتراضية عند إضافة كورس جديد لهذا المدرس.
                </p>
                <div className="grid grid-cols-2 gap-3 mt-8">
                  <button
                    disabled={updatingCommission}
                    onClick={handleCommissionUpdate}
                    className="bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-purple-500/20 disabled:opacity-50"
                  >
                    {updatingCommission ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                  </button>
                  <button
                    onClick={() => setCommissionEditTarget(null)}
                    className="bg-white/5 text-slate-400 py-4 rounded-2xl font-black"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* 👥 Group Assignment Modal */}
        {groupAssignTarget && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGroupAssignTarget(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#0d1425] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-right"
            >
              <h3 className="text-2xl font-black text-white mb-2">تحديد مجموعة الطالب</h3>
              <p className="text-slate-400 text-sm mb-6">
                اختيار مجموعة ثابتة للطالب:{' '}
                <span className="text-white font-bold">{groupAssignTarget.displayName}</span>
              </p>

              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                <button
                  onClick={async () => {
                    await updateDoc(doc(db, 'users', groupAssignTarget.uid), { groupId: null });
                    setGroupAssignTarget(null);
                  }}
                  className={`w-full p-4 rounded-xl border text-right transition-all bg-white/5 border-white/5 hover:border-red-500/20 text-red-400 font-bold text-sm ${!groupAssignTarget.groupId ? 'border-red-500/50' : ''}`}
                >
                  بدون مجموعة
                </button>
                {allGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={async () => {
                      await updateDoc(doc(db, 'users', groupAssignTarget.uid), { groupId: g.id });
                      setGroupAssignTarget(null);
                    }}
                    className={`w-full p-4 rounded-xl border text-right transition-all flex items-center justify-between ${groupAssignTarget.groupId === g.id ? 'bg-brand-blue/20 border-brand-blue text-brand-blue' : 'bg-white/5 border-white/10 hover:border-brand-blue/50 text-white'}`}
                  >
                    <span className="font-bold text-sm">{g.name}</span>
                    {groupAssignTarget.groupId === g.id && <CheckCircle2 size={16} />}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setGroupAssignTarget(null)}
                className="w-full mt-6 py-4 bg-white/5 text-slate-400 rounded-2xl font-black hover:text-white transition-all"
              >
                إغلاق
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* 📱 Device Management Modal */}
        {deviceManageTarget && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeviceManageTarget(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#0d1425] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full text-right overflow-hidden flex flex-col max-h-[90vh]"
              dir="rtl"
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Smartphone size={32} />
              </div>
              <h3 className="text-2xl font-black text-white mb-2 text-center">إدارة أجهزة الطالب</h3>
              <p className="text-slate-400 text-sm mb-6 text-center">
                اسم الطالب: <span className="text-white font-bold">{deviceManageTarget.displayName}</span>
              </p>

              {/* 🛠️ Max Devices Config */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
                <label className="block text-slate-400 text-xs font-bold mb-2">الحد الأقصى للأجهزة المسموح بها</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newMaxDevices}
                    onChange={(e) => setNewMaxDevices(Math.max(1, Number(e.target.value)))}
                    className="flex-1 bg-black/30 border border-white/10 p-3 rounded-xl text-white text-center font-bold text-lg"
                  />
                  <button
                    onClick={() => handleMaxDevicesUpdate(deviceManageTarget.uid, newMaxDevices)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 rounded-xl font-bold text-sm transition-all"
                  >
                    تحديث
                  </button>
                </div>
              </div>

              {/* 📱 Connected Devices List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-bold text-sm">الأجهزة المتصلة حالياً ({ (deviceManageTarget.devices || []).length })</h4>
                  {(deviceManageTarget.devices || []).length > 0 && (
                    <button
                      onClick={() => handleClearDevices(deviceManageTarget.uid)}
                      className="text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-1"
                    >
                      حذف جميع الأجهزة
                    </button>
                  )}
                </div>

                {(deviceManageTarget.devices || []).length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-6">لا توجد أجهزة مرتبطة بهذا الحساب حالياً.</p>
                ) : (
                  <div className="space-y-3">
                    {(deviceManageTarget.devices || []).map((device: any, idx: number) => (
                      <div key={device.id || idx} className="bg-black/30 border border-white/5 p-4 rounded-xl flex items-center justify-between text-right">
                        <div className="space-y-1">
                          <p className="text-white font-bold text-sm flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            {device.name || 'جهاز غير معروف'}
                          </p>
                          <p className="text-[10px] text-slate-500 font-bold break-all">ID: {device.id}</p>
                          <p className="text-[10px] text-slate-400 font-bold">آخر ظهور: {device.lastIp || 'N/A'} - {device.lastLogin ? new Date(device.lastLogin).toLocaleDateString('ar-EG') : 'N/A'}</p>
                        </div>
                        <div>
                          {device.isBlocked ? (
                            <button
                              onClick={() => handleDeviceStatusUpdate(deviceManageTarget.uid, device.id, false)}
                              className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                            >
                              فك الحظر
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeviceStatusUpdate(deviceManageTarget.uid, device.id, true)}
                              className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                            >
                              حظر الجهاز
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setDeviceManageTarget(null)}
                className="w-full py-4 bg-white/5 text-slate-400 rounded-2xl font-black hover:text-white transition-all text-center"
              >
                إغلاق
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── QR Scanner Component ──────────────────────────────────────────────────
const ScannerDialog: React.FC<{ onClose: () => void; onScanSuccess: (text: string) => void }> = ({
  onClose,
  onScanSuccess,
}) => {
  useEffect(() => {
    // html5-qrcode scanner init
    const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 250 }, false);
    scanner.render(onScanSuccess, (err: any) => {});
    return () => {
      scanner.clear().catch((e) => console.warn(e));
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-[#0d1425] border border-white/10 p-4 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 mb-4">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <Smartphone size={20} className="text-emerald-400" /> ماسح الأكواد
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div
          id="reader"
          className="overflow-hidden rounded-[2rem] border border-white/5 bg-black/20"
        />
        <p className="text-center text-slate-500 text-xs font-bold py-6 font-primary">
          وجه كاميرا الموبايل نحو كود QR الخاص بالطالب
        </p>
      </motion.div>
    </div>
  );
};
