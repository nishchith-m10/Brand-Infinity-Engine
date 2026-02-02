'use client';

/**
 * Pipeline Board Component
 * 
 * Kanban-style view showing content requests moving through production stages:
 * Intake → Draft → Production → QA → Published
 * 
 * Features:
 * - Real-time status updates
 * - Request card interactions
 * - Column filtering and counts
 * - Drag-and-drop (future enhancement)
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import RequestCard from './RequestCard';
import RequestDetailModal from './RequestDetailModal';
import type { ContentRequest } from '@/lib/orchestrator/types';
import { Tooltip } from '@/components/ui/tooltip';

type PipelineStatus = 'intake' | 'draft' | 'production' | 'qa' | 'approval' | 'published';

interface ColumnData {
  id: PipelineStatus;
  title: string;
  color: string;
  requests: ContentRequest[];
}

export default function PipelineBoard() {
  const [columns, setColumns] = useState<ColumnData[]>([
    { id: 'intake', title: 'Intake', color: 'hsl(var(--primary))', requests: [] },
    { id: 'draft', title: 'Draft', color: 'hsl(var(--blue))', requests: [] },
    { id: 'production', title: 'Production', color: 'hsl(var(--orange))', requests: [] },
    { id: 'qa', title: 'QA', color: 'hsl(var(--lama-purple))', requests: [] },
    { id: 'approval', title: 'Approval', color: 'hsl(var(--teal))', requests: [] },
    { id: 'published', title: 'Published', color: 'hsl(var(--success))', requests: [] },
  ]);

  const [selectedRequest, setSelectedRequest] = useState<ContentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  const loadRequests = useCallback(async () => {
    const supabase = createClient();
    
    let query = supabase
      .from('content_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter === 'mine') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        query = query.eq('user_id', user.id);
      }
    }

    const { data } = await query;
    const requests = data as ContentRequest[] | null;

    if (requests) {
      setColumns(prev => prev.map(col => ({
        ...col,
        requests: requests.filter(r => r.status === col.id),
      })));
    }

    setLoading(false);
  }, [filter]);

  useEffect(() => {
    const fetchData = async () => {
      await loadRequests();
    };
    fetchData();

    // Subscribe to real-time updates
    const supabase = createClient();
    const channel = supabase
      .channel('pipeline-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_requests',
        },
        () => {
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRequests]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <main className="flex flex-col h-full bg-gray-50 p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
        
        <div className="flex items-center gap-3">
          <Tooltip content="Show all content requests" position="bottom">
            <button
              onClick={() => setFilter('all')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFilter('all');
                }
              }}
              aria-pressed={filter === 'all'}
              aria-label="Show all content requests"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all transform focus:outline-none focus:ring-2 focus:ring-primary ${
                filter === 'all'
                  ? 'bg-lamaPurple text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
              style={{
                boxShadow: filter === 'all' ? '0 8px 18px hsl(var(--primary) / 0.12)' : '0 1px 2px hsl(var(--border) / 0.5)',
                willChange: 'transform'
              }}
            >
              All Requests
            </button>
          </Tooltip>
          <Tooltip content="Show only your requests" position="bottom">
            <button
              onClick={() => setFilter('mine')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFilter('mine');
                }
              }}
              aria-pressed={filter === 'mine'}
              aria-label="Show only your requests"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all transform focus:outline-none focus:ring-2 focus:ring-primary ${
                filter === 'mine'
                  ? 'bg-lamaPurple text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
              style={{
                boxShadow: filter === 'mine' ? '0 8px 18px hsl(var(--primary) / 0.12)' : '0 1px 2px hsl(var(--border) / 0.5)',
                willChange: 'transform'
              }}
            >
              My Requests
            </button>
          </Tooltip>
        </div>
      </header>

      {/* Board - Two Row Grid */}
      <section className="grid grid-cols-3 gap-4 flex-1 overflow-hidden" aria-label="Content pipeline stages">
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex flex-col bg-white rounded-2xl border border-gray-200 p-4 shadow-sm overflow-hidden"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {column.title}
                </span>
              </div>
              <div
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                  column.requests.length > 0
                    ? 'bg-lamaPurpleLight text-lamaPurple'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {column.requests.length}
              </div>
            </div>

            {/* Cards - Scrollable */}
            <div className="flex flex-col gap-2.5 overflow-y-auto flex-1 min-h-0">
              {column.requests.length === 0 ? (
                <div className="h-32 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center bg-gray-50">
                  <span className="text-sm text-gray-400">No requests</span>
                </div>
              ) : (
                column.requests.map(request => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onClick={() => setSelectedRequest(request)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Detail Modal */}
      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onUpdate={() => loadRequests()}
        />
      )}
    </main>
  );
}
