'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Megaphone, 
  FileText, 
  Video, 
  Share2, 
  Calendar,
  BarChart3,
  Settings,
  Menu,
  ChevronLeft
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { name: 'Content Review', href: '/review', icon: FileText },
  { name: 'Videos', href: '/videos', icon: Video },
  { name: 'Distribution', href: '/distribution', icon: Share2 },
  { name: 'Publishing', href: '/publishing', icon: Calendar },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const MIN_WIDTH = 80; 
const MAX_WIDTH = 280;
const DEFAULT_WIDTH = 256;

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const toggleCollapse = () => {
    if (isCollapsed) {
      setSidebarWidth(DEFAULT_WIDTH);
      setIsCollapsed(false);
    } else {
      setSidebarWidth(MIN_WIDTH);
      setIsCollapsed(true);
    }
  };

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
    setSidebarWidth(newWidth);
    setIsCollapsed(newWidth <= MIN_WIDTH + 20);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const showLabels = sidebarWidth > MIN_WIDTH + 20;

  return (
    <div 
      ref={sidebarRef}
      className="relative flex h-screen flex-col bg-white text-slate-600 transition-all duration-300 shadow-sm z-50 border-r border-slate-100/50"
      style={{ width: sidebarWidth }}
    >
      {/* Header */}
      <div className="flex h-20 items-center justify-between px-6 pt-4 overflow-hidden whitespace-nowrap">
        {/* Brand Infinity Link - Smoother Animation */}
        <Link href="/dashboard" className="flex items-center gap-2 outline-none">
          <motion.div
            animate={{ 
              opacity: showLabels ? 1 : 0,
              width: showLabels ? 'auto' : 0,
              display: showLabels ? 'flex' : 'none'
            }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex items-center gap-2"
          >
            <span className="text-xl font-bold text-slate-800 tracking-tight whitespace-nowrap">
              Brand Infinity
            </span>
          </motion.div>
        </Link>
        
        {/* Toggle Button */}
        <button 
          onClick={toggleCollapse}
          className={`flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ${!showLabels ? 'mx-auto' : ''}`}
        >
          {showLabels ? <ChevronLeft size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-4 py-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center rounded-2xl transition-all duration-200 ${
                showLabels ? 'px-4 py-3.5' : 'px-2 py-3.5 justify-center'
              } ${
                isActive 
                  ? 'bg-lamaPurpleLight text-lamaPurple shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className={`flex items-center justify-center shrink-0 ${showLabels ? 'min-w-[24px]' : 'w-[24px]'} transition-colors ${isActive ? 'text-lamaPurple' : 'text-slate-400 group-hover:text-slate-600'}`}>
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              
              <motion.span 
                animate={{ 
                  opacity: showLabels ? 1 : 0,
                  x: showLabels ? 0 : -10,
                  display: showLabels ? 'block' : 'none'
                }}
                transition={{ duration: 0.2 }}
                className={`ml-4 font-medium whitespace-nowrap ${isActive ? 'font-semibold' : ''}`}
              >
                {item.name}
              </motion.span>
            </Link>
          );
        })}
      </nav>

      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-lamaPurple/20 transition-colors"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
