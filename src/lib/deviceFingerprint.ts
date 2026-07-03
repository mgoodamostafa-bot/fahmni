import FingerprintJS from '@fingerprintjs/fingerprintjs';

/**
 * 🔒 Hardware Fingerprinting Utility
 * Generates unique device IDs to prevent account sharing.
 */

export const getFingerprint = async (): Promise<string> => {
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId;
  } catch (error) {
    console.error('Fingerprint generation failed:', error);
    return 'fallback-id-' + Math.random().toString(36).substring(7);
  }
};

/**
 * 🌐 Public IP Retrieval with Strict Timeout
 */
export const getPublicIP = async (timeoutMs: number = 3000): Promise<string> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(id);
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.warn('IP lookup timed out or failed, using local fallback:', error);
    return 'unknown-ip';
  }
};

/**
 * 📱 Device Info Name
 */
export const getDeviceName = (): string => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android Device';
  if (/iPad|iPhone|iPod/.test(ua)) return 'iOS Device';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Macintosh/i.test(ua)) return 'MacBook/Desktop';
  return 'Desktop Browser';
};
