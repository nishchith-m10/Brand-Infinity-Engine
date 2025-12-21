#!/bin/bash

# Supabase Storage Bucket Setup Script
# Creates the campaign-assets bucket for file uploads

echo "======================================================================"
echo "Setting up Supabase Storage Bucket"
echo "======================================================================"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Get Supabase credentials from .env
source .env

echo ""
echo "📦 Creating storage bucket: campaign-assets"
echo ""

# Create bucket via Supabase CLI or manual instructions
cat << 'EOF'
To complete the setup, please do ONE of the following:

OPTION 1: Via Supabase Dashboard (Recommended)
=============================================
1. Go to: https://supabase.com/dashboard/project/vciscdagwhdpstaviakz/storage/buckets
2. Click "New Bucket"
3. Name: campaign-assets
4. Public: Yes (enable "Public bucket")
5. File size limit: 50 MB
6. Allowed MIME types: image/*, video/*, audio/*
7. Click "Create bucket"

OPTION 2: Via Supabase API
===========================
Run this curl command:

curl -X POST 'https://vciscdagwhdpstaviakz.supabase.co/storage/v1/bucket' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "campaign-assets",
    "name": "campaign-assets",
    "public": true,
    "file_size_limit": 52428800,
    "allowed_mime_types": ["image/*", "video/*", "audio/*"]
  }'

OPTION 3: Via Supabase SQL
===========================
Run this in the Supabase SQL Editor:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-assets',
  'campaign-assets',
  true,
  52428800,
  ARRAY['image/*', 'video/*', 'audio/*']
);

EOF

echo ""
echo "✅ Once the bucket is created, your setup is complete!"
echo ""
