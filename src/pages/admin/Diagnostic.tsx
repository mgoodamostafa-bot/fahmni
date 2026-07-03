import React, { useState } from 'react';
import { collection, getDocs, doc, setDoc, query, where, getDoc } from 'firebase/firestore';
import { getTenantAuth, getTenantDb } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Database,
  Shield,
  User as UserIcon,
} from 'lucide-react';

export const Diagnostic: React.FC = () => {
  const { user, profile } = useAuth();
  const [results, setResults] = useState<
    { name: string; status: 'pending' | 'success' | 'fail'; error?: string }[]
  >([]);
  const [running, setRunning] = useState(false);

  const runDiagnostics = async () => {
    setRunning(true);
    setResults([]);
    const tests: { name: string; fn: () => Promise<any> }[] = [
      {
        name: 'تحقق من تسجيل الدخول (Auth State)',
        fn: async () => {
          if (!getTenantAuth().currentUser) throw new Error('المستخدم غير مسجل دخول');
          return getTenantAuth().currentUser!.uid;
        },
      },
      {
        name: 'تحقق من اسم قاعدة البيانات (Database ID)',
        fn: async () => {
          return 'ai-studio-17f4701a-a7f4-4ee0-808c-1a71c96228c0';
        },
      },
      {
        name: 'قراءة من مجموعة الكورسات (Read /courses)',
        fn: async () => {
          const snap = await getDocs(collection(getTenantDb(), 'Courses'));
          return snap.size;
        },
      },
      {
        name: 'قراءة من مجموعة الدروس (Read /lessons)',
        fn: async () => {
          const snap = await getDocs(collection(getTenantDb(), 'Lessons'));
          return snap.size;
        },
      },
      {
        name: 'اختبار الكتابة (Write to /debug_tests)',
        fn: async () => {
          const testRef = doc(collection(getTenantDb(), 'debug_tests'));
          await setDoc(testRef, {
            timestamp: new Date().toISOString(),
            uid: getTenantAuth().currentUser?.uid,
            test: true,
          });
          return 'Success';
        },
      },
    ];

    for (const test of tests) {
      setResults((prev) => [...prev, { name: test.name, status: 'pending' }]);
      try {
        await test.fn();
        setResults((prev) => {
          const next = [...prev];
          next[next.length - 1].status = 'success';
          return next;
        });
      } catch (err: any) {
        setResults((prev) => {
          const next = [...prev];
          next[next.length - 1].status = 'fail';
          next[next.length - 1].error = err.message;
          return next;
        });
      }
    }
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8 text-right" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-center justify-between bg-white/5 p-6 rounded-3xl border border-white/10">
          <div>
            <h1 className="text-3xl font-black text-white mb-2 font-display">تشخيص الصلاحيات</h1>
            <p className="text-gray-400">تأكد من ربط قاعدة البيانات والقواعد بشكل صحيح</p>
          </div>
          <button
            onClick={runDiagnostics}
            disabled={running}
            className="btn-primary disabled:opacity-50"
          >
            {running ? <Loader2 className="animate-spin" /> : <Database />}
            بدء الاختبار
          </button>
        </header>

        {/* User Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4">
            <UserIcon className="text-brand-blue" />
            <div>
              <p className="text-xs text-gray-500 font-bold">المستخدم الحالي</p>
              <p className="text-white font-black truncate">{user?.email || 'غير مسجل'}</p>
            </div>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4">
            <Shield className="text-brand-blue" />
            <div>
              <p className="text-xs text-gray-500 font-bold">الرتبة في التطبيق</p>
              <p className="text-white font-black">{profile?.role || 'طالب'}</p>
            </div>
          </div>
        </div>

        {/* Test Results */}
        <div className="space-y-4">
          {results.map((result, i) => (
            <div
              key={i}
              className={`p-6 rounded-2xl border flex items-center justify-between ${
                result.status === 'success'
                  ? 'bg-green-500/10 border-green-500/20 text-green-500'
                  : result.status === 'fail'
                    ? 'bg-red-500/10 border-red-500/20 text-red-500'
                    : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              <div className="flex items-center gap-4">
                {result.status === 'success' && <CheckCircle2 size={24} />}
                {result.status === 'fail' && <AlertCircle size={24} />}
                {result.status === 'pending' && <Loader2 size={24} className="animate-spin" />}
                <div>
                  <h3 className="font-black">{result.name}</h3>
                  {result.error && (
                    <p className="text-xs mt-1 font-bold opacity-80">{result.error}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {results.length > 0 && !running && (
          <div className="bg-brand-blue/10 p-6 rounded-3xl border border-brand-blue/20">
            <h4 className="text-brand-blue font-black mb-2 flex items-center gap-2">
              <AlertCircle size={20} /> نصيحة تقنية
            </h4>
            <p className="text-gray-300 text-sm font-bold leading-relaxed">
              إذا فشل اختبار "الدروس" ونجح اختبار "الكورسات"، فهذا يعني أن القواعد المطبقة على قاعدة
              البيانات تمنع الوصول لمجموعة الدروس تحديداً. تأكد من اختيار الـ Database الصحيحة في
              Firebase Console قبل ضغط Publish.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
