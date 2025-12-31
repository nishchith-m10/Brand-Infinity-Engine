'use client';

/**
 * Connection Status Hook
 * 
 * Detects online/offline state and provides:
 * - Real-time connection status
 * - Reconnection state tracking
 * - Message queue for offline messages
 * - Automatic sync on reconnect
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface QueuedMessage {
  id: string;
  message: string;
  sessionId: string;
  timestamp: number;
}

interface ConnectionStatus {
  /** Whether the browser reports online status */
  isOnline: boolean;
  /** Whether we're currently syncing after reconnection */
  isReconnecting: boolean;
  /** Number of queued messages */
  queuedCount: number;
  /** Queue a message for later sending */
  queueMessage: (msg: Omit<QueuedMessage, 'timestamp'>) => void;
  /** Get all queued messages */
  getQueuedMessages: () => QueuedMessage[];
  /** Clear the queue (after successful sync) */
  clearQueue: () => void;
  /** Manually trigger reconnection sync */
  triggerSync: () => void;
}

/**
 * Hook for monitoring connection status and managing offline message queue
 * 
 * @param onReconnect - Callback when connection is restored
 * @returns Connection status and queue management functions
 * 
 * @example
 * const { isOnline, isReconnecting, queueMessage, queuedCount } = useConnectionStatus({
 *   onReconnect: async () => {
 *     // Sync queued messages
 *     const queued = getQueuedMessages();
 *     for (const msg of queued) {
 *       await sendMessage(msg);
 *     }
 *     clearQueue();
 *   },
 * });
 */
export function useConnectionStatus(options?: {
  onReconnect?: () => Promise<void>;
}): ConnectionStatus {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  
  // Use ref for queue to avoid re-renders on queue changes
  const messageQueue = useRef<QueuedMessage[]>([]);

  // Queue a message for offline sending
  const queueMessage = useCallback((msg: Omit<QueuedMessage, 'timestamp'>) => {
    const queuedMsg: QueuedMessage = {
      ...msg,
      timestamp: Date.now(),
    };
    messageQueue.current.push(queuedMsg);
    setQueuedCount(messageQueue.current.length);
    console.log(`[Connection] Message queued (${messageQueue.current.length} total)`);
    
    // Persist to localStorage for page refresh survival
    try {
      localStorage.setItem('__queued_messages', JSON.stringify(messageQueue.current));
    } catch (e) {
      console.warn('[Connection] Failed to persist queue to localStorage');
    }
  }, []);

  // Get all queued messages
  const getQueuedMessages = useCallback((): QueuedMessage[] => {
    return [...messageQueue.current];
  }, []);

  // Clear the queue
  const clearQueue = useCallback(() => {
    messageQueue.current = [];
    setQueuedCount(0);
    try {
      localStorage.removeItem('__queued_messages');
    } catch (e) {
      // Ignore
    }
    console.log('[Connection] Queue cleared');
  }, []);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (options?.onReconnect && messageQueue.current.length > 0) {
      setIsReconnecting(true);
      try {
        await options.onReconnect();
      } finally {
        setIsReconnecting(false);
      }
    }
  }, [options]);

  useEffect(() => {
    // Restore queue from localStorage on mount
    try {
      const stored = localStorage.getItem('__queued_messages');
      if (stored) {
        messageQueue.current = JSON.parse(stored);
        setQueuedCount(messageQueue.current.length);
        console.log(`[Connection] Restored ${messageQueue.current.length} queued messages`);
      }
    } catch (e) {
      // Ignore parse errors
    }

    const handleOnline = async () => {
      console.log('[Connection] Online');
      setIsOnline(true);

      // If there are queued messages, trigger reconnection sync
      if (messageQueue.current.length > 0 && options?.onReconnect) {
        setIsReconnecting(true);
        try {
          await options.onReconnect();
        } catch (error) {
          console.error('[Connection] Reconnection sync failed:', error);
        } finally {
          setIsReconnecting(false);
        }
      }
    };

    const handleOffline = () => {
      console.log('[Connection] Offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [options]);

  return {
    isOnline,
    isReconnecting,
    queuedCount,
    queueMessage,
    getQueuedMessages,
    clearQueue,
    triggerSync,
  };
}

/**
 * Simple hook for just checking online status (no queue)
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
