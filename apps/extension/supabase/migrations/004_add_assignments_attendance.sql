-- ============================================================================
-- Add Assignments and Attendance to Blackboard Sessions
-- ============================================================================

-- Add new columns for assignments and attendance
ALTER TABLE blackboard_sessions 
ADD COLUMN IF NOT EXISTS assignments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS attendance JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS attendance_stats JSONB DEFAULT '{"present": 0, "absent": 0, "total": 0, "percentage": 0}'::jsonb,
ADD COLUMN IF NOT EXISTS last_full_sync TIMESTAMPTZ;

-- ============================================================================
-- Drop existing functions to allow signature changes
-- ============================================================================
DROP FUNCTION IF EXISTS upsert_blackboard_session(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS upsert_blackboard_session(TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB);
DROP FUNCTION IF EXISTS get_blackboard_session(TEXT);

-- ============================================================================
-- Updated RPC Function: Upsert Blackboard Session with all data
-- ============================================================================
CREATE OR REPLACE FUNCTION upsert_blackboard_session(
  p_student_id TEXT,
  p_bb_user_id TEXT,
  p_bb_username TEXT,
  p_courses JSONB,
  p_assignments JSONB DEFAULT '[]'::jsonb,
  p_attendance JSONB DEFAULT '[]'::jsonb,
  p_attendance_stats JSONB DEFAULT '{"present": 0, "absent": 0, "total": 0, "percentage": 0}'::jsonb
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

  -- Upsert the blackboard session with all data
  INSERT INTO blackboard_sessions (
    student_id,
    bb_user_id,
    bb_username,
    courses,
    assignments,
    attendance,
    attendance_stats,
    last_courses_sync,
    last_full_sync,
    updated_at
  ) VALUES (
    p_student_id,
    p_bb_user_id,
    p_bb_username,
    p_courses,
    p_assignments,
    p_attendance,
    p_attendance_stats,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (student_id) 
  DO UPDATE SET
    bb_user_id = EXCLUDED.bb_user_id,
    bb_username = EXCLUDED.bb_username,
    courses = EXCLUDED.courses,
    assignments = EXCLUDED.assignments,
    attendance = EXCLUDED.attendance,
    attendance_stats = EXCLUDED.attendance_stats,
    last_courses_sync = NOW(),
    last_full_sync = NOW(),
    updated_at = NOW();

  RETURN TRUE;
END;
$$;

-- ============================================================================
-- Updated RPC Function: Get Full Blackboard Session
-- ============================================================================
CREATE OR REPLACE FUNCTION get_blackboard_session(p_student_id TEXT)
RETURNS TABLE (
  bb_user_id TEXT,
  bb_username TEXT,
  courses JSONB,
  assignments JSONB,
  attendance JSONB,
  attendance_stats JSONB,
  last_courses_sync TIMESTAMPTZ,
  last_full_sync TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
    bs.assignments,
    bs.attendance,
    bs.attendance_stats,
    bs.last_courses_sync,
    bs.last_full_sync,
    bs.updated_at
  FROM blackboard_sessions bs
  WHERE bs.student_id = p_student_id;
END;
$$;
