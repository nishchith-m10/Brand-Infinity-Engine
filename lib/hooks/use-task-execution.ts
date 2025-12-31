/**
 * useTaskExecution Hook
 * 
 * Manages task plan execution with progress polling.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface TaskProgress {
  percentage: number;
  currentTask?: string;
  totalTasks: number;
  completedTasks: number;
}

interface TaskExecutionState {
  isExecuting: boolean;
  planId: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: TaskProgress | null;
  results: unknown[];
  errors: string[];
}

interface ExecuteOptions {
  sessionId: string;
  campaignId?: string;
  brandContext?: string;
  onProgress?: (progress: TaskProgress) => void;
  onComplete?: (results: unknown[]) => void;
  onError?: (errors: string[]) => void;
}

const POLL_INTERVAL = 2000; // 2 seconds

export function useTaskExecution() {
  const [state, setState] = useState<TaskExecutionState>({
    isExecuting: false,
    planId: null,
    status: 'idle',
    progress: null,
    results: [],
    errors: [],
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  const pollProgress = useCallback(async (planId: string, callbacks: {
    onProgress?: (progress: TaskProgress) => void;
    onComplete?: (results: unknown[]) => void;
    onError?: (errors: string[]) => void;
  }) => {
    try {
      const response = await fetch(`/api/v1/tasks/${planId}/progress`, {
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch progress');
      }

      const data = await response.json();

      if (data.success) {
        const progress: TaskProgress = {
          percentage: data.progress?.percentage || 0,
          currentTask: data.progress?.current_task,
          totalTasks: data.progress?.total_tasks || 0,
          completedTasks: data.progress?.completed_tasks || 0,
        };

        setState(prev => ({
          ...prev,
          status: data.status,
          progress,
          results: data.results || [],
          errors: data.errors || [],
        }));

        callbacks.onProgress?.(progress);

        // Check if completed or failed
        if (data.status === 'completed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setState(prev => ({ ...prev, isExecuting: false, status: 'completed' }));
          callbacks.onComplete?.(data.results || []);
        } else if (data.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setState(prev => ({ ...prev, isExecuting: false, status: 'failed' }));
          callbacks.onError?.(data.errors || ['Execution failed']);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('[TaskExecution] Poll error:', error);
    }
  }, []);

  const execute = useCallback(async (options: ExecuteOptions) => {
    const { sessionId, campaignId, brandContext, onProgress, onComplete, onError } = options;

    // Cancel any existing execution
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    setState({
      isExecuting: true,
      planId: null,
      status: 'running',
      progress: null,
      results: [],
      errors: [],
    });

    try {
      // Start execution
      const response = await fetch('/api/v1/tasks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          campaign_id: campaignId,
          brand_context: brandContext,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Execution failed');
      }

      const data = await response.json();

      if (!data.success || !data.plan_id) {
        throw new Error(data.error?.message || 'Failed to start execution');
      }

      setState(prev => ({
        ...prev,
        planId: data.plan_id,
        progress: data.progress,
      }));

      // Start polling for progress
      pollIntervalRef.current = setInterval(() => {
        pollProgress(data.plan_id, { onProgress, onComplete, onError });
      }, POLL_INTERVAL);

      // Delay initial poll to allow DB persistence (Bug 3.4 fix)
      setTimeout(() => {
        pollProgress(data.plan_id, { onProgress, onComplete, onError });
      }, 1000);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      console.error('[TaskExecution] Execute error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setState(prev => ({
        ...prev,
        isExecuting: false,
        status: 'failed',
        errors: [errorMessage],
      }));

      onError?.([errorMessage]);
    }
  }, [pollProgress]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isExecuting: false,
      status: 'idle',
    }));
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState({
      isExecuting: false,
      planId: null,
      status: 'idle',
      progress: null,
      results: [],
      errors: [],
    });
  }, [cancel]);

  return {
    ...state,
    execute,
    cancel,
    reset,
  };
}
