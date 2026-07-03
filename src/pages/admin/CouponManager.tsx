import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  deleteDoc,
  where,
  updateDoc,
} from 'firebase/firestore';
import { getTenantDb } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Key,
  Plus,
  Copy,
  Check,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Hash,
  Trash2,
  Printer,
  Coins,
  BookOpen,
  Filter,
  Calendar,
  Percent,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount' | 'free_access' | 'wallet_charge';
  value: number;
  courseId: string;
  maxUses?: number;
  useCount: number;
  expiryDate?: any;
  active: boolean;
  createdAt: any;
  teacherId: string;
}

export const CouponManager: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, string>>({});
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courseId || 'all');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Form State
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed_amount' | 'free_access' | 'wallet_charge'>('percentage');
  const [value, setValue] = useState<number>(10);
  const [maxUses, setMaxUses] = useState<string>('');
  const [expiryStr, setExpiryStr] = useState<string>('');
  
  // UI State
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all courses and setup snapshot for coupons
  useEffect(() => {
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'teacher')) {
      navigate('/');
      return;
    }

    let unsubscribe: () => void;
    let timer: NodeJS.Timeout;

    const fetchData = async () => {
      try {
        const db = getTenantDb();
        
        // Fetch courses with dual-case collection support and teacher role filtering
        let coursesList: any[] = [];
        if (profile?.role === 'admin') {
          const [upperSnap, lowerSnap] = await Promise.all([
            getDocs(collection(db, 'Courses')),
            getDocs(collection(db, 'courses')),
          ]);
          const combined = [
            ...upperSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            ...lowerSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          ];
          const uniqueMap = new Map();
          combined.forEach((c) => {
            if (!uniqueMap.has(c.id)) uniqueMap.set(c.id, c);
          });
          coursesList = Array.from(uniqueMap.values());
        } else if (profile?.role === 'teacher') {
          const [upperSnap, lowerSnap] = await Promise.all([
            getDocs(query(collection(db, 'Courses'), where('teacherId', '==', user.uid))),
            getDocs(query(collection(db, 'courses'), where('teacherId', '==', user.uid))),
          ]);
          const combined = [
            ...upperSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            ...lowerSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          ];
          const uniqueMap = new Map();
          combined.forEach((c) => {
            if (!uniqueMap.has(c.id)) uniqueMap.set(c.id, c);
          });
          coursesList = Array.from(uniqueMap.values());
        }

        setAllCourses(coursesList);

        const map: Record<string, string> = { all: 'كل الكورسات' };
        coursesList.forEach((c: any) => {
          map[c.id] = c.title;
        });
        setCourseMap(map);

        // Real-time listener for coupons
        let couponsQuery;
        if (profile?.role === 'admin') {
          couponsQuery = collection(db, 'coupons');
        } else {
          couponsQuery = query(collection(db, 'coupons'), where('teacherId', '==', user.uid));
        }

        unsubscribe = onSnapshot(
          couponsQuery,
          (snapshot) => {
            const fetched = snapshot.docs.map(
              (doc) =>
                ({
                  id: doc.id,
                  ...doc.data(),
                }) as Coupon
            );
            fetched.sort((a, b) => {
              const timeA = a.createdAt?.seconds || 0;
              const timeB = b.createdAt?.seconds || 0;
              return timeB - timeA;
            });
            setCoupons(fetched);
            setLoading(false);
          },
          (err) => {
            console.error('Firestore coupons snapshot error:', err);
            setError('فشل جلب الكوبونات من قاعدة البيانات.');
            setLoading(false);
          }
        );

        timer = setTimeout(() => {
          setLoading(false);
        }, 5000);
      } catch (err: any) {
        console.error('Fetch data error:', err);
        if (err.message && err.message.includes('index')) {
          setError(err.message); // This will show the Firebase URL to create the index
        } else if (err.code === 'permission-denied' || (err.message && err.message.includes('permissions'))) {
          setError('خطأ في الصلاحيات: يرجى التأكد من رفع ملف firestore.rules إلى قاعدة البيانات.');
        } else {
          setError('حدث خطأ أثناء جلب البيانات من قاعدة البيانات. ' + (err.message || ''));
        }
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      if (unsubscribe) unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [user, profile?.role, navigate]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !code.trim()) return;

    if (type !== 'wallet_charge' && selectedCourseId === '') {
      setError('يرجى تحديد الكورس أو اختيار "كل الكورسات"');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const db = getTenantDb();
      const couponCode = code.trim().toUpperCase().replace(/\s+/g, '');

      // Verify unique coupon code locally or via query
      const checkQ = query(collection(db, 'coupons'), where('code', '==', couponCode));
      const checkSnap = await getDocs(checkQ);
      if (!checkSnap.empty) {
        throw new Error('رمز الكوبون هذا مستخدم بالفعل، يرجى كتابة رمز آخر.');
      }

      const batch = writeBatch(db);
      const newDocRef = doc(collection(db, 'coupons'));

      const couponDoc: any = {
        code: couponCode,
        type,
        value: type === 'free_access' ? 0 : Number(value),
        courseId: type === 'wallet_charge' ? '' : selectedCourseId,
        useCount: 0,
        active: true,
        usedBy: {},
        createdAt: serverTimestamp(),
        teacherId: user.uid,
      };

      if (maxUses && parseInt(maxUses) > 0) {
        couponDoc.maxUses = parseInt(maxUses);
      }

      if (expiryStr) {
        couponDoc.expiryDate = new Date(expiryStr);
      }

      batch.set(newDocRef, couponDoc);
      await batch.commit();

      // Reset Form
      setCode('');
      setMaxUses('');
      setExpiryStr('');
    } catch (err: any) {
      console.error('Error generating coupon:', err);
      setError(err.message || 'فشل إنشاء الكوبون. يرجى المحاولة مرة أخرى.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الكوبون نهائياً؟')) return;
    try {
      const db = getTenantDb();
      await deleteDoc(doc(db, 'coupons', id));
    } catch (err) {
      console.error('Error deleting coupon:', err);
      setError('حدث خطأ أثناء محاولة حذف الكوبون.');
    }
  };

  const toggleActive = async (item: Coupon) => {
    try {
      const db = getTenantDb();
      await updateDoc(doc(db, 'coupons', item.id), {
        active: !item.active
      });
    } catch (err) {
      console.error('Error toggling coupon state:', err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter list
  const filteredCoupons = coupons.filter((item) => {
    const matchesSearch = item.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFilter = true;
    if (filterStatus === 'active') matchesFilter = item.active;
    if (filterStatus === 'inactive') matchesFilter = !item.active;
    if (filterStatus === 'expired') {
      if (!item.expiryDate) matchesFilter = false;
      else {
        const exp = item.expiryDate.toDate ? item.expiryDate.toDate() : new Date(item.expiryDate);
        matchesFilter = exp < new Date();
      }
    }

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-brand-blue/10 text-brand-blue rounded-3xl flex items-center justify-center shrink-0 shadow-2xl shadow-brand-blue/5 border border-brand-blue/10 transition-transform hover:scale-105 duration-500">
            <Key size={36} />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white leading-none tracking-tight mb-2">
              إدارة الكوبونات والخصومات
            </h1>
            <p className="text-gray-400 text-xs md:text-sm font-bold opacity-80">
              توليد وإدارة كوبونات الخصم المئوي والخصم الثابت والاشتراك المجاني وشحن المحفظة
            </p>
          </div>
        </div>
        <div className="flex gap-4 w-full md:w-auto no-print">
          <button
            onClick={handlePrint}
            disabled={filteredCoupons.length === 0}
            className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 text-white px-6 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Printer size={20} /> طباعة الكوبونات
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors font-bold px-5 py-4 bg-white/5 rounded-2xl border border-white/5"
          >
            <ChevronLeft size={20} /> رجوع
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Generator Panel */}
        <div className="lg:col-span-1 no-print">
          <div className="glass-card p-8 sticky top-28 border border-white/10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-brand-blue/20 rounded-2xl flex items-center justify-center text-brand-blue">
                <Plus size={24} />
              </div>
              <h3 className="text-xl font-black text-white">إنشاء كوبون جديد</h3>
            </div>

            <form onSubmit={handleGenerate} className="space-y-6">
              {/* Code string */}
              <div className="space-y-2">
                <label className="block text-sm font-black text-gray-400 mr-2">رمز الكوبون (الرمز التعريفي)</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: WELCOME50"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white text-lg placeholder:text-gray-600 uppercase"
                />
              </div>

              {/* Coupon Type */}
              <div className="space-y-2">
                <label className="block text-sm font-black text-gray-400 mr-2">نوع الكوبون</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white text-lg appearance-none bg-gray-900"
                >
                  <option value="percentage">خصم مئوي (%)</option>
                  <option value="fixed_amount">خصم بقيمة مالية ثابتة (ج.م)</option>
                  <option value="free_access">اشتراك مجاني بالكامل لكورس (100% خصم)</option>
                  <option value="wallet_charge">كوبون شحن المحفظة المالية</option>
                </select>
              </div>

              {/* Value Input (Disabled for free_access) */}
              {type !== 'free_access' && (
                <div className="space-y-2">
                  <label className="block text-sm font-black text-gray-400 mr-2">
                    {type === 'percentage' ? 'قيمة الخصم المئوية (%)' : 'القيمة المالية للمستند (ج.م)'}
                  </label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                      {type === 'percentage' ? '%' : 'ج.م'}
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      value={value}
                      onChange={(e) => setValue(parseInt(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-14 pl-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white text-lg"
                    />
                  </div>
                </div>
              )}

              {/* Course Selector (Hidden for wallet charge) */}
              {type !== 'wallet_charge' && (
                <div className="space-y-2">
                  <label className="block text-sm font-black text-gray-400 mr-2">الكورس المستهدف</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white text-lg appearance-none bg-gray-900"
                  >
                    <option value="all">كل الكورسات المتاحة</option>
                    {allCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Max Uses */}
              <div className="space-y-2">
                <label className="block text-sm font-black text-gray-400 mr-2">أقصى عدد مرات استخدام (اختياري)</label>
                <div className="relative">
                  <Hash className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="number"
                    min="1"
                    placeholder="مفتوح"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white text-lg"
                  />
                </div>
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <label className="block text-sm font-black text-gray-400 mr-2">تاريخ انتهاء الصلاحية (اختياري)</label>
                <div className="relative">
                  <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="date"
                    value={expiryStr}
                    onChange={(e) => setExpiryStr(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white text-lg appearance-none text-right"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3 text-sm font-bold">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={generating}
                className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white py-4 rounded-2xl font-black shadow-xl shadow-brand-blue/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    توليد الكوبون الآن
                    <Key size={20} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* List of Coupons */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
            <h3 className="text-2xl font-black text-white flex items-center gap-4">
              <div className="w-2 h-8 bg-brand-blue rounded-full" />
              الكوبونات المتوفرة ({filteredCoupons.length})
            </h3>

            {/* Filter & Search */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {/* Search Bar */}
              <div className="relative w-full sm:w-48">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  placeholder="ابحث عن الكوبون..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pr-9 pl-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-blue"
                />
              </div>

              {/* Status buttons */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-full sm:w-auto justify-around">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                    filterStatus === 'all' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setFilterStatus('active')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                    filterStatus === 'active' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  نشط
                </button>
                <button
                  onClick={() => setFilterStatus('inactive')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                    filterStatus === 'inactive' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  غير نشط
                </button>
                <button
                  onClick={() => setFilterStatus('expired')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                    filterStatus === 'expired' ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  منتهي
                </button>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <AnimatePresence>
              {filteredCoupons.map((item) => {
                const isExpired = item.expiryDate
                  ? (item.expiryDate.toDate ? item.expiryDate.toDate() : new Date(item.expiryDate)) < new Date()
                  : false;
                
                const hasReachedLimit = item.maxUses ? (item.useCount || 0) >= item.maxUses : false;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`glass-card p-5 flex items-center justify-between border ${
                      !item.active || isExpired || hasReachedLimit
                        ? 'border-white/5 bg-gray-900/40 opacity-60'
                        : 'border-brand-blue/20 hover:border-brand-blue/50'
                    } transition-all group relative overflow-hidden`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          !item.active || isExpired || hasReachedLimit
                            ? 'bg-gray-800 text-gray-500'
                            : 'bg-brand-blue/10 text-brand-blue'
                        }`}
                      >
                        {item.type === 'wallet_charge' ? (
                          <Coins size={20} />
                        ) : item.type === 'percentage' ? (
                          <Percent size={20} />
                        ) : item.type === 'free_access' ? (
                          <ShieldCheck size={20} />
                        ) : (
                          <BookOpen size={20} />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="font-mono text-lg font-black tracking-wider text-white">
                          {item.code}
                        </p>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-black text-emerald-500">
                            {item.type === 'percentage' && `خصم ${item.value}%`}
                            {item.type === 'fixed_amount' && `خصم بقيمة ${item.value} ج.م`}
                            {item.type === 'free_access' && 'اشتراك مجاني 100%'}
                            {item.type === 'wallet_charge' && `شحن محفظة: ${item.value} ج.م`}
                          </span>

                          {item.type !== 'wallet_charge' && (
                            <span className="text-[10px] text-gray-400 font-bold">
                              الكورس: {courseMap[item.courseId] || 'غير معروف'}
                            </span>
                          )}

                          <span className="text-[10px] text-gray-500 font-medium">
                            الاستخدام: {item.useCount || 0} / {item.maxUses || '∞'}
                          </span>

                          {item.expiryDate && (
                            <span className={`text-[9px] font-bold ${isExpired ? 'text-red-400' : 'text-gray-500'}`}>
                              تنتهي: {new Date(item.expiryDate.toDate ? item.expiryDate.toDate() : item.expiryDate).toLocaleDateString('ar-EG')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 no-print">
                      {/* Active Status Toggle */}
                      <button
                        onClick={() => toggleActive(item)}
                        className={`p-2 rounded-xl transition-all ${
                          item.active ? 'text-brand-blue hover:text-white' : 'text-gray-500 hover:text-white'
                        }`}
                        title={item.active ? 'تعطيل الكوبون' : 'تفعيل الكوبون'}
                      >
                        {item.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>

                      <button
                        onClick={() => copyToClipboard(item.code, item.id)}
                        className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all transform active:scale-90"
                        title="نسخ الكود"
                      >
                        {copiedId === item.id ? (
                          <Check size={18} className="text-emerald-500" />
                        ) : (
                          <Copy size={18} />
                        )}
                      </button>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 hover:bg-red-500/20 rounded-xl text-gray-500 hover:text-red-500 transition-all transform active:scale-90"
                        title="حذف الكوبون"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredCoupons.length === 0 && (
              <div className="col-span-full py-20 text-center glass-card border-dashed">
                <Key size={48} className="mx-auto text-gray-700 mb-4 opacity-20" />
                <p className="text-gray-500 font-bold">لا توجد كوبونات لعرضها في هذا التصنيف.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
