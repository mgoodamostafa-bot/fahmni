import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { getTenantDb } from '../lib/firebase';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Award, CheckCircle, Package, ArrowRight, Loader2, Sparkles, AlertCircle, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

interface StoreItem {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  stock: number;
  imageUrl: string;
  type: 'coupon' | 'physical' | 'booklet';
  value: string;
}

interface PurchaseReceipt {
  id: string;
  itemTitle: string;
  pointsSpent: number;
}

export const StudentStore: React.FC = () => {
  const db = getTenantDb();
  const { user, profile, forceRefreshProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [receipt, setReceipt] = useState<PurchaseReceipt | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Student details
  const pointsBalance = profile?.points || 0;

  const loadItems = async () => {
    setLoading(true);
    try {
      let itemsList: StoreItem[] = [];
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('center_store_items')
            .select('*')
            .gt('stock', 0); // Only items with stock > 0
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
            }));
          } else {
            const snap = await getDocs(collection(db, 'center_store_items'));
            itemsList = snap.docs
              .map(d => ({ id: d.id, ...d.data() } as StoreItem))
              .filter(item => item.stock > 0);
          }
        } catch (sErr) {
          console.warn('⚡ [StudentStore] Fetching items from Supabase failed, fell back to Firestore:', sErr);
          const snap = await getDocs(collection(db, 'center_store_items'));
          itemsList = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as StoreItem))
            .filter(item => item.stock > 0);
        }
      } else {
        const snap = await getDocs(collection(db, 'center_store_items'));
        itemsList = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as StoreItem))
          .filter(item => item.stock > 0);
      }
      setItems(itemsList);
    } catch (err) {
      console.error('Error loading store items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleRedeemItem = async (item: StoreItem) => {
    if (pointsBalance < item.pointsCost) {
      setErrorMsg('عذرًا، ليس لديك نقاط كافية لاستبدال هذه الجائزة.');
      return;
    }

    setRedeeming(true);
    setErrorMsg(null);

    try {
      const purchaseId = `claim_${profile?.uid}_${item.id}_${Date.now()}`;
      const newPointsBalance = pointsBalance - item.pointsCost;

      // 1. Log the Purchase
      const purchasePayload = {
        id: purchaseId,
        studentUid: profile?.uid || user?.uid || '',
        studentName: profile?.displayName || 'طالب متميز',
        studentId: profile?.studentId || '',
        itemId: item.id,
        itemTitle: item.title,
        pointsSpent: item.pointsCost,
        status: 'pending' as const,
        claimedAt: null,
        claimedBy: '',
      };

      if (isSupabaseConfigured() && supabase) {
        try {
          // Write purchase to Supabase
          const { error: purError } = await supabase.from('center_store_purchases').insert({
            id: purchaseId,
            student_uid: purchasePayload.studentUid,
            student_name: purchasePayload.studentName,
            student_id: purchasePayload.studentId,
            item_id: purchasePayload.itemId,
            item_title: purchasePayload.itemTitle,
            points_spent: purchasePayload.pointsSpent,
            status: purchasePayload.status,
            timestamp: new Date().toISOString(),
          });
          if (purError) throw purError;

          // Decrement stock in Supabase
          const { error: stockError } = await supabase
            .from('center_store_items')
            .update({ stock: item.stock - 1 })
            .eq('id', item.id);
          if (stockError) throw stockError;

          // Update student points in Supabase
          const isCenter = profile?.role === 'student' && profile?.isCenterStudent;
          const { error: ptsError } = await supabase
            .from(isCenter ? 'center_students' : 'users')
            .update({ points: newPointsBalance, points_balance: newPointsBalance })
            .eq('uid', purchasePayload.studentUid);
          if (ptsError) throw ptsError;

        } catch (sErr) {
          console.warn('⚡ [StudentStore] Supabase purchase failed, fell back to Firestore:', sErr);
        }
      }

      // Write to Firestore
      await setDoc(doc(db, 'center_store_purchases', purchaseId), {
        ...purchasePayload,
        createdAt: serverTimestamp(),
      });

      // Update Stock in Firestore
      await updateDoc(doc(db, 'center_store_items', item.id), {
        stock: item.stock - 1,
      });

      // Update Student Points in Firestore / Database
      const isCenter = profile?.role === 'student' && profile?.isCenterStudent;
      const studentRef = doc(db, isCenter ? 'center_students' : 'users', purchasePayload.studentUid);
      
      const newPoints = Math.max(0, (profile?.points || 0) - item.pointsCost);

      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase
            .from(isCenter ? 'center_students' : 'users')
            .update({ points: newPoints })
            .eq('uid', purchasePayload.studentUid);
          if (error) throw error;
        } catch (sErr) {
          console.warn('⚡ [Store] Supabase student points update warning:', sErr);
        }
      }

      await updateDoc(studentRef, {
        points: newPoints,
      });

      // Sync local auth context state
      if (forceRefreshProfile) {
        forceRefreshProfile();
      }

      setReceipt({
        id: purchaseId,
        itemTitle: item.title,
        pointsSpent: item.pointsCost,
      });

      await loadItems();
    } catch (err) {
      console.error('Error redeeming item:', err);
      setErrorMsg('حدث خطأ أثناء إتمام عملية الاستبدال. يرجى المحاولة مرة أخرى.');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] text-white px-3 py-4 sm:p-6 font-cairo">
      {/* Header */}
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-row justify-between items-center gap-2 bg-white/2 border border-white/5 p-4 rounded-2xl shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowRight size={16} />
            </button>
            <div>
              <h1 className="text-sm sm:text-lg font-black bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent flex items-center gap-1.5">
                <Gift size={18} className="text-orange-400" />
                متجر الجوائز
              </h1>
              <p className="hidden sm:block text-xs text-gray-500 font-bold">
                استبدل نقاط تفوقك بجوائز ومكافآت عينية أو كروت خصم مميزة!
              </p>
            </div>
          </div>

          {/* Points Counter */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 px-3 py-1.5 rounded-xl shrink-0">
            <Award className="text-orange-400" size={16} />
            <div className="text-right">
              <span className="text-[8px] text-gray-400 font-bold block leading-none">نقاطك</span>
              <span className="text-xs sm:text-sm font-black text-white">{pointsBalance} ن</span>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-[10px] sm:text-xs font-black">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-12 bg-white/2 border border-white/5 rounded-2xl min-h-[300px]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-orange-500" size={28} />
              <span className="text-xs text-gray-400 font-bold">جاري تحميل الجوائز...</span>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white/2 border border-white/5 rounded-2xl min-h-[300px] text-center">
            <Sparkles size={40} className="text-gray-600 mb-3" />
            <h3 className="text-xs sm:text-sm font-black text-white mb-1">لا توجد جوائز متاحة حالياً</h3>
            <p className="text-[10px] sm:text-xs text-gray-500 font-bold max-w-xs leading-relaxed">
              ترقب الجوائز والهدايا القادمة قريباً، واستمر في المذاكرة وتجميع النقاط!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {items.map(item => {
              const canAfford = pointsBalance >= item.pointsCost;
              return (
                <div
                  key={item.id}
                  className="group relative flex flex-col bg-white/2 border border-white/5 hover:border-orange-500/20 rounded-2xl overflow-hidden transition-all shadow-xl backdrop-blur-md"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900/50">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-orange-500/10 text-orange-400">
                        <Gift size={28} />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
                      <span className="text-[9px] sm:text-[10px] text-orange-400 font-black">{item.pointsCost} ن</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 p-3 flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="text-xs sm:text-sm font-black text-white leading-snug truncate group-hover:text-orange-400 transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-gray-500 font-bold line-clamp-1 leading-normal">
                        {item.description || 'لا يوجد وصف.'}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/5">
                      <span className="text-[8px] sm:text-[10px] text-gray-500 font-bold">المتبقي: {item.stock}</span>
                      
                      <button
                        disabled={!canAfford || redeeming}
                        onClick={() => handleRedeemItem(item)}
                        className={`w-full sm:w-auto px-2.5 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black text-center transition-all cursor-pointer ${
                          canAfford
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 shadow-md hover:shadow-orange-500/10 active:scale-95'
                            : 'bg-white/5 border border-white/5 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {redeeming ? 'جاري...' : 'استبدل'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Success / QR Receipt Modal */}
      <AnimatePresence>
        {receipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#060913] border border-white/10 rounded-3xl shadow-2xl p-5 text-center overflow-hidden"
            >
              <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={20} />
              </div>

              <h3 className="text-sm sm:text-base font-black text-white mb-0.5">تم استبدال الجائزة بنجاح!</h3>
              <p className="text-[10px] sm:text-xs text-gray-400 font-bold mb-4">
                تهانينا! تم خصم {receipt.pointsSpent} نقطة بنجاح من رصيدك.
              </p>

              {/* QR Code container */}
              <div className="bg-white p-3 rounded-xl inline-block mb-4 shadow-xl">
                <QRCodeSVG value={receipt.id} size={110} />
              </div>

              <div className="space-y-2 mb-4 bg-white/2 border border-white/5 p-3 rounded-xl text-right">
                <div className="flex justify-between items-center text-[10px] sm:text-xs">
                  <span className="text-gray-400 font-bold">الجائزة:</span>
                  <span className="text-white font-black">{receipt.itemTitle}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] sm:text-xs">
                  <span className="text-gray-400 font-bold">الرقم المرجعي:</span>
                  <span className="text-white font-mono font-bold text-[9px] sm:text-[10px]">{receipt.id.split('_')[3]}</span>
                </div>
              </div>

              <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400 text-[9px] sm:text-[10px] font-black leading-relaxed mb-5">
                💡 يرجى إظهار الباركود أو رقم الطلب للمساعد بالسنتر لاستلام جائزتك يدوياً.
              </div>

              <button
                onClick={() => setReceipt(null)}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-xs transition-colors cursor-pointer"
              >
                حسناً، فهمت
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
