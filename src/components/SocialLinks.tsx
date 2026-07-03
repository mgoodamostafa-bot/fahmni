import React from 'react';
import { Facebook, Youtube, Instagram, MessageCircle, Send, Globe } from 'lucide-react';

interface SocialLinksProps {
  links: {
    whatsapp?: string;
    facebook?: string;
    telegram?: string;
    youtube?: string;
    instagram?: string;
    tiktok?: string;
  };
  variant?: 'footer' | 'sidebar' | 'profile';
  className?: string;
}

export const SocialLinks: React.FC<SocialLinksProps> = ({
  links,
  variant = 'footer',
  className = '',
}) => {
  const socialConfig = [
    {
      key: 'whatsapp',
      icon: MessageCircle,
      color: 'text-[#25D366] hover:bg-[#25D366]/10',
      label: 'واتساب',
      href: (val: string) =>
        val.startsWith('http') ? val : `https://wa.me/${val.replace(/\+/g, '')}`,
    },
    {
      key: 'facebook',
      icon: Facebook,
      color: 'text-[#1877F2] hover:bg-[#1877F2]/10',
      label: 'فيسبوك',
      href: (val: string) => val,
    },
    {
      key: 'telegram',
      icon: Send,
      color: 'text-[#26A5E4] hover:bg-[#26A5E4]/10',
      label: 'تليجرام',
      href: (val: string) => val,
    },
    {
      key: 'youtube',
      icon: Youtube,
      color: 'text-[#FF0000] hover:bg-[#FF0000]/10',
      label: 'يوتيوب',
      href: (val: string) => val,
    },
    {
      key: 'instagram',
      icon: Instagram,
      color: 'text-[#E4405F] hover:bg-[#E4405F]/10',
      label: 'انستجرام',
      href: (val: string) => val,
    },
    {
      key: 'tiktok',
      icon: Globe, // TikTok doesn't have a direct Lucide icon, using Globe for now or we could use SVG
      color: 'text-[#000000] dark:text-white hover:bg-slate-900/10 dark:hover:bg-white/10',
      label: 'تيك توك',
      href: (val: string) => val,
    },
  ];

  const activeLinks = socialConfig.filter((s) => !!(links as any)[s.key]);

  if (activeLinks.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`} dir="rtl">
      {activeLinks.map((social) => {
        const Icon = social.icon;
        const value = (links as any)[social.key];
        const href = social.href(value);

        return (
          <a
            key={social.key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={social.label}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 text-xs font-black
              ${variant === 'profile' ? 'bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 shadow-sm' : 'bg-white/5 border border-white/5'}
              ${social.color}
            `}
          >
            {/* Swapping Icon for Text Label as requested - The icon is now secondary or omitted */}
            <span>{social.label}</span>
            <Icon size={14} strokeWidth={2.5} className="opacity-50" />
          </a>
        );
      })}
    </div>
  );
};
