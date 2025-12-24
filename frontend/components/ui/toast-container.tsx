'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { type Toast, type ToastType } from '@/lib/hooks/use-toast';

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const toastConfig: Record<ToastType, { icon: React.ReactNode; bgColor: string; borderColor: string }> = {
  success: {
    icon: <CheckCircle className="h-5 w-5" />,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
  },
  error: {
    icon: <XCircle className="h-5 w-5" />,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
  },
  info: {
    icon: <Info className="h-5 w-5" />,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
  },
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const config = toastConfig[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              className={`pointer-events-auto flex w-96 items-start gap-3 rounded-lg border-l-4 ${config.borderColor} ${config.bgColor} p-4 shadow-lg`}
            >
              <div className="flex-shrink-0 pt-0.5">{config.icon}</div>
              <p className="flex-1 text-sm font-medium text-gray-900">{toast.message}</p>
              <button
                onClick={() => onDismiss(toast.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
