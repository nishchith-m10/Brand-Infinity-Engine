'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Share2,
  Check,
  ChevronRight,
  Monitor,
  Smartphone,
  Square,
  Video,
  Download,
  Eye,
  Sparkles,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { variantsApi, type Variant } from '@/lib/api-client';
import { formatDate, getPlatformColor, cn } from '@/lib/utils';
import { getPlatformIcon } from '@/lib/platform-icons';
import { useV1Variants } from '@/lib/hooks/use-api';
import { useToast } from '@/lib/hooks/use-toast';
import { useCampaignProgress } from '@/lib/hooks/use-campaign-progress';
import { LockedState } from '@/components/LockedState';
import { CustomSelect } from '@/components/ui/custom-select';

// Available platforms configuration
const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', aspectRatio: '9:16', maxDuration: 180, description: 'Vertical short-form video' },
  { id: 'instagram_reels', name: 'Instagram Reels', aspectRatio: '9:16', maxDuration: 90, description: 'Vertical video up to 90s' },
  { id: 'instagram_feed', name: 'Instagram Feed', aspectRatio: '1:1', maxDuration: 60, description: 'Square video for feed' },
  { id: 'youtube_shorts', name: 'YouTube Shorts', aspectRatio: '9:16', maxDuration: 60, description: 'Vertical video up to 60s' },
  { id: 'youtube_feed', name: 'YouTube', aspectRatio: '16:9', maxDuration: 600, description: 'Horizontal long-form video' },
  { id: 'facebook_feed', name: 'Facebook', aspectRatio: '16:9', maxDuration: 240, description: 'Feed video any aspect' },
  { id: 'linkedin_feed', name: 'LinkedIn', aspectRatio: '16:9', maxDuration: 600, description: 'Professional video content' },
  { id: 'twitter_feed', name: 'X (Twitter)', aspectRatio: '16:9', maxDuration: 140, description: 'Short video for timeline' },
];

// Mock data
const mockVideos = [
  { video_id: 'video_001', name: 'Summer Product Launch', duration_seconds: 30, created_at: new Date().toISOString() },
];

const mockVariants: Variant[] = [
  { variant_id: 'var_001', video_id: 'video_001', platform: 'tiktok', aspect_ratio: '9:16', duration_seconds: 30, caption: 'The future is here #tech #innovation #lifestyle', hashtags: ['tech', 'innovation', 'lifestyle', 'gadgets'], status: 'ready', created_at: new Date().toISOString() },
  { variant_id: 'var_002', video_id: 'video_001', platform: 'instagram_reels', aspect_ratio: '9:16', duration_seconds: 30, caption: 'Game changer alert! Link in bio', hashtags: ['instagood', 'tech', 'reels', 'trending'], status: 'ready', created_at: new Date().toISOString() },
  { variant_id: 'var_003', video_id: 'video_001', platform: 'youtube_shorts', aspect_ratio: '9:16', duration_seconds: 30, caption: 'You NEED to see this! #shorts', hashtags: ['shorts', 'tech', 'gadgets'], status: 'ready', created_at: new Date().toISOString() },
  { variant_id: 'var_004', video_id: 'video_001', platform: 'instagram_feed', aspect_ratio: '1:1', duration_seconds: 30, caption: 'Innovation meets design. Tap to explore.', hashtags: ['design', 'innovation', 'style'], status: 'pending', created_at: new Date().toISOString() },
];

export default function DistributionPage() {
  const [selectedVideo] = useState<string | null>(mockVideos[0]?.video_id);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const { showToast: toast } = useToast();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showVariantDetail, setShowVariantDetail] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [customCaption, setCustomCaption] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAspectRatio, setFilterAspectRatio] = useState('');
  
  // Check prerequisites
  const { canAccessDistribution, steps, isLoading: progressLoading } = useCampaignProgress();
  
  // Fetch from API - MUST be called before any conditional returns
  const { data: apiVariants, mutate } = useV1Variants({ video_id: selectedVideo || undefined });
  
  // useMutation - MUST be called before any conditional returns
  const generateMutation = useMutation({
    mutationFn: async (data: { videoId: string; platforms: string[] }) => {
      const response = await fetch('/api/v1/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: data.videoId,
          platforms: data.platforms,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to generate variants');
      }

      return response.json();
    },
    onSuccess: () => {
      setShowGenerateModal(false);
      setSelectedPlatforms([]);
      toast({ type: 'success', message: 'Variants generation started' });
      mutate();
    },
    onError: (error) => {
      toast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to generate variants' 
      });
    },
  });

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId) ? prev.filter((p) => p !== platformId) : [...prev, platformId]
    );
  };

  const getAspectRatioIcon = (ratio: string) => {
    switch (ratio) {
      case '9:16': return <Smartphone className="h-4 w-4" />;
      case '16:9': return <Monitor className="h-4 w-4" />;
      case '1:1': return <Square className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const getPlatformConfig = (platformId: string) => PLATFORMS.find((p) => p.id === platformId);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'ready': case 'completed': return 'bg-emerald-100 text-emerald-600';
      case 'processing': return 'bg-lamaSkyLight text-lamaSky';
      case 'pending': return 'bg-lamaYellowLight text-amber-600';
      case 'error': return 'bg-red-100 text-red-600';
      default: return 'bg-slate-200 text-slate-600';
    }
  };

  // Show locked state if prerequisites not met - AFTER all hooks
  if (!progressLoading && !canAccessDistribution) {
    return (
      <LockedState
        title="Distribution is Locked"
        description="Videos must be ready before creating platform variants"
        steps={[
          { label: 'Approve content', completed: steps?.contentApproved || false },
          { label: 'Wait for video generation to complete', completed: steps?.videosReady || false },
        ]}
        nextAction={{ label: 'Go to Videos', href: '/videos' }}
        explanation="Create platform variants once your videos are ready."
      />
    );
  }
  
  // Apply filters
  let variants = apiVariants?.filter((v: Variant) => v.video_id === selectedVideo) || [];
  
  if (filterPlatform) {
    variants = variants.filter(v => v.platform === filterPlatform);
  }
  if (filterStatus) {
    variants = variants.filter(v => v.status === filterStatus);
  }
  if (filterAspectRatio) {
    variants = variants.filter(v => v.aspect_ratio === filterAspectRatio);
  }

  return (
    <div className="bg-white p-4 rounded-3xl m-4 flex-1 shadow-sm border border-slate-100/50">
      {/* TOP SECTION */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex items-center justify-between">
          <h1 className="hidden md:block text-2xl font-bold text-slate-800">Distribution</h1>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            {/* SEARCH */}
            <div className="flex items-center gap-2 text-xs rounded-full ring-[1.5px] ring-slate-200 px-3 py-2 w-full md:w-[240px] bg-white">
              <Search size={16} className="text-slate-500" />
              <input type="text" placeholder="Search variants..." className="w-full bg-transparent outline-none text-slate-700" autoComplete="off" data-form-type="other" />
            </div>
            <div className="flex items-center gap-4 self-end">
              <button 
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-full transition-colors",
                  showFilters 
                    ? "bg-amber-500 text-white" 
                    : "bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white"
                )}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal size={18} />
              </button>
              <button 
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-lamaPurpleLight text-slate-700 hover:bg-lamaPurple hover:text-white transition-colors font-medium text-sm"
              >
                <Sparkles size={16} />
                Generate Variants
              </button>
            </div>
          </div>
        </div>
        
        {/* FILTER PANEL */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-50 rounded-xl border border-slate-200 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-slate-700">Filters</h3>
              <button
                onClick={() => {
                  setFilterPlatform("");
                  setFilterStatus("");
                  setFilterAspectRatio("");
                }}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-600 mb-2 block font-medium">Platform</label>
                <CustomSelect
                  value={filterPlatform}
                  onChange={setFilterPlatform}
                  placeholder="All Platforms"
                  options={[
                    { value: '', label: 'All Platforms' },
                    { value: 'tiktok', label: 'TikTok' },
                    { value: 'instagram_reels', label: 'Instagram Reels' },
                    { value: 'instagram_feed', label: 'Instagram Feed' },
                    { value: 'youtube_shorts', label: 'YouTube Shorts' },
                    { value: 'youtube_feed', label: 'YouTube' },
                    { value: 'facebook_feed', label: 'Facebook' },
                    { value: 'linkedin_feed', label: 'LinkedIn' },
                    { value: 'twitter_feed', label: 'X (Twitter)' },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-2 block font-medium">Status</label>
                <CustomSelect
                  value={filterStatus}
                  onChange={setFilterStatus}
                  placeholder="All Status"
                  options={[
                    { value: '', label: 'All Status' },
                    { value: 'ready', label: 'Ready' },
                    { value: 'processing', label: 'Processing' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'error', label: 'Error' },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-2 block font-medium">Aspect Ratio</label>
                <CustomSelect
                  value={filterAspectRatio}
                  onChange={setFilterAspectRatio}
                  placeholder="All Ratios"
                  options={[
                    { value: '', label: 'All Ratios' },
                    { value: '9:16', label: 'Vertical (9:16)' },
                    { value: '16:9', label: 'Horizontal (16:9)' },
                    { value: '1:1', label: 'Square (1:1)' },
                  ]}
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* SOURCE VIDEO */}
      <div className="mb-8 p-4 rounded-2xl bg-slate-50 border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="aspect-video w-32 rounded-xl bg-slate-800 flex items-center justify-center">
            <Video className="h-6 w-6 text-white/60" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800">{mockVideos.find((v) => v.video_id === selectedVideo)?.name}</h3>
            <p className="text-sm text-slate-500">
              {mockVideos.find((v) => v.video_id === selectedVideo)?.duration_seconds}s • Created {formatDate(mockVideos.find((v) => v.video_id === selectedVideo)?.created_at || '')}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-600">Ready</span>
              <span className="text-xs text-slate-400">{variants.length} variants created</span>
            </div>
          </div>
        </div>
      </div>

      {/* VARIANTS GRID */}
      {variants.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lamaSkyLight">
            <Share2 className="h-7 w-7 text-lamaSky" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No variants yet</h3>
          <p className="text-sm text-slate-500 mb-4">Generate platform-specific variants to distribute your content</p>
          <button onClick={() => setShowGenerateModal(true)} className="px-4 py-2 rounded-xl bg-lamaPurple text-white font-medium hover:bg-lamaPurple/90 transition-colors">
            Generate Variants
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence>
            {variants.map((variant: Variant, index: number) => {
              const platform = getPlatformConfig(variant.platform);
              return (
                <motion.div
                  key={variant.variant_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    setSelectedVariant(variant);
                    setCustomCaption(variant.caption);
                    setShowVariantDetail(true);
                  }}
                  className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden cursor-pointer hover:shadow-md hover:border-slate-200 transition-all"
                >
                  {/* Preview */}
                  <div className={`relative ${variant.aspect_ratio === '9:16' ? 'aspect-[9/16]' : variant.aspect_ratio === '1:1' ? 'aspect-square' : 'aspect-video'} bg-slate-800`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className="h-8 w-8 text-white/40" />
                    </div>
                    <div className="absolute left-2 top-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getPlatformColor(variant.platform)}`}>
                        {platform?.name}
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                      {variant.duration_seconds}s
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {getAspectRatioIcon(variant.aspect_ratio)}
                        <span>{variant.aspect_ratio}</span>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusStyle(variant.status)}`}>
                        {variant.status}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-slate-600">{variant.caption}</p>
                    {variant.hashtags && variant.hashtags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {variant.hashtags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[10px] text-lamaPurple">#{tag}</span>
                        ))}
                        {variant.hashtags.length > 3 && <span className="text-[10px] text-slate-400">+{variant.hashtags.length - 3}</span>}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Generate Variants Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => { setShowGenerateModal(false); setSelectedPlatforms([]); }}
        title="Generate Platform Variants"
        description="Select platforms to create optimized variants for"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {PLATFORMS.map((platform) => {
              const isSelected = selectedPlatforms.includes(platform.id);
              const alreadyExists = variants.some((v: Variant) => v.platform === platform.id);
              return (
                <button
                  key={platform.id}
                  onClick={() => !alreadyExists && togglePlatform(platform.id)}
                  disabled={alreadyExists}
                  className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                    isSelected ? 'border-lamaPurple bg-lamaPurpleLight' : alreadyExists ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{getPlatformIcon(platform.id)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{platform.name}</span>
                      {isSelected && <Check className="h-4 w-4 text-lamaPurple" />}
                      {alreadyExists && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-600">Created</span>}
                    </div>
                    <p className="text-sm text-slate-500">{platform.description}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">{getAspectRatioIcon(platform.aspectRatio)} {platform.aspectRatio}</span>
                      <span>Max {platform.maxDuration}s</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedPlatforms.length > 0 && (
            <div className="rounded-xl bg-lamaPurpleLight p-4">
              <p className="text-sm text-slate-700"><strong>{selectedPlatforms.length}</strong> platform{selectedPlatforms.length > 1 ? 's' : ''} selected</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedPlatforms.map((id) => {
                  const platform = getPlatformConfig(id);
                  return <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-xs text-slate-700"><span className="text-slate-600">{getPlatformIcon(id)}</span> {platform?.name}</span>;
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowGenerateModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button
              onClick={() => selectedVideo && generateMutation.mutate({ videoId: selectedVideo, platforms: selectedPlatforms })}
              disabled={selectedPlatforms.length === 0}
              className="px-4 py-2 rounded-xl bg-lamaPurple text-white font-medium hover:bg-lamaPurple/90 disabled:opacity-50 transition-colors"
            >
              {generateMutation.isPending ? 'Generating...' : `Generate ${selectedPlatforms.length > 0 ? `(${selectedPlatforms.length})` : ''}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Variant Detail Modal */}
      <Modal
        isOpen={showVariantDetail}
        onClose={() => { setShowVariantDetail(false); setSelectedVariant(null); }}
        title="Variant Details"
        size="lg"
      >
        {selectedVariant && (
          <div className="space-y-6">
            <div className="flex gap-6">
              <div className={`relative shrink-0 ${selectedVariant.aspect_ratio === '9:16' ? 'aspect-[9/16] w-40' : selectedVariant.aspect_ratio === '1:1' ? 'aspect-square w-40' : 'aspect-video w-64'} overflow-hidden rounded-xl bg-slate-800`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Video className="h-10 w-10 text-white/40" />
                </div>
              </div>
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium ${getPlatformColor(selectedVariant.platform)}`}>
                    {getPlatformConfig(selectedVariant.platform)?.name}
                  </span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusStyle(selectedVariant.status)}`}>
                    {selectedVariant.status}
                  </span>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-500">Aspect Ratio</dt><dd className="text-slate-800">{selectedVariant.aspect_ratio}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Duration</dt><dd className="text-slate-800">{selectedVariant.duration_seconds}s</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Created</dt><dd className="text-slate-800">{formatDate(selectedVariant.created_at)}</dd></div>
                </dl>
              </div>
            </div>

            <div>
              <Textarea label="Caption" value={customCaption} onChange={(e) => setCustomCaption(e.target.value)} rows={3} />
              {selectedVariant.hashtags && selectedVariant.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedVariant.hashtags.map((tag) => (
                    <span key={tag} className="rounded-full bg-lamaPurpleLight px-2 py-1 text-xs text-lamaPurple">#{tag}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => toast({ type: 'info', message: "Video preview player coming soon" })} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                <Eye className="h-4 w-4" /> Preview
              </button>
              <button onClick={() => toast({ type: 'info', message: "Download functionality coming soon" })} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                <Download className="h-4 w-4" /> Download
              </button>
              <button onClick={() => { setShowVariantDetail(false); window.location.href = '/publishing'; }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-lamaPurple text-white font-medium hover:bg-lamaPurple/90 transition-colors">
                <ChevronRight className="h-4 w-4" /> Schedule Post
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
