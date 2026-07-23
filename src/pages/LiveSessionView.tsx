import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, setDoc, getDocs, addDoc, serverTimestamp, query, where, onSnapshot, limit } from 'firebase/firestore';
import { getTenantDb } from '../lib/firebase';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Tv, Radio, Send, MessageSquare, AlertCircle, Loader2, User } from 'lucide-react';
import { FahmniPlayer } from '../components/FahmniPlayer';

interface LiveSession {
  id: string;
  title: string;
  description: string;
  streamSource: 'youtube_live' | 'vimeo' | 'custom_rtmp';
  streamUrl: string;
  grade: string;
  level: string;
  isActive: boolean;
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

export const LiveSessionView: React.FC = () => {
  const db = getTenantDb();
  const { profile } = useAuth();
  
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchActiveSession = async () => {
      try {
        let active: LiveSession | null = null;
        const studentGrade = profile?.grade || '1';
        const studentLevel = profile?.level || 'secondary';

        if (isSupabaseConfigured() && supabase) {
          try {
            const { data, error } = await supabase
              .from('live_sessions')
              .select('*')
              .eq('grade', studentGrade)
              .eq('level', studentLevel)
              .eq('is_active', true)
              .limit(1);
            if (error) throw error;
            if (data && data.length > 0) {
              const row = data[0];
              active = {
                id: row.id,
                title: row.title,
                description: row.description || '',
                streamSource: row.stream_source || 'youtube_live',
                streamUrl: row.stream_url || '',
                grade: row.grade,
                level: row.level,
                isActive: row.is_active,
              };
            }
          } catch (sErr) {
            console.warn('⚡ [LiveView] Supabase fetch active session failed, fell back to Firestore:', sErr);
          }
        }

        if (!active) {
          const q = query(
            collection(db, 'live_sessions'),
            where('grade', '==', studentGrade),
            where('level', '==', studentLevel),
            where('isActive', '==', true)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const docData = snap.docs[0];
            active = { id: docData.id, ...docData.data() } as LiveSession;
          }
        }

        setActiveSession(active);
      } catch (err) {
        console.error('Error fetching active live session:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveSession();
  }, [profile]);

  useEffect(() => {
    if (!activeSession) return;

    // Realtime chat subscription
    const currentDb = getTenantDb();
    const chatQuery = query(
      collection(currentDb, 'live_chat_messages'),
      where('sessionId', '==', activeSession.id)
    );

    const unsubscribe = onSnapshot(chatQuery, (snap) => {
      const messages = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as ChatMessage));
      
      setChatMessages(messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsubscribe();
  }, [activeSession]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeSession || sending) return;

    setSending(true);
    try {
      const msgId = `msg_${Date.now()}`;
      const msgPayload = {
        sessionId: activeSession.id,
        senderUid: profile?.uid || 'anonymous',
        senderName: profile?.displayName || 'طالب',
        senderRole: profile?.role || 'student',
        text: inputText.trim(),
        timestamp: new Date().toISOString(),
      };

      // Send to Supabase
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('live_chat_messages').insert({
            id: msgId,
            session_id: msgPayload.sessionId,
            sender_uid: msgPayload.senderUid,
            sender_name: msgPayload.senderName,
            sender_role: msgPayload.senderRole,
            text: msgPayload.text,
            timestamp: msgPayload.timestamp,
          });
          if (error) throw error;
        } catch (sErr) {
          console.warn('⚡ [LiveView] Supabase chat message insert warning, fell back to Firestore:', sErr);
        }
      }

      // Send to Firestore
      await setDoc(doc(db, 'live_chat_messages', msgId), msgPayload);

      setInputText('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] text-white p-6 font-cairo flex flex-col justify-between">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col lg:flex-row gap-6">
        {/* Stream player panel */}
        <div className="flex-1 space-y-4">
          {loading ? (
            <div className="aspect-video w-full rounded-2xl bg-[#060913] flex items-center justify-center">
              <Loader2 className="animate-spin text-red-500" size={32} />
            </div>
          ) : !activeSession ? (
            <div className="aspect-video w-full rounded-2xl bg-[#060913] flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
              <Tv size={48} className="text-gray-700 mb-3" />
              <h3 className="text-sm font-black text-white mb-1">لا يوجد بث مباشر حالياً</h3>
              <p className="text-xs text-gray-500 font-bold max-w-xs leading-relaxed">
                لا توجد حصص مراجعة لايف مفعلة لصفك الدراسي الآن. سيقوم المستر بتشغيل البث قريباً!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between bg-[#060913] p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <Radio className="text-red-500 animate-pulse" size={16} />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-sm font-black text-white">{activeSession.title}</h2>
                    <span className="text-[10px] text-gray-500 font-bold block">{activeSession.description || 'لا يوجد وصف.'}</span>
                  </div>
                </div>
              </div>

              {/* Secure Player */}
              <div className="relative aspect-video rounded-3xl overflow-hidden bg-[#060913] shadow-2xl">
                <FahmniPlayer
                  url={activeSession.streamUrl}
                  title={activeSession.title}
                  watermarkText={`${profile?.displayName} - ${profile?.studentPhone || ''}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Chat sidebar */}
        <div className="w-full lg:w-80 bg-[#060913] rounded-3xl p-4 flex flex-col h-[500px] lg:h-auto shadow-2xl">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5 mb-3 shrink-0">
            <MessageSquare className="text-red-400" size={16} />
            <h4 className="text-xs font-black text-white">الدردشة التفاعلية الحية</h4>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <MessageSquare size={24} className="text-gray-700 mb-2" />
                <p className="text-[9px] text-gray-500 font-bold">ابدأ المحادثة واطرح سؤالك للمستر!</p>
              </div>
            ) : (
              chatMessages.map(msg => (
                <div key={msg.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
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
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Message input */}
          {activeSession && (
            <form onSubmit={handleSendMessage} className="mt-3 flex gap-2 shrink-0">
              <input
                type="text"
                required
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="اكتب سؤالك هنا..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#060913] border border-white/10 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-red-500/50 transition-all font-black text-right"
              />
              <button
                type="submit"
                disabled={sending}
                className="p-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors active:scale-95 cursor-pointer shrink-0"
              >
                <Send size={14} className="rotate-180" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
