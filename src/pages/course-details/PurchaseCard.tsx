import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Loader2, AlertCircle, CheckCircle2, ChevronLeft,
  Wallet, Copy, Smartphone, Upload, X, CreditCard,
  MessageCircle, ShieldCheck, Award, Play, Sparkles, Tag
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Types ──────────────────────────────────────────────────────
export type PaymentMethod = 'wallet' | 'vodafone' | 'instapay' | 'code' | null;

interface PurchaseCardProps {
  course: {
    id: string;
    title: string;
    price: number;
    whatsappLink?: string;
  };
  courseId: string;
  isEnrolled: boolean;
  enrolling: boolean;
  error: string | null;
  topupSuccess: string | null;
  purchaseMethod: PaymentMethod;
  activationCode: string;
  walletBalance: number;
  vodafoneCashNumber: string;
  instapayAddress: string;
  whatsappNumber: string;
  lessons: any[];
  // Vodafone Cash form state
  vodaSender: string;
  vodaReceiptBase64: string;
  vodaReceiptFile: File | null;
  // InstaPay form state
  instaSender: string;
  instaReceiptBase64: string;
  instaReceiptFile: File | null;
  // Handlers
  onSetPurchaseMethod: (method: PaymentMethod) => void;
  onSetActivationCode: (code: string) => void;
  onSetError: (error: string | null) => void;
  onHandleEnroll: (e?: React.FormEvent, method?: 'wallet' | 'coupon' | 'code') => void;
  onHandleDirectPayment: (e: React.FormEvent, method: 'vodafone' | 'instapay') => void;
  onSetShowConfirmModal: (show: boolean) => void;
  // Vodafone handlers
  onSetVodaSender: (v: string) => void;
  onSetVodaReceiptFile: (f: File | null) => void;
  onSetVodaReceiptBase64: (s: string) => void;
  // InstaPay handlers
  onSetInstaSender: (v: string) => void;
  onSetInstaReceiptFile: (f: File | null) => void;
  onSetInstaReceiptBase64: (s: string) => void;
  // Receipt handler
  onHandleReceiptChange: (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setBase64: (s: string) => void
  ) => void;
  // Coupon props
  couponCode: string;
  onSetCouponCode: (code: string) => void;
  appliedCoupon: any | null;
  couponLoading: boolean;
  discountedPrice: number | null;
  onApplyCoupon: (e: React.FormEvent) => void;
  onRemoveCoupon: () => void;
}

// ─── Animation Variants ─────────────────────────────────────────
const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }
};

// ─── Component ──────────────────────────────────────────────────
export const PurchaseCard: React.FC<PurchaseCardProps> = ({
  course, courseId, isEnrolled, enrolling, error, topupSuccess,
  purchaseMethod, activationCode, walletBalance,
  vodafoneCashNumber, instapayAddress, whatsappNumber,
  lessons,
  vodaSender, vodaReceiptBase64, vodaReceiptFile,
  instaSender, instaReceiptBase64, instaReceiptFile,
  onSetPurchaseMethod, onSetActivationCode, onSetError,
  onHandleEnroll, onHandleDirectPayment, onSetShowConfirmModal,
  onSetVodaSender, onSetVodaReceiptFile, onSetVodaReceiptBase64,
  onSetInstaSender, onSetInstaReceiptFile, onSetInstaReceiptBase64,
  onHandleReceiptChange,
  // Coupon props
  couponCode, onSetCouponCode, appliedCoupon, couponLoading,
  discountedPrice, onApplyCoupon, onRemoveCoupon
}) => {
  const navigate = useNavigate();
  const [copiedType, setCopiedType] = useState<'voda' | 'insta' | null>(null);
  const [showCouponInput, setShowCouponInput] = useState(false);

  const handleCopy = useCallback((text: string, type: 'voda' | 'insta') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  }, []);

  // ── Already Enrolled: Continue Learning ──
  if (isEnrolled) {
    return (
      <button
        onClick={() => lessons.length > 0 && navigate(`/courses/${courseId}/learn/${lessons[0].id}`)}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-[1.5rem] text-xl font-black shadow-2xl shadow-emerald-600/30 flex items-center justify-center gap-3 group transition-all transform active:scale-[0.98]"
      >
        <span>استكمل التعلم</span>
        <div className="bg-white/20 p-2 rounded-full group-hover:scale-110 transition-transform">
          <Play size={18} className="fill-current" />
        </div>
      </button>
    );
  }

  const isFree = course.price === 0 || (appliedCoupon && discountedPrice === 0);
  const activePrice = discountedPrice !== null ? discountedPrice : course.price;

  // ── Purchase Card UI ──
  return (
    <div className="bg-gray-950/60 backdrop-blur-2xl p-6 sm:p-8 rounded-[2rem] border border-white/[0.08] shadow-2xl relative overflow-hidden text-right" dir="rtl">
      <div className="absolute top-0 right-0 w-40 h-40 bg-brand-blue/5 blur-[80px] pointer-events-none" />

      <AnimatePresence mode="wait">
        {/* ── Success State ── */}
        {topupSuccess ? (
          <motion.div key="success" {...scaleIn} className="text-center py-6 space-y-5">
            <div className="w-16 h-16 bg-emerald-500/15 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-black text-white">تم بنجاح!</h3>
            <p className="text-gray-300 text-sm leading-relaxed">{topupSuccess}</p>
          </motion.div>
        ) :

        /* ── Activation Code Form ── */
        purchaseMethod === 'code' ? (
          <motion.form key="code" {...scaleIn} onSubmit={(e) => onHandleEnroll(e, 'code')} className="space-y-4">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => { onSetPurchaseMethod(null); onSetError(null); }}
                className="text-gray-400 hover:text-white p-2 bg-white/5 rounded-xl border border-white/10 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-base font-black text-white">الاشتراك بكود التفعيل</h3>
            </div>
            
            <p className="text-[11px] text-gray-500 font-bold">
              أدخل كود تفعيل الكورس المطبوع (المكون من كروت السنتر أو المبيعات الورقية) لتفعيل الكورس فوراً.
            </p>
            
            <input required type="text" placeholder="أدخل كود التفعيل هنا (مثال: CRS-XXXX-XXXX)" value={activationCode}
              onChange={(e) => onSetActivationCode(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-center font-mono uppercase text-white text-sm focus:ring-2 focus:ring-amber-500/30 outline-none transition-all" />
            
            {error && <p className="text-red-400 text-xs font-bold">{error}</p>}
            
            <button type="submit" disabled={enrolling}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3.5 rounded-xl text-sm font-black shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {enrolling ? <Loader2 className="animate-spin" size={18} /> : 'تفعيل الكورس الآن'}
            </button>
          </motion.form>
        ) :

        /* ── Vodafone Cash ── */
        purchaseMethod === 'vodafone' ? (
          <motion.form key="vodafone" {...scaleIn} onSubmit={(e) => onHandleDirectPayment(e, 'vodafone')} className="space-y-4">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => { onSetPurchaseMethod(null); onSetError(null); }}
                className="text-gray-400 hover:text-white p-2 bg-white/5 rounded-xl border border-white/10 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-base font-black text-white">فودافون كاش</h3>
            </div>
            <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-4 space-y-1.5">
              <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">حول إلى الرقم</span>
              <div className="flex items-center justify-between">
                <span className="text-lg font-black text-white tracking-widest font-mono select-all">{vodafoneCashNumber}</span>
                <button type="button" onClick={() => handleCopy(vodafoneCashNumber, 'voda')}
                  className="p-1.5 bg-white/5 rounded-lg border border-white/10 text-red-400 hover:bg-white/10 transition-all">
                  {copiedType === 'voda' ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 font-bold">
              حول <span className="text-red-400 font-black">{activePrice} ج.م</span> ثم ارفق الإيصال
            </p>
            <input required type="tel" placeholder="رقم محفظتك (11 رقم)" value={vodaSender}
              onChange={(e) => onSetVodaSender(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-right text-white text-sm focus:ring-2 focus:ring-red-500/30 outline-none transition-all" />
            <div className="relative border border-dashed border-white/10 rounded-xl p-3 hover:border-red-500/30 transition-all bg-white/[0.02]">
              <input required type="file" accept="image/*" onChange={(e) => onHandleReceiptChange(e, onSetVodaReceiptFile, onSetVodaReceiptBase64)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              {vodaReceiptBase64 ? (
                <div className="flex items-center gap-3">
                  <img src={vodaReceiptBase64} className="w-10 h-10 rounded-lg object-cover border border-white/10" alt="Receipt" />
                  <div className="flex-1 min-w-0"><p className="text-[11px] text-white font-bold truncate">{vodaReceiptFile?.name}</p><p className="text-[10px] text-emerald-400 font-black">جاهز ✓</p></div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onSetVodaReceiptFile(null); onSetVodaReceiptBase64(''); }}
                    className="p-1 bg-red-500/20 text-red-400 rounded-lg relative z-10"><X size={12} /></button>
                </div>
              ) : (
                <div className="text-center py-3"><Upload size={20} className="mx-auto text-gray-600 mb-1" /><p className="text-[11px] text-gray-500 font-bold">ارفع صورة الإيصال</p></div>
              )}
            </div>
            {error && <p className="text-red-400 text-xs font-bold">{error}</p>}
            <button type="submit" disabled={enrolling}
              className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl text-sm font-black shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {enrolling ? <Loader2 className="animate-spin" size={18} /> : 'إرسال الإيصال'}
            </button>
          </motion.form>
        ) :

        /* ── InstaPay ── */
        purchaseMethod === 'instapay' ? (
          <motion.form key="instapay" {...scaleIn} onSubmit={(e) => onHandleDirectPayment(e, 'instapay')} className="space-y-4">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => { onSetPurchaseMethod(null); onSetError(null); }}
                className="text-gray-400 hover:text-white p-2 bg-white/5 rounded-xl border border-white/10 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-base font-black text-white">InstaPay</h3>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-4 space-y-1.5">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">حول إلى العنوان</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-white tracking-wide font-mono select-all">{instapayAddress}</span>
                <button type="button" onClick={() => handleCopy(instapayAddress, 'insta')}
                  className="p-1.5 bg-white/5 rounded-lg border border-white/10 text-emerald-400 hover:bg-white/10 transition-all">
                  {copiedType === 'insta' ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 font-bold">
              حول <span className="text-emerald-400 font-black">{activePrice} ج.م</span> ثم ارفق الإيصال
            </p>
            <input required type="text" placeholder="اسم حسابك (مثال: name@instapay)" value={instaSender}
              onChange={(e) => onSetInstaSender(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-right text-white text-sm font-mono focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all" />
            <div className="relative border border-dashed border-white/10 rounded-xl p-3 hover:border-emerald-500/30 transition-all bg-white/[0.02]">
              <input required type="file" accept="image/*" onChange={(e) => onHandleReceiptChange(e, onSetInstaReceiptFile, onSetInstaReceiptBase64)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              {instaReceiptBase64 ? (
                <div className="flex items-center gap-3">
                  <img src={instaReceiptBase64} className="w-10 h-10 rounded-lg object-cover border border-white/10" alt="Receipt" />
                  <div className="flex-1 min-w-0"><p className="text-[11px] text-white font-bold truncate">{instaReceiptFile?.name}</p><p className="text-[10px] text-emerald-400 font-black">جاهز ✓</p></div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onSetInstaReceiptFile(null); onSetInstaReceiptBase64(''); }}
                    className="p-1 bg-red-500/20 text-red-400 rounded-lg relative z-10"><X size={12} /></button>
                </div>
              ) : (
                <div className="text-center py-3"><Upload size={20} className="mx-auto text-gray-600 mb-1" /><p className="text-[11px] text-gray-500 font-bold">ارفع صورة الإيصال</p></div>
              )}
            </div>
            {error && <p className="text-red-400 text-xs font-bold">{error}</p>}
            <button type="submit" disabled={enrolling}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl text-sm font-black shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {enrolling ? <Loader2 className="animate-spin" size={18} /> : 'إرسال الإيصال'}
            </button>
          </motion.form>
        ) :

        /* ── Checkout Panel (Default selection) ── */
        (
          <motion.div key="select" {...scaleIn} className="space-y-5 text-right">
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.15em] text-center">تفاصيل الاشتراك</p>
            
            {/* Price display with discount details */}
            <div className="text-center space-y-1.5">
              {appliedCoupon ? (
                <div className="flex flex-col items-center justify-center">
                  <span className="text-xs text-gray-500 line-through font-bold">
                    {course.price.toLocaleString('ar-EG')} ج.م
                  </span>
                  <div className="text-4xl sm:text-5xl font-black text-emerald-400 font-display tabular-nums">
                    {discountedPrice === 0 ? 'مجاني' : <>{discountedPrice?.toLocaleString('ar-EG')} <span className="text-lg text-emerald-500">ج.م</span></>}
                  </div>
                </div>
              ) : (
                <div className="text-4xl sm:text-5xl font-black text-white font-display tabular-nums">
                  {course.price === 0 ? (
                    <span className="text-emerald-400">مجاني</span>
                  ) : (
                    <>{course.price.toLocaleString('ar-EG')} <span className="text-lg text-gray-500">ج.م</span></>
                  )}
                </div>
              )}
            </div>

            {/* Applied Coupon Badge */}
            {appliedCoupon && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs font-black">
                <div className="flex items-center gap-2">
                  <Tag size={14} />
                  <span>تم تطبيق الكوبون: <span className="font-mono uppercase">{appliedCoupon.code}</span></span>
                </div>
                <button type="button" onClick={onRemoveCoupon} className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-400 hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="space-y-2.5">
              {/* Subscribe button (Wallet checkout / Free checkout) */}
              <button
                onClick={() => onHandleEnroll(undefined, appliedCoupon ? 'coupon' : 'wallet')}
                disabled={enrolling}
                className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white py-4 rounded-2xl text-base font-black shadow-lg shadow-brand-blue/25 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                {enrolling ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <Wallet size={16} />
                    {isFree ? 'ابدأ التعلم الآن مجاناً' : 'الشراء والاشتراك بالمحفظة'}
                  </>
                )}
              </button>

              {/* Show wallet balance if not free */}
              {!isFree && (
                <span className="text-[10px] text-gray-500 font-bold block text-center">
                  رصيدك الحالي: {walletBalance} ج.م
                </span>
              )}

              {/* Collapsible Coupon Input */}
              {!appliedCoupon && course.price > 0 && (
                <div className="pt-2">
                  {!showCouponInput ? (
                    <button
                      type="button"
                      onClick={() => setShowCouponInput(true)}
                      className="text-xs text-brand-blue hover:underline font-black block mx-auto transition-all"
                    >
                      هل لديك كوبون خصم؟
                    </button>
                  ) : (
                    <form onSubmit={onApplyCoupon} className="flex gap-2 transition-all">
                      <input
                        type="text"
                        required
                        placeholder="أدخل رمز الكوبون"
                        value={couponCode}
                        onChange={(e) => onSetCouponCode(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm font-bold text-white uppercase placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-blue"
                      />
                      <button
                        type="submit"
                        disabled={couponLoading}
                        className="bg-brand-blue/20 hover:bg-brand-blue text-brand-blue hover:text-white px-4 rounded-xl text-xs font-black transition-all disabled:opacity-50 flex items-center justify-center min-w-[60px]"
                      >
                        {couponLoading ? <Loader2 className="animate-spin" size={14} /> : 'تطبيق'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {error && (
                <p className="text-red-400 text-xs font-bold flex items-center justify-center gap-1.5 pt-1">
                  <AlertCircle size={14} />
                  {error}
                </p>
              )}

              {course.price > 0 && (
                <>
                  <div className="flex items-center gap-3 py-1.5">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] text-gray-600 font-bold">أو ادفع مباشرة</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  {/* Vodafone + InstaPay + Activation Code + WhatsApp */}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => onSetPurchaseMethod('vodafone')}
                      className="bg-red-600/8 hover:bg-red-600/15 text-red-400 py-3 rounded-xl text-[11px] font-black border border-red-600/10 transition-all flex flex-col items-center gap-1.5">
                      <Smartphone size={16} /> فودافون كاش
                    </button>
                    <button type="button" onClick={() => onSetPurchaseMethod('instapay')}
                      className="bg-emerald-600/8 hover:bg-emerald-600/15 text-emerald-400 py-3 rounded-xl text-[11px] font-black border border-emerald-600/10 transition-all flex flex-col items-center gap-1.5">
                      <CreditCard size={16} /> InstaPay
                    </button>
                    <button type="button" onClick={() => onSetPurchaseMethod('code')}
                      className="bg-amber-600/8 hover:bg-amber-600/15 text-amber-400 py-3 rounded-xl text-[11px] font-black border border-amber-600/10 transition-all flex flex-col items-center gap-1.5">
                      <Key size={16} /> كود التفعيل
                    </button>
                    <a href={course.whatsappLink || `https://wa.me/${whatsappNumber?.replace(/\+/g, '') || ''}?text=${encodeURIComponent(`مرحباً، أريد شراء كورس: ${course.title}`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="bg-[#25D366]/8 hover:bg-[#25D366]/15 text-[#25D366] py-3 rounded-xl text-[11px] font-black border border-[#25D366]/10 transition-all flex flex-col items-center gap-1.5">
                      <MessageCircle size={16} /> واتساب
                    </a>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-center gap-5 pt-3 border-t border-white/5">
              <span className="text-[10px] text-gray-600 font-bold flex items-center gap-1"><ShieldCheck size={11} className="text-emerald-500" /> محتوى معتمد</span>
              <span className="text-[10px] text-gray-600 font-bold flex items-center gap-1"><Award size={11} className="text-brand-yellow" /> شهادة إتمام</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
