"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MotionCard } from "@/components/ui/motion-card";
import { Play, MoreVertical, Download, Share2, Search, SlidersHorizontal, Plus, Loader2, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { useV1Videos } from "@/lib/hooks/use-api";
import { useToast } from "@/lib/hooks/use-toast";
import { useCampaignProgress } from "@/lib/hooks/use-campaign-progress";
import { LockedState } from "@/components/LockedState";
import { EmptyState } from "@/components/ui/empty-state";
import { CustomSelect } from "@/components/ui/custom-select";


// Video type from API
interface GenerationJob {
  job_id: string;
  campaign_id: string;
  status: string;
  provider: string;
  result_url?: string;
  created_at: string;
  updated_at: string;
}

// Mock Data fallback
const MOCK_VIDEOS = [
  { job_id: '1', campaign_id: 'camp_1', status: "completed", provider: "Sora", created_at: "2h ago" },
  { job_id: '2', campaign_id: 'camp_1', status: "processing", provider: "Runway", created_at: "5h ago" },
  { job_id: '3', campaign_id: 'camp_2', status: "completed", provider: "Pika", created_at: "Yesterday" },
];

const TABS = ["All", "Processing", "Completed", "Failed"];

export default function VideosPage() {
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterProvider, setFilterProvider] = useState("");
  const [filterDuration, setFilterDuration] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterQuality, setFilterQuality] = useState("");
  const { showToast: toast } = useToast();
  
  // Check prerequisites
  const { canAccessVideos, steps, isLoading: progressLoading } = useCampaignProgress();
  
  // Real API data only - MUST be called before conditional returns
  const { data: apiVideos, isLoading } = useV1Videos();
  
  // Show locked state if prerequisites not met - AFTER all hooks
  if (!progressLoading && !canAccessVideos) {
    return (
      <LockedState
        title="Videos is Locked"
        description="Approve content first to unlock video viewing"
        steps={[
          { label: 'Generate content', completed: steps?.contentGenerated || false },
          { label: 'Approve content in Content Review', completed: steps?.contentApproved || false },
        ]}
        nextAction={{ label: 'Go to Content Review', href: '/review' }}
        explanation="Videos are generated after you approve scripts in the Content Review."
      />
    );
  }
  
  // Use API data directly
  const rawVideos: GenerationJob[] = apiVideos || [];

  // Apply filters
  const filteredVideos = rawVideos
    .filter(v => activeTab === "All" || v.status === activeTab.toLowerCase())
    .filter(v => 
      searchQuery === "" ||
      v.provider?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.campaign_id?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="flex flex-col gap-6 p-4">
        
        {/* TOP SECTION */}
        <div className="flex items-center justify-between">
           <h1 className="hidden md:block text-2xl font-bold text-slate-800">Videos</h1>
           <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
              {/* SEARCH */}
              <div className="flex items-center gap-2 text-xs rounded-full ring-[1.5px] ring-slate-200 px-3 py-2 w-full md:w-[240px] bg-white">
                 <Search size={16} className="text-slate-500" />
                 <input 
                   type="text" 
                   placeholder="Search videos..." 
                   className="w-full bg-transparent outline-none text-slate-700" 
                   autoComplete="off" 
                   data-form-type="other"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                 />
              </div>
              <div className="flex items-center gap-4 self-end">
                  <button 
                    className={cn(
                      "w-9 h-9 flex items-center justify-center rounded-full transition-colors",
                      showFilters 
                        ? "bg-amber-500 text-white" 
                        : "bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white"
                    )}
                    title="Filter videos"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                     <SlidersHorizontal size={18} />
                  </button>
                  <button 
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-lamaPurpleLight text-slate-600 hover:bg-lamaPurple hover:text-white transition-colors"
                    title="Generate new video"
                    onClick={() => {
                      // Navigate to Content Review to approve scripts
                      window.location.href = '/review';
                    }}
                  >
                     <Plus size={18} />
                  </button>
              </div>
           </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-2">
           {TABS.map((tab) => (
               <button
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={cn(
                       "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                       activeTab === tab 
                         ? "bg-lamaSky text-slate-800 shadow-sm" 
                         : "bg-white text-slate-500 hover:bg-slate-50"
                   )}
               >
                   {tab}
               </button>
           ))}
        </div>

        {/* FILTER PANEL */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-xl border border-slate-200 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-slate-700">Filters</h3>
              <button
                onClick={() => {
                  setActiveTab("All");
                  setSearchQuery("");
                  setFilterProvider("");
                  setFilterDuration("");
                  setFilterDate("");
                  setFilterQuality("");
                }}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-slate-600 mb-2 block font-medium">Provider</label>
                <CustomSelect
                  value={filterProvider}
                  onChange={setFilterProvider}
                  placeholder="All Providers"
                  options={[
                    { value: '', label: 'All Providers' },
                    { value: 'sora', label: 'Sora' },
                    { value: 'runway', label: 'Runway' },
                    { value: 'pika', label: 'Pika' },
                    { value: 'veo', label: 'Veo' },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-2 block font-medium">Duration</label>
                <CustomSelect
                  value={filterDuration}
                  onChange={setFilterDuration}
                  placeholder="Any Duration"
                  options={[
                    { value: '', label: 'Any Duration' },
                    { value: '0-15', label: '0-15s' },
                    { value: '15-30', label: '15-30s' },
                    { value: '30-60', label: '30-60s' },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-2 block font-medium">Date</label>
                <CustomSelect
                  value={filterDate}
                  onChange={setFilterDate}
                  placeholder="All Time"
                  options={[
                    { value: '', label: 'All Time' },
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'This Week' },
                    { value: 'month', label: 'This Month' },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-2 block font-medium">Quality</label>
                <CustomSelect
                  value={filterQuality}
                  onChange={setFilterQuality}
                  placeholder="All Quality"
                  options={[
                    { value: '', label: 'All Quality' },
                    { value: 'high', label: 'High' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'low', label: 'Low' },
                  ]}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* VIDEO GRID */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-lamaPurple" />
          </div>
        ) : filteredVideos.length === 0 ? (
          <EmptyState
            icon={<Video className="h-8 w-8" />}
            title={searchQuery || activeTab !== "All" ? "No videos found" : "No videos yet"}
            description={
              searchQuery || activeTab !== "All"
                ? "Try adjusting your filters or search query"
                : "Videos will appear here once they're generated from approved scripts"
            }
            action={{
              label: "Go to Content Review",
              onClick: () => window.location.href = '/review'
            }}
          />
        ) : (
          <motion.div 
              layout
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <AnimatePresence mode="popLayout">
                {filteredVideos.map((video) => (
                    <MotionCard
                        key={video.job_id}
                        variant="lift"
                        className="p-0 border border-slate-100 shadow-sm h-full flex flex-col bg-white"
                    >
                        {/* Thumbnail */}
                        <div className={`aspect-video w-full bg-gradient-to-br from-lamaPurpleLight to-lamaSkyLight relative flex items-center justify-center rounded-t-2xl`}>
                            {video.status === "processing" || video.status === "pending" ? (
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-lamaPurple border-t-transparent" />
                            ) : video.status === "completed" ? (
                                <Play className="h-10 w-10 text-lamaPurple/50 fill-lamaPurple/50" />
                            ) : (
                                <div className="text-red-500 text-xs">Failed</div>
                            )}
                            
                            <div className="absolute top-2 right-2">
                                <span className={cn(
                                    "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full tracking-wide",
                                    video.status === 'completed' ? "bg-emerald-100 text-emerald-600" :
                                    video.status === 'processing' || video.status === 'pending' ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"
                                )}>
                                    {video.status}
                                </span>
                            </div>
                            <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm text-slate-800 text-[10px] px-1.5 py-0.5 rounded-md font-medium shadow-sm">
                                {video.provider || 'Unknown'}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 flex flex-col flex-1 justify-between">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold text-slate-800 text-sm group-hover:text-lamaPurple transition-colors line-clamp-1">
                                        Job {video.job_id?.slice(0, 8)}...
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Campaign: {video.campaign_id?.slice(0, 8)}...
                                    </p>
                                </div>
                                <button className="text-slate-400 hover:text-slate-600">
                                    <MoreVertical size={16} />
                                </button>
                            </div>

                            {/* Actions */}
                            <div className="mt-4 flex items-center gap-2 pt-4 border-t border-slate-50">
                                <button 
                                  className="flex-1 text-xs font-semibold py-1.5 rounded-md bg-lamaSkyLight text-lamaSky hover:bg-lamaSky hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                  disabled={video.status !== 'completed'}
                                  onClick={() => {
                                      if (video.result_url) {
                                          window.open(video.result_url, '_blank');
                                      } else {
                                          toast({ type: 'error', message: "Video file not available" });
                                      }
                                  }}
                                >
                                    <Download size={14} /> 
                                    Download
                                </button>
                                <button 
                                    className="p-1.5 rounded-md border border-slate-100 hover:bg-slate-50 text-slate-400 disabled:opacity-50"
                                    disabled={video.status !== 'completed'}
                                    onClick={() => {
                                        if (video.result_url) {
                                            navigator.clipboard.writeText(video.result_url);
                                            toast({ type: 'success', message: "Link copied to clipboard" });
                                        } else {
                                            toast({ type: 'error', message: "Link not available" });
                                        }
                                    }}
                                >
                                    <Share2 size={14} />
                                </button>
                            </div>
                        </div>
                    </MotionCard>
                ))}
            </AnimatePresence>
          </motion.div>
        )}
    </div>
  );
}
