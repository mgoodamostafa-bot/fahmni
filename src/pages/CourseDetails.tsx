import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, Sparkles } from 'lucide-react';
import {
  doc, getDoc, collection, query, where,
  getDocs, writeBatch, arrayUnion,
  increment, runTransaction, serverTimestamp, addDoc,
  getCountFromServer
} from 'firebase/firestore';
import { getTenantDb } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { FALLBACKS } from '../constants/fallbacks';
import { purchaseCourseWithCoupon } from '../services/couponService';
import { validateAndRedeemCode } from '../services/cardCodeService';

// Sub-components
import {
  CourseHero,
  PurchaseCard,
  CourseCurriculum,
  CourseSidebar,
  PurchaseModal,
  CourseDetailsSkeleton,
} from './course-details';
import type { PaymentMethod } from './course-details';

// ─── Types ──────────────────────────────────────────────────────
interface Course {
  id: string;
  title: string;
  subject: string;
  description: string;
  imageUrl?: string;
  coverImage?: string;
  thumbnailUrl?: string;
  price: number;
  teacherId: string;
  teacherName?: string;
  teacherPhotoURL?: string;
  rating?: number;
  lessonCount?: number;
  enrolledCount?: number;
  whatsappLink?: string;
  commissionPercentage?: number;
}

interface TeacherProfile {
  name: string;
  title: string;
  photoUrl: string;
  whatsapp: string;
  facebook: string;
  telegram: string;
  youtube: string;
  instagram: string;
  tiktok: string;
}

// ─── Image Compression Helper ───────────────────────────────────
const compressImage = (file: File, maxDim: number = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxDim) { h *= maxDim / w; w = maxDim; } }
        else { if (h > maxDim) { w *= maxDim / h; h = maxDim; } }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/webp', 0.7));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

// ─── Animation ──────────────────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }
};
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4 }
};

// ═════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════
export const CourseDetails: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  // ─── State ──────────────────────────────────────────────────
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [purchaseMethod, setPurchaseMethod] = useState<PaymentMethod>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState<string | null>(null);
  const [enrolledCount, setEnrolledCount] = useState(0);

  // New Coupon States
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [discountedPrice, setDiscountedPrice] = useState<number | null>(null);

  // Vodafone Cash form
  const [vodaSender, setVodaSender] = useState('');
  const [vodaReceiptBase64, setVodaReceiptBase64] = useState('');
  const [vodaReceiptFile, setVodaReceiptFile] = useState<File | null>(null);

  // InstaPay form
  const [instaSender, setInstaSender] = useState('');
  const [instaReceiptBase64, setInstaReceiptBase64] = useState('');
  const [instaReceiptFile, setInstaReceiptFile] = useState<File | null>(null);

  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile>({
    name: FALLBACKS.TEACHER_NAME,
    title: FALLBACKS.TEACHER_TITLE,
    photoUrl: FALLBACKS.TEACHER_PHOTO,
    whatsapp: '', facebook: '', telegram: '', youtube: '', instagram: '', tiktok: ''
  });

  // ─── Receipt Handler ────────────────────────────────────────
  const handleReceiptChange = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setBase64: (s: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setFile(file);
      const base64 = await compressImage(file, 800);
      setBase64(base64);
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء معالجة صورة الإيصال.');
    }
  }, []);

  const handleApplyCoupon = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!couponCode.trim() || !course) return;
    setCouponLoading(true);
    setError(null);
    try {
      const db = getTenantDb();
      const cleanCode = couponCode.trim().toUpperCase();
      const q = query(
        collection(db, 'coupons'),
        where('code', '==', cleanCode),
        where('active', '==', true)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error('رمز الكوبون غير صحيح أو غير نشط.');
      }
      const couponDoc = snap.docs[0];
      const couponData = { id: couponDoc.id, ...couponDoc.data() };
      
      const { checkCouponValidity, calculateDiscount } = await import('../services/couponService');
      checkCouponValidity(couponData, course.id, user?.uid || '');
      
      const { discountAmount, finalPrice } = calculateDiscount(course.price, couponData as any);
      setAppliedCoupon(couponData);
      setDiscountedPrice(finalPrice);
      setTopupSuccess('تم تطبيق الكوبون بنجاح! 🎉');
      setTimeout(() => setTopupSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'فشل تطبيق الكوبون.');
      setAppliedCoupon(null);
      setDiscountedPrice(null);
    } finally {
      setCouponLoading(false);
    }
  }, [couponCode, course, user?.uid]);

  const handleRemoveCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponCode('');
    setDiscountedPrice(null);
    setError(null);
  }, []);

  // ─── Data Fetching (PARALLEL, unified collections) ─────────
  useEffect(() => {
    if (!courseId) return;

    let isCancelled = false;

    const fetchAll = async () => {
      try {
        const db = getTenantDb();

        // 1. Fetch course — unified: try Courses first (canonical), fallback to courses
        const [courseUpper, courseLower] = await Promise.all([
          getDoc(doc(db, 'Courses', courseId)).catch(() => null),
          getDoc(doc(db, 'courses', courseId)).catch(() => null),
        ]);

        const courseDoc = (courseUpper?.exists() ? courseUpper : courseLower?.exists() ? courseLower : null);
        if (!courseDoc || isCancelled) { setLoading(false); return; }

        const courseData = { id: courseDoc.id, ...courseDoc.data() } as Course;
        setCourse(courseData);

        // 2. Fetch teacher, lessons, enrollment, and count in PARALLEL
        const parallelPromises: Promise<any>[] = [];

        // Teacher profile (getDoc, no realtime needed)
        if (courseData.teacherId) {
          parallelPromises.push(
            getDoc(doc(db, 'users', courseData.teacherId)).then(snap => {
              if (snap.exists() && !isCancelled) {
                const d = snap.data();
                setTeacherProfile({
                  name: d.displayName || d.teacherName || FALLBACKS.TEACHER_NAME,
                  title: d.teacherTitle || FALLBACKS.TEACHER_TITLE,
                  photoUrl: d.imageUrl || d.teacherPhotoUrl || FALLBACKS.TEACHER_PHOTO,
                  whatsapp: d.whatsapp || '', facebook: d.facebook || '',
                  telegram: d.telegram || '', youtube: d.youtube || '',
                  instagram: d.instagram || '', tiktok: d.tiktok || ''
                });
              }
            }).catch(() => {})
          );
        }

        // Lessons (both casings in parallel, merge & deduplicate)
        parallelPromises.push(
          Promise.all([
            getDocs(query(collection(db, 'Lessons'), where('courseId', '==', courseId))).catch(() => ({ docs: [] })),
            getDocs(query(collection(db, 'lessons'), where('courseId', '==', courseId))).catch(() => ({ docs: [] })),
          ]).then(([upper, lower]) => {
            if (isCancelled) return;
            const all = [...upper.docs, ...lower.docs].map(d => ({ id: d.id, ...d.data() }));
            const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
            unique.sort((a: any, b: any) => (Number(a.order) || 0) - (Number(b.order) || 0));
            setLessons(unique);
          })
        );

        // Enrollment check
        if (user) {
          if (profile?.role === 'admin' || profile?.isCenterStudent || (profile?.role === 'teacher' && courseData.teacherId === user.uid)) {
            setIsEnrolled(true);
          } else {
            parallelPromises.push(
              Promise.all([
                getDoc(doc(db, 'Enrollments', `${user.uid}_${courseId}`)).catch(() => null),
                getDoc(doc(db, 'enrollments', `${user.uid}_${courseId}`)).catch(() => null),
              ]).then(([eu, el]) => {
                if (isCancelled) return;
                const enrollDoc = (eu?.exists() ? eu : el?.exists() ? el : null);
                if (enrollDoc?.data()?.status === 'active') setIsEnrolled(true);
              })
            );
          }
        }

        // Enrollment count (getCountFromServer — fast, no document downloads)
        parallelPromises.push(
          Promise.all([
            getCountFromServer(query(collection(db, 'Enrollments'), where('courseId', '==', courseId))).catch(() => ({ data: () => ({ count: 0 }) })),
            getCountFromServer(query(collection(db, 'enrollments'), where('courseId', '==', courseId))).catch(() => ({ data: () => ({ count: 0 }) })),
          ]).then(([cu, cl]) => {
            if (isCancelled) return;
            setEnrolledCount((cu.data().count || 0) + (cl.data().count || 0));
          })
        );

        await Promise.all(parallelPromises);
      } catch (err) {
        console.error('Error fetching course details:', err);
        if (!isCancelled) setError('حدث خطأ أثناء تحميل البيانات');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { isCancelled = true; };
  }, [courseId, user, profile?.role]);

  // ─── Enrollment Handler ────
  const handleEnroll = useCallback(async (e?: React.FormEvent, method: 'code' | 'wallet' | 'coupon' = 'wallet') => {
    if (e) e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: `/courses/${courseId}` } });
      return;
    }
    if (!courseId || !course) return;

    // ── Free Course ──
    if (course.price === 0) {
      setEnrolling(true);
      setError(null);
      try {
        const db = getTenantDb();
        const batch = writeBatch(db);
        const enrollmentId = `${user.uid}_${courseId}`;
        batch.set(doc(db, 'Enrollments', enrollmentId), {
          userId: user.uid, courseId, status: 'active',
          paymentMethod: 'free', price: 0, createdAt: serverTimestamp()
        });
        batch.set(doc(db, 'users', user.uid), { enrolledCourses: arrayUnion(courseId) }, { merge: true });
        if (course.teacherId) {
          const nId = doc(collection(db, 'notifications')).id;
          batch.set(doc(db, 'notifications', nId), {
            userId: course.teacherId, type: 'info',
            message: `انضمام طالب جديد للكورس المجاني: ${course.title} (${profile?.displayName || 'طالب'})`,
            read: false, createdAt: serverTimestamp()
          });
        }
        await batch.commit();
        setIsEnrolled(true);
        setTopupSuccess(`تم الاشتراك في كورس "${course.title}" بنجاح! 🎉`);
        setTimeout(() => setTopupSuccess(null), 5000);
      } catch (err: any) {
        console.error('Error enrolling in free course:', err);
        setError('حدث خطأ أثناء الاشتراك في الكورس المجاني.');
      } finally { setEnrolling(false); }
      return;
    }

    // Determine the active method: If a coupon is applied, force the 'coupon' purchase method
    let activeMethod = method;
    if (appliedCoupon && method === 'wallet') {
      activeMethod = 'coupon';
    }

    // ── Wallet Balance Check ──
    if (activeMethod === 'wallet' || activeMethod === 'coupon') {
      const priceToCharge = discountedPrice !== null ? discountedPrice : course.price;
      if ((profile?.walletBalance || 0) < priceToCharge) {
        setError('رصيدك في المحفظة غير كافٍ لإتمام عملية الشراء، يرجى الشحن أولاً');
        return;
      }
      if (!showConfirmModal) {
        setShowConfirmModal(true);
        return;
      }
    }

    setEnrolling(true);
    setError(null);

    try {
      const db = getTenantDb();

      // ── Activation Code Purchase ──
      if (activeMethod === 'code') {
        if (!activationCode || !activationCode.trim()) {
          throw new Error('يرجى إدخال كود التفعيل.');
        }

        await validateAndRedeemCode(
          activationCode,
          user.uid,
          courseId,
          profile
        );

        setIsEnrolled(true);
        setTopupSuccess(`تم تفعيل كود الاشتراك والانتساب للكورس "${course.title}" بنجاح! 🎉`);
        setActivationCode('');
        setPurchaseMethod(null);
        setTimeout(() => setTopupSuccess(null), 5000);
        return;
      }

      // ── Coupon Purchase ──
      if (activeMethod === 'coupon') {
        if (!appliedCoupon) {
          throw new Error('يرجى تطبيق كوبون خصم أولاً.');
        }

        await purchaseCourseWithCoupon(
          appliedCoupon.code,
          course,
          user.uid,
          profile
        );

        setIsEnrolled(true);
        setTopupSuccess(`تم تفعيل الكوبون والاشتراك في كورس "${course.title}" بنجاح! 🎉`);
        setCouponCode('');
        setAppliedCoupon(null);
        setDiscountedPrice(null);
        setPurchaseMethod(null);
        setShowConfirmModal(false);
        setTimeout(() => setTopupSuccess(null), 5000);
        return;
      }

      // ── Standard Wallet Purchase ──
      if (activeMethod === 'wallet') {
        const userRef = doc(db, 'users', user.uid);

        await runTransaction(db, async (transaction) => {
          // ═══ ALL READS FIRST ═══
          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists()) throw new Error('مستند المستخدم غير موجود');
          const currentBalance = userSnap.data().walletBalance || 0;
          if (currentBalance < course.price) throw new Error('رصيدك في المحفظة غير كافٍ');

          let teacherSnap: any = null;
          const teacherRef = course.teacherId ? doc(db, 'users', course.teacherId) : null;
          if (teacherRef) {
            teacherSnap = await transaction.get(teacherRef);
          }

          // ═══ ALL WRITES AFTER ═══
          // Deduct from balance
          transaction.update(userRef, { walletBalance: currentBalance - course.price });

          // Teacher earnings
          let commissionPercent = course.commissionPercentage;
          if (teacherRef) {
            if (commissionPercent === undefined || commissionPercent === null) {
              commissionPercent = teacherSnap?.exists() ? (teacherSnap.data().defaultCommission ?? 100) : 100;
            }
            const teacherShare = (course.price * Number(commissionPercent)) / 100;
            transaction.set(teacherRef, {
              totalEarnings: increment(teacherShare),
              walletBalance: increment(teacherShare)
            }, { merge: true });
          }

          // Create enrollment
          const enrollmentId = `${user.uid}_${courseId}`;
          transaction.set(doc(db, 'Enrollments', enrollmentId), {
            userId: user.uid, courseId: courseId!, status: 'active',
            paymentMethod: 'wallet', price: course.price,
            createdAt: serverTimestamp()
          });

          // Update enrolled courses
          transaction.set(userRef, { enrolledCourses: arrayUnion(courseId!) }, { merge: true });

          // Transaction record
          const tId = doc(collection(db, 'transactions')).id;
          const finalCommission = Number(commissionPercent ?? 100);
          const teacherShare = (course.price * finalCommission) / 100;
          transaction.set(doc(db, 'transactions', tId), {
            userId: user.uid, amount: -course.price, type: 'purchase',
            courseName: course.title, courseId: course.id,
            teacherId: course.teacherId, teacherShare,
            platformShare: course.price - teacherShare,
            commissionPercentage: finalCommission, date: serverTimestamp()
          });

          // Teacher notification
          if (course.teacherId) {
            const nId = doc(collection(db, 'notifications')).id;
            transaction.set(doc(db, 'notifications', nId), {
              userId: course.teacherId, type: 'success',
              message: `تم شراء كورس: ${course.title} بواسطة ${profile?.displayName || 'طالب جديد'}`,
              read: false, createdAt: serverTimestamp()
            });
          }
        });

        setIsEnrolled(true);
        setTopupSuccess(`تم شراء كورس "${course.title}" بنجاح! 🎉`);
        setShowConfirmModal(false);
        setPurchaseMethod(null);
        setTimeout(() => setTopupSuccess(null), 5000);
      }
    } catch (err: any) {
      console.error('Error enrolling:', err);
      setError(err.message || 'حدث خطأ فني، يرجى المحاولة مرة أخرى.');
    } finally {
      setEnrolling(false);
    }
  }, [user, profile, courseId, course, purchaseMethod, activationCode, appliedCoupon, couponCode, discountedPrice, showConfirmModal, navigate]);

  // ─── Direct Payment (Vodafone / InstaPay) ──────────────────
  const handleDirectPaymentSubmit = useCallback(async (e: React.FormEvent, method: 'vodafone' | 'instapay') => {
    if (e) e.preventDefault();
    if (!user) { navigate('/login', { state: { from: `/courses/${courseId}` } }); return; }

    const sender = method === 'vodafone' ? vodaSender : instaSender;
    const receiptBase64 = method === 'vodafone' ? vodaReceiptBase64 : instaReceiptBase64;

    if (!sender || !receiptBase64) {
      setError('يرجى ملء جميع الحقول ورفع صورة الإيصال لإتمام طلب الشحن.');
      return;
    }

    setEnrolling(true);
    setError(null);
    setTopupSuccess(null);

    try {
      await addDoc(collection(getTenantDb(), 'wallet_requests'), {
        userId: user.uid, userName: profile?.displayName || 'طالب',
        studentId: profile?.studentId || 'N/A',
        amount: Number(course?.price || 0), senderNumber: sender,
        receiptUrl: receiptBase64,
        method: method === 'vodafone' ? 'vodafone_cash' : 'instapay',
        status: 'pending', courseId, courseName: course?.title,
        createdAt: serverTimestamp(),
      });

      setTopupSuccess('تم إرسال إيصال التحويل بنجاح! سيتم مراجعته وتفعيل الكورس لك قريباً. 🎉');
      setVodaSender(''); setVodaReceiptFile(null); setVodaReceiptBase64('');
      setInstaSender(''); setInstaReceiptFile(null); setInstaReceiptBase64('');
      setPurchaseMethod(null);
      setTimeout(() => setTopupSuccess(null), 5000);
    } catch (err: any) {
      console.error('Direct Payment Error:', err);
      setError(err.message || 'فشل إرسال الطلب. حاول مرة أخرى.');
    } finally {
      setEnrolling(false);
    }
  }, [user, profile, courseId, course, vodaSender, vodaReceiptBase64, instaSender, instaReceiptBase64, navigate]);

  // ─── Loading & Error States ─────────────────────────────────
  if (loading) return <CourseDetailsSkeleton />;

  if (!course) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4" dir="rtl">
      <motion.div {...fadeUp}>
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-black mb-4 font-display text-white">الكورس غير متوفر</h2>
        <p className="text-gray-500 mb-10 max-w-md mx-auto font-bold leading-relaxed">
          عذراً، الرابط الذي تحاول الوصول إليه غير صحيح أو تم حذف الكورس.
        </p>
        <Link to="/courses" className="inline-flex items-center gap-3 bg-brand-blue hover:bg-brand-blue/90 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-brand-blue/30 transition-all transform active:scale-95">
          <Sparkles size={18} /> استكشف الكورسات
        </Link>
      </motion.div>
    </div>
  );

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════
  return (
    <div className="space-y-12 pb-20 w-full px-4 sm:px-6 lg:px-10 text-right" dir="rtl">

      {/* ═══ HERO SECTION ═══════════════════════════════════════ */}
      <CourseHero
        course={course}
        lessonsCount={lessons.length}
        enrolledCount={enrolledCount}
        teacherName={teacherProfile.name}
      >
        <PurchaseCard
          course={course}
          courseId={courseId!}
          isEnrolled={isEnrolled}
          enrolling={enrolling}
          error={error}
          topupSuccess={topupSuccess}
          purchaseMethod={purchaseMethod}
          activationCode={activationCode}
          walletBalance={profile?.walletBalance || 0}
          vodafoneCashNumber={settings.vodafoneCashNumber || '01005813308'}
          instapayAddress={settings.instapayAddress || 'mostafa@instapay'}
          whatsappNumber={settings.whatsapp || ''}
          lessons={lessons}
          vodaSender={vodaSender}
          vodaReceiptBase64={vodaReceiptBase64}
          vodaReceiptFile={vodaReceiptFile}
          instaSender={instaSender}
          instaReceiptBase64={instaReceiptBase64}
          instaReceiptFile={instaReceiptFile}
          onSetPurchaseMethod={setPurchaseMethod}
          onSetActivationCode={setActivationCode}
          onSetError={setError}
          onHandleEnroll={handleEnroll}
          onHandleDirectPayment={handleDirectPaymentSubmit}
          onSetShowConfirmModal={setShowConfirmModal}
          onSetVodaSender={setVodaSender}
          onSetVodaReceiptFile={setVodaReceiptFile}
          onSetVodaReceiptBase64={setVodaReceiptBase64}
          onSetInstaSender={setInstaSender}
          onSetInstaReceiptFile={setInstaReceiptFile}
          onSetInstaReceiptBase64={setInstaReceiptBase64}
          onHandleReceiptChange={handleReceiptChange}
          // Coupon props
          couponCode={couponCode}
          onSetCouponCode={setCouponCode}
          appliedCoupon={appliedCoupon}
          couponLoading={couponLoading}
          discountedPrice={discountedPrice}
          onApplyCoupon={handleApplyCoupon}
          onRemoveCoupon={handleRemoveCoupon}
        />
      </CourseHero>

      {/* ═══ CONTENT GRID ═══════════════════════════════════════ */}
      <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">

        {/* ── Main Content ── */}
        <div className="lg:col-span-8 space-y-14">

          {/* ── About Course (desktop only — mobile shows in sidebar) ── */}
          <motion.section {...fadeIn} className="space-y-5 hidden lg:block">
            <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-3 text-white">
              <div className="w-1.5 h-8 bg-brand-blue rounded-full" />
              عن الكورس
            </h2>
            <div className="bg-white/[0.02] p-6 sm:p-8 leading-[2] text-gray-300 font-bold text-base sm:text-lg border border-white/5 rounded-2xl sm:rounded-3xl whitespace-pre-wrap">
              {course.description}
            </div>
          </motion.section>

          {/* ── Curriculum ── */}
          <CourseCurriculum
            courseId={courseId!}
            lessons={lessons}
            isEnrolled={isEnrolled}
          />
        </div>

        {/* ── Sidebar ── */}
        <CourseSidebar
          teacherProfile={teacherProfile}
          courseDescription={course.description}
        />
      </div>

      {/* ═══ WALLET CONFIRMATION MODAL ══════════════════════════ */}
      <PurchaseModal
        show={showConfirmModal}
        courseTitle={course.title}
        coursePrice={discountedPrice !== null ? discountedPrice : course.price}
        walletBalance={profile?.walletBalance || 0}
        enrolling={enrolling}
        onConfirm={() => { setShowConfirmModal(false); handleEnroll(undefined, 'wallet'); }}
        onClose={() => setShowConfirmModal(false)}
      />
    </div>
  );
};
