import React, { useState } from 'react';
import { Download, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { FileTypeIcon, getFileExtension } from './FileTypeIcon';
import {
  downloadFile,
  formatFileSize,
  formatSpeed,
  formatTimeRemaining,
  getDownloadFilename,
  type DownloadProgress,
} from '../utils/download';

interface FileCardProps {
  url: string;
  title: string;
  subject?: string;
  size?: number;
  createdAt?: Date;
  showProgress?: boolean;
  className?: string;
  onDownloadComplete?: () => void;
}

export const FileCard: React.FC<FileCardProps> = ({
  url,
  title,
  subject,
  size,
  showProgress = true,
  className = '',
  onDownloadComplete,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'complete' | 'error'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadState('downloading');
    setError(null);
    setProgress(null);

    const filename = getDownloadFilename(url, title);

    try {
      await downloadFile(url, {
        filename,
        onProgress: showProgress ? setProgress : undefined,
        onComplete: () => {
          setDownloadState('complete');
          onDownloadComplete?.();
          setTimeout(() => setDownloadState('idle'), 2000);
        },
        onError: (err) => {
          setDownloadState('error');
          setError(err.message);
          setTimeout(() => setDownloadState('idle'), 3000);
        },
      });
    } catch (err) {
      setDownloadState('error');
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
      setTimeout(() => setDownloadState('idle'), 3000);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpen = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const ext = getFileExtension(url);

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
      className={`group bg-white/5 border border-white/10 rounded-[2rem] p-6 hover:bg-white/8 hover:border-brand-blue/30 transition-all shadow-xl relative overflow-hidden flex flex-col h-full ${className}`}
    >
      {/* Background glow on hover */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-brand-blue/5 blur-3xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex flex-col gap-4 h-full">
        {/* File Icon */}
        <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500 shrink-0">
          <FileTypeIcon url={url} size={28} showLabel />
        </div>

        {/* File Info */}
        <div className="space-y-1 flex-1">
          <h3 className="text-lg font-black text-white line-clamp-2 leading-tight group-hover:text-brand-blue transition-colors">
            {title}
          </h3>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">
            {subject || 'ملف تعليمي'}
          </p>
          {size && (
            <p className="text-[10px] font-bold text-gray-600 mt-1">{formatFileSize(size)}</p>
          )}
        </div>

        {/* Download Progress */}
        {isDownloading && progress && showProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">{Math.round(progress.percentage)}%</span>
              <span className="text-gray-500">{formatSpeed(progress.speed)}</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress.percentage}%` }}
                className="h-full bg-brand-blue rounded-full"
              />
            </div>
            <p className="text-[10px] text-gray-500 text-center">
              متبقي {formatTimeRemaining(progress.remainingTime)}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 mt-auto flex items-center gap-3 shrink-0">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`flex-1 font-black py-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all ${
              downloadState === 'complete'
                ? 'bg-emerald-500/20 text-emerald-400'
                : downloadState === 'error'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-brand-blue/10 hover:bg-brand-blue text-brand-blue hover:text-white'
            }`}
          >
            {downloadState === 'downloading' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>جاري التحميل...</span>
              </>
            ) : downloadState === 'complete' ? (
              <>
                <CheckCircle2 size={14} />
                <span>تم التحميل</span>
              </>
            ) : downloadState === 'error' ? (
              <>
                <AlertCircle size={14} />
                <span>خطأ</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>تحميل الملف</span>
              </>
            )}
          </button>

          <button
            onClick={handleOpen}
            className="p-3 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            title="فتح الملف"
          >
            <ExternalLink size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
