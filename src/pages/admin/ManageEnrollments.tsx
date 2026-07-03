import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  CreditCard,
  Phone,
  Hash,
  Calendar,
  AlertCircle,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pagination, usePagination } from '../../components/Pagination';

interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: 'pending' | 'active' | 'rejected';
  paymentMethod: string;
  createdAt: string;
  userEmail?: string;
  courseTitle?: string;
  vodafoneCashNumber?: string;
  transactionId?: string;
  allowedViews?: number;
}

export const ManageEnrollments: React.FC = () => {
  const { profile } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>(
    'all'
  );
  const [confirmAction, setConfirmAction] = useState<{
    enrollment: Enrollment;
    status: 'active' | 'rejected';
  } | null>(null);

  const fetchEnrollments = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'Enrollments'));

      const enrollmentsData: (Enrollment | null)[] = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          const studentId = data.userId || data.uid;

          let userEmail = 'مستخدم غير معروف';
          let courseTitle = 'دورة غير معروفة';
          let teacherId = '';

          if (studentId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', studentId));
              if (userDoc.exists())
                userEmail =
                  userDoc.data().email || userDoc.data().displayName || 'مستخدم بلا إيميل';

              const courseDoc = await getDoc(doc(db, 'Courses', data.courseId));
              if (courseDoc.exists()) {
                courseTitle = courseDoc.data().title;
                teacherId = courseDoc.data().teacherId;
              }

              // Role filtering
              if (profile?.role === 'teacher' && !profile.isOwner && teacherId !== profile.uid) {
                return null;
              }
            } catch (e) {
              console.error('Error fetching related data', e);
            }
          }

          return {
            id: docSnapshot.id,
            userId: studentId,
            courseId: data.courseId,
            status: data.status,
            paymentMethod: data.paymentMethod,
            createdAt: data.createdAt,
            vodafoneCashNumber: data.vodafoneCashNumber,
            transactionId: data.transactionId,
            allowedViews: data.allowedViews || 5,
            userEmail,
            courseTitle,
          };
        })
      );

      const finalizeData = enrollmentsData.filter((e) => e !== null) as Enrollment[];
      setEnrollments(
        finalizeData.sort((a, b) => {
          const dateA = (a.createdAt as any)?.seconds
            ? (a.createdAt as any).seconds * 1000
            : new Date(a.createdAt).getTime();
          const dateB = (b.createdAt as any)?.seconds
            ? (b.createdAt as any).seconds * 1000
            : new Date(b.createdAt).getTime();
          return dateB - dateA;
        })
      );
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const handleStatusChange = async (id: string, newStatus: 'active' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'Enrollments', id), { status: newStatus });
      fetchEnrollments();
    } catch (error) {
      console.error('Error updating enrollment status:', error);
    }
    setConfirmAction(null);
  };

  const updateAllowedViews = async (id: string, value: string) => {
    try {
      const num = parseInt(value);
      if (isNaN(num)) return;
      await updateDoc(doc(db, 'Enrollments', id), { allowedViews: num });
      setEnrollments((prev) => prev.map((e) => (e.id === id ? { ...e, allowedViews: num } : e)));
    } catch (error) {
      console.error('Error updating allowedViews:', error);
    }
  };

  const filteredEnrollments = enrollments.filter((e) => {
    const matchesSearch =
      e.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.courseTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.transactionId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const paginatedEnrollments = usePagination(filteredEnrollments, 25);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-3xl flex items-center justify-center shrink-0 shadow-2xl shadow-blue-500/5 border border-blue-500/10 transition-transform hover:scale-105 duration-500">
            <CreditCard size={36} />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white leading-none tracking-tight mb-2">
              إدارة الاشتراكات
            </h1>
            <p className="text-gray-400 text-xs md:text-sm font-bold opacity-80">
              {enrollments.length} اشتراك • تأكيد ومراجعة عمليات الاشتراك
            </p>
          </div>
          <button
            onClick={fetchEnrollments}
            disabled={loading}
            className="mr-auto p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all disabled:opacity-50"
            title="تحديث"
          >
            <RefreshCw size={20} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="البحث بالطالب، الدورة، أو رقم العملية..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-brand-dark/50 border border-white/10 rounded-xl py-3 pr-12 pl-4 text-white focus:outline-none focus:border-brand-yellow/50 transition-colors"
          />
        </div>

        <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
          {(['all', 'pending', 'active', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                statusFilter === status
                  ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {status === 'all'
                ? 'الكل'
                : status === 'pending'
                  ? 'قيد الانتظار'
                  : status === 'active'
                    ? 'مفعل'
                    : 'مرفوض'}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-sm">
                <th className="p-6 font-medium">الطالب والدورة</th>
                <th className="p-6 font-medium">طريقة الدفع والتفاصيل</th>
                <th className="p-6 font-medium">التاريخ</th>
                <th className="p-6 font-medium">الحالة</th>
                <th className="p-6 font-medium">المشاهدات</th>
                <th className="p-6 font-medium text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedEnrollments.items.map((enrollment) => (
                <motion.tr
                  layout
                  key={enrollment.id}
                  className="hover:bg-white/5 transition-colors group"
                >
                  <td className="p-6">
                    <div className="space-y-1">
                      <div className="font-bold text-white group-hover:text-brand-yellow transition-colors">
                        {enrollment.userEmail}
                      </div>
                      <div className="text-sm text-brand-blue flex items-center gap-1">
                        <CheckCircle size={12} />
                        {enrollment.courseTitle}
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="space-y-2">
                      <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-white/10 text-white uppercase border border-white/10 inline-flex items-center gap-1.5">
                        <CreditCard size={10} />
                        {enrollment.paymentMethod === 'vodafone_cash'
                          ? 'فودافون كاش'
                          : enrollment.paymentMethod}
                      </span>
                      {enrollment.paymentMethod === 'vodafone_cash' && (
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Phone size={12} className="text-brand-blue" />
                            <span className="font-mono">{enrollment.vodafoneCashNumber}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Hash size={12} className="text-brand-yellow" />
                            <span className="font-mono">{enrollment.transactionId}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-6 text-slate-400 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-500" />
                      {(enrollment.createdAt as any)?.seconds
                        ? new Date((enrollment.createdAt as any).seconds * 1000).toLocaleDateString(
                            'ar-EG'
                          )
                        : enrollment.createdAt
                          ? new Date(enrollment.createdAt).toLocaleDateString('ar-EG')
                          : '---'}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      {enrollment.status === 'pending' && (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-xs font-bold">
                          <Clock size={14} />
                          قيد المراجعة
                        </span>
                      )}
                      {enrollment.status === 'active' && (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-xs font-bold">
                          <CheckCircle size={14} />
                          مفعل
                        </span>
                      )}
                      {enrollment.status === 'rejected' && (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-xs font-bold">
                          <XCircle size={14} />
                          مرفوض
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1 border border-white/10 w-20">
                      <input
                        type="number"
                        defaultValue={enrollment.allowedViews || 5}
                        onBlur={(e) => updateAllowedViews(enrollment.id, e.target.value)}
                        className="bg-transparent text-white text-xs font-bold w-full outline-none text-center"
                      />
                    </div>
                  </td>
                  <td className="p-6 text-left">
                    {enrollment.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setConfirmAction({ enrollment, status: 'active' })}
                          className="p-2.5 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all hover:scale-110 border border-emerald-500/20"
                          title="تفعيل"
                        >
                          <Check size={20} />
                        </button>
                        <button
                          onClick={() => setConfirmAction({ enrollment, status: 'rejected' })}
                          className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-all hover:scale-110 border border-red-500/20"
                          title="رفض"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
              {filteredEnrollments.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-500">
                      <Filter size={48} className="opacity-20" />
                      <p>لا توجد طلبات اشتراك تطابق الفلتر الحالي</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={paginatedEnrollments.page}
          totalPages={paginatedEnrollments.totalPages}
          onPageChange={paginatedEnrollments.setPage}
        />
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card p-8 max-w-md w-full shadow-2xl border-white/10 text-center"
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  confirmAction.status === 'active'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {confirmAction.status === 'active' ? (
                  <CheckCircle size={40} />
                ) : (
                  <AlertCircle size={40} />
                )}
              </div>

              <h3 className="text-2xl font-bold text-white mb-4">
                {confirmAction.status === 'active' ? 'تأكيد الاشتراك' : 'رفض الاشتراك'}
              </h3>

              <p className="text-slate-400 mb-8 leading-relaxed">
                هل أنت متأكد من {confirmAction.status === 'active' ? 'تفعيل' : 'رفض'} اشتراك الطالب
                <span className="text-white font-bold block mt-1">
                  {confirmAction.enrollment.userEmail}
                </span>
                في دورة
                <span className="text-brand-blue font-bold block">
                  {confirmAction.enrollment.courseTitle}
                </span>
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-6 py-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={() =>
                    handleStatusChange(confirmAction.enrollment.id, confirmAction.status)
                  }
                  className={`px-6 py-3 text-white rounded-xl transition-all font-bold shadow-lg ${
                    confirmAction.status === 'active'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                  }`}
                >
                  تأكيد القرار
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
