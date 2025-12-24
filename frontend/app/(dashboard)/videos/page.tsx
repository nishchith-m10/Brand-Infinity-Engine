"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MotionCard } from "@/components/ui/motion-card";
import { Play, MoreVertical, Download, Share2, Search, SlidersHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// Mock Data
const VIDEOS = [
  { id: 1, title: "Summer Launch Promo", duration: "0:45", status: "ready", thumbnail: "bg-lamaPurpleLight", author: "Marketing Team", date: "2h ago" },
  { id: 2, title: "Product Feature Walkthrough", duration: "2:15", status: "processing", thumbnail: "bg-lamaSkyLight", author: "Nishchith", date: "5h ago" },
  { id: 3, title: "Social Story - Variant A", duration: "0:15", status: "ready", thumbnail: "bg-lamaYellowLight", author: "Auto-Gen", date: "Yesterday" },
  { id: 4, title: "Q4 Townhall Recap", duration: "5:30", status: "ready", thumbnail: "bg-lamaSkyLight", author: "Internal Comms", date: "2 days ago" },
  { id: 5, title: "Customer Testimonial #42", duration: "1:20", status: "failed", thumbnail: "bg-red-50", author: "Nishchith", date: "3 days ago" },
  { id: 6, title: "Teaser Campaign v2", duration: "0:30", status: "ready", thumbnail: "bg-lamaPurpleLight", author: "Marketing Team", date: "1 week ago" },
];

const TABS = ["All", "Processing", "Ready", "Failed"];

export default function VideosPage() {
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Apply filters
  const filteredVideos = VIDEOS
    .filter(v => activeTab === "All" || v.status === activeTab.toLowerCase())
    .filter(v => 
      searchQuery === "" ||
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.author.toLowerCase().includes(searchQuery.toLowerCase())
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
                 <input type="text" placeholder="Search videos..." className="w-full bg-transparent outline-none text-slate-700" />
              </div>
              <div className="flex items-center gap-4 self-end">
                  <button 
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white transition-colors"
                    onClick={() => setShowFilterModal(true)}
                  >
                     <SlidersHorizontal size={18} />
                  </button>
                  <button 
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-lamaPurpleLight text-slate-600 hover:bg-lamaPurple hover:text-white transition-colors"
                    onClick={() => setShowAddModal(true)}
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

        {/* VIDEO GRID */}
        <motion.div 
            layout
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
            <AnimatePresence mode="popLayout">
                {filteredVideos.map((video) => (
                    <MotionCard
                        key={video.id}
                        variant="lift"
                        className="p-0 border border-slate-100 shadow-sm h-full flex flex-col bg-white"
                    >
                        {/* Thumbnail */}
                        <div className={`aspect-video w-full ${video.thumbnail} relative flex items-center justify-center rounded-t-2xl`}>
                            {video.status === "processing" ? (
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-lamaPurple border-t-transparent" />
                            ) : (
                                <Play className="h-10 w-10 text-lamaPurple/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100 fill-lamaPurple/50" />
                            )}
                            
                            <div className="absolute top-2 right-2">
                                <span className={cn(
                                    "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full tracking-wide",
                                    video.status === 'ready' ? "bg-emerald-100 text-emerald-600" :
                                    video.status === 'processing' ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"
                                )}>
                                    {video.status}
                                </span>
                            </div>
                            <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm text-slate-800 text-[10px] px-1.5 py-0.5 rounded-md font-medium shadow-sm">
                                {video.duration}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 flex flex-col flex-1 justify-between">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold text-slate-800 text-sm group-hover:text-lamaPurple transition-colors line-clamp-1">
                                        {video.title}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        {video.author} &bull; {video.date}
                                    </p>
                                </div>
                                <button className="text-slate-400 hover:text-slate-600">
                                    <MoreVertical size={16} />
                                </button>
                            </div>

                            {/* Actions */}
                            <div className="mt-4 flex items-center gap-2 pt-4 border-t border-slate-50">
                                <button className="flex-1 text-xs font-semibold py-1.5 rounded-md bg-lamaSkyLight text-lamaSky hover:bg-lamaSky hover:text-white transition-colors flex items-center justify-center gap-2">
                                    <Download size={14} /> 
                                    Download
                                </button>
                                <button className="p-1.5 rounded-md border border-slate-100 hover:bg-slate-50 text-slate-400">
                                    <Share2 size={14} />
                                </button>
                            </div>
                        </div>
                    </MotionCard>
                ))}
            </AnimatePresence>
        </motion.div>
    </div>
  );
}
