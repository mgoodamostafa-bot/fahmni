import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  DollarSign,
  TrendingUp,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  Activity,
  Calendar,
  Wallet,
  Landmark,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Cell,
  Pie,
} from 'recharts';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const FinanceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    platformProfit: 0,
    teacherPayouts: 0,
    activeTeachers: 0,
    totalTransactions: 0,
  });

  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [payoutDistribution, setPayoutDistribution] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time listener for stats calculation and charts
    const unsubTransactions = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const transactions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      let totalRev = 0;
      let platProfit = 0;
      let teacherPay = 0;
      const dailyRev: Record<string, number> = {};
      const teacherStats: Record<string, number> = {};

      transactions.forEach((tx: any) => {
        if (tx.type === 'purchase' || tx.type === 'activation_code') {
          const amt = Math.abs(Number(tx.amount));
          const pShare = Math.abs(Number(tx.platformShare));
          const tShare = Math.abs(Number(tx.teacherShare));

          totalRev += isNaN(amt) ? 0 : amt;
          platProfit += isNaN(pShare) ? 0 : pShare;
          teacherPay += isNaN(tShare) ? 0 : tShare;

          // Chart data by date
          const date = tx.date?.toDate?.()?.toLocaleDateString('en-US') || 'Unknown';
          dailyRev[date] = (dailyRev[date] || 0) + (isNaN(amt) ? 0 : amt);

          // Distribution by teacher
          if (tx.teacherName) {
            teacherStats[tx.teacherName] = (teacherStats[tx.teacherName] || 0) + (isNaN(tShare) ? 0 : tShare);
          }
        }
      });

      setStats({
        totalRevenue: totalRev,
        platformProfit: platProfit,
        teacherPayouts: teacherPay,
        activeTeachers: Object.keys(teacherStats).length,
        totalTransactions: transactions.length,
      });

      // Format Chart Data
      const sortedDaily = Object.keys(dailyRev)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .slice(-7)
        .map((date) => ({ date, amount: dailyRev[date] }));
      setRevenueData(sortedDaily);

      const distribution = Object.keys(teacherStats)
        .map((name) => ({
          name: name,
          value: teacherStats[name],
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      setPayoutDistribution(distribution);

      setRecentTransactions(
        transactions
          .sort((a: any, b: any) => {
            const ta = a.date?.seconds || 0;
            const tb = b.date?.seconds || 0;
            return tb - ta;
          })
          .slice(0, 10)
      );

      // Fetch Teachers and Admins for the List (for single-teacher platform support)
      getDocs(query(collection(db, 'users'), where('role', 'in', ['teacher', 'admin', 'owner']))).then((uSnap) => {
        const tList = uSnap.docs
          .map((uDoc) => {
            const tData = uDoc.data();
            return {
              id: uDoc.id,
              displayName: tData.displayName || tData.email,
              photoURL: tData.photoURL,
              totalRevenue: transactions
                .filter((tx: any) => tx.teacherId === uDoc.id && tx.type === 'purchase')
                .reduce((acc, tx: any) => acc + (isNaN(Number(tx.amount)) ? 0 : Number(tx.amount)), 0),
              payout: teacherStats[tData.displayName || tData.email] || 0,
              commission: tData.defaultCommission ?? 100,
            };
          })
          .sort((a, b) => b.totalRevenue - a.totalRevenue);
        setTeachersList(tList);
      });

      setLoading(false);
    });

    return () => unsubTransactions();
  }, []);

  const StatCard = ({ title, value, color, icon: Icon, subValue }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] relative overflow-hidden group hover:border-white/20 transition-all shadow-xl"
    >
      <div
        className={`absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full -mr-16 -mt-16 blur-3xl transition-opacity group-hover:opacity-20`}
        style={{ backgroundColor: color }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-white/5 rounded-2xl" style={{ color }}>
            <Icon size={24} />
          </div>
          <div className="flex items-center gap-1 text-emerald-400 text-xs font-black">
            <TrendingUp size={14} /> +12%
          </div>
        </div>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">
          {title}
        </p>
        <h3 className="text-2xl font-black text-white font-mono tracking-tighter">
          {value.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
        </h3>
        {subValue && <p className="text-[9px] text-slate-500 mt-2 font-bold italic">{subValue}</p>}
      </div>
    </motion.div>
  );

  return (
    <div dir="rtl" className="min-h-screen space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center shrink-0 border border-emerald-500/10 shadow-2xl shadow-emerald-500/5">
            <Landmark size={36} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">التقارير المالية</h1>
            <p className="text-slate-500 text-sm font-bold">
              متابعة الأرباح والنسب وتحركات الأموال
            </p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-6 py-4 rounded-2xl text-white font-black text-sm border border-white/10 transition-all">
          <Calendar size={18} /> آخر 30 يوم
        </button>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="إجمالي مبيعات المنصة"
          value={stats.totalRevenue}
          color="#3b82f6"
          icon={DollarSign}
          subValue="إجمالي الاشتراكات التي تمت عبر الموقع"
        />
        <StatCard
          title="صافي أرباح المنصة"
          value={stats.platformProfit}
          color="#10b981"
          icon={ArrowUpRight}
          subValue="حصتك الصافية من العمولات (Commissions)"
        />
        <StatCard
          title="مستحقات المدرسين"
          value={stats.teacherPayouts}
          color="#8b5cf6"
          icon={Users}
          subValue="إجمالي المبلغ الموزع على المدرسين"
        />
        <StatCard
          title="عدد المعاملات"
          value={stats.totalTransactions}
          color="#f59e0b"
          icon={Activity}
          subValue="إجمالي الحركات المالية المسجلة"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-[#0f172a] border border-white/10 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-xl font-black text-white flex items-center gap-3">
              <TrendingUp className="text-emerald-500" /> تحليل الدخل اليومي
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] text-slate-400 font-black">ناجح</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}ج`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #ffffff10',
                    borderRadius: '16px',
                  }}
                  itemStyle={{ fontWeight: 'black', fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#10b981"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Teachers Payout Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#0f172a] border border-white/10 p-8 rounded-[3rem] shadow-2xl"
        >
          <h3 className="text-xl font-black text-white mb-10 flex items-center gap-3">
            <PieIcon className="text-blue-500" /> توزيع مستحقات المدرسين
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={payoutDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {payoutDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4 mt-8">
            {payoutDistribution.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="text-xs font-black text-white">{t.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {t.value.toLocaleString('ar-EG')} ج
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 👥 Teachers Commission Overview */}
      <div className="bg-[#0f172a] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/3">
          <h3 className="text-xl font-black text-white flex items-center gap-3">
            <Users className="text-emerald-500" /> إدارة عمولات المدرسين
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                <th className="px-8 py-5">المدرس</th>
                <th className="px-8 py-5 text-center">إجمالي المبيعات</th>
                <th className="px-8 py-5 text-center">صافي المدرس</th>
                <th className="px-8 py-5 text-center">العمولة الافتراضية</th>
                <th className="px-8 py-5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {teachersList.map((t) => (
                <tr key={t.id} className="hover:bg-white/2 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      {t.photoURL ? (
                        <img
                          src={t.photoURL}
                          className="w-8 h-8 rounded-xl object-cover border border-white/10"
                          alt=""
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-brand-blue/10 flex items-center justify-center text-xs text-brand-blue font-black uppercase">
                          {t.displayName?.charAt(0)}
                        </div>
                      )}
                      <span className="text-white text-sm font-black">{t.displayName}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-center text-sm text-white font-mono">
                    {t.totalRevenue.toLocaleString('ar-EG')} ج
                  </td>
                  <td className="px-8 py-4 text-center text-sm text-emerald-400 font-black font-mono">
                    {t.payout.toLocaleString('ar-EG')} ج
                  </td>
                  <td className="px-8 py-4 text-center">
                    <span className="px-3 py-1 bg-white/5 text-slate-400 rounded-lg text-[10px] font-black">
                      {t.commission}%
                    </span>
                  </td>
                  <td className="px-8 py-4 text-center">
                    <button
                      onClick={() => navigate(`/teacher/finance/teachers/${t.id}`)}
                      className="bg-brand-blue/10 hover:bg-brand-blue text-brand-blue hover:text-white px-4 py-2 rounded-xl text-xs font-black transition-all border border-brand-blue/20"
                    >
                      إدارة كورسات المدرس
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#0f172a] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/3">
          <h3 className="text-xl font-black text-white flex items-center gap-3">
            <Wallet className="text-blue-500" /> آخر التحركات المالية
          </h3>
          <button className="text-blue-400 text-xs font-black hover:text-blue-300 transition-colors uppercase tracking-widest underline underline-offset-4">
            تنزيل تقرير PDF
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                <th className="px-8 py-5">المستخدم</th>
                <th className="px-8 py-5">النوع</th>
                <th className="px-8 py-5 text-center">المبلغ الكلي</th>
                <th className="px-8 py-5 text-center">صافي المنصة</th>
                <th className="px-8 py-5 text-center">صافي المدرس</th>
                <th className="px-8 py-5 text-center">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-white/2 transition-colors group italic font-bold"
                >
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-xs text-white uppercase">
                        {tx.userName?.charAt(0) || 'U'}
                      </div>
                      <span className="text-white text-sm">{tx.userName || 'غير معروف'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wide border ${tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}
                    >
                      {tx.type === 'deposit' ? 'إيداع رصيد' : 'شراء كورس'}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-center text-sm text-white font-mono">
                    {tx.amount?.toLocaleString('ar-EG')} ج
                  </td>
                  <td className="px-8 py-4 text-center text-sm text-emerald-400 font-mono">
                    {(tx.platformShare || 0).toLocaleString('ar-EG')} ج
                  </td>
                  <td className="px-8 py-4 text-center text-sm text-blue-400 font-mono">
                    {(tx.teacherShare || 0).toLocaleString('ar-EG')} ج
                  </td>
                  <td className="px-8 py-4 text-center text-slate-500 text-[10px]">
                    {tx.date
                      ?.toDate?.()
                      ?.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
              {recentTransactions.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-8 py-20 text-center text-slate-500 font-bold italic opacity-50"
                  >
                    لا توجد معاملات مسجلة بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
