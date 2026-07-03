import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  Star,
  TrendingUp,
  Search,
  Bell,
  GraduationCap,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { CourseCard } from '../components/CourseCard';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { getTenantDb } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const studentName = profile?.displayName || user?.displayName || 'طالبنا المتميز';

  useEffect(() => {
    const fetchEnrollments = async () => {
      if (!user) return;
      try {
        const enrollmentsQ = query(
          collection(getTenantDb(), 'Enrollments'),
          where('studentId', '==', user.uid),
          where('status', '==', 'active')
        );
        const enrollmentsSnap = await getDocs(enrollmentsQ);

        const coursesData = await Promise.all(
          enrollmentsSnap.docs.map(async (enrollmentDoc) => {
            const courseId = enrollmentDoc.data().courseId;
            const courseDoc = await getDoc(doc(getTenantDb(), 'Courses', courseId));
            if (courseDoc.exists()) {
              return { id: courseDoc.id, ...courseDoc.data() };
            }
            return null;
          })
        );

        setEnrolledCourses(coursesData.filter((c) => c !== null));
      } catch (error) {
        console.error('Error fetching enrollments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEnrollments();
  }, [user]);

  return (
    <div className="min-h-screen bg-brand-dark">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-black mb-2 font-display">
              أهلاً بك، <span className="text-brand-blue">{studentName}</span> 👋
            </h1>
          </motion.div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="ابحث عن درس أو كورس..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold"
              />
            </div>
            <button className="p-3 glass-card hover:bg-white/10 transition-colors relative">
              <Bell size={24} />
              <span className="absolute top-3 right-3 w-2 h-2 bg-brand-yellow rounded-full shadow-lg shadow-yellow-500/50" />
            </button>
          </div>
        </div>

        {/* My Courses Section */}
        <section className="mb-20">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-8 h-8 text-brand-blue" />
              <h2 className="text-3xl font-black font-display">كورساتي الحالية</h2>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card h-64 animate-pulse bg-white/5" />
              ))}
            </div>
          ) : enrolledCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {enrolledCourses.map((course) => (
                <CourseCard key={course.id} course={course} showProgress={true} />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-16 text-center border-dashed border-2 border-white/10"
            >
              <div className="w-20 h-20 bg-brand-blue/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <GraduationCap className="text-brand-blue w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black mb-4">أنت غير مشترك في أي كورس حالياً</h3>
              <p className="text-gray-400 font-bold mb-8 max-w-md mx-auto">
                ابدأ رحلتك التعليمية الآن واكتشف مجموعة واسعة من الكورسات المتميزة
              </p>
              <Link to="/courses" className="btn-primary inline-flex items-center gap-3 px-8 py-3">
                استعرض الكورسات المتاحة <ArrowLeft size={20} />
              </Link>
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
};
