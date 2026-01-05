'use client';

/**
 * Request Card Component
 * 
 * Individual request card displayed in pipeline columns.
 * Shows key request info and status at a glance.
 */

import type { ContentRequest } from '@/lib/orchestrator/types';

interface RequestCardProps {
  request: ContentRequest;
  onClick: () => void;
}

export default function RequestCard({ request, onClick }: RequestCardProps) {
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      social_media_post: 'Social Post',
      blog_post: 'Blog',
      email_campaign: 'Email',
      video_script: 'Video',
      product_description: 'Product',
    };
    return labels[type] || type;
  };

  const getTimeAgo = (timestamp: string) => {
    const seconds = Math.floor(
      (new Date().getTime() - new Date(timestamp).getTime()) / 1000
    );

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300"
    >
      {/* Type Tag */}
      <div className="inline-block px-2 py-1 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded mb-3">
        {getTypeLabel(request.request_type)}
      </div>

      {/* Title/Description */}
      <h3 className="text-sm font-semibold text-gray-900 mb-4 line-clamp-2">
        {request.title || request.prompt || 'Untitled Request'}
      </h3>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{getTimeAgo(request.created_at)}</span>
        </div>

        {/* User Avatar */}
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600" />
      </div>
    </div>
  );
}
