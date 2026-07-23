import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, where, writeBatch } from 'firebase/firestore';
import { getTenantDb } from '../../lib/firebase';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Tv, Plus, Trash2, Edit2, Play, PowerOff, MessageSquare, Send, Trash, Loader2, Users, Radio, X } from 'lucide-react';
import { getGradeLabel } from '../../utils/arabicUtils';

interface LiveSession {
  id: string;
  title: string;
  description: string;
  streamSource: 'youtube_live' | 'vimeo' | 'custom_rtmp';
  streamUrl: string;
  grade: string;
  level: string;
  isActive: boolean;
  createdAt: any;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  senderUid: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: any;
}

export const TeacherLiveSessions: React.FC = () => {
  const db = getTenantDb();
  const { profile } = useAuth();
  
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    streamSource: 'youtube_live' as 'youtube_live' | 'vimeo' | 'custom_rtmp',
    streamUrl: '',
    grade: '1',
    level: 'secondary',
  });

  const loadSessions = async () => {
    setLoading(true);
    try {
      let list: LiveSession[] = [];
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('live_sessions').select('*');
          if (error) throw error;
          if (data && data.length > 0) {
            list = data.map((row: any) => ({
              id: row.id,
              title: row.title,
              description: row.description || '',
              streamSource: row.stream_source || 'youtube_live',
              streamUrl: row.stream_url || '',
              grade: row.grade,
              level: row.level,
              isActive: row.is_active,
              createdAt: row.created_at,
            }));
          } else {
            const snap = await getDocs(collection(db, 'live_sessions'));
            list = snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveSession));
          }
        } catch (sErr) {
          console.warn('⚡ [TeacherLive] Supabase error loading sessions, falling back to Firestore:', sErr);
          const snap = await getDocs(collection(db, 'live_sessions'));
          list = snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveSession));
        }
      } else {
        const snap = await getDocs(collection(db, 'live_sessions'));
        list = snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveSession));
      }
      setSessions(list);
    } catch (err) {
      console.error('Error loading live sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadChat = async (sessionId: string) => {
    try {
      let list: ChatMessage[] = [];
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('live_chat_messages')
            .select('*')
            .eq('session_id', sessionId);
          if (error) throw error;
          if (data) {
            list = data.map((row: any) => ({
              id: row.id,
              sessionId: row.session_id,
              senderUid: row.sender_uid,
              senderName: row.sender_name,
              senderRole: row.sender_role,
              text: row.text,
              timestamp: row.timestamp,
            }));
          }
        } catch (sErr) {
          console.warn('⚡ [TeacherLive] Supabase chat fetch failed, fell back to Firestore:', sErr);
          const snap = await getDocs(query(collection(db, 'live_chat_messages'), where('sessionId', '==', sessionId)));
          list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
        }
      } else {
        const snap = await getDocs(query(collection(db, 'live_chat_messages'), where('sessionId', '==', sessionId)));
        list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
      }
      setChatMessages(list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    } catch (err) {
      console.error('Error loading chat:', err);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSession) {
      loadChat(activeSession.id);
      const interval = setInterval(() => loadChat(activeSession.id), 3000);
      return () => clearInterval(interval);
    }
  }, [activeSession]);

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.streamUrl.trim()) return;

    setSaving(true);
    try {
      const docId = `live_${Date.now()}`;
      const sessionPayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        streamSource: form.streamSource,
        streamUrl: form.streamUrl.trim(),
        grade: form.grade,
        level: form.level,
        isActive: true,
      };

      // Write to Supabase
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('live_sessions').insert({
            id: docId,
            title: sessionPayload.title,
            description: sessionPayload.description,
            stream_source: sessionPayload.streamSource,
            stream_url: sessionPayload.streamUrl,
            grade: sessionPayload.grade,
            level: sessionPayload.level,
            is_active: sessionPayload.isActive,
            created_at: new Date().toISOString(),
          });
          if (error) throw error;
        } catch (sErr) {
          console.warn('⚡ [TeacherLive] Supabase write failed, fell back to Firestore:', sErr);
        }
      }

      // Write to Firestore
      await setDoc(doc(db, 'live_sessions', docId), {
        ...sessionPayload,
        createdAt: serverTimestamp(),
      });

      setShowAddModal(false);
      setForm({
        title: '',
        description: '',
        streamSource: 'youtube_live',
        streamUrl: '',
        grade: '1',
        level: 'secondary',
      });
      await loadSessions();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (session: LiveSession) => {
    try {
      const newActiveState = !session.isActive;

      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase
            .from('live_sessions')
            .update({ is_active: newActiveState })
            .eq('id', session.id);
          if (error) throw error;
        } catch (sErr) {
          console.warn('⚡ [TeacherLive] Supabase toggle failed, fell back to Firestore:', sErr);
        }
      }

      await updateDoc(doc(db, 'live_sessions', session.id), {
        isActive: newActiveState,
      });

      await loadSessions();
      if (activeSession?.id === session.id) {
        setActiveSession({ ...activeSession, isActive: newActiveState });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف جلسة البث هذه نهائيًا؟')) return;

    try {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('live_sessions').delete().eq('id', sessionId);
          if (error) throw error;
        } catch (sErr) {
          console.warn('⚡ [TeacherLive] Supabase delete failed, fell back to Firestore:', sErr);
        }
      }

      await deleteDoc(doc(db, 'live_sessions', sessionId));
      if (activeSession?.id === sessionId) setActiveSession(null);
      await loadSessions();
    } catch (err) {
      console.error(err);
    }
  };

  // Clear Chat Messages (التفريغ) - as requested by the user
  const handleClearChat = async (sessionId: string) => {
    if (!window.confirm('هل أنت متأكد من تفريغ شات هذا البث ومسح كل الرسائل؟')) return;

    try {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase
            .from('live_chat_messages')
            .delete()
            .eq('session_id', sessionId);
          if (error) throw error;
        } catch (sErr) {
          console.warn('⚡ [TeacherLive] Supabase chat clear failed, fell back to Firestore:', sErr);
        }
      }

      // Firestore clear
      const snap = await getDocs(query(collection(db, 'live_chat_messages'), where('sessionId', '==', sessionId)));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      setChatMessages([]);
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('live_chat_messages').delete().eq('id', msgId);
          if (error) throw error;
        } catch (sErr) {
          console.warn('⚡ [TeacherLive] Supabase delete msg failed, fell back to Firestore:', sErr);
        }
      }

      await deleteDoc(doc(db, 'live_chat_messages', msgId));
      if (activeSession) await loadChat(activeSession.id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-[#060913] text-white min-h-screen font-cairo">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <h1 className="text-lg font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent flex items-center gap-2">
            <Radio className="text-red-500 animate-pulse" size={20} />
            إدارة حصص البث المباشر (Live Sessions)
          </h1>
          <p className="text-[10px] text-gray-500 font-bold">جدول البث التفاعلي المباشر للطلاب والمجموعات أونلاين.</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-xs transition-all shadow-lg hover:shadow-red-500/20 active:scale-95 cursor-pointer"
        >
          <Plus size={14} />
          إنشاء بث مباشر جديد
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-black text-gray-400">جلسات البث المضافة</h3>
          
          {loading ? (
            <div className="flex items-center justify-center p-12 bg-white/[0.02] border border-white/5 rounded-3xl min-h-[200px]">
              <Loader2 className="animate-spin text-red-500" size={24} />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white/[0.02] border border-white/5 rounded-3xl min-h-[200px] text-center">
              <Tv size={36} className="text-gray-700 mb-2" />
              <p className="text-xs text-gray-500 font-bold">لا توجد بثوث مباشرة مسجلة حالياً.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => setActiveSession(session)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-44 ${
                    activeSession?.id === session.id
                      ? 'bg-red-500/5 border-red-500/30'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black ${
                        session.isActive 
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse'
                          : 'bg-white/5 text-gray-500 border border-white/5'
                      }`}>
                        {session.isActive ? '🔴 مباشر الآن' : '⚪ منتهي'}
                      </span>
                      <span className="text-[9px] text-gray-400 font-bold bg-white/5 px-2 py-0.5 rounded-md">
                        {getGradeLabel(session.grade)}
                      </span>
                    </div>

                    <h4 className="text-xs font-black text-white truncate pt-1">{session.title}</h4>
                    <p className="text-[10px] text-gray-500 font-bold line-clamp-2 leading-relaxed">
                      {session.description || 'لا يوجد وصف.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(session);
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-black text-[9px] transition-colors cursor-pointer ${
                        session.isActive
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      {session.isActive ? <PowerOff size={10} /> : <Play size={10} />}
                      {session.isActive ? 'إيقاف البث' : 'بدء البث'}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Chat Monitor Panel */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 flex flex-col h-[500px]">
          {activeSession ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3 shrink-0">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black text-white truncate max-w-[150px]">شات: {activeSession.title}</h4>
                  <span className="text-[9px] text-gray-400 font-bold block">مراقبة تعليقات الطلاب لحظياً</span>
                </div>
                <button
                  onClick={() => handleClearChat(activeSession.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black text-[9px] transition-colors cursor-pointer"
                >
                  تفريغ الشات
                </button>
              </div>

              {/* Chat messages list */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <MessageSquare size={24} className="text-gray-700 mb-2" />
                    <p className="text-[10px] text-gray-500 font-bold">لا توجد رسائل شات بعد.</p>
                  </div>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id} className="group p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-orange-400">{msg.senderName}</span>
                          <span className="text-[8px] text-gray-500 font-bold bg-white/5 px-1 py-0.2 rounded-md">
                            {msg.senderRole === 'student' ? 'طالب' : 'مساعد'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 font-bold text-right leading-relaxed pr-1">
                          {msg.text}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1 rounded-md bg-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash size={10} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <MessageSquare size={36} className="text-gray-700 mb-2" />
              <h4 className="text-xs font-black text-white mb-0.5">شات البث التفاعلي</h4>
              <p className="text-[10px] text-gray-500 font-bold max-w-xs">اختر جلسة بث من القائمة لمراقبة وإدارة شات الطلاب فوريًا.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Live Session Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 left-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>

            <h3 className="text-base font-black text-white mb-6">إنشاء بث مباشر جديد</h3>

            <form onSubmit={handleSaveSession} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold block">عنوان البث</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: مراجعة الباب الثاني والمسائل الصعبة"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-red-500/50 transition-all font-black text-right"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-bold block">الوصف / ملاحظات البث</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="توجيهات للطلاب قبل الانضمام..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-red-500/50 transition-all font-black text-right resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold block">منصة البث</label>
                  <select
                    value={form.streamSource}
                    onChange={(e) => setForm({ ...form, streamSource: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white text-xs focus:outline-none focus:border-red-500/50 transition-all font-black text-right"
                  >
                    <option value="youtube_live">يوتيوب لايف (YouTube Live)</option>
                    <option value="vimeo">فيميو لايف (Vimeo Live)</option>
                    <option value="custom_rtmp">رابط مخصص (RTMP/HLS)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold block">رابط البث (Embed URL)</label>
                  <input
                    type="text"
                    required
                    value={form.streamUrl}
                    onChange={(e) => setForm({ ...form, streamUrl: e.target.value })}
                    placeholder="رابط البث المباشر أو الـ Embed"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-red-500/50 transition-all font-black text-left"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold block">الصف الدراسي</label>
                  <select
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white text-xs focus:outline-none focus:border-red-500/50 transition-all font-black text-right"
                  >
                    <option value="1">الصف الأول</option>
                    <option value="2">الصف الثاني</option>
                    <option value="3">الصف الثالث</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-400 font-bold block">المرحلة الدراسية</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#080d19] border border-white/5 text-white text-xs focus:outline-none focus:border-red-500/50 transition-all font-black text-right"
                  >
                    <option value="primary">الابتدائية</option>
                    <option value="middle">الإعدادية</option>
                    <option value="secondary">الثانوية</option>
                  </select>
                </div>
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
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-xs transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  {saving && <Loader2 className="animate-spin" size={12} />}
                  بدء وحفظ البث
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
