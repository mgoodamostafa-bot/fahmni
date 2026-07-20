import React, { useState, useEffect } from 'react';
import {
  Search,
  UserPlus,
  Printer,
  Trash2,
  Edit2,
  X,
  Loader2,
  AlertCircle,
  QrCode,
  Building,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Filter,
  UserCheck,
} from 'lucide-react';
import { Center, Group, Student } from '../../../hooks/useCenterData';
import { dbRouter } from '../../../services/dbRouter';
import { useSettings } from '../../../contexts/SettingsContext';
import { db } from '../../../lib/firebase';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { collection, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { cleanPhone, getGradeLabel, arabicToEnglishNumbers } from '../../../utils/arabicUtils';
import { studentCardService } from '../../../services/studentCardService';
import { CenterStudentProfileModal } from './CenterStudentProfileModal';
import { StudentFormFields } from '../../../components/center/StudentFormFields';
import { ConfirmModal } from '../../../components/center/ConfirmModal';
import { EmptyState } from '../../../components/center/EmptyState';

interface CenterStudentsTabProps {
  centers: Center[];
  groups: Group[];
  allCenterStudents: Student[];
  refreshData: () => void;
  onSelectPrintStudent: (student: Student) => void;
}

export const CenterStudentsTab: React.FC<CenterStudentsTabProps> = ({
  centers,
  groups,
  allCenterStudents,
  refreshData,
  onSelectPrintStudent,
}) => {
  const { settings } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewingProfileStudent, setViewingProfileStudent] = useState<Student | null>(null);

  // Filters State
  const [filterCenterId, setFilterCenterId] = useState('');
  const [filterGroupId, setFilterGroupId] = useState('');
  const [filterGrade, setFilterGrade] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Confirm Delete Modal State
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Packages loading
  const [centerPackages, setCenterPackages] = useState<any[]>([]);

  useEffect(() => {
    const loadPackages = async () => {
      try {
        if (isSupabaseConfigured() && supabase) {
          try {
            const { data, error } = await supabase.from('center_packages').select('*');
            if (error) throw error;
            if (data && data.length > 0) {
              setCenterPackages(data.map(row => ({
                id: row.id,
                title: row.title,
                price: Number(row.price || 0),
                sessionCount: Number(row.session_count || 0),
                centerId: row.center_id,
                createdAt: row.timestamp,
              })));
            } else {
              const snap = await getDocs(collection(db, 'center_packages'));
              setCenterPackages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }
          } catch (sErr) {
            console.warn('⚡ [CenterStudentsTab] Fetching packages from Supabase failed, fell back to Firestore:', sErr);
            const snap = await getDocs(collection(db, 'center_packages'));
            setCenterPackages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        } else {
          const snap = await getDocs(collection(db, 'center_packages'));
          setCenterPackages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.error('Error loading packages inside students tab:', err);
      }
    };
    loadPackages();
  }, []);

  // Registration Form
  const [regForm, setRegForm] = useState({
    displayName: '',
    studentPhone: '',
    fatherPhone: '',
    motherPhone: '',
    schoolName: '',
    grade: 'sec3',
    centerId: '',
    groupId: '',
    packageId: '',
    paymentOption: 'paid',
    amountPaid: '0',
  });
  const [regStatus, setRegStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string; code?: string }>({
    type: 'idle',
    message: '',
  });

  // Edit Form State
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: '',
    studentPhone: '',
    fatherPhone: '',
    motherPhone: '',
    schoolName: '',
    grade: 'sec3',
    centerId: '',
    groupId: '',
    packageId: '',
    packageName: '',
    remainingSessions: '0',
    pointsBalance: '0',
    subscriptionType: 'sessions',
    subscriptionEndDate: '',
  });

  // Set default center/group in registration form
  useEffect(() => {
    if (centers.length > 0 && !regForm.centerId) {
      setRegForm((prev) => ({ ...prev, centerId: centers[0].id }));
    }
  }, [centers, regForm.centerId]);

  // Update regForm groupId options when centerId changes
  useEffect(() => {
    const centerGroups = groups.filter((g) => g.centerId === regForm.centerId);
    if (centerGroups.length > 0) {
      setRegForm((prev) => ({ ...prev, groupId: centerGroups[0].id }));
    } else {
      setRegForm((prev) => ({ ...prev, groupId: '' }));
    }
  }, [regForm.centerId, groups]);

  // Update editForm groupId options when edit centerId changes
  useEffect(() => {
    if (editingStudent) {
      const centerGroups = groups.filter((g) => g.centerId === editForm.centerId);
      if (centerGroups.length > 0 && !centerGroups.some((g) => g.id === editForm.groupId)) {
        setEditForm((prev) => ({ ...prev, groupId: centerGroups[0].id }));
      }
    }
  }, [editForm.centerId, groups, editingStudent, editForm.groupId]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('⚡ [CenterStudentsTab] handleRegisterSubmit started! Form State:', regForm);
    if (!regForm.displayName.trim() || !regForm.fatherPhone.trim() || !regForm.centerId || !regForm.groupId) {
      const errorMsg = `يرجى ملء الحقول المطلوبة. البيانات الحالية: الاسم=${regForm.displayName.trim()}, هاتف الأب=${regForm.fatherPhone.trim()}, السنتر=${regForm.centerId}, المجموعة=${regForm.groupId}`;
      console.warn('⚡ [CenterStudentsTab] Validation failed:', errorMsg);
      setRegStatus({ type: 'error', message: 'يرجى ملء الحقول المطلوبة (الاسم، هاتف الأب، السنتر والمجموعة)' });
      return;
    }

    setLoading(true);
    setRegStatus({ type: 'idle', message: 'جاري تسجيل الطالب...' });

    try {
      // Find current max sequential counter for student ID
      const currentYear = new Date().getFullYear();
      const yearStr = String(currentYear);
      let maxCounter = 0;

      allCenterStudents.forEach((stu) => {
        if (stu.studentId && stu.studentId.startsWith(yearStr)) {
          const counterPart = parseInt(stu.studentId.replace(yearStr, ''));
          if (!isNaN(counterPart) && counterPart > maxCounter) {
            maxCounter = counterPart;
          }
        }
      });

      const newStudentCode = yearStr + String(maxCounter + 1).padStart(3, '0');
      const mockEmail = `stu-${newStudentCode}-${Math.floor(Math.random() * 1000)}@center.com`;

      let stage = 'secondary';
      if (regForm.grade.includes('pri')) stage = 'primary';
      else if (regForm.grade.includes('prep')) stage = 'prep';

      // Package details
      let selectedPack: any = null;
      let packageFields: any = {};
      const amountPaidNum = Number(arabicToEnglishNumbers(regForm.amountPaid || '0'));

      if (regForm.packageId) {
        selectedPack = centerPackages.find(p => p.id === regForm.packageId);
        if (selectedPack) {
          const isMonthly = selectedPack.sessionCount === 0;
          const todayStr = new Date().toISOString().split('T')[0];
          
          // Calculate 30 days from today
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30);
          const expiryStr = expiryDate.toISOString().split('T')[0];

          packageFields = {
            packageId: regForm.packageId,
            packageName: selectedPack.title,
            packagePrice: selectedPack.price,
            remainingSessions: isMonthly ? 0 : (selectedPack.sessionCount || 0),
            subscriptionType: isMonthly ? 'monthly' : 'sessions',
            subscriptionStartDate: todayStr,
            subscriptionEndDate: isMonthly ? expiryStr : '',
            packageStatus: 'active',
            pointsBalance: 0,
          };
        }
      } else {
        packageFields = {
          pointsBalance: 0,
          subscriptionType: 'sessions',
          remainingSessions: 0,
        };
      }

      const newStudentDoc = {
        displayName: regForm.displayName.trim(),
        email: mockEmail,
        role: 'student' as const,
        studentType: 'center' as const,
        centerId: regForm.centerId,
        groupId: regForm.groupId,
        studentPhone: regForm.studentPhone.trim(),
        fatherPhone: regForm.fatherPhone.trim(),
        motherPhone: regForm.motherPhone.trim(),
        schoolName: regForm.schoolName.trim(),
        grade: regForm.grade,
        level: stage,
        studentId: newStudentCode,
        createdAt: new Date().toISOString(),
        ...packageFields,
      };

      const studentUid = await dbRouter.createStudent(newStudentDoc as any);

      // Record payments in center_payments
      if (selectedPack) {
        if (amountPaidNum > 0) {
          const paymentDocId = `payment_${studentUid}_${Date.now()}`;
          if (isSupabaseConfigured() && supabase) {
            await supabase.from('center_payments').insert({
              id: paymentDocId,
              student_uid: studentUid,
              student_name: regForm.displayName.trim(),
              student_id: newStudentCode,
              title: `اشتراك باقة: ${selectedPack.title}`,
              type: 'subscription',
              amount: amountPaidNum,
              status: 'paid',
              date: new Date().toISOString().split('T')[0],
              remarks: 'شحن رصيد الباقة مدفوع عند التسجيل',
              timestamp: new Date().toISOString(),
            });
          } else {
            await setDoc(doc(db, 'center_payments', paymentDocId), {
              studentUid,
              studentName: regForm.displayName.trim(),
              studentId: newStudentCode,
              title: `اشتراك باقة: ${selectedPack.title}`,
              type: 'subscription',
              amount: amountPaidNum,
              status: 'paid',
              date: new Date().toISOString().split('T')[0],
              remarks: 'شحن رصيد الباقة مدفوع عند التسجيل',
              timestamp: serverTimestamp(),
            });
          }
        }

        const outstanding = selectedPack.price - amountPaidNum;
        if (outstanding > 0) {
          const pendingPaymentDocId = `payment_inst_${studentUid}_${Date.now()}`;
          if (isSupabaseConfigured() && supabase) {
            await supabase.from('center_payments').insert({
              id: pendingPaymentDocId,
              student_uid: studentUid,
              student_name: regForm.displayName.trim(),
              student_id: newStudentCode,
              title: `قسط متبقي باقة: ${selectedPack.title}`,
              type: 'installment',
              amount: outstanding,
              status: 'pending',
              date: new Date().toISOString().split('T')[0],
              remarks: 'قسط متبقي من شحن الباقة عند التسجيل',
              timestamp: new Date().toISOString(),
            });
          } else {
            await setDoc(doc(db, 'center_payments', pendingPaymentDocId), {
              studentUid,
              studentName: regForm.displayName.trim(),
              studentId: newStudentCode,
              title: `قسط متبقي باقة: ${selectedPack.title}`,
              type: 'installment',
              amount: outstanding,
              status: 'pending',
              date: new Date().toISOString().split('T')[0],
              remarks: 'قسط متبقي من شحن الباقة عند التسجيل',
              timestamp: serverTimestamp(),
            });
          }
        }
      }

      setRegStatus({
        type: 'success',
        message: `تم تسجيل الطالب بنجاح! الكود الرقمي السهل: ${newStudentCode}`,
        code: newStudentCode,
      });

      // Clear Form except center/group
      setRegForm((prev) => ({
        ...prev,
        displayName: '',
        studentPhone: '',
        fatherPhone: '',
        motherPhone: '',
        schoolName: '',
        packageId: '',
        paymentOption: 'paid',
        amountPaid: '0',
      }));

      refreshData();
    } catch (err: any) {
      console.error('Error registering center student:', err);
      setRegStatus({ type: 'error', message: err.message || 'فشل التسجيل في قاعدة البيانات' });
      window.alert('حدث خطأ أثناء تسجيل الطالب:\n' + (err.stack || err.message || err.toString()));
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (student: Student) => {
    setEditingStudent(student);
    setEditForm({
      displayName: student.displayName || '',
      studentPhone: student.studentPhone || '',
      fatherPhone: student.fatherPhone || '',
      motherPhone: student.motherPhone || '',
      schoolName: student.schoolName || '',
      grade: student.grade || 'sec3',
      centerId: student.centerId || '',
      groupId: student.groupId || '',
      packageId: (student as any).packageId || '',
      packageName: (student as any).packageName || '',
      remainingSessions: String((student as any).remainingSessions ?? 0),
      pointsBalance: String((student as any).pointsBalance ?? 0),
      subscriptionType: (student as any).subscriptionType || 'sessions',
      subscriptionEndDate: (student as any).subscriptionEndDate || '',
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editForm.displayName.trim() || !editForm.fatherPhone.trim() || !editForm.centerId || !editForm.groupId) {
      alert('يرجى ملء الحقول المطلوبة (الاسم، هاتف الأب، السنتر والمجموعة)');
      return;
    }

    setLoading(true);
    try {
      let stage = 'secondary';
      if (editForm.grade.includes('pri')) stage = 'primary';
      else if (editForm.grade.includes('prep')) stage = 'prep';

      await dbRouter.updateStudent(editingStudent.uid, {
        displayName: editForm.displayName.trim(),
        studentPhone: editForm.studentPhone.trim(),
        fatherPhone: editForm.fatherPhone.trim(),
        motherPhone: editForm.motherPhone.trim(),
        schoolName: editForm.schoolName.trim(),
        grade: editForm.grade,
        level: stage,
        centerId: editForm.centerId,
        groupId: editForm.groupId,
        packageId: editForm.packageId,
        packageName: editForm.packageName,
        remainingSessions: Number(editForm.remainingSessions) || 0,
        pointsBalance: Number(editForm.pointsBalance) || 0,
        subscriptionType: editForm.subscriptionType as any,
        subscriptionEndDate: editForm.subscriptionEndDate,
      });

      setEditingStudent(null);
      refreshData();
      alert('تم تحديث بيانات الطالب بنجاح');
    } catch (err: any) {
      console.error('Error updating student:', err);
      alert('حدث خطأ أثناء تعديل بيانات الطالب');
      window.alert('حدث خطأ أثناء تعديل بيانات الطالب:\n' + (err.stack || err.message || err.toString()));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return;

    setLoading(true);
    try {
      await dbRouter.deleteStudent(studentToDelete.uid);
      setStudentToDelete(null);
      refreshData();
      alert('تم حذف الطالب بنجاح');
    } catch (err: any) {
      console.error('Error deleting student:', err);
      alert('فشل حذف الطالب من النظام');
    } finally {
      setLoading(false);
    }
  };

  const getStudentCode = (s: any): string => {
    if (!s) return '';
    const code = s.studentId || s.student_id || s.studentCode || s.student_code || s.code;
    if (code && code !== 'undefined' && code !== 'null') return code;
    return s.uid ? String(s.uid).replace(/[^0-9]/g, '').slice(-5) : '0000';
  };

  const handlePrintFilteredStudentsCards = () => {
    if (filteredStudents.length === 0) {
      alert('لا يوجد طلاب معروضين للطباعة حالياً');
      return;
    }
    const cardData = filteredStudents.map(s => {
      const groupObj = groups.find(g => g.id === s.groupId);
      const centerObj = centers.find(c => c.id === s.centerId);
      return {
        displayName: s.displayName,
        studentId: getStudentCode(s),
        grade: s.grade,
        level: s.level,
        groupName: groupObj ? groupObj.name : 'غير محدد',
        centerName: centerObj ? centerObj.name : 'غير محدد',
      };
    });
    studentCardService.printStudentCards(cardData, 'طلاب مصفين', settings.siteName || 'المنصة التعليمية');
  };

  const handlePrintSingleStudentCard = (s: Student) => {
    const groupObj = groups.find(g => g.id === s.groupId);
    const centerObj = centers.find(c => c.id === s.centerId);
    const cardData = [{
      displayName: s.displayName,
      studentId: getStudentCode(s),
      grade: s.grade,
      level: s.level,
      groupName: groupObj ? groupObj.name : 'غير محدد',
      centerName: centerObj ? centerObj.name : 'غير محدد',
    }];
    studentCardService.printStudentCards(cardData, s.displayName, settings.siteName || 'المنصة التعليمية');
  };

  // Filtered & Searched Students
  const filteredStudents = allCenterStudents.filter((stu) => {
    // 1. Search Query
    const queryLower = searchQuery.toLowerCase().trim();
    const cleanQuery = arabicToEnglishNumbers(queryLower);
    const matchesSearch =
      !cleanQuery ||
      (stu.displayName && stu.displayName.toLowerCase().includes(cleanQuery)) ||
      (stu.studentId && stu.studentId.includes(cleanQuery)) ||
      (stu.studentPhone && cleanPhone(stu.studentPhone).includes(cleanQuery)) ||
      (stu.fatherPhone && cleanPhone(stu.fatherPhone).includes(cleanQuery)) ||
      (stu.motherPhone && cleanPhone(stu.motherPhone).includes(cleanQuery));

    // 2. Filters
    const matchesCenter = !filterCenterId || stu.centerId === filterCenterId;
    const matchesGroup = !filterGroupId || stu.groupId === filterGroupId;
    const matchesGrade = !filterGrade || stu.grade === filterGrade;

    return matchesSearch && matchesCenter && matchesGroup && matchesGrade;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset page when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCenterId, filterGroupId, filterGrade]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Registration Panel */}
      <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl backdrop-blur-md shadow-xl h-fit space-y-6">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center border border-amber-500/20">
            <UserPlus size={20} />
          </span>
          <div>
            <h3 className="text-sm font-black text-white">تسجيل طالب جديد بالسنتر</h3>
            <p className="text-[10px] text-gray-500 font-bold">تسجيل فوري لبيانات الطالب وتوليد كود الحضور</p>
          </div>
        </div>

        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <StudentFormFields
            formData={regForm}
            onChange={(field, val) => setRegForm((prev) => ({ ...prev, [field]: val }))}
            centers={centers}
            groups={groups}
            disabled={loading}
          />

          {/* Subscriptions & Packages (New Student Registration Only) */}
          <div className="bg-black/25 p-4 rounded-2xl border border-white/5 space-y-3.5">
            <span className="text-[10px] font-black text-amber-500 block border-b border-white/5 pb-1.5">
              باقات اشتراك السنتر وخطة الدفع
            </span>
            
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400 font-bold">باقة اشتراك الطالب</label>
              <select
                value={regForm.packageId}
                onChange={(e) => {
                  const val = e.target.value;
                  const selectedPack = centerPackages.find(p => p.id === val);
                  setRegForm(prev => ({
                    ...prev,
                    packageId: val,
                    amountPaid: selectedPack ? String(selectedPack.price) : '0',
                    paymentOption: 'paid'
                  }));
                }}
                disabled={loading}
                className="w-full px-4 py-2 bg-[#080d19]/80 border border-white/10 rounded-xl focus:border-amber-500/30 text-xs text-white outline-none cursor-pointer font-bold"
              >
                <option value="" className="bg-[#0b0f19] text-gray-400">بدون باقة (شحن رصيد صفر / دفع مفرد)</option>
                {centerPackages.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0b0f19] text-white">
                    {p.title} ({p.price} ج.م - {p.sessionCount} حصص)
                  </option>
                ))}
              </select>
            </div>

            {regForm.packageId && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold">خطة الدفع</label>
                  <select
                    value={regForm.paymentOption}
                    onChange={(e) => {
                      const opt = e.target.value;
                      const selectedPack = centerPackages.find(p => p.id === regForm.packageId);
                      setRegForm(prev => ({
                        ...prev,
                        paymentOption: opt,
                        amountPaid: opt === 'paid' ? String(selectedPack?.price || 0) : opt === 'unpaid' ? '0' : prev.amountPaid
                      }));
                    }}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-[#080d19]/80 border border-white/10 rounded-xl focus:border-amber-500/30 text-xs text-white outline-none cursor-pointer font-bold"
                  >
                    <option value="paid" className="bg-[#0b0f19] text-white">مدفوع بالكامل</option>
                    <option value="installment" className="bg-[#0b0f19] text-white">قسط / دفع جزئي</option>
                    <option value="unpaid" className="bg-[#0b0f19] text-white">غير مدفوع / مستحقة</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold">المبلغ المدفوع الآن</label>
                  <input
                    type="number"
                    disabled={loading || regForm.paymentOption === 'paid' || regForm.paymentOption === 'unpaid'}
                    value={regForm.amountPaid}
                    onChange={(e) => setRegForm(prev => ({ ...prev, amountPaid: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-[#080d19]/80 border border-white/10 rounded-xl focus:border-amber-500/30 text-xs text-white outline-none font-bold disabled:opacity-50"
                  />
                </div>
              </div>
            )}
          </div>

          {regStatus.type !== 'idle' && (
            <div
              className={`p-4 rounded-2xl border text-xs font-bold leading-relaxed flex items-start gap-2 ${
                regStatus.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                  : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>{regStatus.message}</p>
                {regStatus.code && (
                  <div className="flex gap-2 items-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newStu = allCenterStudents.find((s) => s.studentId === regStatus.code);
                        if (newStu) handlePrintSingleStudentCard(newStu);
                      }}
                      className="px-3 py-1 bg-emerald-500 text-slate-950 font-black text-[10px] rounded-lg shadow hover:opacity-90 flex items-center gap-1 cursor-pointer"
                    >
                      <Printer size={10} />
                      <span>طباعة كارت الطالب فوراً</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <UserCheck size={16} />
            )}
            <span>تسجيل وتأكيد الطالب</span>
          </button>
        </form>
      </div>

      {/* Directory List Panel */}
      <div className="lg:col-span-2 space-y-6">
        {/* Search & Filters */}
        <div className="bg-white/[0.02] border border-white/5 p-5 rounded-3xl backdrop-blur-md shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 right-4 flex items-center text-gray-500">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الطالب، الكود، أو رقم الهاتف..."
                className="w-full pr-12 pl-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl focus:border-amber-500/30 text-xs text-white focus:outline-none transition-all font-bold"
              />
            </div>

            {/* Quick Stats count badge */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-center flex items-center justify-center gap-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase">النتائج:</span>
                <span className="text-xs font-black text-amber-500">{filteredStudents.length} طالب</span>
              </div>
              
              {filteredStudents.length > 0 && (
                <button
                  type="button"
                  onClick={handlePrintFilteredStudentsCards}
                  className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 hover:text-slate-950 text-emerald-400 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                  title="طباعة كروت الهوية لجميع الطلاب المعروضين حالياً"
                >
                  <Printer size={12} />
                  <span>طباعة كروت التصفية</span>
                </button>
              )}
            </div>
          </div>

          {/* Advanced filters toggler */}
          <div className="flex flex-wrap gap-3 pt-2">
            {/* Center Filter */}
            <select
              value={filterCenterId}
              onChange={(e) => {
                setFilterCenterId(e.target.value);
                setFilterGroupId('');
              }}
              className="px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs text-white focus:outline-none transition-all cursor-pointer font-bold"
            >
              <option value="" className="bg-[#0b0f19] text-gray-400">كل السناتر</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0b0f19] text-white">
                  {c.name}
                </option>
              ))}
            </select>

            {/* Group Filter */}
            <select
              value={filterGroupId}
              onChange={(e) => setFilterGroupId(e.target.value)}
              disabled={!filterCenterId}
              className="px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs text-white focus:outline-none transition-all cursor-pointer font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" className="bg-[#0b0f19] text-gray-400">كل المجموعات</option>
              {groups
                .filter((g) => g.centerId === filterCenterId)
                .map((g) => (
                  <option key={g.id} value={g.id} className="bg-[#0b0f19] text-white">
                    {g.name}
                  </option>
                ))}
            </select>

            {/* Grade Filter */}
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl text-xs text-white focus:outline-none transition-all cursor-pointer font-bold"
            >
              <option value="" className="bg-[#0b0f19] text-gray-400">كل الصفوف</option>
              <option value="sec1" className="bg-[#0b0f19] text-white">الصف الأول الثانوي</option>
              <option value="sec2" className="bg-[#0b0f19] text-white">الصف الثاني الثانوي</option>
              <option value="sec3" className="bg-[#0b0f19] text-white">الصف الثالث الثانوي</option>
            </select>
          </div>
        </div>

        {/* Student list */}
        {paginatedStudents.length === 0 ? (
          <EmptyState
            icon={Search}
            title="لم نجد أي نتائج مطابقة"
            description="يرجى كتابة كلمات بحث مختلفة أو تغيير الفلاتر للحصول على نتائج."
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedStudents.map((stu) => {
                const groupName = groups.find((g) => g.id === stu.groupId)?.name || 'غير محددة';
                const centerName = centers.find((c) => c.id === stu.centerId)?.name || 'غير محدد';
                const initialChar = (stu.displayName || 'ط').trim().charAt(0);

                return (
                  <div
                    key={stu.uid}
                    className="p-5 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-md flex flex-col justify-between hover:border-amber-500/20 transition-all duration-300 shadow-lg relative group"
                  >
                    <div className="space-y-4">
                      {/* Card Header info */}
                      <div className="flex gap-3 items-center">
                        {/* Avatar placeholder with first letter gradient */}
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/10 to-orange-500/20 border border-amber-500/20 flex items-center justify-center text-amber-500 font-black text-sm shrink-0">
                          {initialChar}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-black text-white truncate">{stu.displayName}</h4>
                          <span className="text-[9px] text-amber-400 font-bold block mt-0.5">الكود الرقمي: {getStudentCode(stu)}</span>
                        </div>
                      </div>

                      {/* Details row info */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 font-bold border-t border-white/5 pt-3">
                        <div className="flex items-center gap-1.5 truncate">
                          <Building size={12} className="text-gray-500 shrink-0" />
                          <span>{centerName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <FolderOpen size={12} className="text-gray-500 shrink-0" />
                          <span>{groupName}</span>
                        </div>
                        <div className="col-span-2 text-[9px] text-gray-500 font-bold">
                          الصف: {getGradeLabel(stu.grade)}
                        </div>
                      </div>
                    </div>

                    {/* Actions row */}
                    <div className="flex gap-2 justify-end border-t border-white/5 mt-4 pt-3">
                      <button
                        onClick={() => setViewingProfileStudent(stu)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        الملف الكامل
                      </button>
                      <button
                        onClick={() => handlePrintSingleStudentCard(stu)}
                        className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-slate-950 rounded-lg transition-all cursor-pointer"
                        title="طباعة كارت الطالب"
                      >
                        <QrCode size={14} />
                      </button>
                      <button
                        onClick={() => handleEditClick(stu)}
                        className="p-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500 hover:text-white rounded-lg transition-all cursor-pointer"
                        title="تعديل بيانات الطالب"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setStudentToDelete(stu)}
                        className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all cursor-pointer"
                        title="حذف الطالب نهائياً"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-6 border-t border-white/5">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
                <div className="text-xs font-bold text-gray-400">
                  صفحة <span className="text-white">{currentPage}</span> من <span className="text-white">{totalPages}</span>
                </div>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide Panel for Edit Student */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
          {/* Backdrop overlay */}
          <div onClick={() => setEditingStudent(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          {/* Form Content panel */}
          <div className="relative w-full max-w-4xl bg-[#0a0f1d] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-right" dir="rtl">
            {/* Header (Fixed) */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#0a0f1d] z-10 shrink-0">
              <h3 className="text-sm font-black text-white">تعديل بيانات الطالب بالسنتر</h3>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Form Fields */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <form onSubmit={handleEditSubmit} id="edit-student-form" className="space-y-6">
                <StudentFormFields
                  formData={editForm}
                  onChange={(field, val) => setEditForm((prev) => ({ ...prev, [field]: val }))}
                  centers={centers}
                  groups={groups}
                  disabled={loading}
                />

                {/* Editable package info */}
                <div className="bg-black/25 p-4 rounded-2xl border border-white/5 space-y-3 pt-3">
                  <span className="text-[10px] font-black text-pink-500 block border-b border-white/5 pb-1.5">
                    تفاصيل باقة الاشتراك ونقاط الطالب
                  </span>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-bold">باقة الاشتراك</label>
                    <select
                      value={editForm.packageId}
                      onChange={(e) => {
                        const val = e.target.value;
                        const selectedPack = centerPackages.find(p => p.id === val);
                        setEditForm(prev => ({
                          ...prev,
                          packageId: val,
                          packageName: selectedPack ? selectedPack.title : '',
                          remainingSessions: selectedPack ? String(selectedPack.sessionCount || 0) : '0',
                          subscriptionType: selectedPack ? (selectedPack.sessionCount === 0 ? 'monthly' : 'sessions') : 'sessions',
                        }));
                      }}
                      disabled={loading}
                      className="w-full px-4 py-2 bg-[#080d19]/80 border border-white/10 rounded-xl text-xs text-white outline-none cursor-pointer font-bold focus:border-pink-500/30"
                    >
                      <option value="" className="bg-[#0b0f19] text-gray-400">بدون باقة نشطة</option>
                      {centerPackages.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#0b0f19] text-white">
                          {p.title} ({p.price} ج.م - {p.sessionCount} حصص)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-400 font-bold">نوع الاشتراك</label>
                      <select
                        value={editForm.subscriptionType}
                        onChange={(e) => setEditForm(prev => ({ ...prev, subscriptionType: e.target.value }))}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-[#080d19]/80 border border-white/10 rounded-xl text-xs text-white outline-none cursor-pointer font-bold focus:border-pink-500/30"
                      >
                        <option value="sessions" className="bg-[#0b0f19] text-white">باقة عدد حصص</option>
                        <option value="monthly" className="bg-[#0b0f19] text-white">اشتراك شهري (بالتواريخ)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-400 font-bold">الحصص المتبقية</label>
                      <input
                        type="number"
                        disabled={loading || editForm.subscriptionType === 'monthly'}
                        value={editForm.remainingSessions}
                        onChange={(e) => setEditForm(prev => ({ ...prev, remainingSessions: e.target.value }))}
                        className="w-full px-4 py-2 bg-[#080d19]/80 border border-white/10 rounded-xl text-xs text-white outline-none font-bold disabled:opacity-50 focus:border-pink-500/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-400 font-bold">تاريخ انتهاء الاشتراك</label>
                      <input
                        type="date"
                        disabled={loading || editForm.subscriptionType !== 'monthly'}
                        value={editForm.subscriptionEndDate}
                        onChange={(e) => setEditForm(prev => ({ ...prev, subscriptionEndDate: e.target.value }))}
                        className="w-full px-4 py-2 bg-[#080d19]/80 border border-white/10 rounded-xl text-xs text-white outline-none font-bold disabled:opacity-50 focus:border-pink-500/30"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-400 font-bold">نقاط تميز الطالب</label>
                      <input
                        type="number"
                        disabled={loading}
                        value={editForm.pointsBalance}
                        onChange={(e) => setEditForm(prev => ({ ...prev, pointsBalance: e.target.value }))}
                        className="w-full px-4 py-2 bg-[#080d19]/80 border border-white/10 rounded-xl text-xs text-white outline-none font-bold focus:border-pink-500/30"
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer (Fixed) */}
            <div className="p-6 border-t border-white/10 flex gap-3 justify-end bg-[#0a0f1d] z-10 shrink-0">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="edit-student-form"
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-teal-500 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Profile Modal */}
      {viewingProfileStudent && (
        <CenterStudentProfileModal
          student={viewingProfileStudent}
          centers={centers}
          groups={groups}
          onClose={() => setViewingProfileStudent(null)}
        />
      )}

      {/* Confirm Student Delete Modal */}
      <ConfirmModal
        isOpen={studentToDelete !== null}
        title="تأكيد حذف الطالب نهائياً"
        message={`هل أنت متأكد تماماً من حذف الطالب "${studentToDelete?.displayName}" نهائياً من النظام؟ سيتم إزالة ملف الطالب وحذف جميع سجلاته كلياً من قاعدة البيانات.`}
        confirmText="حذف نهائي"
        cancelText="تراجع"
        type="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setStudentToDelete(null)}
      />
    </div>
  );
};
