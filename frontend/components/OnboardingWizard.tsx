'use client';

import { FolderPlus, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface Step {
  number: number;
  title: string;
  description: string;
  completed: boolean;
}

const ONBOARDING_STEPS: Step[] = [
  {
    number: 1,
    title: 'Create a Campaign',
    description: 'Set up your first content project',
    completed: false,
  },
  {
    number: 2,
    title: 'Configure Brand Vault',
    description: 'Add your brand identity and assets',
    completed: false,
  },
  {
    number: 3,
    title: 'Use Creative Director',
    description: 'Tell AI what content to generate',
    completed: false,
  },
  {
    number: 4,
    title: 'Review & Approve',
    description: 'Refine the generated scripts',
    completed: false,
  },
  {
    number: 5,
    title: 'Watch Videos',
    description: 'See your AI-generated videos',
    completed: false,
  },
  {
    number: 6,
    title: 'Distribute',
    description: 'Create platform variants',
    completed: false,
  },
  {
    number: 7,
    title: 'Publish',
    description: 'Go live on social platforms',
    completed: false,
  },
];

/**
 * OnboardingWizard
 * 
 * Shown on dashboard when user has no campaigns.
 * Guides them through the 7-step workflow.
 */
export function OnboardingWizard() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl"
      >
        {/* Welcome Header */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 shadow-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-3">
            Welcome to Brand Infinity Engine
          </h1>
          <p className="text-lg text-slate-500">
            Create AI-powered video content in 7 simple steps
          </p>
        </div>

        {/* Steps Overview */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ONBOARDING_STEPS.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-start gap-3 p-3 rounded-xl text-left ${
                  step.number === 1 
                    ? 'bg-indigo-50 border border-indigo-100' 
                    : 'bg-slate-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                  step.completed 
                    ? 'bg-green-500 text-white'
                    : step.number === 1
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}>
                  {step.completed ? <CheckCircle2 className="h-5 w-5" /> : step.number}
                </div>
                <div>
                  <p className={`font-medium ${
                    step.number === 1 ? 'text-indigo-900' : 'text-slate-700'
                  }`}>
                    {step.title}
                  </p>
                  <p className={`text-sm ${
                    step.number === 1 ? 'text-indigo-600' : 'text-slate-500'
                  }`}>
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Link href="/campaigns?create=true">
          <Button size="lg" className="px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-shadow">
            <FolderPlus className="mr-2 h-5 w-5" />
            Create Your First Campaign
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>

        <p className="mt-4 text-sm text-slate-400">
          Takes about 2 minutes to set up
        </p>
      </motion.div>
    </div>
  );
}

/**
 * ProgressSteps
 * 
 * Horizontal progress indicator showing current step in workflow.
 */
interface ProgressStepsProps {
  currentStep: number;
  totalSteps?: number;
}

export function ProgressSteps({ currentStep, totalSteps = 7 }: ProgressStepsProps) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <div
          key={step}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            step <= currentStep 
              ? 'bg-indigo-500' 
              : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}
