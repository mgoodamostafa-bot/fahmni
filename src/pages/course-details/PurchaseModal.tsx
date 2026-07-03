import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Loader2 } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────
interface PurchaseModalProps {
  show: boolean;
  courseTitle: string;
  coursePrice: number;
  walletBalance: number;
  enrolling: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }
};

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  show, courseTitle, coursePrice, walletBalance, enrolling, onConfirm, onClose
}) => {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" dir="rtl">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-950/80 backdrop-blur-md"
          />
          <motion.div
            {...scaleIn}
            className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-[2rem] p-8 sm:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/10 blur-[64px] rounded-full -mr-16 -mt-16 pointer-events-none" />
            <div className="relative z-10 text-center space-y-6">
              <div className="w-16 h-16 bg-brand-blue/10 rounded-2xl flex items-center justify-center text-brand-blue mx-auto">
                <Wallet size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white mb-2">تأكيد الشراء</h3>
                <p className="text-gray-400 font-bold text-sm">
                  شراء كورس <span className="text-white">"{courseTitle}"</span>؟
                </p>
              </div>
              <div className="bg-white/5 rounded-2xl p-5 space-y-3 border border-white/5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold">سعر الكورس:</span>
                  <span className="text-white font-black">{coursePrice.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold">رصيدك:</span>
                  <span className="text-brand-blue font-black">{walletBalance.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-bold">بعد الشراء:</span>
                  <span className="text-emerald-400 font-black">{(walletBalance - coursePrice).toLocaleString('ar-EG')} ج.م</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={onConfirm}
                  className="bg-brand-blue hover:bg-brand-blue/90 text-white py-4 rounded-xl font-black shadow-lg shadow-brand-blue/20 transition-all transform active:scale-[0.97]">
                  {enrolling ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'تأكيد'}
                </button>
                <button onClick={onClose}
                  className="bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-black border border-white/10 transition-all">
                  إلغاء
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
