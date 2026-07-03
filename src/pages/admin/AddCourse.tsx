import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  onSnapshot,
  setDoc,
  arrayUnion,
  updateDoc,
  arrayRemove,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronLeft, Plus, Check, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImage } from '../../utils/imageCompression';
import { SUBJECTS_BY_LEVEL } from '../../constants/subjects';

export const AdminAddCourse: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: 0,
    imageUrl: '',
    videoUrl: '',
    isPublished: false,
    subject: SUBJECTS_BY_LEVEL['secondary'][0],
    level: 'secondary',
    grade: '1',
    whatsappLink: '',
    commissionPercentage: 100,
    teacherId: '',
  });

  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [newCustomSubject, setNewCustomSubject] = useState('');
  const [showAddSubject, setShowAddSubject] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general_subjects'), (d) => {
      if (d.exists()) setCustomSubjects(d.data().subjects || []);
    });

    const fetchTeachers = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const snap = await getDocs(q);
        const teachersData = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setTeachers(teachersData);

        // Default to current user if teacher
        if (profile?.role === 'teacher') {
          setFormData((prev) => ({
            ...prev,
            teacherId: user?.uid || '',
            commissionPercentage: profile.defaultCommission ?? 100,
          }));
        }
      } catch (err) {
        console.error('Error fetching teachers', err);
      } finally {
        setLoadingTeachers(false);
      }
    };
    fetchTeachers();

    return () => unsub();
  }, [user, profile]);

  const handleTeacherChange = (teacherId: string) => {
    const selectedTeacher = teachers.find((t) => t.id === teacherId);
    setFormData({
      ...formData,
      teacherId: teacherId,
      commissionPercentage: selectedTeacher?.defaultCommission ?? 100,
    });
  };

  const handleAddCustomSubject = async () => {
    if (!newCustomSubject.trim()) return;
    try {
      await setDoc(
        doc(db, 'settings', 'general_subjects'),
        { subjects: arrayUnion(newCustomSubject.trim()) },
        { merge: true }
      );
      setFormData({ ...formData, subject: newCustomSubject.trim() });
      setNewCustomSubject('');
      setShowAddSubject(false);
    } catch (e) {
      console.error('Error adding subject', e);
    }
  };

  const handleRemoveCustomSubject = async (e: React.MouseEvent, sub: string) => {
    e.stopPropagation();
    if (!window.confirm(`هل أنت متأكد من مسح المجال: ${sub}؟`)) return;
    try {
      await updateDoc(doc(db, 'settings', 'general_subjects'), { subjects: arrayRemove(sub) });
      if (formData.subject === sub)
        setFormData({ ...formData, subject: SUBJECTS_BY_LEVEL['general'][0] });
    } catch (e) {
      console.error('Error removing subject', e);
    }
  };

  const currentLevelSubjects =
    formData.level === 'general'
      ? Array.from(new Set([...(SUBJECTS_BY_LEVEL['general'] || []), ...customSubjects]))
      : SUBJECTS_BY_LEVEL[formData.level] || [];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('حجم الصورة كبير جداً');
        return;
      }
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setError(null);
    }
  };

  const getYouTubeThumbnail = (url: string) => {
    const videoId = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/
    )?.[1];
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      let finalImageUrl = formData.imageUrl;

      // 🚀 Use Base64 Compression
      if (imageFile) {
        try {
          finalImageUrl = await compressImage(imageFile, 600, 400, 0.7, 'image/webp');
        } catch (compressErr) {
          console.error('Compression feedback:', compressErr);
          throw new Error('حدث خطأ أثناء معالجة الصورة');
        }
      }

      const thumbnailUrl =
        !finalImageUrl && formData.videoUrl
          ? getYouTubeThumbnail(formData.videoUrl)
          : finalImageUrl;

      const courseData = {
        title: formData.title,
        description: formData.description,
        price: Number(formData.price),
        imageUrl: finalImageUrl,
        videoUrl: formData.videoUrl,
        thumbnailUrl: thumbnailUrl || finalImageUrl,
        isPublished: formData.isPublished,
        isPaid: formData.price > 0,
        status: 'pending',
        teacherId: formData.teacherId || user.uid,
        teacherName: formData.teacherId
          ? teachers.find((t) => t.id === formData.teacherId)?.displayName || 'مدرس'
          : profile?.displayName || 'مدرس',
        teacherPhotoURL: formData.teacherId
          ? teachers.find((t) => t.id === formData.teacherId)?.imageUrl || ''
          : profile?.imageUrl || profile?.photoURL || '',
        subject: formData.subject,
        level: formData.level,
        grade: formData.grade,
        whatsappLink: formData.whatsappLink || '',
        commissionPercentage: Number(formData.commissionPercentage) || 100,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'Courses'), courseData);
      setSuccess(true);
      setTimeout(() => {
        navigate('/teacher/courses');
      }, 1500);
    } catch (err: any) {
      console.error('Error saving course:', err);
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() =>
            navigate('/teacher/courses')
          }
          className="text-white hover:text-brand-blue transition-colors flex items-center gap-2 font-bold mb-8"
        >
          <ChevronLeft size={24} /> رجوع للوحة التحكم
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-3xl border border-white/10 shadow-2xl bg-gray-900"
        >
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="p-3 bg-brand-blue/10 rounded-2xl text-brand-blue font-black">
              <Plus size={32} />
            </div>
            <h2 className="text-3xl font-black text-white font-display uppercase tracking-tight">
              إضافة كورس تعليمي
            </h2>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 flex items-center gap-3 font-bold">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check size={40} />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">تم الحفظ بنجاح!</h3>
              <p className="text-gray-400">سيتم نقلك لصفحة الكورسات لمراجعة المحتوى...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {(profile?.role === 'admin' || profile?.role === 'teacher') && (
                <div className="space-y-2">
                  <label className="block text-sm font-black text-gray-400 mr-2">
                    اختيار المدرس
                  </label>
                  <select
                    required
                    value={formData.teacherId}
                    onChange={(e) => handleTeacherChange(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white shadow-inner"
                  >
                    <option value="">اختر المدرس...</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.displayName || t.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-black text-gray-400 mr-2">عنوان الكورس</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white shadow-inner"
                  placeholder="مثال: فيزياء الصف الثالث الثانوي"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-black text-gray-400 mr-2">
                    المرحلة الدراسية
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) => {
                      const newLevel = e.target.value;
                      setFormData({
                        ...formData,
                        level: newLevel,
                        subject: SUBJECTS_BY_LEVEL[newLevel][0],
                      });
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white appearance-none"
                  >
                    <option value="primary">الابتدائية</option>
                    <option value="prep">الإعدادية</option>
                    <option value="secondary">الثانوية</option>
                    <option value="general">كورسات عامة ومهارات</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-black text-gray-400 mr-2">
                    الصف الدراسي
                  </label>
                  {formData.level !== 'general' ? (
                    <select
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white appearance-none"
                    >
                      {formData.level === 'primary' &&
                        [1, 2, 3, 4, 5, 6].map((g) => (
                          <option key={g} value={g}>
                            الصف {g} الابتدائي
                          </option>
                        ))}
                      {formData.level === 'prep' &&
                        [1, 2, 3].map((g) => (
                          <option key={g} value={g}>
                            الصف {g} الإعدادي
                          </option>
                        ))}
                      {formData.level === 'secondary' &&
                        [1, 2, 3].map((g) => (
                          <option key={g} value={g}>
                            الصف {g} الثانوي
                          </option>
                        ))}
                    </select>
                  ) : (
                    <div className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 font-bold text-gray-500">
                      لجميع الأعمار / بدون صف
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-black text-gray-400 mr-2">
                    المادة العلمية
                  </label>
                  <div className="relative">
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white appearance-none"
                    >
                      {currentLevelSubjects.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                    {formData.level === 'general' && (
                      <div className="mt-2 text-left">
                        <button
                          type="button"
                          onClick={() => setShowAddSubject(!showAddSubject)}
                          className="text-[10px] bg-brand-blue/10 text-brand-blue px-3 py-1 rounded-lg font-black hover:bg-brand-blue hover:text-white transition-all inline-flex items-center gap-1"
                        >
                          <Plus size={12} /> {showAddSubject ? 'إلغاء' : 'إضافة مجال أو قسم جديد'}
                        </button>
                      </div>
                    )}
                  </div>
                  {showAddSubject && formData.level === 'general' && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={newCustomSubject}
                        onChange={(e) => setNewCustomSubject(e.target.value)}
                        placeholder="اكتب اسم المجال..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs font-bold text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSubject}
                        className="bg-brand-blue text-white px-4 py-2 rounded-xl text-xs font-black"
                      >
                        إضافة
                      </button>
                    </div>
                  )}
                  {formData.level === 'general' && customSubjects.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 p-2 bg-white/5 rounded-xl border border-white/10">
                      {customSubjects.map((sub) => (
                        <div
                          key={sub}
                          className="flex items-center gap-1 bg-white/10 text-gray-300 text-[10px] px-2 py-1 rounded-md font-bold"
                        >
                          {sub}
                          <button
                            type="button"
                            onClick={(e) => handleRemoveCustomSubject(e, sub)}
                            className="text-red-400 hover:text-red-500 font-bold ml-1"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-black text-gray-400 mr-2">
                    سعر الكورس (ج.م)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-black text-gray-400 mr-2">
                  غلاف الكورس (600x400 ميكس)
                </label>
                <div
                  className="w-full h-48 bg-white/5 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden relative group hover:border-brand-blue/50 transition-colors"
                  onClick={() => document.getElementById('courseImageInput')?.click()}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="text-center text-gray-500">
                      <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 text-brand-blue">
                        <Plus size={24} />
                      </div>
                      <span className="font-bold">ارفع صورة الغلاف</span>
                    </div>
                  )}
                  <input
                    id="courseImageInput"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-black text-gray-400 mr-2">
                  وصف قصير للكورس
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white h-32 shadow-inner"
                  placeholder="اكتب ماذا سيتعلم الطالب في هذا الكورس..."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-black text-gray-400 mr-2">
                  رابط فيديو تعريفي (يوتيوب)
                </label>
                <input
                  type="url"
                  value={formData.videoUrl}
                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white shadow-inner"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>

              <div className="bg-brand-blue/5 border border-brand-blue/20 p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-brand-blue/20 rounded-lg flex items-center justify-center text-brand-blue">
                    <Plus size={18} />
                  </div>
                  <h3 className="font-black text-white">إعدادات العمولة والارباح</h3>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-black text-gray-400 mr-2">
                    نسبة المدرس من المبيعات (%)
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      value={formData.commissionPercentage}
                      onChange={(e) =>
                        setFormData({ ...formData, commissionPercentage: Number(e.target.value) })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white shadow-inner font-mono"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue font-black">
                      %
                    </div>
                  </div>

                  {/* 💰 Live Breakdown */}
                  {formData.price > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-white/5 border border-white/10 rounded-xl p-4 mt-2 space-y-2 border-dashed"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-400 font-mono font-black">
                          {((formData.price * formData.commissionPercentage) / 100).toLocaleString(
                            'ar-EG'
                          )}{' '}
                          ج.م
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold">نصيب المدرس:</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-blue-400 font-mono font-black">
                          {(
                            formData.price -
                            (formData.price * formData.commissionPercentage) / 100
                          ).toLocaleString('ar-EG')}{' '}
                          ج.م
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold">
                          نصيب المنصة (الربح):
                        </span>
                      </div>
                    </motion.div>
                  )}

                  <p className="text-[10px] text-gray-500 font-bold mr-2 mt-1">
                    إذا كانت 70%، سيحصل المدرس على 70ج والمنصة على 30ج من كل 100ج اشتراك.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-black text-gray-400 mr-2">
                  رابط تواصل الشراء (واتساب المدرس)
                </label>
                <input
                  type="url"
                  value={formData.whatsappLink}
                  onChange={(e) => setFormData({ ...formData, whatsappLink: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white shadow-inner"
                  placeholder="https://wa.me/201234567890"
                />
                <p className="text-[10px] text-gray-500 font-bold mr-2">
                  إذا تركت هذا الحقل فارغاً، سيتم استخدام رابط المنصة الرئيسي.
                </p>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={formData.isPublished}
                  onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                  className="w-5 h-5 accent-brand-blue"
                />
                <div>
                  <label
                    htmlFor="isPublished"
                    className="font-black text-white cursor-pointer block leading-none mb-1"
                  >
                    نشر الكورس فوراً
                  </label>
                  <p className="text-[10px] text-gray-500 font-bold italic">
                    سيظهر للطلاب مباشرة بعد الحفظ
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white py-4 text-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-black shadow-xl shadow-brand-blue/30 transition-all transform active:scale-95"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    جاري معالجة الكورس...
                  </>
                ) : (
                  <>
                    <Check size={24} />
                    حفظ ونشر الكورس
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
};
