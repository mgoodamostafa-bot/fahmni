import React, { useState } from 'react';
import { Conversation } from '../services/messagingService';
import { Search, MessageSquare, User } from 'lucide-react';
import { motion } from 'framer-motion';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentRole: 'teacher' | 'parent';
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  currentRole,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter((convo) => {
    const targetName = currentRole === 'teacher' ? convo.studentName : convo.teacherName;
    return targetName.toLowerCase().includes(searchQuery.toLowerCase()) || 
           convo.parentPhone.includes(searchQuery);
  });

  const formatLastMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    let date: Date;
    if (timestamp.toDate) date = timestamp.toDate();
    else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
    else date = new Date(timestamp);

    return date.toLocaleDateString('ar-EG', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="flex flex-col h-full bg-white/[0.01] border border-white/5 rounded-3xl overflow-hidden">
      {/* Search Header */}
      <div className="p-4 border-b border-white/5 space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="بحث عن محادثة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600/50 focus:bg-white/10 transition-all text-right"
            dir="rtl"
          />
          <Search size={16} className="absolute right-3.5 top-3.5 text-gray-500" />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
        {filteredConversations.length > 0 ? (
          filteredConversations.map((convo) => {
            const isSelected = convo.id === selectedId;
            const targetName = currentRole === 'teacher' ? convo.studentName : convo.teacherName;
            const subtitle = currentRole === 'teacher' ? `ولي أمر الطالب` : `معلم الكورس`;
            const unreadCount = currentRole === 'teacher' ? convo.unreadByTeacher : convo.unreadByParent;

            return (
              <motion.button
                key={convo.id}
                onClick={() => onSelect(convo.id)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all text-right border ${
                  isSelected
                    ? 'bg-emerald-600/10 border-emerald-600/30 shadow-lg shadow-emerald-900/5'
                    : 'bg-white/2 border-white/5 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-emerald-600 text-white' : 'bg-white/5 text-gray-400 border border-white/5'
                  }`}>
                    {currentRole === 'teacher' ? <User size={20} /> : <MessageSquare size={20} />}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-white truncate">{targetName}</h4>
                      {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 font-bold leading-none">{subtitle}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[180px] pt-1">
                      {convo.lastMessage || 'لا توجد رسائل بعد'}
                    </p>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <span className="text-[9px] text-gray-500 font-bold">
                    {formatLastMessageTime(convo.lastMessageAt)}
                  </span>
                </div>
              </motion.button>
            );
          })
        ) : (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center mx-auto text-gray-600">
              <MessageSquare size={20} />
            </div>
            <p className="text-xs text-gray-500 font-bold">لا توجد محادثات تطابق البحث</p>
          </div>
        )}
      </div>
    </div>
  );
};
