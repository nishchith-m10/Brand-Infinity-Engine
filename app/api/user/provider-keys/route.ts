import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptProviderKey } from '@/lib/encryption/provider-keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/user/provider-keys
 * Create or update a provider key for the authenticated user
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { provider, key, metadata = {} } = body;

    if (!provider || !key) {
      return NextResponse.json(
        { success: false, error: 'provider and key are required' },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders = ['openai', 'anthropic', 'deepseek', 'elevenlabs', 'midjourney', 'other'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      );
    }

    // Encrypt the key server-side
    const encryptedKey = await encryptProviderKey(key);

    // Upsert (insert or update if exists)
    const { data, error } = await supabase
      .from('user_provider_keys')
      .upsert(
        {
          user_id: user.id,
          provider,
          encrypted_key: encryptedKey,
          metadata,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error storing provider key:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to store provider key' },
        { status: 500 }
      );
    }

    // Return without exposing the encrypted key
    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        provider: data.provider,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/user/provider-keys:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/provider-keys
 * List all provider keys for the authenticated user (encrypted keys not returned)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('user_provider_keys')
      .select('id, provider, key_version, metadata, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching provider keys:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch provider keys' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error in GET /api/user/provider-keys:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
