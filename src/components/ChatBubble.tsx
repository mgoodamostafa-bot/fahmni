import React from 'react';
import { Message } from '../services/messagingService';
import { motion } from 'framer-motion';
import { Check, CheckCheck } from 'lucide-react';

interface ChatBubbleProps {
  message: Message;
  isOwn: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isOwn }) => {
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    let date: Date;
    if (timestamp.toDate) date = timestamp.toDate();
    else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
    else date = new Date(timestamp);

    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex w-full mb-3 ${isOwn ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-md relative overflow-hidden ${
          isOwn
            ? 'bg-emerald-600 text-white rounded-tr-none'
            : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-none'
        }`}
      >
        {/* Sender Name */}
        <p className={`text-[10px] font-bold mb-1 opacity-60`}>
          {message.senderName}
        </p>

        {/* Message Content */}
        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
          {message.text}
        </p>

        {/* Timestamp & Status */}
        <div className="flex items-center justify-end gap-1.5 mt-1.5 opacity-60 text-[9px]">
          <span>{formatTime(message.createdAt)}</span>
          {isOwn && (
            <span>
              {message.read ? (
                <CheckCheck size={12} className="text-sky-300" />
              ) : (
                <Check size={12} className="text-gray-300" />
              )}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
