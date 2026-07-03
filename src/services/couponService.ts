import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
  increment,
  arrayUnion,
} from 'firebase/firestore';
import { getTenantDb } from '../lib/firebase';

export interface Coupon {
  id: string;
  code: string; // unique, uppercase
  type: 'percentage' | 'fixed_amount' | 'free_access' | 'wallet_charge';
  value: number; // e.g. 20 (percent) or 50 (EGP value)
  courseId: string; // specific courseId or 'all'
  maxUses?: number;
  useCount: number;
  expiryDate?: any; // Firestore Timestamp
  active: boolean;
  usedBy?: Record<string, boolean>; // userId -> true
  createdAt: any;
  teacherId: string;
}

/**
 * Validates a coupon's constraints locally.
 * Throws a descriptive error if invalid.
 */
export const checkCouponValidity = (
  couponData: any,
  courseId: string,
  userId: string
) => {
  if (!couponData.active) {
    throw new Error('الكوبون غير نشط أو تم إيقافه.');
  }

  // 1. Expiration check
  if (couponData.expiryDate) {
    const expiry = couponData.expiryDate.toDate ? couponData.expiryDate.toDate() : new Date(couponData.expiryDate);
    if (expiry < new Date()) {
      throw new Error('انتهت صلاحية هذا الكوبون.');
    }
  }

  // 2. Max uses check
  if (couponData.maxUses && (couponData.useCount || 0) >= couponData.maxUses) {
    throw new Error('وصل هذا الكوبون للحد الأقصى من الاستخدام.');
  }

  // 3. User usage check (prevent reuse by the same student)
  if (couponData.usedBy && couponData.usedBy[userId]) {
    throw new Error('لقد قمت باستخدام هذا الكوبون مسبقاً.');
  }

  // 4. Course restriction check
  if (couponData.type !== 'wallet_charge') {
    if (couponData.courseId && couponData.courseId !== 'all' && couponData.courseId !== courseId) {
      throw new Error('هذا الكوبون غير مخصص للاستخدام مع هذا الكورس.');
    }
  }
};

/**
 * Calculates final price after coupon discount.
 */
export const calculateDiscount = (price: number, coupon: Coupon) => {
  if (coupon.type === 'free_access') {
    return { discountAmount: price, finalPrice: 0 };
  }
  if (coupon.type === 'percentage') {
    const discountAmount = (price * coupon.value) / 100;
    return { discountAmount, finalPrice: Math.max(0, price - discountAmount) };
  }
  if (coupon.type === 'fixed_amount') {
    const discountAmount = coupon.value;
    return { discountAmount, finalPrice: Math.max(0, price - discountAmount) };
  }
  return { discountAmount: 0, finalPrice: price };
};

/**
 * Redeems a wallet charge coupon securely via Firestore Transaction.
 */
export const redeemWalletCoupon = async (codeStr: string, userId: string): Promise<number> => {
  const db = getTenantDb();
  const cleanCode = codeStr.trim().toUpperCase();

  // Find the coupon first
  const couponQ = query(
    collection(db, 'coupons'),
    where('code', '==', cleanCode),
    where('active', '==', true)
  );
  const snap = await getDocs(couponQ);
  if (snap.empty) {
    throw new Error('كود الشحن غير صحيح أو غير مفعل.');
  }

  const couponDoc = snap.docs[0];
  const couponData = { id: couponDoc.id, ...couponDoc.data() } as Coupon;

  if (couponData.type !== 'wallet_charge') {
    throw new Error('هذا الكوبون مخصص للتخفيضات وليس لشحن المحفظة.');
  }

  checkCouponValidity(couponData, '', userId);

  const chargeValue = couponData.value || 0;

  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', userId);
    const couponRef = doc(db, 'coupons', couponData.id);

    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('مستند المستخدم غير موجود.');
    }

    const freshCouponSnap = await transaction.get(couponRef);
    if (!freshCouponSnap.exists()) {
      throw new Error('الكوبون غير موجود.');
    }
    const freshCoupon = freshCouponSnap.data() as Coupon;
    checkCouponValidity(freshCoupon, '', userId);

    // Update user balance
    const currentBalance = userSnap.data().walletBalance || 0;
    transaction.update(userRef, {
      walletBalance: currentBalance + chargeValue,
    });

    // Update coupon stats
    const updatedUsedBy = { ...(freshCoupon.usedBy || {}), [userId]: true };
    transaction.update(couponRef, {
      useCount: (freshCoupon.useCount || 0) + 1,
      usedBy: updatedUsedBy,
    });

    // Log transaction
    const tRef = doc(collection(db, 'transactions'));
    transaction.set(tRef, {
      userId,
      amount: chargeValue,
      type: 'deposit',
      codeUsed: cleanCode,
      date: serverTimestamp(),
    });
  });

  return chargeValue;
};

/**
 * Purchases a course with a discount or free-access coupon securely via transaction.
 */
export const purchaseCourseWithCoupon = async (
  codeStr: string,
  course: any,
  userId: string,
  profile: any
): Promise<{ discountAmount: number; finalPrice: number }> => {
  const db = getTenantDb();
  const cleanCode = codeStr.trim().toUpperCase();

  const couponQ = query(
    collection(db, 'coupons'),
    where('code', '==', cleanCode),
    where('active', '==', true)
  );
  const snap = await getDocs(couponQ);
  if (snap.empty) {
    throw new Error('الكوبون غير صحيح أو غير مفعل.');
  }

  const couponDoc = snap.docs[0];
  const couponData = { id: couponDoc.id, ...couponDoc.data() } as Coupon;

  checkCouponValidity(couponData, course.id, userId);

  const { discountAmount, finalPrice } = calculateDiscount(course.price, couponData);

  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', userId);
    const couponRef = doc(db, 'coupons', couponData.id);

    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error('مستند المستخدم غير موجود.');

    const freshCouponSnap = await transaction.get(couponRef);
    if (!freshCouponSnap.exists()) throw new Error('الكوبون غير موجود.');
    const freshCoupon = freshCouponSnap.data() as Coupon;
    checkCouponValidity(freshCoupon, course.id, userId);

    const currentBalance = userSnap.data().walletBalance || 0;
    if (finalPrice > 0 && currentBalance < finalPrice) {
      throw new Error('رصيدك في المحفظة غير كافٍ لإتمام عملية الشراء بعد الخصم.');
    }

    // Deduct balance if finalPrice > 0
    if (finalPrice > 0) {
      transaction.update(userRef, {
        walletBalance: currentBalance - finalPrice,
      });
    }

    // Update user's enrolledCourses
    transaction.set(userRef, {
      enrolledCourses: arrayUnion(course.id)
    }, { merge: true });

    // Update coupon stats
    const updatedUsedBy = { ...(freshCoupon.usedBy || {}), [userId]: true };
    transaction.update(couponRef, {
      useCount: (freshCoupon.useCount || 0) + 1,
      usedBy: updatedUsedBy,
    });

    // Create enrollment
    const enrollmentId = `${userId}_${course.id}`;
    transaction.set(doc(db, 'Enrollments', enrollmentId), {
      userId,
      courseId: course.id,
      status: 'active',
      paymentMethod: 'coupon',
      price: finalPrice,
      couponUsed: cleanCode,
      discountAmount,
      createdAt: serverTimestamp(),
    });

    // Handle Teacher share & notify
    let commissionPercent = course.commissionPercentage ?? 100;
    const teacherShare = (finalPrice * Number(commissionPercent)) / 100;
    
    if (course.teacherId) {
      const teacherRef = doc(db, 'users', course.teacherId);
      transaction.set(teacherRef, {
        totalEarnings: increment(teacherShare),
        walletBalance: increment(teacherShare)
      }, { merge: true });

      const nRef = doc(collection(db, 'notifications'));
      transaction.set(nRef, {
        userId: course.teacherId,
        type: 'success',
        message: `تم شراء كورس: ${course.title} باستخدام كوبون: ${cleanCode} بواسطة ${profile?.displayName || 'طالب جديد'}`,
        read: false,
        createdAt: serverTimestamp()
      });
    }

    // Log transaction
    const tRef = doc(collection(db, 'transactions'));
    transaction.set(tRef, {
      userId,
      amount: -finalPrice,
      type: 'purchase',
      courseName: course.title,
      courseId: course.id,
      couponUsed: cleanCode,
      teacherId: course.teacherId,
      teacherShare,
      platformShare: finalPrice - teacherShare,
      commissionPercentage: Number(commissionPercent),
      date: serverTimestamp(),
    });
  });

  return { discountAmount, finalPrice };
};
