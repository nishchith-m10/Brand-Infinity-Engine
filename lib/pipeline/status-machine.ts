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
  qa: ['published', 'draft', 'production', 'cancelled'],
  approval: ['published', 'draft', 'cancelled'], // approval still exists for manual flows (but tests expect qa -> published)
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
  // Define the canonical forward order
  const order: RequestStatus[] = ['intake', 'draft', 'production', 'qa', 'published'];
  const idx = order.indexOf(current);
  if (idx === -1 || idx >= order.length - 1) return null;
  return order[idx + 1];
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
): 'planning' | 'execution' | 'review' | 'complete' {
  switch (status) {
    case 'intake':
    case 'draft':
      return 'planning';
    case 'production':
      return 'execution';
    case 'qa':
    case 'approval':
      return 'review';
    case 'published':
    case 'cancelled':
      return 'complete';
    default:
      return 'planning';
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
    draft: 'Draft',
    production: 'In Production',
    qa: 'Quality Assurance',
    approval: 'Pending Approval',
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
): 'gray' | 'blue' | 'yellow' | 'purple' | 'green' | 'red' {
  const colors: Record<RequestStatus, 'gray' | 'blue' | 'yellow' | 'purple' | 'green' | 'red'> = {
    intake: 'gray',
    draft: 'blue',
    production: 'yellow',
    qa: 'purple',
    approval: 'purple',
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
): { valid: boolean; error?: string; suggestion?: string } {
  if (isTerminalStatus(from)) {
    return {
      valid: false,
      error: `Cannot transition from terminal status: ${from}`,
    };
  }

  if (!canTransition(from, to)) {
    const possible = getPossibleTransitions(from);
    const suggestion = possible.length > 0 ? possible[0] : undefined;
    return {
      valid: false,
      error: `Invalid transition from ${from} to ${to}`,
      suggestion,
    };
  }

  return { valid: true };
}
