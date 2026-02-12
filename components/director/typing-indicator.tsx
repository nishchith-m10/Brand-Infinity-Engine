'use client';

/**
 * Typing Indicator Component
 * 
 * Animated indicator shown while the Creative Director is "thinking".
 * Uses existing design tokens (lamaPurple, animate-bounce).
 */

import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  /** Additional CSS classes */
  className?: string;
  /** Custom message (default: "Creative Director is thinking...") */
  message?: string;
  /** Variant: 'default' shows in message bubble style, 'inline' is minimal */
  variant?: 'default' | 'inline';
}

export function TypingIndicator({ 
  className, 
  message = "Creative Director is thinking...",
  variant = 'default',
}: TypingIndicatorProps) {
  const dots = (
    <div className="flex gap-1" role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 bg-lamaPurple rounded-full animate-bounce"
          style={{ 
            animationDelay: `${i * 150}ms`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {dots}
        <span className="text-xs text-slate-400">{message}</span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        "bg-white rounded-lg shadow-sm border border-slate-200/80",
        "max-w-fit",
        className
      )}
    >
      {dots}
      <span className="text-sm text-slate-500 font-medium">{message}</span>
    </div>
  );
}

/**
 * Compact typing indicator for use within message list
 */
export function TypingIndicatorCompact({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "flex items-center gap-2 px-3 py-2",
        "bg-lamaPurpleLight/30 rounded-lg",
        "max-w-fit",
        className
      )}
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-lamaPurple/70 rounded-full animate-bounce"
            style={{ 
              animationDelay: `${i * 150}ms`,
              animationDuration: '0.6s',
            }}
          />
        ))}
      </div>
    </div>
  );
}
