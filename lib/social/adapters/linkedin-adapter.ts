/**
 * LinkedIn Publishing API Adapter
 * Phase 10: Social Publishing Integration
 * 
 * Implements LinkedIn Marketing API for post publishing.
 * https://learn.microsoft.com/en-us/linkedin/marketing/
 * 
 * Prerequisites:
 * - LinkedIn Marketing App with w_member_social permission
 * - OAuth 2.0 access token
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const LINKEDIN_REST_BASE = 'https://api.linkedin.com/rest';

// Visibility levels
export type LinkedInVisibility = 'PUBLIC' | 'CONNECTIONS' | 'LOGGED_IN';

export interface LinkedInPostRequest {
  authorUrn: string;          // urn:li:person:{id} or urn:li:organization:{id}
  text: string;
  visibility?: LinkedInVisibility;
  mediaUrns?: string[];       // Already uploaded media URNs
  articleUrl?: string;        // For link shares
  articleTitle?: string;
  articleDescription?: string;
}

export interface LinkedInMediaUploadRequest {
  ownerUrn: string;           // Person or Organization URN
  mediaUrl?: string;          // URL to download media from
  mediaBuffer?: Buffer;       // Binary media data
  mediaType?: 'video' | 'image';
}

export interface LinkedInPostResponse {
  postUrn: string;
  shareUrl?: string;
  error?: { status: number; message: string };
}

export interface RegisterUploadResponse {
  uploadUrl: string;
  asset: string;              // The asset URN to use when creating post
}

export class LinkedInAdapter {
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
      this.accessTokenPromise = getEffectiveProviderKey('linkedin', process.env.LINKEDIN_ACCESS_TOKEN, userId);
    }
  }

  private async ensureAccessToken(): Promise<string> {
    if (!this.accessToken) {
      this.accessToken = await this.accessTokenPromise;
    }
    if (!this.accessToken) {
      throw new Error(
        'LinkedIn access token not configured. Please connect your LinkedIn account in Settings.'
      );
    }
    return this.accessToken;
  }

  /**
   * Create a text post or share
   */
  async createPost(request: LinkedInPostRequest): Promise<LinkedInPostResponse> {
    const accessToken = await this.ensureAccessToken();

    const payload: Record<string, unknown> = {
      author: request.authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: request.text,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': request.visibility || 'PUBLIC',
      },
    };

    // Add media if present
    if (request.mediaUrns && request.mediaUrns.length > 0) {
      const shareContent = payload.specificContent as Record<string, Record<string, unknown>>;
      shareContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'VIDEO';
      shareContent['com.linkedin.ugc.ShareContent'].media = request.mediaUrns.map((urn) => ({
        status: 'READY',
        media: urn,
      }));
    }

    // Add article if present
    if (request.articleUrl) {
      const shareContent = payload.specificContent as Record<string, Record<string, unknown>>;
      shareContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
      shareContent['com.linkedin.ugc.ShareContent'].media = [{
        status: 'READY',
        originalUrl: request.articleUrl,
        title: { text: request.articleTitle || '' },
        description: { text: request.articleDescription || '' },
      }];
    }

    const response = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `LinkedIn API error: ${response.status} - ${errorData.message || 'Unknown error'}`
      );
    }

    const postId = response.headers.get('x-restli-id') || '';

    return {
      postUrn: `urn:li:share:${postId}`,
      shareUrl: `https://www.linkedin.com/feed/update/urn:li:share:${postId}`,
    };
  }

  /**
   * Register an upload for video/image
   */
  async registerUpload(request: LinkedInMediaUploadRequest): Promise<RegisterUploadResponse> {
    const accessToken = await this.ensureAccessToken();

    const payload = {
      registerUploadRequest: {
        owner: request.ownerUrn,
        recipes: [
          request.mediaType === 'video'
            ? 'urn:li:digitalmediaRecipe:feedshare-video'
            : 'urn:li:digitalmediaRecipe:feedshare-image',
        ],
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    };

    const response = await fetch(`${LINKEDIN_API_BASE}/assets?action=registerUpload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `LinkedIn upload registration failed: ${response.status} - ${errorData.message || 'Unknown error'}`
      );
    }

    const data = await response.json();

    return {
      uploadUrl: data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl,
      asset: data.value.asset,
    };
  }

  /**
   * Check upload/asset status
   */
  async checkAssetStatus(assetUrn: string): Promise<{ status: string }> {
    const accessToken = await this.ensureAccessToken();

    const response = await fetch(
      `${LINKEDIN_API_BASE}/assets/${encodeURIComponent(assetUrn)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to check asset status: ${response.status}`);
    }

    const data = await response.json();
    return {
      status: data.recipes?.[0]?.status || 'UNKNOWN',
    };
  }

  /**
   * Wait for asset processing to complete
   */
  async waitForAssetReady(
    assetUrn: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<void> {
    const { timeoutMs = 300000, pollIntervalMs = 10000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.checkAssetStatus(assetUrn);

      if (status.status === 'AVAILABLE') {
        return;
      }

      if (status.status === 'CLIENT_ERROR' || status.status === 'SERVER_ERROR') {
        throw new Error(`Asset processing failed: ${status.status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Asset processing timed out after ${timeoutMs / 1000} seconds`);
  }

  /**
   * Get current user's profile
   */
  async getMe(): Promise<{ id: string; firstName: string; lastName: string }> {
    const accessToken = await this.ensureAccessToken();

    const response = await fetch(`${LINKEDIN_API_BASE}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get profile: ${response.status}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      firstName: data.localizedFirstName,
      lastName: data.localizedLastName,
    };
  }

  /**
   * Check if configured
   */
  isConfigured(): boolean {
    return !!this.accessToken || !!process.env.LINKEDIN_ACCESS_TOKEN;
  }

  /**
   * Get OAuth 2.0 authorization URL
   */
  static getAuthorizationUrl(
    clientId: string,
    redirectUri: string,
    state: string
  ): string {
    const scopes = 'r_liteprofile w_member_social';
    return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;
  }
}

/**
 * Factory function
 */
export function createLinkedInAdapter(accessToken?: string, userId?: string): LinkedInAdapter {
  return new LinkedInAdapter(accessToken, userId);
}

/**
 * Get adapter instance
 */
export function getLinkedInAdapter(accessToken?: string, userId?: string): LinkedInAdapter {
  return new LinkedInAdapter(accessToken, userId);
}

/**
 * Check if LinkedIn is configured
 */
export function isLinkedInConfigured(): boolean {
  return !!process.env.LINKEDIN_ACCESS_TOKEN;
}
