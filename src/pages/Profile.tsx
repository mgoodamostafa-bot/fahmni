import React from 'react';
import {
  User,
  Mail,
  Calendar,
  Shield,
  MapPin,
  GraduationCap,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Lock,
  X,
  Check,
  Facebook,
  MessageCircle,
  Send,
  Youtube,
  Globe,
  Instagram,
  Hash,
  Award,
  ShieldAlert,
  Users,
  BookOpen,
  Smartphone,
  Printer,
  ArrowRight,
  Wallet,
  PlusCircle,
  Star,
  Trophy,
  Zap,
  Copy,
  CreditCard,
  FileText,
  LogOut,
  Key,
} from 'lucide-react';
import { TransactionHistory } from '../components/student/TransactionHistory';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  doc,
  updateDoc,
  query,
  collection,
  where,
  onSnapshot,
  getDoc,
  runTransaction,
  serverTimestamp,
  getDocs,
  addDoc,
} from 'firebase/firestore';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { getTenantDb, getTenantAuth } from '../lib/firebase';
import { QRCodeCanvas } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { validateAndRedeemCode } from '../services/cardCodeService';

export const Profile: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSettings();

  // Tab State
  const [activeTab, setActiveTab] = React.useState<'wallet' | 'card' | 'academic' | 'security' | 'history'>(
    profile?.role === 'student' ? 'wallet' : 'security'
  );

  // Generic notifications
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [topupSuccess, setTopupSuccess] = React.useState<string | null>(null);

  // Profile Image Upload State
  const [uploading, setUploading] = React.useState(false);

  // Edit Name State
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [updatingName, setUpdatingName] = React.useState(false);

  // Edit Academic Info State
  const [isEditingEdu, setIsEditingEdu] = React.useState(false);
  const [level, setLevel] = React.useState(profile?.level || '');
  const [grade, setGrade] = React.useState(profile?.grade || '');
  const [school, setSchool] = React.useState(profile?.school || '');
  const [updatingEdu, setUpdatingEdu] = React.useState(false);

  // Password reset state
  const [passwordSent, setPasswordSent] = React.useState(false);

  // Password change states
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [showPasswordForm, setShowPasswordForm] = React.useState(false);
  const [updatingPassword, setUpdatingPassword] = React.useState(false);

  // Coupon Topup State
  const [topupCode, setTopupCode] = React.useState('');
  const [toppingUp, setToppingUp] = React.useState(false);

  // Vodafone Cash Topup State
  const [topupMethod, setTopupMethod] = React.useState<'coupon' | 'vodafone' | 'instapay'>('coupon');
  const [vodaAmount, setVodaAmount] = React.useState('');
  const [vodaSender, setVodaSender] = React.useState('');
  const [vodaReceipt, setVodaReceipt] = React.useState<File | null>(null);
  const [vodaReceiptBase64, setVodaReceiptBase64] = React.useState<string>('');
  const [submittingVoda, setSubmittingVoda] = React.useState(false);

  // InstaPay Topup State
  const [instaAmount, setInstaAmount] = React.useState('');
  const [instaSender, setInstaSender] = React.useState('');
  const [instaReceipt, setInstaReceipt] = React.useState<File | null>(null);
  const [instaReceiptBase64, setInstaReceiptBase64] = React.useState<string>('');
  const [submittingInsta, setSubmittingInsta] = React.useState(false);

  // Lists & Histories
  const [enrollments, setEnrollments] = React.useState<any[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = React.useState(false);
  const [offlineResults, setOfflineResults] = React.useState<any[]>([]);

  // Modals & Clipboard Alerts
  const [copiedType, setCopiedType] = React.useState<'voda' | 'insta' | null>(null);

  // Helper: Client-side Image compression to Base64 (resolves the Storage upload hang)
  const compressImage = (file: File, maxDim: number = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxDim) {
              h *= maxDim / w;
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w *= maxDim / h;
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL('image/webp', 0.7);
          resolve(base64);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Handle Vodafone file input changes
  const handleVodaReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setVodaReceipt(file);
      const base64 = await compressImage(file, 800);
      setVodaReceiptBase64(base64);
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء معالجة صورة الإيصال.');
    }
  };

  // Handle InstaPay file input changes
  const handleInstaReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setInstaReceipt(file);
      const base64 = await compressImage(file, 800);
      setInstaReceiptBase64(base64);
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء معالجة صورة الإيصال.');
    }
  };

  // Copy to clipboard utility
  const handleCopy = (text: string, type: 'voda' | 'insta') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Repairs Admin Role & Student ID
  React.useEffect(() => {
    if (user?.email === 'admin@fahmni.com' && profile?.role !== 'admin') {
      const repairRole = async () => {
        try {
          await updateDoc(doc(getTenantDb(), 'users', user.uid), { role: 'admin' });
        } catch (e) {
          console.error('Failed to repair admin role:', e);
        }
      };
      repairRole();
    }
  }, [user, profile]);

  React.useEffect(() => {
    if (!user?.uid || !profile) return;

    const repairId = async () => {
      const currentId = profile.studentId;
      const needsRepair =
        !currentId ||
        currentId === '126107' ||
        currentId === '126103' ||
        (currentId.startsWith('12610') && currentId.length >= 9);

      if (needsRepair) {
        try {
          await runTransaction(getTenantDb(), async (transaction) => {
            const counterRef = doc(getTenantDb(), 'system', 'counters');
            const counterSnap = await transaction.get(counterRef);

            let lastId = 7;
            if (counterSnap.exists()) {
              lastId = counterSnap.data().lastStudentId || 7;
            }

            const nextSeq = lastId + 1;
            const nextId = `12610${nextSeq}`;

            transaction.update(doc(getTenantDb(), 'users', user.uid), { studentId: nextId });
            transaction.set(counterRef, { lastStudentId: nextSeq }, { merge: true });
          });
        } catch (e) {
          console.error('Failed to repair sequential ID:', e);
        }
      }
    };

    repairId();

    setLoadingEnrollments(true);
    const q = query(collection(getTenantDb(), 'Enrollments'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const docs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const withTitles = await Promise.all(
        docs.map(async (en: any) => {
          try {
            const cDoc = await getDoc(doc(getTenantDb(), 'Courses', en.courseId));
            return { ...en, courseTitle: cDoc.exists() ? cDoc.data().title : 'كورس محذوف' };
          } catch {
            return { ...en, courseTitle: 'خطأ في التحميل' };
          }
        })
      );
      setEnrollments(
        withTitles.sort((a, b) => {
          const tA = a.createdAt?.toDate?.()?.getTime() || 0;
          const tB = b.createdAt?.toDate?.()?.getTime() || 0;
          return tB - tA;
        })
      );
      setLoadingEnrollments(false);
    });
    return () => unsub();
  }, [user?.uid]);

  React.useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(getTenantDb(), 'offline_results'), where('studentId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setOfflineResults(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => {
            const tA = a.createdAt?.seconds || 0;
            const tB = b.createdAt?.seconds || 0;
            return tB - tA;
          })
      );
    });
    return () => unsub();
  }, [user?.uid]);

  const stages = [
    { id: 'primary', name: 'المرحلة الابتدائية' },
    { id: 'prep', name: 'المرحلة الإعدادية' },
    { id: 'secondary', name: 'المرحلة الثانوية' },
    { id: 'general', name: 'كورسات ومهارات عامة' },
  ];

  const getGrades = (stage: string) => {
    if (stage === 'primary') return ['1', '2', '3', '4', '5', '6'];
    if (stage === 'prep') return ['1', '2', '3'];
    if (stage === 'secondary') return ['1', '2', '3'];
    return [];
  };

  const getStageName = (id: string) => stages.find((s) => s.id === id)?.name || id;
  const getGradeName = (g: string) =>
    g === 'all'
      ? 'بدون صف (عام)'
      : `الصف ${['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'][parseInt(g) - 1] || g}`;

  React.useEffect(() => {
    if (profile?.displayName) setNewName(profile.displayName);
    if (profile?.level) setLevel(profile.level);
    if (profile?.grade) setGrade(profile.grade);
    if (profile?.school) setSchool(profile.school);
  }, [profile]);

  if (loading)
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-blue" size={48} />
      </div>
    );
  if (!user || !profile) return null;

  // Actions
  const handleNameUpdate = async () => {
    if (!newName.trim() || newName === profile.displayName) {
      setIsEditingName(false);
      return;
    }
    setUpdatingName(true);
    try {
      await updateDoc(doc(getTenantDb(), 'users', user.uid), { displayName: newName.trim() });
      setIsEditingName(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('فشل تحديث الاسم');
    } finally {
      setUpdatingName(false);
    }
  };

  const handleEduUpdate = async () => {
    setUpdatingEdu(true);
    try {
      if (!user?.uid) return;
      await updateDoc(doc(getTenantDb(), 'users', user.uid), {
        level,
        grade,
        school: school.trim(),
      });
      localStorage.setItem('selectedLevel', level);
      localStorage.setItem('selectedGrade', grade);
      setIsEditingEdu(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('فشل تحديث البيانات التعليمية');
    } finally {
      setUpdatingEdu(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      await sendPasswordResetEmail(getTenantAuth(), user.email!);
      setPasswordSent(true);
      setTimeout(() => setPasswordSent(false), 5000);
    } catch {
      setError('فشل إرسال رابط إعادة تعيين كلمة المرور');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setError('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (newPassword.length < 6) {
      setError('يجب أن تكون كلمة المرور مكونة من 6 أحرف على الأقل.');
      return;
    }
    if (!hasLetter || !hasNumber) {
      setError('يجب أن تحتوي كلمة المرور الجديدة على حروف وأرقام معاً (ليست أرقاماً فقط).');
      return;
    }

    setUpdatingPassword(true);
    setError(null);
    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth');
      const auth = getTenantAuth();
      if (!auth.currentUser || !user?.email) throw new Error('مستخدم غير معروف');

      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Update password
      await updatePassword(auth.currentUser, newPassword);

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowPasswordForm(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        setError('كلمة المرور الحالية غير صحيحة.');
      } else {
        setError(err.message || 'فشل تحديث كلمة المرور. حاول مرة أخرى.');
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topupCode.trim()) return;

    setToppingUp(true);
    setError(null);
    setTopupSuccess(null);

    try {
      const code = topupCode.trim().toUpperCase();
      const result = await validateAndRedeemCode(code, user.uid, undefined, profile);

      if (result.type !== 'charge') {
        throw new Error('هذا الكود مخصص لتفعيل كورس وليس لشحن المحفظة.');
      }

      setTopupSuccess(`تم شحن ${result.value || 0} ج.م بنجاح! 🎉`);
      setTopupCode('');
      setTimeout(() => setTopupSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'فشل شحن الرصيد. حاول مرة أخرى.');
    } finally {
      setToppingUp(false);
    }
  };

  const handleVodaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vodaAmount || !vodaSender || !vodaReceiptBase64 || !user?.uid) {
      setError('يرجى ملء جميع الحقول ورفع صورة الإيصال لإتمام طلب الشحن.');
      return;
    }

    setSubmittingVoda(true);
    setError(null);
    setTopupSuccess(null);

    try {
      await addDoc(collection(getTenantDb(), 'wallet_requests'), {
        userId: user.uid,
        userName: profile.displayName,
        studentId: profile.studentId,
        amount: Number(vodaAmount),
        senderNumber: vodaSender,
        receiptUrl: vodaReceiptBase64,
        method: 'vodafone_cash',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setTopupSuccess('تم إرسال طلب الشحن بنجاح، سيتم مراجعته وإضافة الرصيد قريباً.');
      setVodaAmount('');
      setVodaSender('');
      setVodaReceipt(null);
      setVodaReceiptBase64('');
      setTimeout(() => setTopupSuccess(null), 5000);
    } catch (err: any) {
      console.error('VodaSubmit Error:', err);
      setError(err.message || 'فشل إرسال الطلب. حاول مرة أخرى.');
    } finally {
      setSubmittingVoda(false);
    }
  };

  const handleInstaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instaAmount || !instaSender || !instaReceiptBase64 || !user?.uid) {
      setError('يرجى ملء جميع الحقول ورفع صورة الإيصال لإتمام طلب الشحن.');
      return;
    }

    setSubmittingInsta(true);
    setError(null);
    setTopupSuccess(null);

    try {
      await addDoc(collection(getTenantDb(), 'wallet_requests'), {
        userId: user.uid,
        userName: profile.displayName,
        studentId: profile.studentId,
        amount: Number(instaAmount),
        senderNumber: instaSender,
        receiptUrl: instaReceiptBase64,
        method: 'instapay',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setTopupSuccess('تم إرسال طلب الشحن بنجاح، سيتم مراجعته وإضافة الرصيد قريباً.');
      setInstaAmount('');
      setInstaSender('');
      setInstaReceipt(null);
      setInstaReceiptBase64('');
      setTimeout(() => setTopupSuccess(null), 5000);
    } catch (err: any) {
      console.error('InstaSubmit Error:', err);
      setError(err.message || 'فشل إرسال الطلب. حاول مرة أخرى.');
    } finally {
      setSubmittingInsta(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('حجم الصورة كبير جداً (الأقصى 5 ميجابايت)');
      e.target.value = '';
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(false);
    try {
      const base64 = await compressImage(file, 250);
      await updateDoc(doc(getTenantDb(), 'users', user.uid), { imageUrl: base64, photoURL: base64 });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('فشل رفع الصورة. حاول مرة أخرى.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Navigation tabs config
  const navTabs = [
    ...(profile.role === 'student'
      ? [
          { id: 'wallet', label: 'المحفظة والشحن', icon: Wallet },
          { id: 'academic', label: 'البيانات الدراسية', icon: GraduationCap },
        ]
      : []),
    { id: 'security', label: 'الأمان والضبط', icon: Shield },
    ...(profile.role === 'student'
      ? [
          { id: 'history', label: 'المعاملات والتقارير', icon: FileText },
        ]
      : []),
  ];

  return (
    <>
      <div className="w-full mx-auto pb-24 px-2 sm:px-6 relative overflow-hidden" dir="rtl">
        {/* Glow Effects */}
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-brand-blue/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[140px] pointer-events-none" />

        {/* 🏹 Floating Glass Back Button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[60] w-12 h-12 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group overflow-hidden"
          title="رجوع للرئيسية"
        >
          <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
        </button>

        {/* Top Cover Banner */}
        <div className="relative mb-32 pt-4">
          <div className="h-44 sm:h-64 rounded-[2.5rem] bg-gradient-to-r from-brand-blue/80 via-indigo-900/90 to-purple-900/80 shadow-2xl overflow-hidden relative border border-white/10">
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-brand-500)/20,transparent)]" />
            <div className="absolute bottom-4 left-6 text-white/20 font-black text-6xl hidden sm:block tracking-widest uppercase select-none">
              {profile.role === 'student' ? 'STUDENT PROFILE' : 'TEACHER PROFILE'}
            </div>
          </div>

          {/* Profile Details Header Card */}
          <div className="absolute -bottom-24 left-4 right-4 sm:left-8 sm:right-8 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
            <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-right w-full md:w-auto">
              {/* Avatar Uploader with Glowing Active Indicator */}
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full p-1.5 bg-gradient-to-tr from-brand-blue to-purple-500 shadow-2xl group shrink-0 -mt-20 md:-mt-24">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-brand-blue font-black text-3xl sm:text-5xl overflow-hidden relative">
                  {profile.imageUrl || profile.photoURL ? (
                    <img
                      src={profile.imageUrl || profile.photoURL}
                      alt={profile.displayName}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                    />
                  ) : (
                    <span className="opacity-40">
                      {profile.displayName?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  )}
                  {/* File Pick Overlay */}
                  <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer backdrop-blur-sm">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                    {uploading ? (
                      <Loader2 className="animate-spin text-white" size={24} />
                    ) : (
                      <>
                        <Camera className="text-white mb-1" size={22} />
                        <span className="text-[9px] text-white font-black tracking-wider">تغيير الصورة</span>
                      </>
                    )}
                  </label>
                </div>
                {/* Active Indicator Pulse Ring */}
                <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-4 border-slate-900 rounded-full shadow-lg" />
              </div>

              {/* User Bio Information */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                  {isEditingName ? (
                    <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="bg-transparent text-white font-black text-lg px-3 py-1 focus:outline-none w-48 sm:w-64"
                        autoFocus
                      />
                      <button
                        onClick={handleNameUpdate}
                        disabled={updatingName}
                        className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-xl transition-all"
                      >
                        {updatingName ? <Loader2 className="animate-spin" size={16} /> : <Check size={18} />}
                      </button>
                      <button
                        onClick={() => setIsEditingName(false)}
                        className="p-2 text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                        {profile.displayName}
                      </h1>
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="p-2 text-white/40 hover:text-brand-blue hover:bg-white/5 rounded-xl transition-all"
                        title="تعديل الاسم"
                      >
                        <Pencil size={18} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                  <div className="bg-brand-blue/10 border border-brand-blue/30 px-3.5 py-1 rounded-full text-xs font-black text-brand-blue flex items-center gap-1.5 shadow-sm shadow-brand-blue/5">
                    <Shield size={13} className="text-brand-blue" />
                    <span className="font-mono tracking-wider select-all">{profile.studentId}</span>
                  </div>
                  <span className="bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full text-xs font-black text-purple-400 flex items-center gap-1">
                    <Star size={13} className="fill-current" />
                    طالب متميز
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions (Admin Entry Shortcut) */}
            {profile.role === 'admin' && (
              <button
                onClick={() => navigate('/teacher')}
                className="w-full md:w-auto bg-brand-blue hover:bg-brand-500 text-white font-black px-6 py-3.5 rounded-2xl shadow-xl shadow-brand-blue/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all text-sm"
              >
                <ShieldAlert size={18} />
                دخول لوحة التحكم للمدرس
              </button>
            )}
          </div>
        </div>

        {/* Global Toast Alerts */}
        <AnimatePresence>
          {(error || success || passwordSent || topupSuccess) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-2xl mb-8 flex items-center gap-3 font-bold text-sm border shadow-lg ${
                error
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : passwordSent
                    ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              {error ? (
                <AlertCircle size={20} />
              ) : passwordSent ? (
                <Mail size={20} />
              ) : (
                <CheckCircle2 size={20} />
              )}
              <span className="flex-1">
                {error ||
                  topupSuccess ||
                  (passwordSent
                    ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.'
                    : 'تمت العملية بنجاح!')}
              </span>
              <button onClick={() => { setError(null); setTopupSuccess(null); }} className="text-white/40 hover:text-white">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 🎛️ Navigation Tab Slider (Premium Glass Pills) */}
        <div className="w-full overflow-x-auto pb-4 mb-8 no-scrollbar">
          <div className="flex gap-2 bg-slate-900/50 p-2 rounded-[2rem] border border-white/5 backdrop-blur-xl w-max mx-auto md:w-full md:justify-around">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-5 py-3.5 rounded-[1.5rem] font-bold text-sm transition-all duration-300 shrink-0 relative ${
                    isActive
                      ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20 scale-[1.02]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 🔲 Main Tabs Content Panel */}
        <div className="w-full min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              {/* ==================== 1. WALLET TAB ==================== */}
              {activeTab === 'wallet' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Virtual Credit Card Display */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-start">
                    <div className="w-full max-w-[420px] aspect-[1.6/1] rounded-[2.5rem] p-8 bg-gradient-to-br from-slate-950 via-[#0a1128] to-[#12224d] border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] relative overflow-hidden group perspective-1000">
                      {/* Decorative Holographic Chip & Accent Circles */}
                      <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_70%)]" />
                      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl" />
                      
                      {/* Card Chip & Network */}
                      <div className="flex justify-between items-start mb-10 relative z-10">
                        <div className="w-12 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-200 p-1 flex items-center justify-center opacity-85 shadow-md">
                          <div className="w-full h-full border border-amber-600/30 rounded" />
                        </div>
                        <div className="text-left text-white/30 font-black text-xl font-mono tracking-tighter uppercase select-none">
                          FAHMNI CARD
                        </div>
                      </div>

                      {/* Card Number (Student ID formatted) */}
                      <div className="mb-8 relative z-10 text-right">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">كود هوية الطالب</p>
                        <p className="text-3xl font-mono text-white tracking-[0.25em] font-black select-all text-right" dir="ltr">
                          {profile.studentId ? profile.studentId.match(/.{1,3}/g)?.join(' ') : '000 000'}
                        </p>
                      </div>

                      {/* Card Holder & Balance */}
                      <div className="flex justify-between items-end relative z-10">
                        <div className="text-right">
                          <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">صاحب الحساب</p>
                          <p className="text-sm font-bold text-white max-w-[200px] truncate">{profile.displayName}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">الرصيد النشط</p>
                          <p className="text-2xl font-black text-brand-blue tracking-tight">
                            {(profile.walletBalance || 0).toLocaleString('ar-EG')} <span className="text-xs font-bold text-slate-400">ج.م</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="w-full max-w-[420px] bg-slate-900/40 border border-white/5 rounded-3xl p-5 mt-4 text-center">
                      <p className="text-xs text-gray-400 font-bold">
                        يمكنك شحن رصيد المحفظة لتفعيل الكورسات والحصص مباشرة وبشكل فوري عبر اختيار إحدى الوسائل المتاحة.
                      </p>
                    </div>
                  </div>

                  {/* Recharge Methods Form Panel */}
                  <div className="lg:col-span-7 bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 sm:p-8 shadow-xl">
                    <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                      <Zap size={22} className="text-brand-yellow fill-current" />
                      شحن الرصيد الفوري
                    </h3>

                    {/* Method Toggle Buttons */}
                    <div className="grid grid-cols-3 gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10 mb-8">
                      <button
                        onClick={() => setTopupMethod('coupon')}
                        className={`py-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                          topupMethod === 'coupon'
                            ? 'bg-brand-blue text-white shadow'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        شحن بكوبون
                      </button>
                      <button
                        onClick={() => setTopupMethod('vodafone')}
                        className={`py-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                          topupMethod === 'vodafone'
                            ? 'bg-red-600/90 text-white shadow'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        فودافون كاش
                      </button>
                      <button
                        onClick={() => setTopupMethod('instapay')}
                        className={`py-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                          topupMethod === 'instapay'
                            ? 'bg-emerald-600/90 text-white shadow'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        انستا باي
                      </button>
                    </div>

                    {/* Form 1: Coupon */}
                    {topupMethod === 'coupon' && (
                      <form onSubmit={handleTopUp} className="space-y-6">
                        <div className="space-y-2">
                          <label className="block text-gray-400 font-bold text-xs sm:text-sm mr-2">كود الكوبون المطبوع</label>
                          <div className="relative group">
                            <Star className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-blue/30 group-focus-within:text-brand-blue group-focus-within:animate-spin-slow transition-all" size={20} />
                            <input
                              type="text"
                              placeholder="أدخل كود الكوبون... (مثال: C-XXXX)"
                              value={topupCode}
                              onChange={(e) => setTopupCode(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl py-4.5 pr-12 pl-4 text-white text-lg font-black outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all placeholder:text-white/20"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={toppingUp || !topupCode.trim()}
                          className="w-full py-4 bg-brand-blue hover:bg-brand-500 disabled:opacity-50 text-white rounded-2xl font-black text-md transition-all shadow-lg hover:shadow-brand-blue/30 flex items-center justify-center gap-2"
                        >
                          {toppingUp ? <Loader2 className="animate-spin" size={22} /> : 'شحن الكوبون الآن'}
                        </button>
                      </form>
                    )}

                    {/* Form 2: Vodafone Cash */}
                    {topupMethod === 'vodafone' && (
                      <form onSubmit={handleVodaSubmit} className="space-y-6">
                        {/* Merchant Vodafone Number Display */}
                        <div className="bg-red-950/20 border border-red-500/20 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
                          <div>
                            <p className="text-xs font-bold text-gray-400 mb-1">يرجى تحويل المبلغ المطلوب إلى رقم فودافون كاش التالي:</p>
                            <p className="text-2xl sm:text-3xl font-black text-red-500 tracking-wider font-mono select-all">
                              {settings.vodafoneCashNumber || 'الرقم غير متاح حالياً'}
                            </p>
                          </div>
                          {settings.vodafoneCashNumber && (
                            <button
                              type="button"
                              onClick={() => handleCopy(settings.vodafoneCashNumber!, 'voda')}
                              className="bg-red-500/10 hover:bg-red-500 border border-red-500/20 text-red-400 hover:text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5"
                            >
                              {copiedType === 'voda' ? (
                                <>تم النسخ! ✓</>
                              ) : (
                                <>
                                  <Copy size={14} /> نسخ الرقم
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Input Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="block text-gray-400 font-bold text-xs mr-2">المبلغ المرسل (ج.م)</label>
                            <input
                              type="number"
                              placeholder="مثال: 150"
                              value={vodaAmount}
                              onChange={(e) => setVodaAmount(e.target.value)}
                              min="1"
                              required
                              className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 px-4 text-white font-bold outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-gray-400 font-bold text-xs mr-2">رقم الهاتف المرسل منه</label>
                            <input
                              type="text"
                              placeholder="رقم المحفظة الخاصة بك"
                              value={vodaSender}
                              onChange={(e) => setVodaSender(e.target.value)}
                              required
                              className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 px-4 text-white font-bold outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all"
                            />
                          </div>
                        </div>

                        {/* Receipt Upload with instant preview & Base64 Compression */}
                        <div className="space-y-2">
                          <label className="block text-gray-400 font-bold text-xs mr-2">صورة إيصال التحويل (مطلوب) *</label>
                          <div className="relative border-2 border-dashed border-white/10 hover:border-red-500/50 rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3">
                            <input
                              type="file"
                              accept="image/*"
                              required
                              onChange={handleVodaReceiptChange}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {vodaReceiptBase64 ? (
                              <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-white/15">
                                <img src={vodaReceiptBase64} alt="إيصال التحويل" className="w-full h-full object-cover" />
                                <div className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow cursor-pointer hover:scale-105" onClick={(e) => { e.preventDefault(); setVodaReceipt(null); setVodaReceiptBase64(''); }}>
                                  <X size={12} />
                                </div>
                              </div>
                            ) : (
                              <>
                                <Camera className="text-gray-500" size={32} />
                                <div className="text-center">
                                  <p className="text-xs text-white font-bold">اضغط هنا أو اسحب صورة الإيصال</p>
                                  <p className="text-[10px] text-gray-500 mt-1">يجب أن تكون صورة التحويل واضحة (أقصى 5 ميجا)</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={submittingVoda || !vodaAmount || !vodaSender || !vodaReceiptBase64 || !settings.vodafoneCashNumber}
                          className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-2xl font-black text-md transition-all shadow-lg hover:shadow-red-600/30 flex items-center justify-center gap-2"
                        >
                          {submittingVoda ? <Loader2 className="animate-spin" size={22} /> : 'إرسال طلب التحويل'}
                        </button>
                      </form>
                    )}

                    {/* Form 3: InstaPay */}
                    {topupMethod === 'instapay' && (
                      <form onSubmit={handleInstaSubmit} className="space-y-6">
                        {/* Merchant InstaPay ID Display */}
                        <div className="bg-emerald-950/20 border border-emerald-500/20 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
                          <div>
                            <p className="text-xs font-bold text-gray-400 mb-1">يرجى التحويل على عنوان انستا باي (InstaPay IPN) التالي:</p>
                            <p className="text-xl sm:text-2xl font-black text-emerald-400 tracking-wide font-mono select-all">
                              {settings.instapayAddress || 'العنوان غير متاح حالياً'}
                            </p>
                          </div>
                          {settings.instapayAddress && (
                            <button
                              type="button"
                              onClick={() => handleCopy(settings.instapayAddress!, 'insta')}
                              className="bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 text-emerald-400 hover:text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5"
                            >
                              {copiedType === 'insta' ? (
                                <>تم النسخ! ✓</>
                              ) : (
                                <>
                                  <Copy size={14} /> نسخ العنوان
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Input Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="block text-gray-400 font-bold text-xs mr-2">المبلغ المرسل (ج.م)</label>
                            <input
                              type="number"
                              placeholder="مثال: 200"
                              value={instaAmount}
                              onChange={(e) => setInstaAmount(e.target.value)}
                              min="1"
                              required
                              className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 px-4 text-white font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-gray-400 font-bold text-xs mr-2">اسم الحساب / العنوان المرسل منه</label>
                            <input
                              type="text"
                              placeholder="عنوان انستا باي الخاص بك أو اسم المحول"
                              value={instaSender}
                              onChange={(e) => setInstaSender(e.target.value)}
                              required
                              className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 px-4 text-white font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                            />
                          </div>
                        </div>

                        {/* Receipt Upload with Base64 Compression */}
                        <div className="space-y-2">
                          <label className="block text-gray-400 font-bold text-xs mr-2">صورة إيصال التحويل (مطلوب) *</label>
                          <div className="relative border-2 border-dashed border-white/10 hover:border-emerald-500/50 rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-3">
                            <input
                              type="file"
                              accept="image/*"
                              required
                              onChange={handleInstaReceiptChange}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {instaReceiptBase64 ? (
                              <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-white/15">
                                <img src={instaReceiptBase64} alt="إيصال انستا باي" className="w-full h-full object-cover" />
                                <div className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow cursor-pointer hover:scale-105" onClick={(e) => { e.preventDefault(); setInstaReceipt(null); setInstaReceiptBase64(''); }}>
                                  <X size={12} />
                                </div>
                              </div>
                            ) : (
                              <>
                                <Camera className="text-gray-500" size={32} />
                                <div className="text-center">
                                  <p className="text-xs text-white font-bold">اضغط هنا أو اسحب صورة الإيصال</p>
                                  <p className="text-[10px] text-gray-500 mt-1">يجب أن تكون الصورة واضحة لبيانات التحويل</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={submittingInsta || !instaAmount || !instaSender || !instaReceiptBase64 || !settings.instapayAddress}
                          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-md transition-all shadow-lg hover:shadow-emerald-600/30 flex items-center justify-center gap-2"
                        >
                          {submittingInsta ? <Loader2 className="animate-spin" size={22} /> : 'إرسال طلب التحويل'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}



              {/* ==================== 3. ACADEMIC TAB ==================== */}
              {activeTab === 'academic' && (
                <div className="max-w-2xl mx-auto bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 sm:p-10 shadow-xl">
                  <div className="flex items-center justify-between pb-6 border-b border-white/5 mb-8">
                    <div>
                      <h3 className="text-lg font-black text-white">الملف الدراسي والصف</h3>
                      <p className="text-xs text-gray-500 font-bold mt-1">تعديل مرحلتك وصفك الدراسي الحالي</p>
                    </div>
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-brand-blue border border-white/10">
                      <GraduationCap size={24} />
                    </div>
                  </div>

                  {isEditingEdu ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-gray-400 font-bold text-xs mr-2">المرحلة الدراسية</label>
                          <select
                            value={level}
                            onChange={(e) => {
                              setLevel(e.target.value);
                              setGrade(getGrades(e.target.value)[0] || 'all');
                            }}
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl py-3.5 px-4 text-white font-bold focus:border-brand-blue outline-none"
                          >
                            <option value="">اختر المرحلة</option>
                            {stages.map((stg) => (
                              <option key={stg.id} value={stg.id}>{stg.name}</option>
                            ))}
                          </select>
                        </div>

                        {level !== 'general' && (
                          <div className="space-y-2">
                            <label className="block text-gray-400 font-bold text-xs mr-2">الصف الدراسي</label>
                            <select
                              value={grade}
                              onChange={(e) => setGrade(e.target.value)}
                              className="w-full bg-slate-950 border border-white/10 rounded-2xl py-3.5 px-4 text-white font-bold focus:border-brand-blue outline-none"
                            >
                              <option value="all">دورة عامة</option>
                              {getGrades(level).map((g) => (
                                <option key={g} value={g}>{`الصف ${g}`}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-gray-400 font-bold text-xs mr-2">اسم مدرستك</label>
                        <input
                          type="text"
                          value={school}
                          onChange={(e) => setSchool(e.target.value)}
                          placeholder="اكتب اسم مدرستك هنا..."
                          className="w-full bg-slate-950 border border-white/10 rounded-2xl py-3.5 px-4 text-white font-bold focus:border-brand-blue outline-none"
                        />
                      </div>

                      <div className="pt-4 flex gap-3">
                        <button
                          onClick={handleEduUpdate}
                          disabled={updatingEdu}
                          className="flex-1 py-3.5 bg-brand-blue hover:bg-brand-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm transition-all"
                        >
                          {updatingEdu ? <Loader2 className="animate-spin inline mr-1" size={16} /> : null}
                          حفظ التغييرات
                        </button>
                        <button
                          onClick={() => setIsEditingEdu(false)}
                          className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-bold text-sm transition-all"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="bg-black/30 p-5 rounded-2xl border border-white/5">
                          <p className="text-xs text-gray-500 font-bold mb-1">المرحلة الحالية</p>
                          <p className="text-md font-black text-white">{getStageName(profile.level)}</p>
                        </div>
                        <div className="bg-black/30 p-5 rounded-2xl border border-white/5">
                          <p className="text-xs text-gray-500 font-bold mb-1">الصف الدراسي</p>
                          <p className="text-md font-black text-white">{getGradeName(profile.grade)}</p>
                        </div>
                        <div className="bg-black/30 p-5 rounded-2xl border border-white/5">
                          <p className="text-xs text-gray-500 font-bold mb-1">المدرسة</p>
                          <p className="text-md font-black text-white truncate">{profile.school || 'غير محدد'}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => setIsEditingEdu(true)}
                        className="w-full py-4 bg-brand-blue/15 hover:bg-brand-blue border border-brand-blue/30 text-brand-blue hover:text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2"
                      >
                        <Pencil size={16} /> تعديل البيانات الدراسية
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ==================== 4. SECURITY TAB ==================== */}
              {activeTab === 'security' && (
                <div className="max-w-2xl mx-auto bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 sm:p-10 shadow-xl space-y-8">
                  <div className="flex items-center justify-between pb-6 border-b border-white/5">
                    <div>
                      <h3 className="text-lg font-black text-white">إعدادات الحساب والأمان</h3>
                      <p className="text-xs text-gray-500 font-bold mt-1">تغيير كلمة المرور أو تسجيل الخروج</p>
                    </div>
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-brand-blue border border-white/10">
                      <Lock size={24} />
                    </div>
                  </div>

                  {showPasswordForm ? (
                    <form onSubmit={handleUpdatePassword} className="space-y-5 animate-in fade-in duration-300">
                      <div className="space-y-2 text-right">
                        <label className="text-xs sm:text-sm font-black text-slate-300">كلمة المرور الحالية</label>
                        <input
                          type="password"
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-5 py-4 bg-slate-950/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-bold"
                        />
                      </div>

                      <div className="space-y-2 text-right">
                        <label className="text-xs sm:text-sm font-black text-slate-300">كلمة المرور الجديدة</label>
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="حروف وأرقام، 6 خانات كحد أدنى"
                          className="w-full px-5 py-4 bg-slate-950/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-bold"
                        />
                      </div>

                      <div className="space-y-2 text-right">
                        <label className="text-xs sm:text-sm font-black text-slate-300">تأكيد كلمة المرور الجديدة</label>
                        <input
                          type="password"
                          required
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          className="w-full px-5 py-4 bg-slate-950/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-bold"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                          type="submit"
                          disabled={updatingPassword}
                          className="flex-1 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {updatingPassword ? <Loader2 className="animate-spin" size={14} /> : <Key size={14} />}
                          {updatingPassword ? 'جاري تحديث كلمة المرور...' : 'حفظ كلمة المرور الجديدة'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordForm(false);
                            setCurrentPassword('');
                            setNewPassword('');
                            setConfirmNewPassword('');
                          }}
                          className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-300 border border-white/10 font-bold text-xs hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-1.5"
                        >
                          إلغاء التراجع
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                          <span className="text-gray-500 text-xs font-bold">البريد الإلكتروني</span>
                          <span className="text-white text-sm font-black font-mono select-all">{user.email}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                          <span className="text-gray-500 text-xs font-bold">صلاحية الحساب</span>
                          <span className="text-brand-blue text-xs font-black bg-brand-blue/15 px-3 py-1 rounded-full">
                            {profile.role?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                          <span className="text-gray-500 text-xs font-bold">تاريخ الانضمام للمنصة</span>
                          <span className="text-white text-sm font-black">
                            {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                          onClick={() => setShowPasswordForm(true)}
                          className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-300 border border-white/10 font-bold text-xs hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-1.5"
                        >
                          <Key size={14} /> تغيير كلمة المرور مباشرة
                        </button>
                        <button
                          onClick={async () => {
                            await signOut(getTenantAuth());
                            navigate('/login');
                          }}
                          className="flex-1 py-4 rounded-2xl bg-rose-600/10 text-rose-500 border border-rose-500/20 font-black text-xs hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-1.5"
                        >
                          <LogOut size={14} /> تسجيل الخروج من الحساب
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ==================== 5. HISTORY TAB ==================== */}
              {activeTab === 'history' && (
                <div className="space-y-10">
                  {/* Offline results if present */}
                  {offlineResults.length > 0 && (
                    <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 sm:p-8 shadow-xl">
                      <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                        <Award size={20} className="text-brand-yellow" />
                        سجل درجات الاختبارات الورقية (السنتر)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {offlineResults.map((result: any) => (
                          <div key={result.id} className="bg-black/30 p-5 rounded-2xl border border-white/5 space-y-2">
                            <p className="text-xs text-gray-500 font-bold">{result.examName || 'اختبار دوري'}</p>
                            <div className="flex justify-between items-baseline">
                              <span className="text-2xl font-black text-white">{result.score}</span>
                              <span className="text-xs text-gray-400">من {result.maxScore} درجة</span>
                            </div>
                            {result.notes && <p className="text-[10px] text-brand-blue font-bold mt-1">ملاحظة: {result.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financial Transactions List */}
                  <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 sm:p-8 shadow-xl">
                    <h3 className="text-lg font-black text-white mb-6 flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center border border-emerald-500/20">
                        <Wallet size={18} />
                      </div>
                      سجل المعاملات والشحن المالي
                    </h3>
                    <TransactionHistory userId={user.uid} />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>


    </>
  );
};
