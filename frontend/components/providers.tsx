'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { SWRProvider } from '@/lib/swr-provider';
import { SidebarProvider } from '@/lib/context/sidebar-context';
import { ApiKeysProvider } from '@/contexts/api-keys-context';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function Providers({ children, initialTheme }: { children: React.ReactNode; initialTheme?: string }) {
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
              <NextThemesProvider
                attribute="class"
                defaultTheme={initialTheme ?? 'system'}
                enableSystem={true}
                disableTransitionOnChange={false}
              >
                {children}
              </NextThemesProvider>
            </SidebarProvider>
          </ApiKeysProvider>
        </AuthProvider>
      </SWRProvider>
    </QueryClientProvider>
  );
}
