/**
 * Twitter/X Publishing API Adapter
 * Phase 10: Social Publishing Integration
 * 
 * Implements Twitter API v2 for tweet publishing with media support.
 * https://developer.twitter.com/en/docs/twitter-api
 * 
 * Prerequisites:
 * - Twitter Developer App with OAuth 2.0 (User Context)
 * - User access token with tweet.write and users.read scopes
 * - For video: media.upload permission
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const TWITTER_API_V2 = 'https://api.twitter.com/2';
const TWITTER_UPLOAD_V1 = 'https://upload.twitter.com/1.1';

// Media categories
export type MediaCategory = 'tweet_video' | 'tweet_image' | 'tweet_gif';

export interface TwitterTweetRequest {
  text: string;
  mediaIds?: string[];        // Already uploaded media IDs
  replyToTweetId?: string;    // For replies
  quoteTweetId?: string;      // For quote tweets
  pollOptions?: string[];     // Up to 4 options
  pollDurationMinutes?: number;
}

export interface TwitterMediaUploadRequest {
  mediaUrl?: string;          // URL to download media from
  mediaBuffer?: Buffer;       // Binary media data
  mediaType: 'video/mp4' | 'image/jpeg' | 'image/png' | 'image/gif';
  category?: MediaCategory;
}

export interface TwitterTweetResponse {
  tweetId: string;
  text: string;
  editHistoryTweetIds: string[];
  error?: { code: string; message: string };
}

export interface MediaUploadResponse {
  mediaId: string;
  mediaIdString: string;
  expiresAfterSecs?: number;
  processingInfo?: {
    state: 'pending' | 'in_progress' | 'failed' | 'succeeded';
    checkAfterSecs?: number;
    progressPercent?: number;
    error?: { code: number; message: string };
  };
}

export class TwitterAdapter {
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
      this.accessTokenPromise = getEffectiveProviderKey('twitter', process.env.TWITTER_ACCESS_TOKEN, userId);
    }
  }

  private async ensureAccessToken(): Promise<string> {
    if (!this.accessToken) {
      this.accessToken = await this.accessTokenPromise;
    }
    if (!this.accessToken) {
      throw new Error(
        'Twitter access token not configured. Please connect your Twitter/X account in Settings.'
      );
    }
    return this.accessToken;
  }

  /**
   * Create a tweet with optional media
   */
  async createTweet(request: TwitterTweetRequest): Promise<TwitterTweetResponse> {
    const accessToken = await this.ensureAccessToken();

    const payload: Record<string, unknown> = {
      text: request.text,
    };

    if (request.mediaIds && request.mediaIds.length > 0) {
      payload.media = { media_ids: request.mediaIds };
    }

    if (request.replyToTweetId) {
      payload.reply = { in_reply_to_tweet_id: request.replyToTweetId };
    }

    if (request.quoteTweetId) {
      payload.quote_tweet_id = request.quoteTweetId;
    }

    if (request.pollOptions && request.pollOptions.length >= 2) {
      payload.poll = {
        options: request.pollOptions,
        duration_minutes: request.pollDurationMinutes || 1440, // Default 24 hours
      };
    }

    const response = await fetch(`${TWITTER_API_V2}/tweets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Twitter API error: ${response.status} - ${errorData.detail || errorData.title || 'Unknown error'}`
      );
    }

    const data = await response.json();

    return {
      tweetId: data.data.id,
      text: data.data.text,
      editHistoryTweetIds: data.data.edit_history_tweet_ids || [data.data.id],
    };
  }

  /**
   * Initialize media upload (for large files like videos)
   * Uses chunked upload (INIT, APPEND, FINALIZE)
   */
  async initializeMediaUpload(
    totalBytes: number,
    mediaType: string,
    category: MediaCategory = 'tweet_video'
  ): Promise<string> {
    const accessToken = await this.ensureAccessToken();

    const params = new URLSearchParams({
      command: 'INIT',
      total_bytes: totalBytes.toString(),
      media_type: mediaType,
      media_category: category,
    });

    const response = await fetch(`${TWITTER_UPLOAD_V1}/media/upload.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Media upload init failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.media_id_string;
  }

  /**
   * Finalize media upload
   */
  async finalizeMediaUpload(mediaId: string): Promise<MediaUploadResponse> {
    const accessToken = await this.ensureAccessToken();

    const params = new URLSearchParams({
      command: 'FINALIZE',
      media_id: mediaId,
    });

    const response = await fetch(`${TWITTER_UPLOAD_V1}/media/upload.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Media upload finalize failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Check media processing status
   */
  async checkMediaStatus(mediaId: string): Promise<MediaUploadResponse> {
    const accessToken = await this.ensureAccessToken();

    const response = await fetch(
      `${TWITTER_UPLOAD_V1}/media/upload.json?command=STATUS&media_id=${mediaId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Media status check failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Wait for media processing to complete
   */
  async waitForMediaProcessing(
    mediaId: string,
    options: { timeoutMs?: number } = {}
  ): Promise<MediaUploadResponse> {
    const { timeoutMs = 300000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.checkMediaStatus(mediaId);

      if (!status.processingInfo) {
        // No processing info means it's ready
        return status;
      }

      if (status.processingInfo.state === 'succeeded') {
        return status;
      }

      if (status.processingInfo.state === 'failed') {
        throw new Error(
          `Media processing failed: ${status.processingInfo.error?.message || 'Unknown error'}`
        );
      }

      const checkAfter = status.processingInfo.checkAfterSecs || 5;
      await new Promise((resolve) => setTimeout(resolve, checkAfter * 1000));
    }

    throw new Error(`Media processing timed out after ${timeoutMs / 1000} seconds`);
  }

  /**
   * Delete a tweet
   */
  async deleteTweet(tweetId: string): Promise<boolean> {
    const accessToken = await this.ensureAccessToken();

    const response = await fetch(`${TWITTER_API_V2}/tweets/${tweetId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to delete tweet: ${response.status} - ${errorData.detail || 'Unknown error'}`
      );
    }

    const data = await response.json();
    return data.data.deleted;
  }

  /**
   * Get authenticated user info
   */
  async getMe(): Promise<{ id: string; username: string; name: string }> {
    const accessToken = await this.ensureAccessToken();

    const response = await fetch(`${TWITTER_API_V2}/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * Check if configured
   */
  isConfigured(): boolean {
    return !!this.accessToken || !!process.env.TWITTER_ACCESS_TOKEN;
  }

  /**
   * Get OAuth 2.0 authorization URL (with PKCE)
   */
  static getAuthorizationUrl(
    clientId: string,
    redirectUri: string,
    state: string,
    codeChallenge: string
  ): string {
    const scopes = 'tweet.read tweet.write users.read offline.access';
    return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;
  }
}

/**
 * Factory function
 */
export function createTwitterAdapter(accessToken?: string, userId?: string): TwitterAdapter {
  return new TwitterAdapter(accessToken, userId);
}

/**
 * Get adapter instance
 */
export function getTwitterAdapter(accessToken?: string, userId?: string): TwitterAdapter {
  return new TwitterAdapter(accessToken, userId);
}

/**
 * Check if Twitter is configured
 */
export function isTwitterConfigured(): boolean {
  return !!process.env.TWITTER_ACCESS_TOKEN;
}
