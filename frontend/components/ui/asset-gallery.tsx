'use client';

import { useState } from 'react';
import { Image as ImageIcon, Video as VideoIcon, Trash2, ExternalLink } from 'lucide-react';
import { Card, CardContent } from './card';
import { Button } from './button';
import { Badge } from './badge';

interface Asset {
  asset_id: string;
  filename: string;
  original_filename: string;
  asset_type: 'image' | 'video' | 'audio' | 'document';
  storage_url: string;
  file_size_bytes: number;
  mime_type: string;
  tags?: string[];
  created_at: string;
}

interface AssetGalleryProps {
  assets: Asset[];
  onDelete?: (assetId: string) => void;
  onSelect?: (asset: Asset) => void;
  selectable?: boolean;
  selectedAssetId?: string;
}

export function AssetGallery({ 
  assets, 
  onDelete, 
  onSelect,
  selectable = false,
  selectedAssetId
}: AssetGalleryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getAssetIcon = (type: string) => {
    if (type === 'image') return <ImageIcon className="h-5 w-5" />;
    if (type === 'video') return <VideoIcon className="h-5 w-5" />;
    return null;
  };

  if (assets.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No assets uploaded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Assets ({assets.length})
        </h3>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <Card
              key={asset.asset_id}
              className={`
                cursor-pointer transition-all hover:shadow-md
                ${selectable && selectedAssetId === asset.asset_id ? 'ring-2 ring-blue-500' : ''}
              `}
              onClick={() => selectable && onSelect?.(asset)}
            >
              <CardContent className="p-4">
                <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                  {asset.asset_type === 'image' ? (
                    <img
                      src={asset.storage_url}
                      alt={asset.original_filename}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      {getAssetIcon(asset.asset_type)}
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {asset.original_filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(asset.file_size_bytes)}
                  </p>
                  {asset.tags && asset.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {asset.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <a
                    href={asset.storage_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                  {onDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(asset.asset_id);
                      }}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => (
            <Card
              key={asset.asset_id}
              className={`
                cursor-pointer transition-all hover:shadow-md
                ${selectable && selectedAssetId === asset.asset_id ? 'ring-2 ring-blue-500' : ''}
              `}
              onClick={() => selectable && onSelect?.(asset)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-lg bg-gray-100">
                    {asset.asset_type === 'image' ? (
                      <img
                        src={asset.storage_url}
                        alt={asset.original_filename}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        {getAssetIcon(asset.asset_type)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-gray-900">
                      {asset.original_filename}
                    </p>
                    <p className="text-sm text-gray-500">
                      {asset.asset_type} • {formatFileSize(asset.file_size_bytes)}
                    </p>
                    {asset.tags && asset.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {asset.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={asset.storage_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                    {onDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(asset.asset_id);
                        }}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
