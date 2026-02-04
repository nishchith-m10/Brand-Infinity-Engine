'use client';

/**
 * PlatformPreview Component
 * 
 * Shows platform-specific previews with device mockups before publishing.
 * Displays aspect ratio constraints and duration limits.
 * 
 * Phase 3: UX Improvements - Preview Before Publish
 */

import React, { useState } from 'react';

export type Platform = 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'facebook' | 'linkedin';

interface PlatformPreviewProps {
  contentUrl: string; // URL to video or image
  contentType: 'video' | 'image';
  platform: Platform;
  caption?: string;
  hashtags?: string[];
  className?: string;
}

interface PlatformSpec {
  name: string;
  aspectRatio: string;
  maxDuration?: number; // seconds
  dimensions: { width: number; height: number };
  frameColor: string;
  icon: string;
}

const PLATFORM_SPECS: Record<Platform, PlatformSpec> = {
  tiktok: {
    name: 'TikTok',
    aspectRatio: '9:16',
    maxDuration: 180, // 3 minutes
    dimensions: { width: 270, height: 480 },
    frameColor: 'bg-black',
    icon: '♪',
  },
  instagram_reels: {
    name: 'Instagram Reels',
    aspectRatio: '9:16',
    maxDuration: 90,
    dimensions: { width: 270, height: 480 },
    frameColor: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400',
    icon: '📷',
  },
  youtube_shorts: {
    name: 'YouTube Shorts',
    aspectRatio: '9:16',
    maxDuration: 60,
    dimensions: { width: 270, height: 480 },
    frameColor: 'bg-red-600',
    icon: '▶️',
  },
  facebook: {
    name: 'Facebook',
    aspectRatio: '16:9',
    maxDuration: 240,
    dimensions: { width: 400, height: 225 },
    frameColor: 'bg-blue-600',
    icon: 'f',
  },
  linkedin: {
    name: 'LinkedIn',
    aspectRatio: '16:9',
    maxDuration: 600,
    dimensions: { width: 400, height: 225 },
    frameColor: 'bg-blue-700',
    icon: 'in',
  },
};

export function PlatformPreview({
  contentUrl,
  contentType,
  platform,
  caption,
  hashtags,
  className = '',
}: PlatformPreviewProps) {
  const spec = PLATFORM_SPECS[platform];
  const isVertical = spec.aspectRatio === '9:16';

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Platform Badge */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm font-medium mb-3 ${spec.frameColor}`}>
        <span>{spec.icon}</span>
        <span>{spec.name}</span>
      </div>

      {/* Device Frame */}
      <div
        className={`relative rounded-[2rem] p-2 bg-gray-900 shadow-2xl ${
          isVertical ? 'w-[180px]' : 'w-[320px]'
        }`}
      >
        {/* Notch/Camera for vertical devices */}
        {isVertical && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-5 bg-black rounded-full z-10 flex items-center justify-center">
            <div className="w-2 h-2 bg-gray-700 rounded-full" />
          </div>
        )}

        {/* Screen */}
        <div
          className={`relative overflow-hidden bg-black ${
            isVertical ? 'rounded-[1.5rem] aspect-[9/16]' : 'rounded-lg aspect-video'
          }`}
        >
          {contentType === 'video' ? (
            <video
              src={contentUrl}
              className="w-full h-full object-cover"
              controls={false}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={contentUrl}
              alt="Content preview"
              className="w-full h-full object-cover"
            />
          )}

          {/* Platform UI Overlay */}
          <PlatformOverlay platform={platform} caption={caption} hashtags={hashtags} />
        </div>

        {/* Home indicator for vertical */}
        {isVertical && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-gray-600 rounded-full" />
        )}
      </div>

      {/* Specs Info */}
      <div className="mt-4 text-center text-xs text-gray-500">
        <p className="font-medium">{spec.aspectRatio} • {spec.dimensions.width}×{spec.dimensions.height}</p>
        {spec.maxDuration && (
          <p>Max Duration: {spec.maxDuration}s</p>
        )}
      </div>
    </div>
  );
}

/**
 * Platform-specific UI overlay on content
 */
function PlatformOverlay({
  platform,
  caption,
  hashtags,
}: { platform: Platform; caption?: string; hashtags?: string[] }) {
  const truncatedCaption = caption && caption.length > 80 
    ? caption.slice(0, 80) + '...' 
    : caption;

  return (
    <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none">
      {/* Top bar */}
      <div className="flex justify-between items-start">
        {platform === 'tiktok' && (
          <div className="text-white text-[10px] font-bold">Following | For You</div>
        )}
        {platform === 'instagram_reels' && (
          <div className="text-white text-[10px] font-bold">Reels</div>
        )}
        {platform === 'youtube_shorts' && (
          <div className="text-white text-[10px] font-bold">Shorts</div>
        )}
      </div>

      {/* Bottom info */}
      <div className="space-y-1">
        {/* Caption */}
        {truncatedCaption && (
          <p className="text-white text-[8px] drop-shadow-lg">{truncatedCaption}</p>
        )}
        
        {/* Hashtags */}
        {hashtags && hashtags.length > 0 && (
          <p className="text-blue-300 text-[8px]">
            {hashtags.slice(0, 3).join(' ')}
          </p>
        )}

        {/* Action buttons (visual only) */}
        <div className="flex justify-end">
          <div className="flex flex-col gap-2 items-center">
            {['❤️', '💬', '↗️', '🔖'].map((icon, i) => (
              <div key={i} className="w-6 h-6 flex items-center justify-center text-white text-sm">
                {icon}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Multi-platform preview grid
 */
export function MultiPlatformPreview({
  contentUrl,
  contentType,
  platforms = ['tiktok', 'instagram_reels', 'youtube_shorts'],
  caption,
  hashtags,
}: {
  contentUrl: string;
  contentType: 'video' | 'image';
  platforms?: Platform[];
  caption?: string;
  hashtags?: string[];
}) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(platforms[0]);

  return (
    <div className="w-full">
      {/* Platform Selector */}
      <div className="flex gap-2 mb-6 justify-center flex-wrap">
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPlatform(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedPlatform === p
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {PLATFORM_SPECS[p].icon} {PLATFORM_SPECS[p].name}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="flex justify-center">
        <PlatformPreview
          contentUrl={contentUrl}
          contentType={contentType}
          platform={selectedPlatform}
          caption={caption}
          hashtags={hashtags}
        />
      </div>

      {/* Warning if content doesn't match platform specs */}
      <PlatformWarnings platform={selectedPlatform} contentType={contentType} />
    </div>
  );
}

/**
 * Show warnings if content may not be optimal for platform
 */
function PlatformWarnings({ 
  platform, 
  contentType 
}: { platform: Platform; contentType: 'video' | 'image' }) {
  const spec = PLATFORM_SPECS[platform];
  
  // Example warnings - in production these would check actual content metadata
  const warnings: string[] = [];
  
  if (contentType === 'image' && platform !== 'facebook' && platform !== 'linkedin') {
    warnings.push(`${spec.name} is optimized for video content`);
  }

  if (warnings.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p className="text-xs text-yellow-800 font-medium">⚠️ Compatibility Notes:</p>
      <ul className="mt-1 text-xs text-yellow-700 list-disc list-inside">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

export default PlatformPreview;
