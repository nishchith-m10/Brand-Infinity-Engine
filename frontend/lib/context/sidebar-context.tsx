'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  sidebarWidth: number;
  toggleCollapse: () => void;
  setSidebarWidth: (width: number) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const MIN_WIDTH = 80;
const MAX_WIDTH = 280;
const DEFAULT_WIDTH = 256;

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
    if (!isCollapsed) {
      setSidebarWidth(MIN_WIDTH);
    } else {
      setSidebarWidth(DEFAULT_WIDTH);
    }
  }, [isCollapsed]);

  const handleSetSidebarWidth = useCallback((width: number) => {
    const clampedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
    setSidebarWidth(clampedWidth);
    setIsCollapsed(clampedWidth <= MIN_WIDTH + 20);
  }, []);

  const value: SidebarContextType = {
    isCollapsed,
    sidebarWidth,
    toggleCollapse,
    setSidebarWidth: handleSetSidebarWidth,
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}

