import React, { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationProvider } from './contexts/NotificationContext';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { TenantProvider, useTenant } from './contexts/TenantContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { getTenantAuth } from './lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { FruitIcon } from './components/FruitIcon';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// --- Lazy Load Pages for "Light as a Feather" Performance ---
const MainLandingPage = lazy(() =>
  import('./pages/MainLandingPage').then((m) => ({ default: m.MainLandingPage }))
);
const SuperAdminDashboard = lazy(() =>
  import('./pages/super-admin/SuperAdminDashboard').then((m) => ({
    default: m.SuperAdminDashboard,
  }))
);
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Welcome = lazy(() => import('./pages/Welcome').then((m) => ({ default: m.Welcome })));
const GradeSelection = lazy(() =>
  import('./pages/GradeSelection').then((m) => ({ default: m.GradeSelection }))
);
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const ParentPortal = lazy(() => import('./pages/ParentPortal').then((m) => ({ default: m.ParentPortal })));
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const CourseCatalog = lazy(() =>
  import('./pages/CourseCatalog').then((m) => ({ default: m.CourseCatalog }))
);
const CourseDetails = lazy(() =>
  import('./pages/CourseDetails').then((m) => ({ default: m.CourseDetails }))
);
const StudentDashboard = lazy(() =>
  import('./pages/StudentDashboard').then((m) => ({ default: m.StudentDashboard }))
);
const Assignments = lazy(() =>
  import('./pages/Assignments').then((m) => ({ default: m.Assignments }))
);
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const Contact = lazy(() => import('./pages/Contact').then((m) => ({ default: m.Contact })));
const LessonView = lazy(() =>
  import('./pages/LessonView').then((m) => ({ default: m.LessonView }))
);
const AdminLayout = lazy(() =>
  import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout }))
);
const AdminDashboard = lazy(() =>
  import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const AdminManageCourses = lazy(() =>
  import('./pages/admin/ManageCourses').then((m) => ({ default: m.AdminManageCourses }))
);
const AdminAddCourse = lazy(() =>
  import('./pages/admin/AddCourse').then((m) => ({ default: m.AdminAddCourse }))
);
const ManageLessons = lazy(() =>
  import('./pages/admin/ManageLessons').then((m) => ({ default: m.ManageLessons }))
);
const ManageUsers = lazy(() =>
  import('./pages/admin/ManageUsers').then((m) => ({ default: m.ManageUsers }))
);
const ManageEnrollments = lazy(() =>
  import('./pages/admin/ManageEnrollments').then((m) => ({ default: m.ManageEnrollments }))
);
const SiteSettings = lazy(() =>
  import('./pages/admin/SiteSettings').then((m) => ({ default: m.SiteSettings }))
);
const Notifications = lazy(() =>
  import('./pages/admin/Notifications').then((m) => ({ default: m.Notifications }))
);
const Diagnostic = lazy(() =>
  import('./pages/admin/Diagnostic').then((m) => ({ default: m.Diagnostic }))
);
const EditLesson = lazy(() =>
  import('./pages/admin/EditLesson').then((m) => ({ default: m.EditLesson }))
);
const AdminEditCourse = lazy(() =>
  import('./pages/admin/EditCourse').then((m) => ({ default: m.AdminEditCourse }))
);
const CouponManager = lazy(() =>
  import('./pages/admin/CouponManager').then((m) => ({ default: m.CouponManager }))
);
const CardCodeManager = lazy(() =>
  import('./pages/admin/CardCodeManager').then((m) => ({ default: m.CardCodeManager }))
);
const WalletRequests = lazy(() =>
  import('./pages/admin/WalletRequests').then((m) => ({ default: m.WalletRequests }))
);
const PaymentSettings = lazy(() =>
  import('./pages/admin/PaymentSettings').then((m) => ({ default: m.PaymentSettings }))
);
const SendNotification = lazy(() =>
  import('./pages/admin/SendNotification').then((m) => ({ default: m.SendNotification }))
);
const Maintenance = lazy(() =>
  import('./pages/admin/Maintenance').then((m) => ({ default: m.Maintenance }))
);
const CenterBranches = lazy(() =>
  import('./pages/admin/CenterBranches').then((m) => ({ default: m.CenterBranches }))
);
const GroupManagement = lazy(() =>
  import('./pages/admin/GroupManagement').then((m) => ({ default: m.GroupManagement }))
);
const OfflineResults = lazy(() =>
  import('./pages/admin/OfflineResults').then((m) => ({ default: m.OfflineResults }))
);
const FinanceDashboard = lazy(() =>
  import('./pages/admin/FinanceDashboard').then((m) => ({ default: m.FinanceDashboard }))
);
const TeacherFinanceDetails = lazy(() =>
  import('./pages/admin/TeacherFinanceDetails').then((m) => ({ default: m.TeacherFinanceDetails }))
);
const AttendanceScanner = lazy(() =>
  import('./pages/admin/AttendanceScanner').then((m) => ({ default: m.AttendanceScanner }))
);

const TeacherLayout = lazy(() =>
  import('./pages/teacher/TeacherLayout').then((m) => ({ default: m.TeacherLayout }))
);
const TeacherDashboard = lazy(() =>
  import('./pages/teacher/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard }))
);
const TeacherManageCourses = lazy(() =>
  import('./pages/teacher/ManageCourses').then((m) => ({ default: m.TeacherManageCourses }))
);
const TeacherAddCourse = lazy(() =>
  import('./pages/teacher/AddCourse').then((m) => ({ default: m.TeacherAddCourse }))
);
const TeacherEditCourse = lazy(() =>
  import('./pages/teacher/EditCourse').then((m) => ({ default: m.TeacherEditCourse }))
);
const TeacherStudents = lazy(() =>
  import('./pages/teacher/TeacherStudents').then((m) => ({ default: m.TeacherStudents }))
);
const TeacherStudentDetails = lazy(() =>
  import('./pages/teacher/TeacherStudentDetails').then((m) => ({ default: m.TeacherStudentDetails }))
);
const ResultsDashboard = lazy(() =>
  import('./pages/teacher/ResultsDashboard').then((m) => ({ default: m.ResultsDashboard }))
);
const TeacherExams = lazy(() =>
  import('./pages/teacher/TeacherExams').then((m) => ({ default: m.TeacherExams }))
);
const TeacherDiscussions = lazy(() =>
  import('./pages/teacher/TeacherDiscussions').then((m) => ({ default: m.TeacherDiscussions }))
);
const AddQuestion = lazy(() =>
  import('./pages/teacher/AddQuestion').then((m) => ({ default: m.AddQuestion }))
);
const AddExam = lazy(() => import('./pages/teacher/AddExam').then((m) => ({ default: m.AddExam })));
const TeacherPortfolio = lazy(() =>
  import('./pages/teacher/TeacherPortfolio').then((m) => ({ default: m.TeacherPortfolio }))
);
const TeacherQuestionBanks = lazy(() =>
  import('./pages/teacher/TeacherQuestionBanks').then((m) => ({ default: m.TeacherQuestionBanks }))
);
const HomeworkSubmissions = lazy(() =>
  import('./pages/teacher/HomeworkSubmissions').then((m) => ({ default: m.HomeworkSubmissions }))
);

const MyCourses = lazy(() => import('./pages/MyCourses').then((m) => ({ default: m.MyCourses })));
const QuestionBank = lazy(() =>
  import('./pages/QuestionBank').then((m) => ({ default: m.QuestionBank }))
);
const Exams = lazy(() => import('./pages/Revisions').then((m) => ({ default: m.Exams })));
const NotificationDetail = lazy(() =>
  import('./pages/NotificationDetail').then((m) => ({ default: m.NotificationDetail }))
);
const StudentLibrary = lazy(() =>
  import('./pages/StudentLibrary').then((m) => ({ default: m.StudentLibrary }))
);
const MyCertificates = lazy(() =>
  import('./pages/MyCertificates').then((m) => ({ default: m.MyCertificates }))
);

const LoadingPlaceholder = () => {
  const [showEmergency, setShowEmergency] = React.useState(false);

  React.useEffect(() => {
    // Increased to 15 seconds to match AuthContext and TenantContext max timeouts
    const timer = setTimeout(() => setShowEmergency(true), 15000);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = async () => {
    const { signOut } = await import('firebase/auth');
    await signOut(getTenantAuth());
    window.location.reload();
  };

  return (
    <div
      className="min-h-screen bg-space-950 flex flex-col items-center justify-center gap-6 p-6 text-center"
      dir="rtl"
    >
      <div className="relative w-16 h-16">
        <FruitIcon size="xl" animate withGlow />
      </div>
      <div className="space-y-2">
        <p className="text-white font-bold text-lg">جاري تحميل المنصة...</p>
        <p className="text-white/20 font-black text-[10px] tracking-widest uppercase">
          FAHMNI SECURE BOOT
        </p>
      </div>

      <AnimatePresence>
        {showEmergency && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-6 bg-white/5 border border-white/10 rounded-3xl max-w-sm w-full backdrop-blur-xl"
          >
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              يبدو أن التحميل يستغرق وقتاً أطول من المعتاد. قد يكون هناك مشكلة في الاتصال بقاعدة
              البيانات.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-brand-blue text-white rounded-2xl font-bold text-sm shadow-xl shadow-brand-blue/20"
              >
                إعادة تحميل الصفحة
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-bold text-sm"
              >
                تسجيل الخروج والمحاولة مجدداً
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AccountBlockedOverlay = () => {
  const { user } = useAuth();
  const handleLogout = async () => {
    const { signOut } = await import('firebase/auth');
    await signOut(getTenantAuth());
    window.location.reload();
  };
  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#0a0f1e] flex items-center justify-center p-6 text-right"
      dir="rtl"
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-red-500/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-blue/10 blur-[120px] rounded-full" />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-[2.5rem] text-center relative z-10"
      >
        <div className="w-24 h-24 bg-red-500/20 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <ShieldAlert size={48} />
        </div>
        <h1 className="text-3xl font-black text-white mb-6">عذراً، هذا الحساب محظور</h1>
        <div className="bg-black/30 rounded-xl p-4 mb-6 border border-white/5 text-xs text-gray-400">
          <p className="mb-2">لقد تم حظر حسابك لمخالفة سياسات المنصة (مثل محاولة تصوير الشاشة).</p>
          <p className="mb-2">برجاء التواصل مع الإدارة لمراجعة حسابك:</p>
          <p className="font-bold text-white mb-1">
            الحساب: <span className="text-brand-blue">{user?.email}</span>
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="btn-primary w-full py-4 rounded-2xl font-black transition-all shadow-xl shadow-brand-blue/20 hover:scale-[1.02]"
        >
          تسجيل الخروج
        </button>
      </motion.div>
    </div>
  );
};

const DeviceLockOverlay = () => {
  const { user } = useAuth();
  const handleLogout = async () => {
    const { signOut } = await import('firebase/auth');
    await signOut(getTenantAuth());
    window.location.reload();
  };
  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#0a0f1e] flex items-center justify-center p-6 text-right"
      dir="rtl"
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-red-500/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-blue/10 blur-[120px] rounded-full" />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-[2.5rem] text-center relative z-10"
      >
        <div className="w-24 h-24 bg-red-500/20 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <ShieldAlert size={48} />
        </div>
        <h1 className="text-3xl font-black text-white mb-6">عذراً، هذا الحساب مسجل على جهاز آخر</h1>
        <div className="bg-black/30 rounded-xl p-4 mb-6 border border-white/5 text-xs text-gray-400">
          <p className="mb-2">برجاء مراجعة الإدارة وتزويدهم ببياناتك التالية لفتح الحظر:</p>
          <p className="font-bold text-white mb-1">
            الحساب: <span className="text-brand-blue">{user?.email}</span>
          </p>
          <p className="text-[10px] break-all">
            مُعرف هذا الجهاز: {localStorage.getItem('fahmni_device_fingerprint') || 'N/A'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="btn-primary w-full py-4 rounded-2xl font-black transition-all shadow-xl shadow-brand-blue/20 hover:scale-[1.02]"
        >
          تسجيل الخروج وإعادة المحاولة
        </button>
      </motion.div>
    </div>
  );
};

const ProtectedRoute = ({
  children,
  requireAdmin = false,
  requireTeacher = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireTeacher?: boolean;
}) => {
  const { user, profile, loading, needsGradeSelection, isOwner } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();

  if (loading) return <LoadingPlaceholder />;

  if (!user) return <Navigate to="/login" replace />;

  // Admin access: user must be admin or owner
  if (requireAdmin && !isOwner && profile?.role !== 'admin') return <Navigate to="/" replace />;
  // Teacher access: teacher, admin, or owner
  if (requireTeacher && profile?.role !== 'teacher' && profile?.role !== 'admin' && !isOwner)
    return <Navigate to="/" replace />;

  // Only redirect to grade selection if NOT hidden by admin
  if (
    profile?.role === 'student' &&
    needsGradeSelection &&
    !settings.hideGradeSelection &&
    location.pathname !== '/grade-selection' &&
    location.pathname !== '/profile'
  ) {
    return <Navigate to="/grade-selection" replace />;
  }

  return <>{children}</>;
};

const PublicRoute = ({
  children,
  forceNotLogged = true,
}: {
  children: React.ReactNode;
  forceNotLogged?: boolean;
}) => {
  const { user, profile, loading } = useAuth();
  if (loading) return null;

  if (user && forceNotLogged) {
    // Both admin and teacher go to /teacher in solo-teacher mode
    if (profile?.role === 'admin') return <Navigate to="/teacher" replace />;
    if (profile?.role === 'teacher') return <Navigate to="/teacher" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function AppRouter() {
  const { isMainSite, isLoading: isTenantLoading, tenantData } = useTenant();
  const { loading: isAuthLoading, deviceLocked, accountBlocked, profile, isOwner } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();

  useEffect(() => {
    const routeTitles: Record<string, string> = {
      '/': 'لوحتي',
      '/courses': 'كتالوج الكورسات',
      '/profile': 'الملف الشخصي',
      '/my-courses': 'دروسي المشترك بها',
      '/library': 'الحقيبة التعليمية',
      '/exams': 'الامتحانات والنتائج',
      '/question-bank': 'بنك الأسئلة',
      '/login': 'تسجيل الدخول',
      '/register': 'إنشاء حساب جديد',
      '/grade-selection': 'اختيار الصف الدراسي',
      '/welcome': 'مرحباً بك',
    };

    const platformName = tenantData?.siteName || tenantData?.name || settings?.siteName || 'فهمني';
    let title = routeTitles[location.pathname] || platformName;

    if (location.pathname.includes('/learn')) title = 'مشاهدة الدرس';
    if (location.pathname.startsWith('/admin')) title = 'لوحة التحكم';
    if (location.pathname.startsWith('/teacher')) title = 'بوابة المعلم';

    document.title = title === platformName ? platformName : `${title} | ${platformName}`;
  }, [location.pathname, settings?.siteName, tenantData]);

  if (isTenantLoading || isAuthLoading) {
    return <LoadingPlaceholder />;
  }

  return (
    <>
      <AnimatePresence>
        {deviceLocked && <DeviceLockOverlay key="lock-overlay" />}
        {accountBlocked && <AccountBlockedOverlay key="block-overlay" />}
      </AnimatePresence>
      <Suspense fallback={<LoadingPlaceholder />}>
        {isMainSite ? (
          <Routes>
            <Route path="/" element={<MainLandingPage />} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/owner-dashboard" element={<SuperAdminDashboard />} />
            <Route path="/owner-dashboard/settings" element={<ProtectedRoute requireAdmin><SiteSettings /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="welcome" element={<Welcome />} />
            <Route
              path="login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />
            <Route path="parent" element={<ParentPortal />} />
            <Route
              path="question-bank"
              element={
                <ProtectedRoute>
                  <QuestionBank />
                </ProtectedRoute>
              }
            />

            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="grade-selection" element={<GradeSelection />} />

              <Route
                path="courses"
                element={
                  <ProtectedRoute>
                    <CourseCatalog />
                  </ProtectedRoute>
                }
              />
              <Route path="dashboard" element={<Navigate to="/" replace />} />
              <Route
                path="my-courses"
                element={
                  <ProtectedRoute>
                    <MyCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="exams"
                element={
                  <ProtectedRoute>
                    <Exams />
                  </ProtectedRoute>
                }
              />
              <Route
                path="notifications/:id"
                element={
                  <ProtectedRoute>
                    <NotificationDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="assignments"
                element={
                  <ProtectedRoute>
                    <Assignments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="library"
                element={
                  <ProtectedRoute>
                    <StudentLibrary />
                  </ProtectedRoute>
                }
              />
              <Route
                path="certificates"
                element={
                  <ProtectedRoute>
                    <MyCertificates />
                  </ProtectedRoute>
                }
              />
              <Route path="contact" element={<Contact />} />
              <Route
                path="courses/:courseId"
                element={
                  <ProtectedRoute>
                    <CourseDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="courses/:courseId/learn"
                element={
                  <ProtectedRoute>
                    <LessonView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="courses/:courseId/learn/:lessonId"
                element={
                  <ProtectedRoute>
                    <LessonView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="course/:courseId"
                element={
                  <Navigate to={`/courses/${window.location.pathname.split('/').pop()}`} replace />
                }
              />
              <Route
                path="course/:courseId/learn"
                element={
                  <Navigate to={`/courses/${window.location.pathname.split('/')[2]}/learn`} replace />
                }
              />
            </Route>

            {/* ══════ Admin routes redirect to Teacher ══════ */}
            <Route path="admin/*" element={<Navigate to="/teacher" replace />} />

            {/* ══════ Teacher + Admin (merged) ══════ */}
            <Route
              path="teacher"
              element={
                <ProtectedRoute requireTeacher>
                  <TeacherLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<TeacherDashboard />} />
              <Route path="courses" element={<TeacherManageCourses />} />
              <Route path="add-course" element={<TeacherAddCourse />} />
              <Route path="add-question" element={<AddQuestion />} />
              <Route path="question-banks" element={<TeacherQuestionBanks />} />
              <Route path="add-exam" element={<AddExam />} />
              <Route path="courses/:courseId/edit" element={<TeacherEditCourse />} />
              <Route path="courses/:courseId/lessons" element={<ManageLessons />} />
              <Route path="courses/:courseId/lessons/new" element={<EditLesson />} />
              <Route path="courses/:courseId/lessons/:lessonId/edit" element={<EditLesson />} />
              <Route path="courses/:courseId/coupons" element={<CardCodeManager />} />
              <Route path="courses/:courseId/codes" element={<CardCodeManager />} />
              <Route path="students" element={<TeacherStudents />} />
              <Route path="students/:studentId" element={<TeacherStudentDetails />} />
              <Route path="results" element={<ResultsDashboard />} />
              <Route path="my-exams" element={<TeacherExams />} />
              <Route path="discussions" element={<TeacherDiscussions />} />
              <Route path="portfolio" element={<TeacherPortfolio />} />
              <Route path="submissions" element={<HomeworkSubmissions />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="send-notification" element={<SendNotification />} />

              {/* ── Admin pages merged into teacher ── */}
              <Route path="users" element={<ManageUsers />} />
              <Route path="payment-settings" element={<PaymentSettings />} />
              <Route path="coupons" element={<CardCodeManager />} />
              <Route path="wallet-requests" element={<WalletRequests />} />
              <Route path="finance" element={<FinanceDashboard />} />
              <Route path="finance/teachers/:teacherId" element={<TeacherFinanceDetails />} />
              <Route path="enrollments" element={<ManageEnrollments />} />
              <Route path="codes" element={<CardCodeManager />} />
              <Route path="maintenance" element={<Maintenance />} />
              <Route path="branches" element={<CenterBranches />} />
              <Route path="groups" element={<GroupManagement />} />
              <Route path="offline-results" element={<OfflineResults />} />
              <Route path="diagnostic" element={<Diagnostic />} />
              <Route path="attendance" element={<AttendanceScanner />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Suspense>
    </>
  );
}

const TenantAwareProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SettingsProvider>
      <AuthProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </AuthProvider>
    </SettingsProvider>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <TenantProvider>
            <ThemeProvider>
              <TenantAwareProviders>
                <AppRouter />
              </TenantAwareProviders>
            </ThemeProvider>
          </TenantProvider>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
