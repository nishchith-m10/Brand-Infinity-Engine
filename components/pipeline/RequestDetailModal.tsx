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
import { Tooltip } from '@/components/ui/tooltip';

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
  const [currentRequest, setCurrentRequest] = useState<ContentRequest>(request);
  const [tasks, setTasks] = useState<RequestTask[]>([]);
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const loadDetails = async () => {
    const supabase = createClient();

    // Reload the request to get latest status
    const { data: requestData } = await supabase
      .from('content_requests')
      .select('*')
      .eq('id', request.id)
      .single();

    if (requestData) setCurrentRequest(requestData);

    // Load tasks (ordered by sequence_order for correct timeline display)
    const { data: tasksData } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', request.id)
      .order('sequence_order', { ascending: true });

    if (tasksData) {
      setTasks(tasksData);
      
      // Extract image URL from producer task output
      const producerTask = tasksData.find(
        (t: RequestTask) => t.agent_role === 'producer' && t.status === 'completed'
      );
      if (producerTask?.output_data) {
        const output = producerTask.output_data as Record<string, unknown>;
        if (output.url) {
          setImageUrl(output.url as string);
        } else if (output.output_url) {
          setImageUrl(output.output_url as string);
        }
      }
    }

    // Load events
    const { data: eventsData } = await supabase
      .from('request_events')
      .select('*')
      .eq('request_id', request.id)
      .order('created_at', { ascending: false })
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
          <Tooltip content="Close modal" position="left">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Tooltip>
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
                    <span className="font-medium">{currentRequest.request_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>{' '}
                    <span className={`font-medium capitalize ${
                      (currentRequest.status as string) === 'published' ? 'text-green-600' :
                      (currentRequest.status as string) === 'failed' ? 'text-red-600' :
                      currentRequest.status === 'cancelled' ? 'text-gray-500' :
                      'text-blue-600'
                    }`}>{currentRequest.status}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>{' '}
                    <span className="font-medium">
                      {new Date(currentRequest.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Generated Image */}
              {imageUrl && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                    Generated Image
                  </h3>
                  <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                    <img 
                      src={imageUrl} 
                      alt="Generated content" 
                      className="w-full h-auto max-h-80 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden p-4 text-center text-sm text-gray-500">
                      <p>Image loading... (Pollinations may take a moment to generate)</p>
                      <a 
                        href={imageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline mt-2 inline-block"
                      >
                        Open image in new tab →
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Agent Timeline */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                    Agent Timeline
                  </h3>
                  <span className="text-xs text-gray-500">
                    {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                {/* Warning if tasks seem incomplete */}
                {request.request_type === 'image' && tasks.length < 4 && (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div className="flex-1 text-xs text-yellow-800">
                        <span className="font-medium">Incomplete task list:</span> Image requests should have 4 tasks (Executive, Strategist, Producer, QA).
                        {tasks.length === 3 && !tasks.find(t => t.agent_role === 'executive') && 
                          <span className="block mt-1">Missing: Executive (Intent Parsing) task</span>
                        }
                      </div>
                    </div>
                  </div>
                )}
                
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
                {events.length === 0 ? (
                  <div className="text-xs text-gray-500 py-4 text-center bg-gray-50 rounded border border-gray-100">
                    No activity recorded yet
                  </div>
                ) : (
                  events.map(event => (
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
                  ))
                )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <Tooltip content={['published', 'cancelled'].includes(currentRequest.status) ? "Cannot cancel completed requests" : "Cancel this request"} position="top">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
              disabled={['published', 'cancelled'].includes(currentRequest.status)}
            >
              Cancel Request
            </button>
          </Tooltip>
          <Tooltip content={!['failed', 'cancelled'].includes(currentRequest.status) ? "Only failed/cancelled requests can be retried" : "Retry request from current stage"} position="top">
            <button
              onClick={handleRetry}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!['failed', 'cancelled'].includes(currentRequest.status)}
            >
              Retry
            </button>
          </Tooltip>
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
