import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    completed: 'bg-green-100 text-green-800',
    generating: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    ready: 'bg-green-100 text-green-800',
    published: 'bg-purple-100 text-purple-800',
    scheduled: 'bg-blue-100 text-blue-800',
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    tiktok: 'bg-black text-white',
    instagram: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    instagram_reels: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    instagram_feed: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    youtube: 'bg-red-600 text-white',
    youtube_shorts: 'bg-red-600 text-white',
    youtube_feed: 'bg-red-600 text-white',
    facebook: 'bg-blue-600 text-white',
    facebook_feed: 'bg-blue-600 text-white',
    linkedin: 'bg-blue-700 text-white',
    linkedin_feed: 'bg-blue-700 text-white',
    twitter: 'bg-sky-500 text-white',
    twitter_feed: 'bg-sky-500 text-white',
  };
  return colors[platform.toLowerCase()] || 'bg-gray-500 text-white';
}

export function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    tiktok: '🎵',
    instagram: '📸',
    instagram_reels: '🎬',
    instagram_feed: '📸',
    youtube: '▶️',
    youtube_shorts: '📺',
    youtube_feed: '▶️',
    facebook: '👤',
    facebook_feed: '👤',
    linkedin: '💼',
    linkedin_feed: '💼',
    twitter: '🐦',
    twitter_feed: '🐦',
  };
  return icons[platform.toLowerCase()] || '📱';
}
