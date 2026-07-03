import crypto from 'crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { Request, Response, NextFunction } from 'express';

// ─── Rate Limiter (In-Memory) ──────────────────────────────────
interface RateLimitEntry { count: number; resetAt: number; }
const rateLimitStore = new Map<string, RateLimitEntry>();

export function rateLimit(opts: { windowMs: number; max: number; keyBy?: 'ip' | 'userId' }) {
  return (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const key = (opts.keyBy === 'userId' ? (req.userId || req.ip) : req.ip) || 'unknown';
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > opts.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: 'Too many requests. Please try again later.', retryAfter });
    }
    next();
  };
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// Pre-configured limiters
export const apiLimiter = rateLimit({ windowMs: 60_000, max: 100 });
export const strictLimiter = rateLimit({ windowMs: 60_000, max: 10 });
export const authLimiter = rateLimit({ windowMs: 60_000, max: 5 });

// ─── Password Hashing (scrypt) ─────────────────────────────────
const SALT_LENGTH = 32;
const HASH_LENGTH = 64;

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_LENGTH);
    crypto.scrypt(password, salt, HASH_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

export function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [saltHex, hashHex] = storedHash.split(':');
    if (!saltHex || !hashHex) return resolve(false);
    const salt = Buffer.from(saltHex, 'hex');
    const hash = Buffer.from(hashHex, 'hex');
    crypto.scrypt(password, salt, HASH_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(derivedKey, hash));
    });
  });
}

// ─── Firebase Admin (lazy singleton) ────────────────────────────
let db: Firestore | null = null;

export function getAdminDb(): Firestore | null {
  if (!db) {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.log('Initializing Firebase Admin SDK...');
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({ credential: cert(serviceAccount) });
        db = getFirestore();
        console.log('Firebase Admin SDK Initialized.');
      } else {
        console.error('CRITICAL: FIREBASE_SERVICE_ACCOUNT environment variable is missing!');
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
    }
  }
  return db;
}

// ─── Auth Middleware ────────────────────────────────────────────
export const authenticateUser = async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const adminDb = getAdminDb();
    if (!adminDb) return res.status(500).json({ error: 'DB error' });

    const decodedToken = await getAuth().verifyIdToken(token);
    req.userId = decodedToken.uid;
    next();
  } catch (error) {
    console.error('Authentication Error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── Utility Helpers ────────────────────────────────────────────
export function cleanData<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const newObj = { ...obj };
  (Object.keys(newObj) as Array<keyof T>).forEach(key => {
    if (newObj[key] === undefined) delete newObj[key];
  });
  return newObj;
}

export function extractVideoId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
  return match ? match[1] : url;
}

export function getGoogleDriveDownloadUrl(url: string): string {
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch?.[1]) return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch?.[1]) return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
  return url;
}

// ─── Stripe (lazy singleton) ────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stripeClient: any = null;

export async function getStripe() {
  if (!stripeClient) {
    const Stripe = (await import('stripe')).default;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.warn('STRIPE_SECRET_KEY missing. Stripe will not work.');
      return new Stripe('dummy_key', { apiVersion: '2026-02-25.clover' });
    }
    stripeClient = new Stripe(key, { apiVersion: '2026-02-25.clover' });
  }
  return stripeClient;
}
