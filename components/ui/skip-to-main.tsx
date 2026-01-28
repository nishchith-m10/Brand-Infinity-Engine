/**
 * Skip to Main Content Component
 * Phase V, Pillar 3: Accessibility Enhancements
 * 
 * This component provides a "Skip to main content" link for screen reader users
 * and keyboard navigation users to bypass navigation links.
 */

'use client';

import { cn } from '@/lib/utils';

interface SkipToMainProps {
  className?: string;
  mainId?: string;
}

export function SkipToMain({ className, mainId = 'main-content' }: SkipToMainProps) {
  const handleSkip = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const mainContent = document.getElementById(mainId) || 
                      document.querySelector('main') || 
                      document.querySelector('[role="main"]');
    
    if (mainContent instanceof HTMLElement) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${mainId}`}
      onClick={handleSkip}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleSkip(e);
        }
      }}
      className={cn(
        // Position off-screen by default
        'absolute -top-40 left-6 z-[100]',
        // Show when focused
        'focus:top-6',
        // Styling
        'bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium',
        'transition-all duration-200 ease-in-out',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        // Skip past all other content when focused
        'focus:z-[1000]',
        className
      )}
    >
      Skip to main content
    </a>
  );
}

/**
 * Keyboard Shortcuts Help Modal
 */
import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';

interface KeyboardShortcut {
  keys: string[];
  description: string;
  section?: string;
}

const SHORTCUTS: KeyboardShortcut[] = [
  { keys: ['Ctrl', 'K'], description: 'Open command palette', section: 'General' },
  { keys: ['Cmd', 'K'], description: 'Open command palette (Mac)', section: 'General' },
  { keys: ['Ctrl', 'N'], description: 'Create new campaign', section: 'General' },
  { keys: ['Cmd', 'N'], description: 'Create new campaign (Mac)', section: 'General' },
  { keys: ['Escape'], description: 'Close modal or dialog', section: 'Navigation' },
  { keys: ['Tab'], description: 'Move to next focusable element', section: 'Navigation' },
  { keys: ['Shift', 'Tab'], description: 'Move to previous focusable element', section: 'Navigation' },
  { keys: ['Enter'], description: 'Activate button or link', section: 'Navigation' },
  { keys: ['Space'], description: 'Activate button', section: 'Navigation' },
  { keys: ['Arrow Keys'], description: 'Navigate lists and grids', section: 'Navigation' },
  { keys: ['Home'], description: 'Go to first item in list', section: 'Navigation' },
  { keys: ['End'], description: 'Go to last item in list', section: 'Navigation' },
  { keys: ['?'], description: 'Show this help dialog', section: 'Help' },
];

export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  const groupedShortcuts = SHORTCUTS.reduce((acc, shortcut) => {
    const section = shortcut.section || 'Other';
    if (!acc[section]) acc[section] = [];
    acc[section].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        aria-label="Show keyboard shortcuts"
        className="fixed bottom-4 right-4 z-40 bg-white shadow-lg border"
      >
        <Keyboard className="h-4 w-4" />
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Keyboard Shortcuts"
        description="Navigate faster with these keyboard shortcuts"
        size="lg"
      >
        <div className="space-y-6">
          {Object.entries(groupedShortcuts).map(([section, shortcuts]) => (
            <div key={section}>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{section}</h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <div key={index} className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <kbd
                          key={keyIndex}
                          className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 rounded"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Press <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 rounded">?</kbd> anytime to show this dialog
          </p>
        </div>
      </Modal>
    </>
  );
}