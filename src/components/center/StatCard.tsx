import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  colorClass?: string; // e.g., 'text-amber-500 bg-amber-500/10 border-amber-500/20'
  glowColor?: string; // e.g., 'rgba(245, 158, 11, 0.05)'
  children?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  colorClass = 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  glowColor = 'rgba(245, 158, 11, 0.05)',
  children,
}) => {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all duration-300">
      {/* Glow effect */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none transition-transform duration-500 group-hover:scale-125"
        style={{ backgroundColor: glowColor }}
      />

      <div className="space-y-4 relative z-10">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg ${colorClass}`}>
          <Icon size={22} />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">{title}</span>
          <span className="text-3xl font-black text-white block mt-1 tracking-tight">{value}</span>
        </div>
      </div>

      {children && (
        <div className="mt-4 pt-4 border-t border-white/5 relative z-10">
          {children}
        </div>
      )}
    </div>
  );
};
