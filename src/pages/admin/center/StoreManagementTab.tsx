import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getTenantDb } from '../../../lib/firebase';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Plus, Trash2, Edit2, Search, CheckCircle, Package, RefreshCw, X, Loader2, Award, ClipboardList } from 'lucide-react';

interface StoreItem {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  stock: number;
  imageUrl: string;
  type: 'coupon' | 'physical' | 'booklet';
  value: string;
  createdAt: any;
}

interface StorePurchase {
  id: string;
  studentUid: string;
  studentName: string;
  studentId: string;
  itemId: string;
  itemTitle: string;
  pointsSpent: number;
  status: 'pending' | 'delivered';
  claimedAt: any;
  claimedBy: string;
}

export const StoreManagementTab: React.FC = () => {
  const db = getTenantDb();
  const { profile } = useAuth();
  
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'requests'>('items');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [items, setItems] = useState<StoreItem[]>([]);
  const [requests, setRequests] = useState<StorePurchase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals / Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    pointsCost: '100',
    stock: '10',
    imageUrl: '',
    type: 'physical' as 'coupon' | 'physical' | 'booklet',
    value: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      let itemsList: StoreItem[] = [];
      let purchasesList: StorePurchase[] = [];

      // 1. Load Items
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('center_store_items').select('*');
          if (error) throw error;
          if (data && data.length > 0) {
            itemsList = data.map((row: any) => ({
              id: row.id,
              title: row.title,
              description: row.description || '',
              pointsCost: Number(row.points_cost || 0),
              stock: Number(row.stock || 0),
              imageUrl: row.image_url || '',
              type: row.type || 'physical',
              value: row.value || '',
              createdAt: row.created_at,
            }));
          } else {
            const snap = await getDocs(collection(db, 'center_store_items'));
            itemsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreItem));
          }
        } catch (sErr) {
          console.warn('⚡ [StoreManagement] Load items from Supabase failed, fell back to Firestore:', sErr);
          const snap = await getDocs(collection(db, 'center_store_items'));
          itemsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreItem));
        }
      } else {
        const snap = await getDocs(collection(db, 'center_store_items'));
        itemsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreItem));
      }

      // 2. Load Purchases
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('center_store_purchases').select('*');
          if (error) throw error;
          if (data && data.length > 0) {
            purchasesList = data.map((row: any) => ({
              id: row.id,
              studentUid: row.student_uid,
              studentName: row.student_name,
              studentId: row.student_id,
              itemId: row.item_id,
              itemTitle: row.item_title,
              pointsSpent: Number(row.points_spent || 0),
              status: row.status || 'pending',
              claimedAt: row.claimed_at,
              claimedBy: row.claimed_by || '',
            }));
          } else {
            const snap = await getDocs(collection(db, 'center_store_purchases'));
            purchasesList = snap.docs.map(d => ({ id: d.id, ...d.data() } as StorePurchase));
          }
        } catch (sErr) {
          console.warn('⚡ [StoreManagement] Load purchases from Supabase failed, fell back to Firestore:', sErr);
          const snap = await getDocs(collection(db, 'center_store_purchases'));
          purchasesList = snap.docs.map(d => ({ id: d.id, ...d.data() } as StorePurchase));
        }
      } else {
        const snap = await getDocs(collection(db, 'center_store_purchases'));
        purchasesList = snap.docs.map(d => ({ id: d.id, ...d.data() } as StorePurchase));
      }

      setItems(itemsList);
      setRequests(purchasesList);
    } catch (err) {
      console.error('Error loading store data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.pointsCost) return;

    setSaving(true);
    try {
      const docId = editingItem ? editingItem.id : `item_${Date.now()}`;
      const pointsNum = Number(form.pointsCost) || 0;
      const stockNum = Number(form.stock) || 0;

      const itemPayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        pointsCost: pointsNum,
        stock: stockNum,
        imageUrl: form.imageUrl.trim() || 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=200&auto=format&fit=crop&q=60',
        type: form.type,
        value: form.value.trim(),
      };

      // Write to Supabase
      if (isSupabaseConfigured() && supabase) {
        try {
          const supabasePayload = {
            id: docId,
            title: itemPayload.title,
            description: itemPayload.description,
            points_cost: itemPayload.pointsCost,
            stock: itemPayload.stock,
            image_url: itemPayload.imageUrl,
            type: itemPayload.type,
            value: itemPayload.value,
            timestamp: new Date().toISOString(),
          };

          const { error } = editingItem 
            ? await supabase.from('center_store_items').update(supabasePayload).eq('id', docId)
            : await supabase.from('center_store_items').insert(supabasePayload);
          
          if (error) {
            console.warn('⚡ [StoreManagement] Supabase item write warning, fell back to Firestore:', error);
          }
        } catch (sErr) {
          console.warn('⚡ [StoreManagement] Supabase connection failed, fell back to Firestore:', sErr);
        }
      }

      // Write to Firestore
      if (editingItem) {
        await updateDoc(doc(db, 'center_store_items', docId), itemPayload);
      } else {
        await setDoc(doc(db, 'center_store_items', docId), {
          ...itemPayload,
          createdAt: serverTimestamp(),
        });
      }

      setShowAddModal(false);
      setEditingItem(null);
      setForm({
        title: '',
        description: '',
        pointsCost: '100',
        stock: '10',
        imageUrl: '',
        type: 'physical',
        value: '',
      });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الجائزة من المتجر؟')) return;

    try {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('center_store_items').delete().eq('id', itemId);
          if (error) {
            console.warn('⚡ [StoreManagement] Supabase item delete warning, fell back to Firestore:', error);
          }
        } catch (sErr) {
          console.warn('⚡ [StoreManagement] Supabase connection failed, fell back to Firestore:', sErr);
        }
      }
      await deleteDoc(doc(db, 'center_store_items', itemId));
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeliverPurchase = async (purchaseId: string) => {
    try {
      const staffName = profile?.displayName || 'المساعد';
      const updatePayload = {
        status: 'delivered' as const,
        claimedAt: new Date().toISOString(),
        claimedBy: staffName,
      };

      // Update Supabase
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase
            .from('center_store_purchases')
            .update({
              status: 'delivered',
              claimed_at: updatePayload.claimedAt,
              claimed_by: updatePayload.claimedBy,
            })
            .eq('id', purchaseId);
          if (error) {
            console.warn('⚡ [StoreManagement] Supabase delivery update warning, fell back to Firestore:', error);
          }
        } catch (sErr) {
          console.warn('⚡ [StoreManagement] Supabase connection failed, fell back to Firestore:', sErr);
        }
      }

      // Update Firestore
      await updateDoc(doc(db, 'center_store_purchases', purchaseId), updatePayload);
      await loadData();
    } catch (err) {
      console.error('Error delivering purchase:', err);
    }
  };

  const filteredRequests = requests.filter(req => 
    req.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.studentId.includes(searchQuery) ||
    req.itemTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sub-tabs and actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('items')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSubTab === 'items'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md shadow-orange-500/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Award className="inline-block mr-1" size={14} />
            الهدايا المتاحة
          </button>
          <button
            onClick={() => setActiveSubTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSubTab === 'requests'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md shadow-orange-500/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ClipboardList className="inline-block mr-1" size={14} />
            طلبات الاستبدال
          </button>
        </div>

        {activeSubTab === 'items' ? (
          <button
            onClick={() => {
              setEditingItem(null);
              setForm({
                title: '',
                description: '',
                pointsCost: '100',
                stock: '10',
                imageUrl: '',
                type: 'physical',
                value: '',
              });
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-xs transition-all shadow-lg hover:shadow-orange-500/20 active:scale-95 cursor-pointer"
          >
            <Plus size={14} />
            إضافة جائزة جديدة
          </button>
        ) : (
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
            <input
              type="text"
              placeholder="ابحث باسم الطالب، الكود، أو الجائزة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2 rounded-xl bg-[#080d19] border border-white/5 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-all font-black text-right"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white/[0.02] border border-white/5 rounded-3xl min-h-[300px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-orange-500" size={32} />
            <span className="text-xs text-gray-400 font-bold">جاري تحميل بيانات المتجر والتحفيز...</span>
          </div>
        </div>
      ) : activeSubTab === 'items' ? (
        items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white/[0.02] border border-white/5 rounded-3xl min-h-[300px] text-center">
            <Gift size={48} className="text-gray-600 mb-3" />
            <h3 className="text-sm font-black text-white mb-1">المتجر فارغ حالياً</h3>
            <p className="text-xs text-gray-500 font-bold max-w-xs leading-relaxed">لم تقم بإضافة أي هدايا أو مكافآت تميز للطلاب بعد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(item => (
              <div
                key={item.id}
                className="group relative flex flex-col bg-white/[0.02] border border-white/5 hover:border-orange-500/20 rounded-2xl overflow-hidden transition-all shadow-xl backdrop-blur-md"
              >
                {/* Product Image */}
                <div className="relative aspect-video w-full overflow-hidden bg-slate-900/50">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1">
                    <span className="text-[10px] text-orange-400 font-black">{item.pointsCost} نقطة</span>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 p-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-white leading-tight group-hover:text-orange-400 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-500 font-bold line-clamp-2 leading-relaxed">
                      {item.description || 'لا يوجد وصف.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="text-[10px] text-gray-400 font-bold">
                      المخزون المتاح: <span className={item.stock > 0 ? 'text-emerald-400' : 'text-red-400'}>{item.stock}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setForm({
                            title: item.title,
                            description: item.description,
                            pointsCost: String(item.pointsCost),
                            stock: String(item.stock),
                            imageUrl: item.imageUrl,
                            type: item.type,
                            value: item.value,
                          });
                          setShowAddModal(true);
                        }}
                        className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white/[0.02] border border-white/5 rounded-3xl min-h-[300px] text-center">
          <Package size={48} className="text-gray-600 mb-3" />
          <h3 className="text-sm font-black text-white mb-1">لا توجد طلبات استبدال</h3>
          <p className="text-xs text-gray-500 font-bold max-w-xs leading-relaxed">
            {searchQuery ? 'لم يتم العثور على نتائج مطابقة لبحثك.' : 'لم يقم أي طالب بطلب استبدال نقاطه بجوائز بعد.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-[#070b16] border border-white/5 rounded-2xl shadow-2xl">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="p-4 text-xs font-black text-gray-400">الطالب</th>
                <th className="p-4 text-xs font-black text-gray-400">الكود</th>
                <th className="p-4 text-xs font-black text-gray-400">الجائزة المطلوبة</th>
                <th className="p-4 text-xs font-black text-gray-400">النقاط المخصومة</th>
                <th className="p-4 text-xs font-black text-gray-400">تاريخ الطلب</th>
                <th className="p-4 text-xs font-black text-gray-400">الحالة</th>
                <th className="p-4 text-xs font-black text-gray-400">الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => (
                <tr key={req.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                  <td className="p-4 text-xs font-black text-white">{req.studentName}</td>
                  <td className="p-4 text-xs font-black text-gray-400">{req.studentId}</td>
                  <td className="p-4 text-xs font-black text-orange-400">{req.itemTitle}</td>
                  <td className="p-4 text-xs font-black text-white">{req.pointsSpent} نقطة</td>
                  <td className="p-4 text-xs font-bold text-gray-500">
                    {req.id.includes('_') ? new Date(Number(req.id.split('_')[2] || Date.now())).toLocaleDateString('ar-EG') : 'قريب'}
                  </td>
                  <td className="p-4 text-xs font-black">
                    {req.status === 'delivered' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <CheckCircle size={10} />
                        تم التسليم بواسطة {req.claimedBy}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
                        <Loader2 className="animate-spin" size={10} />
                        قيد الانتظار بالسنتر
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-xs">
                    {req.status === 'pending' && (
                      <button
                        onClick={() => handleDeliverPurchase(req.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[10px] transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        تأكيد التسليم يدويًا
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Gift Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm no-print">
          <div className="relative w-full max-w-lg bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 left-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>

            <h3 className="text-base font-black text-white mb-6">
              {editingItem ? 'تعديل الجائزة الحالية' : 'إضافة جائزة جديدة للمتجر'}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold block">اسم الجائزة</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: تيشرت المستر المطبوع"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-orange-500/50 transition-all font-black text-right"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold block">وصف الجائزة</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="وصف تفصيلي للجائزة وشروط استلامها..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-orange-500/50 transition-all font-black text-right resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold block">النقاط المطلوبة للاستبدال</label>
                  <input
                    type="number"
                    required
                    value={form.pointsCost}
                    onChange={(e) => setForm({ ...form, pointsCost: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white text-xs focus:outline-none focus:border-orange-500/50 transition-all font-black text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold block">المخزون المتاح</label>
                  <input
                    type="number"
                    required
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white text-xs focus:outline-none focus:border-orange-500/50 transition-all font-black text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold block">نوع الجائزة</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white text-xs focus:outline-none focus:border-orange-500/50 transition-all font-black text-right"
                  >
                    <option value="physical">استلام بالسنتر (هدية عينية)</option>
                    <option value="booklet">مذكرة ورقية</option>
                    <option value="coupon">كوبون خصم</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold block">رابط الصورة (اختياري)</label>
                  <input
                    type="text"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    placeholder="رابط URL مباشر للصورة"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-orange-500/50 transition-all font-black text-left"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold block">تفاصيل الاستلام الإضافية (يدوية)</label>
                <input
                  type="text"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="ملاحظات التسليم مثل: يستلمها من مكتب المستر"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-orange-500/50 transition-all font-black text-right"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-black text-xs transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-xs transition-all shadow-lg active:scale-95"
                >
                  {saving && <Loader2 className="animate-spin" size={12} />}
                  حفظ الجائزة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
