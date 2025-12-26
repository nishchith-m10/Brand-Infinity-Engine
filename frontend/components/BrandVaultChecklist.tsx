"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown, ChevronUp, ClipboardList, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

interface SetupStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  href?: string;
}

interface BrandVaultChecklistProps {
  steps: SetupStep[];
  onComplete?: () => void;
}

const STORAGE_KEY = 'brand_vault_checklist_minimized';

/**
 * Floating chat-style checklist for Brand Vault setup.
 * Shows as a minimized badge or expanded panel in the bottom-right corner.
 */
export function BrandVaultChecklist({ steps, onComplete }: BrandVaultChecklistProps) {
  const completedCount = steps.filter(s => s.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const currentStepIndex = steps.findIndex(s => !s.completed);
  const allComplete = completedCount === steps.length;
  
  // Start with expanded (false) to match server render, then hydrate from localStorage
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Load minimized state from localStorage AFTER mount to avoid hydration mismatch
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setIsMinimized(true);
    }
    setHasMounted(true);
  }, []);

  // Persist minimized state (only after initial mount)
  useEffect(() => {
    if (hasMounted) {
      localStorage.setItem(STORAGE_KEY, String(isMinimized));
    }
  }, [isMinimized, hasMounted]);

  // Auto-hide when all complete
  if (allComplete) {
    return null;
  }

  // Minimized badge view
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "flex items-center gap-2 px-4 py-2.5 rounded-full",
          "bg-white border border-slate-200 shadow-lg",
          "hover:shadow-xl hover:scale-105 transition-all duration-200",
          "group"
        )}
      >
        {/* Progress ring */}
        <div className="relative w-6 h-6 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle 
              cx="12" cy="12" r="10" 
              stroke="currentColor" strokeWidth="2" fill="transparent" 
              className="text-slate-100" 
            />
            <circle 
              cx="12" cy="12" r="10" 
              stroke="currentColor" strokeWidth="2" fill="transparent" 
              strokeDasharray={63} 
              strokeDashoffset={63 - (63 * progress) / 100} 
              className="text-lamaPurple transition-all duration-500" 
            />
          </svg>
        </div>
        
        {/* Count badge */}
        <span className="text-sm font-semibold text-slate-700">
          {completedCount}/{steps.length}
        </span>
        
        {/* Expand icon */}
        <ChevronUp size={14} className="text-slate-400 group-hover:text-lamaPurple transition-colors" />
        
        {/* Pulse animation when incomplete */}
        {!allComplete && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-lamaPurple rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  // Expanded panel view
  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50",
      "w-72 bg-white rounded-xl border border-slate-200 shadow-xl",
      "animate-in slide-in-from-bottom-2 fade-in duration-200"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-lamaPurple" />
          <span className="text-sm font-semibold text-slate-800">Setup Progress</span>
        </div>
        <Tooltip content="Minimize" position="top">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-slate-100 rounded-md text-slate-400 transition-colors"
          >
            <ChevronDown size={16} />
          </button>
        </Tooltip>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 bg-slate-50/50">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>{completedCount} of {steps.length} completed</span>
          <span className="font-medium text-lamaPurple">{progress}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-lamaPurple to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps list */}
      <div className="px-2 py-2 space-y-1 max-h-64 overflow-y-auto">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors",
              step.completed 
                ? "text-emerald-700 bg-emerald-50/50" 
                : idx === currentStepIndex 
                  ? "bg-lamaPurpleLight/50 text-slate-800" 
                  : "text-slate-400"
            )}
          >
            {/* Step indicator */}
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border",
              step.completed 
                ? "bg-emerald-100 border-emerald-200 text-emerald-600" 
                : idx === currentStepIndex 
                  ? "bg-white border-lamaPurple text-lamaPurple" 
                  : "bg-transparent border-slate-200 text-slate-400"
            )}>
              {step.completed ? <Check size={10} /> : idx + 1}
            </div>
            
            {/* Label */}
            <span className={cn(
              "flex-1 truncate",
              step.completed ? "" : idx === currentStepIndex ? "font-medium" : ""
            )}>
              {step.label}
            </span>
            
            {/* Active badge */}
            {idx === currentStepIndex && !step.completed && (
              <span className="text-[9px] uppercase font-bold text-lamaPurple bg-white px-1.5 py-0.5 rounded border border-lamaPurple/20">
                Next
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
