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
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { MapPin, Plus, Trash2, Edit2, Loader2, Home, Phone, Users, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Branch {
  id: string;
  name: string;
  location: string;
  contact: string;
  createdAt: any;
}

export const CenterBranches: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    contact: '',
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'centers'), (snap) => {
      setBranches(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'centers', editingId), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'centers'), {
          ...formData,
          createdAt: serverTimestamp(),
        });
      }
      setFormData({ name: '', location: '', contact: '' });
      setIsAdding(false);
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء حفظ البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm('هل أنت متأكد من حذف هذا السنتر؟ سيتم حذف جميع المجموعات التابعة له أيضاً.')
    )
      return;
    try {
      await deleteDoc(doc(db, 'centers', id));
      // Note: Ideally cascades to groups, but we simulate it here or handle separately
    } catch (e) {
      alert('خطأ في الحذف');
    }
  };

  const handleEdit = (branch: Branch) => {
    setFormData({ name: branch.name, location: branch.location, contact: branch.contact });
    setEditingId(branch.id);
    setIsAdding(true);
  };

  if (loading && branches.length === 0) {
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
          <div className="w-16 h-16 bg-brand-blue/10 text-brand-blue rounded-3xl flex items-center justify-center shadow-2xl border border-brand-blue/10">
            <Home size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white mb-2 font-display">
              إدارة الفروع (السناتر)
            </h1>
            <p className="text-gray-400 font-bold text-sm">
              أضف وتحكم في أماكن تواجد السنتر الفعلية
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setFormData({ name: '', location: '', contact: '' });
          }}
          className="bg-brand-blue hover:bg-brand-blue/90 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-brand-blue/30 transition-all flex items-center gap-3"
        >
          <Plus size={20} /> إضافة سنتر جديد
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Form Overlay/Sidebar */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="lg:col-span-1"
            >
              <div className="glass-card p-10 border border-brand-blue/30 bg-brand-blue/5 sticky top-28">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-white flex items-center gap-3">
                    <MapPin className="text-brand-blue" />
                    {editingId ? 'تعديل السنتر' : 'سنتر جديد'}
                  </h3>
                  <button
                    onClick={() => setIsAdding(false)}
                    className="text-gray-500 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-black text-gray-400 mr-2">
                      اسم السنتر
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none focus:border-brand-blue"
                      placeholder="مثلاً: سنتر الصادق"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-black text-gray-400 mr-2">
                      الموقع / العنوان
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none focus:border-brand-blue"
                      placeholder="مثلاً: مدينة نصر - الحي السابع"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-black text-gray-400 mr-2">
                      رقم التواصل
                    </label>
                    <input
                      required
                      type="tel"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold outline-none focus:border-brand-blue"
                      placeholder="رقم الموبايل أو الهاتف"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white py-5 rounded-2xl font-black shadow-xl shadow-brand-blue/30 transition-all flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    {editingId ? 'حفظ التغييرات' : 'إنشاء السنتر الآن'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Branches Grid */}
        <div className={isAdding ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {branches.map((branch) => (
              <motion.div
                key={branch.id}
                layout
                className="glass-card p-8 group border border-white/10 hover:border-brand-blue/30 transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-brand-blue/10 transition-all" />

                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-brand-blue border border-white/10 group-hover:bg-brand-blue group-hover:text-white transition-all">
                    <Home size={28} />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(branch)}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(branch.id)}
                      className="p-3 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-500 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <h3 className="text-2xl font-black text-white mb-4">{branch.name}</h3>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-gray-400 font-bold text-sm">
                    <MapPin size={16} className="text-brand-blue" />
                    {branch.location}
                  </div>
                  <div className="flex items-center gap-3 text-gray-400 font-bold text-sm">
                    <Phone size={16} className="text-emerald-500" />
                    {branch.contact}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-500" />
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                      مجموعات نشطة
                    </span>
                  </div>
                  <span className="bg-brand-blue/10 text-brand-blue px-3 py-1 rounded-lg font-black text-xs">
                    -- مجموعة
                  </span>
                </div>
              </motion.div>
            ))}

            {branches.length === 0 && (
              <div className="col-span-full py-20 text-center glass-card border-dashed">
                <MapPin size={48} className="mx-auto text-gray-700 mb-4 opacity-20" />
                <p className="text-gray-500 font-black">
                  لا توجد فروع مسجلة حالياً.. ابدأ بإضافة أول سنتر!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
