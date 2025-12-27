'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { SWRProvider } from '@/lib/swr-provider';
import { SidebarProvider } from '@/lib/context/sidebar-context';
import { ApiKeysProvider } from '@/contexts/api-keys-context';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SWRProvider>
        <AuthProvider>
          <ApiKeysProvider>
            <SidebarProvider>
              {children}
            </SidebarProvider>
          </ApiKeysProvider>
        </AuthProvider>
      </SWRProvider>
    </QueryClientProvider>
  );
}
