"use client";

import { WORKFLOW_STEPS } from "@/lib/hooks/use-campaign-progress";
import { Check } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

interface StepProgressProps {
  currentStep: number; // 1-7
  className?: string;
}

/**
 * Progress bar showing the current step in the workflow.
 * Displays steps 1-7 with completed/current/upcoming states.
 */
export function StepProgress({ currentStep, className = "" }: StepProgressProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs font-medium text-slate-500 mr-2">Progress:</span>
      <div className="flex items-center gap-1">
        {WORKFLOW_STEPS.map((step, index) => {
          const stepNum = step.number;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          
          return (
            <div key={step.number} className="flex items-center">
              {/* Step indicator */}
              <Tooltip content={step.name} position="top">
                <div
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${isCompleted 
                      ? 'bg-emerald-500 text-white' 
                      : isCurrent 
                        ? 'bg-lamaPurple text-white ring-2 ring-lamaPurple/30' 
                        : 'bg-slate-200 text-slate-500'
                    }
                  `}
                >
                  {isCompleted ? <Check size={12} /> : stepNum}
                </div>
              </Tooltip>
              
              {/* Connector line */}
              {stepNum < 7 && (
                <div 
                  className={`w-4 h-0.5 ${
                    isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                  }`} 
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Mini version for tight spaces
 */
export function StepProgressMini({ currentStep, className = "" }: StepProgressProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[1, 2, 3, 4, 5, 6, 7].map((step) => (
        <Tooltip key={step} content={`Step ${step}`} position="top">
          <div
            className={`w-2 h-2 rounded-full transition-all ${
              step < currentStep
                ? 'bg-emerald-500'
                : step === currentStep
                  ? 'bg-lamaPurple'
                  : 'bg-slate-300'
            }`}
          />
        </Tooltip>
      ))}
    </div>
  );
}
