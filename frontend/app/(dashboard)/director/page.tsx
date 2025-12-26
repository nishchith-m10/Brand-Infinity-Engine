'use client';

/**
 * Creative Director Page
 * Slice 8: Frontend Chat UI
 * 
 * Responsive chat interface that adapts to sidebar collapse state
 */

import { useState } from 'react';
import { ChatInterfaceResponsive } from '@/components/director/chat-interface-responsive';
import { useRouter } from 'next/navigation';

export default function CreativeDirectorPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>();

  // Get brand_id from URL params or use first available brand
  // For now, hardcoded - in production, get from user's brands
  const brandId = 'placeholder-brand-id';

  const handleSessionCreate = (newSessionId: string) => {
    setSessionId(newSessionId);
    // Optionally update URL with session ID
    router.push(`/director?session=${newSessionId}`, { scroll: false });
  };

  return (
    <div className="w-full h-full flex flex-col px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <ChatInterfaceResponsive
        brandId={brandId}
        sessionId={sessionId}
        onSessionCreate={handleSessionCreate}
      />
    </div>
  );
}
