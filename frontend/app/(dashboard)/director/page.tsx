'use client';

/**
 * Creative Director Page
 * Slice 8: Frontend Chat UI
 * 
 * Responsive chat interface that adapts to sidebar collapse state
 */

import { useState, useEffect } from 'react';
import { ChatInterfaceResponsive } from '@/components/director/chat-interface-responsive';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function CreativeDirectorPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>();
  const [brandId, setBrandId] = useState<string>();
  const [loading, setLoading] = useState(true);

  // Fetch real brand_id from API
  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetch('/api/v1/brands');
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
          // Use first available brand
          setBrandId(data.data[0].id);
        } else {
          console.error('[CreativeDirector] No brands found for user');
        }
      } catch (error) {
        console.error('[CreativeDirector] Failed to fetch brands:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchBrands();
  }, []);

  const handleSessionCreate = (newSessionId: string) => {
    setSessionId(newSessionId);
    // Optionally update URL with session ID
    router.push(`/director?session=${newSessionId}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-lamaPurple" />
      </div>
    );
  }

  if (!brandId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Brand Found</h2>
        <p className="text-slate-600 mb-6 max-w-md">
          You need to create a brand before using the Creative Director.
        </p>
        <button 
          onClick={() => router.push('/onboarding')}
          className="px-6 py-2 bg-lamaPurple text-white rounded-lg hover:bg-opacity-90 transition-all font-semibold"
        >
          Go to Onboarding
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <ChatInterfaceResponsive
        brandId={brandId}
        sessionId={sessionId}
        onSessionCreate={handleSessionCreate}
      />
    </div>
  );
}
