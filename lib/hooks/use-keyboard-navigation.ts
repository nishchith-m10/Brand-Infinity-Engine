/**
 * Global Keyboard Navigation Hook
 * Phase V, Pillar 3: Accessibility Enhancements
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardNavigationOptions {
  shortcuts?: KeyboardShortcut[];
  enableGlobalShortcuts?: boolean;
}

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'k',
    ctrlKey: true,
    metaKey: true, // Support both Ctrl (Windows/Linux) and Cmd (Mac)
    description: 'Open command palette / search',
    action: () => {
      // This will be implemented when we have a command palette
      console.log('Command palette shortcut triggered');
    }
  },
  {
    key: 'n',
    ctrlKey: true,
    metaKey: true,
    description: 'Create new campaign',
    action: () => {
      if (window.location.pathname.includes('/campaigns')) {
        const createButton = document.querySelector('[data-create-campaign]') as HTMLButtonElement;
        createButton?.click();
      }
    }
  },
  {
    key: 'Escape',
    description: 'Close modal/dialog',
    action: () => {
      // ESC key handling is already implemented in individual components
      // This is just for documentation
    }
  },
  {
    key: '?',
    shiftKey: true,
    description: 'Show keyboard shortcuts help',
    action: () => {
      // This will trigger the help modal
      console.log('Keyboard shortcuts help');
    }
  }
];

export function useKeyboardNavigation(options: UseKeyboardNavigationOptions = {}) {
  const router = useRouter();
  const { shortcuts = [], enableGlobalShortcuts = true } = options;

  useEffect(() => {
    if (!enableGlobalShortcuts) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in an input
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.contentEditable === 'true')
      ) {
        return;
      }

      const allShortcuts = [...DEFAULT_SHORTCUTS, ...shortcuts];

      for (const shortcut of allShortcuts) {
        const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlKey ? e.ctrlKey : true;
        const metaMatches = shortcut.metaKey ? e.metaKey : true;
        const shiftMatches = shortcut.shiftKey ? e.shiftKey : !shortcut.shiftKey;
        const altMatches = shortcut.altKey ? e.altKey : !shortcut.altKey;

        // For shortcuts that require Ctrl OR Meta (like Cmd+K or Ctrl+K)
        const modifierMatches = shortcut.ctrlKey && shortcut.metaKey 
          ? (e.ctrlKey || e.metaKey)
          : ctrlMatches && metaMatches;

        if (keyMatches && modifierMatches && shiftMatches && altMatches) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [shortcuts, enableGlobalShortcuts, router]);

  return {
    shortcuts: [...DEFAULT_SHORTCUTS, ...shortcuts],
  };
}

/**
 * Hook for skip-to-main navigation (accessibility)
 */
export function useSkipToMain() {
  useEffect(() => {
    const handleSkipToMain = (e: KeyboardEvent) => {
      // Tab key to focus skip link, Enter to activate
      if (e.key === 'Enter' && e.target instanceof HTMLElement && e.target.id === 'skip-to-main') {
        e.preventDefault();
        const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
        if (mainContent instanceof HTMLElement) {
          mainContent.focus();
          mainContent.scrollIntoView();
        }
      }
    };

    document.addEventListener('keydown', handleSkipToMain);
    return () => document.removeEventListener('keydown', handleSkipToMain);
  }, []);
}

/**
 * Hook for roving tabindex pattern (for lists and grids)
 */
export function useRovingTabindex(containerRef: React.RefObject<HTMLElement>, itemSelector: string = '[role="option"], [role="gridcell"], [role="tab"]') {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
      const currentIndex = items.findIndex(item => item === document.activeElement);
      
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          nextIndex = (currentIndex + 1) % items.length;
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          nextIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = items.length - 1;
          break;
        default:
          return;
      }

      // Update tabindex
      items.forEach((item, index) => {
        item.tabIndex = index === nextIndex ? 0 : -1;
      });

      items[nextIndex]?.focus();
    };

    container.addEventListener('keydown', handleKeyDown);

    // Initialize tabindex
    const items = Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
    items.forEach((item, index) => {
      item.tabIndex = index === 0 ? 0 : -1;
    });

    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, itemSelector]);
}