// =============================================================================
// PROGRESS TIMELINE COMPONENT
// Visual timeline showing task progress with realtime updates
// =============================================================================

'use client';

import React from 'react';
import { CheckCircle2, Circle, XCircle, Loader2, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskProgressInfo } from '@/lib/hooks/use-request-progress';

/**
 * Props for ProgressTimeline component
 */
export interface ProgressTimelineProps {
  tasks: TaskProgressInfo[];
  currentPhase?: string;
  onRetryTask?: (taskId: string) => void;
  className?: string;
}

/**
 * ProgressTimeline - Visual task progress with status indicators
 * 
 * Displays a vertical timeline of tasks with:
 * - Status icons (pending, in_progress, completed, failed)
 * - Task names and agent roles
 * - Start/end timestamps
 * - Duration (for completed tasks)
 * - Retry button (for failed tasks)
 * 
 * @example
 * ```tsx
 * <ProgressTimeline
 *   tasks={progress.tasks}
 *   currentPhase={progress.currentPhase}
 *   onRetryTask={(taskId) => retryTask(taskId)}
 * />
 * ```
 */
export function ProgressTimeline({
  tasks,
  currentPhase,
  onRetryTask,
  className,
}: ProgressTimelineProps) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        No tasks yet...
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Phase indicator */}
      {currentPhase && (
        <div className="mb-6 rounded-lg border bg-card p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current Phase
          </div>
          <div className="mt-1 text-lg font-semibold capitalize">{currentPhase}</div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative space-y-6">
        {/* Vertical line */}
        <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

        {/* Tasks */}
        {tasks.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            isLast={index === tasks.length - 1}
            onRetry={onRetryTask}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual task card in timeline
 */
function TaskCard({
  task,
  isLast,
  onRetry,
}: {
  task: TaskProgressInfo;
  isLast: boolean;
  onRetry?: (taskId: string) => void;
}) {
  const statusConfig = getStatusConfig(task.status);

  return (
    <div className="relative pl-12">
      {/* Status icon */}
      <div
        className={cn(
          'absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border-2',
          statusConfig.bgColor,
          statusConfig.borderColor
        )}
      >
        {statusConfig.icon}
      </div>

      {/* Card content */}
      <div
        className={cn(
          'rounded-lg border bg-card p-4 shadow-sm transition-all',
          task.status === 'in_progress' && 'ring-2 ring-primary/20',
          task.status === 'failed' && 'border-destructive/50 bg-destructive/5'
        )}
      >
        {/* Task header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="font-medium">{task.task_name}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{task.agent_role}</span>
              <span>•</span>
              <span className={cn('font-medium', statusConfig.textColor)}>
                {task.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Retry button for failed tasks */}
          {task.status === 'failed' && onRetry && (
            <button
              onClick={() => onRetry(task.id)}
              className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              Retry
            </button>
          )}
        </div>

        {/* Timestamps and duration */}
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {task.started_at && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>Started: {formatTimestamp(task.started_at)}</span>
            </div>
          )}

          {task.completed_at && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              <span>Completed: {formatTimestamp(task.completed_at)}</span>
            </div>
          )}

          {task.duration_seconds !== null && task.duration_seconds > 0 && (
            <div className="flex items-center gap-1.5 font-medium">
              <span>Duration: {formatDuration(task.duration_seconds)}</span>
            </div>
          )}

          {task.status === 'in_progress' && (
            <div className="flex items-center gap-1.5 text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>
                Estimated: {formatDuration(task.estimated_duration_seconds)}
              </span>
            </div>
          )}

          {task.status === 'pending' && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" />
              <span>Waiting for dependencies...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Get status configuration (icon, colors)
 */
function getStatusConfig(status: string) {
  switch (status) {
    case 'completed':
      return {
        icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-600',
      };
    case 'in_progress':
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
        bgColor: 'bg-primary/5',
        borderColor: 'border-primary',
        textColor: 'text-primary',
      };
    case 'failed':
      return {
        icon: <XCircle className="h-4 w-4 text-destructive" />,
        bgColor: 'bg-destructive/5',
        borderColor: 'border-destructive',
        textColor: 'text-destructive',
      };
    case 'pending':
    default:
      return {
        icon: <Circle className="h-4 w-4 text-muted-foreground" />,
        bgColor: 'bg-muted/30',
        borderColor: 'border-muted',
        textColor: 'text-muted-foreground',
      };
  }
}

/**
 * Format ISO timestamp to readable time
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

export default ProgressTimeline;
