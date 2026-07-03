import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Mail, Phone, Globe, Shield, ArrowRight } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { SocialLinks } from '../components/SocialLinks';
import { Link } from 'react-router-dom';

export const Contact: React.FC = () => {
  const { settings } = useSettings();

  const contactMethods = [
    {
      icon: <MessageCircle className="text-[#25D366]" size={28} />,
      title: 'واتساب',
      description: 'تواصل معنا مباشرة عبر الواتساب للرد السريع.',
      link: settings.whatsapp || '#',
      label: 'فتح المحادثة',
    },
    {
      icon: <Phone className="text-brand-yellow" size={28} />,
      title: 'الدعم الهاتفي',
      description: 'متاحون للرد على استفساراتكم الهاتفية.',
      link: `tel:${settings.supportPhone}`,
      label: settings.supportPhone || 'غير متوفر حالياً',
    },
    {
      icon: <Mail className="text-brand-blue" size={28} />,
      title: 'البريد الإلكتروني',
      description: 'أرسل لنا استفسارك وسنقوم بالرد خلال 24 ساعة.',
      link: `mailto:support@fahmni.me`,
      label: 'support@fahmni.me',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-main)] py-12 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-blue/10 text-brand-blue border border-brand-blue/20 mb-4"
          >
            <Shield size={16} />
            <span className="text-xs font-black uppercase tracking-widest">
              مركز المساعدة والدعم
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-white font-display leading-tight"
          >
            نحن هنا <span className="text-brand-blue">لمساعدتك</span> دائماً
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 font-bold max-w-2xl mx-auto"
          >
            سواء كنت طالباً تبحث عن مساعدة في كورس، أو تريد الاستفسار عن طرق الدفع، فريق "فهمني"
            متاح لخدمتك عبر كافة القنوات الرسمية.
          </motion.p>
        </div>

        {/* Contact Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {contactMethods.map((method, idx) => (
            <motion.a
              key={method.title}
              href={method.link}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className="glass-card p-8 group hover:border-brand-blue/50 transition-all flex flex-col items-center text-center space-y-4"
            >
              <div className="p-4 rounded-2xl bg-white/5 group-hover:scale-110 transition-transform">
                {method.icon}
              </div>
              <h3 className="text-xl font-black text-white">{method.title}</h3>
              <p className="text-xs text-gray-500 font-bold leading-relaxed">
                {method.description}
              </p>
              <div className="pt-2 text-brand-blue font-black text-sm flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {method.label}
                <ArrowRight size={14} className="rotate-180" />
              </div>
            </motion.a>
          ))}
        </div>

        {/* Social Media Hub */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card p-10 text-center space-y-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-1/2 translate-x-1/2 w-64 h-64 bg-brand-blue/5 blur-[100px] rounded-full pointer-events-none" />

          <div className="space-y-4 relative z-10">
            <h2 className="text-2xl font-black text-white flex items-center justify-center gap-3">
              <Globe className="text-brand-blue" />
              قنواتنا الرسمية على السوشيال ميديا
            </h2>
            <p className="text-sm text-gray-500 font-bold">
              تابعنا لتصلك أحدث الكورسات، المراجعات النهائية، والعروض الحصرية لمنصة فهمني.
            </p>
          </div>

          <div className="flex justify-center flex-wrap gap-4 relative z-10">
            <SocialLinks links={settings} variant="profile" />
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-center gap-8 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-gray-400 capitalize">
                نحن متاحون الآن للرد
              </span>
            </div>
            <Link to="/" className="text-xs font-black text-brand-blue hover:underline">
              العودة للرئيسية
            </Link>
          </div>
        </motion.div>

        {/* Footer Note */}
        <div className="text-center">
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em]">
            © {new Date().getFullYear()} Fahmni LMS - Premium Support Experience
          </p>
        </div>
      </div>
    </div>
  );
};
