import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, ChevronRight, ChevronLeft, Phone, X, CheckCircle } from 'lucide-react';

interface SlotData {
  dayName: string;
  dateStr: string;
  slots: string[];
}

const SCHEDULE_DATA: SlotData[] = [
  { dayName: 'السبت', dateStr: '٢٠ يونيو', slots: ['٠٢:٠٠ م', '٠٤:٠٠ م', '٠٦:٠٠ م', '٠٨:٠٠ م'] },
  { dayName: 'الأحد', dateStr: '٢١ يونيو', slots: ['١٠:٠٠ ص', '٠١:٠٠ م', '٠٥:٠٠ م', '٠٧:٠٠ م'] },
  { dayName: 'الإثنين', dateStr: '٢٢ يونيو', slots: ['٠٣:٠٠ م', '٠٦:٠٠ م', '٠٩:٠٠ م'] },
  { dayName: 'الثلاثاء', dateStr: '٢٣ يونيو', slots: ['١١:٠٠ ص', '٠٤:٠٠ م', '٠٨:٠٠ م'] },
  { dayName: 'الأربعاء', dateStr: '٢٤ يونيو', slots: ['٠١:٠٠ م', '٠٥:٠٠ م', '٠٨:٠٠ م'] },
  { dayName: 'الخميس', dateStr: '٢٥ يونيو', slots: ['٠٢:٠٠ م', '٠٦:٠٠ م', '١٠:٠٠ م'] },
  { dayName: 'الجمعة', dateStr: '٢٦ يونيو', slots: ['٠٤:٠٠ م', '٠٧:٠٠ م', '٠٩:٠٠ م'] },
];

interface BookingCarouselProps {
  teacherId?: string;
  teacherName?: string;
  onConfirmBooking?: (day: string, slot: string) => void;
}

export const BookingCarousel: React.FC<BookingCarouselProps> = ({
  teacherId = 't1',
  teacherName = 'الأستاذ أحمد عبد المنعم',
  onConfirmBooking,
}) => {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [bookingStep, setBookingStep] = useState<'confirm' | 'success'>('confirm');
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');

  const currentDay = SCHEDULE_DATA[selectedDayIdx];

  const handleSlotClick = (slot: string) => {
    setActiveSlot(slot);
    setBookingStep('confirm');
    setShowModal(true);
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !studentPhone) return;

    // Simulate WhatsApp redirect / booking submission
    setBookingStep('success');

    // Trigger callback
    onConfirmBooking?.(currentDay.dayName, activeSlot || '');
  };

  const handleWhatsAppRedirect = () => {
    const text = encodeURIComponent(
      `أهلاً بك، أود حجز موعد حصة تجريبية:\n\n` +
      `- المعلم: ${teacherName}\n` +
      `- اليوم: ${currentDay.dayName} (${currentDay.dateStr})\n` +
      `- التوقيت: ${activeSlot}\n` +
      `- الطالب: ${studentName}\n` +
      `- الهاتف: ${studentPhone}\n\n` +
      `أرجو تأكيد الحجز وجدول الحصص.`
    );
    window.open(`https://wa.me/201234567890?text=${text}`, '_blank');
    setShowModal(false);
  };

  return (
    <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 sm:p-8 space-y-6" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <Calendar className="text-brand-400" size={20} />
            <span>جدول المواعيد المتاحة</span>
          </h3>
          <p className="text-xs text-slate-400 font-medium">
            اختر اليوم المناسب لك ثم حدد ساعة الدرس لحجز حصتك مع <span className="text-brand-300 font-bold">{teacherName}</span>
          </p>
        </div>
        
        {/* Helper info */}
        <div className="flex items-center gap-2 self-start sm:self-center bg-brand-500/10 border border-brand-500/20 px-4 py-2 rounded-xl">
          <Clock size={14} className="text-brand-400" />
          <span className="text-xs text-brand-300 font-black">جميع الأوقات بتوقيت القاهرة (GMT+3)</span>
        </div>
      </div>

      {/* 📅 Days Horizontal Carousel */}
      <div className="relative w-full overflow-hidden">
        {/* Navigation arrows (desktop visual guides) */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {SCHEDULE_DATA.map((day, idx) => {
            const isSelected = selectedDayIdx === idx;
            return (
              <motion.button
                key={day.dayName}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedDayIdx(idx);
                  setActiveSlot(null); // Reset active slot on day switch
                }}
                className={`flex-shrink-0 w-28 sm:w-32 p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-brand-600/20 border-brand-500 shadow-[0_0_15px_rgba(59,130,246,0.25)] text-white'
                    : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-slate-400'
                }`}
              >
                <span className="block text-sm font-black">{day.dayName}</span>
                <span className="block text-[10px] opacity-75 font-semibold mt-1">{day.dateStr}</span>
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full mt-2 ${
                  isSelected ? 'bg-brand-500 text-white' : 'bg-white/10 text-slate-300'
                }`}>
                  {day.slots.length} مواعيد
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ⏰ Slots Selection Section */}
      <div className="space-y-4">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">الساعات المتاحة ليوم {currentDay.dayName}</h4>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {currentDay.slots.map((slot) => {
            const isSlotActive = activeSlot === slot;
            return (
              <motion.button
                key={slot}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSlotClick(slot)}
                className={`py-3.5 px-4 rounded-xl border text-center text-sm font-black transition-all cursor-pointer ${
                  isSlotActive
                    ? 'bg-brand-500 border-brand-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.05] text-slate-300'
                }`}
              >
                {slot}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 🎟️ Beautiful Interactive Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              onClick={() => setShowModal(false)}
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-[2rem] shadow-2xl text-right overflow-hidden"
            >
              
              {/* Top Close */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>

              {bookingStep === 'confirm' ? (
                // 📝 Step 1: Confirmation Form
                <form onSubmit={handleConfirm} className="space-y-6 pt-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-black text-white">تأكيد حجز الحصة التجريبية</h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                      لقد قمت باختيار موعد مع <span className="text-brand-300 font-bold">{teacherName}</span> يوم <span className="text-white font-bold">{currentDay.dayName} ({currentDay.dateStr})</span> في تمام الساعة <span className="text-brand-400 font-bold">{activeSlot}</span>.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400">اسم الطالب</label>
                      <input
                        type="text"
                        required
                        placeholder="أدخل اسمك الكامل"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-black text-slate-400">رقم الهاتف (WhatsApp)</label>
                      <input
                        type="tel"
                        required
                        placeholder="مثال: 01012345678"
                        value={studentPhone}
                        onChange={(e) => setStudentPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-brand-600 hover:bg-brand-500 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>تأكيد الموعد وإرسال الطلب</span>
                  </button>
                </form>
              ) : (
                // 🎉 Step 2: Success Redirection
                <div className="text-center space-y-6 py-6 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center shadow-lg shadow-green-500/10">
                    <CheckCircle size={36} />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white">تم تسجيل طلب الحجز بنجاح!</h3>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                      الموعد محجوز مؤقتاً باسم <span className="text-white font-bold">{studentName}</span>. يرجى توجيه الطلب عبر WhatsApp لتأكيد الدفع والجدول الزمني.
                    </p>
                  </div>

                  <button
                    onClick={handleWhatsAppRedirect}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Phone size={16} />
                    <span>متابعة وتأكيد عبر WhatsApp</span>
                  </button>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
