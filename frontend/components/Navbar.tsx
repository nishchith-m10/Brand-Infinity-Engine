"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { role } from "@/lib/data";
import { useAuth } from "@/lib/auth/auth-provider";
import { useRouter } from "next/navigation";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Search, MessageSquare, Megaphone, Bell, Settings, LogOut } from "lucide-react";
import { CampaignSelector } from "@/components/CampaignSelector";
import { useCampaignStore } from "@/lib/hooks/use-current-campaign";

export default function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const clearCampaign = useCampaignStore((state) => state.clearCampaign);

  return (
    <div className="flex items-center justify-between p-4">
      {/* CAMPAIGN SELECTOR */}
      <div className="flex items-center gap-4">
        <CampaignSelector />
      </div>

      {/* ICONS AND USER */}
      <div className="flex items-center gap-6 justify-end w-full md:w-auto">
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
                className="w-9 h-9 rounded-full bg-gradient-to-br from-lamaPurple to-lamaSky relative overflow-hidden ring-2 ring-white shadow-sm flex items-center justify-center"
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
