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
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { healthApi } from '@/lib/api-client';
import { formatDate, formatNumber, getPlatformIcon } from '@/lib/utils';

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
      value: 0, 
      icon: Activity, 
      change: 'No campaigns yet',
      href: '/campaigns',
      color: 'bg-blue-100 text-blue-600',
    },
    { 
      name: 'Videos Generated', 
      value: 0, 
      icon: Video, 
      change: 'No videos yet',
      href: '/videos',
      color: 'bg-green-100 text-green-600',
    },
    { 
      name: 'Scheduled Posts', 
      value: 0, 
      icon: Calendar, 
      change: 'No posts scheduled',
      href: '/publishing',
      color: 'bg-purple-100 text-purple-600',
    },
    { 
      name: 'Engagement Rate', 
      value: '0%', 
      icon: TrendingUp, 
      change: 'No data yet',
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
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-lamaPurpleLight text-slate-900 hover:bg-lamaPurple hover:text-white transition-colors font-medium text-sm"
                >
                  <Sparkles className="h-4 w-4 text-slate-900" />
                  <span className="text-slate-900">Schedule Post</span>
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
                {/* Empty state - no recent activity */}
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-600">No recent activity</p>
                  <p className="text-xs text-gray-500 mt-1">Activity will appear here as you use the platform</p>
                </div>
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
              {/* Empty state - no upcoming posts */}
              <div className="col-span-3 flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-600">No upcoming posts</p>
                <p className="text-xs text-gray-500 mt-1">Schedule posts in the Publishing section</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
