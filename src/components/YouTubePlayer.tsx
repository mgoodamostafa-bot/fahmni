import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  SkipForward,
  SkipBack,
  Settings,
  Info,
  Chrome,
} from 'lucide-react';

interface YouTubePlayerProps {
  url: string;
  title?: string;
  posterUrl?: string; // 🖼️ New Prop for clean covers
  onEnd?: () => void;
  onNext?: () => void;
  onQuiz?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  url,
  posterUrl,
  onEnd,
  onNext,
  onQuiz,
  onTimeUpdate,
  title,
}) => {
  const { profile } = useAuth();
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [watermarkPos, setWatermarkPos] = useState({ top: '20%', left: '20%' });
  const [isHovering, setIsHovering] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

  const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const videoId = getYoutubeId(url);
  const defaultPoster = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      playerRef.current = new window.YT.Player(`youtube-player-${videoId}`, {
        videoId: videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          enablejsapi: 1,
          origin: window.location.origin,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            setIsReady(true);
            setDuration(event.target.getDuration());
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setHasStarted(true);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            }
            if (event.data === window.YT.PlayerState.ENDED && onEnd) onEnd();
          },
        },
      });
    };

    if (window.YT && window.YT.Player) initPlayer();
    else window.onYouTubeIframeAPIReady = initPlayer;

    const watermarkInterval = setInterval(() => {
      setWatermarkPos({
        top: `${Math.random() * 70 + 15}%`,
        left: `${Math.random() * 60 + 10}%`,
      });
    }, 45000);

    const progressInterval = setInterval(() => {
      if (playerRef.current?.getCurrentTime && isPlaying) {
        const cur = playerRef.current.getCurrentTime();
        setCurrentTime(cur);
        if (onTimeUpdate) onTimeUpdate(cur, duration);
      }
    }, 400);

    return () => {
      clearInterval(watermarkInterval);
      clearInterval(progressInterval);
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [videoId]);

  const togglePlay = () => {
    if (!isReady || !playerRef.current) return;
    isPlaying ? playerRef.current.pauseVideo?.() : playerRef.current.playVideo?.();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    playerRef.current?.seekTo?.(time, true);
  };

  const skip = (seconds: number) => {
    const newTime = Math.min(Math.max(0, currentTime + seconds), duration);
    setCurrentTime(newTime);
    playerRef.current?.seekTo?.(newTime, true);
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute?.();
      playerRef.current.setVolume?.(volume || 50);
      setIsMuted(false);
    } else {
      playerRef.current.mute?.();
      setIsMuted(true);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    if (isIOS) {
      // iPhone doesn't support standard Fullscreen API on non-video elements
      setIsPseudoFullscreen(!isPseudoFullscreen);
      return;
    }

    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    } else {
      containerRef.current
        .requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch((err) => {
          console.error('Fullscreen error:', err);
          setIsPseudoFullscreen(true); // Fallback to pseudo
        });
    }
  };

  // Sync state with browser fullscreen changes
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-video bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl group border border-white/5 font-sans select-none transition-all duration-300 ${isPseudoFullscreen ? 'fixed inset-0 z-[9999] rounded-0 !h-screen !w-screen' : ''}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        if (isPlaying) setShowControls(false);
      }}
      onMouseMove={() => setShowControls(true)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 📹 CORE VIDEO LAYER */}
      <div className="absolute inset-0 z-0">
        <div id={`youtube-player-${videoId}`} className="w-full h-full scale-[1.01]" />
      </div>

      {/* 🛡️ INTERACTION SHIELD & SEEK ZONES */}
      <div className={`absolute inset-0 z-20 flex ${!hasStarted ? 'pointer-events-none' : ''}`}>
        <div
          className="w-[30%] h-full cursor-pointer"
          onDoubleClick={() => skip(-10)}
          onClick={togglePlay}
        />
        <div className="flex-1 h-full cursor-pointer" onClick={togglePlay} />
        <div
          className="w-[30%] h-full cursor-pointer"
          onDoubleClick={() => skip(10)}
          onClick={togglePlay}
        />
      </div>

      {/* 💎 MINIMALIST WATERMARK */}
      {hasStarted && (
        <motion.div
          animate={{ top: watermarkPos.top, left: watermarkPos.left }}
          transition={{ duration: 2, ease: 'linear' }}
          className="absolute z-50 pointer-events-none opacity-20 text-white font-black text-[10px] tracking-widest whitespace-nowrap select-none drop-shadow-md"
        >
          {profile?.studentId || 'VIP STUDENT'} | FAHMNI
        </motion.div>
      )}

      {/* 🎛️ PREMIUM MINIMALIST CONTROLS */}
      <AnimatePresence>
        {(showControls || !isPlaying) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-end"
          >
            {/* Bottom Glass Bar */}
            <div className="p-6 sm:p-10 pointer-events-auto bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent">
              {/* Thin Emerald Progress Bar */}
              <div className="relative h-1 w-full bg-white/10 rounded-full mb-6 cursor-pointer group/seek overflow-hidden">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div
                  className="absolute left-0 top-0 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-300"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button
                    onClick={togglePlay}
                    className="text-white hover:scale-110 active:scale-95 transition-all"
                  >
                    {isPlaying ? (
                      <Pause size={24} strokeWidth={1.5} />
                    ) : (
                      <Play size={24} strokeWidth={1.5} fill="white" />
                    )}
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold text-xs">{formatTime(currentTime)}</span>
                    <span className="text-white/20 font-bold text-xs">/</span>
                    <span className="text-white/40 font-bold text-xs">{formatTime(duration)}</span>
                  </div>

                  <div className="flex items-center gap-3 group/vol ml-4">
                    <button
                      onClick={toggleMute}
                      className="text-white/40 hover:text-white transition-colors"
                    >
                      {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-500">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          setVolume(v);
                          playerRef.current?.setVolume?.(v);
                        }}
                        className="w-full accent-white h-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {onNext && (
                    <button
                      onClick={onNext}
                      className="h-10 px-6 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 flex items-center gap-2"
                    >
                      التالي <SkipForward size={14} />
                    </button>
                  )}

                  <button
                    onClick={toggleFullscreen}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    {isFullscreen || isPseudoFullscreen ? (
                      <RotateCcw size={18} strokeWidth={1.5} />
                    ) : (
                      <Maximize size={18} strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🖼️ POSTER COVER & PLAY BUTTON */}
      {!isPlaying && currentTime === 0 && (
        <div className="absolute inset-0 z-40 bg-slate-950 flex items-center justify-center transition-all duration-700">
          {/* High-Quality Poster */}
          <img
            src={posterUrl || defaultPoster}
            alt=" حصه فيديو"
            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[2s]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40" />

          {/* Minimalist Centered Play Button */}
          <motion.button
            onClick={togglePlay}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="relative z-10 w-20 h-20 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 flex items-center justify-center text-white shadow-2xl transition-all"
          >
            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-20" />
            <Play fill="white" size={32} className="ml-1.5" />
          </motion.button>

          <div className="absolute bottom-10 inset-x-0 text-center">
            <h2 className="text-white font-black text-xl mb-2 tracking-tight drop-shadow-lg">
              {title || 'حصة تعليمية آمنة'}
            </h2>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Premium Learning
              Experience
            </p>
          </div>
        </div>
      )}

      {/* ⌛ SYNC STATE */}
      {!isReady && (
        <div className="absolute inset-0 z-[60] bg-slate-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 border-2 border-white/10 rounded-full" />
              <div className="absolute inset-0 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">
              Initializing Premium View...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
