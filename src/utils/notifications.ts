/**
 * Push Notifications Utility
 * Handles FCM (Firebase Cloud Messaging) for web push notifications
 */

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from '../lib/firebase';

// VAPID key from Firebase Console
const getVapidKey = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as any).VITE_FIREBASE_VAPID_KEY !== undefined) {
    return (import.meta.env as any).VITE_FIREBASE_VAPID_KEY;
  }
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY !== undefined) {
    return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  }
  return '';
};

const VAPID_KEY = getVapidKey();

let messaging: ReturnType<typeof getMessaging> | null = null;

// Initialize messaging
const getMessagingInstance = () => {
  if (!messaging && app) {
    try {
      messaging = getMessaging(app);
    } catch (error) {
      console.error('Failed to initialize messaging:', error);
    }
  }
  return messaging;
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

// Get FCM token
export const getFCMToken = async (): Promise<string | null> => {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance || !VAPID_KEY) {
    console.log('Messaging not available or VAPID key missing');
    return null;
  }

  try {
    const token = await getToken(messagingInstance, { vapidKey: VAPID_KEY });
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return null;
  }
};

// Listen for foreground messages
export const onForegroundMessage = (callback: (payload: unknown) => void) => {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) return;

  onMessage(messagingInstance, (payload) => {
    console.log('Foreground message:', payload);
    callback(payload);
  });
};

// Show local notification
export const showNotification = (title: string, options?: NotificationOptions) => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      ...options,
    });
  }
};

// Notification types for the app
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'enrollment' | 'lesson' | 'exam' | 'message' | 'system';
  read: boolean;
  createdAt: Date;
  data?: Record<string, string>;
}

// Create notification from different types
export const createNotification = (
  type: AppNotification['type'],
  data: { title: string; body: string; [key: string]: string }
): AppNotification => ({
  id: crypto.randomUUID(),
  type,
  title: data.title,
  body: data.body,
  read: false,
  createdAt: new Date(),
  data,
});
