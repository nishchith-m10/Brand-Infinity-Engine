-- =============================================================================
-- Migration: 20260111141000_soft_delete_cascade_triggers.sql
-- Description: Phase III, Pillar 2 - Add triggers for cascade soft delete
-- Created: 2026-01-11
-- Reference: docs/plans/phase_execution_plan.md Section Pillar III-2
-- 
-- PURPOSE:
--   When a parent record is soft-deleted, automatically soft-delete child records
--   to maintain referential integrity and prevent orphaned data.
-- 
-- CASCADES:
--   content_requests -> request_tasks, request_events
--   campaigns -> content_requests, videos
--   conversation_sessions -> conversation_messages
-- =============================================================================

-- =============================================================================
-- TRIGGER: Cascade soft delete from content_requests to child tables
-- =============================================================================

CREATE OR REPLACE FUNCTION cascade_soft_delete_content_request()
RETURNS TRIGGER AS $$
BEGIN
  -- When content_requests.deleted_at is set, cascade to child tables
  IF NEW.deleted_at IS NOT NULL AND (OLD.deleted_at IS NULL OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
    -- Soft delete related request_tasks
    UPDATE request_tasks
    SET deleted_at = NEW.deleted_at
    WHERE request_id = NEW.id
    AND deleted_at IS NULL;

    -- Soft delete related request_events
    UPDATE request_events
    SET deleted_at = NEW.deleted_at
    WHERE request_id = NEW.id
    AND deleted_at IS NULL;

    RAISE NOTICE 'Cascade soft-deleted children of content_request %', NEW.id;
  END IF;

  -- When content_requests.deleted_at is cleared, restore child tables
  IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    -- Restore related request_tasks
    UPDATE request_tasks
    SET deleted_at = NULL
    WHERE request_id = NEW.id
    AND deleted_at = OLD.deleted_at;

    -- Restore related request_events
    UPDATE request_events
    SET deleted_at = NULL
    WHERE request_id = NEW.id
    AND deleted_at = OLD.deleted_at;

    RAISE NOTICE 'Cascade restored children of content_request %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cascade_soft_delete_content_request ON content_requests;
CREATE TRIGGER trigger_cascade_soft_delete_content_request
  AFTER UPDATE OF deleted_at ON content_requests
  FOR EACH ROW
  EXECUTE FUNCTION cascade_soft_delete_content_request();

COMMENT ON FUNCTION cascade_soft_delete_content_request IS 'Cascade soft delete/restore from content_requests to request_tasks and request_events';

-- =============================================================================
-- TRIGGER: Cascade soft delete from campaigns to child tables
-- =============================================================================

CREATE OR REPLACE FUNCTION cascade_soft_delete_campaign()
RETURNS TRIGGER AS $$
BEGIN
  -- When campaigns.deleted_at is set, cascade to child tables
  IF NEW.deleted_at IS NOT NULL AND (OLD.deleted_at IS NULL OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
    -- Soft delete related content_requests
    UPDATE content_requests
    SET deleted_at = NEW.deleted_at
    WHERE campaign_id = NEW.id
    AND deleted_at IS NULL;

    -- Soft delete related videos (if campaign_id column exists)
    UPDATE videos
    SET deleted_at = NEW.deleted_at
    WHERE campaign_id = NEW.id
    AND deleted_at IS NULL;

    RAISE NOTICE 'Cascade soft-deleted children of campaign %', NEW.id;
  END IF;

  -- When campaigns.deleted_at is cleared, restore child tables
  IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    -- Restore related content_requests
    UPDATE content_requests
    SET deleted_at = NULL
    WHERE campaign_id = NEW.id
    AND deleted_at = OLD.deleted_at;

    -- Restore related videos
    UPDATE videos
    SET deleted_at = NULL
    WHERE campaign_id = NEW.id
    AND deleted_at = OLD.deleted_at;

    RAISE NOTICE 'Cascade restored children of campaign %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cascade_soft_delete_campaign ON campaigns;
CREATE TRIGGER trigger_cascade_soft_delete_campaign
  AFTER UPDATE OF deleted_at ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION cascade_soft_delete_campaign();

COMMENT ON FUNCTION cascade_soft_delete_campaign IS 'Cascade soft delete/restore from campaigns to content_requests and videos';

-- =============================================================================
-- TRIGGER: Cascade soft delete from conversation_sessions to messages
-- =============================================================================

CREATE OR REPLACE FUNCTION cascade_soft_delete_conversation_session()
RETURNS TRIGGER AS $$
BEGIN
  -- When conversation_sessions.deleted_at is set, cascade to messages
  IF NEW.deleted_at IS NOT NULL AND (OLD.deleted_at IS NULL OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
    UPDATE conversation_messages
    SET deleted_at = NEW.deleted_at
    WHERE session_id = NEW.id
    AND deleted_at IS NULL;

    RAISE NOTICE 'Cascade soft-deleted messages of conversation_session %', NEW.id;
  END IF;

  -- When conversation_sessions.deleted_at is cleared, restore messages
  IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    UPDATE conversation_messages
    SET deleted_at = NULL
    WHERE session_id = NEW.id
    AND deleted_at = OLD.deleted_at;

    RAISE NOTICE 'Cascade restored messages of conversation_session %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cascade_soft_delete_conversation_session ON conversation_sessions;
CREATE TRIGGER trigger_cascade_soft_delete_conversation_session
  AFTER UPDATE OF deleted_at ON conversation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION cascade_soft_delete_conversation_session();

COMMENT ON FUNCTION cascade_soft_delete_conversation_session IS 'Cascade soft delete/restore from conversation_sessions to conversation_messages';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgname LIKE 'trigger_cascade_soft_delete%';
  
  RAISE NOTICE 'Cascade soft delete triggers created: %', trigger_count;
END $$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

SELECT 
    '✓ Cascade Soft Delete Triggers Complete!' AS status,
    'Created triggers for content_requests, campaigns, conversation_sessions' AS summary,
    NOW() AS completed_at;
