"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { role } from "@/lib/data";
import { useAuth } from "@/lib/auth/auth-provider";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Search, Settings, LogOut, X } from "lucide-react";
import { CampaignSelector } from "@/components/CampaignSelector";
import { useCampaignStore, type Campaign } from "@/lib/hooks/use-current-campaign";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useV1Campaigns } from "@/lib/hooks/use-api";

export default function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const clearCampaign = useCampaignStore((state) => state.clearCampaign);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  
  
  // Fetch campaigns for search
  const { data: campaigns } = useV1Campaigns();

  // Debounced search handler
  // Debounce the raw query so we don't filter on every keystroke. Also set
  // dropdown visibility from this async callback to avoid synchronous
  // setState inside a top-level effect body.
  useEffect(() => {
    const id = setTimeout(() => {
      const dq = searchQuery.trim();
      setDebouncedQuery(dq);

      if (!dq) {
        setShowSearchResults(false);
        return;
      }

      const q = dq.toLowerCase();
      const resultsExist = (campaigns ?? []).some((campaign: Campaign) =>
        campaign.campaign_name?.toLowerCase().includes(q) ||
        campaign.status?.toLowerCase().includes(q)
      );

      setShowSearchResults(resultsExist);
    }, 300);

    return () => clearTimeout(id);
  }, [searchQuery, campaigns]);

  // Compute search results from the debounced query
  type SearchCampaign = Campaign & { campaign_id?: string };
  const searchResults = useMemo<SearchCampaign[]>(() => {
    if (!debouncedQuery) return [];
    const q = debouncedQuery.toLowerCase();
    return (campaigns ?? []).filter((campaign: Campaign) =>
      campaign.campaign_name?.toLowerCase().includes(q) ||
      campaign.status?.toLowerCase().includes(q)
    ) as SearchCampaign[];
  }, [debouncedQuery, campaigns]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Position the search results dropdown to match the input width & left offset
  useEffect(() => {
    function updateDropdownPosition() {
      if (!inputRef.current) return;
      const inputRect = inputRef.current.getBoundingClientRect();
      // Compute left relative to the outer search container (searchRef) so the dropdown aligns
      // with the input even if there are nested wrappers or layout shifts.
      const containerEl = searchRef.current as HTMLElement | null;
      if (containerEl) {
        const containerRect = containerEl.getBoundingClientRect();
        const left = Math.max(0, Math.round(inputRect.left - containerRect.left));
        setDropdownStyle({ left: `${left}px`, width: `${Math.round(inputRect.width)}px` });
      } else {
        setDropdownStyle({ left: `0px`, width: `${Math.round(inputRect.width)}px` });
      }
    }

    if (showSearchResults) updateDropdownPosition();

    window.addEventListener('resize', updateDropdownPosition);
    return () => window.removeEventListener('resize', updateDropdownPosition);
  }, [showSearchResults, searchQuery]);

  return (
    <div className="flex items-center justify-between p-4">
      {/* CAMPAIGN SELECTOR */}
      <div className="flex items-center gap-4">
        <CampaignSelector />
      </div>

      {/* ICONS AND USER */}
      <div className="flex items-center gap-6 justify-end w-full md:w-auto">
        {/* SEARCH */}
        <div className="relative" ref={searchRef}>
          <div className="relative inline-block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search campaigns"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 'calc(12rem * 1.05)' }}
              className="app-search-input pl-9 pr-9 py-2 text-sm bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-400 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-lamaPurple"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowSearchResults(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Search Results Dropdown */}
          {showSearchResults && (
            <div className="absolute top-full mt-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50 search-results-dropdown" style={dropdownStyle}>
              {searchResults.length > 0 ? (
                <div className="p-2">
                  {searchResults.map((result: SearchCampaign) => (
                    <button
                      key={result.id ?? result.campaign_id}
                      onClick={() => {
                        const id = result.id ?? result.campaign_id;
                        router.push(id ? `/campaigns/${id}` : '/campaigns');
                        setShowSearchResults(false);
                        setSearchQuery("");
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="font-medium text-sm dark:text-slate-200" style={{ color: '#0f172a' }}>{result.campaign_name}</div>
                      <div className="text-xs capitalize dark:text-slate-400" style={{ color: '#475569' }}>{result.status}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-sm text-center dark:text-slate-400" style={{ color: '#64748b' }}>
                  No campaigns found
                </div>
              )}
            </div>
          )}
        </div>


        {/* USER PROFILE */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-800">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Not signed in'}</span>
                <span className="text-[10px] text-slate-500 text-right capitalize">{role}</span>
              </div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-9 h-9 rounded-full bg-linear-to-br from-lamaPurple to-lamaPurple relative overflow-hidden ring-2 ring-white shadow-sm flex items-center justify-center"
              >
                {user?.user_metadata?.avatar_url ? (
                  <Image 
                    src={user.user_metadata.avatar_url}
                    alt="Avatar" 
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-sm">
                    {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                )}
              </motion.div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-100" />
            <div className="px-1 py-1">
              <ThemeToggle />
            </div>
            <DropdownMenuSeparator className="bg-gray-100" />
            <DropdownMenuItem asChild>
              <Link href="/account" className="cursor-pointer w-full flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                <span>Manage Account</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-100" />
            <DropdownMenuItem 
              className="text-red-600 focus:bg-red-50 focus:text-red-600 cursor-pointer" 
              onClick={async () => { 
                clearCampaign(); // Clear local storage campaign
                await signOut(); 
                router.push('/login'); 
              }}
            >
               <LogOut className="mr-2 h-4 w-4" />
               <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
