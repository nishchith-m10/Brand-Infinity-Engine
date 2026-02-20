# Upload EarlyBloom Assets to Brand Vault

## Assets Available
Based on the images in `EarlyBloom_assets/`:
- Login screen
- Dashboard view
- Activity creation with AI generator
- Smart converter activity
- Preview interface
- Activity analytics
- AI generator storybook

## Upload Instructions

### Via UI (Recommended for testing):
1. Go to `/brand-vault` page in your app
2. Click "Upload Assets" button
3. Select all images from `EarlyBloom_assets/` folder
4. Images will be stored in Supabase Storage under `brand-assets/{brand_id}/`

### Via Supabase Dashboard:
1. Go to your Supabase project dashboard
2. Navigate to Storage
3. Create bucket `brand-assets` (if not exists)
4. Upload images to `brand-assets/{your-brand-id}/`

### Via Script (Quick test):
```bash
# From project root
cd EarlyBloom_assets
for file in cms_*.png; do
  curl -X POST 'YOUR_SUPABASE_URL/storage/v1/object/brand-assets/YOUR_BRAND_ID/$file' \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
    -H "Content-Type: image/png" \
    --data-binary "@$file"
done
```
