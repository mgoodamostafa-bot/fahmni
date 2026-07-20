import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Printer,
  ChevronLeft,
  LayoutDashboard,
  Users,
  CheckSquare,
  Star,
  Trophy,
  Coins,
  TrendingDown,
  UserCog,
  Gift,
} from 'lucide-react';
import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { mapStudentToSql } from '../../services/dbRouter';
import { useSettings } from '../../contexts/SettingsContext';
import { useCenterData, Student } from '../../hooks/useCenterData';
import { CenterOverviewTab } from './center/CenterOverviewTab';
import { CenterStudentsTab } from './center/CenterStudentsTab';
import { CenterAttendanceTab } from './center/CenterAttendanceTab';
import { CenterEvaluationsTab } from './center/CenterEvaluationsTab';
import { CenterFinancialsTab } from './center/CenterFinancialsTab';
import { OfflineResults } from './OfflineResults';
import { CenterExpensesTab } from './center/CenterExpensesTab';
import { CenterAssistantsTab } from './center/CenterAssistantsTab';
import { StoreManagementTab } from './center/StoreManagementTab';

import {
  parseCSV,
  generateCSV,
  downloadCSV,
  downloadJSON,
  parseCSVLine,
} from '../../utils/csvParser';
import { getGradeLabel } from '../../utils/arabicUtils';

type TabType = 'overview' | 'directory' | 'attendance' | 'evaluations' | 'financials' | 'offline-results' | 'expenses' | 'assistants';

export const CenterStudentsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [selectedCardStudent, setSelectedCardStudent] = useState<Student | null>(null);

  const {
    centers,
    groups,
    allCenterStudents,
    loading: loadingData,
    refreshData,
  } = useCenterData();

  // Export JSON backups
  const handleExportJSON = async (type: 'students' | 'attendance' | 'evaluations' | 'payments') => {
    try {
      const collectionName =
        type === 'students'
          ? 'center_students'
          : type === 'attendance'
          ? 'attendance'
          : type === 'evaluations'
          ? 'evaluations'
          : 'center_payments';

      let snap;
      if (type === 'students') {
        const list = allCenterStudents;
        const dateStr = new Date().toISOString().split('T')[0];
        downloadJSON(list, `${type}_backup_${dateStr}`);
        return;
      } else {
        snap = await getDocs(collection(db, collectionName));
      }

      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const dateStr = new Date().toISOString().split('T')[0];
      downloadJSON(list, `${type}_backup_${dateStr}`);
    } catch (err) {
      console.error(err);
      alert('فشل تصدير البيانات بصيغة JSON');
    }
  };

  // Import JSON backups
  const handleImportJSON = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'students' | 'attendance' | 'evaluations' | 'payments'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!Array.isArray(parsed)) {
          alert('الملف غير متوافق، يجب أن يحتوي على مصفوفة بيانات.');
          return;
        }

        setImportStatus(`جاري استيراد ${parsed.length} سجل... يرجى الانتظار`);
        let count = 0;

        if (type === 'students') {
          if (isSupabaseConfigured() && supabase) {
            const sqlRows = parsed.map((item, idx) => {
              const cleanItem = { ...item };
              const uid = cleanItem.uid || `center_student_${Date.now()}_${idx}`;
              cleanItem.uid = uid;
              return mapStudentToSql(cleanItem);
            });
            const { error } = await supabase.from('center_students').upsert(sqlRows);
            if (error) throw error;
            count = sqlRows.length;
          } else {
            const batch = writeBatch(db);
            let localCount = 0;
            for (const item of parsed) {
              const docId = item.uid || `center_student_${Date.now()}_${localCount}`;
              const cleanItem = { ...item };
              delete cleanItem.uid;
              batch.set(doc(db, 'center_students', docId), cleanItem, { merge: true });
              localCount++;
            }
            await batch.commit();
            count = localCount;
          }
        } else {
          const batch = writeBatch(db);
          for (const item of parsed) {
            if (type === 'attendance') {
              const docId = item.id || `${item.studentUid}_${item.date}`;
              const cleanItem = { ...item };
              delete cleanItem.id;
              batch.set(doc(db, 'attendance', docId), cleanItem, { merge: true });
            } else if (type === 'evaluations') {
              const docId = item.id || `${item.studentUid}_${item.date}`;
              const cleanItem = { ...item };
              delete cleanItem.id;
              batch.set(doc(db, 'evaluations', docId), cleanItem, { merge: true });
            } else if (type === 'payments') {
              const docId = item.id || `payment_${item.studentUid}_${Date.now()}_${count}`;
              const cleanItem = { ...item };
              delete cleanItem.id;
              batch.set(doc(db, 'center_payments', docId), cleanItem, { merge: true });
            }
            count++;
          }
          await batch.commit();
        }

        alert(`تم استيراد عدد ${count} من السجلات بنجاح!`);
        refreshData();
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء قراءة أو رفع البيانات. تأكد من أن تنسيق JSON صحيح.');
      } finally {
        setImportStatus(null);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Export CSV
  const handleExportCSV = async (type: 'students' | 'attendance' | 'evaluations' | 'payments') => {
    try {
      if (type === 'students') {
        const headers = ['اسم الطالب', 'كود الطالب', 'رقم الهاتف', 'هاتف ولي الأمر', 'السنتر', 'المجموعة', 'تاريخ التسجيل'];
        const rows = allCenterStudents.map((stu) => [
          stu.displayName || '',
          stu.studentId || '',
          stu.studentPhone || '',
          stu.fatherPhone || '',
          centers.find((c) => c.id === stu.centerId)?.name || 'غير محدد',
          groups.find((g) => g.id === stu.groupId)?.name || 'غير محدد',
          stu.createdAt ? new Date(stu.createdAt).toISOString().split('T')[0] : '',
        ]);
        downloadCSV(headers, rows, `كشف_الطلاب_الرقمي_${new Date().toISOString().split('T')[0]}`);
      } else if (type === 'attendance') {
        const snap = await getDocs(collection(db, 'attendance'));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        const headers = ['اسم الطالب', 'كود الطالب', 'السنتر', 'المجموعة', 'التاريخ', 'الحالة'];
        const rows = list.map((rec) => [
          rec.studentName || '',
          rec.studentId || '',
          centers.find((c) => c.id === rec.centerId)?.name || 'غير محدد',
          groups.find((g) => g.id === rec.groupId)?.name || 'غير محدد',
          rec.date || '',
          rec.status === 'present' ? 'حاضر' : rec.status === 'absent' ? 'غائب' : 'مستثنى',
        ]);
        downloadCSV(headers, rows, `سجلات_الحضور_${new Date().toISOString().split('T')[0]}`);
      } else if (type === 'evaluations') {
        const snap = await getDocs(collection(db, 'evaluations'));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        const headers = ['اسم الطالب', 'كود الطالب', 'التاريخ', 'درجة الامتحان', 'الدرجة الكلية', 'حالة الواجب', 'ملاحظات المعلم'];
        const rows = list.map((rec) => [
          rec.studentName || '',
          rec.studentId || '',
          rec.date || '',
          rec.quizGrade !== undefined ? rec.quizGrade : '',
          rec.quizTotal !== undefined ? rec.quizTotal : '10',
          rec.homeworkStatus || '',
          rec.teacherRemarks || '',
        ]);
        downloadCSV(headers, rows, `سجلات_التقييمات_${new Date().toISOString().split('T')[0]}`);
      } else if (type === 'payments') {
        const snap = await getDocs(collection(db, 'center_payments'));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        const headers = ['اسم الطالب', 'كود الطالب', 'البيان', 'نوع الفاتورة', 'المبلغ المدفوع', 'تاريخ الفاتورة', 'الملاحظات'];
        const rows = list.map((rec) => [
          rec.studentName || '',
          rec.studentId || '',
          rec.title || '',
          rec.type === 'booklet' ? 'ملزمة' : rec.type === 'installment' ? 'قسط' : 'اشتراك شهري',
          rec.amount || 0,
          rec.date || '',
          rec.remarks || '',
        ]);
        downloadCSV(headers, rows, `سجلات_الماليات_${new Date().toISOString().split('T')[0]}`);
      }
    } catch (e) {
      alert('فشل تصدير كشف CSV');
    }
  };

  // Import CSV
  const handleImportCSV = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'students' | 'attendance' | 'evaluations' | 'payments'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('جاري تحليل ملف CSV...');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const { rows } = parseCSV(text);

        if (rows.length === 0) {
          alert('الملف فارغ أو غير صحيح');
          return;
        }

        let count = 0;
        const currentYear = new Date().getFullYear();
        const yearStr = String(currentYear);

        if (type === 'students') {
          let maxCounter = allCenterStudents.length;

          if (isSupabaseConfigured() && supabase) {
            const sqlRows = [];
            for (const row of rows) {
              if (row.length < 4) continue;
              const nameVal = row[0];
              let codeVal = row[1];
              const phoneVal = row[2];
              const fatherPhoneVal = row[3];
              const centerNameVal = row[4] || '';
              const groupNameVal = row[5] || '';

              if (!nameVal || !fatherPhoneVal) continue;

              const centerId = centers.find((c) => c.name.includes(centerNameVal))?.id || centers[0]?.id || '';
              const groupId =
                groups.find((g) => g.name.includes(groupNameVal) && g.centerId === centerId)?.id ||
                groups.filter((g) => g.centerId === centerId)[0]?.id ||
                '';

              if (!codeVal || codeVal === 'بدون كود' || /[A-Za-z]/.test(codeVal)) {
                maxCounter++;
                codeVal = yearStr + String(maxCounter).padStart(3, '0');
              }

              const existing = allCenterStudents.find((d) => d.studentId === codeVal);
              if (existing) continue;

              const studentUid = `center_student_${Date.now()}_${Math.random()}`;
              sqlRows.push(mapStudentToSql({
                uid: studentUid,
                displayName: nameVal,
                studentId: codeVal,
                studentPhone: phoneVal,
                fatherPhone: fatherPhoneVal,
                centerId,
                groupId,
                role: 'student',
                studentType: 'center',
                createdAt: new Date().toISOString(),
              }));
              count++;
            }
            if (sqlRows.length > 0) {
              const { error } = await supabase.from('center_students').insert(sqlRows);
              if (error) throw error;
            }
          } else {
            const batch = writeBatch(db);
            for (const row of rows) {
              if (row.length < 4) continue;
              const nameVal = row[0];
              let codeVal = row[1];
              const phoneVal = row[2];
              const fatherPhoneVal = row[3];
              const centerNameVal = row[4] || '';
              const groupNameVal = row[5] || '';

              if (!nameVal || !fatherPhoneVal) continue;

              const centerId = centers.find((c) => c.name.includes(centerNameVal))?.id || centers[0]?.id || '';
              const groupId =
                groups.find((g) => g.name.includes(groupNameVal) && g.centerId === centerId)?.id ||
                groups.filter((g) => g.centerId === centerId)[0]?.id ||
                '';

              if (!codeVal || codeVal === 'بدون كود' || /[A-Za-z]/.test(codeVal)) {
                maxCounter++;
                codeVal = yearStr + String(maxCounter).padStart(3, '0');
              }

              const existing = allCenterStudents.find((d) => d.studentId === codeVal);
              if (existing) continue;

              const docRef = doc(collection(db, 'center_students'));
              batch.set(docRef, {
                displayName: nameVal,
                studentId: codeVal,
                studentPhone: phoneVal,
                fatherPhone: fatherPhoneVal,
                centerId,
                groupId,
                role: 'student',
                studentType: 'center',
                createdAt: new Date().toISOString(),
              });
              count++;
            }
            await batch.commit();
          }
        } else {
          const batch = writeBatch(db);
          for (const row of rows) {
            if (type === 'attendance' && row.length >= 5) {
                const nameVal = row[0];
                const codeVal = row[1];
                const dateVal = row[4] || new Date().toISOString().split('T')[0];
                const statusVal = row[5] || 'حاضر';
                const student = allCenterStudents.find((s) => s.studentId === codeVal) || allCenterStudents.find((s) => s.displayName?.toLowerCase() === nameVal.toLowerCase());
                if (!student) continue;
                batch.set(doc(db, 'attendance', `${student.uid}_${dateVal}`), {
                  studentUid: student.uid,
                  studentName: student.displayName || nameVal,
                  studentId: student.studentId || codeVal,
                  centerId: student.centerId || '',
                  groupId: student.groupId || '',
                  date: dateVal,
                  status: statusVal === 'غائب' ? 'absent' : statusVal === 'مستثنى' ? 'excused' : 'present',
                  timestamp: serverTimestamp(),
                }, { merge: true });
                count++;
            } else if (type === 'evaluations' && row.length >= 5) {
                const nameVal = row[0];
                const codeVal = row[1];
                const dateVal = row[2] || new Date().toISOString().split('T')[0];
                const gradeVal = row[3] || '0';
                const totalVal = row[4] || '10';
                const hwVal = row[5] || 'submitted';
                const noteVal = row[6] || '';
                const student = allCenterStudents.find((s) => s.studentId === codeVal) || allCenterStudents.find((s) => s.displayName?.toLowerCase() === nameVal.toLowerCase());
                if (!student) continue;
                batch.set(doc(db, 'evaluations', `${student.uid}_${dateVal}`), {
                  studentUid: student.uid,
                  studentName: student.displayName || nameVal,
                  studentId: student.studentId || codeVal,
                  centerId: student.centerId || '',
                  groupId: student.groupId || '',
                  date: dateVal,
                  quizGrade: Number(gradeVal),
                  quizTotal: Number(totalVal),
                  homeworkStatus: hwVal,
                  behaviorRating: 5,
                  teacherRemarks: noteVal,
                  createdAt: serverTimestamp(),
                }, { merge: true });
                count++;
            } else if (type === 'payments' && row.length >= 5) {
                const nameVal = row[0];
                const codeVal = row[1];
                const titleVal = row[2] || '';
                const typeVal = row[3] || 'monthly';
                const amountVal = parseFloat(row[4]) || 0;
                const dateVal = row[5] || new Date().toISOString().split('T')[0];
                const remarksVal = row[6] || '';
                const student = allCenterStudents.find((s) => s.studentId === codeVal) || allCenterStudents.find((s) => s.displayName?.toLowerCase() === nameVal.toLowerCase());
                if (!student) continue;
                batch.set(doc(db, 'center_payments', `payment_${student.uid}_${Date.now()}_${count}`), {
                  studentUid: student.uid,
                  studentName: student.displayName || nameVal,
                  studentId: student.studentId || codeVal,
                  title: titleVal,
                  type: typeVal === 'notebook' || typeVal === 'ملزمة' ? 'booklet' : typeVal === 'installment' ? 'installment' : 'subscription',
                  amount: amountVal,
                  status: 'paid',
                  date: dateVal,
                  remarks: remarksVal,
                  timestamp: serverTimestamp(),
                });
                count++;
            }
          }
          await batch.commit();
        }

        if (count > 0) {
          alert(`تم استيراد عدد ${count} سجل بنجاح!`);
          refreshData();
        } else {
          alert('لم يتم استيراد أي سجلات جديدة.');
        }
      } catch (err) {
        console.error(err);
        alert('خطأ أثناء قراءة ملف CSV');
      } finally {
        setImportStatus(null);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDownloadTemplate = () => {
    const headers = ['الاسم', 'الكود الرقمي', 'رقم هاتف الطالب', 'رقم هاتف ولي الأمر', 'اسم السنتر', 'اسم المجموعة'];
    const sampleRows = [['مصطفى جوده', '2026001', '01012345678', '01298765432', 'سنتر الصادق', 'علوم الاحد']];
    downloadCSV(headers, sampleRows, 'نموذج_استيراد_الطلاب');
  };

  const handleResetAllStudentCodes = async () => {
    const currentYear = new Date().getFullYear();
    const yearStr = String(currentYear);

    if (!window.confirm(`تنبيه: سيتم إعادة ترتيب أكواد الطلاب.`)) return;

    setImportStatus('جاري إعادة ترتيب وتحديث الأكواد...');
    try {
      let count = 0;
      const sorted = [...allCenterStudents].sort(
        (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );

      if (isSupabaseConfigured() && supabase) {
        const rows = sorted.map((stu, idx) => {
          const newCode = yearStr + String(idx + 1).padStart(3, '0');
          return mapStudentToSql({ ...stu, studentId: newCode });
        });
        const { error } = await supabase.from('center_students').upsert(rows);
        if (error) throw error;
        count = rows.length;
      } else {
        const batch = writeBatch(db);
        for (const stu of sorted) {
          count++;
          const newCode = yearStr + String(count).padStart(3, '0');
          batch.update(doc(db, 'center_students', stu.uid), { studentId: newCode });
        }
        await batch.commit();
      }
      alert(`نجح تحديث الأكواد! تم إعادة ترتيب وتحديث كود عدد ${count} طالب بالسناتر بنجاح.`);
      setSelectedCardStudent(null);
      refreshData();
    } catch (err) {
      console.error(err);
      alert('فشل إعادة تعيين وتحديث الأكواد');
    } finally {
      setImportStatus(null);
    }
  };

  const triggerPrintCard = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#060913] text-white text-right pb-32 relative" dir="rtl">
      {/* Printable ID card wrapper */}
      {selectedCardStudent && (
        <div
          id="printable-id-card"
          className="hidden print:flex flex-col justify-between"
          style={{
            direction: 'rtl',
            fontFamily: 'system-ui, sans-serif',
            background: '#090d1a',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '12px',
            width: '85.6mm',
            height: '53.98mm',
            boxSizing: 'border-box',
          }}
        >
          <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '11px', fontWeight: '900', color: '#f59e0b' }}>بوابة الطالب الذكية</h3>
              <p style={{ margin: '1px 0 0 0', fontSize: '8px', color: '#94a3b8' }}>منصة {settings.siteName || 'فهمني'}</p>
            </div>
            <div style={{ fontSize: '12px' }}>🆔</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${selectedCardStudent.studentId}`}
              alt="QR Code"
              style={{ width: '26mm', height: '26mm', borderRadius: '4px', background: 'white', padding: '2px', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedCardStudent.displayName}
              </h2>
              <p style={{ margin: '2px 0', fontSize: '8px', color: '#94a3b8' }}>
                الكود:{' '}
                <strong style={{ color: 'white', fontFamily: 'monospace' }}>{selectedCardStudent.studentId}</strong>
              </p>
              <p style={{ margin: '1px 0', fontSize: '7px', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                الصف: {getGradeLabel(selectedCardStudent.grade)}
              </p>
              <p style={{ margin: '1px 0', fontSize: '7px', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                السنتر: {centers.find((c) => c.id === selectedCardStudent.centerId)?.name || 'غير حدد'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '6px', color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '3px' }}>
            <span>تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</span>
            <span>يرجى إبراز الكارت عند الدخول</span>
          </div>
        </div>
      )}

      {/* Custom print CSS block */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            background: #090d1a !important;
            overflow: hidden !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-id-card, #printable-id-card * {
            visibility: visible !important;
          }
          #printable-id-card {
            position: absolute !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 85.6mm !important;
            height: 53.98mm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            background: #090d1a !important;
            color: white !important;
            border-radius: 16px !important;
            padding: 12px !important;
            page-break-inside: avoid !important;
          }
        }
        /* Dashboard card containers unifier */
        .w-full.max-w-7xl div[class*="bg-"] {
          background-color: transparent !important;
          background-image: none !important;
          border-color: rgba(255, 255, 255, 0.04) !important;
          box-shadow: none !important;
        }
        .w-full.max-w-7xl span[class*="bg-"] {
          background-color: rgba(255, 255, 255, 0.06) !important;
        }
      `}</style>

      {/* Main Wrapper */}
      <div className="w-full max-w-7xl mx-auto px-2 py-1 sm:px-4 sm:py-2 lg:px-6 lg:py-2 print:hidden overflow-hidden space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#060913] border border-white/5 p-5 sm:p-7 rounded-3xl relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/[0.02] rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-1 relative z-10">
            <button
              onClick={() => navigate('/teacher')}
              className="text-brand-blue hover:text-brand-yellow flex items-center gap-1.5 transition-colors text-xs font-black"
            >
              <ArrowRight size={16} />
              <span>لوحة التحكم الرئيسية</span>
            </button>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-black flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
              <span className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-tr from-amber-500/10 to-orange-500/20 text-amber-500 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-lg shrink-0">
                <FileSpreadsheet size={20} className="sm:w-6 sm:h-6" />
              </span>
              <span>نظام إدارة السناتر المتكامل (Center OS)</span>
              <span className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded-full border border-amber-500/30 uppercase tracking-wider shrink-0">
                PRO
              </span>
            </h1>
          </div>
        </div>

        {/* Floating Tab switcher navigation */}
        <div className="flex flex-row overflow-x-auto whitespace-nowrap scrollbar-none gap-1.5 p-1.5 bg-[#060913] border border-white/5 rounded-2xl shadow-2xl no-print">
          {[
            { id: 'overview', label: 'اللوحة الرئيسية', icon: LayoutDashboard, color: 'text-blue-500' },
            { id: 'directory', label: 'دليل وتعديل الطلاب', icon: Users, color: 'text-amber-500' },
            { id: 'attendance', label: 'تحضير وحضور الحصص', icon: CheckSquare, color: 'text-emerald-500' },
            { id: 'evaluations', label: 'التقييمات والدرجات', icon: Star, color: 'text-purple-500' },
            { id: 'offline-results', label: 'الامتحانات الورقية', icon: Trophy, color: 'text-teal-500' },
            { id: 'financials', label: 'الماليات والاشتراكات', icon: Coins, color: 'text-pink-500' },
            { id: 'expenses', label: 'المصروفات والاشتراكات', icon: TrendingDown, color: 'text-red-500' },
            { id: 'assistants', label: 'إدارة المساعدين', icon: UserCog, color: 'text-emerald-400' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all relative cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-white/5 border border-white/10 text-white shadow-xl shadow-black/20 font-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {isActive && (
                  <motion.div
                     layoutId="activeTabGlow"
                     className="absolute -bottom-1 left-4 right-4 h-0.5 bg-gradient-to-r from-blue-500 to-amber-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                  />
                )}
                <Icon size={14} className={isActive ? tab.color : 'text-gray-500'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Loading Banner */}
        {loadingData && (
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-center gap-3">
            <Loader2 className="animate-spin text-amber-500" size={18} />
            <span className="text-xs text-gray-400 font-bold">جاري تحديث بيانات السنتر...</span>
          </div>
        )}

        {/* Tab content renderer */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <CenterOverviewTab
              key="overview"
              centers={centers}
              groups={groups}
              allCenterStudents={allCenterStudents}
              onNavigateTab={setActiveTab}
              loading={loadingData}
              importStatus={importStatus}
              onExportJSON={handleExportJSON}
              onImportJSON={handleImportJSON}
              onExportCSV={handleExportCSV}
              onImportCSV={handleImportCSV}
              onDownloadTemplate={handleDownloadTemplate}
              onResetCodes={handleResetAllStudentCodes}
            />
          )}

          {activeTab === 'directory' && (
            <CenterStudentsTab
              key="directory"
              centers={centers}
              groups={groups}
              allCenterStudents={allCenterStudents}
              refreshData={refreshData}
              onSelectPrintStudent={(stu) => {
                setSelectedCardStudent(stu);
                // Wait for print dialog to open after UI update
                setTimeout(triggerPrintCard, 100);
              }}
            />
          )}

          {activeTab === 'attendance' && (
            <CenterAttendanceTab
              key="attendance"
              centers={centers}
              groups={groups}
              allCenterStudents={allCenterStudents}
            />
          )}

          {activeTab === 'evaluations' && (
            <CenterEvaluationsTab
              key="evaluations"
              centers={centers}
              groups={groups}
              allCenterStudents={allCenterStudents}
            />
          )}

          {activeTab === 'offline-results' && (
            <OfflineResults key="offline-results" />
          )}

          {activeTab === 'financials' && (
            <CenterFinancialsTab
              key="financials"
              allCenterStudents={allCenterStudents}
            />
          )}

          {activeTab === 'expenses' && (
            <CenterExpensesTab
              key="expenses"
              allCenterStudents={allCenterStudents}
              centers={centers}
            />
          )}

          {activeTab === 'assistants' && (
            <CenterAssistantsTab
              key="assistants"
              centers={centers}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
