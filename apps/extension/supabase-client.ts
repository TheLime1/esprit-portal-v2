/**
 * Supabase Client Configuration for Esprit Portal Extension
 * 
 * This client is used for the multi-layer caching system:
 * 1. localStorage (instant) → 2. Supabase (cloud) → 3. Portal fetch
 * 
 * SECURITY NOTE:
 * The anon key is exposed in the extension, but RLS policies ensure
 * students can only access their own data by validating student_id + password.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js"

// ============================================================================
// Supabase Configuration
// Uses Plasmo environment variables (prefixed with PLASMO_PUBLIC_)
// ============================================================================
const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!

// Cache duration in hours (0.5 = 30 minutes)
export const CACHE_DURATION_HOURS = 0.5

// ============================================================================
// Types for Supabase data
// ============================================================================
export interface StudentRow {
  student_id: string
  name: string | null
  class_name: string | null
  grades_data: GradesData | null
  credits_data: Credit[] | null
  account_issue: AccountIssueType | null
  manual_class: string | null
  updated_at: string
}

// Account issue types for students with platform restrictions
export type AccountIssueType = 'payment' | 'admin' | 'dossier' | null

export interface GradesData {
  regularGrades: Grade[] | null
  principalResult: { moyenneGeneral: string | null; decision: string | null } | null
  rattrapageGrades: Grade[] | null
  rattrapageResult: { moyenneGeneral: string | null; decision: string | null } | null
  languageLevels: { francais: string | null; anglais: string | null } | null
  lastFetched: string
}

export interface Grade {
  designation: string
  coefficient: number | null
  noteCC: number | null
  noteTP: number | null
  noteExam: number | null
}

export interface Credit {
  [key: string]: string
}

export interface FreshnessCheck {
  needs_refresh: boolean
  updated_at: string | null
  hours_since_update: number | null
}

// ============================================================================
// Create Supabase Client
// ============================================================================
let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    // Validate environment variables
    if (!SUPABASE_URL || SUPABASE_URL === "your_supabase_url_here") {
      console.error("❌ PLASMO_PUBLIC_SUPABASE_URL is not configured!")
    }
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "your_supabase_anon_key_here") {
      console.error("❌ PLASMO_PUBLIC_SUPABASE_ANON_KEY is not configured!")
    }
    
    console.log("🔌 Initializing Supabase client with URL:", SUPABASE_URL?.substring(0, 30) + "...")
    
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,  // No session persistence in extension
        autoRefreshToken: false,
      },
    })
  }
  return supabaseClient
}

// ============================================================================
// Supabase API Functions
// ============================================================================

/**
 * Authenticate and get student data from Supabase
 * Uses RPC function that validates credentials
 */
export async function getStudentDataFromSupabase(
  studentId: string,
  password: string
): Promise<StudentRow | null> {
  const supabase = getSupabaseClient()
  
  try {
    const { data, error } = await supabase
      .rpc("authenticate_and_get_data", {
        p_student_id: studentId,
        p_password: password,
      })
    
    if (error) {
      console.error("Supabase RPC error:", error.message, error.code, error.details)
      return null
    }
    
    // RPC returns an array, get first row
    if (data && data.length > 0) {
      return data[0] as StudentRow
    }
    
    return null
  } catch (e) {
    console.error("Failed to get data from Supabase:", e)
    return null
  }
}

/**
 * Upsert student data to Supabase
 * Called after fetching fresh data from the old portal
 */
export async function upsertStudentDataToSupabase(
  studentId: string,
  password: string,
  name: string | null,
  className: string | null,
  gradesData: GradesData | null,
  creditsData: Credit[] | null
): Promise<boolean> {
  const supabase = getSupabaseClient()
  
  try {
    const { data, error } = await supabase
      .rpc("upsert_student_data", {
        p_student_id: studentId,
        p_password: password,
        p_name: name,
        p_class_name: className,
        p_grades_data: gradesData || {},
        p_credits_data: creditsData || [],
      })
    
    if (error) {
      console.error("Supabase upsert error:", error.message, error.code, error.details)
      return false
    }
    
    console.log("Data synced to Supabase:", data)
    return true
  } catch (e) {
    console.error("Failed to upsert data to Supabase:", e)
    return false
  }
}

/**
 * Check if student data in Supabase needs refresh
 * Returns whether data is older than 4 hours
 */
export async function checkDataFreshness(
  studentId: string,
  password: string
): Promise<FreshnessCheck | null> {
  const supabase = getSupabaseClient()
  
  try {
    const { data, error } = await supabase
      .rpc("check_data_freshness", {
        p_student_id: studentId,
        p_password: password,
      })
    
    if (error) {
      console.error("Supabase freshness check error:", error.message, error.code, error.details)
      return null
    }
    
    if (data && data.length > 0) {
      return data[0] as FreshnessCheck
    }
    
    // No data found, needs refresh
    return { needs_refresh: true, updated_at: null, hours_since_update: null }
  } catch (e) {
    console.error("Failed to check data freshness:", e)
    return null
  }
}

/**
 * Check if cached data is stale based on timestamp
 * @param lastFetched ISO timestamp string
 * @returns true if data is older than CACHE_DURATION_HOURS
 */
export function isDataStale(lastFetched: string | undefined): boolean {
  if (!lastFetched) return true
  
  const fetchedTime = new Date(lastFetched).getTime()
  const now = Date.now()
  const hoursDiff = (now - fetchedTime) / (1000 * 60 * 60)
  
  return hoursDiff >= CACHE_DURATION_HOURS
}

/**
 * Compare two timestamps and return true if the second one is newer
 * @param localTimestamp ISO timestamp from local cache
 * @param supabaseTimestamp ISO timestamp from Supabase
 * @returns true if supabaseTimestamp is newer than localTimestamp
 */
export function isNewerTimestamp(localTimestamp: string | undefined, supabaseTimestamp: string | undefined): boolean {
  if (!supabaseTimestamp) return false
  if (!localTimestamp) return true
  
  const localTime = new Date(localTimestamp).getTime()
  const supabaseTime = new Date(supabaseTimestamp).getTime()
  
  return supabaseTime > localTime
}

// ============================================================================
// Blackboard Courses Storage
// ============================================================================

export interface BBCourseRow {
  id: string
  courseId: string
  name: string
  url: string | null
}

export interface BBAssignmentRow {
  id: string
  contentId: string | null
  name: string
  courseId: string
  courseName: string | null
  due: string | null
  scorePossible: number | null
  score: number | null
  status: string
  submitted: boolean
  graded: boolean
  isPastDue: boolean
  acceptsLate: boolean
  gradingType: string
}

export interface BBAttendanceRow {
  meetingId: string
  meetingName: string | null
  status: string
  courseId: string
  courseName: string | null
}

export interface BBAttendanceStats {
  present: number
  absent: number
  total: number
  percentage: number
}

/**
 * Upsert full Blackboard data to Supabase
 * Includes courses, assignments, and attendance
 */
export async function upsertBlackboardData(
  studentId: string,
  bbUserId: string,
  bbUsername: string,
  courses: BBCourseRow[],
  assignments: BBAssignmentRow[] = [],
  attendance: BBAttendanceRow[] = [],
  attendanceStats: BBAttendanceStats = { present: 0, absent: 0, total: 0, percentage: 0 }
): Promise<boolean> {
  const supabase = getSupabaseClient()
  
  try {
    // Use RPC function to bypass RLS while still validating student exists
    const { data, error } = await supabase
      .rpc("upsert_blackboard_session", {
        p_student_id: studentId,
        p_bb_user_id: bbUserId,
        p_bb_username: bbUsername,
        p_courses: courses,
        p_assignments: assignments,
        p_attendance: attendance,
        p_attendance_stats: attendanceStats,
      })
    
    if (error) {
      console.error("Supabase BB session upsert error:", error.message, error.code, error.details)
      return false
    }
    
    console.log(`Synced to Supabase: ${courses.length} courses, ${assignments.length} assignments, ${attendance.length} attendance records`)
    return true
  } catch (e) {
    console.error("Failed to upsert BB data to Supabase:", e)
    return false
  }
}

/**
 * @deprecated Use upsertBlackboardData instead
 * Upsert Blackboard courses to Supabase (legacy, courses only)
 */
export async function upsertBlackboardCourses(
  studentId: string,
  bbUserId: string,
  bbUsername: string,
  courses: BBCourseRow[]
): Promise<boolean> {
  return upsertBlackboardData(studentId, bbUserId, bbUsername, courses)
}

/**
 * Full Blackboard session data from Supabase
 */
export interface BBSessionData {
  bbUserId: string
  bbUsername: string
  courses: BBCourseRow[]
  assignments: BBAssignmentRow[]
  attendance: BBAttendanceRow[]
  attendanceStats: BBAttendanceStats
  lastSync: string
}

/**
 * Get full Blackboard data from Supabase
 */
export async function getBlackboardDataFromSupabase(
  studentId: string
): Promise<BBSessionData | null> {
  const supabase = getSupabaseClient()
  
  try {
    const { data, error } = await supabase
      .rpc("get_blackboard_session", {
        p_student_id: studentId,
      })
    
    if (error) {
      console.error("Supabase BB data fetch error:", error.message, error.code, error.details)
      return null
    }
    
    if (data && data.length > 0) {
      const row = data[0]
      return {
        bbUserId: row.bb_user_id,
        bbUsername: row.bb_username,
        courses: row.courses as BBCourseRow[] || [],
        assignments: row.assignments as BBAssignmentRow[] || [],
        attendance: row.attendance as BBAttendanceRow[] || [],
        attendanceStats: row.attendance_stats as BBAttendanceStats || { present: 0, absent: 0, total: 0, percentage: 0 },
        lastSync: row.last_full_sync || row.last_courses_sync,
      }
    }
    
    return null
  } catch (e) {
    console.error("Failed to get BB data from Supabase:", e)
    return null
  }
}

/**
 * @deprecated Use getBlackboardDataFromSupabase instead
 * Get Blackboard courses from Supabase
 */
export async function getBlackboardCoursesFromSupabase(
  studentId: string
): Promise<BBCourseRow[] | null> {
  const data = await getBlackboardDataFromSupabase(studentId)
  return data?.courses || null
}
