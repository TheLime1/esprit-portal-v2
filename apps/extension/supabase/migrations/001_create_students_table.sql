-- ============================================================================
-- Esprit Portal V2 - Supabase Schema
-- Multi-layer caching with Row Level Security (RLS)
-- ============================================================================
-- 
-- Caching Strategy:
-- 1. Extension checks localStorage first
-- 2. If localStorage empty → check Supabase
-- 3. If Supabase empty → fetch from old portal
-- 4. If data older than 4 hours → background refresh
--
-- Security: RLS ensures each student can only access their own row
-- Authentication: student_id + password (plaintext) stored in row
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Students Table - One row per student with all their data
-- ============================================================================
CREATE TABLE IF NOT EXISTS students (
    -- Primary key is the student ID (e.g., "21123456")
    student_id TEXT PRIMARY KEY,
    
    -- Password stored in plaintext (as per requirement)
    -- Used for RLS authentication since anon key is exposed in extension
    password TEXT NOT NULL,
    
    -- Basic student profile
    name TEXT,
    class_name TEXT,
    
    -- All grades data as JSONB (regularGrades, principalResult, etc.)
    grades_data JSONB DEFAULT '{}'::jsonb,
    
    -- Credits data as JSONB array
    credits_data JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps for cache invalidation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
-- Enable RLS on the students table
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: No RLS policies are created intentionally!
-- This means NO direct access to the students table is allowed.
-- All access must go through the SECURITY DEFINER RPC functions below,
-- which validate student_id + password before returning/modifying data.
-- 
-- This approach ensures:
-- 1. Random users cannot access the table at all
-- 2. Students can only access their own data (validated by RPC functions)
-- 3. No way to bypass authentication since table is completely locked down

-- ============================================================================
-- RPC Function: Authenticate and Get Data
-- This is the main function the extension calls to fetch data from Supabase
-- Returns student data only if credentials match
-- ============================================================================
CREATE OR REPLACE FUNCTION authenticate_and_get_data(
    p_student_id TEXT,
    p_password TEXT
)
RETURNS TABLE (
    student_id TEXT,
    name TEXT,
    class_name TEXT,
    grades_data JSONB,
    credits_data JSONB,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with the privileges of the function owner
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.student_id,
        s.name,
        s.class_name,
        s.grades_data,
        s.credits_data,
        s.updated_at
    FROM students s
    WHERE s.student_id = p_student_id
      AND s.password = p_password;
END;
$$;

-- ============================================================================
-- RPC Function: Upsert Student Data
-- Called by extension after fetching from old portal
-- Inserts new row or updates existing one
-- ============================================================================
CREATE OR REPLACE FUNCTION upsert_student_data(
    p_student_id TEXT,
    p_password TEXT,
    p_name TEXT DEFAULT NULL,
    p_class_name TEXT DEFAULT NULL,
    p_grades_data JSONB DEFAULT '{}'::jsonb,
    p_credits_data JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    INSERT INTO students (
        student_id,
        password,
        name,
        class_name,
        grades_data,
        credits_data,
        updated_at
    )
    VALUES (
        p_student_id,
        p_password,
        p_name,
        p_class_name,
        p_grades_data,
        p_credits_data,
        NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
        -- Only update if password matches (security check)
        password = CASE 
            WHEN students.password = p_password THEN p_password 
            ELSE students.password 
        END,
        name = CASE 
            WHEN students.password = p_password THEN COALESCE(p_name, students.name)
            ELSE students.name 
        END,
        class_name = CASE 
            WHEN students.password = p_password THEN COALESCE(p_class_name, students.class_name)
            ELSE students.class_name 
        END,
        grades_data = CASE 
            WHEN students.password = p_password THEN p_grades_data 
            ELSE students.grades_data 
        END,
        credits_data = CASE 
            WHEN students.password = p_password THEN p_credits_data 
            ELSE students.credits_data 
        END,
        updated_at = CASE 
            WHEN students.password = p_password THEN NOW() 
            ELSE students.updated_at 
        END
    RETURNING jsonb_build_object(
        'success', true,
        'student_id', students.student_id,
        'updated_at', students.updated_at
    ) INTO result;
    
    RETURN result;
END;
$$;

-- ============================================================================
-- RPC Function: Check if data needs refresh
-- Returns updated_at timestamp to determine if cache is stale
-- ============================================================================
CREATE OR REPLACE FUNCTION check_data_freshness(
    p_student_id TEXT,
    p_password TEXT
)
RETURNS TABLE (
    needs_refresh BOOLEAN,
    updated_at TIMESTAMPTZ,
    hours_since_update NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_at TIMESTAMPTZ;
    v_hours_diff NUMERIC;
BEGIN
    SELECT s.updated_at INTO v_updated_at
    FROM students s
    WHERE s.student_id = p_student_id
      AND s.password = p_password;
    
    IF v_updated_at IS NULL THEN
        -- No data found, needs refresh
        RETURN QUERY SELECT true::BOOLEAN, NULL::TIMESTAMPTZ, NULL::NUMERIC;
    ELSE
        v_hours_diff := EXTRACT(EPOCH FROM (NOW() - v_updated_at)) / 3600;
        -- Needs refresh if older than 4 hours
        RETURN QUERY SELECT (v_hours_diff >= 4)::BOOLEAN, v_updated_at, v_hours_diff;
    END IF;
END;
$$;

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_students_updated_at ON students(updated_at DESC);

-- ============================================================================
-- Grant permissions to authenticated and anon roles
-- ============================================================================
-- Grant schema usage to both roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- DO NOT grant direct table access - all access must go through RPC functions
-- GRANT SELECT, INSERT, UPDATE, DELETE ON students TO anon, authenticated;  -- REMOVED

-- Only grant execute permissions on the RPC functions
-- These functions validate credentials before allowing data access
GRANT EXECUTE ON FUNCTION authenticate_and_get_data TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_student_data TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_data_freshness TO anon, authenticated;
