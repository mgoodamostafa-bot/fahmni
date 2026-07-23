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
import { db } from '../../../lib/firebase';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { Center, Group, Student } from '../../../hooks/useCenterData';
import { CenterFilterBar } from '../../../components/center/CenterFilterBar';
import { ConfirmModal } from '../../../components/center/ConfirmModal';
import { EmptyState } from '../../../components/center/EmptyState';
import {
  Save,
  Trash2,
  Star,
  StarOff,
  UserX,
  Loader2,
  FileSpreadsheet,
  Award,
} from 'lucide-react';

interface CenterEvaluationsTabProps {
  centers: Center[];
  groups: Group[];
  allCenterStudents: Student[];
}

interface EvaluationRow {
  quizGrade: string;
  quizTotal: string;
  homeworkStatus: string;
  behaviorRating: number;
  teacherRemarks: string;
  hasRecord: boolean;
}

export const CenterEvaluationsTab: React.FC<CenterEvaluationsTabProps> = ({
  centers,
  groups,
  allCenterStudents,
}) => {
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [students, setStudents] = useState<Student[]>([]);
  const [evaluationsSheet, setEvaluationsSheet] = useState<Record<string, EvaluationRow>>({});
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [studentToDeleteEval, setStudentToDeleteEval] = useState<Student | null>(null);

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

  // Load evaluations sheet data
  const loadSheetData = async () => {
    if (!selectedGroup) {
      setStudents([]);
      return;
    }

    setLoading(true);
    try {
      const groupStudents = allCenterStudents.filter((s) => s.groupId === selectedGroup);
      setStudents(groupStudents);

      const map: Record<string, EvaluationRow> = {};

      try {
        const evaluationsQuery = query(
          collection(db, 'evaluations'),
          where('groupId', '==', selectedGroup),
          where('date', '==', selectedDate)
        );
        const snap = await getDocs(evaluationsQuery);
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.studentUid) {
            map[data.studentUid] = {
              quizGrade: data.quizGrade !== undefined ? String(data.quizGrade) : '',
              quizTotal: data.quizTotal !== undefined ? String(data.quizTotal) : '10',
              homeworkStatus: data.homeworkStatus || 'submitted',
              behaviorRating: data.behaviorRating || 5,
              teacherRemarks: data.teacherRemarks || '',
              hasRecord: true,
            };
          }
        });
      } catch (fsErr) {
        console.warn('Firestore load evaluations warning:', fsErr);
      }

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('evaluations')
            .select('*')
            .eq('group_id', selectedGroup)
            .eq('date', selectedDate);
          
          if (!error && data) {
            data.forEach((row: any) => {
              if (row.student_uid) {
                map[row.student_uid] = {
                  quizGrade: row.quiz_grade !== undefined && row.quiz_grade !== null ? String(row.quiz_grade) : '',
                  quizTotal: row.quiz_total !== undefined && row.quiz_total !== null ? String(row.quiz_total) : '10',
                  homeworkStatus: row.homework_status || 'submitted',
                  behaviorRating: row.behavior_rating || 5,
                  teacherRemarks: row.teacher_remarks || '',
                  hasRecord: true,
                };
              }
            });
          } else if (error) {
            console.warn('Supabase select evaluations failed:', error);
          }
        } catch (sbErr) {
          console.warn('Supabase select evaluations exception:', sbErr);
        }
      }

      // Default state for all students in group
      const finalMap: Record<string, EvaluationRow> = {};
      groupStudents.forEach((stu) => {
        finalMap[stu.uid] = map[stu.uid] || {
          quizGrade: '',
          quizTotal: '10',
          homeworkStatus: 'submitted',
          behaviorRating: 5,
          teacherRemarks: '',
          hasRecord: false,
        };
      });

      setEvaluationsSheet(finalMap);
    } catch (err) {
      console.error('Error loading evaluations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroup) {
      loadSheetData();
    }
  }, [selectedGroup, selectedDate]);

  const handleLocalChange = (studentUid: string, field: keyof EvaluationRow, value: any) => {
    setEvaluationsSheet((prev) => ({
      ...prev,
      [studentUid]: {
        ...prev[studentUid],
        [field]: value,
      },
    }));
  };

  const handleSaveEvaluation = async (studentUid: string) => {
    const ev = evaluationsSheet[studentUid];
    if (!ev) return;

    // Validation
    const grade = Number(ev.quizGrade);
    const total = Number(ev.quizTotal);
    if (ev.quizGrade && (isNaN(grade) || isNaN(total) || grade > total || grade < 0)) {
      alert('خطأ: درجة الكويز يجب أن تكون رقماً صالحاً ولا تتجاوز الدرجة النهائية الكلية!');
      return;
    }

    setSaving(studentUid);
    try {
      const student = students.find((s) => s.uid === studentUid);
      if (!student) return;

      const docId = `${studentUid}_${selectedDate}`;

      try {
        if (isSupabaseConfigured() && supabase) {
          const { error } = await supabase.from('evaluations').upsert({
            id: docId,
            student_uid: studentUid,
            student_name: student.displayName,
            student_id: student.studentId,
            center_id: selectedCenter,
            group_id: selectedGroup,
            date: selectedDate,
            quiz_grade: ev.quizGrade ? Number(ev.quizGrade) : 0,
            quiz_total: ev.quizTotal ? Number(ev.quizTotal) : 10,
            homework_status: ev.homeworkStatus,
            behavior_rating: ev.behaviorRating,
            teacher_remarks: ev.teacherRemarks.trim(),
            created_at: new Date().toISOString(),
          });
          if (error) {
            console.warn('Supabase evaluations upsert warning:', error);
          }

          // Dual-upsert to Supabase offline_results
          if (ev.quizGrade) {
            const { error: err2 } = await supabase.from('offline_results').upsert({
              id: docId,
              student_uid: studentUid,
              student_name: student.displayName,
              student_code: student.studentId,
              exam_title: `كويز حصة ${selectedDate}`,
              score: Number(ev.quizGrade),
              max_score: Number(ev.quizTotal),
              created_at: new Date().toISOString(),
            });
            if (err2) {
              console.warn('Supabase dual-offline_results upsert warning:', err2);
            }
          }
        }
      } catch (sbErr) {
        console.warn('Supabase evaluations upsert exception:', sbErr);
      }

      // Always write to Firestore batch
      const batch = writeBatch(db);
      batch.set(
        doc(db, 'evaluations', docId),
        {
          studentUid,
          studentName: student.displayName,
          studentId: student.studentId,
          centerId: selectedCenter,
          groupId: selectedGroup,
          date: selectedDate,
          quizGrade: ev.quizGrade ? Number(ev.quizGrade) : 0,
          quizTotal: ev.quizTotal ? Number(ev.quizTotal) : 10,
          homeworkStatus: ev.homeworkStatus,
          behaviorRating: ev.behaviorRating,
          teacherRemarks: ev.teacherRemarks.trim(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Dual-write to offline_results for legacy view compatibility
      batch.set(
        doc(db, 'offline_results', docId),
        {
          studentUid,
          studentName: student.displayName,
          studentId: student.studentId,
          centerId: selectedCenter,
          groupId: selectedGroup,
          examTitle: `كويز حصة ${selectedDate}`,
          score: ev.quizGrade ? Number(ev.quizGrade) : 0,
          totalQuestions: ev.quizTotal ? Number(ev.quizTotal) : 10,
          createdAt: serverTimestamp(),
          type: 'offline',
        },
        { merge: true }
      );

      await batch.commit();

      setEvaluationsSheet((prev) => ({
        ...prev,
        [studentUid]: { ...prev[studentUid], hasRecord: true },
      }));

      alert('تم حفظ تقييم الطالب بنجاح!');
    } catch (err) {
      console.error('Error saving evaluation:', err);
      alert('حدث خطأ أثناء حفظ التقييم');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAll = async () => {
    // Basic validation first
    for (const student of students) {
      const ev = evaluationsSheet[student.uid];
      if (ev) {
        const grade = Number(ev.quizGrade);
        const total = Number(ev.quizTotal);
        if (ev.quizGrade && (isNaN(grade) || isNaN(total) || grade > total || grade < 0)) {
          alert(`خطأ في الطالب "${student.displayName}": درجة الكويز لا يمكن أن تتجاوز النهاية الكبرى!`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      try {
        if (isSupabaseConfigured() && supabase) {
          const sqlRows = [];
          const offlineSqlRows = [];
          for (const student of students) {
            const ev = evaluationsSheet[student.uid];
            if (!ev) continue;
            const docId = `${student.uid}_${selectedDate}`;
            sqlRows.push({
              id: docId,
              student_uid: student.uid,
              student_name: student.displayName,
              student_id: student.studentId,
              center_id: selectedCenter,
              group_id: selectedGroup,
              date: selectedDate,
              quiz_grade: ev.quizGrade ? Number(ev.quizGrade) : 0,
              quiz_total: ev.quizTotal ? Number(ev.quizTotal) : 10,
              homework_status: ev.homeworkStatus,
              behavior_rating: ev.behaviorRating,
              teacher_remarks: ev.teacherRemarks.trim(),
              created_at: new Date().toISOString(),
            });

            if (ev.quizGrade) {
              offlineSqlRows.push({
                id: docId,
                student_uid: student.uid,
                student_name: student.displayName,
                student_code: student.studentId,
                exam_title: `كويز حصة ${selectedDate}`,
                score: Number(ev.quizGrade),
                max_score: Number(ev.quizTotal),
                created_at: new Date().toISOString(),
              });
            }
          }

          if (sqlRows.length > 0) {
            const { error } = await supabase.from('evaluations').upsert(sqlRows);
            if (error) {
              console.warn('Supabase bulk evaluations upsert warning:', error);
            }
          }
          if (offlineSqlRows.length > 0) {
            const { error: err2 } = await supabase.from('offline_results').upsert(offlineSqlRows);
            if (err2) {
              console.warn('Supabase bulk offline_results upsert warning:', err2);
            }
          }
        }
      } catch (sbErr) {
        console.warn('Supabase bulk evaluations upsert exception:', sbErr);
      }

      // Always save bulk to Firestore
      const batch = writeBatch(db);
      for (const student of students) {
        const ev = evaluationsSheet[student.uid];
        if (!ev) continue;
        const docId = `${student.uid}_${selectedDate}`;
        batch.set(
          doc(db, 'evaluations', docId),
          {
            studentUid: student.uid,
            studentName: student.displayName,
            studentId: student.studentId,
            centerId: selectedCenter,
            groupId: selectedGroup,
            date: selectedDate,
            quizGrade: ev.quizGrade ? Number(ev.quizGrade) : 0,
            quizTotal: ev.quizTotal ? Number(ev.quizTotal) : 10,
            homeworkStatus: ev.homeworkStatus,
            behaviorRating: ev.behaviorRating,
            teacherRemarks: ev.teacherRemarks.trim(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        batch.set(
          doc(db, 'offline_results', docId),
          {
            studentUid: student.uid,
            studentName: student.displayName,
            studentId: student.studentId,
            centerId: selectedCenter,
            groupId: selectedGroup,
            examTitle: `كويز حصة ${selectedDate}`,
            score: ev.quizGrade ? Number(ev.quizGrade) : 0,
            totalQuestions: ev.quizTotal ? Number(ev.quizTotal) : 10,
            createdAt: serverTimestamp(),
            type: 'offline',
          },
          { merge: true }
        );
      }
      await batch.commit();

      setEvaluationsSheet((prev) => {
        const next = { ...prev };
        students.forEach((s) => {
          if (next[s.uid]) next[s.uid].hasRecord = true;
        });
        return next;
      });

      alert('تم حفظ تقييمات المجموعة بالكامل بنجاح!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ التقييمات الجماعية');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvalConfirm = async () => {
    if (!studentToDeleteEval) return;
    const studentUid = studentToDeleteEval.uid;

    setSaving(studentUid);
    try {
      const docId = `${studentUid}_${selectedDate}`;

      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('evaluations').delete().eq('id', docId);
        if (error) throw error;
      } else {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'evaluations', docId));
        batch.delete(doc(db, 'offline_results', docId));
        await batch.commit();
      }

      setEvaluationsSheet((prev) => ({
        ...prev,
        [studentUid]: {
          quizGrade: '',
          quizTotal: '10',
          homeworkStatus: 'submitted',
          behaviorRating: 5,
          teacherRemarks: '',
          hasRecord: false,
        },
      }));
      setStudentToDeleteEval(null);
      alert('تم حذف التقييم بنجاح');
    } catch (err) {
      console.error('Error deleting evaluation:', err);
      alert('فشل حذف التقييم');
    } finally {
      setSaving(null);
    }
  };

  // Compute metrics summary
  let totalQuizzes = 0;
  let sumQuizPct = 0;
  let homeworkSubmitted = 0;

  students.forEach((student) => {
    const ev = evaluationsSheet[student.uid];
    if (ev && ev.quizGrade) {
      const score = Number(ev.quizGrade);
      const total = Number(ev.quizTotal) || 10;
      totalQuizzes++;
      sumQuizPct += (score / total) * 100;
    }
    if (ev && ev.homeworkStatus === 'submitted') {
      homeworkSubmitted++;
    }
  });

  const avgQuizPct = totalQuizzes > 0 ? (sumQuizPct / totalQuizzes).toFixed(0) : '0';
  const hwPct = students.length > 0 ? ((homeworkSubmitted / students.length) * 100).toFixed(0) : '0';

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
        accentColor="purple-500"
      />

      {students.length > 0 && (
        <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl backdrop-blur-md shadow-xl space-y-6">
          {/* Header Actions Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Award className="text-purple-500" size={18} />
                <span>رصد درجات الواجبات والكويزات اليومية</span>
              </h3>
              <p className="text-[10px] text-gray-500 font-bold mt-1">رصد درجات اختبار الحصة وسلوك الطلاب وأدائهم</p>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleSaveAll}
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:opacity-90 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer w-full sm:w-auto justify-center disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                <span>حفظ الكل (جدول الدرجات كاملاً)</span>
              </button>
            </div>
          </div>

          {/* Session Metrics summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
            <div className="flex justify-between items-center text-xs font-bold px-3">
              <span className="text-gray-400">متوسط درجات المجموعة:</span>
              <span className="text-purple-400 text-sm font-black">{avgQuizPct}%</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold px-3 border-t sm:border-t-0 sm:border-r border-white/5 pt-2 sm:pt-0">
              <span className="text-gray-400">نسبة تسليم الواجب:</span>
              <span className="text-emerald-500 text-sm font-black">{hwPct}% ({homeworkSubmitted}/{students.length})</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs min-w-[800px]">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="pb-3 text-center w-12">#</th>
                  <th className="pb-3 pr-2">اسم الطالب / الكود</th>
                  <th className="pb-3 text-center w-36">درجة الكويز</th>
                  <th className="pb-3 text-center w-36">تسليم الواجب</th>
                  <th className="pb-3 text-center w-40">السلوك والمشاركة</th>
                  <th className="pb-3 pr-2">ملاحظات المعلم</th>
                  <th className="pb-3 text-center w-24">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {students.map((student, idx) => {
                  const ev = evaluationsSheet[student.uid];
                  if (!ev) return null;
                  const isSaving = saving === student.uid;

                  return (
                    <tr key={student.uid} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3.5 text-center text-gray-500 font-bold">{idx + 1}</td>
                      <td className="py-3.5 pr-2">
                        <div className="font-bold text-white">{student.displayName}</div>
                        <span className="text-[9px] text-gray-500 font-bold block mt-0.5">{student.studentId}</span>
                      </td>

                      {/* Quiz grade */}
                      <td className="py-3.5">
                        <div className="flex items-center justify-center gap-1.5 max-w-[120px] mx-auto">
                          <input
                            type="number"
                            min="0"
                            placeholder="درجة"
                            value={ev.quizGrade}
                            onChange={(e) => handleLocalChange(student.uid, 'quizGrade', e.target.value)}
                            disabled={isSaving}
                            className="w-16 px-2 py-1 bg-white/[0.02] border border-white/10 rounded-lg text-center text-xs text-white focus:outline-none focus:border-purple-500/40 font-bold"
                          />
                          <span className="text-gray-500 font-bold">/</span>
                          <input
                            type="number"
                            min="1"
                            value={ev.quizTotal}
                            onChange={(e) => handleLocalChange(student.uid, 'quizTotal', e.target.value)}
                            disabled={isSaving}
                            className="w-14 px-2 py-1 bg-white/[0.02] border border-white/10 rounded-lg text-center text-xs text-gray-400 focus:outline-none focus:border-purple-500/40 font-bold"
                          />
                        </div>
                      </td>

                      {/* Homework status */}
                      <td className="py-3.5">
                        <select
                          value={ev.homeworkStatus}
                          onChange={(e) => handleLocalChange(student.uid, 'homeworkStatus', e.target.value)}
                          disabled={isSaving}
                          className="w-32 px-2 py-1 bg-white/[0.02] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500/40 font-bold cursor-pointer"
                        >
                          <option value="submitted" className="bg-[#0b0f19] text-emerald-400">تم التسليم</option>
                          <option value="late" className="bg-[#0b0f19] text-amber-400">تسليم متأخر</option>
                          <option value="not_submitted" className="bg-[#0b0f19] text-red-400">لم يسلم</option>
                        </select>
                      </td>

                      {/* Behavior Rating stars */}
                      <td className="py-3.5">
                        <div className="flex items-center justify-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleLocalChange(student.uid, 'behaviorRating', star)}
                              className="text-gray-600 hover:scale-110 transition-transform cursor-pointer disabled:opacity-50"
                            >
                              {star <= ev.behaviorRating ? (
                                <Star size={14} className="fill-amber-500 text-amber-500" />
                              ) : (
                                <StarOff size={14} className="text-gray-600" />
                              )}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Remarks */}
                      <td className="py-3.5 pr-2">
                        <input
                          type="text"
                          value={ev.teacherRemarks}
                          onChange={(e) => handleLocalChange(student.uid, 'teacherRemarks', e.target.value)}
                          disabled={isSaving}
                          placeholder="ملاحظات الحضور أو الواجب..."
                          className="w-full px-3 py-1.5 bg-white/[0.02] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500/40"
                        />
                      </td>

                      <td className="py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEvaluation(student.uid)}
                            disabled={isSaving}
                            className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-slate-950 rounded-lg transition-all cursor-pointer"
                            title="حفظ درجة الطالب"
                          >
                            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                          </button>
                          
                          {ev.hasRecord && (
                            <button
                              type="button"
                              onClick={() => setStudentToDeleteEval(student)}
                              className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all cursor-pointer"
                              title="حذف درجة الحصة"
                            >
                              <Trash2 size={12} />
                            </button>
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
          description="يرجى إضافة طلاب لهذه المجموعة أولاً من دليل الطلاب لتتمكن من رصد التقييمات."
          actionText="إضافة طلاب"
          onAction={() => window.location.reload()}
        />
      )}

      {/* Confirm Deletion Modal */}
      <ConfirmModal
        isOpen={studentToDeleteEval !== null}
        title="تأكيد حذف درجة وتقييم الحصة"
        message={`هل أنت متأكد من حذف وإلغاء تقييم ودرجة كويز الحصة للطالب "${studentToDeleteEval?.displayName}" بالكامل؟`}
        confirmText="حذف التقييم"
        cancelText="تراجع"
        type="danger"
        onConfirm={handleDeleteEvalConfirm}
        onCancel={() => setStudentToDeleteEval(null)}
      />
    </div>
  );
};
