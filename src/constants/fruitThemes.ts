// ═══════════════════════════════════════════════════════════════
// 🍊 Fruit Identity System — Theme Definitions
// Each fruit defines a complete visual identity for the platform
// ═══════════════════════════════════════════════════════════════

export type FruitId =
  | 'orange'
  | 'strawberry'
  | 'blueberry'
  | 'lemon'
  | 'grape'
  | 'kiwi'
  | 'watermelon';

export interface FruitTheme {
  id: FruitId;
  emoji: string;
  nameAr: string;
  nameEn: string;
  colors: {
    primary: string;
    secondary: string;
    dark: string;
    glow: string;
    gradient: string;
    bgAccent: string;
  };
  animation: 'bounce' | 'spin' | 'wiggle' | 'float' | 'pulse' | 'squeeze';
  decorationEmoji: string;
}

export const FRUIT_THEMES: Record<FruitId, FruitTheme> = {
  orange: {
    id: 'orange',
    emoji: '🍊',
    nameAr: 'برتقال',
    nameEn: 'Orange',
    colors: {
      primary: '#f97316',
      secondary: '#fb923c',
      dark: '#ea580c',
      glow: 'rgba(249, 115, 22, 0.3)',
      gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
      bgAccent: 'rgba(249, 115, 22, 0.08)',
    },
    animation: 'bounce',
    decorationEmoji: '🍊',
  },
  strawberry: {
    id: 'strawberry',
    emoji: '🍓',
    nameAr: 'فراولة',
    nameEn: 'Strawberry',
    colors: {
      primary: '#ef4444',
      secondary: '#f87171',
      dark: '#dc2626',
      glow: 'rgba(239, 68, 68, 0.3)',
      gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
      bgAccent: 'rgba(239, 68, 68, 0.08)',
    },
    animation: 'pulse',
    decorationEmoji: '🍓',
  },
  blueberry: {
    id: 'blueberry',
    emoji: '🫐',
    nameAr: 'توت أزرق',
    nameEn: 'Blueberry',
    colors: {
      primary: '#3b82f6',
      secondary: '#60a5fa',
      dark: '#2563eb',
      glow: 'rgba(59, 130, 246, 0.3)',
      gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      bgAccent: 'rgba(59, 130, 246, 0.08)',
    },
    animation: 'float',
    decorationEmoji: '🫐',
  },
  lemon: {
    id: 'lemon',
    emoji: '🍋',
    nameAr: 'ليمون',
    nameEn: 'Lemon',
    colors: {
      primary: '#eab308',
      secondary: '#facc15',
      dark: '#ca8a04',
      glow: 'rgba(234, 179, 8, 0.3)',
      gradient: 'linear-gradient(135deg, #eab308, #ca8a04)',
      bgAccent: 'rgba(234, 179, 8, 0.08)',
    },
    animation: 'wiggle',
    decorationEmoji: '🍋',
  },
  grape: {
    id: 'grape',
    emoji: '🍇',
    nameAr: 'عنب',
    nameEn: 'Grape',
    colors: {
      primary: '#a855f7',
      secondary: '#c084fc',
      dark: '#9333ea',
      glow: 'rgba(168, 85, 247, 0.3)',
      gradient: 'linear-gradient(135deg, #a855f7, #9333ea)',
      bgAccent: 'rgba(168, 85, 247, 0.08)',
    },
    animation: 'squeeze',
    decorationEmoji: '🍇',
  },
  kiwi: {
    id: 'kiwi',
    emoji: '🥝',
    nameAr: 'كيوي',
    nameEn: 'Kiwi',
    colors: {
      primary: '#22c55e',
      secondary: '#4ade80',
      dark: '#16a34a',
      glow: 'rgba(34, 197, 94, 0.3)',
      gradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
      bgAccent: 'rgba(34, 197, 94, 0.08)',
    },
    animation: 'spin',
    decorationEmoji: '🥝',
  },
  watermelon: {
    id: 'watermelon',
    emoji: '🍉',
    nameAr: 'بطيخ',
    nameEn: 'Watermelon',
    colors: {
      primary: '#e11d48',
      secondary: '#fb7185',
      dark: '#be123c',
      glow: 'rgba(225, 29, 72, 0.3)',
      gradient: 'linear-gradient(135deg, #e11d48, #be123c)',
      bgAccent: 'rgba(225, 29, 72, 0.08)',
    },
    animation: 'bounce',
    decorationEmoji: '🍉',
  },
};

export const DEFAULT_FRUIT: FruitId = 'blueberry';

export const FRUIT_LIST = Object.values(FRUIT_THEMES);

/**
 * Apply a fruit theme to the document's CSS custom properties.
 * This changes ALL brand colors across the entire platform instantly.
 */
export function applyFruitTheme(fruitId: FruitId): void {
  const theme = FRUIT_THEMES[fruitId];
  if (!theme) return;

  const root = document.documentElement;
  root.style.setProperty('--color-brand-600', theme.colors.primary);
  root.style.setProperty('--color-brand-500', theme.colors.secondary);
  root.style.setProperty('--color-brand-400', theme.colors.secondary);
  root.style.setProperty('--color-brand-blue', theme.colors.primary);
  root.style.setProperty('--brand-primary', theme.colors.primary);
  root.style.setProperty('--fruit-glow', theme.colors.glow);
  root.style.setProperty('--fruit-gradient', theme.colors.gradient);
  root.style.setProperty('--fruit-bg-accent', theme.colors.bgAccent);
  root.style.setProperty('--fruit-emoji', `"${theme.emoji}"`);

  // Also update meta theme-color for mobile browsers
  const metaTheme = document.querySelector('meta[name="theme-color"]:not([media])');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme.colors.dark);
  }
}
