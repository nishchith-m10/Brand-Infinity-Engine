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
import { useDashboardStats, useDashboardActivity } from '@/lib/hooks/use-data';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  campaigns: Megaphone,
  videos: Video,
  content: Share2,
  views: BarChart3,
};

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activity, isLoading: activityLoading } = useDashboardActivity();

  // Default stats structure
  const defaultStats = [
    { name: 'Active Campaigns', value: '0', icon: 'campaigns', change: '+0%', changeType: 'positive' },
    { name: 'Videos Generated', value: '0', icon: 'videos', change: '+0%', changeType: 'positive' },
    { name: 'Published Content', value: '0', icon: 'content', change: '+0%', changeType: 'positive' },
    { name: 'Total Views', value: '0', icon: 'views', change: '+0%', changeType: 'positive' },
  ];

  // Format large numbers
  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  // Merge API data with default structure
  const displayStats = stats ? [
    { name: 'Active Campaigns', value: formatValue(stats.totalCampaigns || 0), icon: 'campaigns', change: '+2.5%', changeType: 'positive' },
    { name: 'Videos Generated', value: formatValue(stats.activeVideos || 0), icon: 'videos', change: '+12%', changeType: 'positive' },
    { name: 'Published Content', value: formatValue(stats.contentPieces || 0), icon: 'content', change: '+8.2%', changeType: 'positive' },
    { name: 'Total Views', value: formatValue(stats.totalViews || 0), icon: 'views', change: `+${stats.engagementRate || 0}%`, changeType: 'positive' },
  ] : defaultStats;

  // Format activity data
  const displayActivity = activity || [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        <p className="mt-2 text-slate-500">Welcome back! Here&apos;s an overview of your content engine.</p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                href={linkMap[stat.icon] || '#'} 
                key={stat.name}
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
          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : displayActivity.length === 0 ? (
            <p className="text-center py-8 text-slate-500">No recent activity</p>
          ) : (
            <div className="space-y-4">
              {displayActivity.map((item: { id: string; type: string; title: string; timestamp: string }) => {
                const isSuccess = item.type !== 'pending_review';
                return (
                  <div key={item.id} className="flex items-center gap-4 rounded-lg bg-slate-50 p-4">
                    <div className={`rounded-full p-2 ${isSuccess ? 'bg-green-100' : 'bg-lamaYellowLight'}`}>
                      {isSuccess ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{item.title}</p>
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        <Clock className="h-3 w-3" />
                        {new Date(item.timestamp).toLocaleString()}
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
