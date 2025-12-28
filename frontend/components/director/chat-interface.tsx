'use client';

/**
 * Creative Director Chat Interface
 * Slice 8: Frontend Chat UI
 */

import { useState, useRef, useEffect } from 'react';
import { MessageBubble } from './message-bubble';
import { QuestionForm } from './question-form';
import { ProviderSelector } from './provider-selector';
import { ChatContextSelector } from './ChatContextSelector';
import { useChatContext } from '@/lib/hooks/use-chat-context';
import { Loader2, Send } from 'lucide-react';
import type { ConversationMessage, ClarifyingQuestion } from '@/lib/agents/types';

interface ChatInterfaceProps {
  brandId: string;
  sessionId?: string;
  onSessionCreate?: (sessionId: string) => void;
}

export function ChatInterface({ brandId, sessionId, onSessionCreate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState<ClarifyingQuestion[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [showCustomInput] = useState(false);
  const [adaptiveSuggestions, setAdaptiveSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Chat context for Campaign → KB → Identity selection
  const { getContextPayload } = useChatContext();

  // AI Model Selection - Load from localStorage or default to OpenAI GPT-4o
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('creative-director-model') || 'anthropic:claude-3-5-sonnet-20241022';
    }
    return 'anthropic:claude-3-5-sonnet-20241022';
  });

  // Persist model selection to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('creative-director-model', selectedModel);
    }
  }, [selectedModel]);


  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load existing session messages
  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    }
  }, [currentSessionId]);

  const loadMessages = async (sid: string) => {
    try {
      const res = await fetch(`/api/v1/conversation/${sid}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json()) as { success: boolean; messages: ConversationMessage[] };
      if (data.success && data.messages) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // Generate adaptive suggestions based on user's request
  const generateAdaptiveSuggestions = (userMessage: string): string[] => {
    const lowerMessage = userMessage.toLowerCase();
    
    // Pattern-based suggestions
    if (lowerMessage.includes('product') || lowerMessage.includes('launch')) {
      return [
        'Create a teaser campaign for the product reveal',
        'Design email sequences for the launch',
        'Write social media posts for launch day',
        'Develop a landing page copy for the product'
      ];
    } else if (lowerMessage.includes('social media') || lowerMessage.includes('instagram') || lowerMessage.includes('tiktok')) {
      return [
        'Create a 30-day content calendar',
        'Write engaging captions with hashtags',
        'Design story highlights concepts',
        'Plan a series of reels or short videos'
      ];
    } else if (lowerMessage.includes('video') || lowerMessage.includes('youtube')) {
      return [
        'Write scripts for a video series',
        'Create video thumbnail concepts',
        'Plan a content strategy for the channel',
        'Develop video titles and descriptions'
      ];
    } else if (lowerMessage.includes('awareness') || lowerMessage.includes('brand')) {
      return [
        'Develop a brand storytelling campaign',
        'Create content pillars for brand messaging',
        'Write thought leadership articles',
        'Plan influencer collaboration strategy'
      ];
    } else if (lowerMessage.includes('email') || lowerMessage.includes('newsletter')) {
      return [
        'Design a welcome email sequence',
        'Create promotional email templates',
        'Write re-engagement campaigns',
        'Plan newsletter content themes'
      ];
    } else {
      // Generic follow-up suggestions
      return [
        'Define target audience and key messages',
        'Create content for multiple platforms',
        'Develop a timeline and milestones',
        'Plan distribution and promotion strategy'
      ];
    }
  };

  const startConversation = async (message: string) => {
    setLoading(true);
    try {
      const [provider, modelId] = selectedModel.split(':');
      const contextPayload = getContextPayload();
      
      const res = await fetch('/api/v1/conversation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          initial_message: message,
          provider,
          model_id: modelId,
          context: contextPayload,
        }),
      });

      const data = (await res.json()) as { success: boolean; session_id: string; response: { content: string; questions?: ClarifyingQuestion[] } };
      
      if (data.success) {
        setCurrentSessionId(data.session_id);
        onSessionCreate?.(data.session_id);
        
        // Add user message
        setMessages(prev => [...prev, {
          id: `temp-${Date.now()}`,
          role: 'user',
          content: message,
          created_at: new Date().toISOString(),
        } as ConversationMessage]);

        // Add assistant response
        setMessages(prev => [...prev, {
          id: `temp-${Date.now()}-1`,
          role: 'assistant',
          content: data.response.content,
          created_at: new Date().toISOString(),
        } as ConversationMessage]);

        // Handle questions
        if (data.response.questions) {
          setPendingQuestions(data.response.questions);
        }

        // Generate adaptive suggestions based on user's first message
        if (showCustomInput) {
          setAdaptiveSuggestions(generateAdaptiveSuggestions(message));
        }
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const continueConversation = async (message: string, answers?: Record<string, unknown>) => {
    if (!currentSessionId) return;

    setLoading(true);
    try {
      const [provider, modelId] = selectedModel.split(':');
      const contextPayload = getContextPayload();
      
      const res = await fetch(`/api/v1/conversation/${currentSessionId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message, 
          answers,
          provider,
          model_id: modelId,
          context: contextPayload,
        }),
      });

      const data = (await res.json()) as { success: boolean; response: { content: string; questions?: ClarifyingQuestion[] } };
      
      if (data.success) {
        // Add user message
        setMessages(prev => [...prev, {
          id: `temp-${Date.now()}`,
          role: 'user',
          content: message,
          created_at: new Date().toISOString(),
        } as ConversationMessage]);

        // Add assistant response
        setMessages(prev => [...prev, {
          id: `temp-${Date.now()}-1`,
          role: 'assistant',
          content: data.response.content,
          created_at: new Date().toISOString(),
        } as ConversationMessage]);

        // Update questions
        if (data.response.questions) {
          setPendingQuestions(data.response.questions);
        } else {
          setPendingQuestions([]);
        }
      }
    } catch (error) {
      console.error('Failed to continue conversation:', error);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    if (currentSessionId) {
      continueConversation(input);
    } else {
      startConversation(input);
    }
  };

  const handleQuestionSubmit = (answers: Record<string, unknown>) => {
    const answerText = Object.entries(answers)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ');
    continueConversation(answerText, answers);
  };

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-lg shadow-md border border-slate-200/80 overflow-hidden">
      {/* Header with Context Selector */}
      <div className="px-3 sm:px-4 py-2 border-b border-slate-200/60 bg-slate-50/50">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Creative Director</h2>
            <p className="text-[11px] text-slate-500">
              {currentSessionId ? 'Ongoing' : 'New campaign'}
            </p>
          </div>
          <div className="shrink-0">
            <ProviderSelector
              value={selectedModel}
              onChange={setSelectedModel}
            />
          </div>
        </div>
        
        {/* Context Selector Bar */}
        <div className="pt-2 border-t border-slate-200/60">
          <ChatContextSelector />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-2 sm:py-3 space-y-2 bg-white">
        {messages.length === 0 && (
          <div className="text-center py-4 px-3 flex flex-col h-full justify-center">
            <h3 className="text-base font-semibold text-slate-900 mb-1.5">
              Describe your campaign
            </h3>
            <p className="text-slate-600 mb-4 text-xs max-w-xl mx-auto leading-relaxed">
              Share your campaign idea and I will help create your content.
            </p>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 mx-auto w-full px-2 sm:px-0 sm:max-w-lg`}>
              {[
                'Product launch campaign',
                'Social media content',
                'YouTube video scripts',
                'Brand awareness campaign',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(suggestion);
                  }}
                  className="text-left px-3 py-2 bg-slate-50 border border-slate-200 hover:border-lamaPurple/40 hover:bg-lamaPurpleLight/30 rounded-md transition-all group text-xs font-medium text-slate-700 group-hover:text-lamaPurple"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && adaptiveSuggestions.length > 0 && messages.length === 2 && (
          <div className="bg-slate-50 rounded-lg p-3 border border-lamaPurple/20 shadow-sm">
            <h4 className="font-semibold text-slate-900 text-xs mb-2">What next?</h4>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2`}>
              {adaptiveSuggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion)}
                  className="text-left px-3 py-2 bg-white border border-lamaPurple/30 hover:bg-lamaPurpleLight/40 hover:border-lamaPurple/50 rounded-md transition-all group text-xs font-medium text-slate-700 group-hover:text-lamaPurple leading-snug"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-lamaPurple bg-white px-3 py-2 rounded-md shadow-sm border border-lamaPurple/20">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="text-xs font-medium">Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Question Form (if pending) */}
      {pendingQuestions.length > 0 && !loading && (
        <div className="px-3 sm:px-4 py-3 border-t border-slate-200 bg-slate-50 overflow-x-auto">
          <QuestionForm
            questions={pendingQuestions}
            onSubmit={handleQuestionSubmit}
            disabled={loading}
          />
        </div>
      )}

      {/* Input */}
      <div className="px-3 sm:px-4 py-3 border-t border-slate-200 bg-white">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={currentSessionId ? "Continue..." : "Describe your campaign..."}
            disabled={loading || pendingQuestions.length > 0}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-lamaPurple/50 focus:border-lamaPurple disabled:bg-slate-100 disabled:cursor-not-allowed transition-all text-slate-900 placeholder:text-slate-400 text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || pendingQuestions.length > 0}
            className="px-4 py-2 bg-lamaPurple text-white rounded-md hover:bg-lamaPurple/90 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 font-medium text-sm shrink-0"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}

