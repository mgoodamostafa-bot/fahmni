import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  increment,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Wallet, CheckCircle, XCircle, Loader2, Search, Image as ImageIcon, Trash2, X, ZoomIn } from 'lucide-react';
import { motion } from 'framer-motion';

export const WalletRequests: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'wallet_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs: any[] = [];
      snapshot.forEach((doc) => {
        reqs.push({ id: doc.id, ...doc.data() });
      });
      setRequests(reqs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (req: any) => {
    const actionMsg = req.courseId 
      ? `هل أنت متأكد من إضافة ${req.amount} ج.م للطالب ${req.userName} وتفعيل كورس "${req.courseName || 'الكورس'}" له تلقائياً؟`
      : `هل أنت متأكد من إضافة ${req.amount} ج.م للطالب ${req.userName}؟`;

    if (!window.confirm(actionMsg)) return;
    setProcessingId(req.id);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', req.userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) throw new Error('المستخدم غير موجود');

        let courseSnap = null;
        let courseData: any = null;
        let teacherRef = null;
        let teacherSnap = null;

        // If there's a courseId, let's fetch the course document first
        if (req.courseId) {
          const courseRef1 = doc(db, 'Courses', req.courseId);
          let courseSnapTemp = await transaction.get(courseRef1);
          if (!courseSnapTemp.exists()) {
            const courseRef2 = doc(db, 'courses', req.courseId);
            courseSnapTemp = await transaction.get(courseRef2);
          }
          if (courseSnapTemp.exists()) {
            courseSnap = courseSnapTemp;
            courseData = courseSnapTemp.data();
            if (courseData.teacherId) {
              teacherRef = doc(db, 'users', courseData.teacherId);
              teacherSnap = await transaction.get(teacherRef);
            }
          }
        }

        const currentBalance = userSnap.data().walletBalance || 0;
        
        // 1. First add the deposited amount to the student balance
        const balanceAfterDeposit = currentBalance + req.amount;

        // 2. If it's a course purchase and we have the course details, check and enroll
        let balanceAfterPurchase = balanceAfterDeposit;
        let purchaseSuccess = false;
        
        if (courseData) {
          const coursePrice = Number(courseData.price || 0);
          if (balanceAfterDeposit >= coursePrice) {
            balanceAfterPurchase = balanceAfterDeposit - coursePrice;
            purchaseSuccess = true;
          }
        }

        // Update user balance
        transaction.update(userRef, {
          walletBalance: balanceAfterPurchase,
        });

        // Update request status
        const reqRef = doc(db, 'wallet_requests', req.id);
        transaction.update(reqRef, {
          status: 'approved',
          processedAt: serverTimestamp(),
        });

        // Record deposit transaction
        const txDepRef = doc(collection(db, 'transactions'));
        transaction.set(txDepRef, {
          userId: req.userId,
          amount: req.amount,
          type: 'deposit',
          method: req.method || 'vodafone_cash',
          senderNumber: req.senderNumber,
          date: serverTimestamp(),
        });

        // Send notification for deposit
        const nDepRef = doc(collection(db, 'notifications'));
        transaction.set(nDepRef, {
          userId: req.userId,
          type: 'success',
          message: `تم الموافقة على شحن رصيدك بمبلغ ${req.amount} ج.م ✅`,
          read: false,
          createdAt: serverTimestamp(),
        });

        // If enrolled successfully in the course
        if (purchaseSuccess && courseData && req.courseId) {
          let commissionPercent = courseData.commissionPercentage;
          if (commissionPercent === undefined || commissionPercent === null) {
            commissionPercent = teacherSnap?.exists() ? (teacherSnap.data().defaultCommission ?? 100) : 100;
          }
          const coursePrice = Number(courseData.price || 0);
          const teacherShare = (coursePrice * Number(commissionPercent)) / 100;

          // Add to teacher earnings
          if (teacherRef) {
            transaction.set(teacherRef, {
              totalEarnings: increment(teacherShare),
              walletBalance: increment(teacherShare)
            }, { merge: true });
          }

          // Create enrollment
          const enrollmentId = `${req.userId}_${req.courseId}`;
          transaction.set(doc(db, 'Enrollments', enrollmentId), {
            userId: req.userId,
            courseId: req.courseId,
            status: 'active',
            paymentMethod: req.method || 'vodafone_cash',
            price: coursePrice,
            createdAt: serverTimestamp()
          });

          // Add course to user enrolled list
          transaction.set(userRef, {
            enrolledCourses: arrayUnion(req.courseId)
          }, { merge: true });

          // Record course purchase transaction
          const txPurRef = doc(collection(db, 'transactions'));
          transaction.set(txPurRef, {
            userId: req.userId,
            amount: -coursePrice,
            type: 'purchase',
            courseName: courseData.title,
            courseId: req.courseId,
            teacherId: courseData.teacherId || '',
            teacherShare,
            platformShare: coursePrice - teacherShare,
            commissionPercentage: Number(commissionPercent),
            date: serverTimestamp()
          });

          // Send course active notification to student
          const nPurRef = doc(collection(db, 'notifications'));
          transaction.set(nPurRef, {
            userId: req.userId,
            type: 'success',
            message: `تم تفعيل اشتراكك في كورس "${courseData.title}" تلقائياً بعد مراجعة شحن المحفظة! 🎉 مشاهدة ممتعة.`,
            read: false,
            createdAt: serverTimestamp()
          });

          // Send notification to teacher
          if (courseData.teacherId) {
            const nTeachRef = doc(collection(db, 'notifications'));
            transaction.set(nTeachRef, {
              userId: courseData.teacherId,
              type: 'success',
              message: `تم تفعيل اشتراك الطالب ${req.userName} في كورس "${courseData.title}" تلقائياً بعد شحن محفظته.`,
              read: false,
              createdAt: serverTimestamp()
            });
          }
        }
      });
      alert(req.courseId ? 'تم الموافقة وتفعيل الكورس للطالب تلقائياً بنجاح.' : 'تم الموافقة على الطلب وإضافة الرصيد بنجاح.');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء معالجة الطلب.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (reqId: string, userName?: string) => {
    if (!window.confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
    setProcessingId(reqId);
    try {
      const req = requests.find(r => r.id === reqId);
      await updateDoc(doc(db, 'wallet_requests', reqId), {
        status: 'rejected',
        processedAt: serverTimestamp(),
      });

      // Send rejection notification to student
      if (req?.userId) {
        const { addDoc: addDocFn } = await import('firebase/firestore');
        await addDocFn(collection(db, 'notifications'), {
          userId: req.userId,
          type: 'warning',
          message: `تم رفض طلب شحن المحفظة بمبلغ ${req.amount} ج.م ❌ يرجى التأكد من البيانات وإعادة المحاولة.`,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء رفض الطلب.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (reqId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    setDeletingId(reqId);
    try {
      await deleteDoc(doc(db, 'wallet_requests', reqId));
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء حذف الطلب.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRequests = requests.filter(
    (req) =>
      req.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.studentId?.includes(searchTerm) ||
      req.senderNumber?.includes(searchTerm)
  );

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-brand-blue" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Wallet className="text-red-500" />
            طلبات شحن المحفظة (فودافون كاش)
          </h1>
          <p className="text-gray-400 font-bold mt-2">
            لديك <span className="text-brand-blue">{pendingCount}</span> طلبات بانتظار المراجعة
          </p>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="ابحث بالاسم، الكود، أو رقم المحول منه..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pr-12 pl-4 text-white focus:border-brand-blue transition-colors outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredRequests.map((req, index) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            key={req.id}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-6 flex-1 w-full">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
                <Wallet
                  className={
                    req.status === 'pending'
                      ? 'text-brand-yellow'
                      : req.status === 'approved'
                        ? 'text-emerald-500'
                        : 'text-red-500'
                  }
                  size={32}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-white">{req.userName}</h3>
                  <span className="text-xs font-bold text-gray-400 font-mono tracking-widest bg-black/30 px-2 py-1 rounded-lg">
                    {req.studentId}
                  </span>
                  {req.method === 'instapay' ? (
                    <span className="text-[10px] font-black bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2.5 py-0.5 rounded-full">
                      انستا باي
                    </span>
                  ) : (
                    <span className="text-[10px] font-black bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                      فودافون كاش
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm font-bold">
                  <span className="text-brand-blue flex items-center gap-1">
                    المبلغ: {req.amount} ج.م
                  </span>
                  <span className="text-gray-400 border-r border-white/10 pr-4">
                    {req.method === 'instapay' ? 'عنوان المرسل: ' : 'رقم المحول منه: '}
                    <span className="text-white font-mono select-all">{req.senderNumber}</span>
                  </span>
                  <span className="text-gray-500 text-xs border-r border-white/10 pr-4">
                    {req.createdAt?.toDate
                      ? req.createdAt.toDate().toLocaleString('ar-EG')
                      : 'الآن'}
                  </span>
                </div>
                {req.receiptUrl ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <span className="text-xs text-gray-400">صورة الإيصال (اضغط للتكبير):</span>
                    <button
                      type="button"
                      onClick={() => setZoomedImage(req.receiptUrl)}
                      className="w-36 h-36 rounded-2xl overflow-hidden border border-white/10 hover:border-brand-blue transition-all group relative block cursor-pointer"
                    >
                      <img src={req.receiptUrl} alt="إيصال التحويل" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-black gap-1">
                        <ZoomIn size={16} /> تكبير
                      </div>
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-red-500/70 font-bold italic mt-2 block">
                    لم يرفق إيصال تحويل
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {req.status === 'pending' ? (
                <>
                  <button
                    onClick={() => handleApprove(req)}
                    disabled={processingId === req.id}
                    className="flex-1 md:flex-none py-3 px-6 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 text-emerald-400 hover:text-white rounded-xl font-black transition-all flex items-center justify-center gap-2"
                  >
                    {processingId === req.id ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <CheckCircle size={18} />
                    )}
                    موافقة
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={processingId === req.id}
                    className="flex-1 md:flex-none py-3 px-6 bg-red-500/10 hover:bg-red-500 border border-red-500/20 text-red-400 hover:text-white rounded-xl font-black transition-all flex items-center justify-center gap-2"
                  >
                    {processingId === req.id ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <XCircle size={18} />
                    )}
                    رفض
                  </button>
                </>
              ) : req.status === 'approved' ? (
                <div className="flex items-center gap-2">
                  <span className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-black flex items-center gap-2">
                    <CheckCircle size={18} /> تم الموافقة
                  </span>
                  <button
                    onClick={() => handleDelete(req.id)}
                    disabled={deletingId === req.id}
                    className="py-3 px-4 bg-red-500/10 hover:bg-red-600 border border-red-500/20 text-red-400 hover:text-white rounded-xl font-black transition-all flex items-center gap-1 text-xs"
                    title="حذف الطلب"
                  >
                    {deletingId === req.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                    حذف
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-black flex items-center gap-2">
                    <XCircle size={18} /> مرفوض
                  </span>
                  <button
                    onClick={() => handleDelete(req.id)}
                    disabled={deletingId === req.id}
                    className="py-3 px-4 bg-red-500/10 hover:bg-red-600 border border-red-500/20 text-red-400 hover:text-white rounded-xl font-black transition-all flex items-center gap-1 text-xs"
                    title="حذف الطلب"
                  >
                    {deletingId === req.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                    حذف
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {filteredRequests.length === 0 && (
          <div className="text-center py-20 bg-white/5 border border-white/10 rounded-3xl">
            <Wallet size={48} className="mx-auto text-gray-500 mb-4" />
            <h3 className="text-xl font-black text-white">لا توجد طلبات شحن</h3>
            <p className="text-gray-400 mt-2">لم يتم العثور على أي طلبات تطابق بحثك.</p>
          </div>
        )}
      </div>

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-6 left-6 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X size={28} />
          </button>
          <img
            src={zoomedImage}
            alt="إيصال مكبر"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
