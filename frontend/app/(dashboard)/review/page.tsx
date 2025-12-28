'use client';

import { useState, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Video,
  Zap,
  RefreshCw,
  Edit3,
  Check,
  X,
  MessageSquare,
  SquareCheck,
  Square,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { type Brief, type Script, type Video as VideoType } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useV1Reviews } from '@/lib/hooks/use-api';
import { useToast } from '@/lib/hooks/use-toast';
import { ToastContainer } from '@/components/ui/toast-container';
import { useCampaignProgress } from '@/lib/hooks/use-campaign-progress';
import { LockedState } from '@/components/LockedState';

// Mock data for fallback when API returns empty
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
      { scene_number: 1, visual_direction: 'Close-up product reveal', dialogue: 'What if the future was in your hands?', duration_seconds: 5, camera_movement: 'Slow zoom out' },
      { scene_number: 2, visual_direction: 'Lifestyle montage', dialogue: 'Introducing the next generation...', duration_seconds: 10, camera_movement: 'Dynamic cuts' },
      { scene_number: 3, visual_direction: 'Feature showcase', dialogue: 'Style. Power. Possibility.', duration_seconds: 15, camera_movement: 'Kinetic text overlay' },
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
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();
  
  // Check prerequisites
  const { canAccessReview, steps, isLoading: progressLoading } = useCampaignProgress();

  // Fetch from API with fallback to mock data
  const { data: apiData, mutate } = useV1Reviews();
  
  // Show locked state if prerequisites not met
  if (!progressLoading && !canAccessReview) {
    return (
      <LockedState
        title="Content Review is Locked"
        description="Generate content first to unlock the review queue"
        steps={[
          { label: 'Create a campaign', completed: true },
          { label: 'Configure Brand Vault', completed: steps?.brandIdentity && steps?.brandAssets },
          { label: 'Generate content via Creative Director', completed: steps?.contentGenerated || false },
        ]}
        nextAction={{ label: 'Go to Creative Director', href: '/director' }}
        explanation="Use the Creative Director to generate briefs and scripts for review."
      />
    );
  }
  
  // Use API data only - no mock fallback
  const briefs = apiData?.briefs || [];
  const scripts = apiData?.scripts || [];
  const videos = apiData?.videos || [];

  // Combine all items for review
  const reviewItems: ReviewItem[] = [
    ...briefs.map((brief: Brief & { campaign_name?: string; campaigns?: { campaign_name: string } }) => ({
      id: brief.brief_id,
      type: 'brief' as const,
      name: 'Creative Brief',
      campaign: brief.campaign_name || brief.campaigns?.campaign_name || 'Unknown Campaign',
      status: brief.approval_status,
      score: brief.brand_alignment_score,
      created_at: brief.created_at,
      data: brief,
    })),
    ...scripts.map((script: Script & { campaign_name?: string }) => ({
      id: script.script_id,
      type: 'script' as const,
      name: 'Video Script',
      campaign: script.campaign_name || 'Unknown Campaign',
      status: 'pending',
      score: script.brand_compliance_score,
      created_at: script.created_at,
      data: script,
    })),
    ...videos.map((video: VideoType & { campaign_name?: string }) => ({
      id: video.video_id,
      type: 'video' as const,
      name: 'Generated Video',
      campaign: video.campaign_name || 'Unknown Campaign',
      status: video.status,
      score: video.quality_score,
      created_at: video.created_at,
      data: video,
    })),
  ];

  const pendingCount = reviewItems.filter((item) => 
    item.status === 'pending' || item.status === 'generating'
  ).length;

  const filteredItems = reviewItems.filter((item) => {
    if (activeTab === 'briefs') return item.type === 'brief';
    if (activeTab === 'scripts') return item.type === 'script';
    if (activeTab === 'videos') return item.type === 'video';
    return true;
  });

  // Batch selection
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.id)));
    }
  };

  // Batch actions
  const handleBatchApprove = async () => {
    setIsBatchApproving(true);
    try {
      for (const id of selectedItems) {
        const item = reviewItems.find(i => i.id === id);
        if (item) await handleApprove(item, true);
      }
      setSelectedItems(new Set());
      showToast({ type: 'success', message: `Approved ${selectedItems.size} items` });
    } finally {
      setIsBatchApproving(false);
    }
  };

  const handleBatchReject = async () => {
    showToast({ type: 'info', message: 'Please reject items individually to provide feedback' });
  };

  // Regenerate action
  const handleRegenerate = async (item: ReviewItem) => {
    setIsRegenerating(item.id);
    try {
      const endpoint = `/api/v1/reviews/${item.id}`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'regenerate',
          feedback: rejectionReason || 'Regenerate with improved quality'
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to regenerate');
      }
      
      showToast({ type: 'success', message: 'Regeneration triggered!' });
      mutate();
    } catch (error) {
      showToast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to regenerate'
      });
    } finally {
      setIsRegenerating(null);
    }
  };

  // Inline edit
  const startEdit = (id: string, field: string, currentValue: string) => {
    setEditingField({ id, field });
    setEditValue(currentValue);
  };

  const saveEdit = async () => {
    if (!editingField) return;
    setIsSavingEdit(true);
    try {
      const endpoint = `/api/v1/reviews/${editingField.id}`;
      await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'edit',
          field: editingField.field,
          new_value: editValue
        }),
      });
      showToast({ type: 'success', message: 'Updated!' });
      mutate();
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to update' });
    } finally {
      setIsSavingEdit(false);
      setEditingField(null);
      setEditValue('');
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleApprove = async (item: ReviewItem, silent = false) => {
    if (!silent) setIsApproving(true);
    try {
      const endpoint = item.type === 'brief' 
        ? `/api/v1/briefs/${item.id}/approve`
        : item.type === 'script'
        ? `/api/v1/scripts/${item.id}/approve`
        : `/api/v1/videos/${item.id}/approve`;
      
      const response = await fetch(endpoint, { method: 'POST' });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to approve');
      }
      
      if (!silent) {
        showToast({ type: 'success', message: 'Approved!' });
        setShowReviewModal(false);
        setSelectedItem(null);
      }
      mutate();
    } catch (error) {
      if (!silent) {
        showToast({ 
          type: 'error', 
          message: error instanceof Error ? error.message : 'Failed to approve'
        });
      }
    } finally {
      if (!silent) setIsApproving(false);
    }
  };

  const handleReject = async (item: ReviewItem) => {
    if (!rejectionReason) {
      showToast({ type: 'error', message: 'Please provide a rejection reason' });
      return;
    }
    setIsRejecting(true);
    try {
      const endpoint = item.type === 'brief' 
        ? `/api/v1/briefs/${item.id}/reject`
        : item.type === 'script'
        ? `/api/v1/scripts/${item.id}/reject`
        : `/api/v1/videos/${item.id}/reject`;
      
      const response = await fetch(endpoint, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to reject');
      }
      
      showToast({ type: 'success', message: 'Rejected with feedback' });
      setShowReviewModal(false);
      setSelectedItem(null);
      setRejectionReason('');
      mutate();
    } catch (error) {
      showToast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to reject'
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'brief': return <FileText className="h-5 w-5" />;
      case 'script': return <Zap className="h-5 w-5" />;
      case 'video': return <Video className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
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
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'published':
      case 'completed':
      case 'approved':
        return 'success';
      case 'pending':
      case 'generating':
        return 'processing';
      case 'failed':
      case 'rejected':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <div className="bg-white p-4 rounded-3xl m-4 flex-1 shadow-sm border border-slate-100/50">
      {/* Header with Batch Actions */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Content Review</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review and approve AI-generated content before publishing
          </p>
        </div>
        {selectedItems.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{selectedItems.size} selected</span>
            <Button variant="outline" size="sm" onClick={handleBatchApprove} disabled={isBatchApproving}>
              {isBatchApproving ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              {isBatchApproving ? 'Approving...' : 'Approve All'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleBatchReject} disabled={isBatchApproving}>
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        )}
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
                  {reviewItems.length > 0 ? (reviewItems.reduce((acc, i) => acc + i.score, 0) / reviewItems.length * 100).toFixed(0) : 0}%
                </p>
                <p className="text-sm text-gray-500">Avg Quality</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 flex items-center justify-between">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'briefs', label: 'Briefs', count: reviewItems.filter((i) => i.type === 'brief').length },
            { id: 'scripts', label: 'Scripts', count: reviewItems.filter((i) => i.type === 'script').length },
            { id: 'videos', label: 'Videos', count: reviewItems.filter((i) => i.type === 'video').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedItems(new Set()); }}
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
        {filteredItems.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            {selectedItems.size === filteredItems.length ? (
              <SquareCheck className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            Select All
          </button>
        )}
      </div>

      {/* Review List with Enhanced Cards */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="h-8 w-8" />}
          title="No items to review"
          description="All content has been reviewed. Check back later for new items."
        />
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <Card 
              key={item.id} 
              className={`transition-all ${selectedItems.has(item.id) ? 'ring-2 ring-indigo-500' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                    className="flex-shrink-0"
                  >
                    {selectedItems.has(item.id) ? (
                      <SquareCheck className="h-5 w-5 text-indigo-500" />
                    ) : (
                      <Square className="h-5 w-5 text-slate-300" />
                    )}
                  </button>

                  {/* Main Content - Click to open modal */}
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => { setSelectedItem(item); setShowReviewModal(true); }}
                  >
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
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleRegenerate(item); }}
                      disabled={isRegenerating === item.id}
                      title="Regenerate"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRegenerating === item.id ? 'animate-spin' : ''}`} />
                    </Button>
                    {item.status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleApprove(item); }}
                          title="Approve"
                        >
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Enhanced Review Modal with Side-by-Side View */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setSelectedItem(null);
          setRejectionReason('');
          cancelEdit();
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

            {/* Side-by-Side View for Videos */}
            {selectedItem.type === 'video' && (
              <div className="grid grid-cols-2 gap-4">
                {/* Video Preview */}
                <div className="rounded-lg border border-gray-200 p-4">
                  <h4 className="mb-3 font-medium text-gray-900">Video Preview</h4>
                  <div className="aspect-video rounded-lg bg-black flex items-center justify-center">
                    <Video className="h-12 w-12 text-gray-500" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-gray-50 p-2">
                      <p className="text-lg font-bold">{(selectedItem.data as VideoType).scenes_count}</p>
                      <p className="text-xs text-gray-500">Scenes</p>
                    </div>
                    <div className="rounded bg-gray-50 p-2">
                      <p className="text-lg font-bold">{(selectedItem.data as VideoType).total_duration_seconds}s</p>
                      <p className="text-xs text-gray-500">Duration</p>
                    </div>
                    <div className="rounded bg-gray-50 p-2">
                      <p className="text-lg font-bold">${(selectedItem.data as VideoType).total_cost_usd}</p>
                      <p className="text-xs text-gray-500">Cost</p>
                    </div>
                  </div>
                </div>

                {/* Associated Script */}
                <div className="rounded-lg border border-gray-200 p-4">
                  <h4 className="mb-3 font-medium text-gray-900 flex items-center justify-between">
                    Script
                    <button 
                      onClick={() => startEdit(selectedItem.id, 'script', mockScripts[0]?.full_script || '')}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  </h4>
                  {editingField?.id === selectedItem.id && editingField?.field === 'script' ? (
                    <div>
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full h-48 p-2 border rounded text-sm text-slate-900"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={saveEdit} disabled={isSavingEdit}>
                          {isSavingEdit ? (
                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving...</>
                          ) : (
                            <><Check className="h-3 w-3 mr-1" />Save</>
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSavingEdit}><X className="h-3 w-3 mr-1" />Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-gray-900 bg-gray-50 p-2 rounded">
                      {mockScripts[0]?.full_script || 'No script available'}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Brief Content with Inline Edit */}
            {selectedItem.type === 'brief' && (
              <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 flex items-center justify-between">
                    Creative Concept
                    <button 
                      onClick={() => startEdit(selectedItem.id, 'creative_concept', (selectedItem.data as Brief).creative_concept || '')}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  </p>
                  {editingField?.id === selectedItem.id && editingField?.field === 'creative_concept' ? (
                    <div className="mt-1">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full p-2 border rounded text-sm text-slate-900"
                        rows={3}
                      />
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={saveEdit} disabled={isSavingEdit}>
                          {isSavingEdit ? (
                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving...</>
                          ) : (
                            <><Check className="h-3 w-3 mr-1" />Save</>
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSavingEdit}><X className="h-3 w-3 mr-1" />Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-gray-900">{(selectedItem.data as Brief).creative_concept}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Key Messages</p>
                  <ul className="mt-1 list-inside list-disc text-gray-900">
                    {(selectedItem.data as Brief).key_messages?.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Script Content with Inline Edit */}
            {selectedItem.type === 'script' && (
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="mb-3 font-medium text-gray-900 flex items-center justify-between">
                  Script Content
                  <button 
                    onClick={() => startEdit(selectedItem.id, 'full_script', (selectedItem.data as Script).full_script || '')}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </h4>
                {editingField?.id === selectedItem.id && editingField?.field === 'full_script' ? (
                  <div>
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full h-64 p-2 border rounded text-sm text-slate-900 font-mono"
                    />
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" onClick={saveEdit} disabled={isSavingEdit}>
                        {isSavingEdit ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                        {isSavingEdit ? 'Saving...' : 'Save'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSavingEdit}>
                        <X className="h-3 w-3 mr-1" />Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm text-gray-900">
                    {(selectedItem.data as Script).full_script}
                  </pre>
                )}
              </div>
            )}

            {/* Feedback Input */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-gray-700">Feedback / Rejection Reason</span>
              </div>
              <Textarea
                placeholder="Add feedback for regeneration or rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => handleRegenerate(selectedItem)}
                disabled={isRegenerating === selectedItem.id}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating === selectedItem.id ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
              <div className="flex gap-3">
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
                      disabled={isRejecting || isApproving}
                    >
                      {isRejecting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      {isRejecting ? 'Rejecting...' : 'Reject'}
                    </Button>
                    <Button onClick={() => handleApprove(selectedItem)} disabled={isApproving || isRejecting}>
                      {isApproving ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {isApproving ? 'Approving...' : 'Approve'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
