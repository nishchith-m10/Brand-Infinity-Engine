/**
 * TikTok Publishing API Adapter
 * Phase 10: Social Publishing Integration
 * 
 * Implements TikTok Content Posting API v2 for video publishing.
 * https://developers.tiktok.com/doc/content-posting-api/
 * 
 * Prerequisites:
 * - TikTok Developer App with Content Posting permissions
 * - OAuth 2.0 access token with video.upload and video.publish scopes
 * - User must have completed OAuth flow and stored access_token
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

// Post privacy levels
export type TikTokPrivacyLevel = 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY' | 'FOLLOWER_OF_CREATOR';

// Post info
export interface TikTokPostInfo {
  title?: string;
  privacyLevel?: TikTokPrivacyLevel;
  disableDuet?: boolean;
  disableStitch?: boolean;
  disableComment?: boolean;
  videoCoverTimestampMs?: number;
  brandContentToggle?: boolean;
  brandOrganicToggle?: boolean;
}

export interface TikTokPublishRequest {
  videoUrl?: string;       // Source video URL (for URL-based upload)
  videoPath?: string;      // Local video path (for file upload)
  videoBuffer?: Buffer;    // Video buffer (for in-memory upload)
  caption?: string;
  postInfo?: TikTokPostInfo;
}

export interface TikTokPublishResponse {
  publishId: string;
  status: 'processing' | 'published' | 'failed';
  shareUrl?: string;
  error?: { code: string; message: string };
}

export interface TikTokUploadStatus {
  status: 'IN_PROGRESS' | 'DOWNLOAD_COMPLETE' | 'DOWNLOAD_FAILED' | 
          'PUBLISH_COMPLETE' | 'PUBLISH_FAILED' | 'PAUSED' | 'CANCELED';
  publishId?: string;
  shareUrl?: string;
  failReason?: string;
}

export class TikTokAdapter {
  private accessToken: string | null;
  private accessTokenPromise: Promise<string | null>;
  private userId?: string;

  constructor(accessToken?: string, userId?: string) {
    this.userId = userId;
    
    if (accessToken) {
      this.accessToken = accessToken;
      this.accessTokenPromise = Promise.resolve(accessToken);
    } else {
      this.accessToken = null;
      // TikTok uses OAuth access_token stored as the "key"
      this.accessTokenPromise = getEffectiveProviderKey('tiktok', process.env.TIKTOK_ACCESS_TOKEN, userId);
    }
  }

  private async ensureAccessToken(): Promise<string> {
    if (!this.accessToken) {
      this.accessToken = await this.accessTokenPromise;
    }
    if (!this.accessToken) {
      throw new Error(
        'TikTok access token not configured. Please connect your TikTok account in Settings.'
      );
    }
    return this.accessToken;
  }

  /**
   * Publish video from URL (Direct Post method)
   * TikTok will download the video from the provided URL
   */
  async publishVideoFromUrl(request: TikTokPublishRequest): Promise<TikTokPublishResponse> {
    const accessToken = await this.ensureAccessToken();
    
    if (!request.videoUrl) {
      throw new Error('videoUrl is required for URL-based upload');
    }

    const postInfo: Record<string, unknown> = {
      privacy_level: request.postInfo?.privacyLevel || 'SELF_ONLY', // Default to private for safety
      disable_duet: request.postInfo?.disableDuet ?? false,
      disable_stitch: request.postInfo?.disableStitch ?? false,
      disable_comment: request.postInfo?.disableComment ?? false,
    };

    if (request.caption) {
      postInfo.title = request.caption.substring(0, 150); // TikTok title limit
    }

    if (request.postInfo?.videoCoverTimestampMs) {
      postInfo.video_cover_timestamp_ms = request.postInfo.videoCoverTimestampMs;
    }

    if (request.postInfo?.brandContentToggle !== undefined) {
      postInfo.brand_content_toggle = request.postInfo.brandContentToggle;
    }

    if (request.postInfo?.brandOrganicToggle !== undefined) {
      postInfo.brand_organic_toggle = request.postInfo.brandOrganicToggle;
    }

    const response = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: postInfo,
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: request.videoUrl,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `TikTok API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();

    if (data.error?.code !== 'ok') {
      throw new Error(`TikTok publish failed: ${data.error?.message || 'Unknown error'}`);
    }

    return {
      publishId: data.data.publish_id,
      status: 'processing',
    };
  }

  /**
   * Check the status of a video publish operation
   */
  async getPublishStatus(publishId: string): Promise<TikTokUploadStatus> {
    const accessToken = await this.ensureAccessToken();

    const response = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        publish_id: publishId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `TikTok API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();

    if (data.error?.code !== 'ok') {
      throw new Error(`TikTok status fetch failed: ${data.error?.message || 'Unknown error'}`);
    }

    return {
      status: data.data.status,
      publishId: data.data.publish_id,
      failReason: data.data.fail_reason,
    };
  }

  /**
   * Wait for publish to complete with polling
   */
  async waitForPublishComplete(
    publishId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<TikTokUploadStatus> {
    const { timeoutMs = 300000, pollIntervalMs = 10000 } = options; // 5 min timeout, 10 sec poll
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getPublishStatus(publishId);

      if (status.status === 'PUBLISH_COMPLETE') {
        return status;
      }

      if (status.status === 'PUBLISH_FAILED' || status.status === 'DOWNLOAD_FAILED') {
        throw new Error(`TikTok publish failed: ${status.failReason || 'Unknown error'}`);
      }

      if (status.status === 'CANCELED') {
        throw new Error('TikTok publish was canceled');
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`TikTok publish timed out after ${timeoutMs / 1000} seconds`);
  }

  /**
   * Full publish flow: upload and wait for completion
   */
  async publishVideo(request: TikTokPublishRequest): Promise<{
    publishId: string;
    status: string;
    shareUrl?: string;
  }> {
    // Start the publish process
    const initResult = await this.publishVideoFromUrl(request);
    
    // Wait for completion
    const finalStatus = await this.waitForPublishComplete(initResult.publishId);

    return {
      publishId: finalStatus.publishId || initResult.publishId,
      status: finalStatus.status,
      shareUrl: finalStatus.shareUrl,
    };
  }

  /**
   * Get current user info
   */
  async getUserInfo(): Promise<{ openId: string; displayName: string; avatarUrl: string }> {
    const accessToken = await this.ensureAccessToken();

    const response = await fetch(`${TIKTOK_API_BASE}/user/info/?fields=open_id,display_name,avatar_url`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    const data = await response.json();

    return {
      openId: data.data.user.open_id,
      displayName: data.data.user.display_name,
      avatarUrl: data.data.user.avatar_url,
    };
  }

  /**
   * Check if configured
   */
  isConfigured(): boolean {
    return !!this.accessToken || !!process.env.TIKTOK_ACCESS_TOKEN;
  }

  /**
   * Get OAuth authorization URL for user to connect their account
   */
  static getAuthorizationUrl(clientKey: string, redirectUri: string, state: string): string {
    const scopes = 'user.info.basic,video.upload,video.publish';
    return `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(clientKey)}&scope=${encodeURIComponent(scopes)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  }
}

/**
 * Factory function
 */
export function createTikTokAdapter(accessToken?: string, userId?: string): TikTokAdapter {
  return new TikTokAdapter(accessToken, userId);
}

/**
 * Get adapter instance
 */
export function getTikTokAdapter(accessToken?: string, userId?: string): TikTokAdapter {
  return new TikTokAdapter(accessToken, userId);
}

/**
 * Check if TikTok is configured
 */
export function isTikTokConfigured(): boolean {
  return !!process.env.TIKTOK_ACCESS_TOKEN;
}
