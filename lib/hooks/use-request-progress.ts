// =============================================================================
// USE REQUEST PROGRESS HOOK
// Realtime progress updates via Server-Sent Events (SSE)
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Progress information from SSE stream
 */
export interface ProgressInfo {
  percentage: number;
  completedTasks: number;
  totalTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  failedTasks: number;
  estimatedSecondsRemaining: number | null;
  currentPhase: string;
  tasks: TaskProgressInfo[];
}

export interface TaskProgressInfo {
  id: string;
  task_key: string;
  task_name: string;
  agent_role: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  sequence_order: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  estimated_duration_seconds: number;
}

/**
 * Hook return type
 */
export interface UseRequestProgressReturn {
  progress: ProgressInfo | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

/**
 * useRequestProgress - Realtime progress updates via SSE
 * 
 * Connects to /api/v1/requests/[id]/progress and streams progress updates.
 * Automatically reconnects on connection loss.
 * 
 * @param requestId - Content request ID
 * @param enabled - Whether to enable SSE connection (default: true)
 * @returns Progress state and connection status
 * 
 * @example
 * ```tsx
 * function RequestProgress({ requestId }: { requestId: string }) {
 *   const { progress, isConnected, error } = useRequestProgress(requestId);
 * 
 *   if (error) return <div>Error: {error}</div>;
 *   if (!progress) return <div>Loading...</div>;
 * 
 *   return (
 *     <div>
 *       <div>Progress: {progress.percentage}%</div>
 *       <div>Phase: {progress.currentPhase}</div>
 *       <div>Tasks: {progress.completedTasks}/{progress.totalTasks}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useRequestProgress(
  requestId: string,
  enabled: boolean = true
): UseRequestProgressReturn {
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    if (!enabled || !requestId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    console.log('[useRequestProgress] Connecting to SSE:', requestId);

    try {
      const eventSource = new EventSource(`/api/v1/requests/${requestId}/progress`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[useRequestProgress] SSE connected');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Check for error message from server
          if (data.error) {
            setError(data.error);
            setIsConnected(false);
            // use ref to ensure we close the active EventSource
            eventSourceRef.current?.close();
            return;
          }

          // Update progress
          setProgress(data as ProgressInfo);

          // Auto-close if complete
          if (data.percentage >= 100) {
            console.log('[useRequestProgress] Request complete, closing SSE');
            // use ref to ensure we close the active EventSource
            eventSourceRef.current?.close();
            setIsConnected(false);
          }
        } catch (err) {
          console.error('[useRequestProgress] Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('[useRequestProgress] SSE error:', err);
        setIsConnected(false);

        // Auto-reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current += 1;

          console.log(
            `[useRequestProgress] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
          );

          setTimeout(() => {
            connect();
          }, delay);
        } else {
          setError('Connection lost. Please refresh the page.');
          // close using ref to address potential stale closure
          eventSourceRef.current?.close();
        }
      };
    } catch (err) {
      console.error('[useRequestProgress] Failed to create EventSource:', err);
      setError('Failed to connect to progress stream');
      setIsConnected(false);
    }
  }, [requestId, enabled]);

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    setError(null);
    connect();
  }, [connect]);

  /**
   * Connect on mount and when requestId/enabled changes
   */
  useEffect(() => {
    if (enabled && requestId) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        console.log('[useRequestProgress] Cleaning up SSE connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect, enabled, requestId]);

  return {
    progress,
    isConnected,
    error,
    reconnect,
  };
}

export default useRequestProgress;
