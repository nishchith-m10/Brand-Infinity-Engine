'use client';

import { cn, getStatusColor, getPlatformColor } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'status' | 'platform';
  status?: string;
  platform?: string;
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  status,
  platform,
  className,
}: BadgeProps) {
  let colorClass = 'bg-gray-100 text-gray-800';

  if (variant === 'primary') {
    colorClass = 'bg-blue-600 text-white';
  } else if (variant === 'secondary') {
    colorClass = 'bg-gray-200 text-gray-700';
  } else if (variant === 'status' && status) {
    colorClass = getStatusColor(status);
  } else if (variant === 'platform' && platform) {
    colorClass = getPlatformColor(platform);
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorClass,
        className
      )}
    >
      {children}
    </span>
  );
}
