-- Migration: Extend workflow_step_type constraint to support crawling
-- Purpose: Enable workflow step type 'crawling' for SERP API integration (BLOCKER-002)  
-- Date: 2026-06-14

BEGIN;

-- Drop the existing constraint that only allows 'acquisition'
ALTER TABLE api_service_tool_step_bindings 
DROP CONSTRAINT IF EXISTS api_service_tool_step_bindings_workflow_step_type_check;

-- Add new constraint that allows both 'acquisition' and 'crawling'
ALTER TABLE api_service_tool_step_bindings 
ADD CONSTRAINT api_service_tool_step_bindings_workflow_step_type_check 
CHECK (workflow_step_type IN ('acquisition', 'crawling'));

COMMIT;