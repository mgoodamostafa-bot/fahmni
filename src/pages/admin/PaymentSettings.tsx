import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Save, CheckCircle, Smartphone } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSettings } from '../../contexts/SettingsContext';

export const PaymentSettings: React.FC = () => {
  const [vodafoneCashNumber, setVodafoneCashNumber] = useState('');
  const [instapayAddress, setInstapayAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { updateSettings } = useSettings();

  useEffect(() => {
    const fetchPaymentSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'platform_config', 'settings'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.vodafoneCashNumber) {
            setVodafoneCashNumber(data.vodafoneCashNumber);
          }
          if (data.instapayAddress) {
            setInstapayAddress(data.instapayAddress);
          }
        }
      } catch (error) {
        console.error('Error fetching payment settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPaymentSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      // Get existing settings to merge
      const configRef = doc(db, 'platform_config', 'settings');
      const docSnap = await getDoc(configRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};

      await setDoc(configRef, {
        ...existingData,
        vodafoneCashNumber,
        instapayAddress,
      });

      // Also update social_links just in case it's mapped there in older setups
      const socialRef = doc(db, 'settings', 'social_links');
      const socialSnap = await getDoc(socialRef);
      const existingSocial = socialSnap.exists() ? socialSnap.data() : {};
      await setDoc(socialRef, {
        ...existingSocial,
        vodafoneCashNumber,
        instapayAddress,
      });

      updateSettings({ vodafoneCashNumber, instapayAddress });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving payment settings:', error);
      alert('حدث خطأ أثناء الحفظ.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 text-right pb-24" dir="rtl">
      <div className="flex items-center gap-3 px-4">
        <CreditCard className="w-10 h-10 text-brand-blue" />
        <h1 className="text-4xl font-black text-white font-display">بوابات الدفع الإلكترونية</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 space-y-8"
      >
        <div className="space-y-6">
          <h3 className="text-xl font-black text-white flex items-center gap-3 border-b border-white/5 pb-4">
            <Smartphone size={22} className="text-red-500" />
            إعدادات فودافون كاش
          </h3>

          <div className="space-y-2">
            <label className="block text-gray-400 font-bold text-sm mb-2">
              رقم محفظة فودافون كاش
            </label>
            <div className="relative group max-w-md">
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 group-focus-within:scale-110 transition-transform">
                <div className="w-5 h-5 flex items-center justify-center">
                  <span className="font-bold text-lg">●</span>
                </div>
              </div>
              <input
                type="text"
                value={vodafoneCashNumber}
                onChange={(e) => setVodafoneCashNumber(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all placeholder:text-gray-600"
                placeholder="مثال: 01012345678"
                dir="ltr"
                style={{ textAlign: 'right' }}
              />
            </div>
            <p className="text-xs text-gray-500 font-bold mt-2">
              سيظهر هذا الرقم للطلاب في صفحة المحفظة عند اختيارهم الشحن عبر "فودافون كاش".
            </p>
          </div>

          <h3 className="text-xl font-black text-white flex items-center gap-3 border-b border-white/5 pb-4 pt-6">
            <CreditCard size={22} className="text-pink-500" />
            إعدادات انستا باي (InstaPay)
          </h3>

          <div className="space-y-2">
            <label className="block text-gray-400 font-bold text-sm mb-2">
              عنوان انستا باي (InstaPay Address / IPN)
            </label>
            <div className="relative group max-w-md">
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-pink-500 group-focus-within:scale-110 transition-transform">
                <CreditCard size={20} />
              </div>
              <input
                type="text"
                value={instapayAddress}
                onChange={(e) => setInstapayAddress(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500/50 transition-all placeholder:text-gray-600"
                placeholder="مثال: name@instapay"
                dir="ltr"
                style={{ textAlign: 'right' }}
              />
            </div>
            <p className="text-xs text-gray-500 font-bold mt-2">
              سيظهر هذا العنوان للطلاب في صفحة المحفظة عند اختيارهم الشحن عبر "انستا باي".
            </p>
          </div>
        </div>

        <div className="pt-8 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-brand-blue hover:bg-brand-600 text-white px-8 py-3 rounded-xl font-black transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>

          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-emerald-500 font-bold"
            >
              <CheckCircle size={20} />
              <span>تم الحفظ بنجاح</span>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
