import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { getTenantDb } from '../../lib/firebase';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { motion } from 'framer-motion';
import {
  Send,
  Users,
  BookOpen,
  MessageSquare,
  Bell,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  Key,
  Link,
  GraduationCap,
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
}

export const SendNotification: React.FC = () => {
  const { profile } = useAuth();
  const { tenantData } = useTenant();
  const { sendNotification } = useNotifications();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    body: '',
    target: 'all', // 'all' or courseId
    targetRole: 'all', // 'all' | 'student' | 'teacher'
    targetGrade: 'all', // 'all' | gradeId
    link: '',
  });

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const collections = ['Courses', 'courses'];
        const allDocs: any[] = [];

        for (const collName of collections) {
          let q;
          if (profile?.role === 'teacher' && !profile?.isOwner) {
            q = query(collection(getTenantDb(), collName), where('teacherId', '==', profile.uid));
          } else {
            q = query(collection(getTenantDb(), collName));
          }
          const snapshot = await getDocs(q);
          snapshot.docs.forEach((doc) => {
            allDocs.push({ id: doc.id, title: (doc.data() as any).title || 'كورس بدون عنوان' });
          });
        }

        // Deduplicate by ID and sort by title
        const uniqueCourses = Array.from(
          new Map(allDocs.map((item) => [item.id.toLowerCase(), item])).values()
        );
        setCourses(uniqueCourses.sort((a, b) => a.title.localeCompare(b.title, 'ar')));
      } catch (err) {
        console.error('Error fetching courses for notification:', err);
      }
    };
    if (profile?.uid) fetchCourses();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.body) {
      setError('يرجى ملء جميع الحقول');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const payload: any = {
        title: formData.title,
        message: formData.body,
        type: 'info',
        targetGroupId: formData.target,
        targetRole: formData.targetRole,
        senderName: profile?.displayName || 'الإدارة',
      };

      if (formData.targetGrade !== 'all') {
        payload.targetGrade = formData.targetGrade;
      }
      if (formData.link.trim()) {
        payload.link = formData.link.trim();
      }

      await sendNotification(payload);
      setSuccess(true);
      setFormData({
        title: '',
        body: '',
        target: 'all',
        targetRole: 'all',
        targetGrade: 'all',
        link: '',
      });
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError('حدث خطأ أثناء الإرسال: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeStages = tenantData?.educationStage || 'secondary';
  const gradeOptions = [{ id: 'all', label: 'جميع الصفوف' }];
  if (activeStages.includes('primary')) {
    gradeOptions.push(
      { id: 'primary-4', label: 'الصف الرابع الابتدائي' },
      { id: 'primary-5', label: 'الصف الخامس الابتدائي' },
      { id: 'primary-6', label: 'الصف السادس الابتدائي' }
    );
  }
  if (activeStages.includes('preparatory') || activeStages.includes('prep')) {
    gradeOptions.push(
      { id: 'prep-1', label: 'الصف الأول الإعدادي' },
      { id: 'prep-2', label: 'الصف الثاني الإعدادي' },
      { id: 'prep-3', label: 'الصف الثالث الإعدادي' }
    );
  }
  if (activeStages.includes('secondary')) {
    gradeOptions.push(
      { id: 'sec-1', label: 'الصف الأول الثانوي - علوم متكاملة' },
      { id: 'sec-2', label: 'الصف الثاني الثانوي' },
      { id: 'sec-3', label: 'الصف الثالث الثانوي' }
    );
  }

  const translateGradeShort = (grade: string) => {
    const map: Record<string, string> = {
      'primary-4': 'رابع ابتدائي',
      'primary-5': 'خامس ابتدائي',
      'primary-6': 'سادس ابتدائي',
      'prep-1': 'أول إعدادي',
      'prep-2': 'ثاني إعدادي',
      'prep-3': 'ثالث إعدادي',
      'sec-1': 'أول ثانوي - متكاملة',
      'sec-2': 'ثاني ثانوي',
      'sec-3': 'ثالث ثانوي',
    };
    return map[grade] || grade;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-brand-blue/10 text-brand-blue rounded-3xl flex items-center justify-center shrink-0 shadow-2xl shadow-brand-blue/5 border border-brand-blue/10 transition-transform hover:scale-105 duration-500">
            <Send size={36} />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-white leading-none tracking-tight mb-2">
              إرسال تنبيه
            </h1>
            <p className="text-gray-400 text-xs md:text-sm font-bold opacity-80">
              تواصل مع طلابك بإشعارات لحظية مخصصة وموجهة لصف معين أو كورس محدد
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-space-900 p-10 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl space-y-8"
          >
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 mr-2">
                  عنوان التنبيه
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="مثلاً: بدأ بث المراجعة النهائية 🚨"
                  className="w-full bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-brand-blue focus:bg-white dark:focus:bg-space-800 rounded-2xl px-6 py-4 outline-none transition-all font-bold text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 mr-2">
                  محتوى التنبيه
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  rows={4}
                  placeholder="اكتب هنا تفاصيل التنبيه التي ستظهر للطلاب..."
                  className="w-full bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-brand-blue focus:bg-white dark:focus:bg-space-800 rounded-2xl px-6 py-4 outline-none transition-all font-bold resize-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 mr-2">
                    توجيه التنبيه حسب الرتبة
                  </label>
                  <div className="flex gap-2">
                    {[
                      { id: 'all', label: 'الجميع', icon: ShieldAlert },
                      { id: 'student', label: 'الطلاب فقط', icon: Users },
                    ].map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, targetRole: role.id })}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 transition-all font-black text-xs ${
                          formData.targetRole === role.id
                            ? 'border-brand-blue bg-brand-blue/5 text-brand-blue'
                            : 'border-gray-100 dark:border-white/5 text-gray-400 dark:hover:bg-white/5'
                        }`}
                      >
                        <role.icon size={16} />
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 mr-2">
                    توجيه التنبيه حسب الصف
                  </label>
                  <div className="relative">
                    <select
                      value={formData.targetGrade}
                      onChange={(e) => setFormData({ ...formData, targetGrade: e.target.value })}
                      className="w-full appearance-none bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-brand-blue focus:bg-white dark:focus:bg-space-800 rounded-2xl px-6 py-3.5 pr-12 outline-none transition-all font-bold text-sm text-gray-900 dark:text-white"
                    >
                      {gradeOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <GraduationCap
                      size={20}
                      className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-gray-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 mr-2">
                  رابط التنقل/التوجيه (اختياري)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    placeholder="مثال: /course/math-101 أو رابط خارجي https://t.me/..."
                    className="w-full bg-gray-50 dark:bg-white/5 border-2 border-transparent focus:border-brand-blue focus:bg-white dark:focus:bg-space-800 rounded-2xl px-6 py-4 pr-12 outline-none transition-all font-bold text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <Link
                    size={18}
                    className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 mr-2">
                  الفئة المستهدفة حسب الكورس (اختياري)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, target: 'all' })}
                    className={`flex items-center gap-4 px-6 py-4 rounded-2xl border-2 transition-all font-bold ${
                      formData.target === 'all'
                        ? 'border-brand-blue bg-brand-blue/5 text-brand-blue shadow-lg shadow-brand-blue/10'
                        : 'border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 text-gray-500 hover:border-gray-200 dark:hover:border-white/10'
                    }`}
                  >
                    <Users size={20} />
                    <span>كل الكورسات</span>
                  </button>
                  <div className="relative">
                    <select
                      value={formData.target === 'all' ? '' : formData.target}
                      onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                      className={`w-full appearance-none flex items-center gap-4 px-6 py-4 rounded-2xl border-2 transition-all font-bold pr-12 ${
                        formData.target !== 'all'
                          ? 'border-brand-blue bg-brand-blue/5 text-brand-blue shadow-lg shadow-brand-blue/10'
                          : 'border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 text-gray-500'
                      }`}
                    >
                      <option value="" disabled>
                        اختيار كورس محدد...
                      </option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                    <BookOpen
                      size={20}
                      className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 flex items-center gap-3 font-bold text-sm"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500 flex items-center gap-3 font-bold text-sm"
              >
                <CheckCircle size={18} />
                تم إرسال التنبيه بنجاح لجميع الطلاب المستهدفين!
              </motion.div>
            )}

            <button
              disabled={loading}
              className="w-full btn-primary !py-5 shadow-2xl shadow-brand-blue/40 disabled:opacity-50 group flex items-center justify-center gap-3 cursor-pointer"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>إرسال التنبيه الآن</span>
                  <Send
                    size={20}
                    className="group-hover:-translate-x-1 group-hover:translate-y-1 transition-transform"
                  />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Info/Preview Section */}
        <div className="space-y-8">
          {/* iOS Notification Card Preview */}
          <div className="bg-[#111116] border border-white/10 p-8 rounded-[2.5rem] shadow-3xl text-right space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-blue/10 rounded-full blur-2xl" />
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Bell className="text-brand-blue" size={20} />
              <span>معاينة التنبيه التفاعلي</span>
            </h3>

            {/* Simulated iPhone Screen backdrop */}
            <div className="bg-black/50 border border-white/5 rounded-3xl p-5 shadow-inner space-y-4">
              <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold px-1">
                <span className="flex items-center gap-1">
                  {formData.targetRole === 'all' ? 'للجميع' : 'للطلاب'}
                  {formData.targetGrade !== 'all' && ` • ${translateGradeShort(formData.targetGrade)}`}
                </span>
                <span>الآن</span>
              </div>

              {/* Toast Card */}
              <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 shadow-lg space-y-2 relative group overflow-hidden">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-blue/15 border border-brand-blue/30 text-brand-blue flex items-center justify-center shrink-0">
                    <Bell size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-extrabold text-xs text-white truncate">
                        {formData.title || 'بدأ البث المباشر الآن!'}
                      </h4>
                    </div>
                    <p className="text-[11px] text-gray-400 font-medium leading-relaxed line-clamp-3">
                      {formData.body || 'سيظهر محتوى الإشعار بالتفصيل هنا للطلاب عند وصول التنبيه فورياً.'}
                    </p>
                  </div>
                </div>

                {formData.link && (
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center gap-1.5 text-[9px] font-black text-brand-blue">
                    <Link size={10} />
                    <span className="truncate">رابط مرفق: {formData.link}</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[10px] text-gray-500 font-bold text-center italic leading-relaxed">
              * سيتم تشغيل نغمة رنين خفيفة وفخمة للطلاب المتواجدين على المنصة فور إرسالك التنبيه.
            </p>
          </div>

          <div className="bg-gradient-to-br from-brand-blue to-blue-700 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-brand-blue/20">
            <h3 className="text-xl font-black mb-4">نصائح الإرسال</h3>
            <ul className="space-y-4 text-sm font-bold opacity-90 leading-relaxed">
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 bg-white rounded-full shrink-0 mt-2" />
                استخدم عناوين واضحة ومختصرة لضمان القراءة السريعة.
              </li>
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 bg-white rounded-full shrink-0 mt-2" />
                عند تحديد صف معين، سيظهر التنبيه فقط لطلاب هذا الصف.
              </li>
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 bg-white rounded-full shrink-0 mt-2" />
                اربط التنبيه برابط مباشر لتسهيل وصول الطالب للمحتوى بنقرة واحدة.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
