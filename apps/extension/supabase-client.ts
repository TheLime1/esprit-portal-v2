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

// Cache duration in hours
export const CACHE_DURATION_HOURS = 4

// ============================================================================
// Types for Supabase data
// ============================================================================
export interface StudentRow {
  student_id: string
  name: string | null
  class_name: string | null
  grades_data: GradesData | null
  credits_data: Credit[] | null
  updated_at: string
}

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
      console.error("Supabase RPC error:", error)
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
      console.error("Supabase upsert error:", error)
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
      console.error("Supabase freshness check error:", error)
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
