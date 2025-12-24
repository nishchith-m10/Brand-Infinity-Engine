'use client';

import { useState } from 'react';
import {
  Eye,
  Heart,
  MessageCircle,
  Share2,
  ArrowUp,
  ArrowDown,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { formatNumber, getPlatformColor } from '@/lib/utils';
import { useAnalytics } from '@/lib/hooks/use-data';
import { getPlatformIcon } from '@/lib/platform-icons';

// Mock analytics data
const mockOverviewData = {
  totalViews: 125400,
  totalLikes: 8920,
  totalComments: 1450,
  totalShares: 890,
  engagementRate: 8.9,
  viewsChange: 23.5,
  likesChange: 15.2,
  commentsChange: -5.3,
  sharesChange: 42.1,
};

const mockDailyStats = [
  { date: '2025-12-14', views: 12500, likes: 890, comments: 145, shares: 78 },
  { date: '2025-12-15', views: 15200, likes: 1020, comments: 178, shares: 92 },
  { date: '2025-12-16', views: 18900, likes: 1250, comments: 210, shares: 115 },
  { date: '2025-12-17', views: 21400, likes: 1480, comments: 245, shares: 134 },
  { date: '2025-12-18', views: 19800, likes: 1380, comments: 225, shares: 128 },
  { date: '2025-12-19', views: 22100, likes: 1520, comments: 268, shares: 148 },
  { date: '2025-12-20', views: 15500, likes: 1380, comments: 179, shares: 95 },
];

const mockPlatformStats = [
  {
    platform: 'tiktok',
    views: 58200,
    likes: 4250,
    comments: 720,
    shares: 420,
    engagementRate: 9.2,
    posts: 5,
  },
  {
    platform: 'instagram_reels',
    views: 35800,
    likes: 2680,
    comments: 380,
    shares: 245,
    engagementRate: 9.2,
    posts: 4,
  },
  {
    platform: 'youtube_shorts',
    views: 21400,
    likes: 1450,
    comments: 280,
    shares: 165,
    engagementRate: 8.8,
    posts: 3,
  },
  {
    platform: 'instagram_feed',
    views: 10000,
    likes: 540,
    comments: 70,
    shares: 60,
    engagementRate: 6.7,
    posts: 2,
  },
];

const mockTopContent = [
  {
    id: 'video_001',
    name: 'Summer Product Launch',
    platform: 'tiktok',
    views: 28500,
    likes: 2150,
    engagementRate: 12.4,
    thumbnail: null,
  },
  {
    id: 'video_002',
    name: 'Behind the Scenes',
    platform: 'instagram_reels',
    views: 18200,
    likes: 1420,
    engagementRate: 10.8,
    thumbnail: null,
  },
  {
    id: 'video_003',
    name: 'Product Tutorial',
    platform: 'youtube_shorts',
    views: 15600,
    likes: 980,
    engagementRate: 8.5,
    thumbnail: null,
  },
];

const PLATFORM_NAMES: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  instagram_reels: 'Instagram Reels',
  instagram_feed: 'Instagram Feed',
  youtube: 'YouTube',
  youtube_shorts: 'YouTube Shorts',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'X (Twitter)',
};

// StatCard component - defined outside render to prevent recreation
function StatCard({
  title,
  value,
  change,
  icon: Icon,
  iconColor,
}: {
  title: string;
  value: string | number;
  change: number;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
          <div className="mt-2 flex items-center gap-1">
            {change >= 0 ? (
              <ArrowUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <ArrowDown className="h-4 w-4 text-red-500" />
            )}
            <span
              className={`text-sm font-medium ${
                change >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {Math.abs(change).toFixed(1)}%
            </span>
            <span className="text-sm text-slate-500">vs last period</span>
          </div>
        </div>
        <div className={`rounded-2xl p-3 ${iconColor}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('views');

  // Use SWR for analytics data with caching
  const { data: analyticsData, isLoading } = useAnalytics(timeRange);
  
  // Use API data if available, fallback to mock data
  const overview = analyticsData?.overview || mockOverviewData;
  const dailyStats = analyticsData?.dailyStats || mockDailyStats;
  const platformStats = analyticsData?.platformStats || mockPlatformStats;

  // Calculate chart data
  const chartMax = Math.max(...dailyStats.map((d: Record<string, number>) => d[selectedMetric as keyof typeof d] as number));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-3xl m-4 flex-1 shadow-sm border border-slate-100/50">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="hidden md:block text-2xl font-bold text-slate-800">Analytics</h1>
        <div className="flex items-center gap-3">
          <Select
            options={[
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' },
              { value: 'year', label: 'This year' },
            ]}
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Overview Stats */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Views"
          value={overview.totalViews}
          change={overview.viewsChange}
          icon={Eye}
          iconColor="bg-lamaSkyLight text-lamaSky"
        />
        <StatCard
          title="Total Likes"
          value={overview.totalLikes}
          change={overview.likesChange}
          icon={Heart}
          iconColor="bg-red-100 text-red-600"
        />
        <StatCard
          title="Total Comments"
          value={overview.totalComments}
          change={overview.commentsChange}
          icon={MessageCircle}
          iconColor="bg-green-100 text-green-600"
        />
        <StatCard
          title="Total Shares"
          value={overview.totalShares}
          change={overview.sharesChange}
          icon={Share2}
          iconColor="bg-lamaPurpleLight text-lamaPurple"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Performance Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Performance Over Time</CardTitle>
            <div className="flex gap-2">
              {[
                { key: 'views', label: 'Views' },
                { key: 'likes', label: 'Likes' },
                { key: 'comments', label: 'Comments' },
                { key: 'shares', label: 'Shares' },
              ].map((metric) => (
                <button
                  key={metric.key}
                  onClick={() => setSelectedMetric(metric.key)}
                  className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                    selectedMetric === metric.key
                      ? 'bg-lamaSkyLight text-lamaSky'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {/* Simple Bar Chart */}
            <div className="h-64">
              <div className="flex h-full items-end justify-between gap-2">
                {dailyStats.map((day: { date: string; views: number; likes: number; comments: number; shares: number }) => {
                  const value = day[selectedMetric as keyof typeof day] as number;
                  const height = (value / chartMax) * 100;
                  const date = new Date(day.date);
                  
                  return (
                    <div
                      key={day.date}
                      className="group flex flex-1 flex-col items-center"
                    >
                      <div className="relative w-full flex-1">
                        <div
                          className="absolute bottom-0 w-full rounded-t-lg bg-lamaSky transition-all group-hover:bg-lamaSky/80"
                          style={{ height: `${height}%` }}
                        />
                        {/* Tooltip */}
                        <div className="absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                          {formatNumber(value)}
                        </div>
                      </div>
                      <span className="mt-2 text-xs text-gray-500">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              {/* Circular Progress */}
              <div className="relative h-40 w-40">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="rgb(14, 165, 233)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${overview.engagementRate * 28.27} 282.7`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-gray-900">
                    {overview.engagementRate}%
                  </span>
                  <span className="text-sm text-gray-500">Engagement</span>
                </div>
              </div>

              <div className="mt-6 w-full space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Industry Average</span>
                  <span className="font-medium text-gray-900">4.5%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Your Performance</span>
                  <span className="font-medium text-green-600">
                    +{(overview.engagementRate - 4.5).toFixed(1)}% above
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Breakdown */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Platform Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-left text-sm font-medium text-gray-500">
                    Platform
                  </th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-500">
                    Views
                  </th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-500">
                    Likes
                  </th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-500">
                    Comments
                  </th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-500">
                    Shares
                  </th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-500">
                    Engagement
                  </th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-500">
                    Posts
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {platformStats.map((platform: { platform: string; views: number; likes: number; comments: number; shares: number; engagementRate: number; posts: number }) => (
                  <tr key={platform.platform} className="group hover:bg-gray-50">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${getPlatformColor(
                            platform.platform
                          )}`}
                        >
                          {getPlatformIcon(platform.platform)}
                        </span>
                        <span className="font-medium text-gray-900">
                          {PLATFORM_NAMES[platform.platform] || platform.platform}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 text-right text-gray-900">
                      {formatNumber(platform.views)}
                    </td>
                    <td className="py-4 text-right text-gray-900">
                      {formatNumber(platform.likes)}
                    </td>
                    <td className="py-4 text-right text-gray-900">
                      {formatNumber(platform.comments)}
                    </td>
                    <td className="py-4 text-right text-gray-900">
                      {formatNumber(platform.shares)}
                    </td>
                    <td className="py-4 text-right">
                      <span className="font-medium text-green-600">
                        {platform.engagementRate}%
                      </span>
                    </td>
                    <td className="py-4 text-right text-gray-500">
                      {platform.posts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Performing Content */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Top Performing Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockTopContent.map((content, index) => (
              <div
                key={content.id}
                className="flex items-center gap-4 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600">
                  {index + 1}
                </div>
                <div className="aspect-video w-24 flex-shrink-0 rounded-lg bg-gray-200" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{content.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getPlatformColor(
                        content.platform
                      )}`}
                    >
                      {getPlatformIcon(content.platform)}{' '}
                      {PLATFORM_NAMES[content.platform]}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {formatNumber(content.views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      {formatNumber(content.likes)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    {content.engagementRate}%
                  </p>
                  <p className="text-xs text-gray-500">Engagement</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
