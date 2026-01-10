// =============================================================================
// REQUEST PROGRESS PAGE
// Example page showing realtime progress with timeline
// =============================================================================

'use client';

import React, { useState } from 'react';
import { useRequestProgress } from '@/lib/hooks/use-request-progress';
import { ProgressTimeline } from '@/components/pipeline/ProgressTimeline';
import { AlertCircle, RefreshCcw, WifiOff } from 'lucide-react';

/**
 * RequestProgressPage - Example implementation of realtime progress tracking
 *
 * This page demonstrates:
 * - SSE connection for realtime updates
 * - Progress timeline with task cards
 * - Retry button for failed tasks
 * - Connection status indicators
 * - Estimated completion time
 *
 * To use in your app:
 * 1. Import useRequestProgress and ProgressTimeline
 * 2. Call hook with requestId
 * 3. Render ProgressTimeline with progress.tasks
 * 4. Implement retry handler to call retry API
 *
 * @example
 * ```tsx
 * // In your request detail page:
 * const { progress, isConnected, error } = useRequestProgress(requestId);
 *
 * return (
 *   <div>
 *     <ProgressBar percentage={progress?.percentage || 0} />
 *     <ProgressTimeline
 *       tasks={progress?.tasks || []}
 *       onRetryTask={handleRetry}
 *     />
 *   </div>
 * );
 * ```
 */
export default function RequestProgressPage({
  params,
}: {
  params: { id: string }; // no Promise, not async
}) {
  const requestId = params?.id;
  const { progress, isConnected, error, reconnect } = useRequestProgress(requestId);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);

  /**
   * Handle task retry
   */
  const handleRetry = async (taskId: string) => {
    setIsRetrying(taskId);

    try {
      const response = await fetch(
        `/api/v1/requests/${requestId}/tasks/${taskId}/retry`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Retry failed:', errorData);
        alert(`Retry failed: ${errorData.error || 'Unknown error'}`);
      } else {
        const result = await response.json();
        console.log('Retry initiated:', result);
      }
    } catch (err) {
      console.error('Retry request failed:', err);
      alert('Failed to retry task. Please try again.');
    } finally {
      setIsRetrying(null);
    }
  };

  if (!requestId) {
    return (
      <div className="container mx-auto max-w-4xl p-8">
        <div className="rounded-lg border bg-card p-6">No request ID provided.</div>
      </div>
    );
  }

  // Loading state
  if (!progress && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <div className="text-muted-foreground">Loading progress...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto max-w-4xl p-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 shrink-0 text-destructive" />
            <div className="flex-1 space-y-2">
              <div className="font-semibold text-destructive">Connection Error</div>
              <div className="text-sm text-destructive/90">{error}</div>
              <button
                onClick={reconnect}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                <RefreshCcw className="h-4 w-4" />
                Reconnect
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-8">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold">Request Progress</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-mono">{requestId}</span>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-600">Live updates</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <span>Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {progress && (
        <div className="mb-8 rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-bold">{progress.percentage}%</div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">
                {progress.completedTasks} / {progress.totalTasks} tasks
              </div>
              {progress.estimatedSecondsRemaining !== null && progress.estimatedSecondsRemaining > 0 && (
                <div className="text-xs text-muted-foreground">
                  ~{Math.ceil(progress.estimatedSecondsRemaining / 60)} minutes remaining
                </div>
              )}
            </div>
          </div>

          {/* Progress bar visual */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          {/* Task counts */}
          <div className="mt-4 grid grid-cols-4 gap-4 text-center text-sm">
            <div>
              <div className="font-medium text-muted-foreground">{progress.completedTasks}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div>
              <div className="font-medium text-primary">{progress.inProgressTasks}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground">{progress.pendingTasks}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div>
              <div className="font-medium text-destructive">{progress.failedTasks}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {progress && (
        <ProgressTimeline
          tasks={progress.tasks}
          currentPhase={progress.currentPhase}
          onRetryTask={handleRetry}
        />
      )}

      {/* Retry indicator */}
      {isRetrying && (
        <div className="fixed bottom-4 right-4 rounded-lg border bg-card p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm font-medium">Retrying task...</span>
          </div>
        </div>
      )}
    </div>
  );
}
