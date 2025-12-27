"use client";

import { useState } from 'react';
import { MotionRow } from "@/components/ui/motion-row";
import { Search, SlidersHorizontal, Plus, Edit, Trash2, X, Loader2, Megaphone, RotateCcw } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { ToastContainer } from "@/components/ui/toast-container";
import { useCampaigns } from "@/lib/hooks/use-campaigns";
import { useModal } from "@/lib/hooks/use-modal";
import { useToast } from "@/lib/hooks/use-toast";
import { useV1Campaigns } from "@/lib/hooks/use-api";

// Campaign type from API
interface Campaign {
  campaign_id?: string;
  id?: string;
  campaign_name: string;
  status: string;
  budget_limit_usd: number;
  current_cost_usd: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  metadata?: {
    target_demographic?: string;
    campaign_objective?: string;
    budget_tier?: string;
  };
}

// Mock Data fallback
const MOCK_CAMPAIGNS = [
  { campaign_id: '1', campaign_name: "Summer Launch 2024", status: "active", budget_limit_usd: 150, current_cost_usd: 45 },
  { campaign_id: '2', campaign_name: "Q3 Webinar Series", status: "draft", budget_limit_usd: 50, current_cost_usd: 0 },
  { campaign_id: '3', campaign_name: "Black Friday Pre-Sale", status: "completed", budget_limit_usd: 500, current_cost_usd: 485 },
];

export default function CampaignsPage() {
  // Real API data with fallback
  const { data: apiCampaigns, isLoading, error, mutate } = useV1Campaigns();
  
  // Hooks for local state management
  const {
    filters,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    pagination,
    nextPage,
    previousPage,
    canGoNext,
    canGoPrevious,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    isCreating,
    isUpdating,
    isDeleting,
  } = useCampaigns();

  const filterModal = useModal();
  const createModal = useModal();
  const editModal = useModal();
  const deleteModal = useModal();
  
  const { toasts, showToast, dismissToast } = useToast();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  // Generate a default brand_id - in production this would come from user's brand selection
  const defaultBrandId = typeof window !== 'undefined' ? crypto.randomUUID() : '00000000-0000-0000-0000-000000000001';
  const [createForm, setCreateForm] = useState({ name: '', brand_id: defaultBrandId, budget_tier: 'medium', custom_budget: '150' });
  const [editForm, setEditForm] = useState<{ name: string; status: string; budget_limit_usd: number }>({ name: '', status: 'draft', budget_limit_usd: 0 });
  
  // Use real API data only - no mock fallback
  const rawCampaigns: Campaign[] = apiCampaigns || [];
  
  // Filter campaigns
  const campaigns = rawCampaigns.filter(campaign => {
    if (searchQuery && !campaign.campaign_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filters.status && campaign.status !== filters.status) {
      return false;
    }
    return true;
  });

  // --- Handlers ---
  
  const handleFilter = () => {
    filterModal.open();
  };

  const handleApplyFilters = (newFilters: { status?: string; sortBy?: string }) => {
    updateFilters(newFilters as Parameters<typeof updateFilters>[0]);
    filterModal.close();
    showToast({ type: 'success', message: 'Filters applied successfully' });
  };

  const handleCreateCampaign = async () => {
    if (!createForm.name.trim()) {
      showToast({ type: 'error', message: 'Campaign name is required' });
      return;
    }

    try {
      // Call API to create campaign
      const response = await fetch('/api/v1/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: createForm.name,
          brand_id: createForm.brand_id,
          budget_tier: createForm.budget_tier,
          budget_limit_usd: createForm.budget_tier === 'custom' ? Number(createForm.custom_budget) : undefined,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create campaign';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || errorMessage;
          } else {
            errorMessage = await response.text();
          }
        } catch (e) {
          // Fallback to generic error if parsing fails
        }
        throw new Error(errorMessage);
      }
      
      showToast({ type: 'success', message: `Campaign "${createForm.name}" created successfully` });
      createModal.close();
      setCreateForm({ name: '', brand_id: crypto.randomUUID(), budget_tier: 'medium', custom_budget: '150' });
      mutate(); // Refresh campaigns list
    } catch (error: unknown) {
      showToast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to create campaign. Please try again.' 
      });
    }
  };

  const handleEditClick = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setEditForm({ name: campaign.campaign_name, status: campaign.status, budget_limit_usd: campaign.budget_limit_usd });
    editModal.open();
  };

  const handleUpdateCampaign = async () => {
    if (!selectedCampaign) return;

    try {
      const campaignId = selectedCampaign.campaign_id || selectedCampaign.id;
      if (!campaignId) throw new Error('Missing campaign ID');
      
      const response = await fetch(`/api/v1/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: editForm.name,
          status: editForm.status,
          budget_limit_usd: editForm.budget_limit_usd,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update campaign';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || errorMessage;
          } else {
            errorMessage = await response.text();
          }
        } catch (e) {
          // Fallback to generic error if parsing fails
        }
        throw new Error(errorMessage);
      }
      
      showToast({ type: 'success', message: 'Campaign updated successfully' });
      editModal.close();
      setSelectedCampaign(null);
      mutate(); // Refresh campaigns list
    } catch (error: unknown) {
      showToast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to update campaign. Please try again.'
      });
    }
  };

  const handleDeleteClick = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    deleteModal.open();
  };

  const handleConfirmDelete = async () => {
    if (!selectedCampaign) return;

    try {
      const campaignId = selectedCampaign.campaign_id || selectedCampaign.id;
      if (!campaignId) throw new Error('Missing campaign ID');

      const response = await fetch(`/api/v1/campaigns/${campaignId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to delete campaign');
      }
      
      // Show appropriate message based on action taken
      const message = selectedCampaign.status === 'archived'
        ? `Campaign "${selectedCampaign.campaign_name}" scheduled for permanent deletion in 7 days`
        : `Campaign "${selectedCampaign.campaign_name}" archived successfully`;
      
      showToast({ type: 'success', message });
      deleteModal.close();
      setSelectedCampaign(null);
      mutate(); // Refresh campaigns list
    } catch (error: unknown) {
      showToast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to delete campaign. Please try again.' 
      });
    }
  };

  const handleRestore = async (campaign: Campaign) => {
    try {
      const campaignId = campaign.campaign_id || campaign.id;
      if (!campaignId) throw new Error('Missing campaign ID');

      const response = await fetch(`/api/v1/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to restore campaign');
      }

      showToast({ 
        type: 'success', 
        message: data.message || `Campaign "${campaign.campaign_name}" restored successfully` 
      });
      mutate(); // Refresh campaigns list
    } catch (error: unknown) {
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to restore campaign. Please try again.'
      });
    }
  };

  return (
    <div className="bg-white p-4 rounded-3xl m-4 flex-1 shadow-sm border border-slate-100/50">
       
       {/* TOP SECTION */}
       <div className="flex items-center justify-between mb-8">
          <h1 className="hidden md:block text-2xl font-bold text-slate-800">Campaigns</h1>
          <div className="flex items-center gap-4">
                 <button 
                   onClick={handleFilter}
                   className="w-9 h-9 flex items-center justify-center rounded-full bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white transition-colors relative"
                 >
                    <SlidersHorizontal size={18} />
                    {hasActiveFilters && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-lamaPurple rounded-full border-2 border-white"></span>
                    )}
                 </button>
                 <button 
                   onClick={createModal.open}
                   className="w-9 h-9 flex items-center justify-center rounded-full bg-lamaPurpleLight text-slate-600 hover:bg-lamaPurple hover:text-white transition-colors"
                   title="Add new campaign"
                 >
                    <Plus size={18} />
                 </button>
          </div>
       </div>

       {/* Active Filters Display */}
       {hasActiveFilters && (
         <div className="mb-4 flex items-center gap-2">
           <span className="text-sm text-slate-600">Active filters:</span>
           {filters.status && (
             <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-lamaPurpleLight text-xs font-medium">
               Status: {filters.status}
               <button onClick={() => updateFilters({ status: undefined })} className="hover:text-lamaPurple">
                 <X size={12} />
               </button>
             </span>
           )}
           <button onClick={clearFilters} className="text-xs text-lamaPurple hover:underline">
             Clear all
           </button>
         </div>
       )}

       {/* TABLE WRAPPER */}
       <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[800px] border-separate border-spacing-y-3">
             <thead>
                <tr className="text-left text-slate-400 text-xs font-semibold uppercase tracking-wider">
                   <th className="pb-4 pl-4">Name</th>
                   <th className="pb-4">Budget</th>
                   <th className="pb-4">Status</th>
                   <th className="pb-4">Spent</th>
                   <th className="pb-4 pr-4 text-right">Actions</th>
                </tr>
             </thead>
             <tbody>
                <AnimatePresence>
                   {campaigns.length === 0 ? (
                     <tr>
                       <td colSpan={5} className="py-16 text-center">
                         <div className="flex flex-col items-center gap-4">
                           <div className="w-16 h-16 rounded-full bg-lamaSkyLight flex items-center justify-center">
                             <Megaphone size={28} className="text-lamaSky" />
                           </div>
                           <div>
                             <p className="text-slate-700 font-semibold">No campaigns yet</p>
                             <p className="text-slate-500 text-sm mt-1">Create your first campaign to get started</p>
                           </div>
                           <button
                             onClick={() => createModal.open()}
                             className="px-4 py-2 bg-lamaPurple text-white rounded-lg hover:bg-lamaPurple/90 transition-colors flex items-center gap-2"
                           >
                             <Plus size={16} />
                             Create Campaign
                           </button>
                         </div>
                       </td>
                     </tr>
                   ) : campaigns.map((campaign, index) => {
                      const campaignId = campaign.campaign_id || campaign.id || '';
                      return (
                      <MotionRow key={campaignId || index} index={index}>
                         <td className="py-2 pl-4 rounded-l-xl bg-slate-50 border-y border-l border-slate-100">
                            <div className="flex flex-col">
                               <span className="font-semibold text-slate-800 text-sm">{campaign.campaign_name}</span>
                               <span className="text-[10px] text-slate-400">ID: {campaignId.slice(0, 8)}...</span>
                            </div>
                         </td>
                         <td className="py-2 bg-slate-50 border-y border-slate-100">
                            <span className="text-sm text-slate-600">${campaign.budget_limit_usd}</span>
                         </td>
                         <td className="py-2 bg-slate-50 border-y border-slate-100">
                             <div className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase
                                ${campaign.status === "active" || campaign.status === "strategizing" || campaign.status === "writing" || campaign.status === "producing" ? "bg-lamaPurpleLight text-lamaPurple" : ""}
                                ${campaign.status === "completed" || campaign.status === "published" ? "bg-emerald-100 text-emerald-600" : ""}
                                ${campaign.status === "draft" ? "bg-lamaYellowLight text-amber-600" : ""}
                                ${campaign.status === "paused" || campaign.status === "archived" ? "bg-slate-200 text-slate-600" : ""}
                                ${campaign.status === "pending_deletion" ? "bg-red-100 text-red-600" : ""}
                                ${campaign.status === "failed" ? "bg-red-100 text-red-600" : ""}
                             `}>
                                {campaign.status === "pending_deletion" ? "Deleting in 7 days" : campaign.status}
                             </div>
                         </td>
                         <td className="py-2 bg-slate-50 border-y border-slate-100">
                            <div className="text-sm text-slate-600">
                               ${campaign.current_cost_usd?.toFixed(2) || '0.00'}
                            </div>
                         </td>
                         <td className="py-2 pr-4 rounded-r-xl bg-slate-50 border-y border-r border-slate-100 text-right">
                             <div className="flex items-center justify-end gap-2">
                                {/* Restore button - for pending_deletion AND archived */}
                                {(campaign.status === 'pending_deletion' || campaign.status === 'archived') && (
                                  <button 
                                    onClick={() => handleRestore(campaign)}
                                    className="p-2 hover:bg-emerald-50 rounded-full text-emerald-500 hover:text-emerald-600 transition-colors"
                                    title={campaign.status === 'pending_deletion' ? "Restore from deletion" : "Unarchive campaign"}
                                  >
                                     <RotateCcw size={16} />
                                  </button>
                                )}
                                {/* Edit button - disabled for archived/pending_deletion */}
                                <button 
                                  onClick={() => handleEditClick(campaign)}
                                  className={`p-2 rounded-full transition-colors ${
                                    campaign.status === 'archived' || campaign.status === 'pending_deletion'
                                      ? 'text-slate-300 cursor-not-allowed'
                                      : 'text-slate-400 hover:bg-lamaSkyLight hover:text-lamaSky'
                                  }`}
                                  title={campaign.status === 'archived' || campaign.status === 'pending_deletion' 
                                    ? 'Cannot edit archived campaigns' 
                                    : 'Edit campaign'}
                                  disabled={isUpdating || campaign.status === 'archived' || campaign.status === 'pending_deletion'}
                                >
                                   <Edit size={16} />
                                </button>
                                {/* Delete button - hide for pending_deletion (they need to restore or wait) */}
                                {campaign.status !== 'pending_deletion' && (
                                  <button 
                                    onClick={() => handleDeleteClick(campaign)}
                                    className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                    title={campaign.status === 'archived' 
                                      ? 'Schedule permanent deletion (7-day grace period)' 
                                      : 'Archive campaign'}
                                    disabled={isDeleting}
                                  >
                                     <Trash2 size={16} />
                                  </button>
                                )}
                             </div>
                          </td>
                      </MotionRow>
                   ); })}
                </AnimatePresence>
             </tbody>
          </table>
       </div>
       
       {/* PAGINATION */}
       <div className="flex justify-between items-center mt-8 text-xs text-slate-500">
           <span>Showing {campaigns.length} campaigns</span>
           <div className="flex gap-2">
               <button 
                 onClick={previousPage}
                 disabled={!canGoPrevious}
                 className="px-3 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 Prev
               </button>
               <button 
                 onClick={nextPage}
                 disabled={!canGoNext}
                 className="px-3 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 Next
               </button>
           </div>
       </div>

       {/* Filter Modal */}
       <Modal 
         isOpen={filterModal.isOpen} 
         onClose={filterModal.close} 
         title="Filter Campaigns"
         size="sm"
       >
         <div className="space-y-4">
           <Select
             label="Status"
             value={filters.status || ''}
             onChange={(e) => handleApplyFilters({ status: e.target.value || undefined })}
             options={[
               { value: '', label: 'All statuses' },
               { value: 'draft', label: 'Draft' },
               { value: 'active', label: 'Active' },
               { value: 'completed', label: 'Completed' },
               { value: 'paused', label: 'Paused' },
             ]}
           />
           <div className="flex justify-end gap-3 pt-4">
             <Button variant="outline" onClick={filterModal.close}>Cancel</Button>
             <Button onClick={() => filterModal.close()}>Apply</Button>
           </div>
         </div>
       </Modal>

       {/* Create Campaign Modal */}
       <Modal 
         isOpen={createModal.isOpen} 
         onClose={createModal.close} 
         title="Create New Campaign"
         size="md"
       >
         <div className="space-y-4">
            <Input
              label="Campaign Name"
              placeholder="Enter campaign name..."
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              autoFocus
            />
            <Select
              label="Budget Tier"
              value={createForm.budget_tier}
              onChange={(e) => setCreateForm({ ...createForm, budget_tier: e.target.value })}
              options={[
                { value: 'low', label: 'Low ($50)' },
                { value: 'medium', label: 'Medium ($150)' },
                { value: 'high', label: 'High ($500)' },
                { value: 'premium', label: 'Premium ($2,000)' },
                { value: 'custom', label: 'Custom Amount' },
              ]}
            />
            {createForm.budget_tier === 'custom' && (
              <Input
                label="Custom Budget ($)"
                type="number"
                placeholder="Enter amount"
                value={createForm.custom_budget}
                onChange={(e) => setCreateForm({ ...createForm, custom_budget: e.target.value })}
              />
            )}
           <div className="flex justify-end gap-3 pt-4">
             <Button variant="outline" onClick={createModal.close} disabled={isCreating}>
               Cancel
             </Button>
             <Button onClick={handleCreateCampaign} isLoading={isCreating}>
               Create Campaign
             </Button>
           </div>
         </div>
       </Modal>

       {/* Edit Campaign Modal */}
       <Modal 
         isOpen={editModal.isOpen} 
         onClose={editModal.close} 
         title="Edit Campaign"
         size="md"
       >
         <div className="space-y-4">
            <Input
              label="Campaign Name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
            <Input
              label="Budget Limit ($)"
              type="number"
              value={editForm.budget_limit_usd.toString()}
              onChange={(e) => setEditForm({ ...editForm, budget_limit_usd: parseFloat(e.target.value) || 0 })}
            />
           <Select
             label="Status"
             value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value as typeof editForm.status })}
             options={[
               { value: 'draft', label: 'Draft' },
               { value: 'active', label: 'Active' },
               { value: 'completed', label: 'Completed' },
               { value: 'paused', label: 'Paused' },
             ]}
           />
           <div className="flex justify-end gap-3 pt-4">
             <Button variant="outline" onClick={editModal.close} disabled={isUpdating}>
               Cancel
             </Button>
             <Button onClick={handleUpdateCampaign} isLoading={isUpdating}>
               Save Changes
             </Button>
           </div>
         </div>
       </Modal>

       {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={deleteModal.close}
          onConfirm={handleConfirmDelete}
          title={selectedCampaign?.status === 'archived' ? 'Permanently Delete Campaign' : 'Archive Campaign'}
          message={selectedCampaign?.status === 'archived' 
            ? `Are you sure you want to permanently delete "${selectedCampaign?.campaign_name}"? The campaign will be deleted after 7 days. You can restore it during this period.`
            : `Are you sure you want to archive "${selectedCampaign?.campaign_name}"? You can restore it later from the archived campaigns.`}
          confirmText={selectedCampaign?.status === 'archived' ? 'Schedule Deletion' : 'Archive Campaign'}
          variant="danger"
          isLoading={isDeleting}
        />

       {/* Toast Notifications */}
       <ToastContainer toasts={toasts} onDismiss={dismissToast} />

    </div>
  );
}
