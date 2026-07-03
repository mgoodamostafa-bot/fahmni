import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { MessageSquare, Send, BookOpen, User, Clock, MessageCircle, Check, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Discussion {
  id: string;
  courseId: string;
  courseTitle: string;
  parentId?: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string;
  createdAt: any;
  isDeleted?: boolean;
}

export const TeacherDiscussions: React.FC = () => {
  const { profile } = useAuth();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [sending, setSending] = useState<string | null>(null);
  const [userPhotos, setUserPhotos] = useState<{ [uid: string]: string }>({});

  useEffect(() => {
    if (!profile?.uid) return;

    const fetchTeacherContent = async () => {
      try {
        // 1. Fetch teacher's courses
        const coursesQ = query(collection(db, 'Courses'), where('teacherId', '==', profile.uid));
        const coursesSnap = await getDocs(coursesQ);
        const coursesList = coursesSnap.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title,
        }));
        setCourses(coursesList);

        const courseIds = coursesList.map((c) => c.id);
        if (courseIds.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Real-time subscription to discussions (Index-Free Query)
        const limitedCourseIds = courseIds.slice(0, 10);
        const q = query(
          collection(db, 'Discussions'),
          where('courseId', 'in', limitedCourseIds)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const discList = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              courseTitle:
                coursesList.find((c) => c.id === data.courseId)?.title || 'كورس غير معروف',
            } as Discussion;
          });
          
          // Sort chronologically in-memory to avoid composite index requirements
          discList.sort((a, b) => {
            const tA = a.createdAt?.seconds || 0;
            const tB = b.createdAt?.seconds || 0;
            return tB - tA;
          });
          
          setDiscussions(discList);
          setLoading(false);
        }, (error) => {
          console.error('Discussions subscription failed:', error);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (err) {
        console.error('Error setting up discussions:', err);
        setLoading(false);
      }
    };

    fetchTeacherContent();
  }, [profile?.uid]);

  // Fetch user photos dynamically when discussions list changes
  useEffect(() => {
    if (discussions.length === 0) return;

    const fetchPhotos = async () => {
      const uniqueUids = Array.from(new Set(discussions.map((d) => d.userId)));
      const uidsToFetch = uniqueUids.filter((uid) => userPhotos[uid] === undefined);

      if (uidsToFetch.length === 0) return;

      const newPhotos = { ...userPhotos };
      await Promise.all(
        uidsToFetch.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              newPhotos[uid] = userSnap.data().imageUrl || '';
            } else {
              newPhotos[uid] = '';
            }
          } catch (e) {
            console.error('Error fetching photo for user:', uid, e);
            newPhotos[uid] = '';
          }
        })
      );
      setUserPhotos(newPhotos);
    };

    fetchPhotos();
  }, [discussions]);

  const handleSendReply = async (courseId: string, parentId: string) => {
    const text = replyText[parentId];
    if (!text?.trim() || !profile) return;

    setSending(parentId);
    try {
      await addDoc(collection(db, 'Discussions'), {
        courseId,
        parentId, // Store parentId for nested replies
        userId: profile.uid,
        userName: profile.displayName || 'مدرس معتمد',
        userRole: 'teacher',
        content: text,
        createdAt: serverTimestamp(),
      });
      setReplyText((prev) => ({ ...prev, [parentId]: '' }));
    } catch (err) {
      console.error('Error sending reply:', err);
      alert('فشل إرسال الرد.');
    } finally {
      setSending(null);
    }
  };

  const handleDeleteDiscussion = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التعليق؟')) return;
    try {
      const hasReplies = discussions.some(d => d.parentId === id);
      if (hasReplies) {
        await updateDoc(doc(db, 'Discussions', id), {
          content: 'تم حذف هذا التعليق.',
          isDeleted: true
        });
      } else {
        await deleteDoc(doc(db, 'Discussions', id));
      }
      alert('تم حذف التعليق بنجاح.');
    } catch (err) {
      console.error('Error deleting discussion:', err);
      alert('فشل حذف التعليق.');
    }
  };

  // Filter discussions
  const filteredDiscussions =
    selectedCourse === 'all'
      ? discussions
      : discussions.filter((d) => d.courseId === selectedCourse);

  // Split into Posts (top-level questions) and Replies
  const posts = filteredDiscussions.filter(d => !d.parentId);
  const replies = filteredDiscussions.filter(d => !!d.parentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-5xl font-black text-white font-display tracking-tight">
            المناقشات
          </h1>
          <p className="text-gray-500 font-bold flex items-center gap-2 text-sm sm:text-base">
            <MessageSquare size={18} className="text-emerald-500" />
            تواصل مع طلابك وأجب على استفساراتهم بشكل مباشر.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCourse('all')}
            className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all whitespace-nowrap ${
              selectedCourse === 'all'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            الكل
          </button>
          {courses.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCourse(c.id)}
              className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all whitespace-nowrap ${
                selectedCourse === c.id
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <AnimatePresence mode="popLayout">
          {posts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-16 text-center border-dashed border-2 border-white/10 bg-transparent rounded-[2.5rem]"
            >
              <div className="w-16 h-16 bg-emerald-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-black text-white mb-1">لا توجد مناقشات بعد</h3>
              <p className="text-gray-500 font-bold text-sm">
                بمجرد بدء الطلاب بالتعليق على دروسك، ستظهر الرسائل هنا.
              </p>
            </motion.div>
          ) : (
            posts.map((post, i) => {
              const postReplies = replies.filter(r => r.parentId === post.id);
              return (
                <div key={post.id} className="space-y-3">
                  {/* Top-Level Post */}
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-5 sm:p-6 bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-[2rem] hover:border-white/15 transition-all duration-300 relative group"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {post.isDeleted ? (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 text-gray-500 border border-white/5 flex items-center justify-center">
                            <User size={20} className="sm:w-6 sm:h-6" />
                          </div>
                        ) : userPhotos[post.userId] ? (
                          <img
                            src={userPhotos[post.userId]}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border border-white/10"
                            alt={post.userName}
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                            <User size={20} className="sm:w-6 sm:h-6" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className="text-sm sm:text-base font-black text-white truncate whitespace-nowrap">
                              {post.isDeleted ? 'تعليق محذوف' : post.userName}
                            </h4>
                            {!post.isDeleted && post.userRole === 'teacher' && (
                              <>
                                <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full w-3.5 h-3.5 shrink-0" title="مدرس معتمد">
                                  <Check size={8} strokeWidth={4} />
                                </span>
                                <span className="text-[8px] px-1.5 py-0.5 bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 rounded-full font-bold">
                                  مدرس
                                </span>
                              </>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] sm:text-[10px] text-gray-500 font-bold flex items-center gap-1">
                              <Clock size={10} className="opacity-50" />
                              {post.createdAt?.toDate
                                ? new Date(post.createdAt.toDate()).toLocaleDateString('ar-EG')
                                : 'الآن'}
                            </span>
                            {!post.isDeleted && (
                              <button
                                onClick={() => handleDeleteDiscussion(post.id)}
                                className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="حذف التعليق"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-gray-600">
                          <BookOpen size={10} className="opacity-50" />
                          {post.courseTitle}
                        </div>

                        <div className={`${post.isDeleted ? 'text-gray-500 italic' : 'text-gray-300'} text-xs sm:text-sm font-semibold leading-relaxed mt-3`}>
                          {post.content}
                        </div>

                        {/* Reply Form */}
                        <div className="mt-4 pt-4 border-t border-white/5 relative flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="اكتب ردك ومناقشتك للرد على هذا الطالب..."
                            value={replyText[post.id] || ''}
                            onChange={(e) =>
                              setReplyText((prev) => ({ ...prev, [post.id]: e.target.value }))
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl py-2.5 pr-4 pl-12 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all font-bold text-xs sm:text-sm text-white"
                          />
                          <button
                            disabled={sending === post.id}
                            onClick={() => handleSendReply(post.courseId, post.id)}
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg sm:rounded-xl transition-all disabled:opacity-50"
                          >
                            {sending === post.id ? (
                              <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Send size={14} className="-rotate-90" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Nested Replies (Thread-Tree style) */}
                  {postReplies.length > 0 && (
                    <div className="mr-4 sm:mr-8 md:mr-10 pr-4 border-r border-white/5 space-y-3 mt-2">
                      {postReplies.map((reply) => (
                        <motion.div
                          key={reply.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-4 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-xl sm:rounded-2xl relative"
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative shrink-0">
                              {userPhotos[reply.userId] ? (
                                <img
                                  src={userPhotos[reply.userId]}
                                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-emerald-500/10"
                                  alt={reply.userName}
                                />
                              ) : (
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                                  <User size={16} className="sm:w-5 sm:h-5" />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                                <div className="flex items-center gap-1 min-w-0">
                                  <h5 className="text-xs sm:text-sm font-black text-emerald-400 truncate whitespace-nowrap">
                                    {reply.userName}
                                  </h5>
                                  {reply.userRole === 'teacher' && (
                                    <>
                                      <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full w-3 h-3 shrink-0" title="مدرس معتمد">
                                        <Check size={8} strokeWidth={4} />
                                      </span>
                                      <span className="text-[7px] px-1 py-0.5 bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 rounded-full font-bold">
                                        مدرس
                                      </span>
                                    </>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[9px] text-gray-500 font-bold flex items-center gap-0.5">
                                    <Clock size={8} className="opacity-50" />
                                    {reply.createdAt?.toDate
                                      ? new Date(reply.createdAt.toDate()).toLocaleDateString('ar-EG')
                                      : 'الآن'}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteDiscussion(reply.id)}
                                    className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="حذف الرد"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="text-gray-300 text-xs sm:text-sm font-medium leading-relaxed mt-1">
                                {reply.content}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
