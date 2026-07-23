import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Calendar,
  Star,
  Wallet,
  Loader2,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageCircle,
  TrendingUp,
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { Center, Group, Student } from '../../../hooks/useCenterData';
import { getGradeLabel, cleanPhone } from '../../../utils/arabicUtils';
import { GradeSparkline } from '../../../components/center/GradeSparkline';

interface CenterStudentProfileModalProps {
  student: Student;
  centers: Center[];
  groups: Group[];
  onClose: () => void;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'excused';
  studentUid?: string;
  studentName?: string;
  studentId?: string;
  centerId?: string;
  groupId?: string;
  timestamp?: any;
}

interface EvaluationRecord {
  id: string;
  date: string;
  quizGrade: number;
  quizTotal: number;
  homeworkStatus: string;
  behaviorRating: number;
  teacherRemarks: string;
  studentUid?: string;
  studentName?: string;
  studentId?: string;
  centerId?: string;
  groupId?: string;
  createdAt?: any;
}

interface PaymentRecord {
  id: string;
  title: string;
  type: 'subscription' | 'booklet' | 'installment';
  amount: number;
  status: 'paid' | 'pending';
  date: string;
  remarks?: string;
  studentUid?: string;
  studentName?: string;
  studentId?: string;
  timestamp?: any;
}

export const CenterStudentProfileModal: React.FC<CenterStudentProfileModalProps> = ({
  student,
  centers,
  groups,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'evaluations' | 'payments'>('evaluations');

  useEffect(() => {
    const loadProfileData = async () => {
      setLoading(true);
      try {
        let attList: AttendanceRecord[] = [];
        let evalList: EvaluationRecord[] = [];
        let payList: PaymentRecord[] = [];

        try {
          const attQuery = query(collection(db, 'attendance'), where('studentUid', '==', student.uid));
          const attSnap = await getDocs(attQuery);
          attList = attSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

          const evalQuery = query(collection(db, 'evaluations'), where('studentUid', '==', student.uid));
          const evalSnap = await getDocs(evalQuery);
          evalList = evalSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

          const payQuery = query(collection(db, 'center_payments'), where('studentUid', '==', student.uid));
          const paySnap = await getDocs(payQuery);
          payList = paySnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        } catch (fsErr) {
          console.warn('Firestore load profile details warning:', fsErr);
        }

        if (isSupabaseConfigured() && supabase) {
          try {
            // Fetch Attendance
            const { data: attData } = await supabase
              .from('attendance')
              .select('*')
              .eq('student_uid', student.uid);
            if (attData) {
              const attMap = new Map(attList.map(item => [item.id, item]));
              attData.forEach((row: any) => {
                attMap.set(row.id, {
                  id: row.id,
                  studentUid: row.student_uid,
                  studentName: row.student_name,
                  studentId: row.student_id,
                  centerId: row.center_id,
                  groupId: row.group_id,
                  date: row.date,
                  status: row.status,
                  timestamp: row.timestamp,
                });
              });
              attList = Array.from(attMap.values());
            }

            // Fetch Evaluations
            const { data: evalData } = await supabase
              .from('evaluations')
              .select('*')
              .eq('student_uid', student.uid);
            if (evalData) {
              const evalMap = new Map(evalList.map(item => [item.id, item]));
              evalData.forEach((row: any) => {
                evalMap.set(row.id, {
                  id: row.id,
                  studentUid: row.student_uid,
                  studentName: row.student_name,
                  studentId: row.student_id,
                  centerId: row.center_id,
                  groupId: row.group_id,
                  date: row.date,
                  quizGrade: row.quiz_grade,
                  quizTotal: row.quiz_total,
                  homeworkStatus: row.homework_status,
                  behaviorRating: row.behavior_rating,
                  teacherRemarks: row.teacher_remarks,
                  createdAt: row.created_at,
                });
              });
              evalList = Array.from(evalMap.values());
            }

            // Fetch Payments
            const { data: payData } = await supabase
              .from('center_payments')
              .select('*')
              .eq('student_uid', student.uid);
            if (payData) {
              const payMap = new Map(payList.map(item => [item.id, item]));
              payData.forEach((row: any) => {
                payMap.set(row.id, {
                  id: row.id,
                  studentUid: row.student_uid,
                  studentName: row.student_name,
                  studentId: row.student_id,
                  title: row.title,
                  type: row.type,
                  amount: Number(row.amount || 0),
                  status: row.status,
                  date: row.date,
                  remarks: row.remarks,
                  timestamp: row.timestamp,
                });
              });
              payList = Array.from(payMap.values());
            }
          } catch (sbErr) {
            console.warn('Supabase load profile details failed:', sbErr);
          }
        }

        attList.sort((a, b) => b.date.localeCompare(a.date));
        evalList.sort((a, b) => b.date.localeCompare(a.date));
        payList.sort((a, b) => b.date.localeCompare(a.date));

        setAttendance(attList);
        setEvaluations(evalList);
        setPayments(payList);
      } catch (err) {
        console.error('Error loading student profile data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [student.uid]);

  const studentCenter = centers.find((c) => c.id === student.centerId)?.name || 'غير محدد';
  const studentGroup = groups.find((g) => g.id === student.groupId)?.name || 'غير محدد';

  // Compute Statistics
  const totalClasses = attendance.length;
  const presentClasses = attendance.filter((a) => a.status === 'present').length;
  const attendanceRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 100;

  const totalEvaluations = evaluations.length;
  const avgQuizGrade =
    totalEvaluations > 0
      ? Math.round(
          (evaluations.reduce((sum, ev) => sum + (ev.quizGrade / ev.quizTotal), 0) / totalEvaluations) * 100
        )
      : 100;

  const totalPaid = payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-4 text-right" dir="rtl">
      <div className="w-full max-w-4xl bg-[#060913] border border-white/5 rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden relative shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute left-4 top-4 md:left-6 md:top-6 text-gray-500 hover:text-white transition-colors cursor-pointer z-50 p-1.5 bg-white/5 border border-white/10 rounded-lg"
        >
          <X size={16} />
        </button>

        {/* Modal Header & Student Info Card */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 md:p-5 mb-4 md:mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 relative overflow-hidden mt-6 md:mt-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="md:col-span-2 flex items-center gap-3 md:gap-4 relative z-10 w-full">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-base md:text-xl font-bold flex items-center justify-center rounded-xl md:rounded-2xl shrink-0">
              <User size={24} />
            </div>
            <div className="space-y-0.5 md:space-y-1 min-w-0 flex-1">
              <h2 className="text-sm md:text-lg font-black text-white whitespace-normal break-words leading-tight">{student.displayName}</h2>
              <div className="flex flex-wrap items-center gap-x-2 md:gap-x-3 gap-y-1 text-[10px] md:text-xs text-gray-400 font-bold">
                <span className="text-amber-500 font-black">كود: {student.studentId}</span>
                <span className="inline">•</span>
                <span>الصف: {getGradeLabel(student.grade)}</span>
                <span className="inline">•</span>
                <span>السنتر: {studentCenter}</span>
                <span className="inline">•</span>
                <span>المجموعة: {studentGroup}</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-[9px] md:text-[10px] font-black">
                  الباقة: {(student as any).packageName || "بدون باقة نشطة"}
                </span>
                
                {(student as any).packageName && (
                  (student as any).subscriptionType === 'monthly' ? (
                    (() => {
                      if (!(student as any).subscriptionEndDate) {
                        return (
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-[9px] md:text-[10px] font-black">
                            الاشتراك الشهري: غير نشط ❌
                          </span>
                        );
                      }
                      
                      const expiry = new Date((student as any).subscriptionEndDate);
                      const today = new Date();
                      expiry.setHours(0,0,0,0);
                      today.setHours(0,0,0,0);
                      const diffTime = expiry.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      
                      if (diffDays < 0) {
                        return (
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-[9px] md:text-[10px] font-black">
                            الاشتراك: منتهي منذ {Math.abs(diffDays)} يوم ⚠️
                          </span>
                        );
                      } else if (diffDays <= 3) {
                        return (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-[9px] md:text-[10px] font-black">
                            الاشتراك: ينتهي بعد {diffDays} يوم ⏳
                          </span>
                        );
                      } else {
                        return (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[9px] md:text-[10px] font-black">
                            الاشتراك: نشط (متبقي {diffDays} يوم) ✅
                          </span>
                        );
                      }
                    })()
                  ) : (
                    <span className={`px-2 py-0.5 rounded-md text-[9px] md:text-[10px] font-black border ${
                      ((student as any).remainingSessions ?? 0) <= 0
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      الحصص المتبقية: {(student as any).remainingSessions ?? 0} حصة
                    </span>
                  )
                )}

                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-[9px] md:text-[10px] font-black flex items-center gap-1">
                  <Star size={10} className="fill-amber-400 text-amber-400" />
                  <span>نقاط التميز: {(student as any).pointsBalance ?? 0} نقطة</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick contact list with WhatsApp action */}
          <div className="flex flex-col gap-1.5 text-[10px] text-gray-400 font-bold w-full relative z-10 border-t border-white/5 md:border-r md:border-t-0 md:pr-4 md:border-white/5 pt-3 md:pt-0">
            {student.studentPhone && (
              <div className="flex items-center justify-between border-b border-white/2 pb-1 last:border-0 last:pb-0">
                <span>هاتف الطالب:</span>
                <span className="text-white font-mono text-[11px]">{student.studentPhone}</span>
              </div>
            )}
            {student.fatherPhone && (
              <div className="flex items-center justify-between border-b border-white/2 pb-1 last:border-0 last:pb-0">
                <span>هاتف الأب:</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-[11px]">{student.fatherPhone}</span>
                  <a
                    href={`https://wa.me/2${cleanPhone(student.fatherPhone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/20 text-emerald-400 rounded-lg transition-all cursor-pointer shrink-0"
                    title="واتساب الأب"
                  >
                    <MessageCircle size={11} />
                  </a>
                </div>
              </div>
            )}
            {student.motherPhone && (
              <div className="flex items-center justify-between border-b border-white/2 pb-1 last:border-0 last:pb-0">
                <span>هاتف الأم:</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-[11px]">{student.motherPhone}</span>
                  <a
                    href={`https://wa.me/2${cleanPhone(student.motherPhone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/20 text-emerald-400 rounded-lg transition-all cursor-pointer shrink-0"
                    title="واتساب الأم"
                  >
                    <MessageCircle size={11} />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="bg-gradient-to-br from-emerald-500/5 to-transparent border border-emerald-500/10 hover:border-emerald-500/20 p-3 md:p-4 rounded-xl text-center space-y-0.5 md:space-y-1 transition-all shadow-[0_4px_20px_rgba(16,185,129,0.02)]">
            <span className="text-[8px] md:text-[9px] text-gray-400 font-black block uppercase tracking-wider">نسبة الحضور</span>
            <span className={`text-sm md:text-lg font-black block drop-shadow-[0_0_8px_rgba(16,185,129,0.15)] ${attendanceRate >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{attendanceRate}%</span>
          </div>
          <div className="bg-gradient-to-br from-amber-500/5 to-transparent border border-amber-500/10 hover:border-amber-500/20 p-3 md:p-4 rounded-xl text-center space-y-0.5 md:space-y-1 transition-all shadow-[0_4px_20px_rgba(245,158,11,0.02)]">
            <span className="text-[8px] md:text-[9px] text-gray-400 font-black block uppercase tracking-wider">متوسط الدرجات</span>
            <span className={`text-sm md:text-lg font-black block drop-shadow-[0_0_8px_rgba(245,158,11,0.15)] ${avgQuizGrade >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>{avgQuizGrade}%</span>
          </div>
          <div className="bg-gradient-to-br from-teal-500/5 to-transparent border border-teal-500/10 hover:border-teal-500/20 p-3 md:p-4 rounded-xl text-center space-y-0.5 md:space-y-1 transition-all shadow-[0_4px_20px_rgba(20,184,166,0.02)]">
            <span className="text-[8px] md:text-[9px] text-gray-400 font-black block uppercase tracking-wider">إجمالي المدفوع</span>
            <span className="text-sm md:text-lg font-black text-teal-400 block drop-shadow-[0_0_8px_rgba(20,184,166,0.15)]">{totalPaid} ج.م</span>
          </div>
          <div className="bg-gradient-to-br from-rose-500/5 to-transparent border border-rose-500/10 hover:border-rose-500/20 p-3 md:p-4 rounded-xl text-center space-y-0.5 md:space-y-1 transition-all shadow-[0_4px_20px_rgba(244,63,94,0.02)]">
            <span className="text-[8px] md:text-[9px] text-gray-400 font-black block uppercase tracking-wider">أقساط متبقية</span>
            <span className={`text-sm md:text-lg font-black block drop-shadow-[0_0_8px_rgba(244,63,94,0.15)] ${totalPending > 0 ? 'text-rose-400' : 'text-gray-400'}`}>{totalPending} ج.م</span>
          </div>
        </div>

        {/* Navigation Tabs inside Modal */}
        <div className="flex border-b border-white/5 mb-4 md:mb-6 overflow-x-auto whitespace-nowrap scrollbar-none gap-2">
          <button
            onClick={() => setActiveSubTab('evaluations')}
            className={`pb-3 px-4 md:px-6 text-[10px] md:text-xs font-black border-b-2 transition-all cursor-pointer shrink-0 ${
              activeSubTab === 'evaluations' ? 'border-amber-500 text-white font-extrabold' : 'border-transparent text-gray-500'
            }`}
          >
            التقييمات والدرجات ({totalEvaluations})
          </button>
          <button
            onClick={() => setActiveSubTab('attendance')}
            className={`pb-3 px-4 md:px-6 text-[10px] md:text-xs font-black border-b-2 transition-all cursor-pointer shrink-0 ${
              activeSubTab === 'attendance' ? 'border-emerald-500 text-white font-extrabold' : 'border-transparent text-gray-500'
            }`}
          >
            سجل الحضور والغياب ({totalClasses})
          </button>
          <button
            onClick={() => setActiveSubTab('payments')}
            className={`pb-3 px-4 md:px-6 text-[10px] md:text-xs font-black border-b-2 transition-all cursor-pointer shrink-0 ${
              activeSubTab === 'payments' ? 'border-pink-500 text-white font-extrabold' : 'border-transparent text-gray-500'
            }`}
          >
            سجل المدفوعات والماليات ({payments.length})
          </button>
        </div>

        {/* Tab Content Box */}
        <div className="flex-1 overflow-y-auto min-h-[30vh]">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-amber-500" size={30} />
              <p className="text-[10px] text-gray-500 font-bold">جاري تحميل سجل الطالب بالكامل...</p>
            </div>
          ) : (
            <>
              {/* EVALUATIONS TAB */}
              {activeSubTab === 'evaluations' && (
                <div className="space-y-4">
                  {evaluations.length >= 2 && (
                    <div className="p-5 bg-white/[0.01] border border-white/5 rounded-3xl mb-4 flex flex-col items-center">
                      <h4 className="text-[9px] text-gray-500 font-black uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <TrendingUp size={12} className="text-purple-400" />
                        <span>منحنى تقدم درجات الكويزات الأسبوعية</span>
                      </h4>
                      <GradeSparkline
                        grades={evaluations.map((ev) => ({
                          score: Number(ev.quizGrade || 0),
                          total: Number(ev.quizTotal || 10),
                          date: ev.date,
                        })).reverse()}
                      />
                    </div>
                  )}

                  {evaluations.length === 0 ? (
                    <div className="text-center py-10 text-gray-600 text-xs font-bold">لم يتم تسجيل أي درجات أو تقييمات لهذا الطالب بعد.</div>
                  ) : (
                    evaluations.map((ev) => (
                      <div key={ev.id} className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all">
                        <div className="space-y-1">
                          <div className="text-xs font-black text-white">تاريخ الحصة: {ev.date}</div>
                          <div className="flex flex-wrap gap-3 text-[10px] text-gray-400 font-bold mt-1">
                            <span>درجة الكويز: <strong className="text-amber-400 font-black">{ev.quizGrade} / {ev.quizTotal}</strong></span>
                            <span>•</span>
                            <span>الواجب: {
                              ev.homeworkStatus === 'submitted' ? <span className="text-emerald-400">تم التسليم ✅</span> :
                              ev.homeworkStatus === 'incomplete' ? <span className="text-amber-400">غير مكتمل ⚠️</span> :
                              <span className="text-red-400">لم يسلم ❌</span>
                            }</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              السلوك: {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} size={10} className={star <= ev.behaviorRating ? 'fill-amber-400 text-amber-400' : 'text-gray-600'} />
                              ))}
                            </span>
                          </div>
                          {ev.teacherRemarks && (
                            <p className="text-[10px] text-gray-500 italic mt-2">ملاحظة المعلم: "{ev.teacherRemarks}"</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ATTENDANCE TAB */}
              {activeSubTab === 'attendance' && (
                <div className="space-y-3">
                  {attendance.length === 0 ? (
                    <div className="text-center py-10 text-gray-600 text-xs font-bold">لم يتم تسجيل أي حضور أو غياب لهذا الطالب بعد.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {attendance.map((att) => {
                        const icon =
                          att.status === 'present' ? (
                            <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                          ) : att.status === 'absent' ? (
                            <XCircle size={14} className="text-red-400 shrink-0" />
                          ) : (
                            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                          );

                        const label = att.status === 'present' ? 'حاضر' : att.status === 'absent' ? 'غائب' : 'مستثنى';
                        const badgeColor =
                          att.status === 'present'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : att.status === 'absent'
                            ? 'bg-red-500/10 border-red-500/20 text-red-400'
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400';

                        return (
                          <div
                            key={att.id}
                            className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-gray-500" />
                              <span className="text-xs font-bold text-white">{att.date}</span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black border flex items-center gap-1 ${badgeColor}`}>
                              {icon}
                              <span>{label}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* PAYMENTS TAB */}
              {activeSubTab === 'payments' && (
                <div className="space-y-3">
                  {payments.length === 0 ? (
                    <div className="text-center py-10 text-gray-600 text-xs font-bold">لم يتم تسجيل أي فواتير أو مدفوعات مالية لهذا الطالب بعد.</div>
                  ) : (
                    payments.map((p) => {
                      const typeLabel =
                        p.type === 'booklet'
                          ? 'ملزمة / مذكرات'
                          : p.type === 'installment'
                          ? 'قسط مالي'
                          : 'اشتراك شهري';

                      return (
                        <div key={p.id} className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all">
                          <div className="space-y-1">
                            <h4 className="text-xs font-black text-white">{p.title}</h4>
                            <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 font-bold">
                              <span>النوع: {typeLabel}</span>
                              <span>•</span>
                              <span>التاريخ: {p.date}</span>
                            </div>
                            {p.remarks && (
                              <p className="text-[10px] text-gray-500 italic mt-1.5">ملاحظات: {p.remarks}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                            <div className="text-left">
                              <span className="text-[9px] text-gray-500 font-bold block">المبلغ</span>
                              <span className="text-xs font-black text-white">{p.amount} ج.م</span>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-full text-[9px] font-black border uppercase ${
                                p.status === 'paid'
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                  : 'bg-red-500/10 border-red-500/20 text-red-500'
                              }`}
                            >
                              {p.status === 'paid' ? 'مدفوع' : 'معلق'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
