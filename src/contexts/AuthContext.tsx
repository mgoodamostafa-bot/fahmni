import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { getTenantAuth, getTenantDb } from '../lib/firebase';
import { useTenant } from './TenantContext';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | 'teacher' | 'admin';
  isOwner?: boolean; // true if this user is the platform owner (first registered / admin)
  createdAt: string;
  imageUrl?: string;
  photoURL?: string;
  points?: number;
  walletBalance?: number;
  totalEarnings?: number;
  teacherTitle?: string;
  teacherName?: string;
  studentId?: string;
  studentCode?: string;
  level?: string;
  grade?: string;
  isCenterStudent?: boolean;
  accountStatus?: 'active' | 'blocked';
  devices?: any[];
  maxDevicesAllowed?: number;
  enrolledCourses?: string[];
  defaultCommission?: number;
  balance?: number;
  school?: string;
  studentPhone?: string;
  fatherPhone?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileHanging: boolean;
  deviceLocked: boolean;
  accountBlocked: boolean;
  needsGradeSelection: boolean;
  authError: string | null;
  isOwner: boolean; // convenience: true if current user is the platform owner
  logout: () => Promise<void>;
  forceRefreshProfile: () => void;
  authLogs: string[];
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  profileHanging: false,
  deviceLocked: false,
  accountBlocked: false,
  needsGradeSelection: false,
  authError: null,
  isOwner: false,
  logout: async () => {},
  forceRefreshProfile: () => {},
  authLogs: [],
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading: isTenantLoading } = useTenant();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileHanging, setProfileHanging] = useState(false);
  const [deviceLocked, setDeviceLocked] = useState(false);
  const [accountBlocked, setAccountBlocked] = useState(false);
  const [needsGradeSelection, setNeedsGradeSelection] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const authLogsRef = React.useRef<string[]>([]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    const logMsg = `[AUTH_DIAG] ${time}: ${msg}`;
    console.log(logMsg);
    authLogsRef.current.push(`${time}: ${msg}`);
  };

  const logout = async () => {
    addLog("Logging out...");
    await signOut(getTenantAuth());
  };

  const forceRefreshProfile = async () => {
    if (!user) {
      addLog("forceRefreshProfile called but user is null");
      return;
    }
    addLog(`forceRefreshProfile starting for UID: ${user.uid}`);
    try {
      const docRef = doc(getTenantDb(), 'users', user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data();
        addLog(`forceRefreshProfile loaded role: ${d.role}`);
        setProfile({
          ...d,
          uid: user.uid,
          email: user.email || '',
          role: getResolvedRole(user.email, d.role),
        } as UserProfile);
      } else {
        addLog("forceRefreshProfile found no document!");
      }
    } catch (err: any) {
      addLog(`forceRefreshProfile error: ${err.message || err}`);
    }
  };

  const getResolvedRole = (
    _email: string | null | undefined,
    docRole: string | undefined
  ): 'admin' | 'teacher' | 'student' => {
    const normalizedRole = docRole?.trim().toLowerCase();
    // In solo-teacher mode: admin is treated as teacher with admin powers
    if (normalizedRole === 'admin') return 'admin';
    if (normalizedRole === 'teacher') return 'teacher';
    return 'student';
  };

  // Check if user is the platform owner (admin or teacher with isOwner flag)
  const checkIsOwner = (docData: any, role: string): boolean => {
    return role === 'admin' || docData?.isOwner === true;
  };

  useEffect(() => {
    if (isTenantLoading) {
      addLog("AuthProvider waiting for tenant config to load...");
      return;
    }

    let unsub: (() => void) | null = null;
    addLog("AuthProvider useEffect running after tenant load.");

    // 🛡️ EMERGENCY FAIL-SAFE: Force unfreeze after 12 seconds no matter what
    // Just stops the loading spinner — profile will arrive via onSnapshot
    const forceUnfreeze = setTimeout(() => {
      addLog("🛡️ FAILSAFE TRIGGERED! Forcing loading to false.");
      setLoading(false);
      setProfileHanging(true);
    }, 12000);

    const currentAuth = getTenantAuth();
    if (!currentAuth) {
      addLog("❌ Error: currentAuth is undefined! Firebase initialization delayed or failed.");
      setLoading(false);
      clearTimeout(forceUnfreeze);
      return;
    }

    addLog("Registering onAuthStateChanged listener...");
    const authUnsub = onAuthStateChanged(currentAuth, async (u) => {
      addLog(`onAuthStateChanged fired! User: ${u ? `${u.email} (${u.uid})` : 'null'}`);
      setUser(u);

      if (unsub) {
        addLog("Cleaning up previous onSnapshot listener...");
        unsub();
        unsub = null;
      }

      if (u) {
        try {
          const tenantDb = getTenantDb();
          addLog(`Tenant DB resolved. Fetching users/${u.uid}...`);
          const docRef = doc(tenantDb, 'users', u.uid);
          
          const s = await getDoc(docRef);
          addLog(`getDoc completed. Document exists: ${s.exists()}`);

          const isRegistering = sessionStorage.getItem('is_registering') === 'true';
           if (!s.exists()) {
            addLog(`Document missing. isRegistering state: ${isRegistering}`);
            if (!isRegistering) {
              addLog("Profile document missing. Signing out immediately...");
              try {
                await signOut(currentAuth);
              } catch (signErr) {
                console.error("Sign out error:", signErr);
              }
              setUser(null);
              setProfile(null);
              setLoading(false);
              clearTimeout(forceUnfreeze);
              return;
            } else {
               addLog("User is actively registering. Deferring UI unblock until document is created via onSnapshot...");
            }
          }

          const docData = s.exists() ? s.data() : {};
          const r = getResolvedRole(u.email, docData.role);
          const ownerFlag = checkIsOwner(docData, r);
          addLog(`Resolved role: ${r}, isOwner: ${ownerFlag}`);

          let normalizedLevel = docData.level;
          if (normalizedLevel === 'preparatory') {
            normalizedLevel = 'prep';
          }

          const p = {
            ...docData,
            level: normalizedLevel,
            uid: u.uid,
            email: u.email || '',
            displayName:
              docData.displayName || u.displayName || (r === 'admin' ? 'مدير المنصة' : 'مستخدم'),
            role: r,
            isOwner: ownerFlag,
          } as UserProfile;

          if (r === 'admin' || r === 'teacher') {
            addLog("User is admin/teacher. Setting profile, disabling loader, and listening to updates...");
            setProfile(p);
            setLoading(false);
            clearTimeout(forceUnfreeze);
            unsub = onSnapshot(docRef, (snap) => {
              addLog("onSnapshot update received for admin/teacher user profile");
              if (snap.exists()) {
                const updated = snap.data();
                setProfile({
                  ...updated,
                  uid: u.uid,
                  email: u.email || '',
                  role: getResolvedRole(u.email, updated.role),
                } as UserProfile);
              } else {
                addLog("onSnapshot: profile document deleted! Reloading page...");
                window.location.reload();
              }
            }, (err) => {
              addLog(`❌ onSnapshot Admin Profile error: ${err.message}`);
            });
            return;
          }

          let deviceVerified = false;
          const verifyStudentDevice = async (currentDocData: any) => {
            if (deviceVerified || !currentDocData) return;
            try {
              deviceVerified = true;
              addLog("Verifying student device hardware ID and IP address...");
              const { getFingerprint, getPublicIP, getDeviceName } =
                await import('../lib/deviceFingerprint');
              const [f, ip] = await Promise.all([getFingerprint(), getPublicIP(4000)]);
              addLog(`Fingerprint: ${f}, IP: ${ip}`);
              localStorage.setItem('fahmni_device_fingerprint', f);
              const dev = (currentDocData.devices || []) as any[];
              const cur = dev.find((i) => i.id === f);
              const now = new Date().toISOString();

              if (currentDocData.accountStatus === 'blocked') {
                addLog("Student account is BLOCKED!");
                setAccountBlocked(true);
                return;
              }

              if (cur && cur.isBlocked === true) {
                addLog("This specific device is BLOCKED!");
                setDeviceLocked(true);
                return;
              }

              if (!cur) {
                const maxAllowed = currentDocData.maxDevicesAllowed || 2;
                addLog(`New device detected. Total registered: ${dev.length}, Max allowed: ${maxAllowed}`);
                if (dev.length >= maxAllowed) {
                  addLog("Device limit reached! Locking device access.");
                  setDeviceLocked(true);
                } else {
                  addLog("Registering new device in Firestore...");
                  const { updateDoc } = await import('firebase/firestore');
                  await updateDoc(docRef, {
                    devices: [
                      ...dev,
                      {
                        id: f,
                        name: getDeviceName(),
                        ips: [ip],
                        lastLogin: now,
                        lastIp: ip,
                        firstSeen: now,
                      },
                    ],
                    lastActive: now,
                  });
                  addLog("Device registration completed.");
                }
              }
            } catch (secErr: any) {
              addLog(`⚠️ verifyStudentDevice error: ${secErr.message || secErr}`);
              deviceVerified = false; // Reset on failure to retry
            }
          };

          addLog("User is student. Setting profile, checking grade selection...");
          if (s.exists()) {
            setProfile(p);
            setNeedsGradeSelection(r === 'student' && (!docData.grade || !docData.level));
            // Unblock the UI immediately after setting profile if document already exists
            setLoading(false);
            clearTimeout(forceUnfreeze);
            verifyStudentDevice(docData);
          }

          addLog("Setting up onSnapshot update listener for student user...");
          unsub = onSnapshot(docRef, (snap) => {
            addLog("onSnapshot update received for student profile");
            const isRegisteringActive = sessionStorage.getItem('is_registering') === 'true';
            if (snap.exists()) {
              const d = snap.data();
              const nr = getResolvedRole(u.email, d.role);
              let normalizedLevel = d.level;
              if (normalizedLevel === 'preparatory') {
                normalizedLevel = 'prep';
              }
              setProfile({ ...d, level: normalizedLevel, uid: u.uid, email: u.email || '', role: nr } as UserProfile);
              setNeedsGradeSelection(nr === 'student' && (!d.grade || !normalizedLevel));
              if (nr === 'student') setAccountBlocked(d.accountStatus === 'blocked');
              setLoading(false);
              clearTimeout(forceUnfreeze);
              
              // Verify device fingerprint once the document actually exists in Firestore
              verifyStudentDevice(d);
            } else {
              if (isRegisteringActive) {
                addLog("onSnapshot: Student profile document does not exist yet, but user is actively registering. Deferring signout.");
                return;
              }
              addLog("onSnapshot: Student profile document deleted! Signing out...");
              signOut(currentAuth).catch((err) => console.error(err));
              setUser(null);
              setProfile(null);
              setLoading(false);
              clearTimeout(forceUnfreeze);
            }
          }, (err) => {
            addLog(`❌ onSnapshot Student Profile error: ${err.message}`);
          });
        } catch (e: any) {
          addLog(`❌ Firestore profile read threw: ${e.message || e}`);
          setAuthError(`Firestore Error: ${e.message || 'Unknown Error'}`);
          setLoading(false);
          clearTimeout(forceUnfreeze);
        }
      } else {
        addLog("No authenticated user. Resetting credentials...");
        setProfile(null);
        setNeedsGradeSelection(false);
        setDeviceLocked(false);
        setAccountBlocked(false);
        setLoading(false);
        setAuthError(null);
        clearTimeout(forceUnfreeze);
      }
    });

    return () => {
      addLog("Cleaning up AuthProvider listeners...");
      authUnsub();
      if (unsub) unsub();
    };
  }, [isTenantLoading]);

  const isOwner = profile?.role === 'admin' || profile?.isOwner === true;

  const contextValue = useMemo(() => ({
    user,
    profile,
    loading,
    profileHanging,
    deviceLocked,
    accountBlocked,
    needsGradeSelection,
    authError,
    isOwner,
    logout,
    forceRefreshProfile,
    authLogs: authLogsRef.current,
  }), [user, profile, loading, profileHanging, deviceLocked, accountBlocked, needsGradeSelection, authError, isOwner]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
