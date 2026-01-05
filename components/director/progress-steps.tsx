'use client';

/**
 * Progress Steps Component
 * 
 * Shows the current stage of content generation with animated transitions.
 * Steps: Analyzing → Planning → Creating → Reviewing
 */

import { useState } from 'react';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProgressStep {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface ProgressStepsProps {
  steps: ProgressStep[];
  variant?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md';
  className?: string;
}

export function ProgressSteps({ 
  steps, 
  variant = 'horizontal',
  size = 'md',
  className 
}: ProgressStepsProps) {
  const isHorizontal = variant === 'horizontal';
  const isSmall = size === 'sm';

  return (
    <div 
      className={cn(
        'flex',
        isHorizontal ? 'flex-row items-center gap-1' : 'flex-col gap-2',
        className
      )}
    >
      {steps.map((step, index) => (
        <div key={step.id} className={cn('flex items-center', isHorizontal ? 'flex-row' : 'flex-row gap-3')}>
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center justify-center rounded-full transition-all duration-300',
                isSmall ? 'w-5 h-5' : 'w-6 h-6',
                step.status === 'completed' && 'bg-green-500 text-white',
                step.status === 'active' && 'bg-lamaPurple text-white',
                step.status === 'pending' && 'bg-slate-200 text-slate-400',
                step.status === 'error' && 'bg-red-500 text-white'
              )}
            >
              {step.status === 'completed' && (
                <CheckCircle className={cn(isSmall ? 'w-3 h-3' : 'w-4 h-4')} />
              )}
              {step.status === 'active' && (
                <Loader2 className={cn('animate-spin', isSmall ? 'w-3 h-3' : 'w-4 h-4')} />
              )}
              {step.status === 'pending' && (
                <Circle className={cn(isSmall ? 'w-3 h-3' : 'w-4 h-4')} />
              )}
              {step.status === 'error' && (
                <span className={cn('font-bold', isSmall ? 'text-xs' : 'text-sm')}>!</span>
              )}
            </div>
            
            {/* Step label */}
            <span
              className={cn(
                'font-medium transition-colors duration-300',
                isSmall ? 'text-xs' : 'text-sm',
                step.status === 'completed' && 'text-green-600',
                step.status === 'active' && 'text-lamaPurple',
                step.status === 'pending' && 'text-slate-400',
                step.status === 'error' && 'text-red-600'
              )}
            >
              {step.label}
            </span>
          </div>
          
          {/* Connector line (not on last item) */}
          {index < steps.length - 1 && isHorizontal && (
            <div 
              className={cn(
                'mx-2 transition-colors duration-300',
                isSmall ? 'w-4 h-0.5' : 'w-6 h-0.5',
                step.status === 'completed' ? 'bg-green-500' : 'bg-slate-200'
              )}
            />
          )}
          
          {/* Vertical description */}
          {!isHorizontal && step.description && (
            <p className="text-xs text-slate-500 ml-8">{step.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Compact inline progress for chat interface
 */
export function InlineProgress({ 
  currentStep, 
  totalSteps,
  stepLabel 
}: { 
  currentStep: number; 
  totalSteps: number;
  stepLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-lamaPurpleLight/30 rounded-lg border border-lamaPurple/20">
      <Loader2 className="w-4 h-4 text-lamaPurple animate-spin" />
      <span className="text-xs font-medium text-lamaPurple">
        Step {currentStep}/{totalSteps}: {stepLabel}
      </span>
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-lamaPurple transition-all duration-500 rounded-full"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Default content generation steps
 */
export const DEFAULT_GENERATION_STEPS: ProgressStep[] = [
  { id: 'analyze', label: 'Analyzing', status: 'pending' },
  { id: 'plan', label: 'Planning', status: 'pending' },
  { id: 'create', label: 'Creating', status: 'pending' },
  { id: 'review', label: 'Reviewing', status: 'pending' },
];

/**
 * Hook to manage progress steps state
 */
export function useProgressSteps(initialSteps: ProgressStep[] = DEFAULT_GENERATION_STEPS) {
  const [steps, setSteps] = useState<ProgressStep[]>(initialSteps);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);

  const startProgress = () => {
    setCurrentStepIndex(0);
    setSteps(prev => prev.map((step, i) => ({
      ...step,
      status: i === 0 ? 'active' : 'pending'
    })));
  };

  const nextStep = () => {
    setCurrentStepIndex(prev => {
      const next = prev + 1;
      setSteps(steps => steps.map((step, i) => ({
        ...step,
        status: i < next ? 'completed' : i === next ? 'active' : 'pending'
      })));
      return next;
    });
  };

  const completeAll = () => {
    setSteps(prev => {
      // Use functional update to avoid stale closure (Bug 2.2 fix)
      setCurrentStepIndex(prev.length);
      return prev.map(step => ({ ...step, status: 'completed' as const }));
    });
  };

  const setError = (stepId: string) => {
    setSteps(prev => prev.map(step => ({
      ...step,
      status: step.id === stepId ? 'error' : step.status
    })));
  };

  const reset = () => {
    setCurrentStepIndex(-1);
    setSteps(initialSteps);
  };

  return {
    steps,
    currentStepIndex,
    isInProgress: currentStepIndex >= 0 && currentStepIndex < steps.length,
    isComplete: currentStepIndex >= steps.length,
    startProgress,
    nextStep,
    completeAll,
    setError,
    reset,
  };
}
