'use client';

/**
 * Plan Preview Component
 * Slice 8: Frontend Chat UI
 */

import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import type { TaskPlan, SubTask } from '@/lib/agents/types';

interface PlanPreviewProps {
  plan: TaskPlan;
  onApprove?: () => void;
  onReject?: () => void;
}

export function PlanPreview({ plan, onApprove, onReject }: PlanPreviewProps) {
  const getStatusIcon = (status: SubTask['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-300" />;
    }
  };

  const getStatusColor = (status: TaskPlan['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const completedTasks = plan.tasks.filter(t => t.status === 'completed').length;
  const progress = Math.round((completedTasks / plan.tasks.length) * 100);

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="px-6 py-4 bg-gray-50 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">Content Creation Plan</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(plan.status)}`}>
            {plan.status}
          </span>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{completedTasks} / {plan.tasks.length} tasks completed</span>
          <span>•</span>
          <span className="capitalize">{plan.complexity} complexity</span>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tasks */}
      <div className="divide-y">
        {plan.tasks.map((task, index) => (
          <div key={task.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-3">
              {getStatusIcon(task.status)}
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{task.description}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                    {task.agent}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="capitalize">{task.type}</span>
                  <span>•</span>
                  <span>Priority: {task.priority}</span>
                  {task.estimated_duration && (
                    <>
                      <span>•</span>
                      <span>~{task.estimated_duration} min</span>
                    </>
                  )}
                </div>

                {task.dependencies && task.dependencies.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    Depends on: {task.dependencies.join(', ')}
                  </div>
                )}

                {task.status === 'completed' && task.result && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                    ✓ Completed successfully
                  </div>
                )}

                {task.status === 'failed' && task.error && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-900">
                    ✗ {task.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions (only show if pending) */}
      {plan.status === 'pending' && onApprove && onReject && (
        <div className="px-6 py-4 bg-gray-50 border-t flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            Modify Plan
          </button>
          <button
            onClick={onApprove}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Approve & Start
          </button>
        </div>
      )}
    </div>
  );
}

