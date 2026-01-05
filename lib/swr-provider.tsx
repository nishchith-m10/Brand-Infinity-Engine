'use client';

import { SWRConfig } from 'swr';
import { ReactNode } from 'react';

// Global fetcher for SWR
export const fetcher = async (url: string) => {
  const res = await fetch(url);
  
  if (!res.ok) {
    // Try to parse error as JSON, fallback to text if it fails
    let errorMessage = 'An error occurred while fetching the data.';
    try {
      const errorData = await res.json();
      errorMessage = errorData.error?.message || errorMessage;
    } catch {
      // Response is not JSON (likely HTML error page)
      errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    }
    
    const error = new Error(errorMessage) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  
  // Check if response is JSON
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Response is not JSON');
  }
  
  const json = await res.json();
  
  // If the response has the standard API format {success, data}, unwrap it
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data;
  }
  
  // Otherwise return as-is (for non-standard responses)
  return json;
};

// SWR configuration options - Optimized for real-time sync
const swrConfig = {
  fetcher,
  revalidateOnFocus: true,         // Refresh when user returns to tab
  revalidateOnReconnect: true,     // Revalidate when network reconnects
  refreshInterval: 30000,          // Auto-refresh every 30 seconds for background sync
  dedupingInterval: 2000,          // Dedupe requests within 2 seconds
  errorRetryCount: 3,              // Retry failed requests 3 times
  errorRetryInterval: 5000,        // Wait 5 seconds between retries
  shouldRetryOnError: true,        // Retry on error
  keepPreviousData: true,          // Keep showing old data while fetching new
  revalidateIfStale: true,         // Revalidate stale data immediately
  focusThrottleInterval: 5000,     // Throttle focus revalidation to every 5s
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
