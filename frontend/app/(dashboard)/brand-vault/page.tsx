'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { useCurrentCampaign } from '@/lib/hooks/use-current-campaign';
import { 
  Upload, 
  FileImage, 
  FileText, 
  Palette, 
  Type, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Loader2,
  RefreshCw,
  FolderOpen,
  Save,
  Sparkles,
  ChevronDown,
  Plus,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/lib/hooks/use-toast';
import { BrandVaultChecklist } from '@/components/BrandVaultChecklist';
import { KBManager } from '@/components/KBManager';
import { Tooltip } from '@/components/ui/tooltip';
import { CustomSelect } from '@/components/ui/custom-select';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

import { 
  BrandAsset, 
  BrandIdentity, 
  KnowledgeBase, 
  AssetTypeConfig,
  TabType,
  AssetCategory,
  ActionLoadingType,
  ToneStyle,
  CommunicationStyle
} from './types';

const assetTypeConfig: Record<string, AssetTypeConfig> = {
  logo: { icon: FileImage, color: 'text-blue-500', bg: 'bg-blue-100' },
  product: { icon: FileImage, color: 'text-green-500', bg: 'bg-green-100' },
  guideline: { icon: FileText, color: 'text-purple-500', bg: 'bg-purple-100' },
  color: { icon: Palette, color: 'text-pink-500', bg: 'bg-pink-100' },
  font: { icon: Type, color: 'text-orange-500', bg: 'bg-orange-100' },
  other: { icon: FolderOpen, color: 'text-slate-500', bg: 'bg-slate-100' },
};

// Industry options
const INDUSTRIES = [
  'Technology', 'E-commerce', 'Healthcare', 'Finance', 'Education',
  'Real Estate', 'Travel', 'Food & Beverage', 'Fashion', 'Beauty',
  'Fitness', 'Entertainment', 'B2B SaaS', 'Agency', 'Non-Profit', 'Other'
];

// Tone style options
const TONE_STYLES: ToneStyle[] = [
  { value: 'professional', label: 'Professional', desc: 'Polished and business-focused' },
  { value: 'casual', label: 'Casual', desc: 'Relaxed and approachable' },
  { value: 'playful', label: 'Playful', desc: 'Fun and energetic' },
  { value: 'authoritative', label: 'Authoritative', desc: 'Expert and confident' },
  { value: 'friendly', label: 'Friendly', desc: 'Warm and welcoming' },
  { value: 'luxurious', label: 'Luxurious', desc: 'Premium and sophisticated' },
];

// Communication style options  
const COMMUNICATION_STYLES: CommunicationStyle[] = [
  { value: 'formal', label: 'Formal', desc: 'Traditional business language' },
  { value: 'conversational', label: 'Conversational', desc: 'Like talking to a friend' },
  { value: 'educational', label: 'Educational', desc: 'Teaching and informative' },
  { value: 'inspirational', label: 'Inspirational', desc: 'Motivating and uplifting' },
];

// Personality trait options
const PERSONALITY_TRAITS = [
  'Innovative', 'Trustworthy', 'Bold', 'Caring', 'Creative',
  'Reliable', 'Authentic', 'Energetic', 'Sophisticated', 'Down-to-earth',
  'Adventurous', 'Minimalist', 'Inclusive', 'Sustainable', 'Tech-savvy'
];

// Content pillar suggestions
const CONTENT_PILLAR_SUGGESTIONS = [
  'Product Education', 'Industry Insights', 'Customer Success Stories',
  'Behind the Scenes', 'Tips & How-tos', 'Thought Leadership',
  'Community Building', 'Entertainment', 'Promotions', 'FAQ & Support'
];

// Default identity values (used for initialization and merging with loaded data)
const DEFAULT_IDENTITY: BrandIdentity = {
  // Core Identity
  brandName: '',
  tagline: '',
  industry: '',
  
  // Voice & Tone
  toneStyle: 'professional',
  communicationStyle: 'conversational',
  brandVoice: '',
  
  // Personality
  personalityTraits: [],
  
  // Target Audience
  targetAudience: '',
  audienceAgeRange: '',
  audiencePainPoints: '',
  
  // Visual Identity
  primaryColor: '#6366F1',
  secondaryColor: '#8B5CF6',
  accentColor: '#EC4899',
  
  // Content Strategy
  contentPillars: [],
  keyMessages: '',
  avoidTopics: '',
  
  // Competitors
  competitors: '',
  uniqueValue: '',
};

export default function BrandVaultPage() {
  // Sub-tab state
  const [activeTab, setActiveTab] = useState<TabType>('assets');
  
  // KB State - KB-first architecture
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKBId, setSelectedKBId] = useState<string | null>(null);
  const [loadingKBs, setLoadingKBs] = useState(true);
  
  // Assets state
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AssetCategory>('all');
  
  // File input ref for upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Identity state - uses DEFAULT_IDENTITY for missing fields
  const [identity, setIdentity] = useState<BrandIdentity>(DEFAULT_IDENTITY);
  const [savingIdentity, setSavingIdentity] = useState(false);
  
  // Action loading state: { [id]: 'toggle' | 'delete' }
  const [actionLoading, setActionLoading] = useState<Record<string, ActionLoadingType>>({});
  
  // Confirmation modal state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; assetId: string | null }>({
    isOpen: false,
    assetId: null,
  });

  const { showToast } = useToast();
  const { user } = useAuth();
  const { campaign, campaignId } = useCurrentCampaign();

  // Get brand_id from user.id (Phase 6 single-tenant setup)
  const brandId = user?.id || '';

  // Load Knowledge Bases
  const fetchKBs = useCallback(async () => {
    if (!brandId || !campaignId) return; // Don't fetch if no brand/campaign ID
    
    setLoadingKBs(true);
    try {
      const res = await fetch(`/api/v1/knowledge-bases?brand_id=${brandId}&campaign_id=${campaignId}`);
      
      if (!res.ok) {
        console.warn(`Failed to fetch KBs (${res.status}):`, res.statusText);
        // Set empty array so UI doesn't break
        setKnowledgeBases([]);
        setLoadingKBs(false);
        return;
      }

      // Check if response is JSON
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Knowledge bases API returned non-JSON response');
        setKnowledgeBases([]);
        setLoadingKBs(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setKnowledgeBases(data.data || []);
        // Auto-select core KB if none selected
        if (!selectedKBId && data.data?.length > 0) {
          const coreKB = data.data.find((kb: KnowledgeBase) => kb.is_core);
          setSelectedKBId(coreKB?.id || data.data[0].id);
        }
      } else {
        setKnowledgeBases([]);
      }
    } catch (error) {
      console.error('Failed to fetch KBs:', error);
      setKnowledgeBases([]);
    } finally {
      setLoadingKBs(false);
    }
  }, [brandId, campaignId]); // Removed selectedKBId to prevent recreation

  // Load identity from database API (fallback to localStorage)
  // Always merge with DEFAULT_IDENTITY to ensure new fields have values
  useEffect(() => {
    const loadIdentity = async () => {
      if (!campaignId) {
        // No campaign selected - clear identity or load brand-level
        setIdentity(DEFAULT_IDENTITY);
        return;
      }

      let loadedData: Partial<BrandIdentity> = {};
      
      try {
        const res = await fetch(`/api/v1/brand-identity?campaign_id=${campaignId}`);
        const data = await res.json();
        if (data.success && data.data) {
          loadedData = data.data;
        }
      } catch (e) {
        console.error('Failed to fetch brand identity from API:', e);
      }
      
      // Merge loaded data with defaults to ensure all fields exist
      setIdentity({
        ...DEFAULT_IDENTITY,
        ...loadedData,
        // Ensure arrays are always arrays
        personalityTraits: Array.isArray(loadedData.personalityTraits) ? loadedData.personalityTraits : [],
        contentPillars: Array.isArray(loadedData.contentPillars) ? loadedData.contentPillars : [],
      });
    };
    
    // Debounce to prevent rapid API calls when switching campaigns
    const timer = setTimeout(() => {
      loadIdentity();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [campaignId]);

  // Fetch assets - filtered by selected KB
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (brandId) queryParams.append('brand_id', brandId);
      if (selectedKBId) queryParams.append('knowledge_base_id', selectedKBId);
      
      const res = await fetch(`/api/v1/brand-assets?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAssets(data.data || []);
        console.log('[Assets] Fetched assets:', data.data?.length || 0, 'assets');
      } else {
        console.error('[Assets] Fetch failed:', data.error);
        showToast({ type: 'error', message: data.error?.message || 'Failed to fetch assets' });
      }
    } catch (error) {
      console.error('[Assets] Failed to fetch assets:', error);
      showToast({ type: 'error', message: 'Failed to fetch assets. Please try again.' });
    } finally {
      setLoading(false);
    }
  }, [brandId, selectedKBId]); // Removed showToast to prevent recreation

  useEffect(() => {
    if (brandId && campaignId) {
      // Debounce to prevent rapid API calls when switching campaigns
      const timer = setTimeout(() => {
        fetchKBs();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [brandId, campaignId, fetchKBs]);

  useEffect(() => {
    if (brandId && selectedKBId) {
      fetchAssets();
    }
  }, [brandId, selectedKBId, fetchAssets]);

  const handleToggleActive = async (id: string, currentState: boolean) => {
    setActionLoading(prev => ({ ...prev, [id]: 'toggle' }));
    try {
      const res = await fetch(`/api/v1/brand-assets?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentState }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update');
      }

      showToast({ type: 'success', message: `Asset ${currentState ? 'deactivated' : 'activated'}` });
      fetchAssets();
    } catch (error) {
      showToast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to update' 
      });
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirmModal({ isOpen: true, assetId: id });
  };

  const handleDeleteConfirm = async () => {
    const id = deleteConfirmModal.assetId;
    if (!id) return;
    
    setActionLoading(prev => ({ ...prev, [id]: 'delete' }));
    try {
      const res = await fetch(`/api/v1/brand-assets?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete');
      }

      showToast({ type: 'success', message: 'Asset deleted successfully' });
      setDeleteConfirmModal({ isOpen: false, assetId: null });
      fetchAssets();
    } catch (error) {
      showToast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to delete asset' 
      });
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // Handle file upload with KB association
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedKBId) {
      showToast({ type: 'error', message: 'Please select a Knowledge Base first' });
      return;
    }

    setLoading(true);
    try {
      // Determine asset type based on file
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      let assetType: 'logo' | 'product' | 'guideline' | 'other' = 'other';
      
      if (isImage) {
        assetType = file.name.toLowerCase().includes('logo') ? 'logo' : 'product';
      } else if (isPdf) {
        assetType = 'guideline';
      }

      // Create FormData for upload with KB ID
      const formData = new FormData();
      formData.append('file', file);
      formData.append('asset_type', assetType);
      formData.append('knowledge_base_id', selectedKBId);
      formData.append('brand_id', brandId);

      const res = await fetch('/api/v1/brand-assets/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Upload failed');
      }

      showToast({ type: 'success', message: `${file.name} uploaded successfully` });
      console.log('[Assets] Upload successful, refreshing asset list');
      // Force refresh after a small delay to ensure DB propagation
      setTimeout(() => {
        fetchAssets();
        fetchKBs(); // Refresh KB asset counts
      }, 300);
    } catch (error) {
      showToast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to upload file' 
      });
    } finally {
      setLoading(false);
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveIdentity = async () => {
    if (!campaignId) {
      showToast({ type: 'error', message: 'Please select a campaign first' });
      return;
    }

    setSavingIdentity(true);
    try {
      const res = await fetch('/api/v1/brand-identity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...identity,
          campaign_id: campaignId, // Include campaign_id for campaign-specific identity
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to save');
      }

      showToast({ type: 'success', message: 'Brand identity saved for this campaign' });
    } catch (error) {
      showToast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to save identity' 
      });
    } finally {
      setSavingIdentity(false);
    }
  };

  const filteredAssets = filter === 'all' 
    ? assets 
    : assets.filter(a => a.asset_type === filter);

  const categories: AssetCategory[] = ['all', 'logo', 'product', 'guideline', 'color', 'font'];
  const selectedKB = knowledgeBases.find(kb => kb.id === selectedKBId);

  // Check if setup is complete
  const isIdentityConfigured = identity.brandName && identity.brandVoice && identity.targetAudience;
  const hasAssets = assets.length > 0;
  const isSetupComplete = isIdentityConfigured && hasAssets;

  // Setup steps for checklist
  const setupSteps = [
    { 
      id: 'name', 
      label: 'Set Brand Name', 
      description: 'Give your brand a recognizable name',
      completed: !!identity.brandName,
    },
    { 
      id: 'voice', 
      label: 'Define Brand Voice', 
      description: 'Describe how your brand communicates',
      completed: !!identity.brandVoice,
    },
    { 
      id: 'audience', 
      label: 'Identify Target Audience', 
      description: 'Who are you creating content for?',
      completed: !!identity.targetAudience,
    },
    { 
      id: 'assets', 
      label: 'Upload Brand Assets', 
      description: 'Logos, product images, guidelines',
      completed: hasAssets,
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Brand Vault</h1>
          <p className="text-slate-500 mt-1">Your brand assets and identity for AI context</p>
        </div>
        <Tooltip content="Refresh brand assets and knowledge bases" position="bottom">
          <Button variant="outline" onClick={() => { fetchAssets(); fetchKBs(); }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </Tooltip>
      </div>

      {/* No Campaign Selected Warning */}
      {!campaignId && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">No Campaign Selected</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Please select a campaign from the dropdown above to view and manage its brand assets and knowledge bases.
              Each campaign has its own isolated data.
            </p>
          </div>
        </div>
      )}

      {/* Floating Setup Checklist - handles its own visibility */}
      <BrandVaultChecklist steps={setupSteps} />

      {/* Sub-tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('assets')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'assets'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FolderOpen className="h-4 w-4 inline mr-1.5" />Assets
          </button>
          <button
            onClick={() => setActiveTab('identity')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'identity'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Palette className="h-4 w-4 inline mr-1.5" />Identity
          </button>
          <button
            onClick={() => setActiveTab('kbs')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'kbs'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FolderOpen className="h-4 w-4 inline mr-1.5" />Knowledge Bases
          </button>
        </div>
      </div>

      {/* Assets Tab - KB-FIRST ARCHITECTURE */}
      {activeTab === 'assets' && (
        <div className="space-y-6">
          {/* KB Selector + Upload Row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* KB Dropdown */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">Knowledge Base:</span>
              <CustomSelect
                value={selectedKBId || ''}
                onChange={(value) => setSelectedKBId(value || null)}
                disabled={loadingKBs}
                placeholder="All Assets"
                options={[
                  { value: '', label: 'All Assets' },
                  ...knowledgeBases.map((kb) => ({
                    value: kb.id,
                    label: `${kb.is_core ? '🛡️ ' : ''}${kb.name} (${kb.asset_count || 0})`,
                  })),
                ]}
              />
            </div>

            {/* Filter + Upload */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      filter === cat 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
              
              {/* Hidden file input */}
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                onChange={handleUpload} 
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              
            </div>
          </div>

          {/* Info: No KB Selected */}
          {!selectedKBId && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Select a Knowledge Base</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Choose a KB from the dropdown above to view and upload assets, or select &quot;All Assets&quot; to see everything.
                </p>
              </div>
            </div>
          )}

          {/* Assets Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : filteredAssets.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <FolderOpen className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <h3 className="text-base font-medium text-slate-600">
                  {selectedKBId ? `No assets in "${selectedKB?.name}"` : 'No assets found'}
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                  {selectedKBId ? 'Upload brand assets to this knowledge base' : 'Select a KB and upload assets'}
                </p>
                {selectedKBId && (
                  <Button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="mt-4"
                    size="sm"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload to {selectedKB?.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAssets.map((asset) => {
                const config = assetTypeConfig[asset.asset_type] || assetTypeConfig.other;
                const Icon = config.icon;
                const assetKB = knowledgeBases.find(kb => kb.id === asset.knowledge_base_id);
                
                return (
                  <Card 
                    key={asset.id} 
                    className={`transition-all hover:shadow-lg hover:-translate-y-0.5 ${!asset.is_active ? 'opacity-50' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-2 rounded-lg ${config.bg}`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div className="flex gap-1">
                          <Tooltip content={asset.is_active ? 'Deactivate this asset' : 'Activate this asset'} position="top">
                            <button
                              onClick={() => handleToggleActive(asset.id, asset.is_active)}
                              className="p-1.5 rounded hover:bg-slate-100"
                              disabled={!!actionLoading[asset.id]}
                            >
                              {actionLoading[asset.id] === 'toggle' ? (
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                              ) : asset.is_active ? (
                                <ToggleRight className="h-4 w-4 text-green-500" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-slate-400" />
                              )}
                            </button>
                          </Tooltip>
                          <Tooltip content="Delete this asset permanently" position="top">
                            <button
                              onClick={() => handleDeleteClick(asset.id)}
                              className="p-1.5 rounded hover:bg-red-50"
                              disabled={!!actionLoading[asset.id]}
                            >
                              {actionLoading[asset.id] === 'delete' ? (
                                <Loader2 className="h-4 w-4 animate-spin text-red-400" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-red-400" />
                              )}
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                      <h4 className="font-medium text-slate-800 text-sm truncate">{asset.file_name}</h4>
                      <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded-full ${config.bg} ${config.color}`}>
                          {asset.asset_type}
                        </span>
                        {assetKB && (
                          <span 
                            className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium truncate"
                          >
                            {assetKB.name}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Identity Tab - Professional Brand Settings */}
      {activeTab === 'identity' && (
        <div className="space-y-6">
          {/* Section 1: Core Identity */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                </div>
                Core Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-slate-700">Brand Name *</label>
                <Input
                  value={identity.brandName}
                  onChange={(e) => setIdentity(prev => ({ ...prev, brandName: e.target.value }))}
                  placeholder="Your company or product name"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Tagline</label>
                <Input
                  value={identity.tagline}
                  onChange={(e) => setIdentity(prev => ({ ...prev, tagline: e.target.value }))}
                  placeholder="Your brand's catchphrase or slogan"
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Industry</label>
                <select
                  value={identity.industry}
                  onChange={(e) => setIdentity(prev => ({ ...prev, industry: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select your industry</option>
                  {INDUSTRIES.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Voice & Tone */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Type className="h-4 w-4 text-purple-600" />
                </div>
                Voice & Tone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-3 block">Tone Style</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TONE_STYLES.map(tone => (
                    <button
                      key={tone.value}
                      type="button"
                      onClick={() => setIdentity(prev => ({ ...prev, toneStyle: tone.value }))}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        identity.toneStyle === tone.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <p className="font-medium text-sm text-slate-800">{tone.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{tone.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-3 block">Communication Style</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {COMMUNICATION_STYLES.map(style => (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => setIdentity(prev => ({ ...prev, communicationStyle: style.value }))}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        identity.communicationStyle === style.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <p className="font-medium text-sm text-slate-800">{style.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{style.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Brand Voice Description</label>
                <Textarea
                  value={identity.brandVoice}
                  onChange={(e) => setIdentity(prev => ({ ...prev, brandVoice: e.target.value }))}
                  placeholder="Describe how your brand speaks. Example: 'We're the trusted friend who explains complex things simply. We use humor but never at others' expense. We're confident but never arrogant.'"
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-3 block">
                  Personality Traits <span className="text-slate-400 font-normal">(Select up to 5)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PERSONALITY_TRAITS.map(trait => {
                    const isSelected = identity.personalityTraits.includes(trait);
                    const canSelect = identity.personalityTraits.length < 5 || isSelected;
                    return (
                      <button
                        key={trait}
                        type="button"
                        disabled={!canSelect}
                        onClick={() => {
                          setIdentity(prev => ({
                            ...prev,
                            personalityTraits: isSelected
                              ? prev.personalityTraits.filter(t => t !== trait)
                              : [...prev.personalityTraits, trait]
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                          isSelected
                            ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                            : canSelect
                              ? 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
                              : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {trait}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Target Audience */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FolderOpen className="h-4 w-4 text-green-600" />
                </div>
                Target Audience
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-slate-700">Primary Audience</label>
                <Input
                  value={identity.targetAudience}
                  onChange={(e) => setIdentity(prev => ({ ...prev, targetAudience: e.target.value }))}
                  placeholder="e.g., Small business owners, Marketing managers"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Age Range</label>
                <select
                  value={identity.audienceAgeRange}
                  onChange={(e) => setIdentity(prev => ({ ...prev, audienceAgeRange: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select age range</option>
                  <option value="18-24">18-24 (Gen Z)</option>
                  <option value="25-34">25-34 (Millennials)</option>
                  <option value="35-44">35-44 (Gen X)</option>
                  <option value="45-54">45-54</option>
                  <option value="55+">55+</option>
                  <option value="all">All Ages</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Pain Points & Challenges</label>
                <Textarea
                  value={identity.audiencePainPoints}
                  onChange={(e) => setIdentity(prev => ({ ...prev, audiencePainPoints: e.target.value }))}
                  placeholder="What problems does your audience face that your brand solves?"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Visual Identity */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <Palette className="h-4 w-4 text-pink-600" />
                </div>
                Visual Identity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium text-slate-700">Primary Color</label>
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="color"
                      value={identity.primaryColor}
                      onChange={(e) => setIdentity(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="h-12 w-12 cursor-pointer rounded-lg border border-slate-200"
                    />
                    <Input
                      value={identity.primaryColor}
                      onChange={(e) => setIdentity(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-28 font-mono text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Secondary Color</label>
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="color"
                      value={identity.secondaryColor}
                      onChange={(e) => setIdentity(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="h-12 w-12 cursor-pointer rounded-lg border border-slate-200"
                    />
                    <Input
                      value={identity.secondaryColor}
                      onChange={(e) => setIdentity(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-28 font-mono text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Accent Color</label>
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="color"
                      value={identity.accentColor}
                      onChange={(e) => setIdentity(prev => ({ ...prev, accentColor: e.target.value }))}
                      className="h-12 w-12 cursor-pointer rounded-lg border border-slate-200"
                    />
                    <Input
                      value={identity.accentColor}
                      onChange={(e) => setIdentity(prev => ({ ...prev, accentColor: e.target.value }))}
                      className="w-28 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
              {/* Color Preview */}
              <div className="mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500 mb-3">Color Preview</p>
                <div className="flex gap-3">
                  <div className="flex-1 h-16 rounded-lg" style={{ backgroundColor: identity.primaryColor }} />
                  <div className="flex-1 h-16 rounded-lg" style={{ backgroundColor: identity.secondaryColor }} />
                  <div className="flex-1 h-16 rounded-lg" style={{ backgroundColor: identity.accentColor }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Content Strategy */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <FileText className="h-4 w-4 text-amber-600" />
                </div>
                Content Strategy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-3 block">
                  Content Pillars <span className="text-slate-400 font-normal">(Topics your brand covers)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_PILLAR_SUGGESTIONS.map(pillar => {
                    const isSelected = identity.contentPillars.includes(pillar);
                    return (
                      <button
                        key={pillar}
                        type="button"
                        onClick={() => {
                          setIdentity(prev => ({
                            ...prev,
                            contentPillars: isSelected
                              ? prev.contentPillars.filter(p => p !== pillar)
                              : [...prev.contentPillars, pillar]
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                          isSelected
                            ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                            : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
                        }`}
                      >
                        {pillar}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Key Messages</label>
                <Textarea
                  value={identity.keyMessages}
                  onChange={(e) => setIdentity(prev => ({ ...prev, keyMessages: e.target.value }))}
                  placeholder="What are the main points you always want to communicate? (One per line)"
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Topics to Avoid</label>
                <Input
                  value={identity.avoidTopics}
                  onChange={(e) => setIdentity(prev => ({ ...prev, avoidTopics: e.target.value }))}
                  placeholder="e.g., Politics, competitor bashing, controversial opinions"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Competitive Positioning */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Shield className="h-4 w-4 text-red-600" />
                </div>
                Competitive Positioning
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-slate-700">Main Competitors</label>
                <Input
                  value={identity.competitors}
                  onChange={(e) => setIdentity(prev => ({ ...prev, competitors: e.target.value }))}
                  placeholder="e.g., Competitor A, Competitor B"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Unique Value Proposition</label>
                <Input
                  value={identity.uniqueValue}
                  onChange={(e) => setIdentity(prev => ({ ...prev, uniqueValue: e.target.value }))}
                  placeholder="What makes you different from competitors?"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveIdentity} disabled={savingIdentity} size="lg" className="px-8">
              {savingIdentity ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Brand Identity
            </Button>
          </div>
        </div>
      )}

      {/* Knowledge Bases Tab */}
      {activeTab === 'kbs' && (
        <KBManager 
          brandId={brandId}
          campaignId={campaignId}
          onKBSelect={(kbId) => {
            setSelectedKBId(kbId);
            setActiveTab('assets');
            showToast({ type: 'info', message: 'Switched to Assets tab' });
          }}
        />
      )}

      {/* Brand Summary Card */}
      <Card className="mt-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Sparkles className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-medium text-slate-800">AI Context Summary</h3>
              <p className="text-sm text-slate-600 mt-1">
                {assets.length === 0 && !identity.brandName
                  ? 'Add assets and identity information to enhance AI-generated content.'
                  : `${assets.length} assets • ${knowledgeBases.length} KBs${identity.brandName ? ` • ${identity.brandName}` : ''}`
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, assetId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Asset"
        message="Are you sure you want to delete this asset? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={!!deleteConfirmModal.assetId && !!actionLoading[deleteConfirmModal.assetId]}
      />
    </div>
  );
}
