import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDoc,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Send, User, Clock, MessageCircle, Check, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Discussion {
  id: string;
  courseId: string;
  parentId?: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string;
  createdAt: any;
  isDeleted?: boolean;
}

interface CourseDiscussionsProps {
  courseId: string;
  teacherId?: string;
}

export const CourseDiscussions: React.FC<CourseDiscussionsProps> = ({ courseId, teacherId }) => {
  const { user, profile } = useAuth();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [userPhotos, setUserPhotos] = useState<{ [uid: string]: string }>({});

  useEffect(() => {
    if (!courseId) return;

    // Index-free query by removing orderBy
    const q = query(
      collection(db, 'Discussions'),
      where('courseId', '==', courseId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const discList = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as Discussion
        );

        // Sort chronologically in-memory to avoid composite index requirements
        discList.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });

        setDiscussions(discList);
        setLoading(false);
      },
      (err) => {
        console.error('Error setting up discussions listener:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [courseId]);

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || !profile) return;

    setSending(true);
    try {
      // 1. Add discussion message
      await addDoc(collection(db, 'Discussions'), {
        courseId,
        userId: user.uid,
        userName: profile.displayName || 'طالب غامض',
        userRole: profile.role || 'student',
        content: message,
        createdAt: serverTimestamp(),
      });

      // 2. Notify Teacher (if not self)
      if (teacherId && teacherId !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: teacherId,
          type: 'info',
          message: `طالب كتب تعليقاً جديداً: "${message.substring(0, 50)}..."`,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      setMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('فشل إرسال الرسالة.');
    } finally {
      setSending(false);
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

  const isTeacherOrAdmin = profile?.role === 'teacher' || profile?.role === 'admin';

  // Split into Posts (top-level questions) and Replies
  const posts = discussions.filter(d => !d.parentId);
  const replies = discussions.filter(d => !!d.parentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-right" dir="rtl">
      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="relative group">
        <input
          type="text"
          placeholder="اطرح سؤالاً أو اكتب تعليقاً..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-5 pr-8 pl-20 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all font-bold text-white placeholder:text-gray-600"
        />
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="absolute left-3 top-1/2 -translate-y-1/2 bg-brand-blue hover:bg-brand-blue/90 text-white px-6 py-3 rounded-2xl shadow-lg shadow-brand-blue/30 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={20} className="-rotate-90" />
          )}
          <span className="hidden sm:inline font-black">إرسال</span>
        </button>
      </form>

      {/* Messages List */}
      <div className="space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
        <AnimatePresence mode="popLayout">
          {posts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 text-center space-y-4 opacity-40 bg-white/2 rounded-[2rem] border-2 border-dashed border-white/10"
            >
              <MessageCircle className="w-16 h-16 mx-auto mb-4" />
              <p className="text-xl font-black">لا توجد مناقشات بعد</p>
              <p className="text-sm font-bold">كن أول من يبدأ الحوار!</p>
            </motion.div>
          ) : (
            posts.map((post, i) => {
              const postReplies = replies.filter(r => r.parentId === post.id);
              return (
                <div key={post.id} className="space-y-3">
                  {/* Top-Level Post */}
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-5 sm:p-6 rounded-[2rem] border bg-white/5 border-white/10 transition-all duration-300 relative group"
                  >
                    <div className="flex items-start gap-3 sm:gap-4 mb-4">
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
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-brand-blue/20 text-brand-blue border border-brand-blue/20 flex items-center justify-center">
                            <User size={20} className="sm:w-6 sm:h-6" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className="text-sm sm:text-base font-black tracking-tight truncate text-white whitespace-nowrap">
                              {post.isDeleted ? 'تعليق محذوف' : post.userName}
                            </h4>
                            {!post.isDeleted && post.userRole === 'teacher' && (
                              <>
                                {/* Verified Blue Badge */}
                                <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full w-3.5 h-3.5 shrink-0 shadow-sm" title="مدرس معتمد">
                                  <Check size={8} strokeWidth={4} />
                                </span>
                                <span className="text-[8px] px-1.5 py-0.5 bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 rounded-full font-bold">
                                  مدرس
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] sm:text-[10px] text-gray-500 font-bold flex items-center gap-1.5">
                              <Clock size={12} className="opacity-50" />
                              {post.createdAt?.toDate
                                ? new Date(post.createdAt.toDate()).toLocaleDateString('ar-EG')
                                : 'الآن'}
                            </span>
                            
                            {/* Delete Button for Teacher/Admin or Self */}
                            {!post.isDeleted && (isTeacherOrAdmin || user?.uid === post.userId) && (
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
                      </div>
                    </div>

                    <div className={`${post.isDeleted ? 'text-gray-500 italic' : 'text-gray-300 font-bold'} leading-relaxed pr-12 sm:pr-16 text-xs sm:text-sm`}>
                      {post.content}
                    </div>
                  </motion.div>

                  {/* Replies (Nested with Thread-tree line) */}
                  {postReplies.length > 0 && (
                    <div className="mr-4 sm:mr-8 md:mr-10 pr-4 border-r border-white/5 space-y-3 mt-2">
                      {postReplies.map((reply) => (
                        <motion.div
                          key={reply.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-4 rounded-[2rem] border bg-emerald-500/[0.02] border-emerald-500/10 transition-all duration-300 relative group"
                        >
                          <div className="flex items-start gap-3 mb-2">
                            {/* Avatar */}
                            <div className="relative shrink-0">
                              {userPhotos[reply.userId] ? (
                                <img
                                  src={userPhotos[reply.userId]}
                                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-emerald-500/10"
                                  alt={reply.userName}
                                />
                              ) : (
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 flex items-center justify-center">
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
                                      {/* Verified Blue Badge */}
                                      <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full w-3.5 h-3.5 shrink-0 shadow-sm" title="مدرس معتمد">
                                        <Check size={8} strokeWidth={4} />
                                      </span>
                                      <span className="text-[7px] px-1.5 py-0.5 bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 rounded-full font-bold">
                                        مدرس
                                      </span>
                                    </>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[9px] sm:text-[10px] text-gray-500 font-bold flex items-center gap-1.5">
                                    <Clock size={12} className="opacity-50" />
                                    {reply.createdAt?.toDate
                                      ? new Date(reply.createdAt.toDate()).toLocaleDateString('ar-EG')
                                      : 'الآن'}
                                  </span>
                                  
                                  {/* Delete Button for Teacher/Admin or Self */}
                                  {(isTeacherOrAdmin || user?.uid === reply.userId) && (
                                    <button
                                      onClick={() => handleDeleteDiscussion(reply.id)}
                                      className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                      title="حذف الرد"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-gray-300 font-medium leading-relaxed pr-10 sm:pr-14 text-xs sm:text-sm">
                            {reply.content}
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
