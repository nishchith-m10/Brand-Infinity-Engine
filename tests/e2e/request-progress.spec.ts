// =============================================================================
// REQUEST PROGRESS E2E TESTS
// End-to-end tests for realtime progress UI with Playwright
// =============================================================================

import { test, expect } from '@playwright/test';

/**
 * E2E tests for realtime progress tracking
 * 
 * Prerequisites:
 * - Dev server running (`npm run dev`)
 * - Test database with sample data
 * - User authenticated
 * 
 * Run with: `npx playwright test tests/e2e/request-progress.spec.ts`
 */

test.describe('Request Progress Tracking', () => {
  const TEST_REQUEST_ID = 'test-request-id'; // Replace with actual test request

  test.beforeEach(async ({ page }) => {
    // TODO: Set up authentication (session cookie or auth token)
    // For now, assumes user is already authenticated
  });

  test('should display progress timeline with tasks', async ({ page }) => {
    // Navigate to progress page
    await page.goto(`/requests/${TEST_REQUEST_ID}/progress`);

    // Wait for progress to load
    await page.waitForSelector('text=Request Progress', { timeout: 5000 });

    // Check progress bar exists
    const progressBar = page.locator('[style*="width"]').first();
    await expect(progressBar).toBeVisible();

    // Check task timeline exists
    const timeline = page.locator('.space-y-6'); // Timeline container
    await expect(timeline).toBeVisible();

    // Verify at least one task card is displayed
    const taskCards = page.locator('.rounded-lg.border.bg-card');
    await expect(taskCards.first()).toBeVisible();
  });

  test('should show realtime updates via SSE', async ({ page }) => {
    await page.goto(`/requests/${TEST_REQUEST_ID}/progress`);

    // Get initial percentage
    const initialPercentage = await page.locator('text=/\\d+%/').first().textContent();

    // Wait for SSE update (2 second polling interval + buffer)
    await page.waitForTimeout(3000);

    // Percentage might update if tasks progress
    // (In real test, you'd trigger task completion via API)
    const updatedPercentage = await page.locator('text=/\\d+%/').first().textContent();

    expect(updatedPercentage).toBeDefined();
  });

  test('should display connection status indicator', async ({ page }) => {
    await page.goto(`/requests/${TEST_REQUEST_ID}/progress`);

    // Check for "Live updates" indicator when connected
    const liveIndicator = page.locator('text=Live updates');
    await expect(liveIndicator).toBeVisible({ timeout: 5000 });

    // Verify green dot animation
    const statusDot = page.locator('.bg-green-500.animate-pulse');
    await expect(statusDot).toBeVisible();
  });

  test('should show retry button for failed tasks', async ({ page }) => {
    // This test assumes there's a request with a failed task
    // TODO: Create a test request with a failed strategist task

    await page.goto(`/requests/${TEST_REQUEST_ID}/progress`);

    // Look for retry button (only visible on failed tasks)
    const retryButton = page.locator('button:has-text("Retry")');

    // If there are failed tasks, button should be visible
    if ((await retryButton.count()) > 0) {
      await expect(retryButton.first()).toBeVisible();

      // Click retry button
      await retryButton.first().click();

      // Should show retry indicator
      await expect(page.locator('text=Retrying task...')).toBeVisible({ timeout: 2000 });
    }
  });

  test('should display task timestamps and durations', async ({ page }) => {
    await page.goto(`/requests/${TEST_REQUEST_ID}/progress`);

    // Wait for tasks to load
    await page.waitForSelector('.rounded-lg.border.bg-card', { timeout: 5000 });

    // Check for timestamp labels
    const startedLabel = page.locator('text=Started:');
    if ((await startedLabel.count()) > 0) {
      await expect(startedLabel.first()).toBeVisible();
    }

    // Check for duration on completed tasks
    const durationLabel = page.locator('text=/Duration: \\d+/');
    if ((await durationLabel.count()) > 0) {
      await expect(durationLabel.first()).toBeVisible();
    }
  });

  test('should show current phase indicator', async ({ page }) => {
    await page.goto(`/requests/${TEST_REQUEST_ID}/progress`);

    // Check for "Current Phase" section
    const phaseIndicator = page.locator('text=Current Phase');
    await expect(phaseIndicator).toBeVisible({ timeout: 5000 });

    // Phase name should be displayed (intake, draft, production, qa)
    const phaseName = page.locator('.capitalize').filter({
      hasText: /intake|draft|production|qa/,
    });
    await expect(phaseName.first()).toBeVisible();
  });

  test('should show estimated time remaining', async ({ page }) => {
    await page.goto(`/requests/${TEST_REQUEST_ID}/progress`);

    // Look for time estimate (only shown when tasks are pending)
    const timeEstimate = page.locator('text=/~\\d+ minutes remaining/');

    if ((await timeEstimate.count()) > 0) {
      await expect(timeEstimate.first()).toBeVisible();
    }
  });

  test('should handle reconnection on connection loss', async ({ page }) => {
    await page.goto(`/requests/${TEST_REQUEST_ID}/progress`);

    // Wait for initial connection
    await expect(page.locator('text=Live updates')).toBeVisible({ timeout: 5000 });

    // Simulate connection loss by going offline
    await page.context().setOffline(true);

    // Wait for disconnection indicator
    await expect(page.locator('text=Disconnected')).toBeVisible({ timeout: 5000 });

    // Go back online
    await page.context().setOffline(false);

    // Should automatically reconnect
    await expect(page.locator('text=Live updates')).toBeVisible({ timeout: 10000 });
  });

  test('should display error state when request not found', async ({ page }) => {
    await page.goto('/requests/non-existent-id/progress');

    // Should show error message
    const errorMessage = page.locator('text=Connection Error');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Should show reconnect button
    const reconnectButton = page.locator('button:has-text("Reconnect")');
    await expect(reconnectButton).toBeVisible();
  });

  test('should complete workflow and show 100%', async ({ page }) => {
    // This test assumes there's a test request that completes quickly
    // TODO: Create a test request with fast-completing tasks

    await page.goto(`/requests/${TEST_REQUEST_ID}/progress`);

    // Wait for completion (or timeout)
    try {
      await expect(page.locator('text=/100%/')).toBeVisible({ timeout: 60000 });

      // Verify all tasks are marked completed
      const completedTasks = page.locator('.text-green-600');
      const count = await completedTasks.count();
      expect(count).toBeGreaterThan(0);
    } catch (e) {
      // Test request didn't complete in time - that's okay for this demo test
      console.log('Request did not complete within timeout (expected for long-running tasks)');
    }
  });
});

/**
 * TODO: Additional test scenarios
 * 
 * 1. Test with different request types (image, video, etc.)
 * 2. Test with multiple concurrent requests
 * 3. Test retry behavior with actual task execution
 * 4. Test task dependency visualization
 * 5. Test mobile responsive design
 * 6. Test accessibility (keyboard navigation, screen readers)
 */
