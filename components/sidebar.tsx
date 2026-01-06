'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Megaphone, 
  FileText, 
  Video, 
  Share2, 
  Radio,
  BarChart3,
  Settings,
  Menu,
  ChevronLeft,
  Wand2,
  Archive,
  Lock
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useCampaignProgress } from '@/lib/hooks/use-campaign-progress';
import { useSidebar } from '@/lib/context/sidebar-context';

// Workflow navigation items in order
const workflowItems = [
  { 
    number: 1, 
    name: 'Campaigns', 
    href: '/campaigns', 
    icon: Megaphone,
    accessKey: 'canAccessCampaigns' as const
  },
  { 
    number: 2, 
    name: 'Brand Vault', 
    href: '/brand-vault', 
    icon: Archive,
    accessKey: 'canAccessBrandVault' as const
  },
  { 
    number: 3, 
    name: 'Creative Director', 
    href: '/director', 
    icon: Wand2,
    accessKey: 'canAccessDirector' as const
  },
  { 
    number: 4, 
    name: 'Content Review', 
    href: '/review', 
    icon: FileText,
    accessKey: 'canAccessReview' as const
  },
  { 
    number: 5, 
    name: 'Videos', 
    href: '/videos', 
    icon: Video,
    accessKey: 'canAccessVideos' as const
  },
  { 
    number: 6, 
    name: 'Distribution', 
    href: '/distribution', 
    icon: Share2,
    accessKey: 'canAccessDistribution' as const
  },
  { 
    number: 7, 
    name: 'Publishing', 
    href: '/publishing', 
    icon: Radio,
    accessKey: 'canAccessPublishing' as const
  },
];

const insightItems = [
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
];

const systemItems = [
  { name: 'Settings', href: '/settings', icon: Settings },
];

const MIN_WIDTH = 80;

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarWidth, toggleCollapse, setSidebarWidth } = useSidebar();
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Get access permissions
  const progress = useCampaignProgress();

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setSidebarWidth(e.clientX);
  }, [isDragging, setSidebarWidth]);

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

  // Render a nav item
  const renderNavItem = (
    item: { name: string; href: string; icon: React.ElementType; number?: number },
    isLocked: boolean = false
  ) => {
    const isActive = pathname.startsWith(item.href);
    const Icon = item.icon;
    
    return (
      <Link
        key={item.name}
        href={isLocked ? '#' : item.href}
        onClick={(e) => isLocked && e.preventDefault()}
        className={`group flex items-center rounded-2xl transition-all duration-200 ${
          showLabels ? 'px-4 py-3' : 'px-2 py-3 justify-center'
        } ${
          isLocked 
            ? 'opacity-50 cursor-not-allowed text-slate-400 dark:text-slate-600'
            : isActive 
              ? 'bg-lamaPurpleLight dark:bg-lamaPurple/20 text-lamaPurple dark:text-lamaPurple shadow-sm' 
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-muted hover:text-slate-900 dark:hover:text-foreground'
        }`}
      >
        {/* Step number with lock overlay */}
        {showLabels && item.number && (
          <div className={`relative w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mr-2 shrink-0 ${
            isLocked
              ? 'bg-slate-200 text-slate-400'
              : isActive
                ? 'bg-lamaPurple text-white'
                : 'bg-slate-100 text-slate-500'
          }`}>
            {item.number}
            {isLocked && (
              <Lock size={12} className="absolute -top-0.5 -right-0.5 text-slate-400 bg-white rounded-full p-0.5" />
            )}
          </div>
        )}
        
        {/* Icon */}
        <motion.div 
          whileHover={!isLocked ? { scale: 1.1, rotate: 2 } : {}}
          className={`flex items-center justify-center shrink-0 ${showLabels ? 'min-w-[22px]' : 'w-[22px]'} transition-colors ${
            isLocked 
              ? 'text-slate-300'
              : isActive 
                ? 'text-lamaPurple' 
                : 'text-slate-400 group-hover:text-slate-600'
          }`}
        >
          <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        </motion.div>
        
        {/* Label */}
        <motion.span 
          animate={{ 
            opacity: showLabels ? 1 : 0,
            x: showLabels ? 0 : -10,
            display: showLabels ? 'block' : 'none'
          }}
          transition={{ duration: 0.2 }}
          className={`ml-3 text-sm font-medium whitespace-nowrap ${isActive ? 'font-semibold' : ''}`}
        >
          {item.name}
        </motion.span>
        
        {/* Locked tooltip */}
        {isLocked && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Complete previous step first
          </div>
        )}
      </Link>
    );
  };

  // Section header
  const renderSectionHeader = (title: string) => (
    <motion.div 
      animate={{ 
        opacity: showLabels ? 1 : 0,
        display: showLabels ? 'block' : 'none'
      }}
      className="px-4 pt-4 pb-2"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600">
        {title}
      </span>
    </motion.div>
  );

  return (
    <div 
      ref={sidebarRef}
      className="relative flex h-screen flex-col bg-white dark:bg-card text-slate-600 dark:text-slate-400 transition-all duration-300 shadow-sm z-50 border-r border-slate-100/50 dark:border-border"
      style={{ width: sidebarWidth }}
    >
      {/* Header */}
      <div className="flex h-20 items-center justify-between px-6 pt-4 overflow-hidden whitespace-nowrap">
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
            <span className="text-xl font-bold text-slate-800 dark:text-foreground tracking-tight whitespace-nowrap">
              Brand Infinity
            </span>
          </motion.div>
        </Link>
        
        <button 
          onClick={toggleCollapse}
          className={`flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-muted text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-foreground transition-colors ${!showLabels ? 'mx-auto' : ''}`}
        >
          {showLabels ? <ChevronLeft size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {/* Dashboard - always at top */}
        {renderNavItem({ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard })}
        
        {/* Workflow Section */}
        {renderSectionHeader('Workflow')}
        {workflowItems.map((item) => {
          const isLocked = !progress[item.accessKey];
          return renderNavItem(item, isLocked);
        })}
        
        {/* Insights Section */}
        {renderSectionHeader('Insights')}
        {insightItems.map((item) => renderNavItem(item))}
        
        {/* System Section */}
        {renderSectionHeader('System')}
        {systemItems.map((item) => renderNavItem(item))}
      </nav>

      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-lamaPurple/20 transition-colors"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
