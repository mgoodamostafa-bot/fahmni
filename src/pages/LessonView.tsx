import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  CheckCircle2,
  Lock,
  ChevronRight,
  ChevronLeft,
  FileText,
  Download,
  Award,
  MessageSquare,
  Layout,
  Clock,
  Menu,
  X,
  ExternalLink,
  Volume2,
  Settings,
  SkipForward,
  SkipBack,
  Info,
  BookOpen,
  LayoutDashboard,
  HelpCircle,
  Key,
  Loader2,
  Upload,
  FileCheck,
  AlertTriangle,
  AlertCircle,
  Copy,
  Eye,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  increment,
  writeBatch,
  addDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, getTenantDb, storage } from '../lib/firebase';
import { encryptUrl } from '../utils/crypto';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTenant } from '../contexts/TenantContext';
import { Quiz } from '../components/Quiz';
import { CourseDiscussions } from '../components/CourseDiscussions';
import { LessonSkeleton } from '../components/Skeleton';
import { FahmniPlayer } from '../components/FahmniPlayer';
import { CertificateGenerator } from '../components/CertificateGenerator';
import { FileTypeIcon } from '../components/FileTypeIcon';

interface Course {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  subject?: string;
}

interface Lesson {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  order: number;
  isFreePreview: boolean;
  allowedViews?: number;
  summary?: string;
  pdfUrl?: string;
  quiz?: any;
  pdfPrice?: number;
  examId?: string;
  quizUrl?: string;
}

export const LessonView: React.FC = () => {
  const { settings } = useSettings();
  const { tenantData } = useTenant();
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const currentLesson = activeLesson || lessons[0];
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    'video' | 'summary' | 'discussions' | 'homework' | 'quiz'
  >('video');
  const [navLessons, setNavLessons] = useState<{ next: Lesson | null; prev: Lesson | null }>({
    next: null,
    prev: null,
  });
  const [internalQuiz, setInternalQuiz] = useState<any>(null);
  const [userQuizResult, setUserQuizResult] = useState<any>(null);
  const [checkingQuizResult, setCheckingQuizResult] = useState(true);
  const [isBookletPurchased, setIsBookletPurchased] = useState(false);
  const [checkingBooklet, setCheckingBooklet] = useState(true);
  const [buyingBooklet, setBuyingBooklet] = useState(false);

  useEffect(() => {
    const checkBookletPurchase = async () => {
      if (!user || !currentLesson) {
        setIsBookletPurchased(false);
        setCheckingBooklet(false);
        return;
      }
      setCheckingBooklet(true);
      try {
        const isFree = !(currentLesson.pdfPrice && Number(currentLesson.pdfPrice) > 0);
        const hasAccess = profile?.role === 'teacher' || profile?.role === 'admin' || profile?.isOwner;
        
        if (isFree || hasAccess) {
          setIsBookletPurchased(true);
          setCheckingBooklet(false);
          return;
        }

        const purchaseSnap = await getDoc(doc(db, 'booklet_purchases', `${user.uid}_${currentLesson.id}`));
        setIsBookletPurchased(purchaseSnap.exists());
      } catch (err) {
        console.error('Error checking booklet purchase:', err);
        setIsBookletPurchased(false);
      } finally {
        setCheckingBooklet(false);
      }
    };

    checkBookletPurchase();
  }, [user, currentLesson?.id, profile?.role]);

  const handleBuyBooklet = async () => {
    if (!user || !currentLesson || !course) return;
    const price = Number(currentLesson.pdfPrice || 0);
    if ((profile?.walletBalance || 0) < price) {
      alert('رصيدك في المحفظة غير كافٍ لشراء هذه الملزمة. يرجى شحن محفظتك أولاً.');
      return;
    }

    if (!confirm(`هل أنت متأكد من رغبتك في شراء ملزمة "${currentLesson.title}" بمبلغ ${price} ج.م من رصيد محفظتك؟`)) {
      return;
    }

    setBuyingBooklet(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const teacherRef = course.teacherId ? doc(db, 'users', course.teacherId) : null;
      
      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('مستند الطالب غير موجود');
        const currentBalance = userSnap.data().walletBalance || 0;
        if (currentBalance < price) throw new Error('رصيدك غير كافٍ');

        let teacherSnap = null;
        if (teacherRef) {
          teacherSnap = await transaction.get(teacherRef);
        }

        transaction.update(userRef, { walletBalance: currentBalance - price });

        if (teacherRef) {
          const commissionPercent = teacherSnap?.exists() ? (teacherSnap.data().defaultCommission ?? 100) : 100;
          const teacherShare = (price * Number(commissionPercent)) / 100;
          transaction.set(teacherRef, {
            totalEarnings: increment(teacherShare),
            walletBalance: increment(teacherShare)
          }, { merge: true });
        }

        const purchaseId = `${user.uid}_${currentLesson.id}`;
        transaction.set(doc(db, 'booklet_purchases', purchaseId), {
          userId: user.uid,
          lessonId: currentLesson.id,
          courseId: course.id,
          price: price,
          purchasedAt: serverTimestamp()
        });

        const tId = doc(collection(db, 'transactions')).id;
        const commissionPercent = teacherSnap?.exists() ? (teacherSnap.data().defaultCommission ?? 100) : 100;
        const teacherShare = (price * Number(commissionPercent)) / 100;
        
        transaction.set(doc(db, 'transactions', tId), {
          userId: user.uid,
          amount: -price,
          type: 'booklet_purchase',
          bookletName: currentLesson.title,
          lessonId: currentLesson.id,
          courseName: course.title,
          courseId: course.id,
          teacherId: course.teacherId || '',
          teacherShare,
          platformShare: price - teacherShare,
          commissionPercentage: commissionPercent,
          date: serverTimestamp()
        });
      });

      alert('تم شراء الملزمة بنجاح!');
      setIsBookletPurchased(true);
    } catch (err: any) {
      console.error('Error purchasing booklet:', err);
      alert('حدث خطأ أثناء إتمام عملية الشراء: ' + err.message);
    } finally {
      setBuyingBooklet(false);
    }
  };

  const [downloadingBooklet, setDownloadingBooklet] = useState(false);
  const handleDownloadBooklet = async () => {
    if (!currentLesson?.pdfUrl) return;
    setDownloadingBooklet(true);
    try {
      const url = currentLesson.pdfUrl;
      const filename = currentLesson.title || 'ملخص الحصة';
      
      const isPdf =
        url.toLowerCase().includes('.pdf') ||
        url.toLowerCase().includes('/o/portfolioresources') ||
        url.toLowerCase().includes('/o/lessons') ||
        url.toLowerCase().includes('drive.google.com') ||
        url.toLowerCase().includes('dropbox.com');

      if (isPdf && profile) {
        let ipAddress = 'Local';
        try {
          const { getPublicIP } = await import('../lib/deviceFingerprint');
          ipAddress = await getPublicIP(2000);
        } catch (e) {
          console.warn('Could not fetch public IP for watermark', e);
        }

        // Bypass CORS for external links by routing through our backend download proxy
        const fetchUrl = url.includes('drive.google.com') || url.includes('dropbox.com')
          ? `/api/download-proxy?url=${encodeURIComponent(url)}`
          : url;

        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error('Failed to fetch PDF file');
        const arrayBuffer = await response.arrayBuffer();

        const { stampPDFWithForensics } = await import('../utils/pdfForensic');
        const stampedBytes = await stampPDFWithForensics(arrayBuffer, {
          studentName: profile.displayName,
          studentPhone: profile.studentPhone || profile.email,
          studentEmail: profile.email,
          studentId: profile.studentId || '000000',
          ipAddress,
        });

        const blob = new Blob([stampedBytes], { type: 'application/pdf' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${filename}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      } else {
        const { downloadViaProxy } = await import('../utils/download');
        await downloadViaProxy(url, `${filename}.pdf`);
      }
    } catch (err: any) {
      console.error('Forensic download failed, falling back to direct tab open:', err);
      alert(`عذراً، فشل التحميل الآمن للبصمة المائية بسبب: ${err.message || err}\nسيتم فتح الملف مباشرة كبديل.`);
      window.open(currentLesson.pdfUrl, '_blank');
    } finally {
      setDownloadingBooklet(false);
    }
  };
  const [homeworkLink, setHomeworkLink] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [showActivationPopup, setShowActivationPopup] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [courseProgress, setCourseProgress] = useState<Record<string, any>>({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [isCheckingLock, setIsCheckingLock] = useState(true);
  const [lockedReason, setLockedReason] = useState<string | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // -- Screenshot Protection States --
  const [isObscured, setIsObscured] = useState(false);
  const [screenshotWarningMsg, setScreenshotWarningMsg] = useState<string | null>(null);

  // -- Video Protection States --
  const [remainingViews, setRemainingViews] = useState<number>(5);
  const [consumedViews, setConsumedViews] = useState<number>(0);
  const [allowedViews, setAllowedViews] = useState<number>(5);
  const hasTriggeredDeductionRef = useRef<boolean>(false);

  // Sidebar mobile toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!courseId) return;

      setLoading(true);
      try {
        const fetchCourseData = async () => {
          let docSnap = await getDoc(doc(db, 'Courses', courseId));
          if (!docSnap.exists()) docSnap = await getDoc(doc(db, 'courses', courseId));
          return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Course) : null;
        };

        const fetchEnrollmentData = async () => {
          if (!user) return null;
          const enrollmentId = `${user.uid}_${courseId}`;
          let docSnap = await getDoc(doc(db, 'Enrollments', enrollmentId));
          if (!docSnap.exists()) docSnap = await getDoc(doc(db, 'enrollments', enrollmentId));
          return docSnap.exists() ? docSnap.data() : null;
        };

        const fetchLessonsData = async () => {
          const qUpper = query(collection(db, 'Lessons'), where('courseId', '==', courseId));
          const qLower = query(collection(db, 'lessons'), where('courseId', '==', courseId));
          const [snapUpper, snapLower] = await Promise.all([getDocs(qUpper), getDocs(qLower)]);
          const allDocs = [...snapUpper.docs, ...snapLower.docs].map(
            (d) => ({ id: d.id, ...d.data() }) as Lesson
          );
          const unique = Array.from(new Map(allDocs.map((item) => [item.id, item])).values());
          return unique.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        };

        const [courseData, enrollmentDataResult, lessonsData] = await Promise.all([
          fetchCourseData(),
          fetchEnrollmentData(),
          fetchLessonsData(),
        ]);

        if (courseData) setCourse(courseData);
        setLessons(lessonsData);

        if (user && courseData) {
          const isAdmin = profile?.role === 'admin';
          const isOwner = profile?.role === 'teacher' && courseData.teacherId === user.uid;

          if (isAdmin || isOwner) {
            setIsEnrolled(true);
          } else if (enrollmentDataResult && enrollmentDataResult.status === 'active') {
            setIsEnrolled(true);
            setEnrollmentData(enrollmentDataResult);
          }
        }

        const currentId = lessonId || lessonsData[0]?.id;
        const current = lessonsData.find((l) => l.id === currentId);

        if (current) {
          setActiveLesson(current);
          if (!lessonId && current.id) {
            navigate(`/courses/${courseId}/learn/${current.id}`, { replace: true });
          }
          const currentIndex = lessonsData.findIndex((l) => l.id === currentId);
          setNavLessons({
            prev: currentIndex > 0 ? lessonsData[currentIndex - 1] : null,
            next: currentIndex < lessonsData.length - 1 ? lessonsData[currentIndex + 1] : null,
          });
        }
      } catch (err) {
        console.error('Error fetching lesson data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId, lessonId, user, profile?.role]);

  // -- 🔒 Progress Locking Logic --
  useEffect(() => {
    const checkLockStatus = async () => {
      if (!user || !courseId || !lessons.length || !activeLesson) return;

      const isAdmin = profile?.role === 'admin';
      const isOwner = profile?.role === 'teacher' && course?.teacherId === user.uid;

      if (isAdmin || isOwner) {
        setLockedReason(null);
        setIsCheckingLock(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'user_progress'),
          where('userId', '==', user.uid),
          where('courseId', '==', courseId)
        );
        const snap = await getDocs(q);
        const progressMap: Record<string, any> = {};
        const completedIds: string[] = [];

        snap.docs.forEach((d) => {
          const data = d.data();
          progressMap[data.lessonId] = data;
          if (data.isCompleted) completedIds.push(data.lessonId);
        });

        setCourseProgress(progressMap);
        setCompletedLessons(completedIds);

        // Check current lesson lock
        if (activeLesson.order > 1 && !activeLesson.isFreePreview) {
          const prevLesson = lessons.find((l) => l.order === activeLesson.order - 1);
          if (prevLesson) {
            const prevProgress = progressMap[prevLesson.id];
            if (!prevProgress?.isCompleted) {
              setLockedReason(
                `يجب إنهاء الدرس السابق "${prevLesson.title}" أولاً قبل الدخول لهذا الدرس.`
              );
            } else {
              setLockedReason(null);
            }
          }
        } else {
          setLockedReason(null);
        }
      } catch (err) {
        console.error('Lock check error:', err);
      } finally {
        setIsCheckingLock(false);
      }
    };

    if (lessons.length > 0) {
      checkLockStatus();
    }
  }, [user, courseId, lessonId, lessons, activeLesson, profile?.role, course?.teacherId]);

  // 🛡️ Screenshot Protection Logic (Modified to be less aggressive)
  useEffect(() => {
    if (!user || profile?.role === 'admin' || profile?.role === 'teacher') return;

    const handleObscure = async (reason: string) => {
      setIsObscured(true);
      setScreenshotWarningMsg(reason);

      try {
        // We no longer block accounts or increment warnings.
        // Just show a friendly warning overlay for 3 seconds.
        setTimeout(() => {
          setIsObscured(false);
          setScreenshotWarningMsg(null);
        }, 3000);
      } catch (err) {
        console.error('Error handling screenshot warning:', err);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4' || e.key === '5')) ||
        (e.altKey && e.key === 'PrintScreen') ||
        (e.ctrlKey && e.key === 'PrintScreen')
      ) {
        e.preventDefault();
        handleObscure('تنبيه: غير مسموح بتصوير الشاشة لحفظ حقوق الملكية.');
      }
    };

    // Removed aggressive blur and visibility change handlers

    window.addEventListener('keyup', handleKeyDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keyup', handleKeyDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [user, profile?.role]);

  // Listen to user_progress for remainingViews enforcement
  useEffect(() => {
    if (!user || !lessonId || !courseId) return;

    hasTriggeredDeductionRef.current = false;

    // Admin/Teacher bypass logic
    if (
      profile?.role === 'admin' ||
      (profile?.role === 'teacher' && course?.teacherId === user.uid)
    ) {
      setRemainingViews(999);
      setAllowedViews(999);
      setConsumedViews(0);
      return;
    }

    const progressId = `${user.uid}_${lessonId}`;
    const progressRef = doc(db, 'user_progress', progressId);

    const unsubscribe = onSnapshot(progressRef, (docSnap) => {
      const enrollmentAllowed = enrollmentData?.allowedViews || 5;
      const lessonAllowed = activeLesson?.allowedViews || enrollmentAllowed;

      if (docSnap.exists()) {
        const data = docSnap.data();
        const consumed = data.consumedViews || data.viewCount || 0;
        const allowed = data.allowedViews || lessonAllowed;
        setConsumedViews(consumed);
        setAllowedViews(allowed);
        setRemainingViews(Math.max(0, allowed - consumed));
      } else {
        setConsumedViews(0);
        setAllowedViews(lessonAllowed);
        setRemainingViews(lessonAllowed);
      }
    });

    return () => unsubscribe();
  }, [user, lessonId, courseId, profile?.role, course?.teacherId, enrollmentData, activeLesson]);

  const lastWriteTimeRef = useRef<number>(0);

  const handleLessonStart = useCallback(() => {}, []);

  const handleProgress = useCallback(
    async (data: { currentTime: number; duration: number }) => {
      if (!user || !lessonId || !courseId || data.duration === 0) return;

      const watchPercentage = (data.currentTime / data.duration) * 100;
      const progressId = `${user.uid}_${lessonId}`;
      const progressRef = doc(db, 'user_progress', progressId);

      // Smart Deduction: 30% view counts as a view
      if (
        watchPercentage >= 30 &&
        !hasTriggeredDeductionRef.current &&
        (profile?.role === 'student' || !profile?.role)
      ) {
        if (remainingViews > 0) {
          hasTriggeredDeductionRef.current = true;
          try {
            await setDoc(
              progressRef,
              {
                userId: user.uid,
                courseId: courseId,
                lessonId: lessonId,
                consumedViews: increment(1),
                viewCount: increment(1),
                lastUpdated: new Date().toISOString(),
              },
              { merge: true }
            );
            lastWriteTimeRef.current = Date.now();
          } catch (e) {
            console.error('Error consuming view:', e);
          }
        }
      }

      // Throttled Progress Saves
      const now = Date.now();
      const isMajorMilestone = watchPercentage >= 90;
      const timeSinceLastWrite = now - lastWriteTimeRef.current;

      if (timeSinceLastWrite >= 15000 || isMajorMilestone) {
        try {
          const updateData: any = {
            progress: watchPercentage,
            lastViewedAt: new Date().toISOString(),
            userId: user.uid,
            courseId: courseId,
            lessonId: lessonId,
          };

          if (isMajorMilestone) {
            updateData.isCompleted = true;
          }

          await setDoc(progressRef, updateData, { merge: true });
          lastWriteTimeRef.current = now;
        } catch (e) {
          console.error('Error updating progress:', e);
        }
      }
    },
    [user, lessonId, courseId, profile?.role, remainingViews]
  );

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!currentLesson) {
        setInternalQuiz(null);
        setCheckingQuizResult(false);
        return;
      }
      setCheckingQuizResult(true);
      try {
        let resolvedQuizId = '';
        let fetchedQuiz = null;

        // 1. Try Platform Exam associated via examId
        if (currentLesson.examId) {
          const examDoc = await getDoc(doc(db, 'exams', currentLesson.examId));
          if (examDoc.exists()) {
            const examData = examDoc.data();
            resolvedQuizId = examDoc.id;
            fetchedQuiz = {
              id: examDoc.id,
              title: examData.title || 'اختبار الدرس',
              questions: (examData.questions || []).map((q: any, idx: number) => ({
                id: q.id || String(idx),
                text: q.questionText || q.question || '',
                options: q.options || [],
                correctAnswer: q.correctOptionIndex !== undefined ? q.correctOptionIndex : (q.correctIndex !== undefined ? q.correctIndex : 0),
              })),
            };
          }
        }

        // 2. Fallback to lesson-specific quizzes collection (lowercase quizzes / uppercase Quizzes)
        if (!fetchedQuiz) {
          let quizSnap = await getDocs(query(collection(db, 'quizzes'), where('lessonId', '==', currentLesson.id)));
          if (quizSnap.empty) {
            quizSnap = await getDocs(query(collection(db, 'Quizzes'), where('lessonId', '==', currentLesson.id)));
          }

          if (!quizSnap.empty) {
            const quizData = quizSnap.docs[0].data();
            resolvedQuizId = quizSnap.docs[0].id;
            fetchedQuiz = {
              id: quizSnap.docs[0].id,
              title: 'اختبار الدرس',
              questions: (quizData.questions || []).map((q: any, idx: number) => ({
                id: String(idx),
                text: q.question || q.questionText || '',
                options: q.options || [],
                correctAnswer: q.correctIndex !== undefined ? q.correctIndex : (q.correctOptionIndex !== undefined ? q.correctOptionIndex : 0),
              })),
            };
          }
        }

        setInternalQuiz(fetchedQuiz);

        // Check if student has already completed this quiz
        if (user && resolvedQuizId) {
          const resultQuery = query(
            collection(db, 'results'),
            where('userId', '==', user.uid),
            where('examId', '==', resolvedQuizId)
          );
          const resultSnap = await getDocs(resultQuery);
          if (!resultSnap.empty) {
            setUserQuizResult(resultSnap.docs[0].data());
          } else {
            setUserQuizResult(null);
          }
        } else {
          setUserQuizResult(null);
        }
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setInternalQuiz(null);
        setUserQuizResult(null);
      } finally {
        setCheckingQuizResult(false);
      }
    };

    fetchQuiz();
  }, [currentLesson?.id, user]);

  const handleQuizComplete = async (score: number) => {
    if (!user || !internalQuiz || !course) return;
    try {
      const percentage = Math.round((score / internalQuiz.questions.length) * 100);
      const level = percentage >= 85 ? 'ممتاز' : (percentage >= 75 ? 'جيد جداً' : (percentage >= 50 ? 'جيد' : 'ضعيف'));

      const resultData = {
        examId: internalQuiz.id,
        examTitle: internalQuiz.title || 'اختبار الدرس',
        subject: course.subject || '',
        courseId: course.id,
        teacherId: course.teacherId || '',
        userId: user.uid,
        studentId: user.uid,
        studentName: profile?.displayName || user.email || 'طالب',
        score: score,
        totalCorrect: score,
        totalQuestions: internalQuiz.questions.length,
        percentage: percentage,
        level: level,
        timestamp: Date.now(),
        type: 'online'
      };

      await addDoc(collection(db, 'results'), resultData);
      
      alert(`تهانينا! لقد أتممت الاختبار الدوري بنجاح. النتيجة: ${score} / ${internalQuiz.questions.length} (${percentage}%)`);
      setUserQuizResult(resultData);
    } catch (err: any) {
      console.error('Error saving quiz result:', err);
      alert('حدث خطأ أثناء حفظ نتيجة الاختبار: ' + err.message);
    }
  };

  // Track progress and update Enrollment
  useEffect(() => {
    const saveProgress = async () => {
      if (!user || !courseId || !lessonId || !isEnrolled) return;
      try {
        const enrollmentId = `${user.uid}_${courseId}`;
        await updateDoc(doc(db, 'Enrollments', enrollmentId), {
          lastLessonId: lessonId,
          completedLessons: completedLessons,
          progress: Math.round((completedLessons.length / (lessons.length || 1)) * 100),
          lastWatchedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error saving progress:', err);
      }
    };

    if (isEnrolled && lessons.length > 0) {
      saveProgress();
    }
  }, [lessonId, completedLessons, isEnrolled, lessons.length]);

  const handleLessonClick = (lesson: Lesson) => {
    if (isEnrolled || lesson.isFreePreview) {
      navigate(`/courses/${courseId}/learn/${lesson.id}`);
      setActiveTab('video');
      setIsSidebarOpen(false);
    } else {
      setShowActivationPopup(true);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !courseId) return;

    setActivating(true);
    setActivationError(null);
    try {
      const tenantDb = getTenantDb();
      const codesQuery = query(
        collection(tenantDb, 'codes'),
        where('code', '==', activationCode.toUpperCase().trim()),
        where('courseId', '==', courseId),
        where('type', '==', 'course'),
        where('isUsed', '==', false)
      );
      const codeSnap = await getDocs(codesQuery);

      if (codeSnap.empty) {
        setActivationError('كود التفعيل غير صحيح أو مستخدم');
        setActivating(false);
        return;
      }

      const batch = writeBatch(tenantDb);
      const codeDoc = codeSnap.docs[0];
      const codeData = codeDoc.data();

      batch.update(doc(tenantDb, 'codes', codeDoc.id), {
        isUsed: true,
        usedBy: user.uid,
        usedAt: new Date().toISOString(),
      });

      const enrollmentId = `${user.uid}_${courseId}`;
      batch.set(doc(tenantDb, 'Enrollments', enrollmentId), {
        userId: user.uid,
        courseId: courseId,
        status: 'active',
        paymentMethod: 'activation_code',
        activationCode: activationCode.toUpperCase().trim(),
        createdAt: new Date().toISOString(),
      });

      await batch.commit();
      setIsEnrolled(true);
      setShowActivationPopup(false);
    } catch (err) {
      console.error('Error activating code:', err);
      setActivationError('حدث خطأ فني، حاول مجدداً');
    } finally {
      setActivating(false);
    }
  };

  // Solution Submission Logic (supports file compression to Base64 to bypass Storage dependencies)
  const [homeworkFile, setHomeworkFile] = useState<File | null>(null);
  const [homeworkFileBase64, setHomeworkFileBase64] = useState<string>('');
  const [submittingHomework, setSubmittingHomework] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Compress local image
  const compressFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1000;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxDim) {
              h *= maxDim / w;
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w *= maxDim / h;
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/webp', 0.65));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleHomeworkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setHomeworkFile(file);
      if (file.type.startsWith('image/')) {
        const base64 = await compressFile(file);
        setHomeworkFileBase64(base64);
      } else {
        // If PDF or other file, read standard data URL
        const reader = new FileReader();
        reader.onload = (event) => {
          setHomeworkFileBase64(event.target?.result as string || '');
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error(err);
      alert('فشل قراءة الملف المختار');
    }
  };

  const handleSubmitHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lessonId || !courseId) return;
    if (!homeworkFileBase64 && !homeworkLink.trim()) {
      alert('يرجى اختيار ملف أو وضع رابط الحل أولاً');
      return;
    }

    setSubmittingHomework(true);
    try {
      let finalUrl = homeworkLink.trim();

      if (homeworkFile) {
        let uploadedUrl = '';
        const isImage = homeworkFile.type.startsWith('image/');

        if (isImage && settings?.useFreeImageHosting && settings?.imgbbApiKey) {
          try {
            console.log('Attempting upload to ImgBB...');
            const formData = new FormData();
            formData.append('image', homeworkFile);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
            
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${settings.imgbbApiKey}`, {
              method: 'POST',
              body: formData,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const json = await response.json();
            if (json?.data?.url) {
              uploadedUrl = json.data.url;
              console.log('Successfully uploaded image to ImgBB:', uploadedUrl);
            } else {
              console.error('ImgBB response did not contain URL:', json);
            }
          } catch (uploadError) {
            console.error('Failed to upload image to ImgBB:', uploadError);
          }
        } else if (!isImage && settings?.useFreeFileHosting) {
          try {
            console.log('Attempting upload to PixelDrain...');
            const formData = new FormData();
            formData.append('file', homeworkFile);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
            
            const response = await fetch('https://pixeldrain.com/api/file', {
              method: 'POST',
              body: formData,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const json = await response.json();
            if (json?.success && json?.id) {
              uploadedUrl = `https://pixeldrain.com/api/file/${json.id}`;
              console.log('Successfully uploaded file to PixelDrain:', uploadedUrl);
            } else {
              console.error('PixelDrain upload failed:', json);
            }
          } catch (uploadError) {
            console.error('Failed to upload to PixelDrain:', uploadError);
          }
        }

        // Fallback to Firebase Storage if external hosting failed or was skipped
        if (!uploadedUrl) {
          console.log('Using Firebase Storage fallback...');
          const fileExtension = homeworkFile.name.split('.').pop() || 'bin';
          const storagePath = `lessons/homework_submissions/${courseId}/${lessonId}/${user.uid}_${Date.now()}.${fileExtension}`;
          const fileRef = ref(storage, storagePath);
          
          const uploadResult = await uploadBytes(fileRef, homeworkFile);
          uploadedUrl = await getDownloadURL(uploadResult.ref);
        }

        finalUrl = uploadedUrl;
      }

      const submissionId = `${user.uid}_${lessonId}`;
      await setDoc(doc(db, 'submissions', submissionId), {
        userId: user.uid,
        displayName: profile?.displayName || user.email,
        lessonId,
        courseId,
        solutionUrl: finalUrl,
        submittedAt: new Date().toISOString(),
        status: 'pending',
        type: homeworkFile ? 'file' : 'link',
        teacherId: course?.teacherId,
      });

      if (course?.teacherId) {
        const currentTitle =
          activeLesson?.title || lessons.find((l) => l.id === lessonId)?.title || 'درس';
        await addDoc(collection(db, 'notifications'), {
          userId: course.teacherId,
          targetRole: 'teacher',
          targetGroupId: course.teacherId,
          title: 'واجب جديد مرفوع',
          message: `قام الطالب ${profile?.displayName || 'طالب'} برفع واجب لدرس: ${currentTitle}`,
          type: 'info',
          read: false,
          createdAt: serverTimestamp(),
          link: `/teacher/submissions`,
        });
      }

      setHasSubmitted(true);
      setHomeworkFile(null);
      setHomeworkFileBase64('');
      alert('تم إرسال الواجب بنجاح للمراجعة!');
    } catch (err: any) {
      console.error('Error submitting homework:', err);
      alert('حدث خطأ أثناء الإرسال: ' + (err.message || 'حاول مجدداً'));
    } finally {
      setSubmittingHomework(false);
    }
  };

  useEffect(() => {
    const checkSubmissionAndQuiz = async () => {
      if (!user || !lessonId) return;
      try {
        const submissionId = `${user.uid}_${lessonId}`;
        const sDoc = await getDoc(doc(db, 'submissions', submissionId));
        setHasSubmitted(sDoc.exists());
        if (sDoc.exists()) {
          const data = sDoc.data();
          if (data.type === 'link') {
            setHomeworkLink(data.solutionUrl);
          } else {
            setHomeworkFileBase64(data.solutionUrl);
          }
        } else {
          setHomeworkLink('');
          setHomeworkFile(null);
          setHomeworkFileBase64('');
        }

        const quizResultQuery = query(
          collection(db, 'student_results'),
          where('userId', '==', user.uid),
          where('lessonId', '==', lessonId)
        );
        const qSnap = await getDocs(quizResultQuery);
        setQuizCompleted(!qSnap.empty);
      } catch (err) {
        console.error('Error checking submission status:', err);
      }
    };
    checkSubmissionAndQuiz();
  }, [user, lessonId, activeTab]);

  if (loading) {
    return <LessonSkeleton />;
  }

  if (!course || lessons.length === 0) {
    return (
      <div className="py-20 text-center flex flex-col items-center bg-[#080b11] min-h-screen text-white">
        <div className="bg-white/5 p-6 rounded-full mb-6 text-gray-400">
          <BookOpen className="w-12 h-12 animate-pulse" />
        </div>
        <h2 className="text-3xl font-black mb-4 font-display text-white">المحتوى غير متوفر</h2>
        <p className="text-gray-400 mb-8 max-w-sm">عذراً، لم نتمكن من الوصول لمحتوى هذا الدرس حالياً.</p>
        <Link to="/dashboard" className="px-8 py-4 bg-brand-blue text-white rounded-2xl font-black shadow-lg shadow-brand-blue/20 hover:scale-105 transition-all">
          العودة للوحة التحكم
        </Link>
      </div>
    );
  }

  const canWatch = isEnrolled || currentLesson?.isFreePreview;

  return (
    <div className="min-h-screen bg-[#07090e] text-white font-display overflow-x-hidden relative" dir="rtl">
      {/* Background Neon Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-blue/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header Panel */}
      <header className="sticky top-0 z-[90] bg-[#07090e]/80 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all flex items-center justify-center text-white/70 hover:text-white"
            title="رجوع"
          >
            <ChevronRight size={18} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
              <span>{course?.title}</span>
              <ChevronLeft size={10} className="opacity-50" />
              <span className="text-emerald-400">محتوى الحصص</span>
            </div>
            <h1 className="text-xs sm:text-sm font-black text-white truncate max-w-[180px] sm:max-w-md mt-0.5">
              {currentLesson.title}
            </h1>
          </div>
        </div>

        {/* Syllabus mobile toggle button */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center gap-2 text-xs font-black transition-all"
        >
          <Menu size={14} />
          قائمة الحصص
        </button>
      </header>

      <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-65px)] overflow-hidden">
        {/* Left Side (Syllabus List in Desktop, Slide-over in Mobile) */}
        <AnimatePresence>
          {isSidebarOpen && (
            <div className="fixed inset-0 z-[150] lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25 }}
                className="absolute top-0 right-0 bottom-0 w-[320px] bg-[#0c0f17] border-l border-white/10 p-6 flex flex-col shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <BookOpen size={16} className="text-brand-blue" />
                    محتويات الكورس
                  </h3>
                  <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 hover:bg-white/5 rounded-lg">
                    <X size={20} />
                  </button>
                </div>

                {/* Progress inside mobile slide menu */}
                <div className="mb-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div className="flex items-center justify-between text-xs font-bold mb-2">
                    <span>{lessons.length} حصة دراسية</span>
                    <span className="text-emerald-400">
                      {Math.round((completedLessons.length / (lessons.length || 1)) * 100)}% مكتمل
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${(completedLessons.length / (lessons.length || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
                  {lessons.map((lesson, idx) => {
                    const isActive = lesson.id === lessonId;
                    const isEnrollmentLocked = !isEnrolled && !lesson.isFreePreview;
                    let isSequentialLocked = false;
                    const isAdmin = profile?.role === 'admin';
                    const isOwner = profile?.role === 'teacher' && course?.teacherId === user?.uid;

                    if (lesson.order > 1 && !lesson.isFreePreview && !isAdmin && !isOwner) {
                      const prevLesson = lessons.find((l) => l.order === lesson.order - 1);
                      if (prevLesson && !courseProgress[prevLesson.id]?.isCompleted) {
                        isSequentialLocked = true;
                      }
                    }

                    const isLocked = isEnrollmentLocked || isSequentialLocked;
                    const isCompleted = courseProgress[lesson.id]?.isCompleted;

                    return (
                      <button
                        key={lesson.id}
                        disabled={isLocked && !isActive}
                        onClick={() => handleLessonClick(lesson)}
                        className={`w-full text-right p-3.5 rounded-2xl border transition-all flex items-center gap-3 ${
                          isActive
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5'
                            : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                        } ${isLocked ? 'opacity-30 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${isActive ? 'bg-emerald-500 text-white' : isCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
                          {isLocked ? <Lock size={12} /> : isCompleted ? <CheckCircle2 size={14} /> : idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-black truncate ${isActive ? 'text-white font-extrabold' : 'text-gray-300'}`}>{lesson.title}</p>
                          {lesson.isFreePreview && !isActive && (
                            <span className="text-[8px] font-black bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 mt-1 inline-block">معاينة مجانية</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>        {/* 🎬 Center Video Hub & Tab Panels */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#07090e] flex flex-col">
          {/* Video Player Display Container */}
          <div className="w-full bg-[#0c0f17] border-b border-white/5 relative aspect-video shadow-2xl">
            {isCheckingLock ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-3xl z-40">
                <Loader2 className="w-12 h-12 text-brand-blue animate-spin mb-4" />
                <p className="text-white/40 font-black text-xs tracking-widest uppercase">جاري التحقق من التقدم...</p>
              </div>
            ) : !canWatch || lockedReason ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#07090e] z-40">
                <div className="bg-brand-blue/10 p-5 rounded-[2rem] border border-brand-blue/20 mb-6 shadow-xl shadow-brand-blue/5">
                  <Lock className="w-10 h-10 text-brand-blue" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">الدرس مقفل حالياً</h2>
                <p className="text-gray-400 text-xs font-bold max-w-sm leading-relaxed mb-8">
                  {lockedReason || 'هذا الدرس مخصص للمشتركين فقط. يرجى تفعيل اشتراكك أو شراء الكورس للوصول الفوري.'}
                </p>
                {!lockedReason ? (
                  <button
                    onClick={() => navigate(`/courses/${courseId}`)}
                    className="px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-sm shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    شراء الكورس والاشتراك
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const prevLesson = lessons.find((l) => l.order === (activeLesson?.order || 1) - 1);
                      if (prevLesson) handleLessonClick(prevLesson);
                    }}
                    className="px-8 py-3.5 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl font-black text-sm shadow-xl shadow-brand-blue/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    العودة للدرس السابق لمشاهدته
                  </button>
                )}
              </div>
            ) : remainingViews <= 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#07090e] z-40">
                <div className="bg-red-500/10 p-5 rounded-[2rem] border border-red-500/20 mb-6 shadow-xl shadow-red-500/5">
                  <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">استنفدت محاولات المشاهدة</h2>
                <p className="text-red-400 text-xs font-bold mb-4">لقد استهلكت جميع المشاهدات المتاحة لهذا الدرس ({allowedViews}/{allowedViews}).</p>
                <p className="text-gray-500 text-[11px] font-bold max-w-sm mb-8 leading-relaxed">
                  إذا واجهت مشكلة أو كنت ترغب في زيادة عدد مشاهداتك، يرجى التواصل مع الدعم الفني للمنصة.
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-sm shadow-xl shadow-red-600/20 transition-all hover:scale-105 active:scale-95"
                >
                  العودة للرئيسية
                </button>
              </div>
            ) : (
              <div className="w-full h-full relative">
                {/* Screenshot Protection Overlay */}
                <AnimatePresence>
                  {isObscured && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-[#07090e]/95 z-50 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md"
                    >
                      <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-[2rem] flex items-center justify-center text-red-500 mb-6 shadow-lg shadow-red-500/5 animate-pulse">
                        <AlertTriangle className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-white mb-2">تنبيه حماية الملكية الفكرية</h3>
                      <p className="text-gray-400 font-bold max-w-md text-xs sm:text-sm leading-relaxed">
                        {screenshotWarningMsg || 'تم حجب محتوى الفيديو مؤقتاً لحماية حقوق النشر والملكية الفكرية. يُمنع منعاً باتاً تصوير أو تسجيل شاشة منصتنا.'}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <FahmniPlayer
                  url={currentLesson.videoUrl}
                  title={currentLesson.title}
                  thumbnailUrl={currentLesson.thumbnailUrl}
                  onStart={handleLessonStart}
                  onProgress={handleProgress}
                  isTheaterMode={isTheaterMode}
                  onTheaterToggle={() => setIsTheaterMode(!isTheaterMode)}
                  watermarkText={user?.email || profile?.displayName || ''}
                  onEnded={() => {
                    if (navLessons.next) {
                      handleLessonClick(navLessons.next);
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Under Player Details & Stats Container */}
          <div className="w-full p-5 sm:p-7 md:p-9 space-y-6 bg-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-3 py-1 rounded-full border border-emerald-500/20">
                    الحصة {currentLesson.order}
                  </span>
                  {currentLesson.isFreePreview && (
                    <span className="bg-blue-500/10 text-blue-400 text-[9px] font-black px-3 py-1 rounded-full border border-blue-500/20">
                      معاينة مجانية
                    </span>
                  )}
                  {/* Premium views limit counter indicator */}
                  {profile?.role === 'student' && (
                    <div className="flex items-center gap-1.5 bg-rose-500/10 text-rose-400 text-[10px] font-bold px-3 py-1 rounded-full border border-rose-500/20">
                      <AlertCircle size={12} className="text-rose-400 animate-pulse animate-duration-1000" />
                      <span>
                        مشاهدات متبقية: <strong className="text-white font-black">{remainingViews}</strong> / {allowedViews}
                      </span>
                    </div>
                  )}
                </div>
                <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight">
                  {currentLesson.title}
                </h2>
              </div>

              {/* Prev / Next controls */}
              <div className="flex items-center gap-2.5 self-end md:self-auto">
                <button
                  disabled={!navLessons.prev}
                  onClick={() => navLessons.prev && handleLessonClick(navLessons.prev)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/70 hover:text-white transition-all disabled:opacity-10 disabled:cursor-not-allowed"
                  title="الدرس السابق"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  disabled={!navLessons.next}
                  onClick={() => navLessons.next && handleLessonClick(navLessons.next)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/5 disabled:text-gray-600 text-white px-5 py-3 rounded-xl font-black text-xs shadow-lg shadow-emerald-600/10 disabled:shadow-none hover:scale-105 active:scale-95 disabled:scale-100 transition-all group disabled:opacity-25"
                >
                  <span>الدرس التالي</span>
                  <ChevronLeft size={14} className="transition-transform group-hover:-translate-x-1" />
                </button>
              </div>
            </div>

            <div className="w-full h-px bg-white/5" />

            {/* Bottom Tab Selectors */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: 'video', label: 'الوصف', icon: Play },
                  { id: 'summary', label: 'الملخص والمرفقات', icon: FileText },
                  { id: 'quiz', label: 'الاختبار الدوري', icon: HelpCircle },
                  { id: 'homework', label: 'تسليم الواجب', icon: Upload },
                  { id: 'discussions', label: 'منتدى النقاش', icon: MessageSquare },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all border shrink-0 ${
                        isActive
                          ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/20'
                          : 'bg-white/[0.02] text-gray-400 border-white/5 hover:border-white/10 hover:text-white'
                      }`}
                    >
                      <Icon size={12} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Panel Content Box */}
              <div className="bg-slate-950/30 rounded-2xl p-5 sm:p-7 min-h-[220px] border border-white/5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'video' && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-black text-white flex items-center gap-2">
                          <Info size={16} className="text-brand-blue" />
                          عن هذا الدرس
                        </h4>
                        <p className="text-gray-400 text-xs sm:text-sm font-bold leading-relaxed whitespace-pre-line">
                          {currentLesson.summary || 'لا يوجد وصف إضافي متوفر لهذا الدرس حالياً.'}
                        </p>
                      </div>
                    )}

                    {activeTab === 'summary' && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-black text-white flex items-center gap-2">
                          <FileText size={16} className="text-emerald-400" />
                          ملفات الشرح والملخصات
                        </h4>
                        {currentLesson.pdfUrl ? (
                          checkingBooklet ? (
                            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                              <Loader2 size={18} className="animate-spin text-brand-blue" />
                              <span className="text-xs font-bold">جاري التحقق من صلاحية الملف...</span>
                            </div>
                          ) : isBookletPurchased ? (
                            <div className="bg-[#0c0f17] p-5 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                                  <FileTypeIcon url={currentLesson.pdfUrl} size={18} />
                                </div>
                                <span className="font-bold text-sm text-gray-200">ملخص ومذكرة الحصة (PDF)</span>
                              </div>
                              <button
                                onClick={handleDownloadBooklet}
                                disabled={downloadingBooklet}
                                className="p-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-xl transition-all shadow hover:scale-105 flex items-center justify-center cursor-pointer disabled:opacity-50"
                              >
                                {downloadingBooklet ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <Download size={18} />
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="bg-white/5 border border-white/5 rounded-3xl p-6 text-center space-y-4 max-w-md mx-auto">
                              <div className="w-16 h-16 bg-brand-yellow/10 text-brand-yellow rounded-2xl flex items-center justify-center mx-auto border border-brand-yellow/20">
                                <FileText size={32} />
                              </div>
                              <div className="space-y-2">
                                <h5 className="text-base font-black text-white">ملخص الحصة مدفوع</h5>
                                <p className="text-gray-400 text-xs font-bold leading-normal">
                                  مذكرة وملخص هذا الدرس غير مجانية. يمكنك إلغاء قفلها وتحميلها مباشرة باستخدام رصيد محفظتك.
                                </p>
                              </div>
                              
                              <div className="bg-black/30 rounded-2xl p-4 border border-white/5 flex items-center justify-between" dir="rtl">
                                <div className="text-right">
                                  <p className="text-[10px] text-gray-500 font-bold">سعر الملزمة</p>
                                  <p className="text-lg font-black text-brand-yellow">
                                    {(Number(currentLesson.pdfPrice || 0)).toLocaleString('ar-EG')} ج.م
                                  </p>
                                </div>
                                <div className="text-left border-r border-white/10 pr-4">
                                  <p className="text-[10px] text-gray-500 font-bold">رصيدك الحالي</p>
                                  <p className="text-sm font-black text-white">
                                    {(profile?.walletBalance || 0).toLocaleString('ar-EG')} ج.م
                                  </p>
                                </div>
                              </div>

                              <button
                                disabled={buyingBooklet}
                                onClick={handleBuyBooklet}
                                className="w-full py-4 bg-brand-yellow hover:bg-yellow-500 disabled:opacity-50 text-space-950 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                              >
                                {buyingBooklet ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <span>شراء وتحميل الملزمة الآن</span>
                                )}
                              </button>

                              {((profile?.walletBalance || 0) < Number(currentLesson.pdfPrice || 0)) && (tenantData?.whatsapp || settings?.whatsapp) && (
                                <a
                                  href={(() => {
                                    const wa = tenantData?.whatsapp || settings?.whatsapp || '';
                                    return wa.startsWith('http') ? wa : `https://wa.me/${wa.replace(/\+/g, '')}?text=${encodeURIComponent(`السلام عليكم، رصيدي غير كافٍ لشراء ملزمة درس "${currentLesson.title}"، أرغب في شحن محفظتي.`)}`;
                                  })()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full py-4 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-2xl font-black text-sm transition-all border border-[#25D366]/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <MessageSquare size={16} />
                                  <span>تواصل عبر واتساب لشحن الرصيد</span>
                                </a>
                              )}
                            </div>
                          )
                        ) : (
                          <p className="text-gray-500 text-xs italic">لا توجد ملفات مرفقة متاحة لهذه الحصة.</p>
                        )}
                      </div>
                    )}

                    {activeTab === 'quiz' && (
                      checkingQuizResult ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                          <Loader2 size={24} className="animate-spin text-brand-blue" />
                          <span className="text-xs font-bold">جاري تحميل الاختبار والتحقق من النتيجة...</span>
                        </div>
                      ) : userQuizResult ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white/5 rounded-3xl border border-white/5 max-w-md mx-auto my-6" dir="rtl">
                          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
                            <Award size={40} />
                          </div>
                          <h3 className="text-2xl font-black text-white mb-2">لقد أديت هذا الاختبار سابقاً</h3>
                          <p className="text-gray-400 text-xs font-bold mb-6">
                            تم تسجيل وإرسال درجاتك في ملفك الأكاديمي وبوابة ولي الأمر بنجاح.
                          </p>

                          <div className="w-full bg-black/30 rounded-2xl p-4 border border-white/5 grid grid-cols-2 gap-4 text-right mb-6">
                            <div>
                              <p className="text-[10px] text-gray-500 font-bold">الدرجة المحققة</p>
                              <p className="text-lg font-black text-emerald-400">
                                {userQuizResult.totalCorrect ?? userQuizResult.score} / {userQuizResult.totalQuestions}
                              </p>
                            </div>
                            <div className="border-r border-white/10 pr-4">
                              <p className="text-[10px] text-gray-500 font-bold">النسبة المئوية</p>
                              <p className="text-lg font-black text-white">
                                {userQuizResult.percentage}%
                              </p>
                            </div>
                          </div>

                          <span className={`px-4 py-1.5 rounded-full text-xs font-black border ${
                            (userQuizResult.percentage ?? 0) >= 50 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {(userQuizResult.percentage ?? 0) >= 50 ? 'ناجح' : 'يحتاج لمراجعة'}
                          </span>
                        </div>
                      ) : internalQuiz ? (
                        <Quiz
                          quiz={internalQuiz}
                          onComplete={handleQuizComplete}
                        />
                      ) : currentLesson.quizUrl ? (
                        <div className="text-center py-12 space-y-4">
                          <HelpCircle size={32} className="mx-auto text-brand-blue opacity-80 animate-pulse" />
                          <p className="text-sm font-bold text-gray-300">يوجد اختبار خارجي لهذه الحصة.</p>
                          <a
                            href={currentLesson.quizUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-blue hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:scale-105"
                          >
                            <span>بدء الاختبار الخارجي</span>
                          </a>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-500 space-y-2">
                          <HelpCircle size={32} className="mx-auto opacity-30" />
                          <p className="text-xs">لا يوجد اختبار مسند لهذه الحصة حالياً.</p>
                        </div>
                      )
                    )}

                    {activeTab === 'homework' && (
                      <div className="space-y-6 py-4">
                        <div className="text-center space-y-2 max-w-md mx-auto">
                          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20">
                            <FileCheck size={28} />
                          </div>
                          <h4 className="text-lg font-black text-white">إرسال حل الواجب</h4>
                          <p className="text-gray-400 text-xs font-bold leading-normal">
                            قم برفع صورة حلك أو ملف الـ PDF الخاص بك، أو أرفق رابط الحل مباشرة ليقوم المحاضر بمراجعته وتقييمه.
                          </p>
                        </div>

                        <form onSubmit={handleSubmitHomework} className="space-y-4 max-w-md mx-auto">
                          {/* File input component for local documents submission */}
                          <div className="relative border-2 border-dashed border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.01] rounded-2xl p-5 transition-all flex flex-col items-center justify-center gap-3">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={handleHomeworkFileChange}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {homeworkFileBase64 ? (
                              <div className="text-center space-y-2">
                                {homeworkFile?.type.startsWith('image/') ? (
                                  <img src={homeworkFileBase64} alt="Solution Preview" className="w-24 h-24 object-cover mx-auto rounded-xl border border-white/10" />
                                ) : (
                                  <FileText className="w-12 h-12 text-emerald-400 mx-auto" />
                                )}
                                <p className="text-xs text-white font-bold truncate max-w-xs">{homeworkFile?.name || 'الملف المختار'}</p>
                                <button type="button" onClick={() => { setHomeworkFile(null); setHomeworkFileBase64(''); }} className="text-[10px] text-red-400 hover:text-red-300 font-bold block mx-auto underline">
                                  إزالة الملف
                                </button>
                              </div>
                            ) : (
                              <>
                                <Upload className="text-gray-500 animate-bounce" size={24} />
                                <div className="text-center">
                                  <p className="text-xs text-white font-bold">اضغط هنا أو اسحب الملف لرفعه</p>
                                  <p className="text-[9px] text-gray-500 mt-1">يدعم الصور (PNG, JPG) والملفات (PDF)</p>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="text-center text-xs text-gray-500 font-bold">أو</div>

                          <input
                            type="text"
                            placeholder="رابط الحل (Google Drive / Link)"
                            value={homeworkLink}
                            onChange={(e) => setHomeworkLink(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 transition-all font-bold text-sm text-white"
                          />

                          <button
                            type="submit"
                            disabled={submittingHomework || (!homeworkFileBase64 && !homeworkLink.trim())}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm transition-all shadow-lg hover:shadow-emerald-600/30 flex items-center justify-center gap-2"
                          >
                            {submittingHomework ? <Loader2 className="animate-spin" size={18} /> : 'تسليم الحل الآن'}
                          </button>
                        </form>
                      </div>
                    )}

                    {activeTab === 'discussions' && (
                      <CourseDiscussions courseId={courseId!} teacherId={course.teacherId} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* 📜 Right Side: Syllabus Lessons List (Desktop only) */}
        <div
          className={`hidden lg:flex w-[320px] lg:w-[350px] bg-[#0c0f17] border-l border-white/5 flex-col shadow-2xl relative z-10 shrink-0 ${isTheaterMode ? 'lg:hidden' : ''}`}
        >
          {/* Syllabus Header */}
          <div className="p-5 bg-[#0c0f17] border-b border-white/5 sticky top-0 z-20">
            <h3 className="font-black text-[10px] uppercase tracking-wider text-gray-500 mb-2.5 flex items-center gap-1.5">
              <BookOpen size={13} /> محتويات الدورة التعليمية
            </h3>
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-400">
              <span>{lessons.length} حصة تدريسية</span>
              <span className="text-emerald-400">
                {Math.round((completedLessons.length / (lessons.length || 1)) * 100)}% مكتمل
              </span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-1000"
                style={{ width: `${(completedLessons.length / (lessons.length || 1)) * 100}%` }}
              />
            </div>


          </div>

          {/* Lessons List Container */}
          <div className="p-3.5 space-y-3 overflow-y-auto custom-scrollbar flex-1 relative">
            {lessons.map((lesson, idx) => {
              const isActive = lesson.id === lessonId;
              const isEnrollmentLocked = !isEnrolled && !lesson.isFreePreview;

              let isSequentialLocked = false;
              const isAdmin = profile?.role === 'admin';
              const isOwner = profile?.role === 'teacher' && course?.teacherId === user?.uid;

              if (lesson.order > 1 && !lesson.isFreePreview && !isAdmin && !isOwner) {
                const prevLesson = lessons.find((l) => l.order === lesson.order - 1);
                if (prevLesson && !courseProgress[prevLesson.id]?.isCompleted) {
                  isSequentialLocked = true;
                }
              }

              const isLocked = isEnrollmentLocked || isSequentialLocked;
              const isCompleted = courseProgress[lesson.id]?.isCompleted;
              const progressValue = courseProgress[lesson.id]?.progress ?? 0;
              const hasProgress = progressValue > 0 && !isCompleted;

              const statusText = isLocked
                ? '🔒 مقفل'
                : isCompleted
                  ? '✓ مكتمل'
                  : hasProgress
                    ? `${Math.round(progressValue)}% مشاهدة`
                    : 'لم يبدأ بعد';

              return (
                <div key={lesson.id} className="relative">
                  {/* Vertical Timeline Link Line */}
                  {idx < lessons.length - 1 && (
                    <div className="absolute right-[17px] top-[40px] bottom-[-22px] w-[2px] bg-white/5 z-0 pointer-events-none" />
                  )}

                  <button
                    disabled={isLocked && !isActive}
                    onClick={() => handleLessonClick(lesson)}
                    className={`w-full text-right p-3 rounded-2xl transition-all flex items-center gap-3 border relative z-10 group ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-500/10 to-transparent border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5'
                        : 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                    } ${isLocked ? 'opacity-30 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {/* Badge status coin */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors z-10 ${
                        isActive
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                          : isCompleted
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-white/5 text-gray-500 border border-white/5 group-hover:bg-white/10'
                      }`}
                    >
                      {isLocked ? (
                        <Lock size={12} />
                      ) : isActive ? (
                        <Play size={12} fill="currentColor" />
                      ) : isCompleted ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        idx + 1
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black truncate ${isActive ? 'text-white font-extrabold' : 'text-gray-300'}`}>
                        {lesson.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[9px] font-bold ${
                            isActive
                              ? 'text-emerald-400/80'
                              : isCompleted
                                ? 'text-emerald-500'
                                : hasProgress
                                  ? 'text-brand-blue'
                                  : 'text-gray-500'
                          }`}
                        >
                          {statusText}
                        </span>
                        {lesson.isFreePreview && !isActive && (
                          <span className="text-[8px] font-black bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
                            متاح للمعاينة
                          </span>
                        )}
                      </div>

                      {/* Progress Slider */}
                      {!isLocked && (isCompleted || hasProgress) && (
                        <div className="mt-2 h-1 w-full rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${
                              isCompleted ? 'bg-emerald-500' : 'bg-brand-blue'
                            }`}
                            style={{
                              width: `${isCompleted ? 100 : Math.min(Math.round(progressValue), 100)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {!isLocked && (
                      <div
                        className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-500'}`}
                      >
                        <Play size={12} />
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 🔒 Activation Popup Overlay Modal */}
      <AnimatePresence>
        {showActivationPopup && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowActivationPopup(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#0c0f17] border border-white/10 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl text-right z-10"
            >
              <div className="w-16 h-16 bg-brand-blue/10 border border-brand-blue/20 rounded-[1.5rem] flex items-center justify-center text-brand-blue mx-auto mb-6">
                <Key size={28} className="animate-pulse" />
              </div>

              <h3 className="text-xl font-black text-white text-center mb-2">تفعيل كورس التعليم</h3>
              <p className="text-gray-400 text-xs font-bold text-center leading-relaxed mb-6">
                هذا الدرس مخصص للطلاب المشتركين. يرجى إدخال كود التفعيل الذي حصلت عليه من السنتر أو الإدارة للدخول الفوري.
              </p>

              {activationError && (
                <div className="bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-red-400 text-xs font-bold text-center mb-4 flex items-center gap-2 justify-center">
                  <AlertCircle size={16} />
                  <span>{activationError}</span>
                </div>
              )}

              <form onSubmit={handleActivate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-gray-500 font-bold text-xs mr-2">كود التفعيل</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: CO-XXXXXX"
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-brand-blue transition-all font-black text-lg text-white placeholder:text-gray-700 text-center uppercase"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={activating || !activationCode.trim()}
                    className="flex-1 py-4 bg-brand-blue hover:bg-brand-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-brand-blue/20 flex items-center justify-center gap-2"
                  >
                    {activating ? <Loader2 className="animate-spin" size={18} /> : 'تفعيل الآن'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowActivationPopup(false)}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-bold text-sm transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


    </div>
  );
};
