// ═══════════════════════════════════════════════════════════════
// 🍊 FruitParticles — Floating fruit emojis in the background
// Used in Welcome page, Loading screens, celebrations
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FRUIT_THEMES, DEFAULT_FRUIT } from '../constants/fruitThemes';
import type { FruitId } from '../constants/fruitThemes';
import { useSettings } from '../contexts/SettingsContext';

interface FruitParticlesProps {
  /** Override fruit (otherwise reads from settings) */
  fruit?: FruitId;
  /** Number of particles */
  count?: number;
  /** Opacity of particles (0-1) */
  opacity?: number;
  /** Additional CSS classes */
  className?: string;
}

interface Particle {
  id: number;
  x: number; // start X position (%)
  y: number; // start Y position (%)
  size: number; // font size (px)
  duration: number; // animation duration (s)
  delay: number; // animation delay (s)
  rotateEnd: number;
}

export const FruitParticles: React.FC<FruitParticlesProps> = ({
  fruit,
  count = 6,
  opacity = 0.15,
  className = '',
}) => {
  const { settings } = useSettings();
  const activeFruit = fruit || (settings as any)?.fruitTheme || DEFAULT_FRUIT;

  const theme = FRUIT_THEMES[activeFruit] || FRUIT_THEMES[DEFAULT_FRUIT];

  // Generate stable random particles
  const particles = useMemo<Particle[]>(() => {
    const items: Particle[] = [];
    for (let i = 0; i < count; i++) {
      // Use deterministic-ish values based on index to avoid hydration issues
      const seed = (i + 1) * 17;
      items.push({
        id: i,
        x: ((seed * 13) % 90) + 5, // 5-95%
        y: ((seed * 7) % 80) + 10, // 10-90%
        size: 18 + (seed % 20), // 18-37px
        duration: 8 + (seed % 10), // 8-17s
        delay: i * 1.2, // staggered
        rotateEnd: (seed % 2 === 0 ? 1 : -1) * (15 + (seed % 20)),
      });
    }
    return items;
  }, [count]);

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute select-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: p.size,
          }}
          initial={{ y: 0, rotate: 0, opacity: 0.6 }}
          animate={{
            y: [0, -30, 10, -20, 0],
            rotate: [0, p.rotateEnd, -p.rotateEnd / 2, p.rotateEnd / 3, 0],
            opacity: [0.6, 1, 0.7, 0.9, 0.6],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {theme.emoji}
        </motion.span>
      ))}
    </div>
  );
};
