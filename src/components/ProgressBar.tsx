import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  className?: string;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  className = '',
  color = 'bg-brand-blue',
}) => {
  return (
    <div
      className={`w-full bg-white/5 rounded-full h-2.5 overflow-hidden border border-white/10 ${className}`}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className={`${color} h-full rounded-full shadow-lg shadow-blue-500/20`}
      />
    </div>
  );
};
