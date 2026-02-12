'use client';

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type VideoProvider = 'pollo' | 'runway' | 'pika' | 'kling' | 'sora';

interface VideoProviderOption {
  id: VideoProvider;
  name: string;
  description: string;
  cost: string;
  quality: 'standard' | 'high' | 'premium';
  available: boolean;
}

const VIDEO_PROVIDERS: VideoProviderOption[] = [
  {
    id: 'pollo',
    name: 'Pollo AI',
    description: 'Multi-model access (Kling, Veo, Pika)',
    cost: '~$0.30-0.50/video',
    quality: 'high',
    available: true,
  },
  {
    id: 'runway',
    name: 'Runway',
    description: 'Gen4 Turbo - High quality motion',
    cost: '~$1.50/30sec',
    quality: 'premium',
    available: true,
  },
  {
    id: 'pika',
    name: 'Pika Labs',
    description: 'Stylized video generation',
    cost: '~$1.00/video',
    quality: 'high',
    available: true,
  },
  {
    id: 'kling',
    name: 'Kling AI',
    description: 'Fast, cost-effective generation',
    cost: '~$0.50/video',
    quality: 'standard',
    available: true,
  },
  {
    id: 'sora',
    name: 'OpenAI Sora',
    description: 'Premium quality (limited access)',
    cost: 'N/A',
    quality: 'premium',
    available: false,
  },
];

interface VideoProviderSelectorProps {
  value?: VideoProvider;
  onChange?: (provider: VideoProvider) => void;
  budgetTier?: 'premium' | 'standard' | 'economy';
  disabled?: boolean;
}

export function VideoProviderSelector({
  value,
  onChange,
  budgetTier = 'standard',
  disabled = false,
}: VideoProviderSelectorProps) {
  const [selectedProvider, setSelectedProvider] = useState<VideoProvider>(
    value || (budgetTier === 'premium' ? 'runway' : 'pollo')
  );

  const handleChange = (provider: VideoProvider) => {
    setSelectedProvider(provider);
    onChange?.(provider);
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'premium':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'high':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Video Provider
        </label>
        <Select
          value={selectedProvider}
          onValueChange={(v) => handleChange(v as VideoProvider)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select video provider" />
          </SelectTrigger>
          <SelectContent>
            {VIDEO_PROVIDERS.map((provider) => (
              <SelectItem
                key={provider.id}
                value={provider.id}
                disabled={!provider.available}
              >
                <div className="flex items-center justify-between w-full gap-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{provider.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {provider.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${getQualityColor(provider.quality)}`}
                    >
                      {provider.quality}
                    </Badge>
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-xs text-muted-foreground">
                          {provider.cost}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Estimated cost per 30-second video</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {budgetTier === 'economy' && 'Recommended: Pollo AI for best value'}
          {budgetTier === 'standard' && 'Recommended: Pollo AI (balanced quality/cost)'}
          {budgetTier === 'premium' && 'Recommended: Runway (premium quality)'}
        </p>
      </div>
    </TooltipProvider>
  );
}
