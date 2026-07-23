import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { ConfirmModal } from '../../../components/center/ConfirmModal';
import { EmptyState } from '../../../components/center/EmptyState';
import {
  Users,
  Plus,
  Trash2,
  Key,
  Shield,
  Loader2,
  Phone,
  Mail,
  User,
  CheckCircle,
  Building2,
  Lock,
} from 'lucide-react';

interface CenterAssistantsTabProps {
  centers: any[];
}

interface AssistantUser {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  centerId?: string; // Access to a specific center, or empty for all
  permissions: {
    canTakeAttendance: boolean;
    canEnterGrades: boolean;
    canManagePayments: boolean;
  };
  createdAt?: any;
}

export const CenterAssistantsTab: React.FC<CenterAssistantsTabProps> = ({
  centers,
}) => {
  const { profile } = useAuth();
  const [assistants, setAssistants] = useState<AssistantUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assistantToDelete, setAssistantToDelete] = useState<string | null>(null);

  // New Assistant Form State
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    phone: '',
    centerId: '',
    canTakeAttendance: true,
    canEnterGrades: true,
    canManagePayments: false,
  });

  // Edit Permissions State
  const [editingPermissions, setEditingPermissions] = useState<AssistantUser | null>(null);
  const [editPermissionsForm, setEditPermissionsForm] = useState({
    canTakeAttendance: true,
    canEnterGrades: true,
    canManagePayments: false,
    centerId: '',
  });

  // Change Password State
  const [changingPasswordUser, setChangingPasswordUser] = useState<AssistantUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Alert Config State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'danger';
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  const showAlert = (message: string, type: 'info' | 'warning' | 'danger' = 'info', title = 'إشعار النظام') => {
    setAlertConfig({
      isOpen: true,
      title,
      message,
      type,
      confirmText: 'موافق',
      onConfirm: () => setAlertConfig(null),
    });
  };

  // Load Assistants linked to current teacher
  const loadAssistants = async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'assistant'),
        where('teacherId', '==', profile.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          displayName: data.displayName || '',
          email: data.email || '',
          phone: data.phone || '',
          centerId: data.centerId || '',
          permissions: data.permissions || {
            canTakeAttendance: true,
            canEnterGrades: true,
            canManagePayments: false,
          },
          createdAt: data.createdAt,
        } as AssistantUser;
      });
      setAssistants(list);
    } catch (err) {
      console.error('Error loading assistants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssistants();
  }, [profile]);

  // Create Assistant
  const handleCreateAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;

    if (!form.displayName.trim() || !form.email.trim() || !form.password.trim()) {
      showAlert('يرجى ملء الاسم والبريد الإلكتروني وكلمة المرور', 'warning');
      return;
    }

    setSaving(true);
    try {
      // 1. Check if email is already in use by querying users collection
      const q = query(collection(db, 'users'), where('email', '==', form.email.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        showAlert('البريد الإلكتروني المدخل مستخدم بالفعل لحساب آخر', 'warning');
        setSaving(false);
        return;
      }

      // Generate a unique UID for the assistant
      const assistantUid = `assistant_${Date.now()}`;

      // 2. Write assistant credentials & profile to users collection
      await setDoc(doc(db, 'users', assistantUid), {
        uid: assistantUid,
        displayName: form.displayName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password, // Stored safely for admin retrieval or login lookup
        phone: form.phone.trim(),
        role: 'assistant',
        teacherId: profile.uid,
        teacherName: profile.displayName || 'المعلم',
        centerId: form.centerId,
        permissions: {
          canTakeAttendance: form.canTakeAttendance,
          canEnterGrades: form.canEnterGrades,
          canManagePayments: form.canManagePayments,
        },
        createdAt: serverTimestamp(),
      });

      // Clear Form
      setForm({
        displayName: '',
        email: '',
        password: '',
        phone: '',
        centerId: '',
        canTakeAttendance: true,
        canEnterGrades: true,
        canManagePayments: false,
      });

      await loadAssistants();
      showAlert('تم إنشاء حساب المساعد بنجاح وإتاحة الصلاحيات له', 'info');
    } catch (err) {
      console.error(err);
      showAlert('فشل إنشاء حساب المساعد', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Edit Permissions
  const handleEditPermissionsClick = (ast: AssistantUser) => {
    setEditingPermissions(ast);
    setEditPermissionsForm({
      canTakeAttendance: ast.permissions.canTakeAttendance,
      canEnterGrades: ast.permissions.canEnterGrades,
      canManagePayments: ast.permissions.canManagePayments,
      centerId: ast.centerId || '',
    });
  };

  const handleUpdatePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermissions) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', editingPermissions.uid), {
        centerId: editPermissionsForm.centerId,
        permissions: {
          canTakeAttendance: editPermissionsForm.canTakeAttendance,
          canEnterGrades: editPermissionsForm.canEnterGrades,
          canManagePayments: editPermissionsForm.canManagePayments,
        },
      });

      setEditingPermissions(null);
      await loadAssistants();
      showAlert('تم تحديث صلاحيات المساعد بنجاح', 'info');
    } catch (err) {
      console.error(err);
      showAlert('فشل تحديث الصلاحيات', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Change Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingPasswordUser || !newPassword.trim()) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', changingPasswordUser.uid), {
        password: newPassword.trim(),
      });

      setChangingPasswordUser(null);
      setNewPassword('');
      showAlert('تم تعديل كلمة مرور المساعد بنجاح', 'info');
    } catch (err) {
      console.error(err);
      showAlert('فشل تعديل كلمة المرور', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Delete Assistant
  const handleDeleteAssistantConfirm = async () => {
    if (!assistantToDelete) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', assistantToDelete));
      setAssistantToDelete(null);
      await loadAssistants();
      showAlert('تم حذف حساب المساعد نهائياً بنجاح', 'info');
    } catch (err) {
      console.error(err);
      showAlert('فشل حذف حساب المساعد', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Create Assistant Form */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl self-start">
        <div>
          <h3 className="text-xs font-black text-white flex items-center gap-2">
            <Plus className="text-emerald-500" size={14} />
            <span>إضافة مساعد / مشرف سنتر جديد</span>
          </h3>
          <p className="text-[9px] text-gray-500 font-bold mt-1">
            إنشاء حساب يمكن للمساعد تسجيل الدخول به لمساعدتك في أخذ الحضور ورصد الدرجات والتقييمات بالسنتر.
          </p>
        </div>

        <form onSubmit={handleCreateAssistant} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-300">الاسم بالكامل</label>
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                <User size={12} />
              </span>
              <input
                type="text"
                required
                placeholder="أحمد علي"
                value={form.displayName}
                onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                className="w-full bg-[#080d19]/60 border border-white/10 rounded-xl py-2 pr-9 pl-4 text-xs text-white placeholder-gray-600 outline-none transition-all font-bold focus:border-emerald-500/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-300">البريد الإلكتروني (لتسجيل الدخول)</label>
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                <Mail size={12} />
              </span>
              <input
                type="email"
                required
                placeholder="ahmed@fahmni.me"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full bg-[#080d19]/60 border border-white/10 rounded-xl py-2 pr-9 pl-4 text-xs text-white placeholder-gray-600 outline-none transition-all font-bold focus:border-emerald-500/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-300">كلمة المرور المؤقتة</label>
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                <Lock size={12} />
              </span>
              <input
                type="text"
                required
                placeholder="أدخل كلمة مرور قوية"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full bg-[#080d19]/60 border border-white/10 rounded-xl py-2 pr-9 pl-4 text-xs text-white placeholder-gray-600 outline-none transition-all font-bold focus:border-emerald-500/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-300">رقم الهاتف</label>
            <div className="relative">
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                <Phone size={12} />
              </span>
              <input
                type="tel"
                placeholder="01xxxxxxxxx"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full bg-[#080d19]/60 border border-white/10 rounded-xl py-2 pr-9 pl-4 text-xs text-white placeholder-gray-600 outline-none transition-all font-bold focus:border-emerald-500/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-300">فرع السنتر المسموح بالوصول إليه</label>
            <select
              value={form.centerId}
              onChange={(e) => setForm((p) => ({ ...p, centerId: e.target.value }))}
              className="w-full bg-[#080d19]/60 border border-white/10 rounded-xl py-2 px-4 text-xs text-white outline-none focus:border-emerald-500/30 font-bold"
            >
              <option value="">كل الفروع والسناتر</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Permissions switches */}
          <div className="bg-black/20 p-3.5 rounded-2xl space-y-3">
            <span className="text-[10px] font-black text-gray-400 block border-b border-white/5 pb-1.5">
              تحديد الصلاحيات المتاحة للمساعد
            </span>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.canTakeAttendance}
                onChange={(e) => setForm((p) => ({ ...p, canTakeAttendance: e.target.checked }))}
                className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/10"
              />
              <span>صلاحية تسجيل حضور وغياب الطلاب</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.canEnterGrades}
                onChange={(e) => setForm((p) => ({ ...p, canEnterGrades: e.target.checked }))}
                className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/10"
              />
              <span>صلاحية رصد الدرجات والتقييمات اليومية</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.canManagePayments}
                onChange={(e) => setForm((p) => ({ ...p, canManagePayments: e.target.checked }))}
                className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/10"
              />
              <span>صلاحية تسجيل الاشتراكات والماليات اليومية</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : null}
            <span>إنشاء وتفعيل الحساب</span>
          </button>
        </form>
      </div>

      {/* Assistants list */}
      <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
        <div>
          <h3 className="text-xs font-black text-white flex items-center gap-2">
            <Users className="text-emerald-500" size={14} />
            <span>سجل المشرفين والمساعدين المعتمدين</span>
          </h3>
        </div>

        {loading && assistants.length === 0 ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="animate-spin text-emerald-500" size={24} />
          </div>
        ) : assistants.length === 0 ? (
          <EmptyState
            title="لا يوجد مساعدين"
            description="لم تقم بإضافة أي مساعدين أو مشرفين في مركزك التعليمي بعد."
            icon={Users}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-[10px] font-black">
                  <th className="py-2.5">الاسم / بيانات الاتصال</th>
                  <th className="py-2.5">صلاحيات الوصول</th>
                  <th className="py-2.5">الفرع المتاح</th>
                  <th className="py-2.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assistants.map((ast) => (
                  <tr key={ast.uid} className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-3">
                      <span className="font-black text-white block">{ast.displayName}</span>
                      <span className="text-[9px] text-gray-500 block mt-0.5">{ast.email}</span>
                      {ast.phone && (
                        <span className="text-[9px] text-gray-500 block">{ast.phone}</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {ast.permissions.canTakeAttendance && (
                          <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[8px] font-bold">
                            حضور وغياب
                          </span>
                        )}
                        {ast.permissions.canEnterGrades && (
                          <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[8px] font-bold">
                            درجات وتقييمات
                          </span>
                        )}
                        {ast.permissions.canManagePayments && (
                          <span className="px-1.5 py-0.5 bg-pink-500/10 text-pink-400 border border-pink-500/20 rounded text-[8px] font-bold">
                            رصد الماليات
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="text-gray-400 font-bold">
                        {ast.centerId ? centers.find((c) => c.id === ast.centerId)?.name || 'فرع محدد' : 'كل الفروع'}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleEditPermissionsClick(ast)}
                          className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
                          title="تعديل الصلاحيات"
                        >
                          <Shield size={12} />
                        </button>
                        <button
                          onClick={() => setChangingPasswordUser(ast)}
                          className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
                          title="تغيير كلمة المرور"
                        >
                          <Key size={12} />
                        </button>
                        <button
                          onClick={() => setAssistantToDelete(ast.uid)}
                          className="p-1 rounded bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white text-red-400 cursor-pointer"
                          title="حذف المساعد"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Permissions Modal */}
      {editingPermissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#04060d]/80 backdrop-blur-sm" onClick={() => setEditingPermissions(null)} />
          <div className="w-full max-w-md bg-[#0a0f1d] border border-white/10 rounded-3xl p-6 relative shadow-2xl z-10 text-right">
            <h3 className="text-sm font-black text-white mb-6">تعديل صلاحيات المساعد</h3>

            <form onSubmit={handleUpdatePermissions} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-300">الوصول لفرع السنتر</label>
                <select
                  value={editPermissionsForm.centerId}
                  onChange={(e) => setEditPermissionsForm(p => ({ ...p, centerId: e.target.value }))}
                  className="w-full bg-[#080d19] border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-emerald-500/30 font-bold"
                >
                  <option value="">كل الفروع والسناتر</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-black/20 p-4 rounded-2xl space-y-3 mt-4">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPermissionsForm.canTakeAttendance}
                    onChange={(e) => setEditPermissionsForm((p) => ({ ...p, canTakeAttendance: e.target.checked }))}
                    className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/10"
                  />
                  <span>صلاحية تسجيل حضور وغياب الطلاب</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPermissionsForm.canEnterGrades}
                    onChange={(e) => setEditPermissionsForm((p) => ({ ...p, canEnterGrades: e.target.checked }))}
                    className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/10"
                  />
                  <span>صلاحية رصد الدرجات والتقييمات اليومية</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPermissionsForm.canManagePayments}
                    onChange={(e) => setEditPermissionsForm((p) => ({ ...p, canManagePayments: e.target.checked }))}
                    className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/10"
                  />
                  <span>صلاحية تسجيل الاشتراكات والماليات اليومية</span>
                </label>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-white/5 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingPermissions(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-teal-500 hover:opacity-90 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                  <span>حفظ الصلاحيات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {changingPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#04060d]/80 backdrop-blur-sm" onClick={() => setChangingPasswordUser(null)} />
          <div className="w-full max-w-md bg-[#0a0f1d] border border-white/10 rounded-3xl p-6 relative shadow-2xl z-10 text-right">
            <h3 className="text-sm font-black text-white mb-6">تغيير كلمة مرور المساعد</h3>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-300">كلمة المرور الجديدة</label>
                <input
                  type="text"
                  required
                  placeholder="أدخل كلمة مرور جديدة للمساعد"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-white/[0.02] border border-white/10 rounded-xl focus:border-emerald-500/30 text-xs text-white outline-none font-bold"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-white/5 mt-6">
                <button
                  type="button"
                  onClick={() => setChangingPasswordUser(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving || !newPassword.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-teal-500 hover:opacity-90 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                  <span>تعديل كلمة المرور</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm deletion modal */}
      <ConfirmModal
        isOpen={assistantToDelete !== null}
        title="تأكيد حذف حساب المساعد"
        message="هل تريد حذف حساب المساعد هذا نهائياً من سجلات السنتر؟ لن يتمكن المساعد من تسجيل الدخول أو مساعدة السنتر بعد الآن."
        confirmText="حذف نهائي"
        cancelText="تراجع"
        type="danger"
        onConfirm={handleDeleteAssistantConfirm}
        onCancel={() => setAssistantToDelete(null)}
      />

      {/* Custom Alert Modal */}
      {alertConfig && (
        <ConfirmModal
          isOpen={alertConfig.isOpen}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText={alertConfig.confirmText}
          cancelText=""
          type={alertConfig.type}
          onConfirm={alertConfig.onConfirm}
          onCancel={alertConfig.onConfirm}
        />
      )}
    </div>
  );
};
