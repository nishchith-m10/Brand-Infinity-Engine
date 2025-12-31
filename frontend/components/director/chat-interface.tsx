'use client';

/**
 * Creative Director Chat Interface
 * Slice 8: Frontend Chat UI
 * Enhanced with optimistic updates, streaming, and error recovery
 */

import { useState, useRef, useEffect } from 'react';
import { MessageBubble } from './message-bubble';
import { QuestionForm } from './question-form';
import { ProviderSelector } from './provider-selector';
import { ChatContextSelector } from './ChatContextSelector';
import { TypingIndicator } from './typing-indicator';
import { ProgressSteps, InlineProgress, useProgressSteps, DEFAULT_GENERATION_STEPS } from './progress-steps';
import { useChatContext } from '@/lib/hooks/use-chat-context';
import { useApiKeys } from '@/contexts/api-keys-context';
import { useConnectionStatus } from '@/lib/hooks/use-connection-status';
import { useStreamingResponse } from '@/lib/hooks/use-streaming-response';
import { fetchWithRetry, generateIdempotencyKey } from '@/lib/utils/fetch-with-retry';
import { dedup, createMessageDedupKey } from '@/lib/utils/request-dedup';
import { Loader2, Send, WifiOff, RefreshCw } from 'lucide-react';
import type { ConversationMessage, ClarifyingQuestion } from '@/lib/agents/types';

interface ChatInterfaceProps {
  brandId: string;
  sessionId?: string;
  onSessionCreate?: (sessionId: string) => void;
}

export function ChatInterface({ brandId, sessionId, onSessionCreate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<(ConversationMessage & { _pending?: boolean })[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState<ClarifyingQuestion[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [showCustomInput] = useState(false);
  const [adaptiveSuggestions, setAdaptiveSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useStreaming, setUseStreaming] = useState(true); // Toggle for streaming mode
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { apiKeys } = useApiKeys();
  
  // Progress tracking for content generation
  const { 
    steps: progressSteps, 
    isInProgress, 
    startProgress, 
    nextStep, 
    completeAll: completeProgress, 
    reset: resetProgress 
  } = useProgressSteps(DEFAULT_GENERATION_STEPS);
  
  // Streaming hook
  const { isStreaming, content: streamingContent, startStream, cancelStream, resetContent } = useStreamingResponse();
  
  // Connection status for offline detection
  const { isOnline, isReconnecting } = useConnectionStatus();
  
  // Chat context for Campaign → KB → Identity selection
  const { getContextPayload } = useChatContext();

  // Cancel pending requests on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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


  // Auto-scroll to bottom (also on streaming content update)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

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
    console.log('[Chat] Starting conversation with message:', message);
    
    // Cancel any previous pending request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setError(null);
    const tempId = `temp-${Date.now()}`;
    
    // OPTIMISTIC: Add user message immediately
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
      _pending: true,
    } as ConversationMessage & { _pending?: boolean }]);
    
    setLoading(true);
    
    try {
      const [provider, modelId] = selectedModel.split(':');
      const contextPayload = getContextPayload();
      const idempotencyKey = generateIdempotencyKey('start');
      
      console.log('[Chat] Sending to API with provider:', provider, 'model:', modelId);
      
      const res = await fetchWithRetry('/api/v1/conversation/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          brand_id: brandId,
          initial_message: message,
          provider,
          model_id: modelId,
          context: contextPayload,
          openrouter_api_key: apiKeys.openrouter,
        }),
        signal: abortControllerRef.current.signal,
      });

      const data = (await res.json()) as { success: boolean; session_id: string; response: { content: string; questions?: ClarifyingQuestion[] } };
      
      if (data.success) {
        setCurrentSessionId(data.session_id);
        onSessionCreate?.(data.session_id);
        
        // Mark user message as confirmed
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...m, _pending: false } : m
        ));

        // Add assistant response
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response.content,
          created_at: new Date().toISOString(),
        } as ConversationMessage]);

        // Handle questions
        if (data.response.questions) {
          setPendingQuestions(data.response.questions);
        }

        // Generate adaptive suggestions
        if (showCustomInput) {
          setAdaptiveSuggestions(generateAdaptiveSuggestions(message));
        }
      } else {
        const errorMessage = (data as unknown as { error?: { message?: string } }).error?.message || 'API returned success: false';
        throw new Error(errorMessage);
      }
    } catch (err) {
      // Don't show error for intentional cancellation
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[Chat] Request cancelled');
        return;
      }
      
      console.error('Failed to start conversation:', err);
      const displayError = err instanceof Error ? err.message : 'Failed to send message. Please try again.';
      setError(displayError);
      
      // ROLLBACK: Remove optimistic message
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const continueConversation = async (message: string, answers?: Record<string, unknown>) => {
    if (!currentSessionId) return;

    // Cancel any previous pending request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setError(null);
    const tempId = `temp-${Date.now()}`;
    
    // OPTIMISTIC: Add user message immediately
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
      _pending: true,
    } as ConversationMessage & { _pending?: boolean }]);
    
    setLoading(true);
    
    // Start progress tracking (Bug 2.1 fix)
    startProgress();
    
    try {
      const [provider, modelId] = selectedModel.split(':');
      const contextPayload = getContextPayload();
      
      // Mark user message as confirmed
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, _pending: false } : m
      ));
      
      if (useStreaming) {
        // Use streaming endpoint
        let isFirstChunk = true;
        
        await startStream({
          sessionId: currentSessionId,
          message: answers ? `${message}\n\nAnswers: ${JSON.stringify(answers)}` : message,
          provider,
          modelId,
          apiKey: apiKeys.openrouter,
          onChunk: () => {
            // Move to next step on first chunk (Bug 2.1)
            if (isFirstChunk) {
              nextStep(); // Analyzing -> Planning
              isFirstChunk = false;
            }
          },
          onComplete: (fullContent) => {
            // Add completed message to history (Bug 1.4 fix)
            setMessages(prev => [...prev, {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
            } as ConversationMessage]);
            
            resetContent();
            completeProgress(); // Mark all steps complete
            setPendingQuestions([]);
          },
          onError: (error) => {
            setError(error.message);
            resetProgress();
          },
        });
      } else {
        // Use regular endpoint (fallback)
        const idempotencyKey = generateIdempotencyKey('continue');
        const dedupKey = createMessageDedupKey(currentSessionId, message);
        
        // Move to planning step
        nextStep();
        
        const res = await dedup(dedupKey, () => 
          fetchWithRetry(`/api/v1/conversation/${currentSessionId}/continue`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-idempotency-key': idempotencyKey,
            },
            body: JSON.stringify({ 
              message, 
              answers,
              provider,
              model_id: modelId,
              context: contextPayload,
              openrouter_api_key: apiKeys.openrouter,
            }),
            signal: abortControllerRef.current!.signal,
          })
        );

        const data = (await res.json()) as { success: boolean; response: { content: string; questions?: ClarifyingQuestion[] } };
        
        if (data.success) {
          // Add assistant response
          setMessages(prev => [...prev, {
            id: `assistant-${Date.now()}`,
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
          
          completeProgress();
        } else {
          const errorMessage = (data as unknown as { error?: { message?: string } }).error?.message || 'API returned success: false';
          throw new Error(errorMessage);
        }
      }
    } catch (err) {
      // Don't show error for intentional cancellation
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[Chat] Request cancelled');
        resetProgress();
        return;
      }
      
      console.error('Failed to continue conversation:', err);
      const displayError = err instanceof Error ? err.message : 'Failed to send message. Please try again.';
      setError(displayError);
      resetProgress();
      
      // ROLLBACK: Remove optimistic message
      setMessages(prev => prev.filter(m => m.id !== tempId));
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
    <div className="flex flex-col flex-1 min-h-0 w-full bg-white rounded-lg shadow-md border border-slate-200/80 overflow-hidden">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-yellow-800">
          <WifiOff className="w-4 h-4" />
          <span className="text-xs font-medium">You're offline. Messages will send when you reconnect.</span>
        </div>
      )}
      {isReconnecting && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-800">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-xs font-medium">Reconnecting...</span>
        </div>
      )}
      
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
          <div className="text-center py-8 px-3 flex flex-col">
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
          <MessageBubble 
            key={message.id} 
            message={message}
            isPending={'_pending' in message && message._pending}
          />
        ))}

        {/* Streaming response - show as it comes in */}
        {isStreaming && streamingContent && (
          <div className="flex gap-3 flex-row">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-lamaPurple">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2h-14a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 max-w-[80%]">
              <div className="rounded-lg px-4 py-3 bg-gray-100 text-gray-900">
                <div className="text-sm whitespace-pre-wrap break-words">
                  {streamingContent}
                  <span className="inline-block w-2 h-4 ml-1 bg-lamaPurple animate-pulse" />
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-500 text-left">Generating...</div>
            </div>
          </div>
        )}

        {/* Progress steps - show during content generation */}
        {isInProgress && (
          <div className="py-2">
            <ProgressSteps steps={progressSteps} variant="horizontal" size="sm" />
          </div>
        )}

        {/* Show typing indicator only when loading but not streaming */}
        {loading && !isStreaming && !isInProgress && <TypingIndicator />}
        
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-200">
            <span className="text-xs">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-xs underline hover:no-underline"
            >
              Dismiss
            </button>
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

