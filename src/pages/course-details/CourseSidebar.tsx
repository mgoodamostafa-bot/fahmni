import React from 'react';
import { motion } from 'framer-motion';
import {
  Award, ShieldCheck, MessageCircle, TrendingUp
} from 'lucide-react';
import { SocialLinks } from '../../components/SocialLinks';

// ─── Types ──────────────────────────────────────────────────────
interface TeacherProfile {
  name: string;
  title: string;
  photoUrl: string;
  whatsapp: string;
  facebook: string;
  telegram: string;
  youtube: string;
  instagram: string;
  tiktok: string;
}

interface CourseSidebarProps {
  teacherProfile: TeacherProfile;
  courseDescription: string;
}

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4 }
};

export const CourseSidebar: React.FC<CourseSidebarProps> = ({
  teacherProfile, courseDescription
}) => {
  return (
    <div className="lg:col-span-4 space-y-6">
      {/* About Course (mobile shows here in sidebar area) */}
      <motion.section {...fadeIn} className="space-y-5 lg:hidden">
        <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-3 text-white">
          <div className="w-1.5 h-8 bg-brand-blue rounded-full" />
          عن الكورس
        </h2>
        <div className="bg-white/[0.02] p-6 sm:p-8 leading-[2] text-gray-300 font-bold text-base sm:text-lg border border-white/5 rounded-2xl sm:rounded-3xl whitespace-pre-wrap">
          {courseDescription}
        </div>
      </motion.section>

      <motion.div {...fadeIn} className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 sm:p-8 space-y-8 sticky top-28 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-brand-blue via-purple-500 to-brand-blue" />

        {/* Why this course */}
        <div className="space-y-3">
          <h3 className="text-xl font-black text-white">لماذا هذا الكورس؟</h3>
          <p className="text-gray-500 font-bold text-xs leading-relaxed">استعد للتميز مع هذه الخطة الدراسية المتكاملة</p>
        </div>
        <ul className="space-y-4">
          {[
            { icon: <Award size={18} className="text-brand-yellow" />, text: 'إتقان المادة بنسبة 100%' },
            { icon: <ShieldCheck size={18} className="text-emerald-500" />, text: 'حل نماذج الامتحانات بدقة' },
            { icon: <MessageCircle size={18} className="text-brand-blue" />, text: 'دعم فني وتواصل مباشر' },
            { icon: <TrendingUp size={18} className="text-purple-500" />, text: 'تتبع تقدمك وأدائك' },
          ].map((item, i) => (
            <li key={i} className="flex gap-3 items-center font-bold text-gray-300 text-sm">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5">{item.icon}</div>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>

        {/* Teacher Card */}
        <div className="pt-6 border-t border-white/5">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 group transition-all hover:bg-white/[0.05] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-brand-blue/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-4 relative z-10">
              {/* Photo */}
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-white/10 border border-white/5 flex items-center justify-center bg-brand-blue/10">
                  {teacherProfile.photoUrl ? (
                    <img src={teacherProfile.photoUrl} alt={teacherProfile.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-2xl font-black text-brand-blue select-none">{teacherProfile.name.charAt(0)}</span>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -left-0.5 bg-emerald-500 text-white p-1 rounded-md border-2 border-[#111]">
                  <ShieldCheck size={10} />
                </div>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center justify-end gap-1.5 mb-0.5">
                  <span className="text-[9px] text-emerald-400 font-black uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/15">Verified</span>
                </div>
                <p className="text-lg font-black text-white truncate leading-tight">{teacherProfile.name}</p>
                <p className="text-[11px] text-gray-500 font-bold">{teacherProfile.title}</p>
              </div>
            </div>
            {/* Social Links */}
            <div className="mt-4">
              <SocialLinks
                links={{
                  whatsapp: teacherProfile.whatsapp,
                  facebook: teacherProfile.facebook,
                  telegram: teacherProfile.telegram,
                  youtube: teacherProfile.youtube,
                  instagram: teacherProfile.instagram,
                  tiktok: teacherProfile.tiktok
                }}
                className="gap-2"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
