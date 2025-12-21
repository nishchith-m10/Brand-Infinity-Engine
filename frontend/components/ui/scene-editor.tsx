'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Clock, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload } from '@/components/ui/file-upload';
import { AssetGallery } from '@/components/ui/asset-gallery';
import { assetsApi, type Asset } from '@/lib/api-client';

interface SceneSpec {
  id: string;
  sequence: number;
  duration_seconds: number;
  visual_prompt: string;
  voiceover_text: string;
  asset_id?: string;
  camera_movement?: string;
  text_overlay?: string;
}

interface SceneEditorProps {
  campaignId: string;
  scenes: SceneSpec[];
  onScenesChange: (scenes: SceneSpec[]) => void;
}

export function SceneEditor({ campaignId, scenes, onScenesChange }: SceneEditorProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  // Fetch campaign assets
  const { data: assetsData } = useQuery({
    queryKey: ['assets', campaignId],
    queryFn: async () => {
      const response = await assetsApi.listAssets(campaignId);
      return response.data.data.assets;
    },
    enabled: !!campaignId,
  });

  // Upload asset mutation
  const uploadAssetMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const uploadPromises = files.map((file) =>
        assetsApi.uploadAsset(campaignId, {
          file,
          assetType: file.type.startsWith('image/') ? 'image' : 'video',
        })
      );
      return Promise.all(uploadPromises);
    },
  });

  const addScene = () => {
    const newScene: SceneSpec = {
      id: `scene_${Date.now()}`,
      sequence: scenes.length + 1,
      duration_seconds: 3,
      visual_prompt: '',
      voiceover_text: '',
    };
    onScenesChange([...scenes, newScene]);
  };

  const updateScene = (id: string, updates: Partial<SceneSpec>) => {
    onScenesChange(
      scenes.map((scene) =>
        scene.id === id ? { ...scene, ...updates } : scene
      )
    );
  };

  const deleteScene = (id: string) => {
    const filtered = scenes.filter((scene) => scene.id !== id);
    // Resequence
    const resequenced = filtered.map((scene, index) => ({
      ...scene,
      sequence: index + 1,
    }));
    onScenesChange(resequenced);
  };

  const selectAssetForScene = (asset: Asset) => {
    if (selectedSceneId) {
      updateScene(selectedSceneId, { asset_id: asset.asset_id });
      setShowAssetPicker(false);
      setSelectedSceneId(null);
    }
  };

  const handleUpload = async (files: File[]) => {
    await uploadAssetMutation.mutateAsync(files);
  };

  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration_seconds, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scene Specifications</CardTitle>
              <p className="mt-1 text-sm text-gray-500">
                Define each scene with timing, visuals, and voiceover
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{totalDuration}s total</span>
              </div>
              <Button onClick={addScene} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Scene
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {scenes.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                <p className="text-sm text-gray-500">
                  No scenes yet. Click &quot;Add Scene&quot; to get started.
                </p>
              </div>
            ) : (
              scenes.map((scene) => (
                <Card key={scene.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {/* Scene Header */}
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">
                          Scene {scene.sequence}
                        </h4>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <Input
                              type="number"
                              value={scene.duration_seconds}
                              onChange={(e) =>
                                updateScene(scene.id, {
                                  duration_seconds: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-20"
                              min={1}
                              max={10}
                            />
                            <span className="text-sm text-gray-500">seconds</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteScene(scene.id)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Asset Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Source Asset
                        </label>
                        {scene.asset_id ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 rounded-lg border border-gray-200 p-2">
                              <p className="text-sm text-gray-600">Asset: {scene.asset_id}</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSceneId(scene.id);
                                setShowAssetPicker(true);
                              }}
                            >
                              Change
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedSceneId(scene.id);
                              setShowAssetPicker(true);
                            }}
                            className="w-full"
                          >
                            <ImageIcon className="h-4 w-4 mr-2" />
                            Select Asset
                          </Button>
                        )}
                      </div>

                      {/* Visual Prompt */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Visual Prompt
                        </label>
                        <Textarea
                          value={scene.visual_prompt}
                          onChange={(e) =>
                            updateScene(scene.id, { visual_prompt: e.target.value })
                          }
                          placeholder="Describe the visual style, camera movement, and scene composition..."
                          rows={3}
                        />
                      </div>

                      {/* Camera Movement */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Camera Movement
                        </label>
                        <Input
                          value={scene.camera_movement || ''}
                          onChange={(e) =>
                            updateScene(scene.id, { camera_movement: e.target.value })
                          }
                          placeholder="e.g., Dolly-in, Pan left to right, Zoom out"
                        />
                      </div>

                      {/* Text Overlay */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Text Overlay
                        </label>
                        <Input
                          value={scene.text_overlay || ''}
                          onChange={(e) =>
                            updateScene(scene.id, { text_overlay: e.target.value })
                          }
                          placeholder="Text to appear on screen"
                        />
                      </div>

                      {/* Voiceover */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Voiceover Text
                        </label>
                        <Textarea
                          value={scene.voiceover_text}
                          onChange={(e) =>
                            updateScene(scene.id, { voiceover_text: e.target.value })
                          }
                          placeholder="Voiceover narration for this scene..."
                          rows={2}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Asset Management Modal */}
      {showAssetPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Select Asset</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAssetPicker(false);
                    setSelectedSceneId(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <FileUpload
                  accept="image/*,video/*"
                  multiple
                  onUpload={handleUpload}
                />
                {assetsData && assetsData.length > 0 && (
                  <AssetGallery
                    assets={assetsData}
                    selectable
                    onSelect={selectAssetForScene}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
