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
import { useSettings } from '../../../contexts/SettingsContext';
import { ConfirmModal } from '../../../components/center/ConfirmModal';
import { EmptyState } from '../../../components/center/EmptyState';
import { StatCard } from '../../../components/center/StatCard';
import { Student } from '../../../hooks/useCenterData';
import { arabicToEnglishNumbers } from '../../../utils/arabicUtils';
import {
  Coins,
  TrendingDown,
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Calendar,
  Layers,
  FileText,
  Tag,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface CenterExpensesTabProps {
  allCenterStudents: Student[];
  centers: any[];
}

interface ExpenseRecord {
  id: string;
  title: string;
  amount: number;
  category: 'salaries' | 'rent' | 'printing' | 'utilities' | 'marketing' | 'other';
  centerId: string;
  date: string;
  notes?: string;
  createdAt?: any;
}

interface SubscriptionPackage {
  id: string;
  title: string;
  price: number;
  sessionCount: number; // e.g. 4, 8, 12. 0 means unlimited
  centerId: string;
  createdAt?: any;
}

export const CenterExpensesTab: React.FC<CenterExpensesTabProps> = ({
  allCenterStudents,
  centers,
}) => {
  const { settings } = useSettings();
  const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'packages'>('expenses');
  const [selectedCenter, setSelectedCenter] = useState('');
  
  // Expenses State
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [totalStudentsRevenue, setTotalStudentsRevenue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // New Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    category: 'salaries' as any,
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Edit Expense State
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [editExpenseForm, setEditExpenseForm] = useState({
    title: '',
    amount: '',
    category: 'salaries' as any,
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Subscription Packages State
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [packageToDelete, setPackageToDelete] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState({
    title: '',
    price: '',
    sessionCount: '4', // Default to 4 sessions
  });

  // Alert Config State
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

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      let expList: ExpenseRecord[] = [];
      let packList: SubscriptionPackage[] = [];
      let sumPaid = 0;

      if (isSupabaseConfigured() && supabase) {
        // 1. Fetch Expenses from Supabase
        try {
          const { data: expData, error: expErr } = await supabase.from('center_expenses').select('*');
          if (expErr) throw expErr;
          if (expData && expData.length > 0) {
            expList = expData.map(row => ({
              id: row.id,
              title: row.title,
              amount: Number(row.amount || 0),
              category: row.category,
              centerId: row.center_id,
              date: row.date,
              notes: row.notes,
              createdAt: row.timestamp,
            }));
          } else {
            const expSnap = await getDocs(collection(db, 'center_expenses'));
            expList = expSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseRecord));
          }
        } catch (eErr) {
          console.warn('⚡ [CenterExpensesTab] Fetching expenses from Supabase failed, fell back to Firestore:', eErr);
          const expSnap = await getDocs(collection(db, 'center_expenses'));
          expList = expSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseRecord));
        }

        // 2. Fetch Packages from Supabase
        try {
          const { data: packData, error: packErr } = await supabase.from('center_packages').select('*');
          if (packErr) throw packErr;
          if (packData && packData.length > 0) {
            packList = packData.map(row => ({
              id: row.id,
              title: row.title,
              price: Number(row.price || 0),
              sessionCount: Number(row.session_count || 0),
              centerId: row.center_id,
              createdAt: row.timestamp,
            }));
          } else {
            const packSnap = await getDocs(collection(db, 'center_packages'));
            packList = packSnap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPackage));
          }
        } catch (pErr) {
          console.warn('⚡ [CenterExpensesTab] Fetching packages from Supabase failed, fell back to Firestore:', pErr);
          const packSnap = await getDocs(collection(db, 'center_packages'));
          packList = packSnap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPackage));
        }

        // 3. Fetch Payments from Supabase
        try {
          const { data: payData, error: payErr } = await supabase.from('center_payments').select('amount, status');
          if (payErr) throw payErr;
          if (payData && payData.length > 0) {
            payData.forEach(row => {
              if (row.status === 'paid') {
                sumPaid += Number(row.amount || 0);
              }
            });
          } else {
            const paySnap = await getDocs(collection(db, 'center_payments'));
            paySnap.docs.forEach(d => {
              const data = d.data();
              if (data.status === 'paid') {
                sumPaid += Number(data.amount || data.amountPaid || 0);
              }
            });
          }
        } catch (pyErr) {
          console.warn('⚡ [CenterExpensesTab] Fetching payments from Supabase failed, fell back to Firestore:', pyErr);
          const paySnap = await getDocs(collection(db, 'center_payments'));
          paySnap.docs.forEach(d => {
            const data = d.data();
            if (data.status === 'paid') {
              sumPaid += Number(data.amount || data.amountPaid || 0);
            }
          });
        }
      } else {
        // 1. Fetch Expenses
        let expQuery = collection(db, 'center_expenses');
        const expSnap = await getDocs(expQuery);
        expList = expSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseRecord));

        // 2. Fetch Packages
        let packQuery = collection(db, 'center_packages');
        const packSnap = await getDocs(packQuery);
        packList = packSnap.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPackage));

        // 3. Fetch Total Revenue from Payments
        const paySnap = await getDocs(collection(db, 'center_payments'));
        paySnap.docs.forEach(d => {
          const data = d.data();
          if (data.status === 'paid') {
            sumPaid += Number(data.amount || data.amountPaid || 0);
          }
        });
      }

      setExpenses(expList.sort((a, b) => b.date.localeCompare(a.date)));
      setPackages(packList);
      setTotalStudentsRevenue(sumPaid);
    } catch (err) {
      console.error('Error loading expenses data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Expense CRUD
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title.trim() || !expenseForm.amount || !selectedCenter) {
      showAlert('يرجى ملء كافة الحقول المطلوبة واختيار الفرع', 'warning');
      return;
    }

    setSaving(true);
    try {
      const docId = `expense_${Date.now()}`;
      const amountNum = Number(arabicToEnglishNumbers(expenseForm.amount));

      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('center_expenses').insert({
            id: docId,
            title: expenseForm.title.trim(),
            amount: amountNum,
            category: expenseForm.category,
            center_id: selectedCenter,
            date: expenseForm.date,
            notes: expenseForm.notes.trim(),
            timestamp: new Date().toISOString(),
          });
          if (error) {
            console.warn('⚡ [CenterExpensesTab] Supabase expense insert warning, fell back to Firestore:', error);
          }
        } catch (sErr) {
          console.warn('⚡ [CenterExpensesTab] Supabase connection failed, fell back to Firestore:', sErr);
        }
      }

      await setDoc(doc(db, 'center_expenses', docId), {
        title: expenseForm.title.trim(),
        amount: amountNum,
        category: expenseForm.category,
        centerId: selectedCenter,
        date: expenseForm.date,
        notes: expenseForm.notes.trim(),
        createdAt: serverTimestamp(),
      });

      setExpenseForm({
        title: '',
        amount: '',
        category: 'salaries',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });

      await loadData();
      showAlert('تم تسجيل مصروفات التشغيل بنجاح', 'info');
    } catch (err) {
      console.error(err);
      showAlert('فشل حفظ المصروفات', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleEditExpenseClick = (exp: ExpenseRecord) => {
    setEditingExpense(exp);
    setEditExpenseForm({
      title: exp.title,
      amount: String(exp.amount),
      category: exp.category,
      date: exp.date,
      notes: exp.notes || '',
    });
  };

  const handleUpdateExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    if (!editExpenseForm.title.trim() || !editExpenseForm.amount) {
      showAlert('يرجى ملء الحقول الأساسية', 'warning');
      return;
    }

    setSaving(true);
    try {
      const amountNum = Number(arabicToEnglishNumbers(editExpenseForm.amount));

      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('center_expenses').update({
            title: editExpenseForm.title.trim(),
            amount: amountNum,
            category: editExpenseForm.category,
            date: editExpenseForm.date,
            notes: editExpenseForm.notes.trim(),
          }).eq('id', editingExpense.id);
          if (error) {
            console.warn('⚡ [CenterExpensesTab] Supabase expense update warning, fell back to Firestore:', error);
          }
        } catch (sErr) {
          console.warn('⚡ [CenterExpensesTab] Supabase connection failed, fell back to Firestore:', sErr);
        }
      }

      await updateDoc(doc(db, 'center_expenses', editingExpense.id), {
        title: editExpenseForm.title.trim(),
        amount: amountNum,
        category: editExpenseForm.category,
        date: editExpenseForm.date,
        notes: editExpenseForm.notes.trim(),
      });

      setEditingExpense(null);
      await loadData();
      showAlert('تم تعديل بند المصروفات بنجاح', 'info');
    } catch (err) {
      console.error(err);
      showAlert('فشل تحديث بند المصروفات', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpenseConfirm = async () => {
    if (!expenseToDelete) return;
    setLoading(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('center_expenses').delete().eq('id', expenseToDelete);
          if (error) {
            console.warn('⚡ [CenterExpensesTab] Supabase expense delete warning, fell back to Firestore:', error);
          }
        } catch (sErr) {
          console.warn('⚡ [CenterExpensesTab] Supabase connection failed, fell back to Firestore:', sErr);
        }
      }

      await deleteDoc(doc(db, 'center_expenses', expenseToDelete));
      setExpenseToDelete(null);
      await loadData();
      showAlert('تم حذف بند المصروفات بنجاح', 'info');
    } catch (err) {
      console.error(err);
      showAlert('فشل عملية حذف المصروفات', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Package CRUD
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageForm.title.trim() || !packageForm.price || !selectedCenter) {
      showAlert('يرجى ملء حقول باقة الاشتراك واختيار السنتر', 'warning');
      return;
    }

    setSaving(true);
    try {
      const docId = `package_${Date.now()}`;
      const priceNum = Number(arabicToEnglishNumbers(packageForm.price));
      const sessionsNum = Number(arabicToEnglishNumbers(packageForm.sessionCount)) || 0;

      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('center_packages').insert({
            id: docId,
            title: packageForm.title.trim(),
            price: priceNum,
            session_count: sessionsNum,
            center_id: selectedCenter,
            timestamp: new Date().toISOString(),
          });
          if (error) {
            console.warn('⚡ [CenterExpensesTab] Supabase package insert warning, fell back to Firestore:', error);
          }
        } catch (sErr) {
          console.warn('⚡ [CenterExpensesTab] Supabase connection failed, fell back to Firestore:', sErr);
        }
      }

      await setDoc(doc(db, 'center_packages', docId), {
        title: packageForm.title.trim(),
        price: priceNum,
        sessionCount: sessionsNum,
        centerId: selectedCenter,
        createdAt: serverTimestamp(),
      });

      setPackageForm({
        title: '',
        price: '',
        sessionCount: '4',
      });

      await loadData();
      showAlert('تم إضافة باقة اشتراك جديدة بنجاح', 'info');
    } catch (err) {
      console.error(err);
      showAlert('فشل إضافة الباقة الجديدة', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePackageConfirm = async () => {
    if (!packageToDelete) return;
    setLoading(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('center_packages').delete().eq('id', packageToDelete);
          if (error) {
            console.warn('⚡ [CenterExpensesTab] Supabase package delete warning, fell back to Firestore:', error);
          }
        } catch (sErr) {
          console.warn('⚡ [CenterExpensesTab] Supabase connection failed, fell back to Firestore:', sErr);
        }
      }

      await deleteDoc(doc(db, 'center_packages', packageToDelete));
      setPackageToDelete(null);
      await loadData();
      showAlert('تم حذف باقة الاشتراك بنجاح', 'info');
    } catch (err) {
      console.error(err);
      showAlert('فشل حذف الباقة', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Category translation
  const translateCat = (cat: string) => {
    const map: Record<string, string> = {
      salaries: 'رواتب مساعدين',
      rent: 'إيجار مقر',
      printing: 'طباعة وتصوير',
      utilities: 'فواتير وكهرباء',
      marketing: 'دعاية وتسويق',
      other: 'مصاريف تشغيل أخرى',
    };
    return map[cat] || cat;
  };

  // Calculations
  const filteredExpenses = expenses.filter(
    exp => !selectedCenter || exp.centerId === selectedCenter
  );

  const filteredPackages = packages.filter(
    pack => !selectedCenter || pack.centerId === selectedCenter
  );

  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const netProfit = totalStudentsRevenue - totalExpenses;

  return (
    <div className="space-y-6">
      {/* Selector branch and switcher sub-tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('expenses')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSubTab === 'expenses'
                ? 'bg-pink-500 text-slate-950 shadow-md shadow-pink-500/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            إدارة المصروفات والخزينة
          </button>
          <button
            onClick={() => setActiveSubTab('packages')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSubTab === 'packages'
                ? 'bg-pink-500 text-slate-950 shadow-md shadow-pink-500/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            باقات اشتراكات الطلاب
          </button>
        </div>

        <div className="w-full sm:w-auto">
          <select
            value={selectedCenter}
            onChange={(e) => setSelectedCenter(e.target.value)}
            className="w-full sm:w-56 bg-[#080d19] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-pink-500/30 font-bold"
          >
            <option value="">كل الفروع والسناتر</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeSubTab === 'expenses' ? (
        <>
          {/* Neon Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <StatCard
              title="إجمالي المقبوضات (من الطلاب)"
              value={`${totalStudentsRevenue} ج.م`}
              icon={TrendingUp}
              colorClass="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
              glowColor="rgba(16, 185, 129, 0.05)"
            />
            <StatCard
              title="إجمالي المصروفات المدفوعة"
              value={`${totalExpenses} ج.م`}
              icon={TrendingDown}
              colorClass="text-red-500 bg-red-500/10 border-red-500/20"
              glowColor="rgba(239, 68, 68, 0.05)"
            />
            <StatCard
              title="صافي الربح الفعلي للسنتر"
              value={`${netProfit} ج.م`}
              icon={Coins}
              colorClass={netProfit >= 0 ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-red-400 bg-red-500/10 border-red-500/20"}
              glowColor="rgba(245, 158, 11, 0.05)"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Add Expense Form */}
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl self-start">
              <div>
                <h3 className="text-xs font-black text-white flex items-center gap-2">
                  <Plus className="text-pink-500" size={14} />
                  <span>تسجيل مصروفات جديدة للفرع</span>
                </h3>
                <p className="text-[9px] text-gray-500 font-bold mt-1">
                  تسجيل إيجار المقرات، رواتب المساعدين والمشرفين، المطبوعات والمواد الدراسية.
                </p>
              </div>

              <form onSubmit={handleSaveExpense} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-300">عنوان المصروف</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: رواتب المساعدين - حصص شهر 5"
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full bg-[#080d19]/60 border border-white/10 rounded-xl py-2 px-4 text-xs text-white placeholder-gray-600 outline-none transition-all font-bold focus:border-pink-500/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-300">المبلغ بالجنيه</label>
                    <input
                      type="number"
                      required
                      placeholder="500"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                      className="w-full bg-[#080d19]/60 border border-white/10 rounded-xl py-2 px-4 text-xs text-white placeholder-gray-600 outline-none transition-all font-bold focus:border-pink-500/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-300">التاريخ</label>
                    <input
                      type="date"
                      required
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm(p => ({ ...p, date: e.target.value }))}
                      className="w-full bg-[#080d19]/60 border border-white/10 rounded-xl py-2 px-4 text-xs text-white placeholder-gray-600 outline-none transition-all font-bold focus:border-pink-500/30"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-300">تصنيف المصروف</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm(p => ({ ...p, category: e.target.value as any }))}
                    className="w-full bg-[#080d19]/60 border border-white/10 rounded-xl py-2 px-4 text-xs text-white outline-none focus:border-pink-500/30 font-bold"
                  >
                    <option value="salaries">رواتب المساعدين والمشرفين</option>
                    <option value="rent">إيجار قاعات المقر</option>
                    <option value="printing">طباعة الملازم والكتب</option>
                    <option value="utilities">الكهرباء، المياه، والإنترنت</option>
                    <option value="marketing">دعاية، إعلانات، ومطبوعات</option>
                    <option value="other">مصاريف أخرى للسنتر</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-300">ملاحظات إضافية</label>
                  <textarea
                    placeholder="تفاصيل المصروف أو المستلم..."
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full h-16 bg-[#080d19]/60 border border-white/10 rounded-xl py-2 px-4 text-xs text-white placeholder-gray-600 outline-none resize-none transition-all font-bold focus:border-pink-500/30"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving || !selectedCenter}
                  className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-pink-500/10 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                  <span>تسجيل المعاملة بالخزينة</span>
                </button>
                {!selectedCenter && (
                  <p className="text-[8px] text-amber-500 text-center font-bold">⚠️ يرجى اختيار الفرع أولاً لتسجيل المعاملة فيه.</p>
                )}
              </form>
            </div>

            {/* Expense Ledger Table */}
            <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
              <div>
                <h3 className="text-xs font-black text-white flex items-center gap-2">
                  <FileText className="text-pink-500" size={14} />
                  <span>دفتر القيود اليومي للمصروفات</span>
                </h3>
              </div>

              {filteredExpenses.length === 0 ? (
                <EmptyState
                  title="الخزينة خالية"
                  description="لا توجد أي قيود مصروفات مسجلة للسنتر المحدد بعد."
                  icon={Coins}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-gray-500 text-[10px] font-black">
                        <th className="py-2.5">البند / الملاحظات</th>
                        <th className="py-2.5">التصنيف</th>
                        <th className="py-2.5">المبلغ</th>
                        <th className="py-2.5">التاريخ</th>
                        <th className="py-2.5 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3">
                            <span className="font-black text-white block">{exp.title}</span>
                            {exp.notes && (
                              <span className="text-[9px] text-gray-500 block mt-0.5">{exp.notes}</span>
                            )}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md font-bold text-[9px]">
                              {translateCat(exp.category)}
                            </span>
                          </td>
                          <td className="py-3 font-bold text-white">
                            {exp.amount} ج.م
                          </td>
                          <td className="py-3 text-gray-400">
                            {exp.date}
                          </td>
                          <td className="py-3">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleEditExpenseClick(exp)}
                                className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
                                title="تعديل"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => setExpenseToDelete(exp.id)}
                                className="p-1 rounded bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white text-red-400 cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Subscriptions Packages View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Package Form */}
          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl self-start">
            <div>
              <h3 className="text-xs font-black text-white flex items-center gap-2">
                <Tag className="text-pink-500" size={14} />
                <span>إضافة باقة اشتراك سنتر جديدة</span>
              </h3>
              <p className="text-[9px] text-gray-500 font-bold mt-1">
                تحديد اشتراك الحصص والشهور. عندما يشتري الطالب باقة، تشحن حصص حضور إضافية له بالكامل.
              </p>
            </div>

            <form onSubmit={handleSavePackage} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-300">اسم باقة الاشتراك</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: باقة اشتراك 4 حصص حضور"
                  value={packageForm.title}
                  onChange={(e) => setPackageForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-[#080d19]/60 border border-white/10 rounded-xl py-2 px-4 text-xs text-white placeholder-gray-600 outline-none transition-all font-bold focus:border-pink-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-300">سعر الباقة (ج.م)</label>
                  <input
                    type="number"
                    required
                    placeholder="150"
                    value={packageForm.price}
                    onChange={(e) => setPackageForm(p => ({ ...p, price: e.target.value }))}
                    className="w-full bg-[#080d19]/60 border border-white/10 rounded-xl py-2 px-4 text-xs text-white placeholder-gray-600 outline-none transition-all font-bold focus:border-pink-500/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-300">عدد حصص الحضور</label>
                  <input
                    type="number"
                    required
                    placeholder="4"
                    value={packageForm.sessionCount}
                    onChange={(e) => setPackageForm(p => ({ ...p, sessionCount: e.target.value }))}
                    className="w-full bg-[#080d19]/60 border border-white/10 rounded-xl py-2 px-4 text-xs text-white placeholder-gray-600 outline-none transition-all font-bold focus:border-pink-500/30"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || !selectedCenter}
                className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-pink-500/10 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>حفظ وإتاحة الباقة</span>
              </button>
              {!selectedCenter && (
                <p className="text-[8px] text-amber-500 text-center font-bold">⚠️ يرجى اختيار الفرع أولاً لتسجيل الباقة فيه.</p>
              )}
            </form>
          </div>

          {/* Packages List */}
          <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
            <div>
              <h3 className="text-xs font-black text-white flex items-center gap-2">
                <Layers className="text-pink-500" size={14} />
                <span>دليل وباقات الاشتراكات المتاحة بالسنتر</span>
              </h3>
            </div>

            {filteredPackages.length === 0 ? (
              <EmptyState
                title="لا توجد باقات"
                description="لم يتم توفير باقات اشتراكات سنتر لهذا الفرع بعد."
                icon={Layers}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredPackages.map((pack) => (
                  <div
                    key={pack.id}
                    className="bg-[#080d19]/50 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/10 transition-all shadow-md relative overflow-hidden group"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold text-[9px]">
                          باقة حصص رصيد
                        </span>
                        <button
                          onClick={() => setPackageToDelete(pack.id)}
                          className="p-1 rounded bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                          title="حذف الباقة"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <h4 className="text-sm font-black text-white">{pack.title}</h4>
                      <div className="flex justify-between text-xs pt-2 border-t border-white/5 text-gray-400 font-bold">
                        <span>الرصيد: {pack.sessionCount} حصص حضور</span>
                        <span className="text-emerald-400 font-black">{pack.price} ج.م</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#04060d]/80 backdrop-blur-sm" onClick={() => setEditingExpense(null)} />
          <div className="w-full max-w-md bg-[#0a0f1d] border border-white/10 rounded-3xl p-6 relative shadow-2xl z-10 text-right">
            <h3 className="text-sm font-black text-white mb-6">تعديل بند المصروفات</h3>

            <form onSubmit={handleUpdateExpenseSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-300">عنوان البند</label>
                <input
                  type="text"
                  required
                  value={editExpenseForm.title}
                  onChange={(e) => setEditExpenseForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-300">المبلغ</label>
                  <input
                    type="number"
                    required
                    value={editExpenseForm.amount}
                    onChange={(e) => setEditExpenseForm(p => ({ ...p, amount: e.target.value }))}
                    className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-300">التاريخ</label>
                  <input
                    type="date"
                    required
                    value={editExpenseForm.date}
                    onChange={(e) => setEditExpenseForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-300">التصنيف</label>
                <select
                  value={editExpenseForm.category}
                  onChange={(e) => setEditExpenseForm(p => ({ ...p, category: e.target.value as any }))}
                  className="w-full px-4 py-2 bg-[#080d19] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-pink-500/30 font-bold"
                >
                  <option value="salaries">رواتب المساعدين والمشرفين</option>
                  <option value="rent">إيجار قاعات المقر</option>
                  <option value="printing">طباعة الملازم والكتب</option>
                  <option value="utilities">الكهرباء، المياه، والإنترنت</option>
                  <option value="marketing">دعاية، إعلانات، ومطبوعات</option>
                  <option value="other">مصاريف أخرى للسنتر</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-300">ملاحظات</label>
                <textarea
                  value={editExpenseForm.notes}
                  onChange={(e) => setEditExpenseForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full h-16 px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-pink-500/30 text-xs text-white outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-white/5 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-teal-500 hover:opacity-90 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                  <span>حفظ التغييرات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm deletion modal */}
      <ConfirmModal
        isOpen={expenseToDelete !== null}
        title="تأكيد حذف بند المصروفات"
        message="هل تريد حذف بند الخزينة والمصروفات هذا نهائياً من سجلات السنتر؟ لا يمكن استرجاع البيانات المحذوفة."
        confirmText="حذف نهائي"
        cancelText="تراجع"
        type="danger"
        onConfirm={handleDeleteExpenseConfirm}
        onCancel={() => setExpenseToDelete(null)}
      />

      <ConfirmModal
        isOpen={packageToDelete !== null}
        title="تأكيد حذف باقة الاشتراك"
        message="هل تريد حذف باقة اشتراك الطلاب هذه نهائياً؟ لن يتمكن الطلاب الجدد من الاشتراك بها."
        confirmText="حذف نهائي"
        cancelText="تراجع"
        type="danger"
        onConfirm={handleDeletePackageConfirm}
        onCancel={() => setPackageToDelete(null)}
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
