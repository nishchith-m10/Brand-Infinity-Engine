'use client';

import { Lock, ArrowRight, CheckCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface PrerequisiteStep {
  label: string;
  completed: boolean;
}

interface LockedStateProps {
  title: string;
  description: string;
  steps: PrerequisiteStep[];
  nextAction: {
    label: string;
    href: string;
  };
  explanation?: string;
}

/**
 * LockedState Component
 * 
 * Displayed when a user tries to access a page without completing prerequisites.
 * Shows:
 * - What steps need to be completed
 * - Why this page is locked
 * - A clear CTA to the next required step
 */
export function LockedState({
  title,
  description,
  steps,
  nextAction,
  explanation,
}: LockedStateProps) {
  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="bg-slate-50 rounded-2xl p-8 max-w-md w-full">
        {/* Lock Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-slate-200 rounded-full p-4">
            <Lock className="h-8 w-8 text-slate-500" />
          </div>
        </div>
        
        {/* Title & Description */}
        <h2 className="text-xl font-semibold text-slate-800 text-center mb-2">
          {title}
        </h2>
        <p className="text-slate-500 text-center mb-6">
          {description}
        </p>
        
        {/* Steps Checklist */}
        <div className="bg-white rounded-lg p-4 mb-6 border border-slate-100">
          <p className="text-sm font-medium text-slate-600 mb-3">
            Complete these steps first ({completedCount}/{totalCount}):
          </p>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div 
                key={index} 
                className={`flex items-center gap-3 py-1.5 ${
                  step.completed ? 'opacity-60' : ''
                }`}
              >
                {step.completed ? (
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300 shrink-0" />
                )}
                <span className={`text-sm ${
                  step.completed 
                    ? 'text-slate-400 line-through' 
                    : 'text-slate-700'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Explanation */}
        {explanation && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800">
              💡 {explanation}
            </p>
          </div>
        )}
        
        {/* CTA Button */}
        <Link href={nextAction.href} className="block">
          <Button className="w-full" size="lg">
            {nextAction.label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

/**
 * Simple empty state for pages with no content yet
 */
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="bg-slate-100 rounded-full p-4 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-slate-700 mb-2">{title}</h3>
      <p className="text-slate-500 text-center max-w-sm mb-6">{description}</p>
      {action && (
        <Link href={action.href}>
          <Button>
            {action.label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}
