import React, { useEffect, useState, useRef } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getTenantAuth, getTenantDb, getTenantStorage } from '../../lib/firebase';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  ArrowRight,
  HelpCircle,
  Video,
  ListOrdered,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Download,
  FileText,
  GripVertical,
  Upload,
} from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Lesson {
  id: string;
  courseId: string;
  title: string;
  videoUrl: string;
  pdfUrl?: string;
  quizUrl?: string;
  summary?: string;
  order: number;
  isFreePreview: boolean;
}

interface SortableLessonRowProps {
  lesson: Lesson;
  courseId: string;
  onEdit: (lesson: Lesson) => void;
  onDelete: (lesson: Lesson) => void;
  role?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

const handleFirestoreError = (
  error: unknown,
  operationType: OperationType,
  path: string | null
) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: getTenantAuth().currentUser?.uid,
      email: getTenantAuth().currentUser?.email,
      emailVerified: getTenantAuth().currentUser?.emailVerified,
      isAnonymous: getTenantAuth().currentUser?.isAnonymous,
      tenantId: getTenantAuth().currentUser?.tenantId,
      providerInfo:
        getTenantAuth().currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

const SortableLessonRow: React.FC<SortableLessonRowProps> = ({
  lesson,
  courseId,
  onEdit,
  onDelete,
  role,
}) => {
  const navigate = useNavigate();
  // Relative navigation is safer as it works regardless of /admin or /teacher prefix
  const handleEdit = () => navigate(`${lesson.id}/edit`);
  const handleStats = () => navigate(`${lesson.id}/stats`);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-white/5 transition-colors group ${isDragging ? 'bg-white/10 shadow-2xl' : ''}`}
    >
      <td className="p-6 w-10">
        <button
          {...attributes}
          {...listeners}
          className="p-2 text-slate-500 hover:text-brand-yellow cursor-grab active:cursor-grabbing transition-colors"
          title="اسحب لإعادة الترتيب"
        >
          <GripVertical size={20} />
        </button>
      </td>
      <td className="p-6">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-brand-yellow font-bold border border-white/10">
          {lesson.order}
        </div>
      </td>
      <td className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-blue/10 text-brand-blue rounded-lg flex items-center gap-2">
            <Video size={18} />
            <span
              className="text-xs"
              title={
                /youtube\.com|youtu\.be/.test(lesson.videoUrl || '')
                  ? 'YouTube'
                  : /drive\.google\.com/.test(lesson.videoUrl || '')
                    ? 'Google Drive'
                    : 'MP4 Direct'
              }
            >
              {/youtube\.com|youtu\.be/.test(lesson.videoUrl || '')
                ? '🔴'
                : /drive\.google\.com/.test(lesson.videoUrl || '')
                  ? '🟢'
                  : '🔵'}
            </span>
          </div>
          <span className="font-bold text-white group-hover:text-brand-yellow transition-colors">
            {lesson.title}
          </span>
          {lesson.pdfUrl && (
            <a
              href={lesson.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
              title="تحميل الملف الملحق"
            >
              <Download size={18} />
            </a>
          )}
        </div>
      </td>
      <td className="p-6">
        <span
          className={`px-3 py-1 text-xs font-bold rounded-full inline-flex items-center gap-1.5 ${
            lesson.isFreePreview
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
              : 'bg-white/10 text-slate-400 border border-white/10'
          }`}
        >
          {lesson.isFreePreview ? <Eye size={12} /> : <EyeOff size={12} />}
          {lesson.isFreePreview ? 'متاح للمعاينة' : 'محتوى مدفوع'}
        </span>
      </td>
      <td className="p-6 text-left">
        <div className="flex justify-end gap-2">
          <button
            onClick={handleStats}
            className="p-2.5 text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all hover:scale-110 border border-purple-500/20"
            title="الإحصائيات"
          >
            <HelpCircle size={20} />
          </button>
          <button
            onClick={handleEdit}
            className="p-2.5 text-brand-blue hover:bg-brand-blue/10 rounded-xl transition-all hover:scale-110 border border-brand-blue/20"
            title="تعديل الدرس"
          >
            <Edit2 size={20} />
          </button>
          <button
            onClick={() => onDelete(lesson)}
            className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-all hover:scale-110 border border-red-500/20"
            title="حذف الدرس"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export const ManageLessons: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [courseTitle, setCourseTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [lessonToDelete, setLessonToDelete] = useState<Lesson | null>(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [reorderSuccess, setReorderSuccess] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle body scroll for modals
  useEffect(() => {
    if (lessonToDelete) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [lessonToDelete]);

  const fetchLessons = async () => {
    if (!courseId || !profile) return;
    try {
      // 1. Fetch course (Dual Casing Fallback)
      let courseDoc;
      try {
        courseDoc = await getDoc(doc(getTenantDb(), 'Courses', courseId));
        if (!courseDoc.exists()) {
          courseDoc = await getDoc(doc(getTenantDb(), 'courses', courseId));
        }

        if (courseDoc.exists()) {
          const courseData = courseDoc.data();
          setCourseTitle(courseData.title);

          const isAdminUID =
            user?.uid === 'dufqUF8GN5dkfgbWGkmSdJeD0L62' || user?.email === 'admin@fahmni.com';
          if (profile.role === 'teacher' && !profile.isOwner && courseData.teacherId !== user?.uid && !isAdminUID) {
            alert('ليس لديك صلاحية لإدارة دروس هذا الكورس.');
            navigate('/teacher/courses');
            return;
          }
        }
      } catch (e: any) {
        throw new Error(`خطأ في جلب بيانات الكورس: ${e.message}`);
      }

      // 2. Fetch lessons (Dual Casing)
      try {
        const qUpper = query(collection(getTenantDb(), 'Lessons'), where('courseId', '==', courseId));
        const qLower = query(collection(getTenantDb(), 'lessons'), where('courseId', '==', courseId));

        const [snapUpper, snapLower] = await Promise.all([getDocs(qUpper), getDocs(qLower)]);
        const allDocs = [...snapUpper.docs, ...snapLower.docs].map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Lesson
        );

        // Deduplicate and sort
        const lessonsMap = new Map();
        allDocs.forEach((l) => lessonsMap.set(l.id, l));
        const uniqueLessons = Array.from(lessonsMap.values());

        setLessons(uniqueLessons.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)));
      } catch (e: any) {
        throw new Error(`خطأ في جلب قائمة الدروس: ${e.message}`);
      }
    } catch (err: any) {
      console.error('Error fetching lessons:', err);
      const authInfo = getTenantAuth().currentUser
        ? ` (UID: ${getTenantAuth().currentUser!.uid}, Email: ${getTenantAuth().currentUser!.email})`
        : ' (Not logged in)';
      const dbInfo = ` (Database ID: ai-studio-17f4701a-a7f4-4ee0-808c-1a71c96228c0)`;
      alert(`فشل التحميل: ${err.message}${authInfo}${dbInfo}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, [courseId]);

  const handleDelete = async (id: string) => {
    // Optimistic UI Update
    setLessons((prev) => prev.filter((lesson) => lesson.id !== id));
    setLessonToDelete(null);

    try {
      await deleteDoc(doc(getTenantDb(), 'Lessons', id));
      // fetchLessons(); // Not strictly needed unless backend mutates order implicitly
    } catch (error) {
      console.error('Error deleting lesson:', error);
      fetchLessons(); // Revert on failure
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = lessons.findIndex((l) => l.id === String(active.id));
      const newIndex = lessons.findIndex((l) => l.id === String(over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        const newLessons: Lesson[] = arrayMove(lessons, oldIndex, newIndex);

        // Update local state immediately for smooth UI
        setLessons(
          newLessons.map((lesson: Lesson, index: number) => ({
            ...lesson,
            order: index + 1,
          }))
        );

        setReordering(true);
        try {
          const batch = writeBatch(getTenantDb());
          newLessons.forEach((lesson: Lesson, index: number) => {
            const lessonRef = doc(getTenantDb(), 'Lessons', lesson.id);
            batch.update(lessonRef, { order: index + 1 });
          });
          try {
            await batch.commit();
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'lessons (batch reorder)');
          }
          setReorderSuccess(true);
          setTimeout(() => setReorderSuccess(false), 3000);
        } catch (err) {
          console.error('Error updating lesson order:', err);
          alert('فشل تحديث ترتيب الدروس. يرجى المحاولة مرة أخرى.');
          fetchLessons(); // Revert to server state
        } finally {
          setReordering(false);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button
            onClick={() =>
              navigate('/teacher/courses')
            }
            className="text-brand-blue hover:text-brand-yellow flex items-center gap-2 mb-4 transition-colors group"
          >
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            <span>العودة لإدارة الدورات</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-black text-white font-display">
            إدارة حصص الكورس
          </h1>
          <p className="text-slate-400 font-bold mt-1">{courseTitle || 'جاري التحميل...'}</p>
        </div>
        <button
          onClick={() => navigate(`new`)}
          className="bg-brand-blue hover:bg-brand-blue/90 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-2xl flex items-center gap-3 transition-all shadow-xl shadow-brand-blue/20 active:scale-95 group font-black"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
          <span className="hidden sm:inline">إضافة حصة جديدة</span>
          <span className="sm:hidden">إضافة حصة</span>
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-sm">
                  <th className="p-6 font-medium w-10"></th>
                  <th className="p-6 font-medium">الترتيب</th>
                  <th className="p-6 font-medium">عنوان الدرس</th>
                  <th className="p-6 font-medium">معاينة مجانية</th>
                  <th className="p-6 font-medium text-left">الإجراءات</th>
                </tr>
              </thead>
              <SortableContext
                items={lessons.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody className="divide-y divide-white/5">
                  {lessons.map((lesson) => (
                    <SortableLessonRow
                      key={lesson.id}
                      lesson={lesson}
                      courseId={courseId || ''}
                      onEdit={() => {}}
                      onDelete={setLessonToDelete}
                      role={profile?.role}
                    />
                  ))}
                  {lessons.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center">
                        <div className="flex flex-col items-center gap-4 text-slate-500">
                          <Video size={48} className="opacity-20" />
                          <p>لا توجد دروس في هذه الدورة بعد. ابدأ بإضافة أول درس!</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
        <AnimatePresence>
          {reordering && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-brand-blue/10 text-brand-blue p-2 text-center text-sm font-bold flex items-center justify-center gap-2"
            >
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-blue"></div>
              جاري حفظ الترتيب الجديد...
            </motion.div>
          )}
          {reorderSuccess && !reordering && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-emerald-500/10 text-emerald-400 p-2 text-center text-sm font-bold flex items-center justify-center gap-2"
            >
              <Check size={16} />
              تم تحديث ترتيب الدروس بنجاح!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {lessonToDelete && (
          <div className="modal-backdrop flex items-center justify-center p-2 md:p-6 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card w-[90%] md:max-w-[500px] p-8 shadow-2xl border-white/10 text-center modal-fixed-center"
            >
              <div className="w-20 h-20 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">حذف الدرس</h3>
              <p className="text-slate-400 mb-8 leading-relaxed">
                هل أنت متأكد من حذف درس{' '}
                <span className="text-white font-bold">{lessonToDelete.title}</span>؟
                <br />
                <span className="text-red-400 text-sm mt-2 block font-medium">
                  هذا الإجراء لا يمكن التراجع عنه.
                </span>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setLessonToDelete(null)}
                  className="px-6 py-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => handleDelete(lessonToDelete.id)}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold shadow-lg shadow-red-600/20"
                >
                  حذف نهائي
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
