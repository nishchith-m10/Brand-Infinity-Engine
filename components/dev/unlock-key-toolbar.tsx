'use client';

import { useState, useEffect } from 'react';
import { Lock, Unlock, X } from 'lucide-react';
import { getStoredUnlockKey, clearUnlockKey } from '@/lib/unlock-key';
import { Tooltip } from '@/components/ui/tooltip';

/**
 * Development Toolbar - Unlock Key Management
 * 
 * Only shows in development mode when an unlock key is active.
 * Allows you to easily view and clear the unlock key.
 */
export function UnlockKeyToolbar() {
  const [isActive, setIsActive] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return;

    const key = getStoredUnlockKey();
    if (key) {
      setTimeout(() => setIsActive(true), 0);
    }
  }, []);

  if (process.env.NODE_ENV !== 'development' || !isActive) {
    return null;
  }

  return (
    <>
      {/* Floating Toggle Button */}
      <Tooltip content="Toggle unlock key toolbar" position="left">
        <button
          onClick={() => setShowToolbar(!showToolbar)}
          className="fixed bottom-4 right-4 z-40 p-3 bg-amber-500 text-white rounded-full shadow-lg hover:bg-amber-600 transition-colors flex items-center justify-center"
        >
          <Unlock className="h-5 w-5" />
        </button>
      </Tooltip>

      {/* Toolbar Panel */}
      {showToolbar && (
        <div className="fixed bottom-20 right-4 z-40 bg-white border border-amber-300 rounded-lg shadow-xl p-4 w-80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-slate-800">Testing Mode Active</span>
            </div>
            <button
              onClick={() => setShowToolbar(false)}
              className="p-1 hover:bg-slate-100 rounded"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          <p className="text-sm text-slate-600 mb-3">
            All workflows (steps 3-7) are unlocked for testing. Security checks remain active.
          </p>

          <div className="space-y-2">
            <div className="bg-amber-50 border border-amber-200 rounded p-2">
              <p className="text-xs text-amber-700 font-mono">
                Key: {getStoredUnlockKey()?.substring(0, 8)}...
              </p>
            </div>

            <button
              onClick={() => {
                clearUnlockKey();
                setIsActive(false);
                setShowToolbar(false);
                // Force reload to apply changes
                window.location.reload();
              }}
              className="w-full px-3 py-2 bg-red-500 text-white text-sm font-medium rounded hover:bg-red-600 transition-colors"
            >
              Clear Unlock Key
            </button>

            <p className="text-xs text-slate-500">
              To unlock again, visit any page with: <br />
              <code className="bg-slate-100 px-2 py-1 rounded text-xs">
                ?unlock_key=YOUR_KEY
              </code>
            </p>
          </div>
        </div>
      )}
    </>
  );
}

