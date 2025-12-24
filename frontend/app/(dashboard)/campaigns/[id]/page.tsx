"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronRight, Check, LayoutTemplate, Sparkles, Smartphone, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeIn, slideUp } from "@/lib/animations";

const STEPS = [
  { id: 1, label: "Basics" },
  { id: 2, label: "Audience" },
  { id: 3, label: "Creative" },
  { id: 4, label: "Review" },
];

export default function CampaignEditor() {
  const [currentStep, setCurrentStep] = useState(1);
  const [activePreview, setActivePreview] = useState<"mobile" | "desktop">("mobile");

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col gap-6 lg:flex-row p-4">
      <div className="flex h-full w-full flex-col gap-6 lg:flex-row">
        
        {/* LEFT COLUMN: Editor Form (Scrollable) */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 pb-10">
            
            {/* Stepper */}
            <motion.div variants={slideUp} initial="hidden" animate="visible">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            {STEPS.map((step, index) => {
                                const isCompleted = currentStep > step.id;
                                const isActive = currentStep === step.id;
                                
                                return (
                                    <div key={step.id} className="flex flex-1 items-center last:flex-none">
                                        <div className="flex flex-col items-center gap-2 relative z-10">
                                            <div className={cn(
                                                "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors duration-300",
                                                isActive ? "border-lamaPurple bg-lamaPurple text-white shadow-lg shadow-lamaPurple/20" :
                                                isCompleted ? "border-lamaPurple bg-white text-lamaPurple" :
                                                "border-slate-200 bg-slate-50 text-slate-400"
                                            )}>
                                                {isCompleted ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{step.id}</span>}
                                            </div>
                                            <span className={cn(
                                                "text-xs font-medium absolute -bottom-6 w-full text-center transition-colors",
                                                isActive ? "text-lamaPurple font-bold" : "text-slate-500"
                                            )}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {index < STEPS.length - 1 && (
                                            <div className="relative mx-4 h-0.5 flex-1 bg-slate-100">
                                                <div 
                                                    className="absolute left-0 top-0 h-full bg-lamaPurple transition-all duration-500"
                                                    style={{ width: isCompleted ? "100%" : "0%" }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Form Steps */}
            <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex-1">
                <Card className="min-h-[400px]">
                    <CardHeader>
                        <CardTitle>Campaign Configuration</CardTitle>
                        <CardDescription>Setup your target audience and messaging details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Campaign Name</label>
                            <Input placeholder="e.g. Summer Launch 2024" defaultValue="Untitled Campaign 1" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Platform</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button className="flex items-center justify-center gap-2 rounded-lg border border-lamaPurple bg-lamaPurpleLight p-3 text-sm font-medium text-lamaPurple ring-2 ring-lamaPurple/20">
                                        <LayoutTemplate className="h-4 w-4" /> Instagram
                                    </button>
                                    <button className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
                                        <LayoutTemplate className="h-4 w-4" /> LinkedIn
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Objective</label>
                                <Input placeholder="Brand Awareness" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Detailed Description</label>
                            <textarea className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500"></textarea>
                        </div>
                         
                        <div className="flex justify-end pt-4">
                            <Button className="w-full md:w-auto" onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}>
                                Continue to Audience <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>


        {/* RIGHT COLUMN: Live Preview (Sticky) */}
        <div className="hidden lg:flex w-[400px] flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg bg-white p-2 border border-slate-200">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-2">Live Preview</span>
                <div className="flex bg-slate-100 rounded-md p-0.5">
                    <button 
                        onClick={() => setActivePreview('mobile')}
                        className={cn("p-1.5 rounded text-slate-500 hover:text-slate-900 transition-colors", activePreview === 'mobile' && "bg-white text-lamaPurple shadow-sm")}
                    >
                        <Smartphone className="h-4 w-4" />
                    </button>
                    <button 
                        onClick={() => setActivePreview('desktop')}
                        className={cn("p-1.5 rounded text-slate-500 hover:text-slate-900 transition-colors", activePreview === 'desktop' && "bg-white text-lamaPurple shadow-sm")}
                    >
                        <Monitor className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <motion.div 
                layout
                className={cn(
                    "relative flex-1 rounded-2xl border-4 border-slate-200 bg-slate-900 shadow-2xl overflow-hidden transition-all duration-500",
                    activePreview === 'mobile' ? "mx-auto w-[300px]" : "w-full"
                )}
            >
                {/* Mock Phone/Desktop Top Bar */}
                <div className="h-6 w-full bg-slate-900 flex items-center justify-center">
                    <div className="h-4 w-24 bg-black rounded-full" />
                </div>

                {/* Screen Content */}
                <div className="h-full w-full bg-white relative overflow-hidden">
                    {/* Mock Instagram UI */}
                    <div className="h-14 border-b flex items-center justify-between px-4 bg-white/90 backdrop-blur">
                        <div className="font-semibold text-sm">Brand Infinity</div>
                        <div className="h-6 w-6 rounded-full bg-lamaPurpleLight" />
                    </div>
                    
                    <div className="aspect-4/5 bg-slate-100 relative group flex items-center justify-center">
                        <Sparkles className="h-12 w-12 text-lamaPurple/40 animate-pulse" />
                        <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />
                        <div className="absolute bottom-4 left-4 text-white font-medium text-sm">
                            Unlock your potential 🚀
                        </div>
                    </div>

                    <div className="p-4 space-y-2">
                        <div className="flex gap-3">
                            <div className="h-4 w-4 rounded-full bg-slate-200" />
                            <div className="h-4 w-4 rounded-full bg-slate-200" />
                            <div className="h-4 w-4 rounded-full bg-slate-200" />
                        </div>
                        <div className="text-xs font-semibold">1,248 likes</div>
                        <div className="text-xs text-slate-600">
                            <span className="font-semibold mr-1">brand.infinity</span>
                             Get ready for our biggest summer launch yet! #Summer2024
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>

      </div>
    </div>
  );
}
