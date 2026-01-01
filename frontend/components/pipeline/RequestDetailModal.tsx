'use client';

/**
 * Request Detail Modal
 * 
 * Full request details with:
 * - Agent execution timeline
 * - Task status and outputs
 * - Event log/activity feed
 * - Retry/cancel actions
 */

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ContentRequest, RequestTask, RequestEvent } from '@/lib/orchestrator/types';

interface RequestDetailModalProps {
  request: ContentRequest;
  onClose: () => void;
  onUpdate: () => void;
}

export default function RequestDetailModal({
  request,
  onClose,
  onUpdate,
}: RequestDetailModalProps) {
  const [tasks, setTasks] = useState<RequestTask[]>([]);
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDetails = async () => {
    const supabase = createClient();

    // Load tasks
    const { data: tasksData } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', request.id)
      .order('created_at', { ascending: true });

    if (tasksData) setTasks(tasksData);

    // Load events
    const { data: eventsData } = await supabase
      .from('request_events')
      .select('*')
      .eq('request_id', request.id)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (eventsData) setEvents(eventsData);

    setLoading(false);
  };

  useEffect(() => {
    loadDetails();
  }, [request.id]);

  async function handleRetry() {
    if (!confirm('Retry this request from the current stage?')) return;

    // Call retry API
    const response = await fetch(`/api/v1/requests/${request.id}/retry`, {
      method: 'POST',
    });

    if (response.ok) {
      onUpdate();
      onClose();
    } else {
      alert('Retry failed. Check logs for details.');
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel this request? This cannot be undone.')) return;

    const supabase = createClient();
    
    await supabase
      .from('content_requests')
      .update({ status: 'cancelled' })
      .eq('id', request.id);

    onUpdate();
    onClose();
  }

  const getStatusIcon = (status: string) => {
    if (status === 'completed') {
      return (
        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      );
    }
    if (status === 'failed') {
      return (
        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      );
    }
    if (status === 'in_progress' || status === 'dispatched') {
      return (
        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
        </div>
      );
    }
    return (
      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
        <div className="w-2 h-2 bg-gray-400 rounded-full" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Request Details</h2>
            <p className="text-sm text-gray-500 mt-1">ID: {request.id.slice(0, 8)}...</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : (
            <>
              {/* Request Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Type:</span>{' '}
                    <span className="font-medium">{request.request_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>{' '}
                    <span className="font-medium capitalize">{request.status}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>{' '}
                    <span className="font-medium">
                      {new Date(request.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Agent Timeline */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">
                  Agent Timeline
                </h3>
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`p-4 rounded-lg border ${
                        task.status === 'completed'
                          ? 'bg-green-50 border-green-200'
                          : task.status === 'failed'
                          ? 'bg-red-50 border-red-200'
                          : task.status === 'in_progress'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {getStatusIcon(task.status)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm text-gray-900">
                              {task.agent_role.charAt(0).toUpperCase() + task.agent_role.slice(1)}
                            </h4>
                            <span className="text-xs text-gray-500 capitalize">
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{task.task_name}</p>
                          {task.error_message && (
                            <p className="text-xs text-red-600 mt-2 font-medium">
                              Error: {task.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event Log */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">
                  Activity Log
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {events.map(event => (
                    <div
                      key={event.id}
                      className="text-xs py-2 px-3 bg-gray-50 rounded border border-gray-100"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">{event.event_type}</span>
                        <span className="text-gray-500">
                          {new Date(event.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-gray-600 mt-1">{event.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
            disabled={['published', 'cancelled'].includes(request.status)}
          >
            Cancel Request
          </button>
          <button
            onClick={handleRetry}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!['failed', 'cancelled'].includes(request.status)}
          >
            Retry
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
