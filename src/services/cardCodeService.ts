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

export interface CardCode {
  id: string;
  code: string; // unique, e.g. CRS-XXXX-XXXX or CHG-XXXX-XXXX
  type: 'course' | 'charge';
  courseId?: string;
  value?: number;
  isUsed: boolean;
  usedBy: string | null;
  usedAt: any | null;
  createdAt: any;
  teacherId: string;
}

/**
 * Redeems a printed card code atomically inside a transaction.
 * Supports direct course activation and wallet balance recharge.
 */
export const validateAndRedeemCode = async (
  codeStr: string,
  userId: string,
  courseId?: string, // optional for course subscription validation
  profile?: any
): Promise<{ type: 'course' | 'charge'; value?: number; courseTitle?: string }> => {
  const db = getTenantDb();
  const cleanCode = codeStr.trim().toUpperCase();

  // 1. Fetch code document
  const q = query(
    collection(db, 'codes'),
    where('code', '==', cleanCode),
    where('isUsed', '==', false)
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error('كود التفعيل/الشحن غير صحيح أو تم استخدامه مسبقاً.');
  }

  const codeDoc = snap.docs[0];
  const codeData = { id: codeDoc.id, ...codeDoc.data() } as CardCode;

  // 2. Validate course matching if it's a course code
  if (codeData.type === 'course') {
    if (!codeData.courseId) {
      throw new Error('كود الكورس غير صالح.');
    }
    if (courseId && codeData.courseId !== courseId) {
      throw new Error('هذا الكود مخصص للاشتراك في كورس آخر.');
    }
  }

  // 3. Run Transaction
  let courseTitle = '';
  try {
    await runTransaction(db, async (transaction) => {
      const codeRef = doc(db, 'codes', codeData.id);
      const userRef = doc(db, 'users', userId);

      // 1. READS: Fetch fresh records inside transaction
      const freshCode = await transaction.get(codeRef);
      if (!freshCode.exists() || freshCode.data().isUsed) {
        throw new Error('هذا الكود تم استخدامه بالفعل.');
      }

      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('مستند الطالب غير موجود.');
      }

      let targetCourseDoc: any = null;
      let coursePrice = 0;
      let teacherId = '';
      let teacherShare = 0;
      let commissionPercent = 100;

      if (codeData.type === 'course') {
        const targetCourseId = codeData.courseId!;
        
        targetCourseDoc = await transaction.get(doc(db, 'Courses', targetCourseId));
        if (!targetCourseDoc.exists()) {
          targetCourseDoc = await transaction.get(doc(db, 'courses', targetCourseId));
        }

        coursePrice = targetCourseDoc.exists() ? (targetCourseDoc.data().price || 0) : 0;
        courseTitle = targetCourseDoc.exists() ? (targetCourseDoc.data().title || 'كورس') : 'كورس';

        if (targetCourseDoc.exists()) {
          const cData = targetCourseDoc.data();
          teacherId = cData.teacherId || '';
          commissionPercent = cData.commissionPercentage ?? 100;
          teacherShare = (coursePrice * Number(commissionPercent)) / 100;
        }
      }

      // 2. WRITES: Mark code as used and perform modifications
      transaction.update(codeRef, {
        isUsed: true,
        usedBy: userId,
        usedAt: serverTimestamp(),
      });

      // B. Handle Course subscription
      if (codeData.type === 'course') {
        const targetCourseId = codeData.courseId!;
        const enrollmentId = `${userId}_${targetCourseId}`;

        // Create enrollment
        transaction.set(doc(db, 'Enrollments', enrollmentId), {
          userId,
          courseId: targetCourseId,
          status: 'active',
          paymentMethod: 'activation_code',
          price: coursePrice,
          codeUsed: cleanCode,
          createdAt: serverTimestamp(),
        });

        // Add to user enrolledCourses
        transaction.set(userRef, {
          enrolledCourses: arrayUnion(targetCourseId)
        }, { merge: true });

        // Teacher earnings & Notification
        if (teacherId) {
          transaction.set(doc(db, 'users', teacherId), {
            totalEarnings: increment(teacherShare),
            walletBalance: increment(teacherShare)
          }, { merge: true });

          const nRef = doc(collection(db, 'notifications'));
          transaction.set(nRef, {
            userId: teacherId,
            type: 'success',
            message: `تم تفعيل كود اشتراك: ${courseTitle} بواسطة ${profile?.displayName || 'طالب جديد'}`,
            read: false,
            createdAt: serverTimestamp()
          });
        }

        // Log transaction
        const tRef = doc(collection(db, 'transactions'));
        transaction.set(tRef, {
          userId,
          amount: -coursePrice,
          type: 'activation_code',
          courseName: courseTitle,
          courseId: targetCourseId,
          codeUsed: cleanCode,
          teacherId,
          teacherShare,
          platformShare: coursePrice - teacherShare,
          commissionPercentage: Number(commissionPercent),
          date: serverTimestamp(),
        });
      }

      // C. Handle Wallet recharge
      if (codeData.type === 'charge') {
        const chargeValue = codeData.value || 0;
        const currentBalance = userSnap.data().walletBalance || 0;

        // Update user wallet
        transaction.update(userRef, {
          walletBalance: currentBalance + chargeValue,
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
      }
    });
  } catch (error: any) {
    if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
      throw new Error('يرجى نسخ ملف firestore.rules ولصقه في تبويب Rules الخاص بـ Firestore في لوحة تحكم Firebase للمنصة لحل هذه المشكلة.');
    }
    throw error;
  }

  return {
    type: codeData.type,
    value: codeData.value,
    courseTitle,
  };
};
