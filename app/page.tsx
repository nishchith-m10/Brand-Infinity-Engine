'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { 
  Activity, 
  TrendingUp, 
  Video, 
  Calendar, 
  ArrowRight, 
  Play,
  CheckCircle,
  Clock,
  Zap,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { healthApi } from '@/lib/api-client';
import { formatDate, formatNumber, getPlatformIcon } from '@/lib/utils';

// Mock data for dashboard
const mockStats = {
  activeCampaigns: 3,
  videosGenerated: 12,
  scheduledPosts: 8,
  engagementRate: 8.9,
};

const mockRecentActivity = [
  {
    id: '1',
    type: 'video_generated',
    title: 'Video Generated',
    description: 'Summer Product Launch - 3 scenes, $15 cost',
    time: '2 minutes ago',
    status: 'success',
  },
  {
    id: '2',
    type: 'post_scheduled',
    title: 'Post Scheduled',
    description: 'TikTok - Dec 21, 2025 at 10:00 AM',
    time: '5 minutes ago',
    status: 'pending',
  },
  {
    id: '3',
    type: 'brief_approved',
    title: 'Brief Approved',
    description: 'Fall Collection - 92% brand alignment',
    time: '1 hour ago',
    status: 'success',
  },
  {
    id: '4',
    type: 'variant_created',
    title: 'Variants Created',
    description: '4 variants for Instagram, TikTok, YouTube',
    time: '2 hours ago',
    status: 'success',
  },
];

const mockUpcomingPosts = [
  {
    id: '1',
    platform: 'tiktok',
    campaignName: 'Summer Launch',
    scheduledTime: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: '2',
    platform: 'instagram_reels',
    campaignName: 'Product Demo',
    scheduledTime: new Date(Date.now() + 172800000).toISOString(),
  },
  {
    id: '3',
    platform: 'youtube_shorts',
    campaignName: 'Behind the Scenes',
    scheduledTime: new Date(Date.now() + 259200000).toISOString(),
  },
];

const PLATFORM_NAMES: Record<string, string> = {
  tiktok: 'TikTok',
  instagram_reels: 'Instagram Reels',
  youtube_shorts: 'YouTube Shorts',
};

import { motion, Variants } from 'framer-motion';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function Dashboard() {
  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await healthApi.check();
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const stats = [
    { 
      name: 'Active Campaigns', 
      value: mockStats.activeCampaigns, 
      icon: Activity, 
      change: '+2 this week',
      href: '/campaigns',
      color: 'bg-blue-100 text-blue-600',
    },
    { 
      name: 'Videos Generated', 
      value: mockStats.videosGenerated, 
      icon: Video, 
      change: '+5 this week',
      href: '/videos',
      color: 'bg-green-100 text-green-600',
    },
    { 
      name: 'Scheduled Posts', 
      value: mockStats.scheduledPosts, 
      icon: Calendar, 
      change: '+3 upcoming',
      href: '/publishing',
      color: 'bg-purple-100 text-purple-600',
    },
    { 
      name: 'Engagement Rate', 
      value: `${mockStats.engagementRate}%`, 
      icon: TrendingUp, 
      change: '+1.2% vs last week',
      href: '/analytics',
      color: 'bg-yellow-100 text-yellow-600',
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'video_generated':
        return <Video className="h-5 w-5 text-green-600" />;
      case 'post_scheduled':
        return <Calendar className="h-5 w-5 text-blue-600" />;
      case 'brief_approved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'variant_created':
        return <Zap className="h-5 w-5 text-purple-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <motion.div 
      className="p-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item} className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Welcome to Brand Infinity
          </p>
        </div>
        <Link href="/campaigns">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </motion.div>

      {/* API Status */}
      <motion.div variants={item} className="mb-8 rounded-lg bg-white p-4 shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${healthData?.data?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium">
              API Status: {healthData?.data?.status || 'checking...'}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            v{healthData?.data?.version || '1.0.0'}
          </span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={item} className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.name} href={stat.href}>
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="mt-2 text-3xl font-semibold text-gray-900">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{stat.change}</p>
                  </div>
                  <div className={`rounded-full p-3 ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Quick Actions */}
        <motion.div variants={item} className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/campaigns" className="block">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="rounded-lg bg-blue-100 p-2">
                    <Zap className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Create Campaign</p>
                    <p className="text-sm text-gray-500">Generate new content</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </motion.button>
              </Link>
              
              <Link href="/review" className="block">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="rounded-lg bg-green-100 p-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Review Content</p>
                    <p className="text-sm text-gray-500">Approve pending items</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </motion.button>
              </Link>
              
              <Link href="/publishing" className="block">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="rounded-lg bg-purple-100 p-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Schedule Post</p>
                    <p className="text-sm text-gray-500">Plan your content</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </motion.button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <Link href="/analytics" className="text-sm text-blue-600 hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockRecentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 rounded-lg border border-gray-200 p-4"
                  >
                    <div className="rounded-full bg-gray-100 p-2">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {activity.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={activity.status === 'success' ? 'success' : 'secondary'}
                      >
                        {activity.status}
                      </Badge>
                      <p className="mt-1 text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Upcoming Posts */}
      <motion.div variants={item} className="mt-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Posts</CardTitle>
            <Link href="/publishing" className="text-sm text-blue-600 hover:underline">
              View calendar
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {mockUpcomingPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-4 rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-2xl">
                    {getPlatformIcon(post.platform)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">
                      {PLATFORM_NAMES[post.platform] || post.platform}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{post.campaignName}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(post.scheduledTime)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
