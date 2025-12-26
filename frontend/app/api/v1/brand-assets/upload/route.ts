import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/v1/brand-assets/upload
 * Upload a file to Supabase Storage and create an asset record
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const assetType = formData.get('asset_type') as string || 'other';
    const knowledgeBaseId = formData.get('knowledge_base_id') as string | null;
    let brandId = formData.get('brand_id') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No file provided' } },
        { status: 400 }
      );
    }

    // If no brand_id provided, try to get from user's campaigns
    if (!brandId) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('brand_id')
        .limit(1)
        .single();
      
      brandId = campaign?.brand_id || user.id; // Fallback to user ID as brand ID
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${brandId}/${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Convert file to buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('brand-assets')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[API] Storage upload error:', uploadError);
      
      // Check if bucket doesn't exist
      if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
        return NextResponse.json(
          { success: false, error: { code: 'STORAGE_ERROR', message: 'Storage bucket not configured. Please set up "brand-assets" bucket in Supabase.' } },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: { code: 'UPLOAD_ERROR', message: uploadError.message } },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('brand-assets')
      .getPublicUrl(uploadData.path);

    // Create asset record in database
    const { data: asset, error: dbError } = await supabase
      .from('brand_knowledge_base')
      .insert({
        brand_id: brandId,
        knowledge_base_id: knowledgeBaseId || null,
        asset_type: assetType,
        file_url: urlData.publicUrl,
        file_name: file.name,
        metadata: {
          size: file.size,
          type: file.type,
          uploaded_at: new Date().toISOString(),
        },
        is_active: true,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[API] Database insert error:', dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from('brand-assets').remove([uploadData.path]);
      
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: `DB Error: ${dbError.message} (${dbError.details || 'no details'} - ${dbError.hint || 'no hint'})` } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: asset,
      message: 'Asset uploaded successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('[API] Upload error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to upload file' } },
      { status: 500 }
    );
  }
}

