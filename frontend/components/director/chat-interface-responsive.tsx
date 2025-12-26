'use client';

import { ChatInterface } from './chat-interface';
import { useSidebar } from '@/lib/context/sidebar-context';
import { useMemo } from 'react';

interface ChatInterfaceResponsiveProps {
  brandId: string;
  sessionId?: string;
  onSessionCreate?: (sessionId: string) => void;
}

/**
 * Responsive wrapper for ChatInterface that adapts to sidebar width changes
 * Manages responsive layout constraints based on available space
 */
export function ChatInterfaceResponsive({
  brandId,
  sessionId,
  onSessionCreate,
}: ChatInterfaceResponsiveProps) {
  const { sidebarWidth, isCollapsed } = useSidebar();

  // Calculate responsive max-width based on viewport and sidebar
  const responsiveMaxWidth = useMemo(() => {
    // On small screens, use full width with minimal padding
    // On larger screens, constrain to max-width for better readability
    return 'w-full';
  }, []);

  // Calculate responsive grid columns based on sidebar state and viewport
  const responsiveGridClass = useMemo(() => {
    // Grid is handled within ChatInterface with responsive Tailwind classes
    return '';
  }, [isCollapsed]);

  return (
    <div className={`${responsiveMaxWidth} h-full flex flex-col`}>
      <ChatInterface
        brandId={brandId}
        sessionId={sessionId}
        onSessionCreate={onSessionCreate}
      />
    </div>
  );
}

