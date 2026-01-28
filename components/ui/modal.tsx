'use client';

import { Fragment, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<Element | null>(null);

  // Handle escape key and focus management
  useEffect(() => {
    if (!isOpen) return;

    // Store the previously focused element
    previousActiveElementRef.current = document.activeElement;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

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
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTabKey);
    document.body.style.overflow = 'hidden';

    // Focus the close button when modal opens
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTabKey);
      document.body.style.overflow = 'unset';
      
      // Restore focus to the previously focused element
      if (previousActiveElementRef.current instanceof HTMLElement) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  };

  return (
    <Fragment>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          aria-describedby={description ? 'modal-description' : undefined}
          className={cn(
            'relative w-full rounded-lg bg-white shadow-xl focus:outline-none',
            sizes[size],
            'max-h-[90vh] overflow-hidden'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || description) && (
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 id="modal-title" className="text-lg font-semibold text-gray-900 pr-8">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id="modal-description" className="mt-1 text-sm text-gray-500 pr-8">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  ref={closeButtonRef}
                  onClick={onClose}
                  aria-label="Close modal"
                  className="flex-shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-6 py-4">
            {children}
          </div>
        </div>
      </div>
    </Fragment>
  );
}
