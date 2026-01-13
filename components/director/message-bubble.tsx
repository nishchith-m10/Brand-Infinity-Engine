'use client';

/**
 * Message Bubble Component
 * Slice 8: Frontend Chat UI
 */

import { formatDistanceToNow } from 'date-fns';
import { Bot, User, Clock } from 'lucide-react';
import type { ConversationMessage } from '@/lib/agents/types';

interface MessageBubbleProps {
  message: ConversationMessage;
  /** True when message is optimistically added but not yet confirmed */
  isPending?: boolean;
}

export function MessageBubble({ message, isPending = false }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} ${isPending ? 'opacity-70' : ''}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-600' : isSystem ? 'bg-gray-400' : 'bg-purple-600'
      }`}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-lg px-4 py-3 ${
          isUser 
            ? 'bg-blue-600 text-white' 
            : isSystem
            ? 'bg-gray-100 text-gray-900'
            : 'bg-gray-100 text-gray-900'
        }`}>
          <div className="text-sm whitespace-pre-wrap wrap-break-word">
            {message.content}
          </div>
          
          {/* Metadata */}
          {message.model_used && !isUser && (
            <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2 text-xs text-gray-500">
              <span className="font-mono">{message.model_used}</span>
              {message.tokens_used && (
                <span>• {message.tokens_used.toLocaleString()} tokens</span>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className={`mt-1 text-xs text-gray-500 ${isUser ? 'text-right' : 'text-left'}`}>
          {isPending ? (
            <span className="flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3" />
              Sending...
            </span>
          ) : (
            formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
          )}
        </div>
      </div>
    </div>
  );
}

