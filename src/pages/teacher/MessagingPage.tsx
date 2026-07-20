import React, { useState, useEffect, useRef } from 'react';
import { messagingService, Conversation, Message } from '../../services/messagingService';
import { ChatBubble } from '../../components/ChatBubble';
import { ConversationList } from '../../components/ConversationList';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { getTenantDb } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Plus, ArrowRight, MessageCircle, Search, X, Loader2, Users } from 'lucide-react';

export const MessagingPage: React.FC = () => {
  const { profile } = useAuth();
  const { tenantData } = useTenant();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'chat'>('list');

  // New Chat Modal States
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [studentCategory, setStudentCategory] = useState<'all' | 'center' | 'online'>('all');
  const [students, setStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConvo = conversations.find((c) => c.id === selectedConvoId);

  // Set global teacher Uid variable so sidebar can listen to unread messages count
  useEffect(() => {
    if (profile?.uid) {
      (window as any).__fahmni_teacher_uid = profile.uid;
    }
  }, [profile?.uid]);

  // Load teacher conversations
  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = messagingService.subscribeToTeacherConversations(profile.uid, (data) => {
      setConversations(data);
    });
    return () => unsub();
  }, [profile?.uid]);

  // Load conversation messages
  useEffect(() => {
    if (!selectedConvoId) return;
    const unsub = messagingService.subscribeToMessages(selectedConvoId, (data) => {
      setMessages(data);
      // Auto scroll
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
    
    // Mark as read
    messagingService.markMessagesAsRead(selectedConvoId, 'teacher');
    
    return () => unsub();
  }, [selectedConvoId]);

  // Fetch student directory for new chat modal (both Center & Online students)
  const handleOpenNewChatModal = async () => {
    setShowNewChatModal(true);
    setLoadingStudents(true);
    try {
      const db = getTenantDb();
      
      // 1. Fetch Online Students from 'users'
      const onlineSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const onlineList = onlineSnap.docs.map((d) => {
        const data = d.data();
        const code = data.studentId || data.studentCode || data.code || d.id;
        return {
          uid: d.id,
          ...data,
          studentId: code,
          studentType: 'online',
        };
      });

      // 2. Fetch Center Students from 'center_students'
      const centerSnap = await getDocs(collection(db, 'center_students'));
      const centerList = centerSnap.docs.map((d) => {
        const data = d.data();
        const code = data.studentId || data.student_id || data.studentCode || data.student_code || data.code || d.id;
        return {
          uid: d.id,
          ...data,
          studentId: code,
          studentType: 'center',
        };
      });

      // Merge preventing duplicates
      const studentMap = new Map();
      onlineList.forEach((s) => studentMap.set(s.uid, s));
      centerList.forEach((s) => studentMap.set(s.uid, s));

      setStudents(Array.from(studentMap.values()));
    } catch (err) {
      console.error('Error fetching students list:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleStartChat = async (student: any) => {
    if (!profile?.uid) return;
    
    // Get parent phone
    const parentPhone = student.fatherPhone || student.motherPhone || student.studentPhone || '01000000000';

    try {
      const convoId = await messagingService.getOrCreateConversation(
        profile.uid,
        profile.displayName || 'المعلم',
        student.uid,
        student.displayName || 'طالب غير معروف',
        parentPhone,
        tenantData?.id
      );
      
      setSelectedConvoId(convoId);
      setShowNewChatModal(false);
      setActiveTab('chat');
    } catch (err) {
      console.error('Error starting conversation:', err);
      alert('حدث خطأ أثناء بدء المحادثة');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConvoId || !profile?.uid) return;

    try {
      await messagingService.sendMessage(
        selectedConvoId,
        profile.uid,
        'teacher',
        profile.displayName || 'المعلم',
        inputText
      );
      setInputText('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchesCategory =
      studentCategory === 'all' ||
      (studentCategory === 'center' && s.studentType === 'center') ||
      (studentCategory === 'online' && s.studentType === 'online');

    const cleanQuery = searchQuery.toLowerCase().trim();
    const code = String(s.studentId || s.studentCode || s.code || '');
    const matchesSearch =
      !cleanQuery ||
      s.displayName?.toLowerCase().includes(cleanQuery) ||
      code.includes(cleanQuery) ||
      s.studentPhone?.includes(cleanQuery) ||
      s.fatherPhone?.includes(cleanQuery);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-space-950 p-6 text-white font-display" dir="rtl">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-6">
        <div>
          <h1 className="text-2xl font-black text-white">الرسائل والمحادثات</h1>
          <p className="text-[10px] text-gray-500 font-bold">تواصل مباشر ولحظي مع أولياء أمور الطلاب</p>
        </div>
        <button
          onClick={handleOpenNewChatModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>محادثة جديدة</span>
        </button>
      </div>

      {/* Main Panel layout */}
      <div className="flex-1 flex gap-6 overflow-hidden relative">
        {/* Conversations List Panel */}
        <div className={`w-full md:w-[320px] shrink-0 ${activeTab === 'chat' ? 'hidden md:block' : 'block'}`}>
          <ConversationList
            conversations={conversations}
            selectedId={selectedConvoId}
            onSelect={(id) => {
              setSelectedConvoId(id);
              setActiveTab('chat');
            }}
            currentRole="teacher"
          />
        </div>

        {/* Chat window panel */}
        <div className={`flex-1 flex flex-col bg-white/[0.01] border border-white/5 rounded-3xl overflow-hidden ${
          activeTab === 'list' ? 'hidden md:flex' : 'flex'
        }`}>
          {selectedConvo ? (
            <>
              {/* Header */}
              <div className="p-4 bg-white/2 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('list')}
                    className="md:hidden p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white"
                  >
                    <ArrowRight size={18} />
                  </button>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">{selectedConvo.studentName}</h3>
                    <p className="text-[10px] text-emerald-400 font-bold">محادثة ولي الأمر ({selectedConvo.parentPhone || 'غير محدد'})</p>
                  </div>
                </div>
              </div>

              {/* Message scroll area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                {messages.length > 0 ? (
                  messages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      message={msg}
                      isOwn={msg.senderRole === 'teacher'}
                    />
                  ))
                ) : (
                  <div className="py-20 text-center space-y-2">
                    <MessageCircle size={32} className="text-gray-600 mx-auto" />
                    <p className="text-xs text-gray-500 font-bold">ابدأ بإرسال أول رسالة لولي الأمر الآن</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-white/[0.01] flex items-center gap-3">
                <input
                  type="text"
                  placeholder="اكتب رسالتك لولي الأمر هنا..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600/50 focus:bg-white/10 transition-all text-right"
                  dir="rtl"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-16 h-16 bg-white/5 border border-white/5 rounded-3xl flex items-center justify-center text-gray-500">
                <MessageCircle size={28} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">لم يتم تحديد أي محادثة</h3>
                <p className="text-xs text-gray-500 font-bold mt-1">اختر ولي أمر من القائمة الجانبية أو ابدأ محادثة جديدة</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b0c13] border border-white/10 rounded-[2rem] w-full max-w-md overflow-hidden relative shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Users className="text-emerald-500" size={20} />
                  <h3 className="text-base font-black text-white">بدء محادثة جديدة</h3>
                </div>
                <button
                  onClick={() => setShowNewChatModal(false)}
                  className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Student category tabs */}
              <div className="flex border-b border-white/5 bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => setStudentCategory('all')}
                  className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    studentCategory === 'all'
                      ? 'border-emerald-500 text-emerald-400 font-black bg-emerald-500/10'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  الكل ({students.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStudentCategory('center')}
                  className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    studentCategory === 'center'
                      ? 'border-emerald-500 text-emerald-400 font-black bg-emerald-500/10'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  🏫 طلاب السنتر ({students.filter((s) => s.studentType === 'center').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStudentCategory('online')}
                  className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    studentCategory === 'online'
                      ? 'border-emerald-500 text-emerald-400 font-black bg-emerald-500/10'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  🌐 طلاب المنصة ({students.filter((s) => s.studentType === 'online').length})
                </button>
              </div>

              {/* Search directory */}
              <div className="p-4 border-b border-white/5">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="بحث باسم الطالب، الكود، أو رقم الهاتف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600/50 focus:bg-white/10 transition-all text-right"
                    dir="rtl"
                  />
                  <Search size={16} className="absolute right-3.5 top-3.5 text-gray-500" />
                </div>
              </div>

              {/* Student Results Directory */}
              <div className="max-h-[300px] overflow-y-auto p-4 space-y-2">
                {loadingStudents ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="animate-spin text-emerald-500" size={24} />
                  </div>
                ) : filteredStudents.length > 0 ? (
                  filteredStudents.map((st) => (
                    <button
                      key={st.uid}
                      onClick={() => handleStartChat(st)}
                      className="w-full p-4 bg-white/2 hover:bg-white/5 border border-white/5 rounded-xl flex items-center justify-between text-right transition-all cursor-pointer group"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-white group-hover:text-emerald-400 transition-colors">
                            {st.displayName}
                          </h4>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              st.studentType === 'center'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {st.studentType === 'center' ? '🏫 سنتر' : '🌐 أونلاين'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-bold">
                          الكود: <span className="text-gray-300 font-mono">{st.studentId || 'غير محدد'}</span>
                          {(st.fatherPhone || st.studentPhone) && (
                            <span className="mr-3">هاتف: {st.fatherPhone || st.studentPhone}</span>
                          )}
                        </p>
                      </div>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-black group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                        بدء شات
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 font-bold text-center py-12">لا يوجد طلاب متطابقين</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
