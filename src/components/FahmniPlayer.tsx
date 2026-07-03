import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  Loader2,
  Settings,
  Tv,
  SkipForward,
  SkipBack,
  Shield,
  Rewind,
  FastForward,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface FahmniPlayerProps {
  url: string;
  title?: string;
  thumbnailUrl?: string;
  onStart?: () => void;
  onProgress?: (data: { currentTime: number; duration: number }) => void;
  onEnded?: () => void;
  initialTime?: number;
  isTheaterMode?: boolean;
  onTheaterToggle?: () => void;
  watermarkText?: string;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

type VideoSource = 'youtube' | 'drive' | 'direct';

// ═══════════════════════════════════════════════════════════════
// 🔍 Device detection
// ═══════════════════════════════════════════════════════════════
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobileDevice = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const detectSource = (url: string): VideoSource => {
  if (!url) return 'direct';
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/drive\.google\.com/.test(url)) return 'drive';
  return 'direct';
};

const extractYouTubeId = (url: string) =>
  url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)?.[1] ||
  null;

const extractDriveId = (url: string) => url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || null;

// ═══════════════════════════════════════════════════════════════
// 🛡️ Content Protection Watermark
// ═══════════════════════════════════════════════════════════════
const ProtectionWatermark: React.FC<{ text?: string }> = ({ text }) => {
  if (!text) return null;
  return (
    <div
      className="absolute inset-0 z-[5] pointer-events-none overflow-hidden select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-x-24 gap-y-16 -rotate-[25deg] scale-150 opacity-[0.035]">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="text-white text-sm font-bold whitespace-nowrap tracking-widest">
            {text}
          </span>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ⏱️ Time formatter
// ═══════════════════════════════════════════════════════════════
const formatTime = (time: number) => {
  if (isNaN(time) || time < 0) return '0:00';
  const h = Math.floor(time / 3600);
  const m = Math.floor((time % 3600) / 60);
  const s = Math.floor(time % 60);
  return h > 0
    ? `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
    : `${m}:${s < 10 ? '0' : ''}${s}`;
};

// ═══════════════════════════════════════════════════════════════
// 🎬 MAIN PLAYER COMPONENT
// ═══════════════════════════════════════════════════════════════
export const FahmniPlayer: React.FC<FahmniPlayerProps> = ({
  url,
  title,
  thumbnailUrl,
  onStart,
  onProgress,
  onEnded,
  initialTime = 0,
  isTheaterMode = false,
  onTheaterToggle,
  watermarkText,
}) => {
  // ── State ──
  const [loading, setLoading] = useState(true);
  const [showPoster, setShowPoster] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAutoPlayOverlay, setShowAutoPlayOverlay] = useState(false);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState(5);
  const [resumed, setResumed] = useState(false);
  const [showResumeToast, setShowResumeToast] = useState(false);
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const [seekTooltip, setSeekTooltip] = useState<{ show: boolean; time: number; x: number }>({
    show: false,
    time: 0,
    x: 0,
  });
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [playAnimation, setPlayAnimation] = useState<'play' | 'pause' | null>(null);

  // ── Derived ──
  const sourceType = detectSource(url);
  const youtubeId = sourceType === 'youtube' ? extractYouTubeId(url) : null;
  const driveId = sourceType === 'drive' ? extractDriveId(url) : null;

  // ── Refs ──
  const ytPlayerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerId = useRef(`yt-${Math.random().toString(36).substr(2, 9)}`);
  const progressInterval = useRef<any>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const autoPlayTimerRef = useRef<any>(null);
  const lastTapRef = useRef<number>(0);
  const doubleTapTimerRef = useRef<any>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  const onStartRef = useRef(onStart);
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);

  useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const mobile = useMemo(() => isMobileDevice(), []);

  // ═══════════════════════════════════════════════════════════
  // 🛡️ Content Protection
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        return;
      }
      if (
        e.ctrlKey &&
        (e.key === 's' || e.key === 'u' || e.key === 'p' || (e.key === 'i' && e.shiftKey))
      ) {
        e.preventDefault();
        return;
      }
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
    };
    const handleDrag = (e: DragEvent) => e.preventDefault();
    const handleCopy = (e: ClipboardEvent) => {
      if (playerContainerRef.current?.contains(e.target as Node)) e.preventDefault();
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('dragstart', handleDrag);
    document.addEventListener('copy', handleCopy);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('dragstart', handleDrag);
      document.removeEventListener('copy', handleCopy);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // 🎬 Progress Tracking
  // ═══════════════════════════════════════════════════════════
  const startProgressTracking = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      let time = 0,
        dur = 0;
      if (sourceType === 'youtube' && ytPlayerRef.current?.getCurrentTime) {
        time = ytPlayerRef.current?.getCurrentTime?.();
        dur = ytPlayerRef.current?.getDuration?.();
      } else if (sourceType === 'direct' && videoRef.current) {
        time = videoRef.current.currentTime;
        dur = videoRef.current.duration;
        // Update buffer
        if (videoRef.current.buffered.length > 0) {
          setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
        }
      }
      setCurrentTime(time);
      if (dur > 0) setDuration(dur);
      if (onProgressRef.current && dur > 0)
        onProgressRef.current({ currentTime: time, duration: dur });
    }, 500);
  }, [sourceType]);

  const stopProgressTracking = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
  }, []);

  const handleVideoEnded = useCallback(() => {
    if (!onEndedRef.current) return;
    setShowAutoPlayOverlay(true);
    setAutoPlayCountdown(5);
    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    autoPlayTimerRef.current = setInterval(() => {
      setAutoPlayCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(autoPlayTimerRef.current);
          if (onEndedRef.current) onEndedRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // 🎥 YouTube Player Init
  // ═══════════════════════════════════════════════════════════
  const initYouTubePlayer = useCallback(() => {
    if (!youtubeId || sourceType !== 'youtube') return;

    // Destroy existing player if any
    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current?.destroy?.();
      } catch {}
    }

    ytPlayerRef.current = new window.YT.Player(containerId.current, {
      videoId: youtubeId,
      playerVars: {
        autoplay: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        controls: 0,
        enablejsapi: 1,
        disablekb: 1,
        iv_load_policy: 3,
        fs: 0,
        playsinline: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event: any) => {
          setLoading(false);
          setDuration(event.target.getDuration());
          if (initialTime > 0 && !resumed) {
            event.target.seekTo(initialTime, true);
            setResumed(true);
            setShowResumeToast(true);
            setTimeout(() => setShowResumeToast(false), 3000);
          }
        },
        onStateChange: (event: any) => {
          const state = event.data;
          if (state === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            setDuration(ytPlayerRef.current?.getDuration?.());
            if (onStartRef.current) onStartRef.current();
            startProgressTracking();
            setShowAutoPlayOverlay(false);
            if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
          } else if (state === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
            stopProgressTracking();
          } else if (state === window.YT.PlayerState.ENDED) {
            setIsPlaying(false);
            stopProgressTracking();
            handleVideoEnded();
          } else if (state === window.YT.PlayerState.BUFFERING) {
            setLoading(true);
          }
          if (state !== window.YT.PlayerState.BUFFERING) {
            setLoading(false);
          }
        },
      },
    });
  }, [
    youtubeId,
    sourceType,
    initialTime,
    resumed,
    startProgressTracking,
    stopProgressTracking,
    handleVideoEnded,
  ]);

  useEffect(() => {
    if (sourceType === 'youtube') {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }
      if (window.YT && window.YT.Player) {
        initYouTubePlayer();
      } else {
        window.onYouTubeIframeAPIReady = initYouTubePlayer;
      }
    } else if (sourceType === 'direct' || sourceType === 'drive') {
      setLoading(false);
    }

    return () => {
      stopProgressTracking();
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current?.destroy?.();
        } catch {}
      }
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [initYouTubePlayer, sourceType, stopProgressTracking]);

  // ═══════════════════════════════════════════════════════════
  // 🎬 Direct Video Events
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const video = videoRef.current;
    if (sourceType === 'direct' && video) {
      const onTimeUpdate = () => {
        setCurrentTime(video.currentTime);
        setDuration(video.duration || 0);
        if (video.buffered.length > 0) {
          setBuffered(video.buffered.end(video.buffered.length - 1));
        }
        if (onProgressRef.current)
          onProgressRef.current({ currentTime: video.currentTime, duration: video.duration || 0 });
      };
      const onPlay = () => {
        setIsPlaying(true);
        if (onStartRef.current) onStartRef.current();
        setShowAutoPlayOverlay(false);
        if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      };
      const onPause = () => setIsPlaying(false);
      const onEndedEvent = () => handleVideoEnded();
      const onLoadedMetadata = () => {
        setDuration(video.duration);
        setLoading(false);
        if (initialTime > 0 && !resumed) {
          video.currentTime = initialTime;
          setResumed(true);
          setShowResumeToast(true);
          setTimeout(() => setShowResumeToast(false), 3000);
        }
      };
      const onWaiting = () => setLoading(true);
      const onCanPlay = () => setLoading(false);

      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('ended', onEndedEvent);
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('canplay', onCanPlay);

      return () => {
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('ended', onEndedEvent);
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('canplay', onCanPlay);
      };
    }
  }, [sourceType, initialTime, resumed, handleVideoEnded]);

  // ═══════════════════════════════════════════════════════════
  // ⌨️ Keyboard Controls
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      const k = e.code;
      if (k === 'Space' || k === 'KeyK') {
        e.preventDefault();
        togglePlay();
      } else if (k === 'ArrowRight' || k === 'KeyL') {
        seekRelative(10);
      } else if (k === 'ArrowLeft' || k === 'KeyJ') {
        seekRelative(-10);
      } else if (k === 'ArrowUp') {
        e.preventDefault();
        changeVolumeRelative(10);
      } else if (k === 'ArrowDown') {
        e.preventDefault();
        changeVolumeRelative(-10);
      } else if (k === 'KeyF') {
        toggleFullscreen();
      } else if (k === 'KeyT') {
        if (onTheaterToggle) onTheaterToggle();
      } else if (k === 'KeyM') {
        toggleMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const handleFullscreenChange = () => {
      if (
        !document.fullscreenElement &&
        !(document as any).webkitFullscreenElement &&
        !(document as any).mozFullScreenElement &&
        !(document as any).msFullscreenElement
      ) {
        setIsFullscreen(false);
        document.body.classList.remove('fullscreen-active');
        try {
          (screen.orientation as any)?.unlock?.();
        } catch {}
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // 🖥️ Fullscreen — iOS/Safari/Android compatible
  // ═══════════════════════════════════════════════════════════
  const toggleFullscreen = useCallback(() => {
    const container = playerContainerRef.current;
    if (!container) return;

    const isCurrentlyFS =
      isFullscreen || document.fullscreenElement || (document as any).webkitFullscreenElement;

    if (isCurrentlyFS) {
      // EXIT
      setIsFullscreen(false);
      document.body.classList.remove('fullscreen-active');
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if ((document as any).webkitFullscreenElement)
          (document as any).webkitExitFullscreen();
      } catch {}
      try {
        (screen.orientation as any)?.unlock?.();
      } catch {}
    } else {
      // ENTER
      // Try native Fullscreen API first (works on Android Chrome, Desktop)
      let nativeWorked = false;
      if (!isIOS()) {
        try {
          if (container.requestFullscreen) {
            container.requestFullscreen();
            nativeWorked = true;
          } else if ((container as any).webkitRequestFullscreen) {
            (container as any).webkitRequestFullscreen();
            nativeWorked = true;
          }
        } catch {}
      }

      // For iOS or if native failed → use CSS fullscreen
      setIsFullscreen(true);
      document.body.classList.add('fullscreen-active');

      // Lock landscape on mobile
      try {
        (screen.orientation as any)?.lock?.('landscape');
      } catch {}
    }
  }, [isFullscreen]);

  // ═══════════════════════════════════════════════════════════
  // 🎮 Playback Controls
  // ═══════════════════════════════════════════════════════════
  const togglePlay = useCallback(() => {
    if (showPoster) setShowPoster(false);

    // Flash animation
    setPlayAnimation(isPlaying ? 'pause' : 'play');
    setTimeout(() => setPlayAnimation(null), 600);

    if (sourceType === 'youtube' && ytPlayerRef.current) {
      if (isPlaying) ytPlayerRef.current?.pauseVideo?.();
      else ytPlayerRef.current?.playVideo?.();
    } else if (sourceType === 'direct' && videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  }, [isPlaying, showPoster, sourceType]);

  const seekRelative = useCallback(
    (seconds: number) => {
      if (sourceType === 'youtube' && ytPlayerRef.current) {
        const newTime = ytPlayerRef.current?.getCurrentTime?.() + seconds;
        ytPlayerRef.current?.seekTo?.(newTime, true);
      } else if (sourceType === 'direct' && videoRef.current) {
        videoRef.current.currentTime += seconds;
      }
    },
    [sourceType]
  );

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = Number(e.target.value);
      setCurrentTime(time);
      if (sourceType === 'youtube' && ytPlayerRef.current) {
        ytPlayerRef.current?.seekTo?.(time, true);
      } else if (sourceType === 'direct' && videoRef.current) {
        videoRef.current.currentTime = time;
      }
    },
    [sourceType]
  );

  const handleSeekBarHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!seekBarRef.current || duration <= 0) return;
      const rect = seekBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      setSeekTooltip({ show: true, time: pct * duration, x });
    },
    [duration]
  );

  const handleSeekBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!seekBarRef.current || duration <= 0) return;
      const rect = seekBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const time = pct * duration;
      setCurrentTime(time);
      if (sourceType === 'youtube' && ytPlayerRef.current) {
        ytPlayerRef.current?.seekTo?.(time, true);
      } else if (sourceType === 'direct' && videoRef.current) {
        videoRef.current.currentTime = time;
      }
    },
    [duration, sourceType]
  );

  const toggleMute = useCallback(() => {
    if (sourceType === 'youtube' && ytPlayerRef.current) {
      if (isMuted) {
        ytPlayerRef.current?.unMute?.();
        setIsMuted(false);
      } else {
        ytPlayerRef.current?.mute?.();
        setIsMuted(true);
      }
    } else if (sourceType === 'direct' && videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted, sourceType]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      setVolume(val);
      const unmuted = val > 0;
      setIsMuted(!unmuted);
      if (sourceType === 'youtube' && ytPlayerRef.current) {
        ytPlayerRef.current?.setVolume?.(val);
        if (unmuted) ytPlayerRef.current?.unMute?.();
        else ytPlayerRef.current?.mute?.();
      } else if (sourceType === 'direct' && videoRef.current) {
        videoRef.current.volume = val / 100;
        videoRef.current.muted = !unmuted;
      }
    },
    [sourceType]
  );

  const changeVolumeRelative = useCallback(
    (delta: number) => {
      const newVol = Math.max(0, Math.min(100, volume + delta));
      setVolume(newVol);
      const unmuted = newVol > 0;
      setIsMuted(!unmuted);
      if (sourceType === 'youtube' && ytPlayerRef.current) {
        ytPlayerRef.current?.setVolume?.(newVol);
        if (unmuted) ytPlayerRef.current?.unMute?.();
        else ytPlayerRef.current?.mute?.();
      } else if (sourceType === 'direct' && videoRef.current) {
        videoRef.current.volume = newVol / 100;
        videoRef.current.muted = !unmuted;
      }
    },
    [volume, sourceType]
  );

  const changePlaybackRate = useCallback(
    (rate: number) => {
      setPlaybackRate(rate);
      setShowSpeedMenu(false);
      if (sourceType === 'youtube' && ytPlayerRef.current) {
        ytPlayerRef.current?.setPlaybackRate?.(rate);
      } else if (sourceType === 'direct' && videoRef.current) {
        videoRef.current.playbackRate = rate;
      }
    },
    [sourceType]
  );

  // ═══════════════════════════════════════════════════════════
  // 🖱️ Controls visibility
  // ═══════════════════════════════════════════════════════════
  const showControlsTemporarily = useCallback(() => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSpeedMenu && !showVolumeSlider) setIsControlsVisible(false);
    }, 3000);
  }, [isPlaying, showSpeedMenu, showVolumeSlider]);

  const cancelAutoPlay = () => {
    setShowAutoPlayOverlay(false);
    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
  };

  const skipAutoPlay = () => {
    clearInterval(autoPlayTimerRef.current);
    setShowAutoPlayOverlay(false);
    if (onEndedRef.current) onEndedRef.current();
  };

  // ═══════════════════════════════════════════════════════════
  // 📱 Mobile Double-Tap to Seek (±10s)
  // ═══════════════════════════════════════════════════════════
  const handleTouchTap = useCallback(
    (e: React.TouchEvent) => {
      if (showAutoPlayOverlay || showPoster) return;

      const now = Date.now();
      const rect = playerContainerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const touchX = e.changedTouches[0].clientX;
      const relativeX = touchX - rect.left;
      const isRightSide = relativeX > rect.width / 2;

      if (now - lastTapRef.current < 300) {
        if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current);
        if (isRightSide) {
          seekRelative(10);
          setDoubleTapSide('right');
        } else {
          seekRelative(-10);
          setDoubleTapSide('left');
        }
        setTimeout(() => setDoubleTapSide(null), 600);
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
        doubleTapTimerRef.current = setTimeout(() => {
          togglePlay();
          showControlsTemporarily();
        }, 280);
      }
    },
    [showAutoPlayOverlay, showPoster, seekRelative, togglePlay, showControlsTemporarily]
  );

  // ═══════════════════════════════════════════════════════════
  // 🎨 Progress percentage
  // ═══════════════════════════════════════════════════════════
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const controlsVisible = (isControlsVisible || !isPlaying) && !showAutoPlayOverlay && !showPoster;

  // ═══════════════════════════════════════════════════════════
  // 🎬 DRIVE PLAYER
  // ═══════════════════════════════════════════════════════════
  if (sourceType === 'drive') {
    return (
      <div
        className={`relative w-full overflow-hidden bg-black shadow-2xl transition-all duration-300 group select-none ${isFullscreen ? 'fahmni-fullscreen' : 'aspect-video rounded-2xl'}`}
        style={
          {
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          } as React.CSSProperties
        }
        dir="ltr"
        ref={playerContainerRef}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Drive iframe */}
        <iframe
          src={`https://drive.google.com/file/d/${driveId}/preview`}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen"
          allowFullScreen
          title={title || 'Google Drive Video'}
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />

        {/* 🛡️ Top overlay — hides Drive's pop-out/download buttons */}
        <div
          className="absolute top-0 left-0 right-0 h-[60px] z-40 pointer-events-auto"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="flex items-center h-full px-5 gap-3">
            <Shield size={14} className="text-blue-400/60" />
            <span className="text-white/50 text-[11px] font-bold tracking-wide">
              محتوى محمي — {title || 'فيديو'}
            </span>
          </div>
        </div>

        {/* 🛡️ Watermark */}
        <ProtectionWatermark text={watermarkText} />

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="absolute bottom-5 right-5 z-50 p-3.5 bg-black/60 backdrop-blur-lg rounded-2xl text-white hover:bg-white/15 transition-all shadow-xl border border-white/10 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 active:scale-90"
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>

        {/* Close on fullscreen */}
        <AnimatePresence>
          {isFullscreen && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={toggleFullscreen}
              className="absolute top-5 left-5 z-50 p-3 bg-black/50 backdrop-blur-lg rounded-full text-white hover:bg-white/15 transition-all border border-white/10"
            >
              <X size={20} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 🎬 MAIN PLAYER (YouTube + Direct)
  // ═══════════════════════════════════════════════════════════
  return (
    <div
      ref={playerContainerRef}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => {
        if (isPlaying) setIsControlsVisible(false);
        setShowVolumeSlider(false);
      }}
      className={`relative w-full overflow-hidden bg-black shadow-2xl group select-none flex items-center justify-center transition-all duration-300 ${isFullscreen ? 'fahmni-fullscreen' : 'aspect-video rounded-2xl'}`}
      style={
        {
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        } as React.CSSProperties
      }
      dir="ltr"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ── Close Button (Fullscreen) ── */}
      <AnimatePresence>
        {isFullscreen && controlsVisible && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={toggleFullscreen}
            className="absolute top-4 left-4 z-50 p-3 bg-black/50 backdrop-blur-lg rounded-full text-white hover:bg-white/15 transition-all border border-white/10"
            style={{
              top: `max(env(safe-area-inset-top, 12px), 12px)`,
              left: `max(env(safe-area-inset-left, 12px), 12px)`,
            }}
          >
            <X size={22} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Title Bar (top overlay) ── */}
      <AnimatePresence>
        {controlsVisible && title && !showPoster && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute top-0 left-0 right-0 z-30 p-4 sm:p-5"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
            }}
          >
            <p className="text-white/90 text-sm sm:text-base font-bold truncate pr-12">{title}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🛡️ Watermark */}
      <ProtectionWatermark text={watermarkText} />

      {/* ── Resume Toast ── */}
      <AnimatePresence>
        {showResumeToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-14 right-5 z-50 px-4 py-2.5 bg-black/70 backdrop-blur-xl rounded-xl text-white text-sm font-bold border border-white/10 shadow-2xl"
          >
            ▶ تم الاستئناف من {formatTime(initialTime)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Double-Tap Feedback ── */}
      <AnimatePresence>
        {doubleTapSide && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className={`absolute z-30 pointer-events-none ${doubleTapSide === 'right' ? 'right-16' : 'left-16'} top-1/2 -translate-y-1/2`}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-white/10 rounded-full animate-player-ripple" />
              <div className="bg-white/20 backdrop-blur-md rounded-full p-5 text-white relative z-10">
                {doubleTapSide === 'right' ? <FastForward size={28} /> : <Rewind size={28} />}
              </div>
            </div>
            <p className="text-white text-xs font-black text-center mt-3 drop-shadow-lg">
              {doubleTapSide === 'right' ? '+10' : '-10'} ثانية
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Play/Pause Flash Animation ── */}
      <AnimatePresence>
        {playAnimation && !showPoster && (
          <motion.div
            key={playAnimation}
            initial={{ opacity: 0.8, scale: 0.5 }}
            animate={{ opacity: 0, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute z-30 pointer-events-none"
          >
            <div className="bg-black/40 backdrop-blur-sm rounded-full p-5 text-white">
              {playAnimation === 'play' ? (
                <Play size={32} className="fill-current ml-1" />
              ) : (
                <Pause size={32} className="fill-current" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Video Surface ── */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden bg-black">
        {sourceType === 'youtube' && (
          <div
            id={containerId.current}
            className="w-full h-full"
            style={{
              // Slightly oversized to hide YT branding — contained within overflow:hidden
              width: isFullscreen ? '100%' : '104%',
              height: isFullscreen ? '100%' : '104%',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}
        {sourceType === 'direct' && (
          <video
            ref={videoRef}
            src={url}
            className="w-full h-full object-contain"
            playsInline
            preload="metadata"
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
            style={{ pointerEvents: 'none' }}
          />
        )}
      </div>

      {/* ── Click/Touch Overlay ── */}
      <div
        className="absolute inset-0 z-10 bg-transparent cursor-pointer"
        onClick={(e) => {
          if (showAutoPlayOverlay) return;
          if (!mobile) {
            togglePlay();
            showControlsTemporarily();
          }
        }}
        onTouchEnd={handleTouchTap}
      />

      {/* ── Poster ── */}
      <AnimatePresence>
        {showPoster && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-20"
          >
            {thumbnailUrl || sourceType === 'youtube' ? (
              <img
                src={thumbnailUrl || `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
                className="w-full h-full object-cover"
                alt="Cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black flex items-center justify-center">
                <Play size={48} className="text-white/10" />
              </div>
            )}
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

            {/* Play Button */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={togglePlay}
                className="relative w-[72px] h-[72px] sm:w-20 sm:h-20 bg-brand-600/90 backdrop-blur-xl text-white rounded-full flex items-center justify-center shadow-2xl shadow-brand-600/30 z-30 border border-white/20"
              >
                <div className="absolute inset-0 rounded-full bg-brand-600/40 animate-player-ripple" />
                <Play size={30} className="fill-current ml-1 relative z-10" />
              </motion.button>

              {title && (
                <div className="text-center z-30 mt-2 px-6">
                  <h3 className="text-white font-black text-base sm:text-lg drop-shadow-lg line-clamp-2">
                    {title}
                  </h3>
                  {sourceType === 'youtube' && (
                    <p className="text-white/40 text-[10px] font-bold mt-1 tracking-wider uppercase">
                      YouTube • Premium
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Centered Pause Icon ── */}
      <AnimatePresence>
        {!isPlaying && !showPoster && !loading && !showAutoPlayOverlay && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="absolute z-30 pointer-events-none"
          >
            <div className="w-16 h-16 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white ring-2 ring-white/10">
              <Play size={24} className="fill-current ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading Spinner ── */}
      <AnimatePresence>
        {loading && !showPoster && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
              </div>
              <span className="text-white/50 text-xs font-bold">جاري التحميل...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Auto-Play Overlay ── */}
      <AnimatePresence>
        {showAutoPlayOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center"
            dir="rtl"
          >
            {/* Countdown ring */}
            <div className="relative w-24 h-24 mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  className="text-white/10"
                />
                <motion.circle
                  cx="48"
                  cy="48"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  className="text-brand-600"
                  strokeDasharray="264"
                  strokeLinecap="round"
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: 264 * (1 - autoPlayCountdown / 5) }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-black text-white">{autoPlayCountdown}</span>
              </div>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white mb-2">الدرس التالي</h3>
            <p className="text-white/50 text-sm font-bold mb-8">سيبدأ تلقائياً...</p>

            <div className="flex gap-4">
              <button
                onClick={cancelAutoPlay}
                className="px-6 py-3 rounded-2xl bg-white/10 text-white font-bold hover:bg-white/20 transition-all pointer-events-auto border border-white/5"
              >
                إلغاء
              </button>
              <button
                onClick={skipAutoPlay}
                className="px-6 py-3 rounded-2xl bg-brand-600 text-white font-bold hover:bg-blue-600 transition-all flex items-center gap-2 shadow-xl shadow-brand-600/25 pointer-events-auto"
              >
                تشغيل الآن <ChevronRight size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          🎛️ Controls Bar — Udemy/Coursera Style
          ═══════════════════════════════════════════════════════ */}
      <motion.div
        animate={{ opacity: controlsVisible ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="absolute inset-x-0 bottom-0 z-40 pointer-events-auto"
        style={isFullscreen ? { paddingBottom: `max(env(safe-area-inset-bottom, 0px), 4px)` } : {}}
      >
        {/* Gradient backdrop */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none"
          style={{ top: '-100%' }}
        />

        <div className="relative px-3 sm:px-5 pb-3 sm:pb-4 pt-10 sm:pt-14">
          {/* ── Seek Bar ── */}
          <div
            ref={seekBarRef}
            className="relative h-5 sm:h-6 flex items-center cursor-pointer group/seek mb-1 sm:mb-2"
            onMouseMove={handleSeekBarHover}
            onMouseLeave={() => setSeekTooltip((prev) => ({ ...prev, show: false }))}
            onClick={handleSeekBarClick}
          >
            {/* Seek tooltip */}
            {seekTooltip.show && (
              <div className="fahmni-seek-tooltip" style={{ left: `${seekTooltip.x}px` }}>
                {formatTime(seekTooltip.time)}
              </div>
            )}

            {/* Track bg */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[3px] sm:h-1 group-hover/seek:h-1.5 sm:group-hover/seek:h-2 transition-all bg-white/20 rounded-full" />

            {/* Buffer bar */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] sm:h-1 group-hover/seek:h-1.5 sm:group-hover/seek:h-2 transition-all bg-white/30 rounded-full animate-buffer-shimmer"
              style={{ width: `${bufferPct}%` }}
            />

            {/* Progress bar */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] sm:h-1 group-hover/seek:h-1.5 sm:group-hover/seek:h-2 transition-all bg-brand-600 rounded-full"
              style={{ width: `${progressPct}%` }}
            >
              {/* Glow effect */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-brand-600 rounded-full blur-sm opacity-0 group-hover/seek:opacity-60 transition-opacity" />
            </div>

            {/* Thumb dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0 h-0 group-hover/seek:w-[14px] group-hover/seek:h-[14px] bg-white rounded-full shadow-lg transition-all duration-200 z-10"
              style={{ left: `${progressPct}%` }}
            />

            {/* Invisible range input */}
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
          </div>

          {/* ── Controls Row ── */}
          <div className="flex items-center justify-between">
            {/* LEFT SIDE */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="text-white hover:text-brand-400 transition-colors p-1.5 sm:p-2 hover:bg-white/10 rounded-lg active:scale-90"
              >
                {isPlaying ? (
                  <Pause size={mobile ? 20 : 22} className="fill-current" />
                ) : (
                  <Play size={mobile ? 20 : 22} className="fill-current" />
                )}
              </button>

              {/* Mobile: Skip buttons */}
              <button
                onClick={() => seekRelative(-10)}
                className="text-white/70 hover:text-white transition-colors sm:hidden p-1.5 active:scale-90"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={() => seekRelative(10)}
                className="text-white/70 hover:text-white transition-colors sm:hidden p-1.5 active:scale-90"
              >
                <SkipForward size={18} />
              </button>

              {/* Volume (desktop) */}
              <div
                className="hidden sm:flex items-center gap-1 group/vol"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button
                  onClick={toggleMute}
                  className="text-white/70 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
                >
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${showVolumeSlider ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}
                >
                  <div className="relative h-5 flex items-center">
                    <div className="absolute left-0 w-full h-1 bg-white/20 rounded-full" />
                    <div
                      className="absolute left-0 h-1 bg-white rounded-full"
                      style={{ width: `${isMuted ? 0 : volume}%` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 fahmni-vol-thumb"
                    />
                  </div>
                </div>
              </div>

              {/* Time */}
              <div className="text-white/70 font-mono text-[10px] sm:text-xs tracking-wider ml-1">
                <span className="text-white font-bold">{formatTime(currentTime)}</span>
                <span className="text-white/30 mx-1">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Speed Control */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className={`text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition-all ${
                    playbackRate !== 1
                      ? 'text-brand-400 bg-brand-600/15 border-brand-600/30'
                      : 'text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border-white/10'
                  }`}
                >
                  {playbackRate}x
                </button>

                <AnimatePresence>
                  {showSpeedMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full right-0 mb-2 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[100px] z-50"
                    >
                      <div className="py-1.5">
                        {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                          <button
                            key={r}
                            onClick={() => changePlaybackRate(r)}
                            className={`w-full px-4 py-2 text-xs font-bold transition-all flex items-center justify-between ${
                              playbackRate === r
                                ? 'text-brand-400 bg-brand-600/10'
                                : 'text-white/80 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span>{r === 1 ? 'عادي' : `${r}x`}</span>
                            {playbackRate === r && (
                              <div className="w-1.5 h-1.5 bg-brand-400 rounded-full" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Theater Mode (desktop) */}
              {onTheaterToggle && !isFullscreen && (
                <button
                  onClick={onTheaterToggle}
                  className="text-white/60 hover:text-white transition-colors hidden lg:block p-1.5 hover:bg-white/10 rounded-lg"
                  title="وضع المسرح"
                >
                  <Tv size={18} className={isTheaterMode ? 'text-brand-400' : ''} />
                </button>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="text-white/70 hover:text-white transition-colors p-1.5 sm:p-2 hover:bg-white/10 rounded-lg active:scale-90"
                title="ملء الشاشة"
              >
                {isFullscreen ? (
                  <Minimize size={mobile ? 18 : 20} />
                ) : (
                  <Maximize size={mobile ? 18 : 20} />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Click away to close speed menu */}
      {showSpeedMenu && (
        <div className="absolute inset-0 z-35" onClick={() => setShowSpeedMenu(false)} />
      )}
    </div>
  );
};
