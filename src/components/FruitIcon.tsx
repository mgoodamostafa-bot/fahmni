// ═══════════════════════════════════════════════════════════════
// 🍊 FruitIcon — Animated fruit emoji component
// Reads the active fruit from SettingsContext automatically
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import { motion } from 'framer-motion';
import { FRUIT_THEMES, DEFAULT_FRUIT } from '../constants/fruitThemes';
import type { FruitId } from '../constants/fruitThemes';
import { useSettings } from '../contexts/SettingsContext';

interface FruitIconProps {
  /** Override fruit (otherwise reads from settings) */
  fruit?: FruitId;
  /** Size preset */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Enable animation */
  animate?: boolean;
  /** Show glow behind fruit */
  withGlow?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const SIZE_MAP = {
  xs: 16,
  sm: 24,
  md: 40,
  lg: 64,
  xl: 96,
};

const ANIMATION_VARIANTS = {
  bounce: {
    animate: {
      y: [0, -12, 0],
      scale: [1, 1.08, 1],
    },
    transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
  },
  spin: {
    animate: {
      rotate: [0, 360],
    },
    transition: { duration: 6, repeat: Infinity, ease: 'linear' },
  },
  wiggle: {
    animate: {
      rotate: [0, 8, -8, 6, -6, 0],
    },
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  },
  float: {
    animate: {
      y: [0, -8, 0, 4, 0],
      rotate: [0, 3, 0, -2, 0],
    },
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
  pulse: {
    animate: {
      scale: [1, 1.12, 1],
      filter: ['brightness(1)', 'brightness(1.2)', 'brightness(1)'],
    },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
  squeeze: {
    animate: {
      scaleX: [1, 1.12, 0.92, 1],
      scaleY: [1, 0.88, 1.08, 1],
    },
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
  },
};

const FruitIconInner: React.FC<FruitIconProps> = ({
  fruit,
  size = 'md',
  animate = true,
  withGlow = false,
  className = '',
}) => {
  const { settings } = useSettings();
  const activeFruit: FruitId = fruit || (settings as any).fruitTheme || DEFAULT_FRUIT;

  const theme = FRUIT_THEMES[activeFruit] || FRUIT_THEMES[DEFAULT_FRUIT];
  const px = SIZE_MAP[size];
  const anim = animate ? ANIMATION_VARIANTS[theme.animation] : {};

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
    >
      {/* Glow effect */}
      {withGlow && (
        <div
          className="absolute inset-0 rounded-full blur-xl animate-pulse"
          style={{ background: theme.colors.glow, transform: 'scale(1.8)' }}
        />
      )}

      {/* Fruit emoji */}
      <motion.span
        {...anim}
        className="relative z-10 select-none leading-none"
        style={{ fontSize: px * 0.85 }}
        role="img"
        aria-label={theme.nameAr}
      >
        {theme.emoji}
      </motion.span>
    </div>
  );
};

export const FruitIcon = React.memo(FruitIconInner);
