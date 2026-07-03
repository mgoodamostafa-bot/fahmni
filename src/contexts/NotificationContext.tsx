import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { 
  collection, query, where, orderBy, onSnapshot, 
  addDoc, updateDoc, doc, deleteDoc, Timestamp, limit, setDoc 
} from 'firebase/firestore';
import { getTenantDb } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';

interface Notification {
  id: string;
  userId?: string;
  targetGroupId?: 'all' | string; // courseId or 'all'
  targetGrade?: string; // Optional grade target
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  targetRole?: 'all' | 'student' | 'teacher';
  createdAt: any;
  link?: string;
  senderName?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  sendNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  newNotification: Notification | null;
  clearNewNotification: (andMarkRead?: boolean) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // Tone 1 (G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now); // G5
    gain1.gain.setValueAtTime(0.04, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);
    
    // Tone 2 (C6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now + 0.08); // C6
    gain2.gain.setValueAtTime(0.04, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.45);
  } catch (err) {
    console.warn('Audio chime autoplay blocked or failed:', err);
  }
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const { tenantId } = useTenant();
  const [rawNotifications, setRawNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNotification, setNewNotification] = useState<Notification | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const [upperEnrollments, setUpperEnrollments] = useState<string[]>([]);
  const [lowerEnrollments, setLowerEnrollments] = useState<string[]>([]);

  // 1. Listen to active enrollments (Checking both collections)
  useEffect(() => {
    if (!user) {
      setUpperEnrollments([]);
      setLoading(false);
      return;
    }

    // 🛡️ EMERGENCY FAIL-SAFE: Force unfreeze notifications after 3 seconds
    const forceUnfreeze = setTimeout(() => {
      setLoading(false);
      console.warn("Notifications: Force unfreeze triggered due to timeout.");
    }, 3000);

    const unsub = onSnapshot(query(collection(getTenantDb(), 'Enrollments'), where('userId', '==', user.uid)), (snap) => {
      setUpperEnrollments(snap.docs.filter(d => !d.data().status || d.data().status === 'active').map(d => d.data().courseId));
      setLoading(false);
      clearTimeout(forceUnfreeze);
    }, (error) => {
      console.error("Error listening to enrollments:", error);
      setLoading(false);
      clearTimeout(forceUnfreeze);
    });

    return () => {
      unsub();
      clearTimeout(forceUnfreeze);
    };
  }, [user, tenantId]);

  useEffect(() => {
    if (!user) {
      setLowerEnrollments([]);
      return;
    }
    return onSnapshot(query(collection(getTenantDb(), 'enrollments'), where('userId', '==', user.uid)), (snap) => {
      setLowerEnrollments(snap.docs.filter(d => !d.data().status || d.data().status === 'active').map(d => d.data().courseId));
    });
  }, [user, tenantId]);

  const enrolledCourseIds = useMemo(() => {
    return Array.from(new Set([...upperEnrollments, ...lowerEnrollments]));
  }, [upperEnrollments, lowerEnrollments]);

  // 2. Listen to read statuses
  useEffect(() => {
    if (!user) {
      setReadIds(new Set());
      return;
    }
    const q = query(collection(getTenantDb(), 'notification_reads'), where('userId', '==', user.uid));
    return onSnapshot(q, (snap) => {
      setReadIds(new Set(snap.docs.map(doc => doc.data().notificationId)));
    });
  }, [user, tenantId]);

  // 3. Listen to notifications raw stream
  useEffect(() => {
    if (!user) {
      setRawNotifications([]);
      setLoading(false);
      return;
    }

    const q = query(collection(getTenantDb(), 'notifications'), orderBy('createdAt', 'desc'), limit(50));
    
    return onSnapshot(q, (snapshot) => {
      const allNotifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];
      
      setRawNotifications(allNotifs);
      setLoading(false);
      setIsFirstLoad(false);
    });
  }, [user, tenantId]);

  // 4. Derive filtered notifications
  const notifications = useMemo(() => {
    const finalEnrolledCourseIds = Array.from(new Set([...enrolledCourseIds, ...(profile?.enrolledCourses || [])]));
    const lowerEnrolledIds = finalEnrolledCourseIds.map(id => id.toLowerCase());

    return rawNotifications.map(n => ({
      ...n,
      read: readIds.has(n.id)
    })).filter(n => {
      const isTargetedUser = n.userId === user?.uid;
      const isGlobalAll = n.targetGroupId === 'all';
      const isCourseTargeted = n.targetGroupId && lowerEnrolledIds.includes(n.targetGroupId.toLowerCase());
      const matchesGrade = !n.targetGrade || n.targetGrade === profile?.grade;
      const userRole = profile?.role || 'student';
      const isRoleTargeted = !n.targetRole || n.targetRole === 'all' || n.targetRole === userRole;
      
      return isTargetedUser || (isRoleTargeted && (isGlobalAll || isCourseTargeted) && matchesGrade);
    });
  }, [rawNotifications, readIds, enrolledCourseIds, profile, user]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  // 5. Toast / New Notification logic (Separated from Firestore subscription)
  const prevNotifIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isFirstLoad || rawNotifications.length === 0 || !user) {
      if (rawNotifications.length > 0) {
        prevNotifIdsRef.current = new Set(rawNotifications.map(n => n.id));
      }
      return;
    }
    
    const finalEnrolledCourseIds = Array.from(new Set([...enrolledCourseIds, ...(profile?.enrolledCourses || [])]));
    const lowerEnrolledIds = finalEnrolledCourseIds.map(id => id.toLowerCase());
    const currentRole = profile?.role;
    const userRole = currentRole || 'student';

    rawNotifications.forEach((n) => {
      if (!prevNotifIdsRef.current.has(n.id)) {
        const isRoleTargeted = !n.targetRole || n.targetRole === 'all' || n.targetRole === userRole;
        const matchesCourse = n.targetGroupId && lowerEnrolledIds.includes(n.targetGroupId.toLowerCase());
        const matchesGrade = !n.targetGrade || n.targetGrade === profile?.grade;
        
        const isTargeted = n.userId === user.uid || 
          (isRoleTargeted && (n.targetGroupId === 'all' || matchesCourse) && matchesGrade);
        
        if (isTargeted && !readIds.has(n.id)) {
          setNewNotification({ ...n, read: false });
          playNotificationSound();
          // Mark as read immediately when shown as toast
          markAsRead(n.id);
        }
      }
    });

    prevNotifIdsRef.current = new Set(rawNotifications.map(n => n.id));
  }, [rawNotifications, user, profile, enrolledCourseIds, readIds, isFirstLoad]);

  const sendNotification = async (notif: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    await addDoc(collection(getTenantDb(), 'notifications'), {
      ...notif,
      createdAt: Timestamp.now()
    });
  };

  const markAsRead = async (id: string) => {
    if (!user) return;
    try {
      const readId = `${user.uid}_${id}`;
      await setDoc(doc(getTenantDb(), 'notification_reads', readId), {
        userId: user.uid,
        notificationId: id,
        readAt: Timestamp.now()
      });
    } catch (e) {
      console.error("Error marking notification as read", e);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unread = notifications.filter(n => !n.read);
    const promises = unread.map(n => {
      const readId = `${user.uid}_${n.id}`;
      return setDoc(doc(getTenantDb(), 'notification_reads', readId), {
        userId: user.uid,
        notificationId: n.id,
        readAt: Timestamp.now()
      });
    });
    await Promise.all(promises);
  };

  const deleteNotification = async (id: string) => {
    // Only admins should really do this, but keeping it for now
    await deleteDoc(doc(getTenantDb(), 'notifications', id));
  };

  const clearNewNotification = (andMarkRead: boolean = true) => {
    if (andMarkRead && newNotification) {
      markAsRead(newNotification.id);
    }
    setNewNotification(null);
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, unreadCount, loading, 
      sendNotification, markAsRead, markAllAsRead, deleteNotification,
      newNotification, clearNewNotification,
      isDrawerOpen, setIsDrawerOpen
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
