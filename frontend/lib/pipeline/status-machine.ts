// =============================================================================
// STATUS MACHINE - Phase 7
// Validates and manages status transitions for content requests
// =============================================================================

import { RequestStatus } from '@/types/pipeline';

// Valid transitions map
const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  intake: ['draft', 'cancelled'],
  draft: ['production', 'cancelled'],
  production: ['qa', 'cancelled'],
  qa: ['published', 'draft', 'cancelled'], // Can go back to draft for revisions
  published: [], // Terminal state
  cancelled: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get the next logical status (excluding cancellation)
 */
export function getNextStatus(current: RequestStatus): RequestStatus | null {
  const next = VALID_TRANSITIONS[current];
  // Return first non-cancelled option
  return next?.find((s) => s !== 'cancelled') ?? null;
}

/**
 * Check if a status is terminal (cannot transition further)
 */
export function isTerminalStatus(status: RequestStatus): boolean {
  return status === 'published' || status === 'cancelled';
}

/**
 * Get the stage grouping for a status (for UI)
 */
export function getStageForStatus(
  status: RequestStatus
): 'planning' | 'creating' | 'reviewing' | 'done' {
  switch (status) {
    case 'intake':
    case 'draft':
      return 'planning';
    case 'production':
      return 'creating';
    case 'qa':
      return 'reviewing';
    case 'published':
    case 'cancelled':
      return 'done';
  }
}

/**
 * Get all possible transitions from a status
 */
export function getPossibleTransitions(current: RequestStatus): RequestStatus[] {
  return VALID_TRANSITIONS[current] || [];
}

/**
 * Get user-friendly status label
 */
export function getStatusLabel(status: RequestStatus): string {
  const labels: Record<RequestStatus, string> = {
    intake: 'Intake',
    draft: 'Drafting',
    production: 'In Production',
    qa: 'Quality Review',
    published: 'Published',
    cancelled: 'Cancelled',
  };
  return labels[status];
}

/**
 * Get status color for UI
 */
export function getStatusColor(
  status: RequestStatus
): 'gray' | 'blue' | 'yellow' | 'green' | 'red' {
  const colors: Record<RequestStatus, 'gray' | 'blue' | 'yellow' | 'green' | 'red'> = {
    intake: 'gray',
    draft: 'blue',
    production: 'yellow',
    qa: 'yellow',
    published: 'green',
    cancelled: 'red',
  };
  return colors[status];
}

/**
 * Validate a status transition and return error message if invalid
 */
export function validateTransition(
  from: RequestStatus,
  to: RequestStatus
): { valid: boolean; error?: string } {
  if (isTerminalStatus(from)) {
    return {
      valid: false,
      error: `Cannot transition from terminal status: ${from}`,
    };
  }

  if (!canTransition(from, to)) {
    return {
      valid: false,
      error: `Invalid transition from ${from} to ${to}`,
    };
  }

  return { valid: true };
}
