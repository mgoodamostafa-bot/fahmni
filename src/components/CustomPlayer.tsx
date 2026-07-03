import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  Loader2,
  RotateCcw,
  Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomPlayerProps {
  url: string;
  title?: string;
  thumbnailUrl?: string;
  onStart?: () => void;
  onProgress?: (data: { currentTime: number; duration: number }) => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export const CustomPlayer: React.FC<CustomPlayerProps> = ({
  url,
  title,
  thumbnailUrl,
  onStart,
  onProgress,
}) => {
  const [loading, setLoading] = useState(true);
  const [showPoster, setShowPoster] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

  const playerRef = useRef<any>(null);
  const containerId = useRef(`player-${Math.random().toString(36).substr(2, 9)}`);
  const progressInterval = useRef<any>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Refs for props to avoid re-initialization on parent re-renders
  const onStartRef = useRef(onStart);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  const videoId = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/
  )?.[1];

  const initPlayer = useCallback(() => {
    if (!videoId) return;
    playerRef.current = new window.YT.Player(containerId.current, {
      videoId: videoId,
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
        },
        onStateChange: (event: any) => {
          const state = event.data;
          if (state === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            setDuration(playerRef.current.getDuration());
            if (onStartRef.current) onStartRef.current();
            startProgressTracking();
          } else {
            setIsPlaying(false);
            stopProgressTracking();
          }
        },
      },
    });
  }, [videoId]);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        seekRelative(10);
      } else if (e.code === 'ArrowLeft') {
        seekRelative(-10);
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
        setIsPseudoFullscreen(false);
        document.body.classList.remove('fullscreen-active');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      stopProgressTracking();
      if (playerRef.current) playerRef.current.destroy();
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [initPlayer]);

  const startProgressTracking = () => {
    stopProgressTracking();
    progressInterval.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const time = playerRef.current.getCurrentTime();
        const dur = playerRef.current.getDuration();
        setCurrentTime(time);
        if (onProgressRef.current) onProgressRef.current({ currentTime: time, duration: dur });
      }
    }, 1000);
  };

  const stopProgressTracking = () => {
    if (progressInterval.current) clearInterval(progressInterval.current);
  };

  const togglePlay = () => {
    if (showPoster) setShowPoster(false);
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const seekRelative = (seconds: number) => {
    if (playerRef.current) {
      const newTime = playerRef.current.getCurrentTime() + seconds;
      playerRef.current.seekTo(newTime, true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    playerRef.current.seekTo(time, true);
  };

  const toggleMute = () => {
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    playerRef.current.setVolume(val);
    if (val > 0) setIsMuted(false);
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (playerRef.current) playerRef.current.setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    const container = playerContainerRef.current;
    if (!container) return;

    if (
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    ) {
      // Exit Fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      setIsPseudoFullscreen(false);
      document.body.classList.remove('fullscreen-active');
    } else {
      // Enter Fullscreen
      try {
        if (container.requestFullscreen) {
          container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          (container as any).msRequestFullscreen();
        }
      } catch (e) {
        console.error('Fullscreen failed', e);
      }

      setIsPseudoFullscreen(true);
      document.body.classList.add('fullscreen-active');
    }
  };

  const formatTime = (time: number) => {
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = Math.floor(time % 60);
    return h > 0
      ? `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
      : `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleMouseMove = () => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSpeedMenu) setIsControlsVisible(false);
    }, 2500);
  };

  return (
    <div
      ref={playerContainerRef}
      onMouseMove={handleMouseMove}
      className={`relative w-full aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl group select-none flex items-center justify-center transition-all ${isPseudoFullscreen ? 'fixed inset-0 z-[9999] rounded-none' : ''}`}
      dir="ltr"
    >
      {/* 🛑 Close Button for Pseudo Fullscreen */}
      {isPseudoFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-6 left-6 z-50 p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all border border-white/10"
        >
          <X size={24} />
        </button>
      )}

      {/* 📹 YouTube Container - Centered and Scaled to Hide Logo (Disabled in Fullscreen to prevent cropping) */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
        <div
          id={containerId.current}
          className={`transition-transform duration-500 ${isPseudoFullscreen ? 'w-full h-full scale-100' : 'w-[110%] h-[110%] scale-[1.05]'}`}
        />
      </div>

      {/* 🛡️ Guard Overlay */}
      <div
        className={`absolute inset-0 z-10 bg-transparent cursor-pointer ${!isPlaying ? 'pointer-events-none' : ''}`}
        onClick={togglePlay}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* 🎭 Poster */}
      <AnimatePresence>
        {showPoster && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20"
          >
            <img
              src={thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
              className="w-full h-full object-cover"
              alt="Cover"
            />
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={togglePlay}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-brand-blue text-white rounded-full flex items-center justify-center shadow-2xl z-30"
            >
              <Play size={32} className="fill-current ml-1" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔵 Centered Pulse Button */}
      <AnimatePresence>
        {!isPlaying && !showPoster && !loading && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="absolute z-30 pointer-events-none"
          >
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white ring-4 ring-white/10">
              <Play size={24} className="fill-current ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎨 Loading */}
      {loading && !showPoster && (
        <div className="absolute inset-0 z-20 bg-gray-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
        </div>
      )}

      {/* 🎛️ Sleek Minimal Controls */}
      <motion.div
        animate={{ opacity: isControlsVisible || !isPlaying ? 1 : 0 }}
        className="absolute inset-x-0 bottom-0 z-40 p-4 md:p-6 bg-gradient-to-t from-black/60 to-transparent pt-10"
      >
        <div className="flex flex-col gap-3">
          {/* Progress */}
          <div className="relative h-1.5 group/seek flex items-center">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full bg-white/10 rounded-full appearance-none cursor-pointer accent-brand-blue z-20 opacity-0"
            />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-white/20 rounded-full w-full" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand-blue rounded-full transition-all duration-300"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            <div
              className="absolute h-3 w-3 bg-white rounded-full border-2 border-brand-blue shadow-lg -translate-x-1/2 left-0 transition-all pointer-events-none"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="text-white hover:text-brand-blue transition-colors"
              >
                {isPlaying ? (
                  <Pause size={20} className="fill-current" />
                ) : (
                  <Play size={20} className="fill-current" />
                )}
              </button>

              <div className="flex items-center gap-2 group/vol">
                <button
                  onClick={toggleMute}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-0 group-hover/vol:w-16 transition-all duration-300 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>

              <div className="text-white/60 font-mono text-[10px] tracking-widest hidden sm:block">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="text-[10px] font-black text-white/70 hover:text-white px-2 py-1 bg-white/5 rounded-lg border border-white/10 flex items-center gap-1"
                >
                  <Settings size={12} />
                  {playbackRate}x
                </button>

                <AnimatePresence>
                  {showSpeedMenu && (
                    <motion.div className="absolute bottom-full right-0 mb-3 bg-gray-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[80px]">
                      {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                        <button
                          key={r}
                          onClick={() => changePlaybackRate(r)}
                          className={`w-full px-4 py-2 text-[10px] font-black hover:bg-white/5 transition-colors ${playbackRate === r ? 'text-brand-blue bg-brand-blue/10' : 'text-white/60'}`}
                        >
                          {r}x
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={toggleFullscreen}
                className="text-white/50 hover:text-white transition-colors"
              >
                {isPseudoFullscreen ? <Minimize size={20} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
