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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ScheduleSlot {
  day: string;
  time: string;
}

interface Group {
  id: string;
  name: string;
  centerId: string;
  teacherId: string;
  subjectId: string;
  day: string;
  time: string;
  schedules?: ScheduleSlot[];
  capacity: number;
  studentCount?: number;
}

const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

const formatTime12h = (time24: string) => {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let hour = parseInt(parts[0]);
  const min = parts[1];
  const ampm = hour >= 12 ? 'م' : 'ص';
  hour = hour % 12 || 12;
  return `${hour}:${min} ${ampm}`;
};

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
    schedules: [{ day: DAYS[0], time: '16:00' }] as ScheduleSlot[],
    capacity: 30,
  });

  const [students, setStudents] = useState<any[]>([]);

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

    // 4. Fetch All Students dynamically for group counts
    import('../../services/dbRouter').then(({ dbRouter }) => {
      dbRouter.getAllStudents().then((allStus) => {
        setStudents(allStus);
      });
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
      const validSchedules = formData.schedules.filter(s => s.day && s.time);
      const daySummary = validSchedules.map(s => s.day).join(' و ');
      const timeSummary = validSchedules.map(s => `${s.day} (${formatTime12h(s.time)})`).join('، ');

      const payload = {
        name: formData.name,
        centerId: formData.centerId,
        teacherId: formData.teacherId,
        subjectId: formData.subjectId || '',
        day: daySummary || DAYS[0],
        time: timeSummary || '16:00',
        schedules: validSchedules,
        capacity: formData.capacity,
      };

      if (editingId) {
        await updateDoc(doc(db, 'groups', editingId), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'groups'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      setFormData({
        name: '',
        centerId: '',
        teacherId: '',
        subjectId: '',
        schedules: [{ day: DAYS[0], time: '16:00' }],
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
    let loadedSchedules: ScheduleSlot[] = [];
    if (group.schedules && Array.isArray(group.schedules) && group.schedules.length > 0) {
      loadedSchedules = group.schedules;
    } else {
      loadedSchedules = [{ day: group.day || DAYS[0], time: group.time || '16:00' }];
    }

    setFormData({
      name: group.name,
      centerId: group.centerId,
      teacherId: group.teacherId,
      subjectId: group.subjectId || '',
      schedules: loadedSchedules,
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
              تنظيم المجموعات الفعلية، المدرسين، والمواعيد المتعددة لكل مجموعة
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setFormData({
              name: '',
              centerId: '',
              teacherId: '',
              subjectId: '',
              schedules: [{ day: DAYS[0], time: '16:00' }],
              capacity: 30,
            });
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
                      placeholder="مثلاً: فيزياء السبت والأربعاء 4 م"
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

                  {/* 🗓️ Dynamic Multiple Schedule Slots */}
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-black text-gray-300">
                        مواعيد وأيام الحصص للمجموعة
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            schedules: [...prev.schedules, { day: DAYS[0], time: '16:00' }],
                          }));
                        }}
                        className="text-xs font-black text-brand-yellow hover:underline flex items-center gap-1 bg-brand-yellow/10 px-3 py-1.5 rounded-xl border border-brand-yellow/20"
                      >
                        <Plus size={14} /> إضافة ميعاد آخر
                      </button>
                    </div>

                    {formData.schedules.map((slot, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 bg-slate-900/90 p-3 rounded-2xl border border-white/10"
                      >
                        <div className="flex-1 space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 mr-1">اليوم</span>
                          <select
                            value={slot.day}
                            onChange={(e) => {
                              const updated = [...formData.schedules];
                              updated[index].day = e.target.value;
                              setFormData({ ...formData, schedules: updated });
                            }}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-white text-xs font-bold outline-none"
                          >
                            {DAYS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex-1 space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 mr-1">الوقت</span>
                          <input
                            type="time"
                            value={slot.time}
                            onChange={(e) => {
                              const updated = [...formData.schedules];
                              updated[index].time = e.target.value;
                              setFormData({ ...formData, schedules: updated });
                            }}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-white text-xs font-bold outline-none"
                          />
                        </div>

                        {formData.schedules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                schedules: prev.schedules.filter((_, i) => i !== index),
                              }));
                            }}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all self-end"
                            title="حذف هذا الميعاد"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2">
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
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                      <span className="flex items-center gap-2">
                        <Home size={14} className="text-brand-blue" /> {getCenterName(group.centerId)}
                      </span>
                      <span className="flex items-center gap-2">
                        <User size={14} className="text-brand-yellow" /> {getTeacherName(group.teacherId)}
                      </span>
                    </div>

                    {/* Schedule Badges */}
                    <div className="pt-2">
                      <span className="block text-[10px] font-bold text-gray-400 mb-1">
                        مواعيد المجموعة:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {group.schedules && group.schedules.length > 0 ? (
                          group.schedules.map((s, idx) => (
                            <div
                              key={idx}
                              className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-amber-300"
                            >
                              <Calendar size={12} className="text-amber-400" />
                              <span>{s.day}</span>
                              <Clock size={12} className="text-gray-400 mr-1" />
                              <span className="text-gray-300">{formatTime12h(s.time)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-amber-300">
                            <Calendar size={12} className="text-amber-400" />
                            <span>{group.day || 'غير محدد'}</span>
                            <Clock size={12} className="text-gray-400 mr-1" />
                            <span className="text-gray-300">{formatTime12h(group.time)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {(() => {
                  const count = students.filter(
                    (s) => s.groupId === group.id || s.group_id === group.id
                  ).length;
                  const capacity = group.capacity || 30;
                  const percent = Math.min(100, Math.round((count / capacity) * 100));

                  return (
                    <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-amber-400" />
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                          عدد الطلاب الحالي
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-amber-400">
                          {count} / {capacity}
                        </span>
                        <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-amber-500 to-amber-300 h-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
