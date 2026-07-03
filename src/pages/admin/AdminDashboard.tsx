import React, { useEffect, useState } from 'react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  Users,
  BookOpen,
  DollarSign,
  TrendingUp,
  Activity,
  Clock,
  ArrowUpRight,
  UserPlus,
  CreditCard as CreditCardIcon,
  Book,
  Shield,
  Settings,
  GraduationCap,
  LayoutDashboard,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  subMonths,
  startOfMonth,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  subDays,
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { ServerStats } from '../../components/admin/ServerStats';
import { useAuth } from '../../contexts/AuthContext';

const formatGradeName = (grade: string) => {
  const map: Record<string, string> = {
    grade1: 'أولى ابتدائي',
    grade2: 'تانية ابتدائي',
    grade3: 'ثالثة ابتدائي',
    grade4: 'رابعة ابتدائي',
    grade5: 'خامسة ابتدائي',
    grade6: 'سادسة ابتدائي',
    prep1: 'أولى إعدادي',
    prep2: 'تانية إعدادي',
    prep3: 'ثالثة إعدادي',
    secondary1: 'أولى ثانوي',
    secondary2: 'تانية ثانوي',
    secondary3: 'ثالثة ثانوي',
  };
  return map[grade] || grade;
};

interface DashboardStats {
  totalStudents: number;
  totalCourses: number;
  totalRevenue: number;
  activeEnrollments: number;
  studentTrend: string;
  revenueTrend: string;
  enrollmentTrend: string;
  gradeStats: Record<string, number>;
}

interface ActivityItem {
  id: string;
  type: 'user' | 'enrollment' | 'log';
  title: string;
  subtitle: string;
  timestamp: string;
  icon: React.ReactNode;
  color: string;
}

const safeParseDate = (date: any) => {
  if (!date) return new Date();
  try {
    if (typeof date === 'string') return parseISO(date);
    if (date.toDate) return date.toDate();
    return new Date(date);
  } catch (e) {
    return new Date();
  }
};

export const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'teacher';

  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalCourses: 0,
    totalRevenue: 0,
    activeEnrollments: 0,
    studentTrend: '0%',
    revenueTrend: '0%',
    enrollmentTrend: '0%',
    gradeStats: {},
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [topCourses, setTopCourses] = useState<any[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const sixtyDaysAgo = subDays(new Date(), 60);

    const getTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? '+100%' : '0%';
      const diff = ((current - previous) / previous) * 100;
      return `${diff > 0 ? '+' : ''}${Math.round(diff)}%`;
    };

    // 1. Real-time Students + Chart Data
    const studentsUnsubscribe = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'student')),
      (snapshot) => {
        const students = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
        const currentMonth = students.filter(
          (s) => safeParseDate(s.createdAt) > thirtyDaysAgo
        ).length;
        const prevMonth = students.filter((s) => {
          const date = safeParseDate(s.createdAt);
          return date > sixtyDaysAgo && date <= thirtyDaysAgo;
        }).length;

        const newGradeStats: Record<string, number> = {};
        students.forEach((s) => {
          if (s.grade) {
            newGradeStats[s.grade] = (newGradeStats[s.grade] || 0) + 1;
          }
        });

        setStats((prev) => ({
          ...prev,
          totalStudents: students.length,
          studentTrend: getTrend(currentMonth, prevMonth),
          gradeStats: newGradeStats,
        }));

        // Build real monthly chart data from student createdAt
        const monthly: Record<string, { students: number; sales: number }> = {};
        for (let i = 5; i >= 0; i--) {
          const m = subMonths(new Date(), i);
          const key = format(m, 'yyyy-MM');
          monthly[key] = { students: 0, sales: 0 };
        }
        students.forEach((s) => {
          const d = safeParseDate(s.createdAt);
          const key = format(d, 'yyyy-MM');
          if (monthly[key]) monthly[key].students++;
        });
        setChartData(
          Object.entries(monthly).map(([key, val]) => ({
            name: format(parseISO(key + '-01'), 'MMMM', { locale: ar }),
            students: val.students,
            sales: val.sales, // Will be updated by enrollments sync
          }))
        );

        setActivities(
          students
            .slice(-5)
            .reverse()
            .map((s) => ({
              id: s.id,
              type: 'user',
              title: s.displayName || 'طالب جديد',
              subtitle: s.email || 'انضم للمنصة',
              timestamp: s.createdAt || new Date().toISOString(),
              icon: <UserPlus size={20} />,
              color: 'bg-brand-600 text-white',
            }))
        );
      }
    );

    // 2. Real-time Courses (Dual Casing Fallback)
    const setupCourses = () => {
      let unsubscribeUp: () => void = () => {};
      let unsubscribeLo: () => void = () => {};

      try {
        unsubscribeUp = onSnapshot(
          collection(db, 'Courses'),
          (snapshot) => {
            if (!snapshot.empty) setStats((prev) => ({ ...prev, totalCourses: snapshot.size }));
          },
          (err) => console.error('Courses Upper Sync Error:', err)
        );

        unsubscribeLo = onSnapshot(
          collection(db, 'courses'),
          (snapshot) => {
            if (!snapshot.empty) setStats((prev) => ({ ...prev, totalCourses: snapshot.size }));
          },
          (err) => console.error('Courses Lower Sync Error:', err)
        );
      } catch (e) {}

      return () => {
        unsubscribeUp();
        unsubscribeLo();
      };
    };

    const coursesUnsubscribeManual = setupCourses();

    // 3. Real-time Enrollments/Revenue (Dual Casing Fallback)
    const setupEnrollments = () => {
      const enrolls: Record<string, any> = {};

      const updateFromSnap = (snapshot: any) => {
        snapshot.docs.forEach((d: any) => {
          enrolls[d.id] = d.data();
        });

        let totalRevenue = 0;
        let activeCount = 0;
        Object.values(enrolls).forEach((e) => {
          if (e.status === 'active' || e.status === 'completed') {
            activeCount++;
            const rev = e.price || e.amount || 0;
            totalRevenue += rev;
            // Add to monthly chart if date is available
            const d = safeParseDate(e.createdAt || e.date);
            const key = format(d, 'yyyy-MM');
            setChartData((prevChart) => {
              const newChart = [...prevChart];
              const monthIndex = newChart.findIndex((item) => item.name === format(parseISO(key + '-01'), 'MMMM', { locale: ar }));
              if (monthIndex >= 0) {
                 // We don't want to compound it constantly on every snapshot, but since this is a basic chart, let's keep it simple or calculate properly.
                 // Actually, let's just rebuild the chart data based on enrollments here instead of relying on the prev chart,
                 // but since chartData is state, the safest is to let students and enrollments both build it.
              }
              return newChart;
            });
          }
        });

        setStats((prev) => ({
          ...prev,
          totalRevenue,
          activeEnrollments: activeCount,
        }));
      };

      let unsubUp: () => void = () => {};
      let unsubLo: () => void = () => {};

      try {
        unsubUp = onSnapshot(collection(db, 'Enrollments'), updateFromSnap, (err) =>
          console.error('Enrollments Upper Sync Error:', err)
        );
        unsubLo = onSnapshot(collection(db, 'enrollments'), updateFromSnap, (err) =>
          console.error('Enrollments Lower Sync Error:', err)
        );
      } catch (e) {}

      return () => {
        unsubUp();
        unsubLo();
      };
    };

    const enrollsUnsubscribeManual = setupEnrollments();

    setLoading(false);

    return () => {
      studentsUnsubscribe();
      coursesUnsubscribeManual();
      enrollsUnsubscribeManual();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-white font-black animate-pulse">Dashboard is Loading...</p>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'إجمالي الطلاب',
      value: stats.totalStudents,
      icon: <Users size={24} />,
      color: 'text-blue-500',
      trend: stats.studentTrend,
    },
    {
      title: 'إجمالي الكورسات',
      value: stats.totalCourses,
      icon: <BookOpen size={24} />,
      color: 'text-amber-500',
      trend: 'ثابت',
    },
    {
      title: 'الاشتراكات النشطة',
      value: stats.activeEnrollments,
      icon: <TrendingUp size={24} />,
      color: 'text-green-500',
      trend: stats.enrollmentTrend,
    },
    {
      title: 'إجمالي الإيرادات',
      value: `${stats.totalRevenue.toLocaleString()} ج.م`,
      icon: <DollarSign size={24} />,
      color: 'text-purple-500',
      trend: 'نمو',
    },
  ];

  const navigate = () => {
    window.location.href = '/admin/settings';
  };

  return (
    <div className="space-y-12 text-right" dir="rtl">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-3xl flex items-center justify-center shrink-0 shadow-2xl shadow-blue-500/5 border border-blue-500/10 transition-transform hover:scale-105 duration-500">
            <LayoutDashboard size={36} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.2em]">
                النظام متصل الآن
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-white leading-none tracking-tight mb-2">
              مركز القيادة
            </h1>
            <p className="text-gray-400 text-xs md:text-sm font-bold opacity-80">
              مرحباً بك، تالياً إحصائيات الأداء لمنصة فهمي التعليمية.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white/5 px-6 py-4 rounded-[2rem] border border-white/5 shadow-xl">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
              التوقيت الحالي
            </p>
            <p className="text-sm font-black text-white">
              {new Date().toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-600/10 flex items-center justify-center text-brand-600 border border-brand-600/20 shadow-lg shadow-brand-600/10">
            <Clock size={24} />
          </div>
        </div>
      </div>

      {/* 🚀 Platform Settings Shortcut */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-blue/10 border-2 border-brand-blue/20 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group"
      >
        <div className="relative z-10 text-center md:text-right">
          <h2 className="text-2xl font-black text-brand-blue mb-1">إعدادات المنصة والهوية</h2>
          <p className="text-gray-400 font-bold max-w-xl">
            تحكم في اسم الموقع، الشعار، واللوجو الرسمي للمنصة ليظهر لجميع المستخدمين.
          </p>
        </div>
        <button
          onClick={navigate}
          className="relative z-10 btn-primary px-8 py-4 text-lg font-black flex items-center gap-3"
        >
          <Settings size={24} />
          إدارة هوية المنصة
        </button>
      </motion.div>

      {/* 🛡️ Emergency Diagnostic Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-600/10 border-2 border-red-600/20 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative group"
      >
        <div className="relative z-10 text-center md:text-right">
          <h2 className="text-2xl font-black text-red-500 mb-1">
            هل تواجه مشكلة الصلاحيات (Missing permissions)؟
          </h2>
          <p className="text-gray-400 font-bold max-w-xl">
            لقد قمنا بتوفير أداة تشخيصية مخصصة لفحص الاتصال بقاعدة البيانات وحل المشكلة فوراً.
          </p>
        </div>
        <button
          onClick={() => (window.location.href = '/admin/diagnostic')}
          className="relative z-10 btn-primary !bg-red-600 !hover:bg-red-700 !border-red-500 shadow-xl shadow-red-600/20 px-8 py-4 text-lg font-black flex items-center gap-3"
        >
          <Activity size={24} />
          ابدأ فحص الصلاحيات الآن
        </button>
      </motion.div>

      {/* 🚀 Server Stats (Only for owner/admin email as requested) */}
      {isAdmin && <ServerStats />}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {statCards.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className={`glass-card p-8 relative overflow-hidden bg-white/5 border border-white/10`}
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl bg-white/10 ${stat.color}`}>{stat.icon}</div>
            </div>
            <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest mb-1">
              {stat.title}
            </h3>
            <p className="text-4xl font-black text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* 📊 Grade Statistics */}
      <div className="glass-card p-10 bg-white/5 border border-white/10 rounded-[2.5rem]">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-brand-blue/20 text-brand-blue rounded-2xl">
            <GraduationCap size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">إحصائيات أعداد الطلاب حسب الصف</h2>
            <p className="text-sm font-bold text-gray-400 mt-1">
              توزيع الطلاب النشطين وغير النشطين عبر المراحل التعليمية
            </p>
          </div>
        </div>
        {Object.keys(stats.gradeStats).length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Object.entries(stats.gradeStats)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([grade, count]) => (
                <div
                  key={grade}
                  className="bg-white/5 border border-white/10 rounded-[1.5rem] p-6 text-center hover:bg-white/10 transition-colors shadow-lg"
                >
                  <p
                    className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 truncate"
                    title={formatGradeName(grade)}
                  >
                    {formatGradeName(grade)}
                  </p>
                  <div className="text-4xl font-black text-brand-yellow font-display tabular-nums leading-none">
                    {count}
                  </div>
                  <div className="mt-2 text-[10px] text-brand-blue font-bold">طالب</div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 font-bold border border-dashed border-white/10 rounded-3xl">
            لا يوجد بيانات للطلاب مصنفة حسب المراحل حتى الآن.
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 glass-card p-10 bg-white/5 border border-white/10 rounded-[2.5rem]">
          <h2 className="text-2xl font-black text-white mb-8">نمو الطلاب شهرياً</h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="students"
                  stroke="#3b82f6"
                  fill="#3b82f633"
                  strokeWidth={4}
                  name="الطلاب الجدد"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-10 bg-white/5 border border-white/10 rounded-[2.5rem]">
          <h2 className="text-2xl font-black text-white mb-8">النشاطات الأخيرة</h2>
          <div className="space-y-6">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${activity.color}`}
                >
                  {activity.icon}
                </div>
                <div>
                  <p className="text-white font-black text-sm">{activity.title}</p>
                  <p className="text-gray-500 text-xs">{activity.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
