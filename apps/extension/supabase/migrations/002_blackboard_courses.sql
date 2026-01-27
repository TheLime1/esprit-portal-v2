-- ============================================================================
-- Blackboard Courses Storage (Courses Only - No Credentials)
-- ============================================================================
-- 
-- This table stores only the Blackboard courses linked to Esprit students.
-- NO passwords or session cookies are stored - the extension handles auth
-- via browser cookies which auto-refresh each time user visits Blackboard.
--

CREATE TABLE IF NOT EXISTS blackboard_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Link to Esprit student
  student_id TEXT NOT NULL UNIQUE,
  
  -- Blackboard user info (for display purposes only)
  bb_user_id TEXT NOT NULL,
  bb_username TEXT NOT NULL,
  
  -- Cached courses (JSONB array)
  -- Format: [{id, courseId, name, url}, ...]
  courses JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  last_courses_sync TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key to students table (if it exists)
  CONSTRAINT fk_student FOREIGN KEY (student_id) 
    REFERENCES students(student_id) ON DELETE CASCADE
);

-- Index for fast lookups by student
CREATE INDEX IF NOT EXISTS idx_bb_sessions_student 
  ON blackboard_sessions(student_id);

-- Enable Row Level Security
ALTER TABLE blackboard_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Students can only access their own data
CREATE POLICY "Students can view own BB data" 
  ON blackboard_sessions FOR SELECT
  USING (student_id = current_setting('app.current_student_id', true));

CREATE POLICY "Students can update own BB data" 
  ON blackboard_sessions FOR INSERT
  WITH CHECK (true);  -- Allow inserts, validation done at app level

CREATE POLICY "Students can upsert own BB data" 
  ON blackboard_sessions FOR UPDATE
  USING (true);  -- Allow updates, validation done at app level

-- ============================================================================
-- Helper function to get courses for a student
-- ============================================================================
CREATE OR REPLACE FUNCTION get_blackboard_courses(p_student_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT courses INTO result
  FROM blackboard_sessions
  WHERE student_id = p_student_id;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- ============================================================================
-- What's NOT stored (for security):
-- ============================================================================
-- ❌ Blackboard passwords
-- ❌ Session cookies (BbRouter, JSESSIONID)
-- ❌ Email/password from login form
-- 
-- The extension captures cookies via chrome.cookies API when user naturally
-- logs in. These cookies are stored only in the browser and sync API calls,
-- never in the database.
-- ============================================================================
