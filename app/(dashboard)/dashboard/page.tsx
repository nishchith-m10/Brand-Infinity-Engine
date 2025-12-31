'use client';

import { 
  Megaphone, 
  Video, 
  Share2, 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { useDashboardStats, useCampaigns } from '@/lib/hooks/use-api';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  campaigns: Megaphone,
  videos: Video,
  content: Share2,
  views: BarChart3,
};

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: campaigns } = useCampaigns();

  // Default stats structure
  const defaultStats = [
    { name: 'Active Campaigns', value: '0', icon: 'campaigns', change: '0 active', changeType: 'positive' },
    { name: 'Videos Generated', value: '0', icon: 'videos', change: '0 processing', changeType: 'positive' },
    { name: 'Published Content', value: '0', icon: 'content', change: '', changeType: 'positive' },
    { name: 'Cost (This Month)', value: '$0.00', icon: 'views', change: 'Usage', changeType: 'positive' },
  ];

  // Format large numbers
  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  // Merge API data with default structure - using v1 API field names
  const displayStats = stats ? [
    { name: 'Total Campaigns', value: formatValue(stats.campaigns?.total || 0), icon: 'campaigns', change: `${stats.campaigns?.active || 0} active`, changeType: 'positive' },
    { name: 'Videos Produced', value: formatValue(stats.videos?.completed || 0), icon: 'videos', change: `${stats.videos?.processing || 0} processing`, changeType: 'positive' },
    { name: 'Published', value: formatValue(stats.publications?.total_published || 0), icon: 'content', change: '', changeType: 'positive' },
    { name: 'Cost (This Month)', value: `$${stats.cost?.this_month_usd || '0.00'}`, icon: 'views', change: 'Usage', changeType: 'positive' },
  ] : defaultStats;

  // Format activity data from recent campaigns
  const displayActivity = stats?.recent_activity || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        <p className="mt-2 text-slate-500">Welcome back! Here&apos;s an overview of your content engine.</p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
        {statsLoading ? (
          // Loading skeleton
          Array(4).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 w-24 bg-slate-200 rounded mb-2"></div>
                  <div className="h-8 w-16 bg-slate-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          displayStats.map((stat) => {
            const Icon = iconMap[stat.icon] || BarChart3;
            const isPositive = stat.changeType === 'positive';
            const linkMap: Record<string, string> = {
              campaigns: '/campaigns',
              videos: '/videos',
              content: '/publishing',
              views: '/analytics',
            };
            
            return (
              <Link 
                key={stat.name}
                href={linkMap[stat.icon] || '#'} 
                className="block transition-transform hover:-translate-y-1 duration-200"
              >
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-slate-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                        <p className="mt-1 text-3xl font-bold text-slate-800">{stat.value}</p>
                      </div>
                      <div className="rounded-full bg-lamaSkyLight p-3 transition-colors group-hover:bg-lamaSky/10">
                        <Icon className="h-6 w-6 text-lamaSky" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center">
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`ml-1 text-sm font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                        {stat.change}
                      </span>
                      <span className="ml-2 text-sm text-slate-400">vs last month</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardContent className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Recent Activity</h2>
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : displayActivity.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                <Clock className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium">No recent activity</p>
              <p className="text-sm text-slate-400 mt-1">Start a campaign to see activity here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayActivity.map((item: { campaign_id: string; campaign_name: string; status: string; created_at: string; updated_at: string }, i: number) => {
                const isSuccess = item.status === 'active' || item.status === 'completed';
                return (
                  <div key={item.campaign_id || i} className="flex items-center gap-4 rounded-lg bg-slate-50 p-4">
                    <div className={`rounded-full p-2 ${isSuccess ? 'bg-green-100' : 'bg-lamaYellowLight'}`}>
                      {isSuccess ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{item.campaign_name || 'Campaign'}</p>
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        <Clock className="h-3 w-3" />
                        {new Date(item.updated_at || item.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
