"use client";

import { useState } from 'react';
import { MotionRow } from "@/components/ui/motion-row";
import { Search, SlidersHorizontal, Plus, Edit, Trash2, X } from "lucide-react";
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
import { useCampaigns as useCampaignsData } from "@/lib/hooks/use-api";

// Mock Data (will be replaced by actual API data)
const MOCK_CAMPAIGNS = [
  { id: '1', name: "Summer Launch 2024", type: "Social Media", status: "active" as const, progress: 65, reach: "12K", engagement: "4.5%" },
  { id: '2', name: "Q3 Webinar Series", type: "Webinar", status: "draft" as const, progress: 20, reach: "-", engagement: "-" },
  { id: '3', name: "Black Friday Pre-Sale", type: "Email + Ads", status: "completed" as const, progress: 100, reach: "85K", engagement: "Pending" },
  { id: '4', name: "Influencer Outreach", type: "Outreach", status: "paused" as const, progress: 75, reach: "45K", engagement: "12%" },
  { id: '5', name: "Product Hunt Launch", type: "Social Media", status: "active" as const, progress: 80, reach: "30K", engagement: "8.2%" },
];

export default function CampaignsPage() {
  // Hooks
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
  const [selectedCampaign, setSelectedCampaign] = useState<typeof MOCK_CAMPAIGNS[0] | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', brand_id: 'brand_001' });
  const [editForm, setEditForm] = useState<{ name: string; status: 'draft' | 'active' | 'completed' | 'paused' }>({ name: '', status: 'draft' });
  
  // In production, use: const { data: campaigns, isLoading } = useCampaignsData(filters);
  // For now, filter mock data
  const campaigns = MOCK_CAMPAIGNS.filter(campaign => {
    if (searchQuery && !campaign.name.toLowerCase().includes(searchQuery.toLowerCase())) {
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
      await createCampaign(createForm);
      showToast({ type: 'success', message: `Campaign "${createForm.name}" created successfully` });
      createModal.close();
      setCreateForm({ name: '', brand_id: 'brand_001' });
    } catch (error: unknown) {
      showToast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to create campaign. Please try again.' 
      });
    }
  };

  const handleEditClick = (campaign: typeof MOCK_CAMPAIGNS[0]) => {
    setSelectedCampaign(campaign);
    setEditForm({ name: campaign.name, status: campaign.status as "draft" });
    editModal.open();
  };

  const handleUpdateCampaign = async () => {
    if (!selectedCampaign) return;

    try {
      await updateCampaign({
        campaignId: selectedCampaign.id,
        data: editForm,
      });
      showToast({ type: 'success', message: 'Campaign updated successfully' });
      editModal.close();
      setSelectedCampaign(null);
    } catch (error: unknown) {
      showToast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to update campaign. Please try again.'
      });
    }
  };

  const handleDeleteClick = (campaign: typeof MOCK_CAMPAIGNS[0]) => {
    setSelectedCampaign(campaign);
    deleteModal.open();
  };

  const handleConfirmDelete = async () => {
    if (!selectedCampaign) return;

    try {
      await deleteCampaign(selectedCampaign.id);
      showToast({ type: 'success', message: `Campaign "${selectedCampaign.name}" deleted successfully` });
      deleteModal.close();
      setSelectedCampaign(null);
    } catch (error: unknown) {
      showToast({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to delete campaign. Please try again.' 
      });
    }
  };

  return (
    <div className="bg-white p-4 rounded-3xl m-4 flex-1 shadow-sm border border-slate-100/50">
       
       {/* TOP SECTION */}
       <div className="flex items-center justify-between mb-8">
          <h1 className="hidden md:block text-2xl font-bold text-slate-800">Campaigns</h1>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
             {/* SEARCH */}
             <div className="flex items-center gap-2 text-xs rounded-full ring-[1.5px] ring-slate-200 px-3 py-2 w-full md:w-[240px] bg-white">
                <Search size={16} className="text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search campaigns..." 
                  className="w-full bg-transparent outline-none text-slate-700" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
             </div>
             <div className="flex items-center gap-4 self-end">
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
                   <th className="pb-4">Type</th>
                   <th className="pb-4">Status</th>
                   <th className="pb-4">Progress</th>
                   <th className="pb-4">Metrics</th>
                   <th className="pb-4 pr-4 text-right">Actions</th>
                </tr>
             </thead>
             <tbody>
                <AnimatePresence>
                   {campaigns.map((campaign, index) => (
                      <MotionRow key={campaign.id} index={index}>
                         <td className="py-2 pl-4 rounded-l-xl bg-slate-50 border-y border-l border-slate-100">
                            <div className="flex flex-col">
                               <span className="font-semibold text-slate-800 text-sm">{campaign.name}</span>
                               <span className="text-[10px] text-slate-400">ID: {campaign.id}</span>
                            </div>
                         </td>
                         <td className="py-2 bg-slate-50 border-y border-slate-100">
                            <span className="text-sm text-slate-600">{campaign.type}</span>
                         </td>
                         <td className="py-2 bg-slate-50 border-y border-slate-100">
                             <div className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase
                                ${campaign.status === "active" ? "bg-lamaPurpleLight text-lamaPurple" : ""}
                                ${campaign.status === "completed" ? "bg-emerald-100 text-emerald-600" : ""}
                                ${campaign.status === "draft" ? "bg-lamaYellowLight text-amber-600" : ""}
                                ${campaign.status === "paused" ? "bg-slate-200 text-slate-600" : ""}
                             `}>
                                {campaign.status}
                             </div>
                         </td>
                         <td className="py-2 bg-slate-50 border-y border-slate-100">
                            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                               <div 
                                  className="h-full bg-lamaSky rounded-full" 
                                  style={{ width: `${campaign.progress}%` }} 
                               />
                            </div>
                         </td>
                         <td className="py-2 bg-slate-50 border-y border-slate-100">
                            <div className="text-xs text-slate-500">
                               <span className="font-medium text-slate-800">{campaign.reach}</span> Reach
                               <span className="mx-1">&bull;</span>
                               <span className="font-medium text-slate-800">{campaign.engagement}</span> Eng.
                            </div>
                         </td>
                         <td className="py-2 pr-4 rounded-r-xl bg-slate-50 border-y border-r border-slate-100 text-right">
                            <div className="flex items-center justify-end gap-2">
                               <button 
                                 onClick={() => handleEditClick(campaign)}
                                 className="p-2 hover:bg-lamaSkyLight rounded-full text-slate-400 hover:text-lamaSky transition-colors"
                                 title="Edit campaign"
                                 disabled={isUpdating}
                               >
                                  <Edit size={16} />
                               </button>
                               <button 
                                 onClick={() => handleDeleteClick(campaign)}
                                 className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                 title="Delete campaign"
                                 disabled={isDeleting}
                               >
                                  <Trash2 size={16} />
                               </button>
                            </div>
                         </td>
                      </MotionRow>
                   ))}
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
         title="Delete Campaign"
         message={`Are you sure you want to delete "${selectedCampaign?.name}"? This action cannot be undone.`}
         confirmText="Delete Campaign"
         variant="danger"
         isLoading={isDeleting}
       />

       {/* Toast Notifications */}
       <ToastContainer toasts={toasts} onDismiss={dismissToast} />

    </div>
  );
}
