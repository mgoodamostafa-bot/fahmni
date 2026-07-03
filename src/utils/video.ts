/**
 * Video Player Utilities
 * Additional utilities for video player functionality
 */

// Keyboard shortcuts configuration
export interface KeyboardShortcut {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  action: string;
  description: string;
  descriptionAr: string;
}

export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { key: ' ', action: 'togglePlay', description: 'Play/Pause', descriptionAr: 'تشغيل/إيقاف' },
  {
    key: 'ArrowRight',
    action: 'seekForward',
    description: 'Seek Forward 10s',
    descriptionAr: 'تقديم 10 ثوانٍ',
  },
  {
    key: 'ArrowLeft',
    action: 'seekBackward',
    description: 'Seek Backward 10s',
    descriptionAr: 'ترجيع 10 ثوانٍ',
  },
  { key: 'ArrowUp', action: 'volumeUp', description: 'Volume Up', descriptionAr: 'رفع الصوت' },
  {
    key: 'ArrowDown',
    action: 'volumeDown',
    description: 'Volume Down',
    descriptionAr: 'خفض الصوت',
  },
  { key: 'f', action: 'toggleFullscreen', description: 'Fullscreen', descriptionAr: 'ملء الشاشة' },
  { key: 'm', action: 'toggleMute', description: 'Mute/Unmute', descriptionAr: 'كتم الصوت' },
  { key: 'n', action: 'nextLesson', description: 'Next Lesson', descriptionAr: 'الدرس التالي' },
  {
    key: 'p',
    action: 'previousLesson',
    description: 'Previous Lesson',
    descriptionAr: 'الدرس السابق',
  },
  { key: '[', action: 'slowerSpeed', description: 'Slower Playback', descriptionAr: 'أبطأ تشغيل' },
  { key: ']', action: 'fasterSpeed', description: 'Faster Playback', descriptionAr: 'أسرع تشغيل' },
  { key: '0', action: 'restart', description: 'Restart Video', descriptionAr: 'إعادة التشغيل' },
  { key: '1', action: 'jumpTo10', description: 'Jump to 10%', descriptionAr: 'انتقل لـ 10%' },
  { key: '2', action: 'jumpTo20', description: 'Jump to 20%', descriptionAr: 'انتقل لـ 20%' },
  { key: '3', action: 'jumpTo30', description: 'Jump to 30%', descriptionAr: 'انتقل لـ 30%' },
  { key: '4', action: 'jumpTo40', description: 'Jump to 40%', descriptionAr: 'انتقل لـ 40%' },
  { key: '5', action: 'jumpTo50', description: 'Jump to 50%', descriptionAr: 'انتقل لـ 50%' },
  { key: '6', action: 'jumpTo60', description: 'Jump to 60%', descriptionAr: 'انتقل لـ 60%' },
  { key: '7', action: 'jumpTo70', description: 'Jump to 70%', descriptionAr: 'انتقل لـ 70%' },
  { key: '8', action: 'jumpTo80', description: 'Jump to 80%', descriptionAr: 'انتقل لـ 80%' },
  { key: '9', action: 'jumpTo90', description: 'Jump to 90%', descriptionAr: 'انتقل لـ 90%' },
];

// Playback speeds
export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// Quality options (for future use)
export interface QualityOption {
  label: string;
  value: string;
  width: number;
  height: number;
}

export const QUALITY_OPTIONS: QualityOption[] = [
  { label: '240p', value: '240', width: 426, height: 240 },
  { label: '360p', value: '360', width: 640, height: 360 },
  { label: '480p', value: '480', width: 854, height: 480 },
  { label: '720p', value: '720', width: 1280, height: 720 },
  { label: '1080p', value: '1080', width: 1920, height: 1080 },
];

// Format time as HH:MM:SS or MM:SS
export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Calculate playback percentage
export const calculateProgress = (currentTime: number, duration: number): number => {
  if (duration === 0) return 0;
  return (currentTime / duration) * 100;
};

// Get buffered percentage
export const getBufferedPercentage = (buffered: TimeRanges, duration: number): number => {
  if (buffered.length === 0 || duration === 0) return 0;
  return (buffered.end(buffered.length - 1) / duration) * 100;
};

// Speed up/down
export const getNextSpeed = (currentSpeed: number, direction: 'up' | 'down'): number => {
  const currentIndex = PLAYBACK_SPEEDS.indexOf(currentSpeed);
  if (currentIndex === -1) return 1;

  if (direction === 'up' && currentIndex < PLAYBACK_SPEEDS.length - 1) {
    return PLAYBACK_SPEEDS[currentIndex + 1];
  } else if (direction === 'down' && currentIndex > 0) {
    return PLAYBACK_SPEEDS[currentIndex - 1];
  }
  return currentSpeed;
};

// Local storage keys for video progress
export const VIDEO_PROGRESS_KEY = 'fahmni_video_progress';

export interface VideoProgress {
  lessonId: string;
  currentTime: number;
  duration: number;
  completed: boolean;
  lastWatched: Date;
}

// Save video progress
export const saveVideoProgress = (progress: VideoProgress): void => {
  try {
    const existing = JSON.parse(localStorage.getItem(VIDEO_PROGRESS_KEY) || '{}');
    existing[progress.lessonId] = {
      ...progress,
      lastWatched: new Date().toISOString(),
    };
    localStorage.setItem(VIDEO_PROGRESS_KEY, JSON.stringify(existing));
  } catch (error) {
    console.error('Failed to save video progress:', error);
  }
};

// Get video progress
export const getVideoProgress = (lessonId: string): VideoProgress | null => {
  try {
    const existing = JSON.parse(localStorage.getItem(VIDEO_PROGRESS_KEY) || '{}');
    return existing[lessonId] || null;
  } catch (error) {
    console.error('Failed to get video progress:', error);
    return null;
  }
};
