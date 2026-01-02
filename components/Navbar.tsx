"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { role } from "@/lib/data";
import { useAuth } from "@/lib/auth/auth-provider";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Search, MessageSquare, Megaphone, Bell, Settings, LogOut, X } from "lucide-react";
import { CampaignSelector } from "@/components/CampaignSelector";
import { useCampaignStore } from "@/lib/hooks/use-current-campaign";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useV1Campaigns } from "@/lib/hooks/use-api";
import { Tooltip } from "@/components/ui/tooltip";

export default function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const clearCampaign = useCampaignStore((state) => state.clearCampaign);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Notifications state
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Fetch campaigns for search
  const { data: campaigns } = useV1Campaigns();

  // Debounced search handler
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      const query = searchQuery.toLowerCase();
      const results = campaigns?.filter((campaign: any) => 
        campaign.campaign_name?.toLowerCase().includes(query) ||
        campaign.status?.toLowerCase().includes(query)
      ) || [];
      setSearchResults(results);
      setShowSearchResults(results.length > 0);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, campaigns]);

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

  // Fetch notifications (mock for now - replace with actual API)
  useEffect(() => {
    // Simulate fetching notifications
    const mockNotifications = [
      { id: 1, message: "Campaign 'Summer Launch' completed", time: "2 hours ago", read: false },
      { id: 2, message: "New video generated for 'Q3 Webinar'", time: "5 hours ago", read: false },
      { id: 3, message: "Budget alert: 80% spent on 'Black Friday'", time: "1 day ago", read: true },
    ];
    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.read).length);
  }, []);

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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 py-2 w-64 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-lamaPurple"
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
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
              {searchResults.length > 0 ? (
                <div className="p-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.campaign_id || result.id}
                      onClick={() => {
                        router.push(`/campaigns/${result.campaign_id || result.id}`);
                        setShowSearchResults(false);
                        setSearchQuery("");
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="font-medium text-sm">{result.campaign_name}</div>
                      <div className="text-xs text-slate-500 capitalize">{result.status}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-sm text-slate-500 text-center">
                  No campaigns found
                </div>
              )}
            </div>
          )}
        </div>

        {/* NOTIFICATIONS */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Tooltip content="Notifications">
              <button className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </Tooltip>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs text-slate-500">{unreadCount} unread</span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-96 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={`cursor-pointer flex-col items-start py-3 ${
                      !notification.read ? "bg-blue-50 dark:bg-blue-950" : ""
                    }`}
                  >
                    <div className="font-medium text-sm">{notification.message}</div>
                    <div className="text-xs text-slate-500 mt-1">{notification.time}</div>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="p-4 text-sm text-slate-500 text-center">
                  No notifications
                </div>
              )}
            </div>
            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-center text-sm text-lamaPurple cursor-pointer">
                  View all notifications
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
                className="w-9 h-9 rounded-full bg-linear-to-br from-lamaPurple to-lamaSky relative overflow-hidden ring-2 ring-white shadow-sm flex items-center justify-center"
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
            <DropdownMenuSeparator />
            <div className="px-1 py-1">
              <ThemeToggle />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account" className="cursor-pointer w-full flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                <span>Manage Account</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
