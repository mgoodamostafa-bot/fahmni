import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSettings } from '../../../contexts/SettingsContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';

interface TransparentTeacherImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

const TransparentTeacherImage: React.FC<TransparentTeacherImageProps> = ({ src, alt, className, style }) => {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!src || processingRef.current) return;

    // Check sessionStorage cache first
    const cacheKey = `bg_removed_v2_${btoa(src).slice(0, 50)}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setProcessedSrc(cached);
      return;
    }

    processingRef.current = true;

    // Process in background after a short delay
    const timer = setTimeout(() => {
      let imageSrc = src;
      const isLocalhost = window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1';
      
      if (isLocalhost && src.startsWith('http')) {
        imageSrc = `https://api.allorigins.win/raw?url=${encodeURIComponent(src)}`;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageSrc;

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) { processingRef.current = false; return; }

          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;

          // Sample background color from corners
          const sampleCorner = (sx: number, sy: number) => {
            const idx = (sy * width + sx) * 4;
            return [data[idx], data[idx + 1], data[idx + 2]];
          };

          const [r1, g1, b1] = sampleCorner(Math.max(0, width - 10), Math.min(height - 1, 10));
          const [r2, g2, b2] = sampleCorner(Math.min(width - 1, 10), 10);
          const avgR = (r1 + r2) / 2;
          const avgG = (g1 + g2) / 2;
          const avgB = (b1 + b2) / 2;

          const isBg = (r: number, g: number, b: number) => {
            const dist = Math.sqrt((r - avgR) ** 2 + (g - avgG) ** 2 + (b - avgB) ** 2);
            return dist < 30; // Very strict threshold to avoid eating into shirts
          };

          // BFS Flood Fill from borders
          const visited = new Uint8Array(width * height);
          const queue: number[] = [];

          for (let x = 0; x < width; x++) { queue.push(x, 0); visited[x] = 1; }
          for (let y = 1; y < height; y++) {
            queue.push(0, y); visited[y * width] = 1;
            queue.push(width - 1, y); visited[y * width + (width - 1)] = 1;
          }

          let head = 0;
          while (head < queue.length) {
            const cx = queue[head++];
            const cy = queue[head++];
            const idx = (cy * width + cx) * 4;

            if (data[idx + 3] === 0) continue;

            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            if (isBg(r, g, b)) {
              const dist = Math.sqrt((r - avgR) ** 2 + (g - avgG) ** 2 + (b - avgB) ** 2);
              if (dist < 15) {
                data[idx + 3] = 0;
              } else {
                data[idx + 3] = Math.min(data[idx + 3], Math.floor(((dist - 15) / 15) * 255));
              }

              const neighbors = [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
              for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const nIdx = ny * width + nx;
                  if (!visited[nIdx]) { visited[nIdx] = 1; queue.push(nx, ny); }
                }
              }
            }
          }

          ctx.putImageData(imageData, 0, 0);

          // Crop to content
          let minX = width, minY = height, maxX = 0, maxY = 0;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              if (data[(y * width + x) * 4 + 3] > 10) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
              }
            }
          }

          let resultUrl: string;
          if (maxX >= minX && maxY >= minY) {
            const cw = maxX - minX + 1, ch = maxY - minY + 1;
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cw; cropCanvas.height = ch;
            const cropCtx = cropCanvas.getContext('2d');
            if (cropCtx) {
              cropCtx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
              resultUrl = cropCanvas.toDataURL('image/png');
            } else {
              resultUrl = canvas.toDataURL('image/png');
            }
          } else {
            resultUrl = canvas.toDataURL('image/png');
          }

          setProcessedSrc(resultUrl);
          try { sessionStorage.setItem(cacheKey, resultUrl); } catch {}
          processingRef.current = false;
        } catch (err) {
          console.warn('BG removal error:', err);
          setHasError(true);
          processingRef.current = false;
        }
      };

      img.onerror = () => { 
        setHasError(true);
        processingRef.current = false; 
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [src]);

  return (
    <motion.img
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      src={processedSrc || src}
      alt={alt}
      className={`${className || ''}`}
      style={{
        ...style,
        mixBlendMode: processedSrc ? 'normal' : 'multiply',
        transition: 'opacity 0.3s ease',
      }}
      loading="eager"
    />
  );
};

export const SingleTeacherHero: React.FC = () => {
  const { settings } = useSettings();
  const { user } = useAuth();
  const { tenantData } = useTenant();
  const navigate = useNavigate();

  const teacherName = tenantData?.teacherName || settings.displayName || settings.teacherName || 'أ/ أحمد عبدالمعنم';
  const subject = tenantData?.subject || settings.subject || 'الفيزياء';
  const teacherPhoto = tenantData?.teacherPhoto || settings.teacherPhotoUrl || 'https://i.ibb.co/LdQzHhS/teacher-cartoon.png';

  // Dynamic primary background color from tenant config or settings
  const primaryColor = tenantData?.primaryColor || settings.fruitTheme || '#ff7b1b';

  return (
    <div className="w-full bg-[#000000] text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8 relative overflow-visible" dir="rtl">
      <div className="max-w-7xl mx-auto">
        
        {/* Main Hero Banner with dynamic theme color background */}
        <div 
          style={{ backgroundColor: 'var(--brand-primary, #ff7b1b)' }}
          className="relative rounded-[2.5rem] md:rounded-[3rem] px-8 py-10 sm:p-14 md:p-16 flex flex-col md:flex-row items-center md:items-stretch justify-between min-h-[340px] md:min-h-[420px] overflow-visible shadow-2xl shadow-brand-500/10"
        >
          
          {/* Text Content */}
          <div className="flex-1 flex flex-col justify-center space-y-6 text-right z-10 md:pr-4">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight">
                {teacherName}
              </h1>

              <div className="space-y-3 font-black text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
                <p className="opacity-95">{tenantData?.heroTitle1 || settings.heroTitle1 || 'مستقبلك قرار ...'}</p>
                <p>
                  {tenantData?.heroTitle2 || settings.heroTitle2 || (
                    <>تقفيل <span className="underline decoration-wavy decoration-white/55 decoration-2">{subject}</span> معانا إجبار</>
                  )}
                </p>
                <div className="flex items-center gap-3">
                  <span>{tenantData?.heroTitle3 || settings.heroTitle3 || 'مش اختيار'}</span>
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="inline-block"
                  >
                    💪
                  </motion.span>
                </div>
              </div>
            </motion.div>

            <p className="text-white/80 text-sm sm:text-base font-semibold max-w-lg leading-relaxed">
              {tenantData?.heroDescription || settings.heroDescription || 'تعلم ببساطة مع أقوى الشروحات، الامتحانات التفاعلية، والمتابعة الدورية للوصول للدرجة النهائية.'}
            </p>
          </div>

          {/* Teacher Photo */}
          <div className="relative md:absolute md:bottom-0 md:left-8 lg:left-16 w-72 h-80 sm:w-80 sm:h-[400px] md:w-[380px] md:h-[460px] lg:w-[420px] lg:h-[500px] mt-8 md:mt-0 flex items-end justify-center overflow-visible z-20">
            {teacherPhoto ? (
              <TransparentTeacherImage
                src={teacherPhoto}
                alt={teacherName}
                className="h-full w-auto object-contain object-bottom pointer-events-none transition-transform duration-300 hover:scale-105"
                style={{ height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain', objectPosition: 'bottom' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/10 rounded-t-[2rem]">
                <span className="text-xs text-white/50 font-bold">صورة المعلم</span>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
