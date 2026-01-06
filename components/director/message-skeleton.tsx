'use client';

/**
 * Message Skeleton Component
 * 
 * Skeleton loading state that matches the shape of actual messages.
 * Provides visual continuity while content loads.
 */

import { cn } from '@/lib/utils';

interface MessageSkeletonProps {
  /** Additional CSS classes */
  className?: string;
  /** Role to simulate (affects alignment and avatar) */
  role?: 'user' | 'assistant';
  /** Number of text lines to show */
  lines?: number;
}

export function MessageSkeleton({ 
  className, 
  role = 'assistant',
  lines = 2,
}: MessageSkeletonProps) {
  const isUser = role === 'user';
  
  return (
    <div 
      className={cn(
        "flex gap-4 px-4 py-4 animate-pulse",
        isUser && "flex-row-reverse",
        className
      )}
    >
      {/* Avatar skeleton */}
      <div 
        className={cn(
          "w-8 h-8 rounded-full shrink-0",
          isUser ? "bg-lamaPurple/30" : "bg-slate-200"
        )}
      />
      
      {/* Content skeleton */}
      <div 
        className={cn(
          "flex-1 space-y-2",
          isUser && "flex flex-col items-end"
        )}
      >
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 rounded",
              isUser ? "bg-lamaPurple/20" : "bg-slate-200",
              // Vary widths for natural look
              i === 0 && "w-3/4",
              i === 1 && "w-1/2",
              i === 2 && "w-2/3",
              i > 2 && "w-1/3",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Multiple message skeletons for loading state
 */
export function MessageSkeletonList({ 
  count = 3,
  className,
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <MessageSkeleton 
          key={i} 
          role={i % 2 === 0 ? 'assistant' : 'user'}
          lines={i === 0 ? 3 : 2}
        />
      ))}
    </div>
  );
}

/**
 * Compact skeleton for inline loading indicators
 */
export function MessageSkeletonCompact({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 animate-pulse", className)}>
      <div className="w-6 h-6 bg-slate-200 rounded-full shrink-0" />
      <div className="space-y-1.5 flex-1">
        <div className="h-3 bg-slate-200 rounded w-2/3" />
        <div className="h-3 bg-slate-200 rounded w-1/3" />
      </div>
    </div>
  );
}

/**
 * Full chat loading skeleton (for initial page load)
 */
export function ChatLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header skeleton */}
      <div className="px-4 py-4 border-b border-slate-200 animate-pulse">
        <div className="h-5 bg-slate-200 rounded w-1/3" />
      </div>
      
      {/* Messages area skeleton */}
      <div className="flex-1 p-4 space-y-4 overflow-hidden">
        <MessageSkeletonList count={4} />
      </div>
      
      {/* Input skeleton */}
      <div className="px-4 py-4 border-t border-slate-200 animate-pulse">
        <div className="h-10 bg-slate-100 rounded-lg" />
      </div>
    </div>
  );
}
