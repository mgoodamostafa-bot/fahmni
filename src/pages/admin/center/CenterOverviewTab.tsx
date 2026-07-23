import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  CheckCircle,
  Star,
  Coins,
  ArrowLeft,
  ChevronLeft,
  Database,
  Download,
  Upload,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  FolderKanban,
  CheckSquare,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { Center, Group, Student } from '../../../hooks/useCenterData';
import { centerStudentService } from '../../../services/centerStudentService';
import { StatCard } from '../../../components/center/StatCard';
import { AttendanceSummaryChart } from '../../../components/center/AttendanceSummaryChart';
import { SmartAlerts, AlertItem } from '../../../components/center/SmartAlerts';
import { ConfirmModal } from '../../../components/center/ConfirmModal';

interface CenterOverviewTabProps {
  centers: Center[];
  groups: Group[];
  allCenterStudents: Student[];
  onNavigateTab: (tab: 'directory' | 'attendance' | 'evaluations' | 'financials') => void;
  loading: boolean;
  importStatus: string | null;
  onExportJSON: (type: 'students' | 'attendance' | 'evaluations' | 'payments') => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>, type: 'students' | 'attendance' | 'evaluations' | 'payments') => void;
  onExportCSV: (type: 'students' | 'attendance' | 'evaluations' | 'payments') => void;
  onImportCSV: (e: React.ChangeEvent<HTMLInputElement>, type: 'students' | 'attendance' | 'evaluations' | 'payments') => void;
  onDownloadTemplate: () => void;
  onResetCodes: () => void;
}

export const CenterOverviewTab: React.FC<CenterOverviewTabProps> = ({
  centers,
  groups,
  allCenterStudents,
  onNavigateTab,
  loading,
  importStatus,
  onExportJSON,
  onImportJSON,
  onExportCSV,
  onImportCSV,
  onDownloadTemplate,
  onResetCodes,
}) => {
  const navigate = useNavigate();
  const [isMigrating, setIsMigrating] = useState(false);
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);
  
  // Real stats state loaded asynchronously
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    excused: 0,
    paidSum: 0,
    pendingSum: 0,
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    const fetchGlobalStats = async () => {
      setLoadingStats(true);
      try {
        let present = 0;
        let absent = 0;
        let excused = 0;
        let paidSum = 0;
        let pendingSum = 0;

        if (isSupabaseConfigured() && supabase) {
          // 1. Fetch Attendance Stats
          const { data: attData } = await supabase.from('attendance').select('status');
          if (attData) {
            attData.forEach((row: any) => {
              if (row.status === 'present') present++;
              else if (row.status === 'absent') absent++;
              else if (row.status === 'excused') excused++;
            });
          }

          // 2. Fetch Payment Stats
          const { data: payData } = await supabase.from('center_payments').select('status, amount');
          if (payData) {
            payData.forEach((row: any) => {
              const val = Number(row.amount || 0);
              if (row.status === 'paid') paidSum += val;
              else if (row.status === 'pending') pendingSum += val;
            });
          }
        } else {
          // Firebase fallbacks
          const attSnap = await getDocs(collection(db, 'attendance'));
          attSnap.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'present') present++;
            else if (data.status === 'absent') absent++;
            else if (data.status === 'excused') excused++;
          });

          const paySnap = await getDocs(collection(db, 'center_payments'));
          paySnap.forEach((doc) => {
            const data = doc.data();
            const val = Number(data.amount || 0);
            if (data.status === 'paid') paidSum += val;
            else if (data.status === 'pending') pendingSum += val;
          });
        }

        setStats({ present, absent, excused, paidSum, pendingSum });

        // Generate Smart Alerts dynamically
        const newAlerts: AlertItem[] = [];
        if (pendingSum > 500) {
          newAlerts.push({
            id: 'unpaid_alerts',
            type: 'warning',
            title: 'تحصيل متأخرات مالية',
            description: `يوجد إجمالي أقساط معلقة بقيمة ${pendingSum} ج.م في انتظار التحصيل.`,
          });
        }
        if (absent > 0 && present > 0) {
          const totalAtt = present + absent + excused;
          const pct = (present / totalAtt) * 100;
          if (pct < 85) {
            newAlerts.push({
              id: 'low_attendance',
              type: 'danger',
              title: 'نسبة الحضور منخفضة',
              description: `متوسط نسبة حضور الطلاب المجموع الكلي هو ${pct.toFixed(0)}% وهو أقل من النطاق المستهدف.`,
            });
          }
        }
        setAlerts(newAlerts);

      } catch (err) {
        console.error('Error loading global stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchGlobalStats();
  }, [allCenterStudents]);

  const handleMigration = async () => {
    setShowMigrateConfirm(false);
    setIsMigrating(true);
    try {
      const res = await centerStudentService.migrateLegacyStudents();
      alert(`تم الترحيل بنجاح!\nعدد الطلاب المرحلين: ${res.migrated}\nالأخطاء: ${res.errors.length > 0 ? res.errors.join(', ') : 'لا يوجد أخطاء'}`);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert('فشل ترحيل البيانات: ' + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick stats banner using StatCard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          title="الفروع المضافة (السناتر)"
          value={`${centers.length} فروع`}
          icon={Building2}
          colorClass="text-brand-blue bg-blue-500/10 border-blue-500/20"
          glowColor="rgba(59, 130, 246, 0.05)"
        />
        <StatCard
          title="مجموعات العمل النشطة"
          value={`${groups.length} مجموعات`}
          icon={FolderKanban}
          colorClass="text-purple-500 bg-purple-500/10 border-purple-500/20"
          glowColor="rgba(168, 85, 247, 0.05)"
        />
        <StatCard
          title="الطلاب المقيدين بالسناتر"
          value={`${allCenterStudents.length} طلاب`}
          icon={Users}
          colorClass="text-amber-500 bg-amber-500/10 border-amber-500/20"
          glowColor="rgba(245, 158, 11, 0.05)"
        />
      </div>

      {/* Analytics & Real-Time charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Summary */}
        <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl backdrop-blur-md shadow-xl lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CheckSquare className="text-emerald-500" size={18} />
              <span>معدلات الحضور الإجمالية للمجموعات</span>
            </h3>
            <span className="text-[10px] text-gray-500 font-bold uppercase">التقرير التراكمي</span>
          </div>
          {loadingStats ? (
            <div className="flex items-center justify-center p-12 gap-3">
              <Loader2 className="animate-spin text-emerald-500" size={18} />
              <span className="text-xs text-gray-400 font-bold">جاري حساب التحليلات...</span>
            </div>
          ) : (
            <AttendanceSummaryChart
              presentCount={stats.present}
              absentCount={stats.absent}
              excusedCount={stats.excused}
            />
          )}
        </div>

        {/* Financial Overview stats */}
        <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl backdrop-blur-md shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Coins className="text-pink-500" size={18} />
              <span>المدفوعات والمستحقات المالية</span>
            </h3>
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-gray-400">إجمالي المبالغ المحصلة:</span>
                <span className="text-emerald-500">{stats.paidSum} ج.م</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-gray-400">إجمالي الأقساط المعلقة:</span>
                <span className="text-amber-500">{stats.pendingSum} ج.م</span>
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="space-y-1.5 mt-6 pt-4 border-t border-white/5">
            <div className="flex justify-between text-[10px] text-gray-500 font-bold">
              <span>نسبة التحصيل</span>
              <span>
                {stats.paidSum + stats.pendingSum > 0
                  ? ((stats.paidSum / (stats.paidSum + stats.pendingSum)) * 100).toFixed(0)
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${
                    stats.paidSum + stats.pendingSum > 0
                      ? (stats.paidSum / (stats.paidSum + stats.pendingSum)) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Smart Alerts section */}
      {!loadingStats && alerts.length > 0 && (
        <SmartAlerts alerts={alerts} />
      )}

      {/* Redesigned grid operations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CARD 1: Registration and Directory */}
        <div
          onClick={() => onNavigateTab('directory')}
          className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 flex flex-col justify-between hover:border-amber-500/20 transition-all duration-300 cursor-pointer group hover:-translate-y-1 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-4 relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
              <Users size={22} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-white group-hover:text-amber-500 transition-colors">دليل وتعديل الطلاب</h4>
              <p className="text-[11px] text-gray-400 font-bold leading-normal">توليد الأكواد، الكروت، التعديل والحذف، والاستيراد الجماعي.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-black text-amber-500 mt-8 pt-4 border-t border-white/5">
            <span>فتح دليل الطلاب</span>
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>

        {/* CARD 2: Attendance Marking */}
        <div
          onClick={() => onNavigateTab('attendance')}
          className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 flex flex-col justify-between hover:border-emerald-500/20 transition-all duration-300 cursor-pointer group hover:-translate-y-1 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-4 relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
              <CheckCircle size={22} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-white group-hover:text-emerald-500 transition-colors">حضور وغياب المجموعات</h4>
              <p className="text-[11px] text-gray-400 font-bold leading-normal">رصد غياب وحضور طلاب السناتر، تعديل وحذف سجلات الحضور.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400 mt-8 pt-4 border-t border-white/5">
            <span>رصد كشف حضور الحصة</span>
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>

        {/* CARD 3: Grades and Evaluations */}
        <div
          onClick={() => onNavigateTab('evaluations')}
          className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 flex flex-col justify-between hover:border-purple-500/20 transition-all duration-300 cursor-pointer group hover:-translate-y-1 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-4 relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 text-slate-950 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
              <Star size={22} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-white group-hover:text-purple-400 transition-colors">تقييمات الحصص والدرجات</h4>
              <p className="text-[11px] text-gray-400 font-bold leading-normal">تسجيل درجات الامتحانات السريعة والواجبات وسلوك الطلاب.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-black text-purple-400 mt-8 pt-4 border-t border-white/5">
            <span>رصد التقييمات اليومية</span>
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>

        {/* CARD 4: Financials & Installments */}
        <div
          onClick={() => onNavigateTab('financials')}
          className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 flex flex-col justify-between hover:border-pink-500/20 transition-all duration-300 cursor-pointer group hover:-translate-y-1 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-pink-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-4 relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 text-slate-950 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
              <Coins size={22} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-white group-hover:text-pink-400 transition-colors">الماليات والاشتراكات</h4>
              <p className="text-[11px] text-gray-400 font-bold leading-normal">إضافة فواتير الملازم، الاشتراكات الشهرية، تعديل وحذف الأقساط.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-black text-pink-400 mt-8 pt-4 border-t border-white/5">
            <span>إدارة المصروفات والأقساط</span>
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Sub-features links card */}
      <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Building2 className="text-brand-blue" />
            <span>إعدادات الفروع والباركود والمجموعات الفرعية</span>
          </h3>
          <p className="text-[10px] text-gray-500 font-bold mt-1">روابط إعداد البنية التحتية لنظام السناتر بالمنصة</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'إدارة فروع السناتر', path: '/teacher/branches', desc: 'إضافة وتعديل بيانات مواقع الفروع الفعالة' },
            { title: 'إدارة الجروبات والمجموعات', path: '/teacher/groups', desc: 'تحديد مواعيد وتوقيتات مجموعات السنتر' },
            { title: 'تسجيل حضور بالباركود QR', path: '/teacher/attendance', desc: 'فتح كاميرا الهاتف أو الاسكانر للتحضير' },
            { title: 'النتائج والامتحانات الورقية', path: '/teacher/offline-results', desc: 'رفع وتنزيل نتائج الامتحانات الورقية' },
          ].map((link, idx) => (
            <div
              key={idx}
              onClick={() => navigate(link.path)}
              className="p-4 bg-white/[0.02] hover:bg-white/5 border border-white/5 rounded-2xl cursor-pointer hover:border-white/10 transition-all space-y-2 flex flex-col justify-between shadow-md"
            >
              <h4 className="text-xs font-black text-white">{link.title}</h4>
              <p className="text-[10px] text-gray-500 font-bold">{link.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Backup & Import/Export management panel */}
      <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Database size={20} />
          </span>
          <div>
            <h3 className="text-sm font-black text-white">إدارة وحفظ النسخ الاحتياطية (تصدير واستيراد)</h3>
            <p className="text-[10px] text-gray-500 font-bold">قم بتصدير البيانات دورياً وتنزيلها على جهازك لتوفير مساحة السيرفر وسرعة التصفح.</p>
          </div>
        </div>

        {importStatus && (
          <div className="p-3.5 bg-brand-blue/10 border border-brand-blue/20 rounded-xl text-brand-blue text-xs font-black flex items-center gap-2">
            <Loader2 className="animate-spin" size={16} />
            <span>{importStatus}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Export Options */}
          <div className="space-y-3 p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
            <h4 className="text-xs font-black text-gray-300 flex items-center gap-1.5">
              <Download size={14} className="text-brand-blue" />
              <span>تصدير البيانات (JSON)</span>
            </h4>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onExportJSON('students')}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-black/40 hover:bg-black/60 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <span>تصدير ملف الطلاب</span>
                <Download size={12} className="text-gray-500" />
              </button>
              <button
                onClick={() => onExportJSON('attendance')}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-black/40 hover:bg-black/60 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <span>تصدير سجلات الحضور</span>
                <Download size={12} className="text-gray-500" />
              </button>
              <button
                onClick={() => onExportJSON('evaluations')}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-black/40 hover:bg-black/60 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <span>تصدير تقييمات الحصص</span>
                <Download size={12} className="text-gray-500" />
              </button>
              <button
                onClick={() => onExportJSON('payments')}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-black/40 hover:bg-black/60 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <span>تصدير فواتير وماليات السناتر</span>
                <Download size={12} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Import Options */}
          <div className="space-y-3 p-5 bg-white/[0.02] border border-white/5 rounded-2xl md:col-span-2">
            <h4 className="text-xs font-black text-gray-300 flex items-center gap-1.5">
              <Upload size={14} className="text-emerald-500" />
              <span>استيراد واستعادة البيانات (JSON)</span>
            </h4>
            <p className="text-[10px] text-gray-500 leading-normal font-bold">
              اختر ملف النسخة الاحتياطية (تنسيق JSON) الذي قمت بتحميله سابقاً ليتم دمجه وإعادة رفعه لقاعدة البيانات تلقائياً.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <label className="flex flex-col items-center justify-center p-3 bg-black/30 hover:bg-black/50 border border-white/5 rounded-xl cursor-pointer text-center space-y-1 transition-colors">
                <Upload size={14} className="text-gray-400" />
                <span className="text-[10px] font-black text-white">استيراد الطلاب</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => onImportJSON(e, 'students')}
                />
              </label>

              <label className="flex flex-col items-center justify-center p-3 bg-black/30 hover:bg-black/50 border border-white/5 rounded-xl cursor-pointer text-center space-y-1 transition-colors">
                <Upload size={14} className="text-gray-400" />
                <span className="text-[10px] font-black text-white">استيراد الحضور</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => onImportJSON(e, 'attendance')}
                />
              </label>

              <label className="flex flex-col items-center justify-center p-3 bg-black/30 hover:bg-black/50 border border-white/5 rounded-xl cursor-pointer text-center space-y-1 transition-colors">
                <Upload size={14} className="text-gray-400" />
                <span className="text-[10px] font-black text-white">استيراد التقييمات</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => onImportJSON(e, 'evaluations')}
                />
              </label>

              <label className="flex flex-col items-center justify-center p-3 bg-black/30 hover:bg-black/50 border border-white/5 rounded-xl cursor-pointer text-center space-y-1 transition-colors">
                <Upload size={14} className="text-gray-400" />
                <span className="text-[10px] font-black text-white">استيراد الماليات</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => onImportJSON(e, 'payments')}
                />
              </label>
            </div>
          </div>

          {/* Excel (CSV) Import/Export Panel */}
          <div className="space-y-3 p-5 bg-white/[0.02] border border-white/5 rounded-2xl md:col-span-3 mt-4">
            <h4 className="text-xs font-black text-gray-300 flex items-center gap-1.5 border-b border-white/5 pb-2">
              <FileSpreadsheet size={14} className="text-emerald-400" />
              <span>استيراد وتصدير التقارير عبر Excel (CSV)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
              {/* Students Excel */}
              <div className="space-y-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-black text-white block">1. دليل وتفاصيل الطلاب</span>
                <div className="space-y-1.5 mt-2">
                  <button
                    onClick={() => onExportCSV('students')}
                    className="w-full text-center py-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/20 text-emerald-400 font-black text-[9px] rounded-lg transition-all cursor-pointer"
                  >
                    تصدير كشف الطلاب Excel
                  </button>
                  <label className="w-full text-center py-2 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/20 text-amber-400 font-black text-[9px] rounded-lg transition-all block cursor-pointer">
                    <span>استيراد الطلاب Excel</span>
                    <input type="file" accept=".csv" onChange={(e) => onImportCSV(e, 'students')} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Attendance Excel */}
              <div className="space-y-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-black text-white block">2. سجلات الحضور والغياب</span>
                <div className="space-y-1.5 mt-2">
                  <button
                    onClick={() => onExportCSV('attendance')}
                    className="w-full text-center py-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/20 text-emerald-400 font-black text-[9px] rounded-lg transition-all cursor-pointer"
                  >
                    تصدير سجل الحضور Excel
                  </button>
                  <label className="w-full text-center py-2 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/20 text-amber-400 font-black text-[9px] rounded-lg transition-all block cursor-pointer">
                    <span>استيراد الحضور Excel</span>
                    <input type="file" accept=".csv" onChange={(e) => onImportCSV(e, 'attendance')} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Evaluations Excel */}
              <div className="space-y-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-black text-white block">3. تقييمات الحصص اليومية</span>
                <div className="space-y-1.5 mt-2">
                  <button
                    onClick={() => onExportCSV('evaluations')}
                    className="w-full text-center py-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/20 text-emerald-400 font-black text-[9px] rounded-lg transition-all cursor-pointer"
                  >
                    تصدير تقييمات الحصص Excel
                  </button>
                  <label className="w-full text-center py-2 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/20 text-amber-400 font-black text-[9px] rounded-lg transition-all block cursor-pointer">
                    <span>استيراد التقييمات Excel</span>
                    <input type="file" accept=".csv" onChange={(e) => onImportCSV(e, 'evaluations')} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Payments Excel */}
              <div className="space-y-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-black text-white block">4. سجل المدفوعات والماليات</span>
                <div className="space-y-1.5 mt-2">
                  <button
                    onClick={() => onExportCSV('payments')}
                    className="w-full text-center py-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/20 text-emerald-400 font-black text-[9px] rounded-lg transition-all cursor-pointer"
                  >
                    تصدير فواتير الماليات Excel
                  </button>
                  <label className="w-full text-center py-2 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/20 text-amber-400 font-black text-[9px] rounded-lg transition-all block cursor-pointer">
                    <span>استيراد الماليات Excel</span>
                    <input type="file" accept=".csv" onChange={(e) => onImportCSV(e, 'payments')} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            {/* Template and ID resets buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-white/5">
              <button
                onClick={onDownloadTemplate}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-black text-[10px] rounded-xl transition-all cursor-pointer"
              >
                تنزيل نموذج ملف الاستيراد Excel template
              </button>
              <button
                onClick={onResetCodes}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 font-black text-[10px] rounded-xl transition-all cursor-pointer"
              >
                ⚠️ إعادة توليد وترتيب أكواد طلاب السناتر المقيدين بالكامل
              </button>
              {allCenterStudents.length === 0 && (
                <button
                  onClick={() => setShowMigrateConfirm(true)}
                  disabled={isMigrating}
                  className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-500 font-black text-[10px] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isMigrating ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                  <span>ترحيل بيانات الطلاب القديمة (Migration)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Migration confirmation modal */}
      <ConfirmModal
        isOpen={showMigrateConfirm}
        title="ترحيل بيانات طلاب السنتر القدامى"
        message="هل أنت متأكد من ترحيل بيانات جميع طلاب السنتر القدامى من المنصة إلى النظام المعزول؟ سيتم نقل الطلاب تلقائياً وحذفهم من قائمة المنصة الرئيسية."
        confirmText="ترحيل الآن"
        cancelText="تراجع"
        type="warning"
        onConfirm={handleMigration}
        onCancel={() => setShowMigrateConfirm(false)}
      />
    </div>
  );
};
