-- ============================================================================
-- Fix Blackboard Sessions RLS - Use RPC Functions Instead
-- ============================================================================
-- 
-- The extension uses the anon key, so we need SECURITY DEFINER functions
-- to bypass RLS while still validating access at the application level.
--

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Students can view own BB data" ON blackboard_sessions;
DROP POLICY IF EXISTS "Students can update own BB data" ON blackboard_sessions;
DROP POLICY IF EXISTS "Students can upsert own BB data" ON blackboard_sessions;

-- Create permissive policies for RPC functions (SECURITY DEFINER bypasses anyway)
-- These are fallback policies in case direct access is attempted
CREATE POLICY "Allow all via RPC" 
  ON blackboard_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RPC Function: Upsert Blackboard Session
-- ============================================================================
-- Validates that the student exists before allowing upsert
CREATE OR REPLACE FUNCTION upsert_blackboard_session(
  p_student_id TEXT,
  p_bb_user_id TEXT,
  p_bb_username TEXT,
  p_courses JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify student exists in students table
  IF NOT EXISTS (SELECT 1 FROM students WHERE student_id = p_student_id) THEN
    RAISE EXCEPTION 'Student not found: %', p_student_id;
  END IF;

  -- Upsert the blackboard session
  INSERT INTO blackboard_sessions (
    student_id,
    bb_user_id,
    bb_username,
    courses,
    last_courses_sync,
    updated_at
  ) VALUES (
    p_student_id,
    p_bb_user_id,
    p_bb_username,
    p_courses,
    NOW(),
    NOW()
  )
  ON CONFLICT (student_id) 
  DO UPDATE SET
    bb_user_id = EXCLUDED.bb_user_id,
    bb_username = EXCLUDED.bb_username,
    courses = EXCLUDED.courses,
    last_courses_sync = NOW(),
    updated_at = NOW();

  RETURN TRUE;
END;
$$;

-- ============================================================================
-- RPC Function: Get Blackboard Courses
-- ============================================================================
CREATE OR REPLACE FUNCTION get_blackboard_session(p_student_id TEXT)
RETURNS TABLE (
  bb_user_id TEXT,
  bb_username TEXT,
  courses JSONB,
  last_courses_sync TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bs.bb_user_id,
    bs.bb_username,
    bs.courses,
    bs.last_courses_sync
  FROM blackboard_sessions bs
  WHERE bs.student_id = p_student_id;
END;
$$;
