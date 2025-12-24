'use client';

import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Video,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { type Brief, type Script, type Video as VideoType } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';

// Mock data for demonstration
const mockBriefs: (Brief & { campaign_name: string })[] = [
  {
    brief_id: 'brief_001',
    campaign_id: 'camp_001',
    campaign_name: 'Summer Product Launch',
    brand_id: 'brand_001',
    product_category: 'Electronics',
    target_demographic: 'Gen Z',
    campaign_objective: 'awareness',
    budget_tier: 'medium',
    creative_concept: 'Showcase the product in everyday situations with vibrant, energetic visuals that resonate with young audiences.',
    key_messages: [
      'Innovation at your fingertips',
      'Built for the next generation',
      'Style meets functionality',
    ],
    visual_style: 'Modern, colorful, dynamic transitions',
    brand_alignment_score: 0.92,
    approval_status: 'pending',
    created_at: new Date().toISOString(),
  },
];

const mockScripts: (Script & { campaign_name: string })[] = [
  {
    script_id: 'script_001',
    brief_id: 'brief_001',
    campaign_name: 'Summer Product Launch',
    full_script: `[Scene 1 - 0-5s]
Visual: Close-up of product revealing with dramatic lighting
Audio: Upbeat electronic music begins
Voiceover: "What if the future was in your hands?"

[Scene 2 - 5-15s]
Visual: Product being used in various lifestyle scenarios
Audio: Music builds
Voiceover: "Introducing the next generation of innovation..."

[Scene 3 - 15-30s]
Visual: Features showcase with kinetic typography
Audio: Music peaks
Voiceover: "Style. Power. Possibility. All in one."`,
    hook_variations_count: 50,
    scene_segments: [
      {
        scene_number: 1,
        visual_direction: 'Close-up product reveal',
        dialogue: 'What if the future was in your hands?',
        duration_seconds: 5,
        camera_movement: 'Slow zoom out',
      },
      {
        scene_number: 2,
        visual_direction: 'Lifestyle montage',
        dialogue: 'Introducing the next generation...',
        duration_seconds: 10,
        camera_movement: 'Dynamic cuts',
      },
      {
        scene_number: 3,
        visual_direction: 'Feature showcase',
        dialogue: 'Style. Power. Possibility.',
        duration_seconds: 15,
        camera_movement: 'Kinetic text overlay',
      },
    ],
    brand_compliance_score: 0.95,
    created_at: new Date().toISOString(),
  },
];

const mockVideos: (VideoType & { campaign_name: string })[] = [
  {
    video_id: 'video_001',
    script_id: 'script_001',
    campaign_name: 'Summer Product Launch',
    status: 'completed',
    model_used: 'veo3',
    scenes_count: 3,
    total_duration_seconds: 30,
    total_cost_usd: 15,
    quality_score: 0.99,
    output_url: '/videos/video_001.mp4',
    created_at: new Date().toISOString(),
  },
];

interface ReviewItem {
  id: string;
  type: 'brief' | 'script' | 'video';
  name: string;
  campaign: string;
  status: string;
  score: number;
  created_at: string;
  data: Brief | Script | VideoType;
}

export default function ContentReviewPage() {
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeTab, setActiveTab] = useState('briefs');

  // Combine all items for review
  const reviewItems: ReviewItem[] = [
    ...mockBriefs.map((brief) => ({
      id: brief.brief_id,
      type: 'brief' as const,
      name: 'Creative Brief',
      campaign: brief.campaign_name,
      status: brief.approval_status,
      score: brief.brand_alignment_score,
      created_at: brief.created_at,
      data: brief,
    })),
    ...mockScripts.map((script) => ({
      id: script.script_id,
      type: 'script' as const,
      name: 'Video Script',
      campaign: script.campaign_name,
      status: 'pending',
      score: script.brand_compliance_score,
      created_at: script.created_at,
      data: script,
    })),
    ...mockVideos.map((video) => ({
      id: video.video_id,
      type: 'video' as const,
      name: 'Generated Video',
      campaign: video.campaign_name,
      status: video.status,
      score: video.quality_score,
      created_at: video.created_at,
      data: video,
    })),
  ];

  const pendingCount = reviewItems.filter((item) => 
    item.status === 'pending' || item.status === 'generating'
  ).length;

  const handleApprove = (item: ReviewItem) => {
    // In production, call the API
    console.log('Approving:', item);
    setShowReviewModal(false);
    setSelectedItem(null);
  };

  const handleReject = (item: ReviewItem) => {
    if (!rejectionReason) return;
    // In production, call the API
    console.log('Rejecting:', item, 'Reason:', rejectionReason);
    setShowReviewModal(false);
    setSelectedItem(null);
    setRejectionReason('');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'brief':
        return <FileText className="h-5 w-5" />;
      case 'script':
        return <Zap className="h-5 w-5" />;
      case 'video':
        return <Video className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
      case 'generating':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const filteredItems = reviewItems.filter((item) => {
    if (activeTab === 'briefs') return item.type === 'brief';
    if (activeTab === 'scripts') return item.type === 'script';
    if (activeTab === 'videos') return item.type === 'video';
    return true;
  });

  const getBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'published':
      case 'completed':
      case 'approved':
      case 'active':
        return 'success';
      case 'scheduled':
      case 'processing':
      case 'generating':
      case 'pending':
        return 'processing';
      case 'failed':
      case 'rejected':
        return 'destructive';
      case 'draft':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <div className="bg-white p-4 rounded-3xl m-4 flex-1 shadow-sm border border-slate-100/50">
      {/* Header */}
      <div className="mb-8">
        <h1 className="hidden md:block text-2xl font-bold text-slate-800">Content Review</h1>
        <p className="mt-2 text-sm text-slate-500">
          Review and approve AI-generated content before publishing
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-lamaYellowLight p-2">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{pendingCount}</p>
                <p className="text-sm text-slate-500">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {reviewItems.filter((i) => i.status === 'approved' || i.status === 'completed').length}
                </p>
                <p className="text-sm text-slate-500">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {reviewItems.filter((i) => i.status === 'rejected' || i.status === 'failed').length}
                </p>
                <p className="text-sm text-slate-500">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-lamaSkyLight p-2">
                <AlertTriangle className="h-5 w-5 text-lamaSky" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {(reviewItems.reduce((acc, i) => acc + i.score, 0) / reviewItems.length * 100).toFixed(0)}%
                </p>
                <p className="text-sm text-gray-500">Avg Quality</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'briefs', label: 'Briefs', count: reviewItems.filter((i) => i.type === 'brief').length },
            { id: 'scripts', label: 'Scripts', count: reviewItems.filter((i) => i.type === 'script').length },
            { id: 'videos', label: 'Videos', count: reviewItems.filter((i) => i.type === 'video').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-lamaPurple text-lamaPurple'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Review List */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="h-8 w-8" />}
          title="No items to review"
          description="All content has been reviewed. Check back later for new items."
        />
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <Card key={item.id} onClick={() => {
              setSelectedItem(item);
              setShowReviewModal(true);
            }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-gray-100 p-2">
                      {getIcon(item.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{item.name}</h3>
                        <Badge variant={getBadgeVariant(item.status)}>
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {item.campaign} • {formatDate(item.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {(item.score * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.type === 'brief' ? 'Brand Alignment' : item.type === 'script' ? 'Compliance' : 'Quality'}
                      </p>
                    </div>
                    {getStatusIcon(item.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setSelectedItem(null);
          setRejectionReason('');
        }}
        title={`Review ${selectedItem?.name}`}
        size="xl"
      >
        {selectedItem && (
          <div className="space-y-6">
            {/* Item Details */}
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <div>
                <p className="text-sm text-gray-500">Campaign</p>
                <p className="font-medium text-gray-900">{selectedItem.campaign}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  {selectedItem.type === 'brief' ? 'Brand Alignment' : selectedItem.type === 'script' ? 'Compliance Score' : 'Quality Score'}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {(selectedItem.score * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Content Preview */}
            <div className="rounded-lg border border-gray-200 p-4">
              <h4 className="mb-3 font-medium text-gray-900">Content Preview</h4>
              
              {selectedItem.type === 'brief' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Creative Concept</p>
                    <p className="mt-1 text-gray-900">
                      {(selectedItem.data as Brief).creative_concept}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Key Messages</p>
                    <ul className="mt-1 list-inside list-disc text-gray-900">
                      {(selectedItem.data as Brief).key_messages?.map((msg, i) => (
                        <li key={i}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Visual Style</p>
                    <p className="mt-1 text-gray-900">
                      {(selectedItem.data as Brief).visual_style}
                    </p>
                  </div>
                </div>
              )}

              {selectedItem.type === 'script' && (
                <div className="max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-900">
                    {(selectedItem.data as Script).full_script}
                  </pre>
                </div>
              )}

              {selectedItem.type === 'video' && (
                <div className="space-y-3">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-gray-50 p-3 text-center">
                      <p className="text-lg font-bold">{(selectedItem.data as VideoType).scenes_count}</p>
                      <p className="text-xs text-gray-500">Scenes</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3 text-center">
                      <p className="text-lg font-bold">{(selectedItem.data as VideoType).total_duration_seconds}s</p>
                      <p className="text-xs text-gray-500">Duration</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3 text-center">
                      <p className="text-lg font-bold">${(selectedItem.data as VideoType).total_cost_usd}</p>
                      <p className="text-xs text-gray-500">Cost</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-black p-8 text-center">
                    <Video className="mx-auto h-12 w-12 text-gray-500" />
                    <p className="mt-2 text-sm text-gray-400">Video preview placeholder</p>
                  </div>
                </div>
              )}
            </div>

            {/* Rejection Reason */}
            {selectedItem.status === 'pending' && (
              <Textarea
                label="Rejection Reason (optional)"
                placeholder="Provide feedback if rejecting..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedItem(null);
                }}
              >
                Close
              </Button>
              {selectedItem.status === 'pending' && (
                <>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(selectedItem)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  <Button
                    onClick={() => handleApprove(selectedItem)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
