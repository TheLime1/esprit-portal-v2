import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Allowed origins for CORS (Chrome extension IDs)
const ALLOWED_ORIGINS = [
  "chrome-extension://ecoohmcojdcogincjmomppjjhddlfcjj",
  "http://localhost:3000",
  "https://esprit-portal-v2.vercel.app",
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o) || origin === o)
    ? origin
    : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

/**
 * OPTIONS /api/blackboard/sync
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return NextResponse.json({}, { headers: getCorsHeaders(origin) });
}

/**
 * POST /api/blackboard/sync
 * 
 * Receives Blackboard session data from the extension.
 * The extension captures cookies when user logs into Blackboard
 * and syncs the data here for the web app to use.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  try {
    const body = await request.json();

    const { user, courses, assignments, attendance, attendanceStats, studentId } = body;

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Missing required user data" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Build minimal session object for cookie (avoid size limits)
    // Full data is in Supabase, cookie just tracks connection status
    const session = {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
      },
      courseCount: courses?.length || 0,
      assignmentCount: assignments?.length || 0,
      attendanceStats: attendanceStats || { present: 0, absent: 0, total: 0, percentage: 0 },
      savedAt: new Date().toISOString(),
      studentId: studentId,
    };

    // Store minimal session in cookie
    const cookieStore = await cookies();
    
    try {
      cookieStore.set("bb_session", JSON.stringify(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });
    } catch (cookieError) {
      console.error("Failed to set cookie:", cookieError);
      // Continue anyway - data is in Supabase
    }

    console.log(`Blackboard sync: ${courses?.length || 0} courses, ${assignments?.length || 0} assignments, ${attendance?.length || 0} attendance`);

    return NextResponse.json(
      {
        success: true,
        message: "Blackboard session synced successfully",
        courseCount: courses?.length || 0,
        assignmentCount: assignments?.length || 0,
        attendanceCount: attendance?.length || 0,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error syncing Blackboard session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to sync session" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/blackboard/sync
 * 
 * Disconnects from Blackboard by clearing the session
 */
export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  try {
    const cookieStore = await cookies();
    cookieStore.delete("bb_session");

    return NextResponse.json(
      {
        success: true,
        message: "Disconnected from Blackboard",
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error disconnecting from Blackboard:", error);
    return NextResponse.json(
      { success: false, error: "Failed to disconnect" },
      { status: 500, headers: corsHeaders }
    );
  }
}
