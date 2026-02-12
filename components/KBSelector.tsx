'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronDown, FolderOpen, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KnowledgeBase {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_core: boolean;
  is_default: boolean;
  asset_count: number;
}

interface KBSelectorProps {
  brandId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function KBSelector({ brandId, selectedIds, onChange, disabled }: KBSelectorProps) {
  const [kbs, setKBs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchKBs = async () => {
      if (!brandId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/knowledge-bases?brand_id=${brandId}`);
        const { data, success } = await res.json();
        if (success) {
          setKBs(data || []);
          // Auto-select default KBs if nothing selected
          if (selectedIds.length === 0) {
            const defaultIds = (data || [])
              .filter((kb: KnowledgeBase) => kb.is_default || kb.is_core)
              .map((kb: KnowledgeBase) => kb.id);
            if (defaultIds.length > 0) {
              onChange(defaultIds);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load KBs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchKBs();
  }, [brandId]);

  const toggleKB = (id: string) => {
    // Don't allow deselecting core KB
    const kb = kbs.find(k => k.id === id);
    if (kb?.is_core && selectedIds.includes(id)) return;

    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(i => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedKBs = kbs.filter(kb => selectedIds.includes(kb.id));
  const totalAssets = selectedKBs.reduce((sum, kb) => sum + kb.asset_count, 0);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading knowledge bases...
      </div>
    );
  }

  if (kbs.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No knowledge bases available
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      <Button
        variant="outline"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="w-full justify-between text-left font-normal"
      >
        <div className="flex items-center gap-2 truncate">
          <FolderOpen className="h-4 w-4 text-slate-400" />
          <span className="truncate">
            {selectedKBs.length === 0
              ? 'Select Knowledge Bases'
              : selectedKBs.length === 1
              ? selectedKBs[0].name
              : `${selectedKBs.length} KBs selected`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{totalAssets} assets</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </Button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-auto">
            {kbs.map((kb) => {
              const isSelected = selectedIds.includes(kb.id);
              return (
                <button
                  key={kb.id}
                  onClick={() => toggleKB(kb.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition-colors ${
                    isSelected ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${kb.color}20` }}
                    >
                      {kb.is_core ? (
                        <Shield className="h-3.5 w-3.5" style={{ color: kb.color }} />
                      ) : (
                        <FolderOpen className="h-3.5 w-3.5" style={{ color: kb.color }} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">{kb.name}</span>
                        {kb.is_core && (
                          <span className="text-xs bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded">
                            Core
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{kb.asset_count} assets</span>
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-indigo-600" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
