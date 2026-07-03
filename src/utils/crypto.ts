// ─── Client-side XOR obfuscation (basic URL hiding) ──────────
const XOR_KEY = 'fahmni_secure_salt_key_1337';

export function encryptUrl(url: string): string {
  if (!url) return '';
  try {
    let xored = '';
    const utf8Url = unescape(encodeURIComponent(url));
    for (let i = 0; i < utf8Url.length; i++) {
      const charCode = utf8Url.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length);
      xored += String.fromCharCode(charCode);
    }
    return btoa(xored);
  } catch (e) {
    console.error('Obfuscation error:', e);
    return '';
  }
}

// ─── Server-side XOR decryption (mirrors client encryptUrl) ──
export function decryptUrl(obfuscated: string): string {
  if (!obfuscated) return '';
  try {
    const xored = atob(obfuscated);
    let decoded = '';
    for (let i = 0; i < xored.length; i++) {
      const charCode = xored.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length);
      decoded += String.fromCharCode(charCode);
    }
    return decodeURIComponent(escape(decoded));
  } catch (e) {
    console.error('Decryption error:', e);
    return '';
  }
}
