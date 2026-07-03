import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Calendar,
  Clock,
  User,
  Home,
  BookOpen,
  Save,
  X,
  Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Group {
  id: string;
  name: string;
  centerId: string;
  teacherId: string;
  subjectId: string;
  day: string;
  time: string;
  capacity: number;
  studentCount?: number;
}

const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export const GroupManagement: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    centerId: '',
    teacherId: '',
    subjectId: '',
    day: DAYS[0],
    time: '16:00',
    capacity: 30,
  });

  useEffect(() => {
    // 1. Fetch Centers
    const unsubCenters = onSnapshot(collection(db, 'centers'), (snap) => {
      setCenters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // 2. Fetch Teachers
    const qTeachers = query(collection(db, 'users'), where('role', '==', 'teacher'));
    getDocs(qTeachers).then((snap) => {
      setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // 3. Fetch Groups
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Group));
      setLoading(false);
    });

    return () => {
      unsubCenters();
      unsubGroups();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'groups', editingId), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'groups'), {
          ...formData,
          createdAt: serverTimestamp(),
        });
      }
      setFormData({
        name: '',
        centerId: '',
        teacherId: '',
        subjectId: '',
        day: DAYS[0],
        time: '16:00',
        capacity: 30,
      });
      setIsAdding(false);
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert('خطأ في حفظ المجموعة');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المجموعة؟')) return;
    await deleteDoc(doc(db, 'groups', id));
  };

  const handleEdit = (group: Group) => {
    setFormData({
      name: group.name,
      centerId: group.centerId,
      teacherId: group.teacherId,
      subjectId: group.subjectId,
      day: group.day,
      time: group.time,
      capacity: group.capacity,
    });
    setEditingId(group.id);
    setIsAdding(true);
  };

  const getCenterName = (id: string) => centers.find((c) => c.id === id)?.name || 'غير معروف';
  const getTeacherName = (id: string) =>
    teachers.find((t) => t.id === id)?.displayName || 'غير معروف';

  if (loading && groups.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-brand-yellow/10 text-brand-yellow rounded-3xl flex items-center justify-center shadow-2xl border border-brand-yellow/10">
            <Users size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white mb-2 font-display">
              إدارة المجموعات (Groups)
            </h1>
            <p className="text-gray-400 font-bold text-sm">
              تنظيم المجموعات الفعلية، المدرسين، والمواعيد
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
          }}
          className="bg-brand-yellow hover:bg-brand-yellow/90 text-slate-950 px-8 py-4 rounded-2xl font-black shadow-xl shadow-brand-yellow/30 transition-all flex items-center gap-3"
        >
          <Plus size={20} /> إنشاء مجموعة جديدة
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="lg:col-span-1"
            >
              <div className="glass-card p-8 border border-brand-yellow/30 bg-brand-yellow/5 sticky top-28">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-white flex items-center gap-3">
                    <Plus className="text-brand-yellow" />
                    {editingId ? 'تعديل المجموعة' : 'مجموعة جديدة'}
                  </h3>
                  <button
                    onClick={() => setIsAdding(false)}
                    className="text-gray-500 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-sm font-black text-gray-400 mr-2">
                      اسم المجموعة / الكود
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none"
                      placeholder="مثلاً: فيزياء الأحد 4 م"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-black text-gray-400 mr-2">
                      السنتر (الفرع)
                    </label>
                    <select
                      required
                      value={formData.centerId}
                      onChange={(e) => setFormData({ ...formData, centerId: e.target.value })}
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none appearance-none"
                    >
                      <option value="">اختر السنتر...</option>
                      {centers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-black text-gray-400 mr-2">
                      المدرس المسؤول
                    </label>
                    <select
                      required
                      value={formData.teacherId}
                      onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none appearance-none"
                    >
                      <option value="">اختر المدرس...</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-black text-gray-400 mr-2">اليوم</label>
                      <select
                        required
                        value={formData.day}
                        onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none appearance-none"
                      >
                        {DAYS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-black text-gray-400 mr-2">الوقت</label>
                      <input
                        required
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-black text-gray-400 mr-2">
                      السعة القصوى (طالب)
                    </label>
                    <input
                      required
                      type="number"
                      value={formData.capacity}
                      onChange={(e) =>
                        setFormData({ ...formData, capacity: parseInt(e.target.value) })
                      }
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-yellow hover:bg-brand-yellow/90 text-slate-950 py-5 rounded-2xl font-black shadow-xl transition-all flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    {editingId ? 'تعديل المجموعة' : 'إنشاء المجموعة'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={isAdding ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {groups.map((group) => (
              <div
                key={group.id}
                className="glass-card p-6 border border-white/10 hover:border-brand-yellow/20 transition-all flex flex-col justify-between"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-brand-yellow border border-white/10">
                    <BookOpen size={24} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(group)}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(group.id)}
                      className="p-3 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-500 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-black text-white">{group.name}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                      <Home size={14} className="text-brand-blue" /> {getCenterName(group.centerId)}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                      <User size={14} className="text-brand-yellow" />{' '}
                      {getTeacherName(group.teacherId)}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                      <Calendar size={14} className="text-gray-500" /> {group.day}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                      <Clock size={14} className="text-gray-500" /> {group.time}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-slate-500" />
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                      اكتمال العدد
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">0 / {group.capacity}</span>
                    <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="bg-brand-yellow h-full" style={{ width: '0%' }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
