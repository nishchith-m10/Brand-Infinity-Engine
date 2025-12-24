'use client';

import { SWRConfig } from 'swr';
import { ReactNode } from 'react';

// Global fetcher for SWR
export const fetcher = async (url: string) => {
  const res = await fetch(url);
  
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }
  
  return res.json();
};

// SWR configuration options
const swrConfig = {
  fetcher,
  revalidateOnFocus: false,        // Don't revalidate when window regains focus
  revalidateOnReconnect: true,     // Revalidate when network reconnects
  refreshInterval: 0,              // No automatic refresh by default
  dedupingInterval: 2000,          // Dedupe requests within 2 seconds
  errorRetryCount: 3,              // Retry failed requests 3 times
  errorRetryInterval: 5000,        // Wait 5 seconds between retries
  shouldRetryOnError: true,        // Retry on error
  keepPreviousData: true,          // Keep showing old data while fetching new
};

interface SWRProviderProps {
  children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig value={swrConfig}>
      {children}
    </SWRConfig>
  );
}
