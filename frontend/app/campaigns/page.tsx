'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Search, Zap, FileText, Send, Video as VideoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { briefsApi, scriptsApi, videosApi, type BriefRequest, type Brief, type Script, type Video } from '@/lib/api-client';
import { formatDate, generateId, truncate } from '@/lib/utils';

// Types for local state
interface LocalCampaign {
  id: string;
  name: string;
  status: 'draft' | 'brief' | 'script' | 'video' | 'variants' | 'published';
  brief_id?: string;
  script_id?: string;
  video_id?: string;
  created_at: string;
  brand_id: string;
}

type BudgetTier = 'low' | 'medium' | 'high' | 'premium';

export default function CampaignsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<LocalCampaign | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form state for new campaign
  const [newCampaign, setNewCampaign] = useState<{
    name: string;
    brand_id: string;
    product_category: string;
    target_demographic: string;
    campaign_objective: string;
    budget_tier: BudgetTier;
    additional_context: string;
  }>({
    name: '',
    brand_id: 'brand_001', // Default brand
    product_category: '',
    target_demographic: '',
    campaign_objective: '',
    budget_tier: 'medium',
    additional_context: '',
  });

  // Local campaigns storage (in production, this would come from API)
  const [campaigns, setCampaigns] = useState<LocalCampaign[]>([
    {
      id: 'camp_demo_001',
      name: 'Summer Product Launch',
      status: 'video',
      brief_id: 'brief_001',
      script_id: 'script_001',
      video_id: 'video_001',
      created_at: new Date().toISOString(),
      brand_id: 'brand_001',
    },
  ]);

  // Wizard state
  const [wizardData, setWizardData] = useState<{
    brief?: Brief;
    script?: Script;
    video?: Video;
  }>({});

  // Mutations
  const createBriefMutation = useMutation({
    mutationFn: async (data: BriefRequest & { campaignId: string }) => {
      const response = await briefsApi.createBrief(data.campaignId, data);
      return response.data;
    },
    onSuccess: (data) => {
      setWizardData((prev) => ({ ...prev, brief: data.data }));
      setWizardStep(2);
    },
  });

  const generateScriptMutation = useMutation({
    mutationFn: async (briefId: string) => {
      const response = await scriptsApi.generateScript(briefId, {
        hookCount: 50,
        variantTag: 'balanced',
        targetDuration: 30,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setWizardData((prev) => ({ ...prev, script: data.data }));
      setWizardStep(3);
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const response = await videosApi.generateVideo(scriptId, {
        quality: 'high',
        budget: 'medium',
        priority: 'balanced',
      });
      return response.data;
    },
    onSuccess: (data) => {
      setWizardData((prev) => ({ ...prev, video: data.data }));
      setWizardStep(4);
      
      // Update campaign status
      if (selectedCampaign) {
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === selectedCampaign.id
              ? {
                  ...c,
                  status: 'video' as const,
                  brief_id: wizardData.brief?.brief_id,
                  script_id: wizardData.script?.script_id,
                  video_id: data.data?.video_id,
                }
              : c
          )
        );
      }
    },
  });

  // Create new campaign
  const handleCreateCampaign = () => {
    const newCamp: LocalCampaign = {
      id: `camp_${generateId()}`,
      name: newCampaign.name,
      status: 'draft',
      created_at: new Date().toISOString(),
      brand_id: newCampaign.brand_id,
    };
    setCampaigns((prev) => [newCamp, ...prev]);
    setSelectedCampaign(newCamp);
    setShowCreateModal(false);
    setShowWizard(true);
    setWizardStep(1);
    setWizardData({});
  };

  // Start brief generation
  const handleGenerateBrief = () => {
    if (!selectedCampaign) return;
    
    createBriefMutation.mutate({
      campaignId: selectedCampaign.id,
      product_category: newCampaign.product_category,
      target_demographic: newCampaign.target_demographic,
      campaign_objective: newCampaign.campaign_objective,
      budget_tier: newCampaign.budget_tier,
      brand_id: selectedCampaign.brand_id,
      additional_context: newCampaign.additional_context,
    });
  };

  // Filter campaigns
  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStepStatus = (step: number) => {
    if (step < wizardStep) return 'completed';
    if (step === wizardStep) return 'current';
    return 'upcoming';
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-2 text-sm text-gray-600">
            Create and manage your marketing campaigns
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
          New Campaign
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'draft', label: 'Draft' },
            { value: 'brief', label: 'Brief Created' },
            { value: 'script', label: 'Script Generated' },
            { value: 'video', label: 'Video Ready' },
            { value: 'published', label: 'Published' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
        />
      </div>

      {/* Campaigns Grid */}
      {filteredCampaigns.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No campaigns yet"
          description="Create your first campaign to start generating marketing content"
          action={{
            label: 'Create Campaign',
            onClick: () => setShowCreateModal(true),
          }}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCampaigns.map((campaign) => (
            <Card
              key={campaign.id}
              hover
              onClick={() => {
                setSelectedCampaign(campaign);
                setShowWizard(true);
                // Set wizard step based on campaign status
                if (campaign.video_id) setWizardStep(4);
                else if (campaign.script_id) setWizardStep(3);
                else if (campaign.brief_id) setWizardStep(2);
                else setWizardStep(1);
              }}
            >
              <CardContent className="p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Created {formatDate(campaign.created_at)}
                    </p>
                  </div>
                  <Badge variant="status" status={campaign.status}>
                    {campaign.status}
                  </Badge>
                </div>

                {/* Progress indicator */}
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${campaign.brief_id ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div className={`h-0.5 flex-1 ${campaign.script_id ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div className={`h-2 w-2 rounded-full ${campaign.script_id ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div className={`h-0.5 flex-1 ${campaign.video_id ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div className={`h-2 w-2 rounded-full ${campaign.video_id ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div className={`h-0.5 flex-1 ${campaign.status === 'published' ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div className={`h-2 w-2 rounded-full ${campaign.status === 'published' ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>Brief</span>
                    <span>Script</span>
                    <span>Video</span>
                    <span>Publish</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Campaign"
        description="Start a new marketing campaign with AI-powered content generation"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Campaign Name"
            placeholder="e.g., Summer Product Launch"
            value={newCampaign.name}
            onChange={(e) => setNewCampaign((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Product Category"
            placeholder="e.g., Electronics, Fashion, Health"
            value={newCampaign.product_category}
            onChange={(e) => setNewCampaign((prev) => ({ ...prev, product_category: e.target.value }))}
          />
          <Input
            label="Target Demographic"
            placeholder="e.g., Gen Z, millennials, professionals"
            value={newCampaign.target_demographic}
            onChange={(e) => setNewCampaign((prev) => ({ ...prev, target_demographic: e.target.value }))}
          />
          <Select
            label="Campaign Objective"
            options={[
              { value: 'awareness', label: 'Brand Awareness' },
              { value: 'engagement', label: 'Engagement' },
              { value: 'conversion', label: 'Conversion' },
              { value: 'retention', label: 'Customer Retention' },
            ]}
            value={newCampaign.campaign_objective}
            onChange={(e) => setNewCampaign((prev) => ({ ...prev, campaign_objective: e.target.value }))}
            placeholder="Select objective"
          />
          <Select
            label="Budget Tier"
            options={[
              { value: 'low', label: 'Low ($10-50)' },
              { value: 'medium', label: 'Medium ($50-200)' },
              { value: 'high', label: 'High ($200-500)' },
              { value: 'premium', label: 'Premium ($500+)' },
            ]}
            value={newCampaign.budget_tier}
            onChange={(e) => setNewCampaign((prev) => ({ ...prev, budget_tier: e.target.value as BudgetTier }))}
          />
          <Textarea
            label="Additional Context"
            placeholder="Any specific requirements, trends to incorporate, or brand guidelines to follow..."
            value={newCampaign.additional_context}
            onChange={(e) => setNewCampaign((prev) => ({ ...prev, additional_context: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={!newCampaign.name || !newCampaign.product_category}
            >
              Create Campaign
            </Button>
          </div>
        </div>
      </Modal>

      {/* Campaign Wizard Modal */}
      <Modal
        isOpen={showWizard}
        onClose={() => {
          setShowWizard(false);
          setSelectedCampaign(null);
          setWizardData({});
        }}
        title={selectedCampaign?.name || 'Campaign Wizard'}
        size="xl"
      >
        {/* Wizard Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { step: 1, label: 'Creative Brief', icon: FileText },
              { step: 2, label: 'Script & Hooks', icon: Zap },
              { step: 3, label: 'Video Generation', icon: VideoIcon },
              { step: 4, label: 'Ready to Publish', icon: Send },
            ].map(({ step, label, icon: Icon }, index) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      getStepStatus(step) === 'completed'
                        ? 'bg-green-500 text-white'
                        : getStepStatus(step) === 'current'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="mt-2 text-xs font-medium text-gray-600">{label}</span>
                </div>
                {index < 3 && (
                  <div
                    className={`mx-4 h-0.5 w-16 ${
                      getStepStatus(step + 1) !== 'upcoming' ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {wizardStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Generate Creative Brief</h3>
              <p className="text-sm text-gray-600">
                The AI will analyze trends and brand guidelines to create a comprehensive creative brief.
              </p>
              
              <div className="rounded-lg bg-gray-50 p-4">
                <h4 className="font-medium text-gray-900">Campaign Details</h4>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Category:</dt>
                    <dd className="text-gray-900">{newCampaign.product_category || 'Not set'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Target:</dt>
                    <dd className="text-gray-900">{newCampaign.target_demographic || 'Not set'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Objective:</dt>
                    <dd className="text-gray-900">{newCampaign.campaign_objective || 'Not set'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Budget:</dt>
                    <dd className="text-gray-900">{newCampaign.budget_tier}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleGenerateBrief}
                  isLoading={createBriefMutation.isPending}
                  leftIcon={<Zap className="h-4 w-4" />}
                >
                  Generate Brief
                </Button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Brief Generated Successfully!</h3>
              
              {wizardData.brief && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <Badge variant="status" status="approved">
                      Brand Alignment: {(wizardData.brief.brand_alignment_score * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Creative Concept</h4>
                      <p className="mt-1 text-gray-900">{wizardData.brief.creative_concept}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Key Messages</h4>
                      <ul className="mt-1 list-inside list-disc text-gray-900">
                        {wizardData.brief.key_messages?.map((msg: string, i: number) => (
                          <li key={i}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setWizardStep(1)}>
                  Regenerate
                </Button>
                <Button
                  onClick={() => wizardData.brief && generateScriptMutation.mutate(wizardData.brief.brief_id)}
                  isLoading={generateScriptMutation.isPending}
                  leftIcon={<FileText className="h-4 w-4" />}
                >
                  Generate Script
                </Button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Script Generated!</h3>
              
              {wizardData.script && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-4 flex items-center gap-4">
                    <Badge variant="status" status="approved">
                      Compliance: {(wizardData.script.brand_compliance_score * 100).toFixed(0)}%
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {wizardData.script.hook_variations_count} hooks generated
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <h4 className="text-sm font-medium text-gray-500">Script Preview</h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                      {truncate(wizardData.script.full_script || '', 500)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setWizardStep(2)}>
                  Back
                </Button>
                <Button
                  onClick={() => wizardData.script && generateVideoMutation.mutate(wizardData.script.script_id)}
                  isLoading={generateVideoMutation.isPending}
                  leftIcon={<VideoIcon className="h-4 w-4" />}
                >
                  Generate Video
                </Button>
              </div>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <VideoIcon className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-green-900">Video Ready!</h3>
                <p className="mt-2 text-sm text-green-700">
                  Your video has been generated successfully
                </p>
              </div>
              
              {wizardData.video && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-gray-50 p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{wizardData.video.scenes_count}</p>
                    <p className="text-sm text-gray-500">Scenes</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">${wizardData.video.total_cost_usd}</p>
                    <p className="text-sm text-gray-500">Cost</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {(wizardData.video.quality_score * 100).toFixed(0)}%
                    </p>
                    <p className="text-sm text-gray-500">Quality</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowWizard(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowWizard(false);
                    // Navigate to distribution page
                    window.location.href = '/distribution';
                  }}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  Create Variants
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
