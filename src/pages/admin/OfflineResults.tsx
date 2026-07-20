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
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { Center, Group, Student, useCenterData } from '../../hooks/useCenterData';
import { CenterFilterBar } from '../../components/center/CenterFilterBar';
import { ConfirmModal } from '../../components/center/ConfirmModal';
import { EmptyState } from '../../components/center/EmptyState';
import {
  Trophy,
  Save,
  Trash2,
  Loader2,
  FileSpreadsheet,
  Award,
  CheckCircle,
  AlertCircle,
  FileText,
  Plus,
  Users,
  Building,
} from 'lucide-react';

interface OfflineResultsProps {
  centers?: Center[];
  groups?: Group[];
  allCenterStudents?: Student[];
}

interface ExamRow {
  score: string;
  maxScore: string;
  examTitle: string;
  hasRecord: boolean;
  docId?: string;
}

export const OfflineResults: React.FC<OfflineResultsProps> = ({
  centers: propCenters,
  groups: propGroups,
  allCenterStudents: propStudents,
}) => {
  const fallbackData = useCenterData();
  const centers = propCenters || fallbackData.centers;
  const groups = propGroups || fallbackData.groups;
  const allCenterStudents = propStudents || fallbackData.allCenterStudents;

  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [globalExamTitle, setGlobalExamTitle] = useState('كويز حصة ' + new Date().toISOString().split('T')[0]);

  const [students, setStudents] = useState<Student[]>([]);
  const [resultsSheet, setResultsSheet] = useState<Record<string, ExamRow>>({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Auto-select defaults
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

  // Helper to safely get student code
  const getStudentCode = (s: any): string => {
    if (!s) return '0000';
    const code = s.studentId || s.student_id || s.studentCode || s.student_code || s.code;
    if (code && code !== 'undefined' && code !== 'null') return code;
    return s.uid ? String(s.uid).replace(/[^0-9]/g, '').slice(-5) : '0000';
  };

  // Load results sheet data for selected group and date
  const loadSheetData = async () => {
    if (!selectedGroup) {
      setStudents([]);
      return;
    }

    setLoading(true);
    try {
      const groupStudents = allCenterStudents.filter((s) => s.groupId === selectedGroup);
      setStudents(groupStudents);

      const map: Record<string, ExamRow> = {};

      // Initialize default rows for all students in group
      groupStudents.forEach((st) => {
        map[st.uid] = {
          score: '',
          maxScore: '10',
          examTitle: globalExamTitle,
          hasRecord: false,
        };
      });

      // 1. Fetch from Firestore
      try {
        const q = query(
          collection(db, 'offline_results'),
          where('groupId', '==', selectedGroup),
          where('date', '==', selectedDate)
        );
        const snap = await getDocs(q);
        snap.docs.forEach((d) => {
          const data = d.data();
          const stUid = data.studentId || data.studentUid || data.uid;
          if (stUid) {
            map[stUid] = {
              score: data.score !== undefined ? String(data.score) : '',
              maxScore: data.maxScore !== undefined ? String(data.maxScore) : '10',
              examTitle: data.examTitle || globalExamTitle,
              hasRecord: true,
              docId: d.id,
            };
          }
        });
      } catch (fsErr) {
        console.warn('⚡ [OfflineResults] Firestore load warning:', fsErr);
      }

      // 2. Fetch from Supabase
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('offline_results')
            .select('*')
            .eq('group_id', selectedGroup)
            .eq('date', selectedDate);

          if (!error && data) {
            data.forEach((row) => {
              const stUid = row.student_id || row.studentId;
              if (stUid) {
                map[stUid] = {
                  score: row.score !== undefined ? String(row.score) : '',
                  maxScore: row.max_score !== undefined ? String(row.max_score) : '10',
                  examTitle: row.exam_title || globalExamTitle,
                  hasRecord: true,
                  docId: row.id,
                };
              }
            });
          }
        } catch (sErr) {
          console.warn('⚡ [OfflineResults] Supabase load warning:', sErr);
        }
      }

      setResultsSheet(map);
    } catch (err) {
      console.error('⚡ [OfflineResults] Error loading sheet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSheetData();
  }, [selectedGroup, selectedDate]);

  // Update cell field
  const handleCellChange = (studentUid: string, field: keyof ExamRow, val: any) => {
    setResultsSheet((prev) => ({
      ...prev,
      [studentUid]: {
        ...(prev[studentUid] || {
          score: '',
          maxScore: '10',
          examTitle: globalExamTitle,
          hasRecord: false,
        }),
        [field]: val,
      },
    }));
  };

  // Safe percentage calculation
  const getPercentage = (scoreStr: string, maxStr: string): number => {
    const s = Number(scoreStr);
    const m = Number(maxStr) || 10;
    if (isNaN(s) || isNaN(m) || m <= 0 || !scoreStr) return 0;
    return Math.round((s / m) * 100);
  };

  // Grade badge styling
  const getGradeBadge = (pct: number, hasScore: boolean) => {
    if (!hasScore) return <span className="text-gray-500 font-bold text-[10px]">لم يحدد</span>;
    if (pct >= 85)
      return <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black text-[10px]">ممتاز 🌟</span>;
    if (pct >= 65)
      return <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-black text-[10px]">جيد جداً ✨</span>;
    if (pct >= 50)
      return <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black text-[10px]">مقبول 👍</span>;
    return <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 font-black text-[10px]">ضعيف ⚠️</span>;
  };

  // Save All Sheet Results
  const handleSaveAll = async () => {
    if (!selectedGroup) return;

    setLoading(true);
    try {
      const groupObj = groups.find((g) => g.id === selectedGroup);
      const groupName = groupObj ? groupObj.name : 'غير محددة';

      const batch = writeBatch(db);
      const supabaseRows: any[] = [];

      students.forEach((s) => {
        const row = resultsSheet[s.uid];
        if (row && row.score !== '') {
          const docId = `${s.uid}_${selectedDate}`;
          const numScore = Number(row.score) || 0;
          const numMaxScore = Number(row.maxScore) || 10;
          const examTitle = row.examTitle || globalExamTitle;
          const code = getStudentCode(s);

          // 1. Batch Firestore update
          batch.set(
            doc(db, 'offline_results', docId),
            {
              id: docId,
              studentId: s.uid,
              studentUid: s.uid,
              studentName: s.displayName,
              studentCode: code,
              groupId: selectedGroup,
              groupName,
              centerId: selectedCenter,
              examTitle,
              score: numScore,
              maxScore: numMaxScore,
              date: selectedDate,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );

          // 2. Prepare Supabase row
          supabaseRows.push({
            id: docId,
            student_id: s.uid,
            student_name: s.displayName,
            student_code: code,
            group_id: selectedGroup,
            group_name: groupName,
            center_id: selectedCenter,
            exam_title: examTitle,
            score: numScore,
            max_score: numMaxScore,
            date: selectedDate,
          });
        }
      });

      await batch.commit();

      if (isSupabaseConfigured() && supabase && supabaseRows.length > 0) {
        try {
          await supabase.from('offline_results').upsert(supabaseRows);
        } catch (sErr) {
          console.warn('Supabase upsert offline_results error:', sErr);
        }
      }

      setResultsSheet((prev) => {
        const next = { ...prev };
        students.forEach((s) => {
          if (next[s.uid]) next[s.uid].hasRecord = true;
        });
        return next;
      });

      alert('تم حفظ كافة نتائج الامتحان الورقي للمجموعة بنجاح!');
    } catch (err) {
      console.error('Error saving all offline results:', err);
      alert('حدث خطأ أثناء حفظ النتائج الجماعية');
    } finally {
      setLoading(false);
    }
  };

  // Delete Result
  const handleDeleteResultConfirm = async () => {
    if (!studentToDelete) return;
    const sUid = studentToDelete.uid;

    setSaving(sUid);
    try {
      const docId = `${sUid}_${selectedDate}`;

      if (isSupabaseConfigured() && supabase) {
        await supabase.from('offline_results').delete().eq('id', docId);
      } else {
        await deleteDoc(doc(db, 'offline_results', docId));
      }

      setResultsSheet((prev) => ({
        ...prev,
        [sUid]: {
          score: '',
          maxScore: '10',
          examTitle: globalExamTitle,
          hasRecord: false,
        },
      }));
      setStudentToDelete(null);
      alert('تم حذف النتيجة بنجاح');
    } catch (err) {
      console.error('Error deleting offline result:', err);
      alert('فشل حذف النتيجة');
    } finally {
      setSaving(null);
    }
  };

  // Session Statistics
  let testedStudentsCount = 0;
  let totalScoreSum = 0;
  let totalMaxSum = 0;
  let passedCount = 0;

  students.forEach((student) => {
    const row = resultsSheet[student.uid];
    if (row && row.score !== '') {
      const s = Number(row.score);
      const m = Number(row.maxScore) || 10;
      testedStudentsCount++;
      totalScoreSum += s;
      totalMaxSum += m;
      if (m > 0 && (s / m) >= 0.5) {
        passedCount++;
      }
    }
  });

  const avgPct = totalMaxSum > 0 ? Math.round((totalScoreSum / totalMaxSum) * 100) : 0;
  const passRatePct = testedStudentsCount > 0 ? Math.round((passedCount / testedStudentsCount) * 100) : 0;

  return (
    <div className="space-y-6 text-right" dir="rtl">
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

      {/* Main Content Area */}
      {selectedGroup ? (
        <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl backdrop-blur-md shadow-xl space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-5">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Trophy className="text-emerald-400" size={18} />
                <span>رصد وكشف درجات الإمتحانات الورقية</span>
              </h3>
              <p className="text-[10px] text-gray-500 font-bold mt-1">
                رصد نتائج اختبارات الحصة والامتحانات الشهرية بالسنتر
              </p>
            </div>

            {/* Exam Title Global Config & Batch Save */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  value={globalExamTitle}
                  onChange={(e) => {
                    const title = e.target.value;
                    setGlobalExamTitle(title);
                    setResultsSheet((prev) => {
                      const next = { ...prev };
                      Object.keys(next).forEach((k) => {
                        next[k].examTitle = title;
                      });
                      return next;
                    });
                  }}
                  placeholder="عنوان الامتحان الورقي..."
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500/50 font-bold"
                />
              </div>

              <button
                onClick={handleSaveAll}
                disabled={loading || students.length === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition-all flex items-center gap-1.5 cursor-pointer w-full sm:w-auto justify-center disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                <span>حفظ كشف نتائج الامتحان بالكامل</span>
              </button>
            </div>
          </div>

          {/* Exam Stats Summary */}
          {students.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
              <div className="flex justify-between items-center text-xs font-bold px-3">
                <span className="text-gray-400">عدد الطلاب المختبرين:</span>
                <span className="text-white text-sm font-black">{testedStudentsCount} / {students.length}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold px-3 border-t sm:border-t-0 sm:border-r border-white/5 pt-2 sm:pt-0">
                <span className="text-gray-400">متوسط الدرجة المئوية:</span>
                <span className="text-emerald-400 text-sm font-black">{avgPct}%</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold px-3 border-t sm:border-t-0 sm:border-r border-white/5 pt-2 sm:pt-0">
                <span className="text-gray-400">نسبة النجاح (فوق 50%):</span>
                <span className="text-teal-400 text-sm font-black">{passRatePct}%</span>
              </div>
            </div>
          )}

          {/* Table Sheet */}
          {students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs min-w-[750px]">
                <thead>
                  <tr className="border-b border-white/5 text-gray-500 font-bold text-[10px] uppercase tracking-wider">
                    <th className="pb-3 text-center w-12">#</th>
                    <th className="pb-3 pr-2">اسم الطالب / الكود الرقمي</th>
                    <th className="pb-3 text-center w-32">عنوان الامتحان</th>
                    <th className="pb-3 text-center w-32">الدرجة الحاصل عليها</th>
                    <th className="pb-3 text-center w-28">الدرجة العظمى</th>
                    <th className="pb-3 text-center w-28">النسبة المئوية</th>
                    <th className="pb-3 text-center w-28">التقدير</th>
                    <th className="pb-3 text-center w-20">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-bold">
                  {students.map((st, idx) => {
                    const row = resultsSheet[st.uid] || {
                      score: '',
                      maxScore: '10',
                      examTitle: globalExamTitle,
                      hasRecord: false,
                    };
                    const pct = getPercentage(row.score, row.maxScore);

                    return (
                      <tr key={st.uid} className="hover:bg-white/[0.02] transition-colors group">
                        {/* Index */}
                        <td className="py-3.5 text-center text-gray-500 font-mono text-[10px]">
                          {idx + 1}
                        </td>

                        {/* Student Name & Code */}
                        <td className="py-3.5 pr-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-black text-xs shrink-0">
                              {(st.displayName || 'ط').trim().charAt(0)}
                            </div>
                            <div>
                              <span className="text-white block font-black text-xs">{st.displayName}</span>
                              <span className="text-[9px] text-gray-500 font-mono block">
                                كود: {getStudentCode(st)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Exam Title */}
                        <td className="py-3.5 text-center px-2">
                          <input
                            type="text"
                            value={row.examTitle}
                            onChange={(e) => handleCellChange(st.uid, 'examTitle', e.target.value)}
                            placeholder="عنوان الامتحان..."
                            className="w-full text-center px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-[11px] text-white outline-none focus:border-emerald-500 font-bold"
                          />
                        </td>

                        {/* Score Input */}
                        <td className="py-3.5 text-center px-2">
                          <input
                            type="number"
                            step="any"
                            value={row.score}
                            onChange={(e) => handleCellChange(st.uid, 'score', e.target.value)}
                            placeholder="0"
                            className="w-24 text-center px-3 py-1.5 bg-black/40 border border-emerald-500/20 rounded-lg text-xs font-black text-emerald-400 outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* Max Score Input */}
                        <td className="py-3.5 text-center px-2">
                          <input
                            type="number"
                            step="any"
                            value={row.maxScore}
                            onChange={(e) => handleCellChange(st.uid, 'maxScore', e.target.value)}
                            placeholder="10"
                            className="w-20 text-center px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-gray-300 outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* Safe Percentage Badge */}
                        <td className="py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black border ${
                                row.score !== ''
                                  ? pct >= 50
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : 'bg-white/5 text-gray-500 border-white/5'
                              }`}
                            >
                              {row.score !== '' ? `${pct}%` : '-%'}
                            </span>
                          </div>
                        </td>

                        {/* Grade Status Pill */}
                        <td className="py-3.5 text-center">
                          {getGradeBadge(pct, row.score !== '')}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 text-center">
                          {row.hasRecord ? (
                            <button
                              type="button"
                              onClick={() => setStudentToDelete(st)}
                              disabled={saving === st.uid}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all cursor-pointer"
                              title="حذف نتيجة هذا الامتحان"
                            >
                              {saving === st.uid ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-600 font-bold">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="لا يوجد طلاب مسجلين بهذه المجموعة"
              description="يرجى إضافة طلاب للمجموعة من قسم دليل وتعديل الطلاب لتتمكن من رصد نتائجهم الورقية."
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={Building}
          title="قم باختيار الفرع والمجموعة"
          description="يرجى اختيار الفرع (السنتر) والمجموعة من الشريط العلوي لعرض كشف ورصد الامتحانات الورقية."
        />
      )}

      {/* Delete Result Confirm Modal */}
      <ConfirmModal
        isOpen={!!studentToDelete}
        title="تأكيد حذف النتيجة الورقية"
        message={`هل أنت تأكد من رغبتك في حذف نتيجة الامتحان الورقي للطالب "${studentToDelete?.displayName || ''}"؟`}
        onConfirm={handleDeleteResultConfirm}
        onCancel={() => setStudentToDelete(null)}
        confirmText="حذف النتيجة"
        type="danger"
      />
    </div>
  );
};
