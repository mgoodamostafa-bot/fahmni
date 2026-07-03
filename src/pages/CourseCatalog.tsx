import React, { useEffect, useState } from 'react';
import { Search, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, onSnapshot, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CourseCard } from '../components/CourseCard';
import { useAuth } from '../contexts/AuthContext';
import { CourseCardSkeleton } from '../components/Skeleton';

const mapStudentGrade = (level?: string, gradeId?: string) => {
  if (!level || !gradeId) return gradeId;
  const cleanGradeId = gradeId.split('-')[0];
  if (level === 'secondary') {
    if (cleanGradeId === '1') return 'أول ثانوي';
    if (cleanGradeId === '2') return 'ثاني ثانوي';
    if (cleanGradeId === '3') return 'ثالث ثانوي';
  } else if (level === 'prep') {
    if (cleanGradeId === '1') return 'أول إعدادي';
    if (cleanGradeId === '2') return 'ثاني إعدادي';
    if (cleanGradeId === '3') return 'ثالث إعدادي';
  } else if (level === 'primary') {
    if (cleanGradeId === '1') return 'أول ابتدائي';
    if (cleanGradeId === '2') return 'ثاني ابتدائي';
    if (cleanGradeId === '3') return 'ثالث ابتدائي';
    if (cleanGradeId === '4') return 'رابع ابتدائي';
    if (cleanGradeId === '5') return 'خامس ابتدائي';
    if (cleanGradeId === '6') return 'سادس ابتدائي';
  }
  return gradeId;
};

export const CourseCatalog: React.FC = () => {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>(profile?.level === 'general' ? 'general' : 'all');
  const [selectedGrade, setSelectedGrade] = useState<string>(profile?.level === 'general' ? 'all' : 'all');

  // Sync with profile on mount if general
  useEffect(() => {
    if (profile?.level === 'general') {
      setSelectedLevel('general');
      setSelectedGrade('all');
    }
  }, [profile?.level]);

  // Remove the auto-applying profile filter to satisfy "show all first" requirement
  useEffect(() => {
    if (profile?.level && profile.level !== 'all') {
      setSelectedLevel(profile.level);
    }
    if (profile?.grade && profile.grade !== 'all') {
      setSelectedGrade(profile.grade);
    }
  }, [profile?.level, profile?.grade]);

  useEffect(() => {
    // Fetch from both 'Courses' and 'courses' to be robust
    let upperCourses: any[] = [];
    let lowerCourses: any[] = [];

    const processDocs = (snap: any) => snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    const combineAndFilter = () => {
      let allDocs = [...upperCourses];
      lowerCourses.forEach((d: any) => {
        if (!allDocs.find((ad: any) => ad.id === d.id)) allDocs.push(d);
      });

      // Role-based filtering
      if (profile?.role !== 'admin') {
        allDocs = allDocs.filter((c: any) => {
          const approvedStatus = (c.status === 'approved' || !c.status);
          const published = (c.isPublished === true || c.isPublished === undefined);
          return approvedStatus && published !== false;
        });
      }

      // Final sort
      allDocs.sort((a: any, b: any) => {
        const toMs = (v: any) => v?.toDate?.()?.getTime() || new Date(v || 0).getTime();
        return toMs(b.createdAt) - toMs(a.createdAt);
      });

      setCourses(allDocs);
      setLoading(false);
    };

    const unsubUpper = onSnapshot(query(collection(db, 'Courses')), (snap) => {
      upperCourses = processDocs(snap);
      combineAndFilter();
    });

    const unsubLower = onSnapshot(query(collection(db, 'courses')), (snap) => {
      lowerCourses = processDocs(snap);
      combineAndFilter();
    });

    return () => {
      unsubUpper();
      unsubLower();
    };
  }, [profile]);

  const subjects = ['all', ...Array.from(new Set(
    courses
      .filter((c: any) => {
        const matchesLevel = selectedLevel === 'all' || c.level === selectedLevel;
        const matchesGrade = selectedGrade === 'all' || String(c.grade) === String(selectedGrade);
        return matchesLevel && matchesGrade;
      })
      .map((c: any) => c.subject)
      .filter(Boolean)
  ))];

  const filteredCourses = courses.filter((course: any) => {
    const term = searchTerm.trim().toLowerCase();
    
    const matchesSearch = !term || 
      (course.title || '').toLowerCase().includes(term) ||
      (course.description || '').toLowerCase().includes(term);
    
    const matchesSubject = selectedSubject === 'all' || course.subject === selectedSubject;
    const matchesLevel = selectedLevel === 'all' || course.level === selectedLevel;
    const cleanCourseGrade = String(course.grade).split('-')[0];
    const cleanSelectedGrade = String(selectedGrade).split('-')[0];
    const matchesGrade = selectedGrade === 'all' || 
                         cleanCourseGrade === cleanSelectedGrade || 
                         String(course.grade) === String(selectedGrade) || 
                         String(course.grade) === mapStudentGrade(selectedLevel !== 'all' ? selectedLevel : 'secondary', selectedGrade);
    
    return matchesSearch && matchesSubject && matchesLevel && matchesGrade;
  });

  const isFiltered = searchTerm.trim() !== '' || selectedSubject !== 'all' || selectedLevel !== 'all' || selectedGrade !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedSubject('all');
    setSelectedLevel('all');
    setSelectedGrade('all');
  };

  return (
    <div className="container mx-auto px-4 space-y-6 pb-24">
      {/* Main Content Area */}
      <div className="space-y-8">
        {/* Search Bar – full width on mobile */}
        <div className="mt-8 bg-[var(--bg-main)]/90 backdrop-blur-xl py-4 w-full">
          <div className="flex flex-col gap-3 px-4 sm:px-0">
            {/* Search Input */}
            <div className="relative w-full group">
              <Search
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-600 transition-colors"
                size={20}
              />
              <input
                type="text"
                placeholder="ابحث عن كورس أو مادة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pr-12 w-full font-bold shadow-lg"
              />
            </div>

            {/* Level & Grade filter indicators */}
            {(selectedLevel !== 'all' || selectedGrade !== 'all') && (
              <div className="flex flex-wrap gap-2 px-1">
                {selectedLevel !== 'all' && (
                  <div className="bg-brand-blue/10 text-brand-blue px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 border border-brand-blue/20">
                    <span>المرحلة: {selectedLevel === 'primary' ? 'الابتدائية' : selectedLevel === 'prep' ? 'الإعدادية' : selectedLevel === 'secondary' ? 'الثانوية' : 'كورسات ومهارات عامة'}</span>
                    <button onClick={() => setSelectedLevel('all')} className="hover:text-red-500 transition-colors">×</button>
                  </div>
                )}
                {selectedGrade !== 'all' && (
                  <div className="bg-brand-yellow/10 text-brand-yellow-700 dark:text-brand-yellow px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 border border-brand-yellow/20">
                    <span>الصف: {selectedGrade}</span>
                    <button onClick={() => setSelectedGrade('all')} className="hover:text-red-500 transition-colors">×</button>
                  </div>
                )}
              </div>
            )}

            {/* Subject filter pills */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Quick toggle between General and Academic */}
              <button
                onClick={() => {
                  if (selectedLevel === 'general') {
                    // Switch to Academic
                    setSelectedLevel(profile?.level && profile.level !== 'general' ? profile.level : 'all');
                    setSelectedSubject('all');
                    setSelectedGrade(profile?.grade && profile.grade !== 'all' ? profile.grade : 'all');
                  } else {
                    // Switch to General
                    setSelectedLevel('general');
                    setSelectedSubject('all');
                    setSelectedGrade('all');
                  }
                }}
                className={`px-4 py-2 md:px-5 md:py-2.5 rounded-2xl font-black transition-all border text-xs md:text-sm flex-1 sm:flex-none text-center ${
                  selectedLevel === 'general'
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-transparent shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                    : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white'
                }`}
              >
                {selectedLevel === 'general' ? 'الرجوع للمنهج الدراسي' : 'كورسات المهارات العامة'}
              </button>
              
              <div className="hidden sm:block w-px h-6 bg-white/10 mx-1 shrink-0" />

              {subjects.map(subject => (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className={`px-4 py-2 md:px-5 md:py-2.5 rounded-2xl font-black transition-all border text-xs md:text-sm flex-1 sm:flex-none text-center ${
                    selectedSubject === subject
                      ? 'bg-brand-blue text-white border-transparent shadow-[0_0_20px_rgba(37,99,235,0.3)]'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  {subject === 'all' 
                    ? (selectedLevel === 'general' ? 'كل المجالات' : 'كل المواد المدرسية') 
                    : subject}
                </button>
              ))}
            </div>

          </div>
        </div>

        {/* Course Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 px-4 sm:px-0">
            {[1, 2, 3, 4, 5, 6].map(i => <CourseCardSkeleton key={i} />)}
          </div>
        ) : filteredCourses.length > 0 ? (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8"
          >
            {filteredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card py-24 text-center"
          >
            <div className="bg-brand-500/5 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <BookOpen size={40} className="text-brand-600 opacity-40" />
            </div>
            {isFiltered ? (
              <>
                <h3 className="text-2xl font-black mb-3">لم نجد نتائج للبحث</h3>
                <p className="text-gray-500 font-bold mb-8 max-w-sm mx-auto">
                  حاول تغيير كلمات البحث أو إزالة الفلاتر.
                </p>
                <button onClick={resetFilters} className="btn-primary inline-flex">
                  عرض كافة الكورسات
                </button>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-black mb-3">لا توجد كورسات متاحة حالياً</h3>
                <p className="text-gray-500 font-bold mb-2 max-w-sm mx-auto">
                  سيتم إضافة كورسات قريباً، تابعنا!
                </p>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};
