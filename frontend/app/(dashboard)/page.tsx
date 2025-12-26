"use client";

import { MotionCard } from "@/components/ui/motion-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Users, Video, Calendar, ArrowUpRight, ArrowDownRight, 
  Activity, TrendingUp, PenTool, MonitorPlay, Share2, Radio, DollarSign
} from "lucide-react";
import { useTrends, useDashboardStats, useCampaigns } from "@/lib/hooks/use-api";
import { motion } from "framer-motion";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export default function DashboardPage() {
  const { data: trends } = useTrends();
  const { data: dashboardStats, isLoading } = useDashboardStats();
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns();
  
  // Check if user has campaigns
  const campaigns = Array.isArray(campaignsData) 
    ? campaignsData 
    : (campaignsData as any)?.data || [];
  const hasCampaigns = campaigns.length > 0;
  
  // Show onboarding if no campaigns
  if (!campaignsLoading && !hasCampaigns) {
    return <OnboardingWizard />;
  }

  // Use real data when available, fallback to placeholder
  const stats = [
    { 
      title: "Total Campaigns", 
      value: dashboardStats?.campaigns?.total?.toString() || "0", 
      change: `${dashboardStats?.campaigns?.active || 0} active`, 
      icon: Activity, 
      color: "text-lamaPurple" 
    },
    { 
      title: "Videos Produced", 
      value: dashboardStats?.videos?.completed?.toString() || "0", 
      change: `${dashboardStats?.videos?.processing || 0} processing`, 
      icon: Video, 
      color: "text-lamaYellow" 
    },
    { 
      title: "Published", 
      value: dashboardStats?.publications?.total_published?.toString() || "0", 
      change: "+0%", 
      icon: Share2, 
      color: "text-lamaSky" 
    },
    { 
      title: "Cost (This Month)", 
      value: `$${dashboardStats?.cost?.this_month_usd || "0.00"}`, 
      change: "Usage", 
      icon: DollarSign, 
      color: "text-emerald-500" 
    },
  ];

  // Recent activity from API
  const recentActivity = dashboardStats?.recent_activity || [];

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER with Motion */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <div className="text-sm text-slate-500">
          {isLoading ? "Loading..." : "Welcome back, Strategist"}
        </div>
      </motion.div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <MotionCard key={i} variant="lift" className="flex flex-col justify-between h-[120px]">
             <div className="flex justify-between items-start">
               <div>
                 <p className="text-sm text-slate-500 font-medium">{stat.title}</p>
                 <h3 className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</h3>
               </div>
               <div className={`p-2 rounded-full bg-slate-50 ${stat.color} bg-opacity-20`}>
                 <stat.icon size={20} className={stat.color} />
               </div>
             </div>
             <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500">{stat.change}</span>
             </div>
          </MotionCard>
        ))}
      </div>

      {/* TABS SECTION */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="strategist">Strategist</TabsTrigger>
          <TabsTrigger value="copywriter">Copywriter</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="publisher">Publisher</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* MAIN CHART */}
              <MotionCard className="lg:col-span-2 h-[400px] flex flex-col">
                 <div className="mb-4">
                   <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                     <TrendingUp size={18} className="text-lamaPurple" />
                     Performance Trends
                   </h3>
                 </div>
                 <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ background: 'rgba(255, 255, 255, 0.8)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line type="monotone" dataKey="views" stroke="#C3EBFA" strokeWidth={3} dot={{ r: 4, fill: "#C3EBFA" }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="engagement" stroke="#FAE27C" strokeWidth={3} dot={{ r: 4, fill: "#FAE27C" }} />
                      </LineChart>
                    </ResponsiveContainer>
                 </div>
              </MotionCard>

              {/* ACTIVITY */}
              <MotionCard className="h-[400px] overflow-y-auto">
                 <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                   <Activity size={18} className="text-lamaSky" />
                   Recent Activity
                 </h3>
                 <div className="space-y-6">
                   {recentActivity.length > 0 ? (
                     recentActivity.map((item: { campaign_id: string; campaign_name: string; status: string; created_at: string; updated_at: string }, i: number) => (
                       <div key={item.campaign_id || i} className="flex gap-3 items-start relative pl-4 border-l-2 border-slate-100 last:border-0">
                         <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                           item.status === 'active' ? 'bg-green-500' :
                           item.status === 'completed' ? 'bg-blue-500' :
                           item.status === 'paused' ? 'bg-yellow-500' :
                           'bg-lamaPurple'
                         }`} />
                         <div className="space-y-1">
                           <p className="text-sm font-medium text-slate-800">{item.campaign_name || 'Campaign'}</p>
                           <p className="text-xs text-slate-500">
                             {item.status === 'active' ? 'Campaign active' : 
                              item.status === 'completed' ? 'Campaign completed' :
                              item.status === 'draft' ? 'Draft created' : 
                              `Status: ${item.status}`}
                             {' • '}
                             {new Date(item.updated_at || item.created_at).toLocaleDateString()}
                           </p>
                         </div>
                       </div>
                     ))
                   ) : (
                     <div className="text-center text-slate-400 py-8">
                       <p>No recent activity</p>
                       <p className="text-xs mt-1">Create a campaign to get started</p>
                     </div>
                   )}
                 </div>
              </MotionCard>
           </div>
        </TabsContent>

        {/* STRATEGIST PILLAR */}
        <TabsContent value="strategist">
          <MotionCard variant="glass" className="h-[300px] flex items-center justify-center border-dashed border-2 border-lamaSky/50">
             <div className="text-center space-y-2">
               <PenTool size={40} className="text-lamaSky mx-auto" />
               <h3 className="text-lg font-semibold text-slate-700">Strategy Hub</h3>
               <p className="text-slate-500 text-sm">Analyze trends and generate new briefs here.</p>
             </div>
          </MotionCard>
        </TabsContent>

        {/* COPYWRITER PILLAR */}
        <TabsContent value="copywriter">
          <MotionCard variant="glass" className="h-[300px] flex items-center justify-center border-dashed border-2 border-lamaPurple/50">
             <div className="text-center space-y-2">
               <PenTool size={40} className="text-lamaPurple mx-auto" />
               <h3 className="text-lg font-semibold text-slate-700">Copywriting Studio</h3>
               <p className="text-slate-500 text-sm">Scripts and ad copy generation workspace.</p>
             </div>
          </MotionCard>
        </TabsContent>

        {/* PRODUCTION PILLAR */}
        <TabsContent value="production">
          <MotionCard variant="glass" className="h-[300px] flex items-center justify-center border-dashed border-2 border-lamaYellow/50">
             <div className="text-center space-y-2">
               <MonitorPlay size={40} className="text-lamaYellow mx-auto" />
               <h3 className="text-lg font-semibold text-slate-700">Production Suite</h3>
               <p className="text-slate-500 text-sm">Manage video variations and editing.</p>
             </div>
          </MotionCard>
        </TabsContent>

        {/* DISTRIBUTION PILLAR */}
        <TabsContent value="distribution">
          <MotionCard variant="glass" className="h-[300px] flex items-center justify-center border-dashed border-2 border-emerald-300/50">
             <div className="text-center space-y-2">
               <Share2 size={40} className="text-emerald-300 mx-auto" />
               <h3 className="text-lg font-semibold text-slate-700">Distribution Network</h3>
               <p className="text-slate-500 text-sm">Schedule and publish across platforms.</p>
             </div>
          </MotionCard>
        </TabsContent>

        {/* PUBLISHER PILLAR */}
        <TabsContent value="publisher">
           <MotionCard variant="glass" className="h-[300px] flex items-center justify-center border-dashed border-2 border-orange-300/50">
             <div className="text-center space-y-2">
               <Radio size={40} className="text-orange-300 mx-auto" />
               <h3 className="text-lg font-semibold text-slate-700">Publisher Console</h3>
               <p className="text-slate-500 text-sm">Live broadcast and engagement monitoring.</p>
             </div>
          </MotionCard>
        </TabsContent>
        
      </Tabs>
    </div>
  );
}
