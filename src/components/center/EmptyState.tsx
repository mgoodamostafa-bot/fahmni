import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  accentColor?: string; // e.g. 'amber-500', 'emerald-500'
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  accentColor = 'amber-500',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white/[0.01] border border-white/5 rounded-3xl backdrop-blur-md shadow-xl my-6">
      <div className={`w-16 h-16 bg-${accentColor}/10 text-${accentColor} rounded-full flex items-center justify-center border border-${accentColor}/20 mb-4 animate-pulse`}>
        <Icon size={28} />
      </div>
      <h3 className="text-sm sm:text-base font-black text-white mb-1.5">{title}</h3>
      <p className="text-xs text-gray-400 font-bold max-w-sm leading-relaxed mb-6">
        {description}
      </p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className={`px-5 py-2.5 rounded-xl bg-gradient-to-r from-${accentColor} to-white/10 text-slate-950 font-black text-xs hover:opacity-90 shadow-md transition-all cursor-pointer`}
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
