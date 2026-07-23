import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  onConfirm,
  onCancel,
  type = 'warning',
}) => {
  const accentColor =
    type === 'danger'
      ? 'from-red-500 to-orange-600 text-white'
      : type === 'warning'
      ? 'from-amber-500 to-orange-500 text-slate-950'
      : 'from-blue-500 to-teal-500 text-white';

  const iconColor =
    type === 'danger' ? 'text-red-500' : type === 'warning' ? 'text-amber-500' : 'text-blue-500';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-[#04060d]/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md bg-[#0a0f1d] border border-white/10 rounded-3xl p-6 relative shadow-2xl z-10 text-right overflow-hidden"
            dir="rtl"
          >
            {/* Header / Close */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className={iconColor} size={20} />
                <h3 className="text-sm font-black text-white">{title}</h3>
              </div>
              <button
                onClick={onCancel}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Message */}
            <p className="text-xs text-gray-400 font-bold leading-relaxed mb-6">
              {message}
            </p>

            {/* Buttons */}
            <div className="flex gap-3 justify-end">
              {cancelText && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  {cancelText}
                </button>
              )}
              <button
                onClick={onConfirm}
                className={`px-5 py-2 rounded-xl bg-gradient-to-r ${accentColor} hover:opacity-90 font-black text-xs transition-all shadow-md cursor-pointer`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
