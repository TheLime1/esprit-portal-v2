-- ============================================================================
-- Migration: Add account_issue field for students with platform restrictions
-- ============================================================================
-- 
-- Some students have account issues that prevent them from:
-- - Accessing grades
-- - Accessing credits
-- 
-- But they can still:
-- - Use timetable (with manually set class)
-- - Link with Blackboard
--
-- Account issue types:
-- - 'payment': "Veuillez procéder au paiement de vos frais d'inscription"
-- - 'admin': "Veuillez contacter le service élèves..."
-- - 'dossier': "Vous n'avez pas encore déposé votre dossier physique"
-- - null: No issues (normal account)
-- ============================================================================

-- Add account_issue column to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS account_issue TEXT DEFAULT NULL;

-- Add manual_class column for students who need to set class manually
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS manual_class TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN students.account_issue IS 'Type of account issue: payment, admin, dossier, or null for normal accounts';
COMMENT ON COLUMN students.manual_class IS 'Manually entered class name for students with account issues who cannot auto-fetch';

-- Update RLS policy to allow students to update their own manual_class
-- The existing policy should already allow this since it's an update on own row
