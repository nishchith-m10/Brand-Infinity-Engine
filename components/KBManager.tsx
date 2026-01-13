'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  FolderOpen,
  Shield,
  Package,
  Calendar,
  Users,
  Target,
  TrendingUp,
  Loader2,
  Pencil,
  Trash2,
  Star,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/lib/hooks/use-toast';
import { Tooltip } from '@/components/ui/tooltip';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';

// Icon mapping for KB icons
const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  folder: FolderOpen,
  shield: Shield,
  package: Package,
  calendar: Calendar,
  users: Users,
  target: Target,
  'trending-up': TrendingUp,
};

// Color presets for KB colors (using Tailwind design tokens)
const colorPresets = [
  'hsl(var(--primary))', // Primary (Indigo)
  'hsl(var(--lama-purple))', // Purple
  'hsl(var(--pink))', // Pink
  'hsl(var(--destructive))', // Red
  'hsl(var(--amber))', // Amber
  'hsl(var(--success))', // Emerald
  'hsl(var(--blue))', // Blue
  'hsl(var(--muted-foreground))', // Gray
];

interface KnowledgeBase {
  id: string;
  brand_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  tags: string[];
  is_core: boolean;
  is_default: boolean;
  is_active: boolean;
  asset_count: number;
  created_at: string;
}

interface KBManagerProps {
  brandId: string;
  campaignId?: string | null;
  onKBSelect?: (kbId: string) => void;
}

export function KBManager({ brandId, campaignId, onKBSelect }: KBManagerProps) {
  const [kbs, setKBs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; kb: KnowledgeBase | null }>({
    isOpen: false,
    kb: null,
  });
  const { showToast } = useToast();

  // Fetch KBs - wrapped in useCallback to prevent infinite loops
  const fetchKBs = useCallback(async () => {
    if (!brandId || !campaignId) {
      setKBs([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/knowledge-bases?brand_id=${brandId}&campaign_id=${campaignId}`);
      const { data, success } = (await res.json()) as { data: KnowledgeBase[]; success: boolean };
      if (success) {
        setKBs(data || []);
      }
    } catch {
      showToast({ type: 'error', message: 'Failed to load knowledge bases' });
    } finally {
      setLoading(false);
    }
  }, [brandId, campaignId, showToast]);

  useEffect(() => {
    if (brandId && campaignId) {
      fetchKBs();
    }
  }, [brandId, campaignId, fetchKBs]);

  // Delete KB - show modal
  const handleDeleteClick = (kb: KnowledgeBase) => {
    if (kb.is_core) {
      showToast({ type: 'error', message: 'Core knowledge base cannot be deleted' });
      return;
    }
    setDeleteConfirmModal({ isOpen: true, kb });
  };

  // Confirm delete KB
  const handleDeleteConfirm = async () => {
    const kb = deleteConfirmModal.kb;
    if (!kb) return;

    try {
      const res = await fetch(`/api/v1/knowledge-bases/${kb.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast({ type: 'success', message: `"${kb.name}" has been deleted` });
        setDeleteConfirmModal({ isOpen: false, kb: null });
        fetchKBs();
      }
    } catch {
      showToast({ type: 'error', message: 'Failed to delete' });
    }
  };

  // Toggle default
  const toggleDefault = async (kb: KnowledgeBase) => {
    try {
      const res = await fetch(`/api/v1/knowledge-bases/${kb.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: !kb.is_default }),
      });
      if (res.ok) {
        fetchKBs();
      }
    } catch {
      showToast({ type: 'error', message: 'Failed to update' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (kbs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Knowledge Bases</h3>
            <p className="text-sm text-slate-500">Organize your brand assets into focused collections</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New KB
          </Button>
        </div>
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
          <FolderOpen className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <h4 className="text-sm font-medium text-slate-600">No Knowledge Bases</h4>
          <p className="text-xs text-slate-400 mt-1">Create your first knowledge base to organize brand assets</p>
          <Button onClick={() => setShowCreateModal(true)} size="sm" className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Create Knowledge Base
          </Button>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <KBCreateModal
            brandId={brandId}
            campaignId={campaignId}
            editingKB={null}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchKBs();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Knowledge Bases</h3>
          <p className="text-sm text-slate-500">Organize your brand assets into focused collections</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New KB
        </Button>
      </div>

      {/* KB Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kbs.map((kb) => {
          const IconComponent = iconMap[kb.icon] || FolderOpen;
          return (
            <Card
              key={kb.id}
              className={`relative cursor-pointer transition-all hover:shadow-md ${
                kb.is_core ? 'ring-2 ring-indigo-200' : ''
              }`}
              onClick={() => onKBSelect?.(kb.id)}
            >
              <CardContent className="p-4">
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${kb.color}20` }}
                    >
                      <IconComponent className="h-5 w-5" style={{ color: kb.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-800">{kb.name}</h4>
                        {kb.is_core && (
                          <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">
                            Core
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{kb.asset_count} assets</p>
                    </div>
                  </div>

                  {/* Actions dropdown */}
                  <div className="flex items-center gap-1">
                    <Tooltip content={kb.is_default ? 'Default KB' : 'Set as default'} position="top">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDefault(kb);
                        }}
                        className={`p-1.5 rounded-md transition-colors ${
                          kb.is_default
                            ? 'text-amber-500 bg-amber-50'
                            : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                        }`}
                      >
                        <Star className="h-4 w-4" fill={kb.is_default ? 'currentColor' : 'none'} />
                      </button>
                    </Tooltip>
                    {!kb.is_core && (
                      <>
                        <Tooltip content="Edit knowledge base" position="top">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingKB(kb);
                              setShowCreateModal(true);
                            }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Delete knowledge base" position="top">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(kb);
                            }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </div>

                {/* Description */}
                {kb.description && (
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">{kb.description}</p>
                )}

                {/* Tags */}
                {kb.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {kb.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {kb.tags.length > 3 && (
                      <span className="text-xs text-slate-400">+{kb.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <KBCreateModal
          brandId={brandId}
          campaignId={campaignId}
          editingKB={editingKB}
          onClose={() => {
            setShowCreateModal(false);
            setEditingKB(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingKB(null);
            fetchKBs();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, kb: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Knowledge Base"
        message={`Are you sure you want to delete "${deleteConfirmModal.kb?.name}"? All associated assets will also be removed. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

// Create/Edit Modal Component
interface KBCreateModalProps {
  brandId: string;
  campaignId?: string | null;
  editingKB: KnowledgeBase | null;
  onClose: () => void;
  onSuccess: () => void;
}

function KBCreateModal({ brandId, campaignId, editingKB, onClose, onSuccess }: KBCreateModalProps) {
  const [name, setName] = useState(editingKB?.name || '');
  const [description, setDescription] = useState(editingKB?.description || '');
  const [icon, setIcon] = useState(editingKB?.icon || 'folder');
  const [color, setColor] = useState(editingKB?.color || '#6366F1');
  const [tags, setTags] = useState(editingKB?.tags.join(', ') || '');
  const [isDefault, setIsDefault] = useState(editingKB?.is_default || false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        icon,
        color,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        is_default: isDefault,
      };

      // Only include brand_id if it's a valid UUID (not the dummy demo-brand-id)
      if (brandId && brandId !== 'demo-brand-id') {
        body.brand_id = brandId;
      }

      // Include campaign_id if provided
      if (campaignId) {
        body.campaign_id = campaignId;
      }

      const url = editingKB
        ? `/api/v1/knowledge-bases/${editingKB.id}`
        : '/api/v1/knowledge-bases';
      const method = editingKB ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { success: boolean; error?: { message: string } };
      if (data.success) {
        showToast({
          type: 'success',
          message: `Knowledge base "${name}" ${editingKB ? 'updated' : 'created'} successfully`,
        });
        onSuccess();
      } else {
        throw new Error(data.error?.message || 'Failed to save');
      }
    } catch (err) {
      showToast({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'An error occurred' 
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">
              {editingKB ? 'Edit Knowledge Base' : 'Create Knowledge Base'}
            </h3>

            {/* Name */}
            <div>
              <label className="text-sm font-medium text-slate-700">Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Holiday 2025 Campaign"
                className="mt-1"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-slate-700">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this knowledge base for?"
                className="mt-1 text-slate-800"
                rows={2}
              />
            </div>

            {/* Icon & Color */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Icon</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(iconMap).map(([key, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIcon(key)}
                      className={`p-2 rounded-lg border transition-colors ${
                        icon === key
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" style={{ color: icon === key ? color : '#64748b' }} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Color</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {colorPresets.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        color === c ? 'border-slate-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="h-4 w-4 text-white mx-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium text-slate-700">Tags (comma-separated)</label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., seasonal, 2025, marketing"
                className="mt-1"
              />
            </div>

            {/* Default toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">Set as default for Creative Director</span>
            </label>
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingKB ? 'Save Changes' : 'Create KB'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
