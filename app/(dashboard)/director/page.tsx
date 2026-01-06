'use client';

/**
 * Pipeline Dashboard Page
 * 
 * Main production pipeline interface:
 * - Request form (left sidebar with context selectors)
 * - Pipeline board (Kanban: Intake → Draft → Production → QA → Published)
 * - Real-time updates and request detail modal
 */

import { useState, Suspense } from 'react';
import RequestForm from '@/components/pipeline/RequestForm';
import PipelineBoard from '@/components/pipeline/PipelineBoard';
import { DashboardSkeleton } from '@/components/ui/skeleton';

function DirectorContent() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRequestCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-50 -m-4">
      <RequestForm onSubmit={handleRequestCreated} />
      <div className="flex-1 overflow-hidden">
        <PipelineBoard key={refreshKey} />
      </div>
    </div>
  );
}

export default function DirectorPage() {
  return (
    <Suspense fallback={<div className="p-6"><DashboardSkeleton /></div>}>
      <DirectorContent />
    </Suspense>
  );
}
