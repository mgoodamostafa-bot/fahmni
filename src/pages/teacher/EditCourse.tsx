import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  setDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronLeft, Save, Check, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { compressImage } from '../../utils/imageCompression';
import { SUBJECTS_BY_LEVEL } from '../../constants/subjects';

const getYouTubeThumbnail = (url: string) => {
  const videoId = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/
  )?.[1];
  return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
};

export const TeacherEditCourse: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
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
  });

  const [loading, setLoading] = useState(true);
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
    return () => unsub();
  }, []);

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

  useEffect(() => {
    const fetchCourse = async () => {
      if (!courseId) return;
      try {
        let docSnap = await getDoc(doc(db, 'Courses', courseId));
        let activeCollection = 'Courses';

        if (!docSnap.exists()) {
          docSnap = await getDoc(doc(db, 'courses', courseId));
          activeCollection = 'courses';
        }

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.teacherId !== user?.uid) {
            setError('ليس لديك صلاحية لتعديل هذا الكورس');
            return;
          }
          setFormData({
            ...data,
            whatsappLink: data.whatsappLink || '',
            videoUrl: data.videoUrl || '',
            commissionPercentage: data.commissionPercentage ?? 100,
          } as any);
          setImagePreview(data.imageUrl || data.thumbnailUrl || null);
          (window as any)._activeCollection = activeCollection; // Store for submit
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [courseId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !courseId) return;
    setSaving(true);

    try {
      let finalImageUrl = formData.imageUrl;
      if (imageFile) {
        finalImageUrl = await compressImage(imageFile, 600, 400, 0.7, 'image/webp');
      }

      const thumbnailUrl =
        !imageFile && !finalImageUrl && formData.videoUrl
          ? getYouTubeThumbnail(formData.videoUrl)
          : finalImageUrl;

      const activeCollection = (window as any)._activeCollection || 'Courses';
      await updateDoc(doc(db, activeCollection, courseId), {
        ...formData,
        imageUrl: finalImageUrl,
        thumbnailUrl: thumbnailUrl || finalImageUrl,
        commissionPercentage: Number(formData.commissionPercentage) || 100,
        status: profile?.role === 'admin' ? 'approved' : 'pending',
        updatedAt: serverTimestamp(),
      });
      setSuccess(true);
      setTimeout(() => navigate('/teacher/courses'), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-blue" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8" dir="rtl">
      <button
        onClick={() => navigate('/teacher/courses')}
        className="text-white flex items-center gap-2 mb-8"
      >
        <ChevronLeft size={24} /> رجوع لوحة المعلم
      </button>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto glass-card p-8 bg-gray-900 rounded-3xl border border-white/10"
      >
        <h2 className="text-3xl font-black text-white mb-8">تعديل الكورس (المعلم)</h2>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        {success ? (
          <div className="text-center py-12 text-green-500">تم حفظ التعديلات بنجاح.</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="text"
              placeholder="عنوان الكورس"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white"
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={formData.level}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    level: e.target.value,
                    subject: SUBJECTS_BY_LEVEL[e.target.value]?.[0] || 'برمجة',
                  })
                }
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white appearance-none"
              >
                <option value="primary">الابتدائية</option>
                <option value="prep">الإعدادية</option>
                <option value="secondary">الثانوية</option>
                <option value="general">كورسات عامة ومهارات</option>
              </select>

              {formData.level !== 'general' ? (
                <select
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white appearance-none"
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

            <div className="space-y-2">
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
                      <AlertCircle size={12} />{' '}
                      {showAddSubject ? 'إلغاء' : 'إضافة مجال أو قسم جديد'}
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

            <textarea
              placeholder="وصف الكورس"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white h-32"
              required
            />
            <input
              type="number"
              placeholder="السعر"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white"
              required
            />
            <label className="block text-sm font-black text-gray-400">
              غلاف الكورس (600x400 ميكس)
            </label>
            <div
              onClick={() => document.getElementById('imageInput')?.click()}
              className="w-full h-48 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden relative group hover:border-brand-blue/50 transition-colors"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="text-center text-gray-500">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 text-brand-blue">
                    <Save size={24} />
                  </div>
                  <span className="font-bold">ارفع صورة الغلاف</span>
                </div>
              )}
              <input
                id="imageInput"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }
                }}
                className="hidden"
              />
            </div>
            <input
              type="url"
              placeholder="رابط فيديو تعريفي (يوتيوب)"
              value={formData.videoUrl}
              onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white"
            />
            <input
              type="url"
              placeholder="رابط تواصل الشراء (واتساب المدرس)"
              value={formData.whatsappLink}
              onChange={(e) => setFormData({ ...formData, whatsappLink: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white"
            />
            <div className="bg-brand-blue/5 border border-brand-blue/20 p-6 rounded-2xl mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-brand-blue/20 rounded-lg flex items-center justify-center text-brand-blue">
                  <Save size={18} />
                </div>
                <h3 className="font-black text-white">إعدادات العمولة والارباح</h3>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-black text-gray-400 mr-2">
                  نسبة المدرس من المبيعات (%)
                </label>
                <div className="relative">
                  <input
                    disabled={profile?.role !== 'admin'}
                    type="number"
                    min="0"
                    max="100"
                    value={formData.commissionPercentage}
                    onChange={(e) =>
                      setFormData({ ...formData, commissionPercentage: Number(e.target.value) })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white shadow-inner font-mono disabled:opacity-50"
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
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-emerald-400 font-mono font-black">
                        {((formData.price * formData.commissionPercentage) / 100).toLocaleString(
                          'ar-EG'
                        )}{' '}
                        ج.م
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">نصيبك الصافي:</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-blue-400 font-mono font-black">
                        {(
                          formData.price -
                          (formData.price * formData.commissionPercentage) / 100
                        ).toLocaleString('ar-EG')}{' '}
                        ج.م
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">نصيب المنصة:</span>
                    </div>
                  </motion.div>
                )}

                <p className="text-[10px] text-gray-500 font-bold mr-2 mt-1">
                  {profile?.role === 'admin'
                    ? 'يمكنك تعديل هذه النسبة لهذا الكورس.'
                    : 'هذه هي النسبة المتفق عليها مع الإدارة.'}
                </p>
              </div>
            </div>

            <button disabled={saving} className="btn-primary w-full py-4 text-xl font-black">
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
