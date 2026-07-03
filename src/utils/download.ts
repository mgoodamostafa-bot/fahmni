/**
 * File Download Utility
 * Handles file downloads with progress tracking and error handling
 */

export interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
}

export interface DownloadOptions {
  filename?: string;
  onProgress?: (progress: DownloadProgress) => void;
  onComplete?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

// Format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Format download speed
export const formatSpeed = (bytesPerSecond: number): string => {
  return `${formatFileSize(bytesPerSecond)}/s`;
};

// Format time remaining
export const formatTimeRemaining = (seconds: number): string => {
  if (seconds < 60) return `${Math.ceil(seconds)} ثانية`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} دقيقة`;
  return `${Math.ceil(seconds / 3600)} ساعة`;
};

// Get file extension from URL
export const getFileExtension = (url: string): string => {
  const segments = url.split('/');
  const filename = segments[segments.length - 1].split('?')[0];
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

// Get MIME type from extension
export const getMimeType = (extension: string): string => {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    txt: 'text/plain',
  };
  return mimeTypes[extension] || 'application/octet-stream';
};

// Download file with progress tracking
export const downloadFile = async (url: string, options: DownloadOptions = {}): Promise<void> => {
  const { filename, onProgress, onComplete, onError, signal } = options;

  try {
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    const startTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      loaded += value.length;

      if (onProgress && total > 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = loaded / elapsed;
        const percentage = (loaded / total) * 100;
        const remainingTime = (total - loaded) / speed;

        onProgress({
          loaded,
          total,
          percentage,
          speed,
          remainingTime,
        });
      }
    }

    const mimeType = response.headers.get('content-type') || 'application/pdf';
    const blob = new Blob(chunks, { type: mimeType });

    // Create download link
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    // Determine filename
    if (filename) {
      link.download = filename;
    } else {
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          link.download = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      if (!link.download) {
        const ext = getFileExtension(url);
        link.download = `download${ext ? `.${ext}` : ''}`;
      }
    }

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(downloadUrl);

    if (onComplete) {
      onComplete(blob);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Download cancelled');
      return;
    }
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
};

// Helper to extract Google Drive File ID
const getGoogleDriveFileId = (url: string): string | null => {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return null;
};

// Download directly (formerly proxy endpoint)
export const downloadViaProxy = async (
  fileUrl: string,
  filename?: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> => {
  try {
    // Handle Google Drive Links
    if (fileUrl.includes('drive.google.com')) {
      const fileId = getGoogleDriveFileId(fileUrl);
      if (fileId) {
        const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const link = document.createElement('a');
        link.href = directUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
    }

    // Handle Dropbox Links
    if (fileUrl.includes('dropbox.com')) {
      const directUrl = fileUrl.replace('dl=0', 'dl=1');
      const link = document.createElement('a');
      link.href = directUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Try downloading directly via blob
    await downloadFile(fileUrl, {
      filename,
      onProgress,
    });
  } catch (error) {
    console.error('Direct download failed (possibly CORS), falling back to new tab:', error);
    // Fallback: open in new tab
    const link = document.createElement('a');
    link.href = fileUrl;
    link.target = '_blank';
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Check if file is downloadable
export const isDownloadable = (url: string): boolean => {
  const nonDownloadableExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
  const ext = getFileExtension(url);
  return !nonDownloadableExtensions.includes(ext);
};

// Get download filename from URL and title
export const getDownloadFilename = (url: string, title?: string): string => {
  const ext = getFileExtension(url);
  if (title) {
    const sanitizedTitle = title.replace(/[<>:"/\\|?*]/g, '_');
    return ext ? `${sanitizedTitle}.${ext}` : sanitizedTitle;
  }
  const segments = url.split('/');
  const filename = segments[segments.length - 1].split('?')[0];
  return filename || `download${ext ? `.${ext}` : ''}`;
};
