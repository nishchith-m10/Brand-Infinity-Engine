/**
 * Accessibility Enhancement Utilities
 * Phase V, Pillar 3: Accessibility Enhancements
 */

'use client';

import React from 'react';

/**
 * Screen Reader Only Text Component
 * Used to provide additional context for screen readers while hiding from visual users
 */
export function ScreenReaderOnly({ children, as: Component = 'span', ...props }: {
  children: React.ReactNode;
  as?: React.ElementType;
  [key: string]: any;
}) {
  return (
    <Component
      className="sr-only"
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * Visually Hidden component using Tailwind's sr-only class
 * Alternative to ScreenReaderOnly with explicit className
 */
export function VisuallyHidden({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className="sr-only" {...props}>
      {children}
    </span>
  );
}

/**
 * Accessible Icon Component
 * Provides proper labeling for icons used in buttons/links
 */
export function AccessibleIcon({ 
  children, 
  label, 
  isDecorative = false,
  ...props 
}: {
  children: React.ReactNode;
  label?: string;
  isDecorative?: boolean;
  [key: string]: any;
}) {
  if (isDecorative) {
    return (
      <span aria-hidden="true" {...props}>
        {children}
      </span>
    );
  }

  return (
    <span aria-label={label} role="img" {...props}>
      {children}
      {label && <VisuallyHidden>{label}</VisuallyHidden>}
    </span>
  );
}

/**
 * Focus Trap Component
 * Traps focus within a container (useful for modals, dropdowns)
 */
export function FocusTrap({ 
  children, 
  isActive = true, 
  onEscape,
  ...props 
}: {
  children: React.ReactNode;
  isActive?: boolean;
  onEscape?: () => void;
  [key: string]: any;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      } else if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isActive, onEscape]);

  return (
    <div ref={containerRef} {...props}>
      {children}
    </div>
  );
}

/**
 * Announcement Component
 * For screen reader announcements using aria-live regions
 */
export function Announcement({ 
  children, 
  politeness = 'polite', 
  ...props 
}: {
  children: React.ReactNode;
  politeness?: 'assertive' | 'polite' | 'off';
  [key: string]: any;
}) {
  return (
    <div 
      aria-live={politeness} 
      aria-atomic="true" 
      className="sr-only"
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Loading Announcement Hook
 * Announces loading states to screen readers
 */
export function useLoadingAnnouncement(isLoading: boolean, loadingText = "Loading", loadedText = "Content loaded") {
  const [announcement, setAnnouncement] = React.useState('');

  React.useEffect(() => {
    if (isLoading) {
      setAnnouncement(loadingText);
    } else {
      const timer = setTimeout(() => {
        setAnnouncement(loadedText);
      }, 100); // Small delay to ensure the announcement is heard
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, loadingText, loadedText]);

  return announcement;
}

/**
 * Enhanced Link Component with accessibility features
 */
export function AccessibleLink({
  children,
  href,
  isExternal = false,
  showExternalIcon = true,
  ...props
}: {
  children: React.ReactNode;
  href: string;
  isExternal?: boolean;
  showExternalIcon?: boolean;
  [key: string]: any;
}) {
  const externalProps = isExternal ? {
    target: '_blank',
    rel: 'noopener noreferrer',
    'aria-describedby': 'external-link-description'
  } : {};

  return (
    <>
      <a href={href} {...externalProps} {...props}>
        {children}
        {isExternal && showExternalIcon && (
          <span aria-hidden="true" className="ml-1">
            ↗
          </span>
        )}
        {isExternal && (
          <VisuallyHidden>(opens in new tab)</VisuallyHidden>
        )}
      </a>
      {isExternal && (
        <div id="external-link-description" className="sr-only">
          External links open in a new tab
        </div>
      )}
    </>
  );
}

/**
 * Form Section Component with proper heading hierarchy
 */
export function FormSection({
  title,
  description,
  level = 2,
  children,
  ...props
}: {
  title: string;
  description?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  [key: string]: any;
}) {
  const HeadingTag = React.createElement as any;
  const headingTagName = `h${level}`;
  
  return (
    <section {...props}>
      {React.createElement(
        headingTagName,
        { className: "text-lg font-semibold text-gray-900 mb-2" },
        title
      )}
      {description && (
        <p className="text-sm text-gray-600 mb-4">
          {description}
        </p>
      )}
      {children}
    </section>
  );
}

/**
 * Progress indicator with accessibility support
 */
export function AccessibleProgress({
  value,
  max = 100,
  label,
  showPercentage = true,
  ...props
}: {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  [key: string]: any;
}) {
  const percentage = Math.round((value / max) * 100);
  
  return (
    <div role="group" aria-labelledby={label ? "progress-label" : undefined} {...props}>
      {label && (
        <div id="progress-label" className="text-sm font-medium text-gray-700 mb-2">
          {label}
          {showPercentage && <span className="ml-2">({percentage}%)</span>}
        </div>
      )}
      <div 
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || `Progress: ${percentage}%`}
        className="w-full bg-gray-200 rounded-full h-2"
      >
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Utility function to generate accessible IDs
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook for managing focus restoration
 */
export function useFocusRestore() {
  const focusedElementRef = React.useRef<Element | null>(null);

  const saveFocus = React.useCallback(() => {
    focusedElementRef.current = document.activeElement;
  }, []);

  const restoreFocus = React.useCallback(() => {
    if (focusedElementRef.current && focusedElementRef.current instanceof HTMLElement) {
      focusedElementRef.current.focus();
    }
  }, []);

  return { saveFocus, restoreFocus };
}

/**
 * Hook for announcing dynamic content changes
 */
export function useAnnouncer() {
  const [message, setMessage] = React.useState('');
  
  const announce = React.useCallback((newMessage: string, politeness: 'assertive' | 'polite' = 'polite') => {
    // Clear message first to ensure it's announced even if the same message is set
    setMessage('');
    setTimeout(() => setMessage(newMessage), 10);
  }, []);

  const AnnouncerComponent = React.useMemo(() => (
    <Announcement>
      {message}
    </Announcement>
  ), [message]);

  return { announce, AnnouncerComponent };
}