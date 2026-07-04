import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { smartGetDocs, chunkArray } from '../utils/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { FileTypeIcon } from '../components/FileTypeIcon';
import { downloadViaProxy } from '../utils/download';
import {
  FileText,
  Search,
  Download,
  BookOpen,
  Loader2,
  Library as LibraryIcon,
  ChevronLeft,
  FolderOpen,
  User as UserIcon,
  PlayCircle
} from 'lucide-react';

interface TeacherInfo {
  id: string;
  displayName: string;
  photoURL?: string;
}

interface Resource {
  id: string;
  title: string;
  pdfUrl: string;
  courseId: string;
  courseTitle: string;
  subject: string;
  createdAt: any;
  teacher?: TeacherInfo;
}

interface GroupedResources {
  [courseId: string]: {
    courseTitle: string;
    subject: string;
    teacher?: TeacherInfo;
    resources: Resource[];
  };
}

export const StudentLibrary: React.FC = () => {
  const { user, profile } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [groupedResources, setGroupedResources] = useState<GroupedResources>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchLibrary = async () => {
      setLoading(true);
      try {
        // 1. Get Enrollments
        const allEnrollmentDocs = await smartGetDocs('Enrollments', [
          where('userId', '==', user.uid),
        ]);

        const enrolledCourseIds = Array.from(
          new Set(
            allEnrollmentDocs
              .filter((d) => d.status === 'active' || !d.status)
              .map((d) => d.courseId)
          )
        ).filter(Boolean) as string[];

        if (enrolledCourseIds.length === 0) {
          setResources([]);
          setLoading(false);
          return;
        }

        // 2. Fetch Course Details
        const idChunks = chunkArray(enrolledCourseIds, 30);
        const courseMap: Record<string, any> = {};
        const teacherIds = new Set<string>();

        const courseSnapshots = await Promise.all(
          idChunks.map((chunk) => smartGetDocs('Courses', [where('__name__', 'in', chunk)]))
        );
        
        courseSnapshots.flat().forEach((d) => {
          courseMap[d.id] = d;
          if (d.teacherId) teacherIds.add(d.teacherId);
        });

        // 3. Fetch Teachers Info
        const teacherMap: Record<string, TeacherInfo> = {};
        if (teacherIds.size > 0) {
          const teacherChunks = chunkArray(Array.from(teacherIds), 30);
          const teacherSnapshots = await Promise.all(
            teacherChunks.map((chunk) => smartGetDocs('users', [where('__name__', 'in', chunk)]))
          );
          teacherSnapshots.flat().forEach((d) => {
            teacherMap[d.id] = {
              id: d.id,
              displayName: d.displayName || d.name || 'مدرس',
              photoURL: d.photoURL,
            };
          });
        }

        // 4. Fetch Lessons and Portfolio Resources
        const [lessonResults, portfolioResults] = await Promise.all([
          Promise.all(
            idChunks.map((chunk) => smartGetDocs('Lessons', [where('courseId', 'in', chunk)]))
          ),
          Promise.all(
            idChunks.map((chunk) =>
              smartGetDocs('PortfolioResources', [where('courseId', 'in', chunk)])
            )
          ),
        ]);

        const allResources: Resource[] = [];
        
        const processDoc = (data: any, isLesson: boolean) => {
          if (data.pdfUrl) {
            const course = courseMap[data.courseId];
            const teacher = course?.teacherId ? teacherMap[course.teacherId] : undefined;
            
            allResources.push({
              id: data.id,
              title: data.title,
              pdfUrl: data.pdfUrl,
              courseId: data.courseId,
              courseTitle: data.courseTitle || course?.title || 'كورس غير معروف',
              subject: data.subject || course?.subject || 'عام',
              createdAt: data.createdAt,
              teacher,
            });
          }
        };

        lessonResults.flat().forEach((d) => processDoc(d, true));
        portfolioResults.flat().forEach((d) => processDoc(d, false));

        // Sort and Group
        allResources.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

        const grouped: GroupedResources = {};
        allResources.forEach((res) => {
          if (!grouped[res.courseId]) {
            grouped[res.courseId] = {
              courseTitle: res.courseTitle,
              subject: res.subject,
              teacher: res.teacher,
              resources: [],
            };
          }
          grouped[res.courseId].resources.push(res);
        });

        setResources(allResources);
        setGroupedResources(grouped);
      } catch (error) {
        console.error('Error fetching library:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLibrary();
  }, [user]);

  const handleDownload = async (url: string, filename: string, id: string) => {
    setDownloading(id);
    try {
      const isPdf =
        url.toLowerCase().includes('.pdf') ||
        url.toLowerCase().includes('/o/portfolioresources') ||
        url.toLowerCase().includes('/o/lessons') ||
        url.toLowerCase().includes('drive.google.com') ||
        url.toLowerCase().includes('dropbox.com');

      if (isPdf && profile) {
        let ipAddress = 'Local';
        try {
          const { getPublicIP } = await import('../lib/deviceFingerprint');
          ipAddress = await getPublicIP(2000);
        } catch (e) {
          console.warn('Could not fetch public IP for watermark', e);
        }

        // Bypass CORS for external links by routing through our backend download proxy
        const fetchUrl = url.includes('drive.google.com') || url.includes('dropbox.com')
          ? `/api/download-proxy?url=${encodeURIComponent(url)}`
          : url;

        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error('Failed to fetch PDF file');
        const arrayBuffer = await response.arrayBuffer();

        const { stampPDFWithForensics } = await import('../utils/pdfForensic');
        const stampedBytes = await stampPDFWithForensics(arrayBuffer, {
          studentName: profile.displayName,
          studentPhone: profile.studentPhone || profile.email,
          studentEmail: profile.email,
          studentId: profile.studentId || '000000',
          ipAddress,
        });

        const blob = new Blob([stampedBytes], { type: 'application/pdf' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${filename}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      } else {
        await downloadViaProxy(url, `${filename}.pdf`);
      }
    } catch (err: any) {
      console.error('Forensic download failed, falling back to direct tab open:', err);
      alert(`عذراً، فشل التحميل الآمن للبصمة المائية بسبب: ${err.message || err}\nسيتم فتح الملف مباشرة كبديل.`);
      window.open(url, '_blank');
    } finally {
      setDownloading(null);
    }
  };

  // ─── Render Helpers ─────────────────────────────────────────────────────────
  const filteredCourses = Object.entries(groupedResources).filter(([_, group]) => {
    const term = searchTerm.toLowerCase();
    return (
      group.courseTitle.toLowerCase().includes(term) ||
      group.subject.toLowerCase().includes(term) ||
      group.teacher?.displayName.toLowerCase().includes(term) ||
      group.resources.some((r) => r.title.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" dir="rtl">
        <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
        <p className="text-gray-500 font-bold">جاري تجهيز حقيبتك التعليمية...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-12 space-y-12" dir="rtl">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-[3rem] p-8 md:p-12 border border-white/10 bg-gradient-to-br from-brand-blue/20 via-[#0f172a] to-[#0f172a] shadow-2xl">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay"></div>
        <div className="relative z-10 flex flex-col items-center text-center space-y-6">
          <div className="w-24 h-24 bg-brand-blue/10 rounded-full flex items-center justify-center border border-brand-blue/20 shadow-[0_0_50px_rgba(56,189,248,0.15)]">
            <LibraryIcon size={48} className="text-brand-blue" />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
              الحقيبة <span className="text-transparent bg-clip-text bg-gradient-to-l from-brand-blue to-cyan-400">التعليمية</span>
            </h1>
            <p className="text-gray-400 font-bold text-lg md:text-xl max-w-2xl mx-auto">
              مكتبتك الشاملة لكل المذكرات والمرفقات الخاصة بكورساتك، منظمة وجاهزة للتحميل المباشر.
            </p>
          </div>
          <div className="w-full max-w-md relative mt-6">
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="ابحث عن ملف، كورس، أو معلم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-4 pr-12 pl-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue transition-all font-bold"
            />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {resources.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-white/10 rounded-[3rem]"
          >
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <FolderOpen size={48} className="text-gray-600" />
            </div>
            <h2 className="text-2xl font-black text-white mb-3">الحقيبة فارغة حالياً!</h2>
            <p className="text-gray-500 font-bold max-w-md">
              بمجرد اشتراكك في الكورسات ورفع معلميك للملفات، ستظهر لك هنا تلقائياً بتنظيم كامل.
            </p>
          </motion.div>
        ) : selectedCourseId ? (
          /* Single Course View */
          <motion.div
            key="files-view"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {/* Header / Back */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/10">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setSelectedCourseId(null)}
                  className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 hover:scale-105 border border-white/10 text-white rounded-2xl transition-all"
                >
                  <ChevronLeft size={24} />
                </button>
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight">
                    {groupedResources[selectedCourseId]?.courseTitle}
                  </h2>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-brand-blue font-bold px-3 py-1 bg-brand-blue/10 rounded-lg text-sm">
                      {groupedResources[selectedCourseId]?.resources.length} ملفات
                    </span>
                    <span className="text-gray-500 font-bold text-sm">
                      {groupedResources[selectedCourseId]?.subject}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Teacher Info */}
              {groupedResources[selectedCourseId]?.teacher && (
                <div className="flex items-center gap-4 bg-white/5 p-3 pr-4 rounded-2xl border border-white/10">
                  <div className="text-left">
                    <p className="text-xs font-bold text-gray-500">أستاذ المادة</p>
                    <p className="text-sm font-black text-white">
                      {groupedResources[selectedCourseId].teacher?.displayName}
                    </p>
                  </div>
                  {groupedResources[selectedCourseId].teacher?.photoURL ? (
                    <img 
                      src={groupedResources[selectedCourseId].teacher?.photoURL} 
                      alt="Teacher" 
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                      <UserIcon size={20} className="text-gray-400" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Files Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupedResources[selectedCourseId]?.resources
                .filter(r => searchTerm.trim() === '' || r.title.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((file, idx) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative overflow-hidden bg-[#1e293b]/50 hover:bg-[#1e293b] border border-white/10 hover:border-brand-blue/50 rounded-[2rem] p-6 transition-all duration-300 shadow-xl"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-brand-blue/10"></div>
                  
                  <div className="flex items-start gap-4 mb-6 relative z-10">
                    <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center shrink-0">
                      <FileText size={28} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-white text-lg truncate group-hover:text-brand-blue transition-colors">
                        {file.title}
                      </h3>
                      <p className="text-sm text-gray-500 font-bold mt-1">ملف PDF</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(file.pdfUrl, file.title, file.id)}
                    disabled={downloading === file.id}
                    className="w-full relative z-10 flex items-center justify-center gap-2 bg-white/5 hover:bg-brand-blue hover:text-white text-brand-blue py-3 rounded-xl font-black transition-all disabled:opacity-50 disabled:cursor-wait"
                  >
                    {downloading === file.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Download size={18} />
                    )}
                    <span>{downloading === file.id ? 'جاري التحميل...' : 'تحميل المذكرة'}</span>
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          /* Folders View */
          <motion.div
            key="folders-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredCourses.length === 0 ? (
               <div className="col-span-full text-center py-20">
                 <p className="text-gray-500 font-bold text-xl">لم نجد نتائج تطابق بحثك :(</p>
               </div>
            ) : (
              filteredCourses.map(([courseId, group], idx) => (
                <motion.div
                  key={courseId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <button
                    onClick={() => setSelectedCourseId(courseId)}
                    className="w-full text-right group relative overflow-hidden bg-gradient-to-b from-[#1e293b] to-[#0f172a] border border-white/10 hover:border-brand-blue/30 rounded-[2.5rem] p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-blue/10"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-blue/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-16 h-16 bg-white/5 group-hover:bg-brand-blue/10 rounded-2xl flex items-center justify-center transition-colors border border-white/5 group-hover:border-brand-blue/20">
                        <FolderOpen size={32} className="text-gray-400 group-hover:text-brand-blue transition-colors" />
                      </div>
                      <span className="bg-white/5 text-gray-300 px-3 py-1.5 rounded-xl text-xs font-black">
                        {group.resources.length} ملفات
                      </span>
                    </div>

                    <div className="space-y-2 mb-6">
                      <p className="text-xs font-bold text-brand-blue tracking-widest">{group.subject}</p>
                      <h3 className="text-xl font-black text-white leading-snug group-hover:text-brand-blue transition-colors">
                        {group.courseTitle}
                      </h3>
                    </div>

                    {group.teacher && (
                      <div className="flex items-center gap-3 pt-6 border-t border-white/5">
                        {group.teacher.photoURL ? (
                          <img src={group.teacher.photoURL} alt="Teacher" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <UserIcon size={14} className="text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm font-bold text-gray-400">{group.teacher.displayName}</span>
                      </div>
                    )}
                  </button>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
