/**
 * YouTube Publishing API Adapter
 * Phase 10: Social Publishing Integration
 * 
 * Implements YouTube Data API v3 with Resumable Upload Protocol.
 * https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
 * 
 * Prerequisites:
 * - Google Cloud Project with YouTube Data API v3 enabled
 * - OAuth 2.0 Client ID and Secret
 * - User access token with scope: https://www.googleapis.com/auth/youtube.upload
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3';

// Privacy status
export type YouTubePrivacyStatus = 'private' | 'public' | 'unlisted';

export interface YouTubeVideoMetadata {
  title: string;
  description?: string;
  tags?: string[];
  categoryId?: string; // e.g., '22' for People & Blogs
  privacyStatus?: YouTubePrivacyStatus;
  madeForKids?: boolean;
  publishAt?: string; // ISO 8601 date for scheduled publishing
}

export interface YouTubeUploadRequest {
  videoUrl?: string;       // URL to download video from
  videoBuffer?: Buffer;    // Binary video data
  metadata: YouTubeVideoMetadata;
  onProgress?: (bytesUploaded: number, totalBytes: number) => void;
}

export interface YouTubeUploadResponse {
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  error?: { code: number; message: string };
}

export interface ChannelStats {
  id: string;
  title: string;
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
}

export class YouTubeAdapter {
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
      this.accessTokenPromise = getEffectiveProviderKey('youtube', process.env.YOUTUBE_ACCESS_TOKEN, userId);
    }
  }

  private async ensureAccessToken(): Promise<string> {
    if (!this.accessToken) {
      this.accessToken = await this.accessTokenPromise;
    }
    if (!this.accessToken) {
      throw new Error(
        'YouTube access token not configured. Please connect your YouTube account in Settings.'
      );
    }
    return this.accessToken;
  }

  /**
   * Fetch video buffer from URL if needed
   */
  private async getVideoBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download video from URL: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Initiate Resumable Upload Session
   */
  async initiateUploadSession(metadata: YouTubeVideoMetadata, size: number, mimeType: string = 'video/mp4'): Promise<string> {
    const accessToken = await this.ensureAccessToken();

    const body = {
      snippet: {
        title: metadata.title,
        description: metadata.description || '',
        tags: metadata.tags || [],
        categoryId: metadata.categoryId || '22',
      },
      status: {
        privacyStatus: metadata.privacyStatus || 'private',
        selfDeclaredMadeForKids: metadata.madeForKids || false,
        ...(metadata.publishAt && { publishAt: metadata.publishAt }),
      },
    };

    const response = await fetch(`${YOUTUBE_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Length': size.toString(),
        'X-Upload-Content-Type': mimeType,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to initiate upload session: ${response.status} - ${error}`);
    }

    const uploadUrl = response.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('No upload URL returned from YouTube API');
    }

    return uploadUrl;
  }

  /**
   * Upload video file directly (simplified resumable flow)
   * Note: For very large files in Node, streams are better, but Buffer is fine for short social videos.
   */
  async uploadVideo(request: YouTubeUploadRequest): Promise<YouTubeUploadResponse> {
    const accessToken = await this.ensureAccessToken();
    
    let buffer: Buffer;
    if (request.videoBuffer) {
      buffer = request.videoBuffer;
    } else if (request.videoUrl) {
      buffer = await this.getVideoBuffer(request.videoUrl);
    } else {
      throw new Error('Either videoUrl or videoBuffer is required');
    }

    const totalBytes = buffer.length;
    const mimeType = 'video/mp4'; // Assuming MP4 for simplicity, ideally detect from buffer or extension

    // Step 1: Initiate session
    const uploadUrl = await this.initiateUploadSession(request.metadata, totalBytes, mimeType);

    // Step 2: Upload content (using single PUT for simplicity, valid for resumable protocol)
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': totalBytes.toString(),
        'Content-Type': mimeType,
      },
      body: buffer as unknown as BodyInit,
    });

    if (!response.ok) {
      // If incomplete (308), logic would go here to resume. 
      // For this implementation, we treat interruption as failure for simplicity.
      const error = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      videoId: data.id,
      channelId: data.snippet.channelId,
      title: data.snippet.title,
      description: data.snippet.description,
      publishedAt: data.snippet.publishedAt,
      thumbnailUrl: data.snippet.thumbnails?.high?.url || data.snippet.thumbnails?.default?.url,
    };
  }

  /**
   * Get Channel Statistics (verification helper)
   */
  async getChannelStats(): Promise<ChannelStats> {
    const accessToken = await this.ensureAccessToken();

    const response = await fetch(`${YOUTUBE_API_BASE}/channels?part=snippet,statistics&mine=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get channel info: ${response.status} - ${error}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error('No channel found for this user');
    }

    const item = data.items[0];
    return {
      id: item.id,
      title: item.snippet.title,
      subscriberCount: item.statistics.subscriberCount,
      viewCount: item.statistics.viewCount,
      videoCount: item.statistics.videoCount,
    };
  }

  /**
   * Check if configured
   */
  isConfigured(): boolean {
    return !!this.accessToken || !!process.env.YOUTUBE_ACCESS_TOKEN;
  }

  /**
   * Get OAuth 2.0 Authorization URL
   */
  static getAuthorizationUrl(
    clientId: string,
    redirectUri: string,
    state: string
  ): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ].join(' ');
    
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}&access_type=offline&prompt=consent`;
  }
}

/**
 * Factory function
 */
export function createYouTubeAdapter(accessToken?: string, userId?: string): YouTubeAdapter {
  return new YouTubeAdapter(accessToken, userId);
}

/**
 * Get adapter instance
 */
export function getYouTubeAdapter(accessToken?: string, userId?: string): YouTubeAdapter {
  return new YouTubeAdapter(accessToken, userId);
}

/**
 * Check if YouTube is configured
 */
export function isYouTubeConfigured(): boolean {
  return !!process.env.YOUTUBE_ACCESS_TOKEN;
}
