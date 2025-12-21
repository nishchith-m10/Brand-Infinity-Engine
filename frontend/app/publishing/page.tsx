'use client';

import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Clock,
  Send,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { publisherApi, type Publication, type Variant, type ScheduleRequest } from '@/lib/api-client';
import { formatDate, getPlatformColor, getPlatformIcon } from '@/lib/utils';

// Mock variants data
const mockVariants: Variant[] = [
  {
    variant_id: 'var_001',
    video_id: 'video_001',
    platform: 'tiktok',
    aspect_ratio: '9:16',
    duration_seconds: 30,
    caption: 'The future is here 🚀 #tech #innovation',
    hashtags: ['tech', 'innovation'],
    status: 'ready',
    created_at: new Date().toISOString(),
  },
  {
    variant_id: 'var_002',
    video_id: 'video_001',
    platform: 'instagram_reels',
    aspect_ratio: '9:16',
    duration_seconds: 30,
    caption: 'Game changer! Link in bio',
    hashtags: ['reels', 'trending'],
    status: 'ready',
    created_at: new Date().toISOString(),
  },
  {
    variant_id: 'var_003',
    video_id: 'video_001',
    platform: 'youtube_shorts',
    aspect_ratio: '9:16',
    duration_seconds: 30,
    caption: 'You need to see this! #shorts',
    hashtags: ['shorts'],
    status: 'ready',
    created_at: new Date().toISOString(),
  },
];

// Mock scheduled posts
const mockScheduledPosts: (Publication & { variant?: Variant })[] = [
  {
    publication_id: 'pub_001',
    variant_id: 'var_001',
    platform: 'tiktok',
    status: 'scheduled',
    scheduled_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    variant: mockVariants[0],
  },
  {
    publication_id: 'pub_002',
    variant_id: 'var_002',
    platform: 'instagram',
    status: 'scheduled',
    scheduled_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
    variant: mockVariants[1],
  },
  {
    publication_id: 'pub_003',
    variant_id: 'var_003',
    platform: 'youtube',
    status: 'published',
    scheduled_time: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    published_at: new Date(Date.now() - 86400000).toISOString(),
    variant: mockVariants[2],
    platform_post_id: 'yt_abc123',
    engagement: { views: 1250, likes: 89, comments: 12, shares: 5 },
  },
];

// Platform display names
const PLATFORM_NAMES: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  instagram_reels: 'Instagram Reels',
  instagram_feed: 'Instagram Feed',
  youtube: 'YouTube',
  youtube_shorts: 'YouTube Shorts',
  youtube_feed: 'YouTube',
  facebook: 'Facebook',
  facebook_feed: 'Facebook',
  linkedin: 'LinkedIn',
  linkedin_feed: 'LinkedIn',
  twitter: 'X (Twitter)',
  twitter_feed: 'X (Twitter)',
};

// Get days in month
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

// Get first day of month (0 = Sunday)
const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

export default function PublishingPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPostDetail, setShowPostDetail] = useState(false);
  const [selectedPost, setSelectedPost] = useState<(Publication & { variant?: Variant }) | null>(null);
  const [scheduledPosts, setScheduledPosts] = useState(mockScheduledPosts);

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    variantId: '',
    date: '',
    time: '10:00',
    caption: '',
    hashtags: '',
  });

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);

  // Group posts by date
  const postsByDate = useMemo(() => {
    const grouped: Record<string, Publication[]> = {};
    scheduledPosts.forEach((post) => {
      const date = new Date(post.scheduled_time || '').toDateString();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(post);
    });
    return grouped;
  }, [scheduledPosts]);

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: async (data: { variantId: string; request: ScheduleRequest }) => {
      const response = await publisherApi.schedulePost(data.variantId, data.request);
      return response.data;
    },
    onSuccess: () => {
      setShowScheduleModal(false);
      setScheduleForm({ variantId: '', date: '', time: '10:00', caption: '', hashtags: '' });
    },
  });

  // Publish now mutation
  const publishNowMutation = useMutation({
    mutationFn: async (variantId: string) => {
      const response = await publisherApi.publishNow(variantId);
      return response.data;
    },
  });

  // Cancel scheduled post
  const handleCancelPost = (postId: string) => {
    setScheduledPosts((prev) => prev.filter((p) => p.publication_id !== postId));
    setShowPostDetail(false);
    setSelectedPost(null);
  };

  const handleSchedule = () => {
    if (!scheduleForm.variantId || !scheduleForm.date || !scheduleForm.time) return;

    const scheduledTime = new Date(`${scheduleForm.date}T${scheduleForm.time}`);
    
    // For demo, add to local state
    const variant = mockVariants.find((v) => v.variant_id === scheduleForm.variantId);
    const newPost: Publication & { variant?: Variant } = {
      publication_id: `pub_${Date.now()}`,
      variant_id: scheduleForm.variantId,
      platform: variant?.platform || 'unknown',
      status: 'scheduled',
      scheduled_time: scheduledTime.toISOString(),
      variant,
    };
    
    setScheduledPosts((prev) => [...prev, newPost]);
    setShowScheduleModal(false);
    setScheduleForm({ variantId: '', date: '', time: '10:00', caption: '', hashtags: '' });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Publishing</h1>
          <p className="mt-2 text-sm text-gray-600">
            Schedule and manage your social media posts
          </p>
        </div>
        <Button onClick={() => setShowScheduleModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
          Schedule Post
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {scheduledPosts.filter((p) => p.status === 'scheduled').length}
                </p>
                <p className="text-sm text-gray-500">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {scheduledPosts.filter((p) => p.status === 'published').length}
                </p>
                <p className="text-sm text-gray-500">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {scheduledPosts.filter((p) => p.status === 'failed').length}
                </p>
                <p className="text-sm text-gray-500">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-2">
                <Send className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{scheduledPosts.length}</p>
                <p className="text-sm text-gray-500">Total Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Publishing Calendar</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[140px] text-center font-medium">
                {monthNames[currentMonth]} {currentYear}
              </span>
              <Button variant="ghost" size="sm" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-xs font-medium text-gray-500"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before first of month */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square p-1" />
              ))}

              {/* Days of month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new Date(currentYear, currentMonth, day);
                const dateString = date.toDateString();
                const posts = postsByDate[dateString] || [];
                const isToday = new Date().toDateString() === dateString;
                const isSelected = selectedDate?.toDateString() === dateString;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(date)}
                    className={`aspect-square rounded-lg p-1 text-sm transition-colors ${
                      isToday
                        ? 'bg-blue-100 font-bold text-blue-700'
                        : isSelected
                        ? 'bg-gray-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex h-full flex-col">
                      <span className="text-right">{day}</span>
                      {posts.length > 0 && (
                        <div className="mt-auto flex flex-wrap gap-0.5">
                          {posts.slice(0, 3).map((post) => (
                            <div
                              key={post.publication_id}
                              className={`h-1.5 w-1.5 rounded-full ${
                                post.status === 'published'
                                  ? 'bg-green-500'
                                  : post.status === 'scheduled'
                                  ? 'bg-blue-500'
                                  : 'bg-red-500'
                              }`}
                            />
                          ))}
                          {posts.length > 3 && (
                            <span className="text-[8px] text-gray-400">
                              +{posts.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Posts */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate
                ? `Posts for ${selectedDate.toLocaleDateString()}`
                : 'Upcoming Posts'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const postsToShow = selectedDate
                ? scheduledPosts.filter(
                    (p) =>
                      new Date(p.scheduled_time || '').toDateString() ===
                      selectedDate.toDateString()
                  )
                : scheduledPosts
                    .filter((p) => p.status === 'scheduled')
                    .sort(
                      (a, b) =>
                        new Date(a.scheduled_time || '').getTime() -
                        new Date(b.scheduled_time || '').getTime()
                    )
                    .slice(0, 5);

              if (postsToShow.length === 0) {
                return (
                  <div className="py-8 text-center text-sm text-gray-500">
                    {selectedDate ? 'No posts scheduled' : 'No upcoming posts'}
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {postsToShow.map((post) => (
                    <button
                      key={post.publication_id}
                      onClick={() => {
                        setSelectedPost(post);
                        setShowPostDetail(true);
                      }}
                      className="w-full rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">
                          {getPlatformIcon(post.platform)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {PLATFORM_NAMES[post.platform] || post.platform}
                            </span>
                            <Badge variant="status" status={post.status}>
                              {post.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {formatDate(post.scheduled_time || '')}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Schedule Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Schedule Post"
        description="Select a variant and schedule it for publishing"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Select Variant"
            options={mockVariants.map((v) => ({
              value: v.variant_id,
              label: `${PLATFORM_NAMES[v.platform] || v.platform} - ${v.duration_seconds}s`,
            }))}
            value={scheduleForm.variantId}
            onChange={(e) =>
              setScheduleForm((prev) => ({ ...prev, variantId: e.target.value }))
            }
            placeholder="Choose a variant"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Date"
              type="date"
              value={scheduleForm.date}
              onChange={(e) =>
                setScheduleForm((prev) => ({ ...prev, date: e.target.value }))
              }
              min={new Date().toISOString().split('T')[0]}
            />
            <Input
              label="Time"
              type="time"
              value={scheduleForm.time}
              onChange={(e) =>
                setScheduleForm((prev) => ({ ...prev, time: e.target.value }))
              }
            />
          </div>

          <Textarea
            label="Caption (optional override)"
            placeholder="Leave empty to use variant caption"
            value={scheduleForm.caption}
            onChange={(e) =>
              setScheduleForm((prev) => ({ ...prev, caption: e.target.value }))
            }
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowScheduleModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={!scheduleForm.variantId || !scheduleForm.date}
              isLoading={scheduleMutation.isPending}
            >
              Schedule
            </Button>
          </div>
        </div>
      </Modal>

      {/* Post Detail Modal */}
      <Modal
        isOpen={showPostDetail}
        onClose={() => {
          setShowPostDetail(false);
          setSelectedPost(null);
        }}
        title="Post Details"
        size="md"
      >
        {selectedPost && (
          <div className="space-y-6">
            {/* Platform & Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl ${getPlatformColor(
                    selectedPost.platform
                  )}`}
                >
                  {getPlatformIcon(selectedPost.platform)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {PLATFORM_NAMES[selectedPost.platform] || selectedPost.platform}
                  </p>
                  <Badge variant="status" status={selectedPost.status}>
                    {selectedPost.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Schedule Info */}
            <div className="rounded-lg bg-gray-50 p-4">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Scheduled For</dt>
                  <dd className="text-gray-900">
                    {formatDate(selectedPost.scheduled_time || '')}
                  </dd>
                </div>
                {selectedPost.published_at && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Published At</dt>
                    <dd className="text-gray-900">
                      {formatDate(selectedPost.published_at)}
                    </dd>
                  </div>
                )}
                {selectedPost.platform_post_id && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Platform Post ID</dt>
                    <dd className="font-mono text-gray-900">
                      {selectedPost.platform_post_id}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Engagement (if published) */}
            {selectedPost.engagement && (
              <div>
                <h4 className="mb-3 font-medium text-gray-900">Engagement</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {selectedPost.engagement.views}
                    </p>
                    <p className="text-xs text-gray-500">Views</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {selectedPost.engagement.likes}
                    </p>
                    <p className="text-xs text-gray-500">Likes</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {selectedPost.engagement.comments}
                    </p>
                    <p className="text-xs text-gray-500">Comments</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {selectedPost.engagement.shares}
                    </p>
                    <p className="text-xs text-gray-500">Shares</p>
                  </div>
                </div>
              </div>
            )}

            {/* Caption */}
            {selectedPost.variant?.caption && (
              <div>
                <h4 className="mb-2 font-medium text-gray-900">Caption</h4>
                <p className="text-sm text-gray-600">{selectedPost.variant.caption}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              {selectedPost.status === 'scheduled' && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => handleCancelPost(selectedPost.publication_id)}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() =>
                      publishNowMutation.mutate(selectedPost.variant_id)
                    }
                    isLoading={publishNowMutation.isPending}
                    leftIcon={<Send className="h-4 w-4" />}
                  >
                    Publish Now
                  </Button>
                </>
              )}
              {selectedPost.status !== 'scheduled' && (
                <Button variant="outline" onClick={() => setShowPostDetail(false)}>
                  Close
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
