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
  writeBatch,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { Center, Group, Student } from '../../../hooks/useCenterData';
import { CenterFilterBar } from '../../../components/center/CenterFilterBar';
import { ConfirmModal } from '../../../components/center/ConfirmModal';
import { EmptyState } from '../../../components/center/EmptyState';
import { cleanPhone } from '../../../utils/arabicUtils';
import { dbRouter } from '../../../services/dbRouter';
import { QrAttendanceModal } from '../../../components/center/QrAttendanceModal';
import {
  Printer,
  Trash2,
  Check,
  X as XIcon,
  HelpCircle,
  FileCheck,
  UserCheck,
  UserX,
  MessageSquare,
  QrCode,
} from 'lucide-react';

interface CenterAttendanceTabProps {
  centers: Center[];
  groups: Group[];
  allCenterStudents: Student[];
}

export const CenterAttendanceTab: React.FC<CenterAttendanceTabProps> = ({
  centers,
  groups,
  allCenterStudents,
}) => {
  const getSubscriptionBadge = (student: any) => {
    if (!student.packageName) return null;
    
    const isMonthly = student.subscriptionType === 'monthly';
    
    if (isMonthly) {
      if (!student.subscriptionEndDate) {
        return (
          <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[9px] font-bold">
            اشتراك شهري: غير نشط ❌
          </span>
        );
      }
      
      const expiry = new Date(student.subscriptionEndDate);
      const today = new Date();
      expiry.setHours(0,0,0,0);
      today.setHours(0,0,0,0);
      
      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return (
          <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[9px] font-bold">
            منتهي منذ {Math.abs(diffDays)} يوم ⚠️
          </span>
        );
      } else if (diffDays <= 3) {
        return (
          <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-bold">
            ينتهي بعد {diffDays} يوم ⏳
          </span>
        );
      } else {
        return (
          <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-bold">
            نشط (متبقي {diffDays} يوم) ✅
          </span>
        );
      }
    } else {
      // Sessions-based package
      const sessions = student.remainingSessions ?? 0;
      return (
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
          sessions <= 0
            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}>
          رصيد: {sessions} حصة
        </span>
      );
    }
  };

  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceSheet, setAttendanceSheet] = useState<Record<string, 'present' | 'absent' | 'excused'>>({});
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [studentToDeleteRecord, setStudentToDeleteRecord] = useState<Student | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Set default filters
  useEffect(() => {
    if (centers.length > 0 && !selectedCenter) {
      setSelectedCenter(centers[0].id);
    }
  }, [centers, selectedCenter]);

  useEffect(() => {
    const centerGroups = groups.filter((g) => g.centerId === selectedCenter);
    if (centerGroups.length > 0 && !selectedGroup) {
      setSelectedGroup(centerGroups[0].id);
    }
  }, [selectedCenter, groups, selectedGroup]);

  // Load attendance data
  const loadSheetData = async () => {
    if (!selectedGroup) {
      setStudents([]);
      return;
    }

    setLoading(true);
    try {
      // 1. Filter students locally
      const groupStudents = allCenterStudents.filter((s) => s.groupId === selectedGroup);
      setStudents(groupStudents);

      // 2. Fetch records
      const map: Record<string, 'present' | 'absent' | 'excused'> = {};

      try {
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('groupId', '==', selectedGroup),
          where('date', '==', selectedDate)
        );
        const snap = await getDocs(attendanceQuery);
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.studentUid) {
            map[data.studentUid] = data.status || 'present';
          }
        });
      } catch (fsErr) {
        console.warn('Firestore load attendance warning:', fsErr);
      }

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('attendance')
            .select('student_uid, status')
            .eq('group_id', selectedGroup)
            .eq('date', selectedDate);
          
          if (!error && data) {
            data.forEach((row: any) => {
              if (row.student_uid) {
                map[row.student_uid] = row.status || 'present';
              }
            });
          } else if (error) {
            console.warn('Supabase select attendance failed:', error);
          }
        } catch (sbErr) {
          console.warn('Supabase select attendance exception:', sbErr);
        }
      }
      setAttendanceSheet(map);
    } catch (err) {
      console.error('Error loading attendance sheet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroup) {
      loadSheetData();
    }
  }, [selectedGroup, selectedDate]);

  const handleAttendanceChange = async (studentUid: string, status: 'present' | 'absent' | 'excused') => {
    setSaving(studentUid);
    try {
      const student = students.find((s) => s.uid === studentUid);
      if (!student) return;

      const docId = `${studentUid}_${selectedDate}`;
      const oldStatus = attendanceSheet[studentUid];

      try {
        if (isSupabaseConfigured() && supabase) {
          const { error } = await supabase.from('attendance').upsert({
            id: docId,
            student_uid: studentUid,
            student_name: student.displayName,
            student_id: student.studentId,
            center_id: selectedCenter,
            group_id: selectedGroup,
            date: selectedDate,
            status,
            timestamp: new Date().toISOString(),
          });
          if (error) {
            console.warn('Supabase attendance upsert warning:', error);
          }
        }
      } catch (sbErr) {
        console.warn('Supabase attendance upsert exception:', sbErr);
      }

      await setDoc(
        doc(db, 'attendance', docId),
        {
          studentUid,
          studentName: student.displayName,
          studentId: student.studentId,
          centerId: selectedCenter,
          groupId: selectedGroup,
          date: selectedDate,
          status,
          timestamp: serverTimestamp(),
        },
        { merge: true }
      );

      // Update remaining sessions for packages
      if ((student as any).packageName) {
        let diff = 0;
        if (status === 'present' && oldStatus !== 'present') {
          diff = -1;
        } else if (status !== 'present' && oldStatus === 'present') {
          diff = 1;
        }

        if (diff !== 0) {
          const newSessions = Math.max(0, (((student as any).remainingSessions) ?? 0) + diff);
          await dbRouter.updateStudent(studentUid, {
            remainingSessions: newSessions,
          });
          setStudents((prev) =>
            prev.map((s) =>
              s.uid === studentUid
                ? { ...s, remainingSessions: newSessions }
                : s
            )
          );
        }
      }

      setAttendanceSheet((prev) => ({ ...prev, [studentUid]: status }));
    } catch (err) {
      console.error('Attendance Save Error:', err);
      alert('حدث خطأ أثناء حفظ حالة الحضور');
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteRecordConfirm = async () => {
    if (!studentToDeleteRecord) return;
    const studentUid = studentToDeleteRecord.uid;
    const oldStatus = attendanceSheet[studentUid];

    setSaving(studentUid);
    try {
      const docId = `${studentUid}_${selectedDate}`;

      try {
        if (isSupabaseConfigured() && supabase) {
          const { error } = await supabase.from('attendance').delete().eq('id', docId);
          if (error) {
            console.warn('Supabase attendance delete warning:', error);
          }
        }
      } catch (sbErr) {
        console.warn('Supabase attendance delete exception:', sbErr);
      }

      await deleteDoc(doc(db, 'attendance', docId));

      // Increment sessions back if they were marked present
      if ((studentToDeleteRecord as any).packageName && oldStatus === 'present') {
        const newSessions = (((studentToDeleteRecord as any).remainingSessions) ?? 0) + 1;
        await dbRouter.updateStudent(studentUid, {
          remainingSessions: newSessions,
        });
        setStudents((prev) =>
          prev.map((s) =>
            s.uid === studentUid
              ? { ...s, remainingSessions: newSessions }
              : s
          )
        );
      }

      setAttendanceSheet((prev) => {
        const next = { ...prev };
        delete next[studentUid];
        return next;
      });
      setStudentToDeleteRecord(null);
      alert('تم حذف سجل التحضير للحصة');
    } catch (err) {
      console.error('Error deleting attendance record:', err);
      alert('فشل حذف سجل التحضير');
    } finally {
      setSaving(null);
    }
  };

  const handleBulkMark = async (status: 'present' | 'absent' | 'excused') => {
    if (students.length === 0) return;
    setLoading(true);
    try {
      try {
        if (isSupabaseConfigured() && supabase) {
          const sqlRows = students.map((student) => ({
            id: `${student.uid}_${selectedDate}`,
            student_uid: student.uid,
            student_name: student.displayName,
            student_id: student.studentId,
            center_id: selectedCenter,
            group_id: selectedGroup,
            date: selectedDate,
            status,
            timestamp: new Date().toISOString(),
          }));
          const { error } = await supabase.from('attendance').upsert(sqlRows);
          if (error) {
            console.warn('Supabase bulk attendance upsert failed:', error);
          }
        }
      } catch (sbErr) {
        console.warn('Supabase bulk attendance upsert exception:', sbErr);
      }

      // Always write to Firestore batch
      const batch = writeBatch(db);
      students.forEach((student) => {
        const docId = `${student.uid}_${selectedDate}`;
        batch.set(
          doc(db, 'attendance', docId),
          {
            studentUid: student.uid,
            studentName: student.displayName,
            studentId: student.studentId,
            centerId: selectedCenter,
            groupId: selectedGroup,
            date: selectedDate,
            status,
            timestamp: serverTimestamp(),
          },
          { merge: true }
        );
      });
      await batch.commit();

      // Update remaining sessions for packages during bulk mark
      for (const student of students) {
        const oldStatus = attendanceSheet[student.uid];
        let diff = 0;
        if (status === 'present' && oldStatus !== 'present') {
          diff = -1;
        } else if (status !== 'present' && oldStatus === 'present') {
          diff = 1;
        }

        if (diff !== 0 && (student as any).packageName) {
          const newSessions = Math.max(0, (((student as any).remainingSessions) ?? 0) + diff);
          await dbRouter.updateStudent(student.uid, {
            remainingSessions: newSessions,
          });
          (student as any).remainingSessions = newSessions;
        }
      }

      const map: Record<string, 'present' | 'absent' | 'excused'> = {};
      students.forEach((s) => {
        map[s.uid] = status;
      });
      setAttendanceSheet(map);
      alert('تم رصد الحضور الجماعي بنجاح!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء رصد الحضور الجماعي');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const groupName = groups.find((g) => g.id === selectedGroup)?.name || 'غير معروف';
    const centerName = centers.find((c) => c.id === selectedCenter)?.name || 'غير معروف';

    const tableRows = students
      .map((student, idx) => {
        const status = attendanceSheet[student.uid];
        const statusLabel =
          status === 'present'
            ? 'حاضر'
            : status === 'absent'
            ? 'غائب'
            : status === 'excused'
            ? 'مستثنى'
            : 'غير مسجل';

        return `
        <tr>
          <td>${idx + 1}</td>
          <td>${student.displayName}</td>
          <td>${student.studentId}</td>
          <td>${statusLabel}</td>
          <td></td>
        </tr>
      `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف حضور - ${groupName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Cairo', sans-serif; padding: 30px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0 0 10px 0; font-size: 22px; }
          .meta-info { display: flex; justify-content: space-around; font-size: 14px; color: #475569; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-size: 13px; }
          th { background-color: #f1f5f9; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>كشف حضور وغياب طلاب السنتر</h1>
          <div class="meta-info">
            <span>السنتر: <strong>${centerName}</strong></span>
            <span>المجموعة: <strong>${groupName}</strong></span>
            <span>التاريخ: <strong>${selectedDate}</strong></span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>اسم الطالب</th>
              <th style="width: 150px;">الكود الرقمي</th>
              <th style="width: 120px;">حالة الحضور</th>
              <th style="width: 200px;">ملاحظات المعلم</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Calculate quick stats
  const presentCount = Object.values(attendanceSheet).filter((s) => s === 'present').length;
  const absentCount = Object.values(attendanceSheet).filter((s) => s === 'absent').length;
  const excusedCount = Object.values(attendanceSheet).filter((s) => s === 'excused').length;
  const unregisteredCount = students.length - (presentCount + absentCount + excusedCount);

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <CenterFilterBar
        centers={centers}
        groups={groups}
        selectedCenterId={selectedCenter}
        selectedGroupId={selectedGroup}
        selectedDate={selectedDate}
        onCenterChange={setSelectedCenter}
        onGroupChange={setSelectedGroup}
        onDateChange={setSelectedDate}
        onLoadData={loadSheetData}
        loading={loading}
        accentColor="emerald-500"
      />

      {students.length > 0 && (
        <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl backdrop-blur-md shadow-xl space-y-6">
          {/* Header Action Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <FileCheck className="text-emerald-500" size={18} />
                <span>رصد الحضور اليومي للمجموعة</span>
              </h3>
              <p className="text-[10px] text-gray-500 font-bold mt-1">تحديد حالة الطالب الفردية أو رصد جماعي سريع</p>
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsQrModalOpen(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-[10px] rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <QrCode size={13} />
                <span>مسح كارت QR للحضور</span>
              </button>
              <button
                onClick={() => handleBulkMark('present')}
                className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-black text-[10px] rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <UserCheck size={12} />
                <span>تحضير الكل</span>
              </button>
              <button
                onClick={() => handleBulkMark('absent')}
                className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 font-black text-[10px] rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <UserX size={12} />
                <span>تغييب الكل</span>
              </button>
              <button
                onClick={handlePrintPDF}
                className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] rounded-xl transition-all flex items-center gap-1 cursor-pointer border border-white/5"
              >
                <Printer size={12} />
                <span>طباعة الكشف</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
            <div className="text-center">
              <span className="text-[9px] text-gray-500 font-bold uppercase block">حاضر</span>
              <span className="text-sm font-black text-emerald-500 block mt-1">{presentCount} طلاب</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-gray-500 font-bold uppercase block">غائب</span>
              <span className="text-sm font-black text-red-500 block mt-1">{absentCount} طلاب</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-gray-500 font-bold uppercase block">مستثنى</span>
              <span className="text-sm font-black text-amber-500 block mt-1">{excusedCount} طلاب</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-gray-500 font-bold uppercase block">غير مسجل</span>
              <span className="text-sm font-black text-gray-400 block mt-1">{unregisteredCount} طلاب</span>
            </div>
          </div>

          {/* Sheet Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="pb-3 text-center w-12">#</th>
                  <th className="pb-3 pr-2">اسم الطالب</th>
                  <th className="pb-3">كود الطالب</th>
                  <th className="pb-3 text-center">حالة الحضور والغياب</th>
                  <th className="pb-3 text-center w-24">التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {students.map((student, idx) => {
                  const status = attendanceSheet[student.uid];
                  const isSaving = saving === student.uid;

                  return (
                    <tr key={student.uid} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3.5 text-center text-gray-500 font-bold">{idx + 1}</td>
                      <td className="py-3.5 pr-2">
                        <span className="font-bold text-white block">{student.displayName}</span>
                        {(student as any).packageName && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-bold">
                              {(student as any).packageName}
                            </span>
                            {getSubscriptionBadge(student)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 font-mono text-gray-400">{student.studentId}</td>
                      
                      {/* Modern Segmented Status selector */}
                      <td className="py-3.5">
                        <div className="flex items-center justify-center gap-1.5 max-w-xs mx-auto">
                          <button
                            type="button"
                            onClick={() => handleAttendanceChange(student.uid, 'present')}
                            disabled={isSaving}
                            className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                              status === 'present'
                                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10'
                                : 'bg-white/5 hover:bg-white/10 text-gray-400'
                            }`}
                          >
                            <Check size={10} />
                            <span>حاضر</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleAttendanceChange(student.uid, 'absent')}
                            disabled={isSaving}
                            className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                              status === 'absent'
                                ? 'bg-red-500 text-white shadow-md shadow-red-500/10'
                                : 'bg-white/5 hover:bg-white/10 text-gray-400'
                            }`}
                          >
                            <XIcon size={10} />
                            <span>غائب</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAttendanceChange(student.uid, 'excused')}
                            disabled={isSaving}
                            className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                              status === 'excused'
                                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                                : 'bg-white/5 hover:bg-white/10 text-gray-400'
                            }`}
                          >
                            <HelpCircle size={10} />
                            <span>مستثنى</span>
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {status ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const text = `السيد ولي أمر الطالب / ${student.displayName}، نحيطكم علماً بتسجيل حالة الطالب لحصة اليوم (${selectedDate}) كـ (${
                                    status === 'present' ? 'حضور' : status === 'absent' ? 'غياب بدون عذر' : 'غياب بعذر مقبول'
                                  }). شكرًا لمتابعتكم.`;
                                  const phone = student.fatherPhone || student.motherPhone || student.studentPhone || '';
                                  const clean = cleanPhone(phone);
                                  if (clean) {
                                    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(text)}`, '_blank');
                                  } else {
                                    alert('لا يوجد رقم هاتف مسجل لولي الأمر');
                                  }
                                }}
                                className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 rounded-lg transition-all cursor-pointer"
                                title="إرسال تنبيه واتساب لولي الأمر"
                              >
                                <MessageSquare size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setStudentToDeleteRecord(student)}
                                disabled={isSaving}
                                className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all cursor-pointer"
                                title="إلغاء التحضير"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-500 font-bold">لم يرصد</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {students.length === 0 && selectedGroup && !loading && (
        <EmptyState
          icon={UserX}
          title="لا يوجد طلاب في هذه المجموعة"
          description="يرجى إضافة طلاب لهذه المجموعة أولاً من دليل الطلاب لتتمكن من رصد الحضور."
          actionText="إضافة طلاب"
          onAction={() => window.location.reload()}
        />
      )}

      {/* Confirm deletion of single attendance record */}
      <ConfirmModal
        isOpen={studentToDeleteRecord !== null}
        title="تأكيد إلغاء تحضير الطالب"
        message={`هل أنت متأكد من إلغاء وحذف كشف تحضير الطالب "${studentToDeleteRecord?.displayName}" لهذه الحصة بالكامل؟`}
        confirmText="إلغاء التحضير"
        cancelText="تراجع"
        type="danger"
        onConfirm={handleDeleteRecordConfirm}
        onCancel={() => setStudentToDeleteRecord(null)}
      />

      {/* QR Code Attendance Scanner Modal */}
      <QrAttendanceModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        selectedCenterId={selectedCenter}
        selectedGroupId={selectedGroup}
        selectedDate={selectedDate}
        allStudents={allCenterStudents}
        onAttendanceRecorded={(studentUid, status) => {
          setAttendanceSheet((prev) => ({ ...prev, [studentUid]: status }));
        }}
      />
    </div>
  );
};
