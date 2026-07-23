import React, { useState } from 'react';
import { MessageSquare, BellRing, Check, Send, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

interface WhatsAppSettingsProps {
  studentName: string;
  studentId: string;
  parentPhone: string;
}

export const WhatsAppSettings: React.FC<WhatsAppSettingsProps> = ({
  studentName,
  studentId,
  parentPhone,
}) => {
  const [customMsg, setCustomMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; msg: string } | null>(null);

  // Storage key for auto notification settings
  const getAutoNotifyState = () => {
    return localStorage.getItem(`wa_auto_notify_${studentId}`) === 'true';
  };
  
  const [autoNotify, setAutoNotify] = useState(getAutoNotifyState());

  const handleToggleAuto = () => {
    const newState = !autoNotify;
    setAutoNotify(newState);
    localStorage.setItem(`wa_auto_notify_${studentId}`, String(newState));
  };

  const cleanPhone = (phone: string) => {
    let p = phone.replace(/[\s\-\(\)\+]/g, '');
    if (p.startsWith('0')) p = p.substring(1);
    if (!p.startsWith('2')) p = '20' + p; // Egyptian default prefix if starting with e.g. 10...
    return p;
  };

  const handleSendCustomMessage = async () => {
    if (!customMsg.trim()) return;
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch('/api/whatsapp/send-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          message: customMsg,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setStatus({ success: true, msg: 'تم إرسال رسالة الواتساب بنجاح لولي الأمر' });
        setCustomMsg('');
      } else {
        // Fallback to wa.me link
        const cleaned = cleanPhone(parentPhone);
        const waLink = `https://wa.me/${cleaned}?text=${encodeURIComponent(
          `💬 *رسالة من المعلم*\n\n👤 بخصوص الطالب: ${studentName}\n\n${customMsg}`
        )}`;
        window.open(waLink, '_blank');
        setStatus({
          success: true,
          msg: 'تم فتح رابط الواتساب المباشر لعدم توفر خادم السيرفر التلقائي',
        });
      }
    } catch (err) {
      // Fallback
      const cleaned = cleanPhone(parentPhone);
      const waLink = `https://wa.me/${cleaned}?text=${encodeURIComponent(
        `💬 *رسالة من المعلم*\n\n👤 بخصوص الطالب: ${studentName}\n\n${customMsg}`
      )}`;
      window.open(waLink, '_blank');
      setStatus({
        success: true,
        msg: 'تم فتح رابط الواتساب المباشر لعدم توفر خادم السيرفر التلقائي',
      });
    } finally {
      setLoading(false);
    }
  };

  const useTemplate = (tpl: string) => {
    let text = '';
    if (tpl === 'absent') {
      text = `نحيطكم علماً بغياب الطالب ${studentName} اليوم عن الحصة دون عذر مسبق. يرجى المتابعة لضمان عدم تأخره الدراسي.`;
    } else if (tpl === 'late') {
      text = `نحيطكم علماً بتأخر الطالب ${studentName} اليوم عن الحصة. يرجى التنبيه عليه بالالتزام بموعد الحضور.`;
    } else if (tpl === 'excellent') {
      text = `يسعدنا إعلامكم بمشاركة الطالب ${studentName} الممتازة اليوم في الحصة وتفاعله الإيجابي وأدائه المتميز.`;
    }
    setCustomMsg(text);
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-white flex items-center gap-3">
          <MessageSquare className="text-emerald-500" size={20} />
          <span>إشعارات وتواصل الواتساب (WhatsApp)</span>
        </h3>
        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold">
          مفعل
        </span>
      </div>

      {/* Auto Notify Toggle */}
      <div className="flex items-center justify-between p-4 bg-white/2 border border-white/5 rounded-2xl">
        <div className="space-y-1">
          <h4 className="font-extrabold text-sm text-white">إرسال تلقائي للتقارير</h4>
          <p className="text-[10px] text-gray-500 font-bold">إرسال نتيجة أي امتحان وحضور تلقائياً فور تسجيله</p>
        </div>
        <button
          onClick={handleToggleAuto}
          className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${
            autoNotify ? 'bg-emerald-600' : 'bg-white/10'
          } relative cursor-pointer`}
        >
          <div
            className={`w-4 h-4 bg-white rounded-full transition-all duration-300 absolute top-1 ${
              autoNotify ? 'left-1' : 'right-1'
            }`}
          />
        </button>
      </div>

      {/* Templates Selector */}
      <div className="space-y-3">
        <p className="text-[10px] text-gray-500 font-bold">قوالب إرسال سريعة بنقرة واحدة:</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => useTemplate('absent')}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-bold rounded-xl transition-all cursor-pointer"
          >
            🚨 إنذار غياب الطالب
          </button>
          <button
            onClick={() => useTemplate('late')}
            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-[10px] font-bold rounded-xl transition-all cursor-pointer"
          >
            ⚠️ إنذار تأخر اليوم
          </button>
          <button
            onClick={() => useTemplate('excellent')}
            className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-xl transition-all cursor-pointer"
          >
            ⭐ تفوق وتميز الحصة
          </button>
        </div>
      </div>

      {/* Text Area */}
      <div className="space-y-3">
        <textarea
          placeholder="اكتب رسالة مخصصة لولي الأمر هنا..."
          rows={3}
          value={customMsg}
          onChange={(e) => setCustomMsg(e.target.value)}
          className="w-full p-4 bg-white/5 border border-white/5 rounded-2xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600/50 focus:bg-white/10 transition-all text-right resize-none"
          dir="rtl"
        />
        
        <div className="flex justify-between items-center gap-4">
          <button
            disabled={loading || !customMsg.trim()}
            onClick={handleSendCustomMessage}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-lg cursor-pointer"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال الرسالة'}
            <Send size={12} />
          </button>
          <span className="text-[10px] text-gray-500 font-bold">
            هاتف ولي الأمر: {parentPhone || 'غير مسجل'}
          </span>
        </div>
      </div>

      {status && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
          status.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          <Check size={14} />
          <span>{status.msg}</span>
        </div>
      )}
    </div>
  );
};
