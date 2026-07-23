import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { dbRouter } from '../../../services/dbRouter';
import { Student } from '../../../hooks/useCenterData';
import { arabicToEnglishNumbers } from '../../../utils/arabicUtils';
import { ConfirmModal } from '../../../components/center/ConfirmModal';
import { EmptyState } from '../../../components/center/EmptyState';
import { paymentReceiptService } from '../../../services/paymentReceiptService';
import { useSettings } from '../../../contexts/SettingsContext';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Calendar,
  User,
  Users,
  Coins,
  CheckCircle,
  Clock,
  Printer,
  ChevronLeft,
  X,
} from 'lucide-react';

interface CenterFinancialsTabProps {
  allCenterStudents: Student[];
}

interface PaymentRecord {
  id: string;
  studentUid: string;
  studentName: string;
  studentId: string;
  title: string;
  type: 'subscription' | 'booklet' | 'installment';
  amount: number;
  status: 'paid' | 'pending';
  date: string;
  remarks?: string;
  timestamp?: any;
}

interface Debtor {
  uid: string;
  name: string;
  studentId: string;
  totalPending: number;
  records: PaymentRecord[];
}

export const CenterFinancialsTab: React.FC<CenterFinancialsTabProps> = ({
  allCenterStudents,
}) => {
  const { settings } = useSettings();
  const [selectedFinStudent, setSelectedFinStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [finRecords, setFinRecords] = useState<PaymentRecord[]>([]);
  const [finSummary, setFinSummary] = useState({ paid: 0, pending: 0 });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);

  // New Payment Form
  const [finForm, setFinForm] = useState({
    title: '',
    type: 'subscription' as 'subscription' | 'booklet' | 'installment',
    amount: '',
    status: 'paid' as 'paid' | 'pending',
    date: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  // Edit Payment State
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    type: 'subscription' as 'subscription' | 'booklet' | 'installment',
    amount: '',
    status: 'paid' as 'paid' | 'pending',
    date: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  // Debtors list
  const [debtorsList, setDebtorsList] = useState<Debtor[]>([]);
  const [showDebtors, setShowDebtors] = useState(true);

  // Alert Dialog State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'danger';
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  const showAlert = (message: string, type: 'info' | 'warning' | 'danger' = 'info', title = 'إشعار النظام') => {
    setAlertConfig({
      isOpen: true,
      title,
      message,
      type,
      confirmText: 'موافق',
      onConfirm: () => setAlertConfig(null),
    });
  };

  const loadDebtorsList = async () => {
    setLoading(true);
    try {
      const grouped: Record<string, Debtor> = {};

      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('center_payments')
          .select('*')
          .eq('status', 'pending');
        
        if (!error && data) {
          data.forEach((row: any) => {
            const uid = row.student_uid || '';
            if (!uid) return;

            if (!grouped[uid]) {
              grouped[uid] = {
                uid,
                name: row.student_name || 'طالب غير معروف',
                studentId: row.student_id || '',
                totalPending: 0,
                records: [],
              };
            }
            const amount = Number(row.amount || 0);
            grouped[uid].totalPending += amount;
            grouped[uid].records.push({
              id: row.id,
              studentUid: row.student_uid,
              studentName: row.student_name,
              studentId: row.student_id,
              title: row.title,
              type: row.type,
              amount,
              status: row.status,
              date: row.date,
              remarks: row.remarks || '',
            });
          });
        }
      } else {
        const q = query(
          collection(db, 'center_payments'),
          where('status', '==', 'pending')
        );
        const snap = await getDocs(q);
        snap.docs.forEach((d) => {
          const data = d.data();
          const uid = data.studentUid || '';
          if (!uid) return;

          if (!grouped[uid]) {
            grouped[uid] = {
              uid,
              name: data.studentName || 'طالب غير معروف',
              studentId: data.studentId || '',
              totalPending: 0,
              records: [],
            };
          }
          const amount = Number(data.amount || data.amountPaid || 0);
          grouped[uid].totalPending += amount;
          grouped[uid].records.push({ id: d.id, ...data } as PaymentRecord);
        });
      }

      const list = Object.values(grouped).sort((a, b) => b.totalPending - a.totalPending);
      setDebtorsList(list);
    } catch (err) {
      console.error('Error loading debtors list:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFinancialLedger = async (studentUid: string) => {
    setLoading(true);
    try {
      let list: PaymentRecord[] = [];

      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('center_payments')
          .select('*')
          .eq('student_uid', studentUid);
        
        if (!error && data) {
          list = data.map((row: any) => ({
            id: row.id,
            studentUid: row.student_uid,
            studentName: row.student_name,
            studentId: row.student_id,
            title: row.title,
            type: row.type,
            amount: Number(row.amount || 0),
            status: row.status,
            date: row.date,
            remarks: row.remarks || '',
          }));
        }
      } else {
        const q = query(
          collection(db, 'center_payments'),
          where('studentUid', '==', studentUid)
        );
        const snap = await getDocs(q);
        list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord));
      }

      list.sort((a, b) => b.date.localeCompare(a.date));
      setFinRecords(list);

      let paidSum = 0;
      let pendingSum = 0;
      list.forEach((r) => {
        if (r.status === 'paid') paidSum += Number(r.amount || 0);
        else if (r.status === 'pending') pendingSum += Number(r.amount || 0);
      });
      setFinSummary({ paid: paidSum, pending: pendingSum });
    } catch (err) {
      console.error('Error loading financial ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedFinStudent) {
      loadFinancialLedger(selectedFinStudent.uid);
      setShowDebtors(false);
    } else {
      loadDebtorsList();
      setShowDebtors(true);
    }
  }, [selectedFinStudent]);

  const handleSavePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFinStudent || !finForm.title.trim() || !finForm.amount) return;

    setSaving(true);
    try {
      const docId = `payment_${selectedFinStudent.uid}_${Date.now()}`;
      const amountNum = Number(arabicToEnglishNumbers(finForm.amount));

      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('center_payments').insert({
            id: docId,
            student_uid: selectedFinStudent.uid,
            student_name: selectedFinStudent.displayName,
            student_id: selectedFinStudent.studentId,
            title: finForm.title.trim(),
            type: finForm.type,
            amount: amountNum,
            status: finForm.status,
            date: finForm.date,
            remarks: finForm.remarks.trim(),
            timestamp: new Date().toISOString(),
          });
          if (error) {
            console.warn('⚡ [CenterFinancialsTab] Supabase payment insert warning, fell back to Firestore:', error);
          }
        } catch (sErr) {
          console.warn('⚡ [CenterFinancialsTab] Supabase connection failed, fell back to Firestore:', sErr);
        }
      }

      await setDoc(doc(db, 'center_payments', docId), {
        studentUid: selectedFinStudent.uid,
        studentName: selectedFinStudent.displayName,
        studentId: selectedFinStudent.studentId,
        title: finForm.title.trim(),
        type: finForm.type,
        amount: amountNum,
        status: finForm.status,
        date: finForm.date,
        remarks: finForm.remarks.trim(),
        timestamp: serverTimestamp(),
        // backwards compat fields
        amountPaid: finForm.status === 'paid' ? amountNum : 0,
        amountTotal: amountNum,
        notes: finForm.remarks.trim(),
      });

      // Automatically update student's active monthly subscription details upon saving a paid subscription
      if (finForm.type === 'subscription' && finForm.status === 'paid') {
        const payDate = new Date(finForm.date);
        const expiryDate = new Date(payDate);
        expiryDate.setDate(expiryDate.getDate() + 30);
        const expiryStr = expiryDate.toISOString().split('T')[0];

        await dbRouter.updateStudent(selectedFinStudent.uid, {
          subscriptionType: 'monthly',
          subscriptionStartDate: finForm.date,
          subscriptionEndDate: expiryStr,
          packageName: finForm.title.trim(),
          remainingSessions: 0,
        });
      }

      // Print receipt immediately if paid
      if (finForm.status === 'paid') {
        const labelMap = { subscription: 'اشتراك شهري', booklet: 'ملازم ومذكرات', installment: 'قسط/رسوم' };
        paymentReceiptService.printReceipt({
          studentName: selectedFinStudent.displayName || '',
          studentId: selectedFinStudent.studentId || '',
          paymentId: docId,
          title: finForm.title.trim(),
          amount: amountNum,
          date: finForm.date,
          typeLabel: labelMap[finForm.type],
          remarks: finForm.remarks.trim() || undefined,
          platformName: settings.siteName || 'فهمني',
        });
      }

      setFinForm({
        title: '',
        type: 'subscription',
        amount: '',
        status: 'paid',
        date: new Date().toISOString().split('T')[0],
        remarks: '',
      });

      await loadFinancialLedger(selectedFinStudent.uid);
      showAlert('تم تسجيل الدفعة المالية بنجاح', 'info');
    } catch (err) {
      console.error(err);
      showAlert('فشل حفظ المعاملة المالية', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleEditPaymentClick = (payment: PaymentRecord) => {
    setEditingPayment(payment);
    setEditForm({
      title: payment.title,
      type: payment.type,
      amount: String(payment.amount),
      status: payment.status,
      date: payment.date,
      remarks: payment.remarks || '',
    });
  };

  const handleEditPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment || !selectedFinStudent) return;
    if (!editForm.title.trim() || !editForm.amount) {
      showAlert('يرجى ملء كافة الحقول المطلوبة', 'warning');
      return;
    }

    setSaving(true);
    try {
      const amountNum = Number(arabicToEnglishNumbers(editForm.amount));

      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('center_payments')
          .update({
            title: editForm.title.trim(),
            type: editForm.type,
            amount: amountNum,
            status: editForm.status,
            date: editForm.date,
            remarks: editForm.remarks.trim(),
            timestamp: new Date().toISOString(),
          })
          .eq('id', editingPayment.id);
        if (error) throw error;
      } else {
        await updateDoc(doc(db, 'center_payments', editingPayment.id), {
          title: editForm.title.trim(),
          type: editForm.type,
          amount: amountNum,
          status: editForm.status,
          date: editForm.date,
          remarks: editForm.remarks.trim(),
          amountPaid: editForm.status === 'paid' ? amountNum : 0,
          amountTotal: amountNum,
          notes: editForm.remarks.trim(),
        });
      }

      setEditingPayment(null);
      await loadFinancialLedger(selectedFinStudent.uid);
      showAlert('تم تعديل الفاتورة بنجاح', 'info');
    } catch (err) {
      console.error('Error updating payment:', err);
      showAlert('فشل تعديل الفاتورة', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePaymentConfirm = async () => {
    if (!paymentToDelete || !selectedFinStudent) return;

    setLoading(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('center_payments').delete().eq('id', paymentToDelete);
          if (error) {
            console.warn('⚡ [CenterFinancialsTab] Supabase payment delete warning, fell back to Firestore:', error);
          }
        } catch (sErr) {
          console.warn('⚡ [CenterFinancialsTab] Supabase connection failed, fell back to Firestore:', sErr);
        }
      }

      await deleteDoc(doc(db, 'center_payments', paymentToDelete));
      setPaymentToDelete(null);
      await loadFinancialLedger(selectedFinStudent.uid);
      showAlert('تم حذف المعاملة المالية بنجاح', 'info');
    } catch (err) {
      console.error(err);
      showAlert('فشل الحذف', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = (payment: PaymentRecord) => {
    const labelMap = { subscription: 'اشتراك شهري', booklet: 'ملازم ومذكرات', installment: 'قسط/رسوم' };
    paymentReceiptService.printReceipt({
      studentName: selectedFinStudent?.displayName || '',
      studentId: selectedFinStudent?.studentId || '',
      paymentId: payment.id,
      title: payment.title,
      amount: payment.amount,
      date: payment.date,
      typeLabel: labelMap[payment.type],
      remarks: payment.remarks || undefined,
      platformName: settings.siteName || 'فهمني',
    });
  };

  const filteredStudents = allCenterStudents.filter((stu) => {
    const queryLower = searchQuery.toLowerCase().trim();
    const cleanQuery = arabicToEnglishNumbers(queryLower);
    return (
      !cleanQuery ||
      (stu.displayName && stu.displayName.toLowerCase().includes(cleanQuery)) ||
      (stu.studentId && stu.studentId.toLowerCase().includes(cleanQuery))
    );
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Search and Student Selection */}
      <div className="space-y-6 self-start">
        {/* Selector Card */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
          <div>
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <Search className="text-pink-500" size={14} />
              <span>اختر طالب السنتر لعرض الحساب</span>
            </h3>
            <p className="text-[9px] text-gray-500 font-bold mt-1">البحث بالاسم أو الكود لرصد الدفعات والمستحقات.</p>
          </div>

          <div className="relative">
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="ابحث عن طالب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#080d19]/60 border border-white/10 rounded-2xl py-2 pr-9 pl-4 text-xs text-white placeholder-gray-500 outline-none transition-all font-bold focus:border-pink-500/30"
            />
          </div>

          {searchQuery.trim().length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1.5 bg-[#080d19]/40 p-2 rounded-2xl border border-white/5">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-4 text-gray-600 text-[10px] font-bold">لا يوجد نتائج</div>
              ) : (
                filteredStudents.map((s) => (
                  <div
                    key={s.uid}
                    onClick={() => {
                      setSelectedFinStudent(s);
                      setSearchQuery('');
                    }}
                    className="p-2.5 hover:bg-white/5 rounded-xl cursor-pointer transition-colors flex justify-between items-center text-xs font-bold text-gray-300 hover:text-white"
                  >
                    <span>{s.displayName}</span>
                    <span className="font-mono text-[10px] text-gray-500">{s.studentId}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {selectedFinStudent && (
            <div className="p-3 bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded-2xl text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={14} />
                <span>حساب: {selectedFinStudent.displayName}</span>
              </div>
              <button
                onClick={() => setSelectedFinStudent(null)}
                className="p-1 bg-white/5 hover:bg-white/10 rounded-lg text-white cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* New Payment Receipt Form */}
        {selectedFinStudent && (
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2">
              <Plus className="text-pink-500" size={16} />
              <h3 className="text-xs font-black text-white">إضافة إيصال دفع جديد</h3>
            </div>

            <form onSubmit={handleSavePaymentSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase">بند الدفع (العنوان) *</label>
                <input
                  type="text"
                  value={finForm.title}
                  onChange={(e) => setFinForm((p) => ({ ...p, title: e.target.value }))}
                  required
                  placeholder="مثال: اشتراك شهر نوفمبر، مذكرة المراجعة الأولى..."
                  className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">قيمة المبلغ (ج.م) *</label>
                  <input
                    type="text"
                    value={finForm.amount}
                    onChange={(e) => setFinForm((p) => ({ ...p, amount: e.target.value }))}
                    required
                    placeholder="150"
                    className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none font-bold text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">نوع الفاتورة *</label>
                  <select
                    value={finForm.type}
                    onChange={(e) => setFinForm((p) => ({ ...p, type: e.target.value as any }))}
                    className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none cursor-pointer font-bold"
                  >
                    <option value="subscription" className="bg-[#0b0f19]">اشتراك شهري</option>
                    <option value="booklet" className="bg-[#0b0f19]">ملزمة / كتاب</option>
                    <option value="installment" className="bg-[#0b0f19]">قسط مالي</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">الحالة *</label>
                  <select
                    value={finForm.status}
                    onChange={(e) => setFinForm((p) => ({ ...p, status: e.target.value as any }))}
                    className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none cursor-pointer font-bold"
                  >
                    <option value="paid" className="bg-[#0b0f19]">تم الدفع (تحصيل فوري)</option>
                    <option value="pending" className="bg-[#0b0f19]">معلق (تسجيل مديونية)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">التاريخ *</label>
                  <input
                    type="date"
                    value={finForm.date}
                    onChange={(e) => setFinForm((p) => ({ ...p, date: e.target.value }))}
                    required
                    className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none cursor-pointer font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold">ملاحظات إضافية</label>
                <input
                  type="text"
                  value={finForm.remarks}
                  onChange={(e) => setFinForm((p) => ({ ...p, remarks: e.target.value }))}
                  placeholder="ملاحظات الدفع أو التأجيل..."
                  className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Coins size={16} />
                )}
                <span>حفظ وطباعة إيصال الدفع</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Main ledger table OR debtors list */}
      <div className="lg:col-span-2 space-y-6">
        {showDebtors ? (
          /* DEBTORS VIEW */
          <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl backdrop-blur-md shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Users className="text-pink-500" size={18} />
                  <span>كشف المديونيات والمتأخرات المالية للطلاب</span>
                </h3>
                <p className="text-[10px] text-gray-500 font-bold mt-1">قائمة الطلاب الذين لديهم مديونيات أو أقساط معلقة بالسناتر</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12 gap-3">
                <Loader2 className="animate-spin text-pink-500" size={18} />
                <span className="text-xs text-gray-400 font-bold">جاري تحميل كشف المديونيات...</span>
              </div>
            ) : debtorsList.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="لا يوجد أي متأخرات مالية"
                description="كل الطلاب سددوا مستحقاتهم بالكامل حالياً."
                accentColor="emerald-500"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {debtorsList.map((debtor) => (
                  <div
                    key={debtor.uid}
                    onClick={() => {
                      const student = allCenterStudents.find((s) => s.uid === debtor.uid);
                      if (student) setSelectedFinStudent(student);
                    }}
                    className="p-5 bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-pink-500/20 rounded-3xl cursor-pointer transition-all duration-300 flex flex-col justify-between group shadow-md"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-black text-white group-hover:text-pink-400 transition-colors">{debtor.name}</h4>
                        <span className="font-mono text-[9px] text-gray-500">{debtor.studentId}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold">عدد الدفعات المعلقة: {debtor.records.length} دفعات</p>
                    </div>

                    <div className="flex justify-between items-center mt-6 pt-3 border-t border-white/5">
                      <span className="text-[9px] text-red-400 font-black uppercase">المبلغ الإجمالي المطلـوب:</span>
                      <span className="text-xs font-black text-red-500">{debtor.totalPending} ج.م</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* STUDENT LEDGER VIEW */
          <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl backdrop-blur-md shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Coins className="text-pink-500" size={18} />
                  <span>سجل الحساب المالي الكامل للطالب</span>
                </h3>
                <p className="text-[10px] text-gray-500 font-bold mt-1">كشف بكل الحركات المالية والمدفوعات المسجلة</p>
              </div>

              <button
                onClick={() => setSelectedFinStudent(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] rounded-xl transition-all cursor-pointer border border-white/5"
              >
                الرجوع لكشف المديونيات
              </button>
            </div>

            {/* Financial Stats Summary Card */}
            <div className="grid grid-cols-2 gap-4 bg-white/[0.01] border border-white/5 p-4 rounded-2xl text-center">
              <div>
                <span className="text-[9px] text-gray-500 font-bold uppercase block">المدفوع الكلي</span>
                <span className="text-sm font-black text-emerald-500 block mt-1">{finSummary.paid} ج.م</span>
              </div>
              <div className="border-r border-white/5">
                <span className="text-[9px] text-gray-500 font-bold uppercase block">المتبقي / المعلق</span>
                <span className="text-sm font-black text-red-500 block mt-1">{finSummary.pending} ج.م</span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12 gap-3">
                <Loader2 className="animate-spin text-pink-500" size={18} />
                <span className="text-xs text-gray-400 font-bold">جاري تحميل سجل الطالب المالي...</span>
              </div>
            ) : finRecords.length === 0 ? (
              <EmptyState
                icon={Coins}
                title="لا توجد أي معاملات مالية"
                description="لم يتم رصد أي دفعات أو فواتير لهذا الطالب حتى الآن."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500 font-bold text-[10px] uppercase tracking-wider">
                      <th className="pb-3 text-center w-12">#</th>
                      <th className="pb-3 pr-2">بند الدفع (البيان)</th>
                      <th className="pb-3 text-center">المبلغ</th>
                      <th className="pb-3 text-center">تاريخ الاستحقاق</th>
                      <th className="pb-3 text-center">الحالة</th>
                      <th className="pb-3 text-center w-32">التحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {finRecords.map((record, idx) => {
                      const typeLabel =
                        record.type === 'booklet'
                          ? 'ملزمة'
                          : record.type === 'installment'
                          ? 'قسط'
                          : 'اشتراك شهري';

                      return (
                        <tr key={record.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3.5 text-center text-gray-500 font-bold">{idx + 1}</td>
                          <td className="py-3.5 pr-2">
                            <div className="font-bold text-white">{record.title}</div>
                            <span className="text-[9px] text-gray-500 font-bold block mt-0.5">{typeLabel}</span>
                          </td>
                          <td className="py-3.5 text-center font-bold text-white">{record.amount} ج.م</td>
                          <td className="py-3.5 text-center font-mono text-gray-400">{record.date}</td>
                          
                          <td className="py-3.5 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[9px] font-black border uppercase ${
                                record.status === 'paid'
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                  : 'bg-red-500/10 border-red-500/20 text-red-500'
                              }`}
                            >
                              {record.status === 'paid' ? 'مدفوع' : 'معلق'}
                            </span>
                          </td>

                          <td className="py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {record.status === 'paid' && (
                                <button
                                  type="button"
                                  onClick={() => handlePrintReceipt(record)}
                                  className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-slate-950 rounded-lg transition-all cursor-pointer"
                                  title="طباعة إيصال الدفع"
                                >
                                  <Printer size={12} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleEditPaymentClick(record)}
                                className="p-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500 hover:text-white rounded-lg transition-all cursor-pointer"
                                title="تعديل الفاتورة"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaymentToDelete(record.id)}
                                className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all cursor-pointer"
                                title="حذف الفاتورة نهائياً"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide Panel for Edit Payment */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div onClick={() => setEditingPayment(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#0a0f1d] border-l border-white/10 h-full p-6 overflow-y-auto flex flex-col justify-between text-right" dir="rtl">
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <h3 className="text-sm font-black text-white">تعديل الحركة المالية للطالب</h3>
                <button
                  onClick={() => setEditingPayment(null)}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleEditPaymentSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">بند الدفع (البيان) *</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                    required
                    className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">قيمة المبلغ (ج.م) *</label>
                    <input
                      type="text"
                      value={editForm.amount}
                      onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                      required
                      className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none font-bold text-center"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">نوع الفاتورة *</label>
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value as any }))}
                      className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none cursor-pointer font-bold"
                    >
                      <option value="subscription" className="bg-[#0b0f19]">اشتراك شهري</option>
                      <option value="booklet" className="bg-[#0b0f19]">ملزمة / كتاب</option>
                      <option value="installment" className="bg-[#0b0f19]">قسط مالي</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">الحالة *</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as any }))}
                      className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none cursor-pointer font-bold"
                    >
                      <option value="paid" className="bg-[#0b0f19]">تم الدفع</option>
                      <option value="pending" className="bg-[#0b0f19]">معلق (مديونية)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">التاريخ *</label>
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                      required
                      className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none cursor-pointer font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400">ملاحظات إضافية</label>
                  <input
                    type="text"
                    value={editForm.remarks}
                    onChange={(e) => setEditForm((p) => ({ ...p, remarks: e.target.value }))}
                    className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none"
                  />
                </div>
              </form>
            </div>

            <div className="flex gap-3 justify-end pt-6 border-t border-white/10 mt-8">
              <button
                type="button"
                onClick={() => setEditingPayment(null)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleEditPaymentSubmit}
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-teal-500 hover:opacity-90 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm deletion of payment transaction */}
      <ConfirmModal
        isOpen={paymentToDelete !== null}
        title="تأكيد حذف المعاملة المالية"
        message="هل أنت متأكد تماماً من حذف هذه المعاملة المالية نهائياً؟ سيتم إزالة الفاتورة وإلغاء القسط بالكامل من النظام."
        confirmText="حذف نهائي"
        cancelText="تراجع"
        type="danger"
        onConfirm={handleDeletePaymentConfirm}
        onCancel={() => setPaymentToDelete(null)}
      />

      {/* Custom Alert Modal */}
      {alertConfig && (
        <ConfirmModal
          isOpen={alertConfig.isOpen}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText={alertConfig.confirmText}
          cancelText=""
          type={alertConfig.type}
          onConfirm={alertConfig.onConfirm}
          onCancel={alertConfig.onConfirm}
        />
      )}
    </div>
  );
};
