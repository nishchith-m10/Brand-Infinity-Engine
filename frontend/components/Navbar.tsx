"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { role } from "@/lib/data";
import { useAuth } from "@/lib/auth/auth-provider";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Search, MessageSquare, Megaphone, Bell, Settings, LogOut } from "lucide-react";

export default function Navbar() {
  const { user, signOut } = useAuth();
  return (
    <div className="flex items-center justify-between p-4">
      {/* SEARCH BAR */}
      <div className="hidden md:flex items-center gap-2 text-xs rounded-full ring-[1.5px] ring-slate-200 px-2 py-2 w-[200px] sm:w-[300px] bg-white">
        <Search size={16} className="text-slate-500" />
        <input 
          type="search" 
          placeholder="Search..." 
          className="w-full bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          name="dashboard-search"
          id="dashboard-search"
          data-lpignore="true"
          data-form-type="other"
        />
      </div>

      {/* ICONS AND USER */}
      <div className="flex items-center gap-6 justify-end w-full md:w-auto">
        
        {/* ACTION ICONS */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white rounded-full w-9 h-9 flex items-center justify-center cursor-pointer relative shadow-sm hover:shadow-md transition-shadow"
        >
          <MessageSquare size={18} className="text-slate-600" />
        </motion.div>
        
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white rounded-full w-9 h-9 flex items-center justify-center cursor-pointer relative shadow-sm hover:shadow-md transition-shadow"
        >
          <Megaphone size={18} className="text-slate-600" />
          <div className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-lamaPurple text-white rounded-full text-[10px] font-bold">
            1
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white rounded-full w-9 h-9 flex items-center justify-center cursor-pointer relative shadow-sm hover:shadow-md transition-shadow"
        >
          <Bell size={18} className="text-slate-600" />
          <div className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-lamaPurple text-white rounded-full text-[10px] font-bold">
            1
          </div>
        </motion.div>

        {/* USER PROFILE */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-800">{user?.user_metadata?.full_name || 'Hasbunallah'}</span>
                <span className="text-[10px] text-slate-500 text-right capitalize">{role}</span>
              </div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-9 h-9 rounded-full bg-slate-200 relative overflow-hidden ring-2 ring-white shadow-sm"
              >
                <Image 
                  src={user?.user_metadata?.avatar_url || "https://images.pexels.com/photos/1102341/pexels-photo-1102341.jpeg?auto=compress&cs=tinysrgb&w=1200"}
                  alt="Avatar" 
                  fill
                  className="object-cover"
                />
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
            <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600 cursor-pointer" onClick={() => signOut()}>
               <LogOut className="mr-2 h-4 w-4" />
               <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
