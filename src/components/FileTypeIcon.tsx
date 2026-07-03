import React from 'react';
import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  File,
  Film,
  BookOpen,
} from 'lucide-react';

const FILE_TYPE_MAP: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pdf: { icon: BookOpen, color: 'text-red-400', label: 'PDF' },
  doc: { icon: FileText, color: 'text-blue-400', label: 'DOC' },
  docx: { icon: FileText, color: 'text-blue-400', label: 'DOCX' },
  ppt: { icon: Film, color: 'text-orange-400', label: 'PPT' },
  pptx: { icon: Film, color: 'text-orange-400', label: 'PPTX' },
  xls: { icon: FileSpreadsheet, color: 'text-emerald-400', label: 'XLS' },
  xlsx: { icon: FileSpreadsheet, color: 'text-emerald-400', label: 'XLSX' },
  png: { icon: FileImage, color: 'text-pink-400', label: 'PNG' },
  jpg: { icon: FileImage, color: 'text-pink-400', label: 'JPG' },
  jpeg: { icon: FileImage, color: 'text-pink-400', label: 'JPEG' },
  gif: { icon: FileImage, color: 'text-pink-400', label: 'GIF' },
  svg: { icon: FileImage, color: 'text-yellow-400', label: 'SVG' },
  mp4: { icon: FileVideo, color: 'text-purple-400', label: 'MP4' },
  mov: { icon: FileVideo, color: 'text-purple-400', label: 'MOV' },
  avi: { icon: FileVideo, color: 'text-purple-400', label: 'AVI' },
  mp3: { icon: FileAudio, color: 'text-teal-400', label: 'MP3' },
  wav: { icon: FileAudio, color: 'text-teal-400', label: 'WAV' },
  zip: { icon: FileArchive, color: 'text-yellow-400', label: 'ZIP' },
  rar: { icon: FileArchive, color: 'text-yellow-400', label: 'RAR' },
};

export function getFileExtension(url: string): string {
  const segments = url.split('/');
  const filename = segments[segments.length - 1].split('?')[0];
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

export function getFileTypeInfo(url: string) {
  const ext = getFileExtension(url);
  return (
    FILE_TYPE_MAP[ext] || { icon: File, color: 'text-gray-400', label: ext.toUpperCase() || 'FILE' }
  );
}

interface FileTypeIconProps {
  url: string;
  size?: number;
  showLabel?: boolean;
}

export function FileTypeIcon({ url, size = 20, showLabel }: FileTypeIconProps) {
  const { icon: Icon, color, label } = getFileTypeInfo(url);
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <Icon size={size} className={color} />
      {showLabel && <span className={`text-[10px] font-black ${color}`}>{label}</span>}
    </span>
  );
}
