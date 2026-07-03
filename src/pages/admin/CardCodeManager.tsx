import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  deleteDoc,
  where,
  limit,
  orderBy,
  startAfter,
  limitToLast,
  endBefore,
  getCountFromServer,
} from 'firebase/firestore';
import { getTenantDb } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Key,
  Plus,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Hash,
  Trash2,
  Printer,
  Coins,
  BookOpen,
  Filter,
  Search,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CardCode {
  id: string;
  code: string;
  type: 'course' | 'charge';
  courseId?: string;
  value?: number;
  isUsed: boolean;
  usedBy: string | null;
  usedAt: any | null;
  createdAt: any;
  teacherId: string;
}

const PAGE_SIZE = 20;

export const CardCodeManager: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // State
  const [codes, setCodes] = useState<CardCode[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, string>>({});
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courseId || '');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(10);
  const [chargeValue, setChargeValue] = useState(100);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<any | null>(null);

  // Tabs: 'course' | 'charge'
  const [activeTab, setActiveTab] = useState<'course' | 'charge'>('course');
  // Filters: 'all' | 'available' | 'used'
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'used'>('all');
  
  // Pagination State
  const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  
  // Search State
  const [searchCode, setSearchCode] = useState('');

  // Fetch courses on mount
  useEffect(() => {
    if (!user || (profile?.role !== 'admin' && profile?.role !== 'teacher')) {
      navigate('/');
      return;
    }

    const fetchCourses = async () => {
      try {
        const db = getTenantDb();
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

        const map: Record<string, string> = {};
        coursesList.forEach((c: any) => {
          map[c.id] = c.title;
        });
        setCourseMap(map);
      } catch (err) {
        console.error('Error fetching courses:', err);
      }
    };

    fetchCourses();
  }, [user, profile?.role, navigate]);

  // Fetch codes dynamically (paginated)
  const fetchCodes = useCallback(async (
    direction: 'next' | 'prev' | 'first' = 'first',
    customSearch?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const db = getTenantDb();
      let constraints: any[] = [orderBy('createdAt', 'desc')];

      // Add teacher filters
      if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
        constraints.push(where('teacherId', '==', user?.uid));
      }

      // Add search filter (exact code search works best in firestore)
      const searchQuery = customSearch !== undefined ? customSearch : searchCode;
      if (searchQuery.trim()) {
        constraints.push(where('code', '==', searchQuery.trim().toUpperCase()));
      } else {
        // Add tab & status filters only when NOT searching (to avoid requiring complex firestore indexes)
        constraints.push(where('type', '==', activeTab));
        if (filterStatus === 'available') {
          constraints.push(where('isUsed', '==', false));
        } else if (filterStatus === 'used') {
          constraints.push(where('isUsed', '==', true));
        }
      }

      // Apply pagination bounds
      let q;
      if (direction === 'first') {
        q = query(collection(db, 'codes'), ...constraints, limit(PAGE_SIZE));
      } else if (direction === 'next' && lastVisibleDoc) {
        q = query(collection(db, 'codes'), ...constraints, startAfter(lastVisibleDoc), limit(PAGE_SIZE));
      } else if (direction === 'prev' && firstVisibleDoc) {
        q = query(collection(db, 'codes'), ...constraints, endBefore(firstVisibleDoc), limitToLast(PAGE_SIZE));
      } else {
        q = query(collection(db, 'codes'), ...constraints, limit(PAGE_SIZE));
      }

      let snapshot;
      try {
        snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as CardCode));

        if (fetched.length > 0) {
          setFirstVisibleDoc(snapshot.docs[0]);
          setLastVisibleDoc(snapshot.docs[snapshot.docs.length - 1]);
          setCodes(fetched);

          // Check if there's a next page
          const nextQuery = query(
            collection(db, 'codes'),
            ...constraints,
            startAfter(snapshot.docs[snapshot.docs.length - 1]),
            limit(1)
          );
          const nextSnap = await getDocs(nextQuery);
          setHasNextPage(!nextSnap.empty);
        } else {
          setCodes([]);
          setHasNextPage(false);
        }
      } catch (queryErr: any) {
        if (queryErr.message?.includes('requires an index') || queryErr.message?.includes('index')) {
          console.warn("Missing index, falling back to client-side filtering...", queryErr);
          const cleanConstraints: any[] = [orderBy('createdAt', 'desc')];
          if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
            cleanConstraints.push(where('teacherId', '==', user?.uid));
          }
          if (!searchQuery.trim()) {
            cleanConstraints.push(where('type', '==', activeTab));
          }
          const fallbackQuery = query(collection(db, 'codes'), ...cleanConstraints, limit(200));
          const fallbackSnap = await getDocs(fallbackQuery);
          let fetched = fallbackSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as CardCode));

          if (filterStatus === 'available') {
            fetched = fetched.filter(c => c.isUsed === false);
          } else if (filterStatus === 'used') {
            fetched = fetched.filter(c => c.isUsed === true);
          }

          const sliced = fetched.slice(0, PAGE_SIZE);
          setCodes(sliced);
          setHasNextPage(fetched.length > PAGE_SIZE);
          setHasPrevPage(false);
          setCurrentPage(1);
          setLoading(false);

          const indexUrl = queryErr.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
          if (indexUrl) {
            setError({
              message: 'لتسريع تصفية الأكواد، يرجى تفعيل الفهرس بالضغط على الزر أدناه:',
              url: indexUrl
            });
          }
          return;
        } else {
          throw queryErr;
        }
      }

      if (direction === 'first') {
        setHasPrevPage(false);
        setCurrentPage(1);
      } else if (direction === 'next') {
        setHasPrevPage(true);
        setCurrentPage(p => p + 1);
      } else if (direction === 'prev') {
        setHasNextPage(true);
        setCurrentPage(p => Math.max(1, p - 1));
        setHasPrevPage(currentPage > 2);
      }
    } catch (err: any) {
      console.error('Error fetching codes:', err);
      if (err.message && err.message.includes('index')) {
        setError(err.message); // This will show the Firebase URL to create the index
      } else if (err.code === 'permission-denied' || (err.message && err.message.includes('permissions'))) {
        setError('خطأ في الصلاحيات: يرجى التأكد من رفع ملف firestore.rules إلى قاعدة البيانات.');
      } else {
        setError('حدث خطأ أثناء جلب الأكواد من قاعدة البيانات. ' + (err.message || ''));
      }
    } finally {
      setLoading(false);
    }
  }, [user?.uid, profile?.role, activeTab, filterStatus, searchCode, lastVisibleDoc, firstVisibleDoc, currentPage]);

  // Trigger fetch when tab or filter changes
  useEffect(() => {
    fetchCodes('first');
  }, [activeTab, filterStatus]);

  // Generate safe alphanumeric code string: CRS-XXXX-XXXX or CHG-XXXX-XXXX
  const generateCodeString = (prefix: 'CRS' | 'CHG') => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid easily confused chars
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${part1}-${part2}`;
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || count < 1) return;

    if (activeTab === 'course' && !selectedCourseId) {
      setError('يرجى تحديد الكورس المراد توليد الأكواد له');
      return;
    }

    if (activeTab === 'charge' && chargeValue < 1) {
      setError('يرجى إدخال قيمة شحن صالحة أكبر من الصفر');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const db = getTenantDb();
      const batch = writeBatch(db);

      for (let i = 0; i < count; i++) {
        const newDocRef = doc(collection(db, 'codes'));
        const prefix = activeTab === 'course' ? 'CRS' : 'CHG';
        const codeValue = generateCodeString(prefix);

        const codeDoc: Partial<CardCode> = {
          code: codeValue,
          type: activeTab,
          isUsed: false,
          usedBy: null,
          usedAt: null,
          createdAt: serverTimestamp(),
          teacherId: user.uid,
        };

        if (activeTab === 'course') {
          codeDoc.courseId = selectedCourseId;
        } else {
          codeDoc.value = Number(chargeValue);
        }

        batch.set(newDocRef, codeDoc);
      }

      await batch.commit();
      setCount(10);
      
      // Refresh to first page
      fetchCodes('first');
    } catch (err: any) {
      console.error('Error generating codes:', err);
      setError('فشل إنشاء الأكواد. يرجى المحاولة مرة أخرى.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الكود نهائياً؟')) return;
    try {
      const db = getTenantDb();
      await deleteDoc(doc(db, 'codes', id));
      // Refresh current page
      fetchCodes('first');
    } catch (err) {
      console.error('Error deleting code:', err);
      setError('حدث خطأ أثناء محاولة حذف الكود.');
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

  return (
    <div className="space-y-8 pb-20 text-right font-sans" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-brand-blue/10 text-brand-blue rounded-3xl flex items-center justify-center shrink-0 shadow-2xl shadow-brand-blue/5 border border-brand-blue/10 transition-transform hover:scale-105 duration-500">
            <Key size={36} />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-Cairo font-black text-white leading-none tracking-tight mb-2">
              إدارة أكواد كروت الاشتراك والشحن
            </h1>
            <p className="text-gray-400 text-xs md:text-sm font-bold opacity-80">
              توليد وإدارة كروت الاشتراك المباشر للمقاطع الشارحة وشحن المحفظة المالية
            </p>
          </div>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <button
            onClick={handlePrint}
            disabled={codes.length === 0}
            className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 text-white px-6 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Printer size={20} /> طباعة الأكواد الحالية
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors font-bold px-5 py-4 bg-white/5 rounded-2xl border border-white/5"
          >
            <ChevronLeft size={20} /> رجوع
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 w-full max-w-md no-print">
        <button
          onClick={() => {
            setActiveTab('course');
            setError(null);
            setSearchCode('');
          }}
          className={`flex-1 py-3.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2.5 ${
            activeTab === 'course'
              ? 'bg-brand-blue text-white shadow-xl shadow-brand-blue/20'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <BookOpen size={18} />
          أكواد الكورسات (Printed Course)
        </button>
        <button
          onClick={() => {
            setActiveTab('charge');
            setError(null);
            setSearchCode('');
          }}
          className={`flex-1 py-3.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2.5 ${
            activeTab === 'charge'
              ? 'bg-brand-blue text-white shadow-xl shadow-brand-blue/20'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Coins size={18} />
          أكواد الشحن المالي (Wallet Cards)
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Generator panel */}
        <div className="lg:col-span-1 no-print">
          <div className="glass-card p-8 sticky top-28 border border-white/10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-brand-blue/20 rounded-2xl flex items-center justify-center text-brand-blue">
                <Plus size={24} />
              </div>
              <h3 className="text-xl font-black text-white">
                توليد دفعة أكواد جديدة
              </h3>
            </div>

            <form onSubmit={handleGenerate} className="space-y-6">
              {/* Course Selector */}
              {activeTab === 'course' && (
                <div className="space-y-2">
                  <label className="block text-sm font-black text-gray-400 mr-2">اختر الكورس المستهدف</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white text-lg appearance-none bg-gray-900"
                  >
                    <option value="">اختر كورس من القائمة</option>
                    {allCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Charge Value Input */}
              {activeTab === 'charge' && (
                <div className="space-y-2">
                  <label className="block text-sm font-black text-gray-400 mr-2">قيمة الكود المالية (ج.م)</label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">ج.م</span>
                    <input
                      type="number"
                      min="1"
                      value={chargeValue}
                      onChange={(e) => setChargeValue(parseInt(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-14 pl-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white text-lg"
                    />
                  </div>
                </div>
              )}

              {/* Count Input */}
              <div className="space-y-2">
                <label className="block text-sm font-black text-gray-400 mr-2">عدد الأكواد المطلوبة</label>
                <div className="relative">
                  <Hash className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white text-lg"
                  />
                </div>
                <p className="text-[10px] text-gray-500 font-bold mr-2 mt-1">
                  يمكنك توليد ما يصل إلى 100 كود دفعة واحدة بطريقة عشوائية آمنة.
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex flex-col gap-3 text-sm font-bold text-right" dir="rtl">
                  <div className="flex items-center gap-3">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{typeof error === 'object' ? error.message : error}</span>
                  </div>
                  {typeof error === 'object' && error.url && (
                    <a
                      href={error.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs transition-all shadow self-start"
                    >
                      <ExternalLink size={14} />
                      <span>تفعيل ميزة التصفية بالسنتر (إنشاء الفهرس)</span>
                    </a>
                  )}
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
                    توليد الأكواد الآن
                    <Key size={20} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* List of Codes */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
            <h3 className="text-xl font-black text-white flex items-center gap-4">
              <div className="w-2 h-8 bg-brand-blue rounded-full" />
              الأكواد المتوفرة بالجدول
            </h3>

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {/* Search input */}
              <div className="relative w-full sm:w-48">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  placeholder="بحث سريع برمز الكود..."
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchCodes('first')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pr-9 pl-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-blue"
                />
              </div>

              {/* Status buttons */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-full sm:w-auto">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black transition-all ${
                    filterStatus === 'all' && !searchCode ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setFilterStatus('available')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black transition-all ${
                    filterStatus === 'available' && !searchCode ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  متاح
                </button>
                <button
                  onClick={() => setFilterStatus('used')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-black transition-all ${
                    filterStatus === 'used' && !searchCode ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  مستعمل
                </button>
              </div>
            </div>
          </div>

          {/* PRINT ONLY VIEW */}
          <div className="print-only hidden print:grid print:grid-cols-3 print:gap-4 print:text-black">
            {codes.map((item) => (
              <div key={item.id} className="border-2 border-black p-4 text-center space-y-2 rounded-lg bg-white">
                <p className="text-[10px] font-bold text-gray-600">منصة فهمي التعليمية</p>
                <p className="font-mono text-base font-black tracking-widest">{item.code}</p>
                <p className="text-xs font-bold">
                  {item.type === 'course' ? `تفعيل كورس: ${courseMap[item.courseId || ''] || 'كورس'}` : `شحن محفظة بقيمة: ${item.value} ج.م`}
                </p>
              </div>
            ))}
          </div>

          {/* Cards Grid */}
          <div className="grid sm:grid-cols-2 gap-4 no-print">
            <AnimatePresence mode="popLayout">
              {loading ? (
                <div className="col-span-full py-20 text-center">
                  <Loader2 className="animate-spin text-brand-blue mx-auto w-12 h-12" />
                </div>
              ) : codes.length > 0 ? (
                codes.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`glass-card p-5 flex items-center justify-between border ${
                      item.isUsed
                        ? 'border-white/5 bg-gray-900/40 opacity-60'
                        : 'border-brand-blue/20 hover:border-brand-blue/50'
                    } transition-all group relative overflow-hidden`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          item.isUsed ? 'bg-gray-800 text-gray-500' : 'bg-brand-blue/10 text-brand-blue'
                        }`}
                      >
                        {item.type === 'course' ? <BookOpen size={20} /> : <Coins size={20} />}
                      </div>
                      <div>
                        <p
                          className={`font-mono text-lg font-black tracking-wider ${
                            item.isUsed ? 'text-gray-500 line-through' : 'text-white'
                          }`}
                        >
                          {item.code}
                        </p>
                        <div className="flex flex-col gap-0.5 mt-1">
                          {item.type === 'course' ? (
                            <span className="text-[10px] font-bold text-gray-400 line-clamp-1">
                              الكورس: {courseMap[item.courseId || ''] || 'كورس محذوف'}
                            </span>
                          ) : (
                            <span className="text-sm font-black text-emerald-500">{item.value} ج.م</span>
                          )}

                          {item.isUsed && (
                            <span className="text-[9px] text-gray-500 font-medium">
                              مستعمل بواسطة UID: {item.usedBy?.substring(0, 8)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!item.isUsed && (
                        <button
                          onClick={() => copyToClipboard(item.code, item.id)}
                          className="p-3 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all transform active:scale-90"
                          title="نسخ الكود"
                        >
                          {copiedId === item.id ? (
                            <Check size={18} className="text-emerald-500" />
                          ) : (
                            <Copy size={18} />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-3 hover:bg-red-500/20 rounded-xl text-gray-500 hover:text-red-500 transition-all transform active:scale-90"
                        title="حذف الكود"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center glass-card border-dashed">
                  <Key size={48} className="mx-auto text-gray-700 mb-4 opacity-20" />
                  <p className="text-gray-500 font-bold">لا توجد أكواد لعرضها في هذا التصنيف.</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Pagination controls */}
          {codes.length > 0 && !searchCode && (
            <div className="flex items-center justify-center gap-6 pt-6 no-print">
              <button
                onClick={() => fetchCodes('prev')}
                disabled={!hasPrevPage}
                className="p-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center"
              >
                <ChevronRight size={18} />
              </button>
              <span className="text-sm font-bold text-gray-400">الصفحة {currentPage}</span>
              <button
                onClick={() => fetchCodes('next')}
                disabled={!hasNextPage}
                className="p-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center"
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
