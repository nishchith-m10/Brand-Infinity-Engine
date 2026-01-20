/**
 * Instagram Publishing API Adapter
 * Phase 10: Social Publishing Integration
 * 
 * Implements Meta Graph API for Instagram Reels/Stories publishing.
 * https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 * 
 * Prerequisites:
 * - Meta Developer App with Instagram Content Publishing permission
 * - Instagram Business or Creator account linked to a Facebook Page
 * - User access token with instagram_content_publish scope
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

// Media types
export type InstagramMediaType = 'REELS' | 'STORIES' | 'IMAGE' | 'CAROUSEL';

// Container status
export type ContainerStatus = 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';

export interface InstagramPublishRequest {
  igUserId: string;          // Instagram Business Account ID
  videoUrl?: string;         // Video URL for Reels
  imageUrl?: string;         // Image URL for posts
  caption?: string;
  mediaType?: InstagramMediaType;
  shareToFeed?: boolean;     // For Reels: also share to feed
  coverUrl?: string;         // Cover image for Reels
  thumbOffset?: number;      // Thumbnail offset in ms
  locationId?: string;       // Location tag
  userTags?: Array<{ username: string; x?: number; y?: number }>;
}

export interface InstagramPublishResponse {
  mediaId: string;
  containerId: string;
  status: string;
  permalink?: string;
  error?: { code: number; message: string };
}

export interface ContainerStatusResponse {
  id: string;
  status_code: ContainerStatus;
  status?: string;
}

export class InstagramAdapter {
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
      this.accessTokenPromise = getEffectiveProviderKey('instagram', process.env.INSTAGRAM_ACCESS_TOKEN, userId);
    }
  }

  private async ensureAccessToken(): Promise<string> {
    if (!this.accessToken) {
      this.accessToken = await this.accessTokenPromise;
    }
    if (!this.accessToken) {
      throw new Error(
        'Instagram access token not configured. Please connect your Instagram account in Settings.'
      );
    }
    return this.accessToken;
  }

  /**
   * Step 1: Create a media container
   */
  async createMediaContainer(request: InstagramPublishRequest): Promise<string> {
    const accessToken = await this.ensureAccessToken();
    
    const params = new URLSearchParams({
      access_token: accessToken,
    });

    // Set media type and URL
    if (request.videoUrl) {
      params.append('media_type', request.mediaType || 'REELS');
      params.append('video_url', request.videoUrl);
      
      if (request.shareToFeed !== undefined) {
        params.append('share_to_feed', request.shareToFeed.toString());
      }
      
      if (request.coverUrl) {
        params.append('cover_url', request.coverUrl);
      }
      
      if (request.thumbOffset !== undefined) {
        params.append('thumb_offset', request.thumbOffset.toString());
      }
    } else if (request.imageUrl) {
      params.append('image_url', request.imageUrl);
    } else {
      throw new Error('Either videoUrl or imageUrl is required');
    }

    if (request.caption) {
      params.append('caption', request.caption);
    }

    if (request.locationId) {
      params.append('location_id', request.locationId);
    }

    const response = await fetch(`${GRAPH_API_BASE}/${request.igUserId}/media`, {
      method: 'POST',
      body: params,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Instagram API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    return data.id; // Container ID
  }

  /**
   * Step 2: Check container status
   */
  async getContainerStatus(containerId: string): Promise<ContainerStatusResponse> {
    const accessToken = await this.ensureAccessToken();

    const response = await fetch(
      `${GRAPH_API_BASE}/${containerId}?fields=status_code,status&access_token=${accessToken}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Instagram API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    return response.json();
  }

  /**
   * Wait for container to finish processing
   */
  async waitForContainerReady(
    containerId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<ContainerStatusResponse> {
    const { timeoutMs = 300000, pollIntervalMs = 10000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getContainerStatus(containerId);

      if (status.status_code === 'FINISHED') {
        return status;
      }

      if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
        throw new Error(`Container processing failed: ${status.status || status.status_code}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Container processing timed out after ${timeoutMs / 1000} seconds`);
  }

  /**
   * Step 3: Publish the container
   */
  async publishContainer(igUserId: string, containerId: string): Promise<string> {
    const accessToken = await this.ensureAccessToken();

    const params = new URLSearchParams({
      access_token: accessToken,
      creation_id: containerId,
    });

    const response = await fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
      method: 'POST',
      body: params,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Instagram publish error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();
    return data.id; // Media ID
  }

  /**
   * Get media permalink
   */
  async getMediaPermalink(mediaId: string): Promise<string> {
    const accessToken = await this.ensureAccessToken();

    const response = await fetch(
      `${GRAPH_API_BASE}/${mediaId}?fields=permalink&access_token=${accessToken}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`Failed to get permalink: ${response.status}`);
    }

    const data = await response.json();
    return data.permalink;
  }

  /**
   * Full publish flow: create container, wait, publish
   */
  async publishMedia(request: InstagramPublishRequest): Promise<InstagramPublishResponse> {
    // Step 1: Create container
    const containerId = await this.createMediaContainer(request);

    // Step 2: Wait for processing (videos take time)
    if (request.videoUrl) {
      await this.waitForContainerReady(containerId);
    }

    // Step 3: Publish
    const mediaId = await this.publishContainer(request.igUserId, containerId);

    // Get permalink
    let permalink: string | undefined;
    try {
      permalink = await this.getMediaPermalink(mediaId);
    } catch {
      // Permalink fetch is optional
    }

    return {
      mediaId,
      containerId,
      status: 'published',
      permalink,
    };
  }

  /**
   * Get Instagram Business Account ID from Page access token
   */
  async getInstagramBusinessAccountId(pageId: string): Promise<string> {
    const accessToken = await this.ensureAccessToken();

    const response = await fetch(
      `${GRAPH_API_BASE}/${pageId}?fields=instagram_business_account&access_token=${accessToken}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`Failed to get IG business account: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.instagram_business_account?.id) {
      throw new Error('No Instagram Business Account linked to this Facebook Page');
    }

    return data.instagram_business_account.id;
  }

  /**
   * Check if configured
   */
  isConfigured(): boolean {
    return !!this.accessToken || !!process.env.INSTAGRAM_ACCESS_TOKEN;
  }

  /**
   * Get OAuth authorization URL
   */
  static getAuthorizationUrl(appId: string, redirectUri: string, state: string): string {
    const scopes = 'instagram_basic,instagram_content_publish,pages_read_engagement';
    return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${encodeURIComponent(state)}`;
  }
}

/**
 * Factory function
 */
export function createInstagramAdapter(accessToken?: string, userId?: string): InstagramAdapter {
  return new InstagramAdapter(accessToken, userId);
}

/**
 * Get adapter instance
 */
export function getInstagramAdapter(accessToken?: string, userId?: string): InstagramAdapter {
  return new InstagramAdapter(accessToken, userId);
}

/**
 * Check if Instagram is configured
 */
export function isInstagramConfigured(): boolean {
  return !!process.env.INSTAGRAM_ACCESS_TOKEN;
}
