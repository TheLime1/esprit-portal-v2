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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return NextResponse.json({}, { headers: getCorsHeaders(origin) });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  try {
    const cookieStore = await cookies();
    const bbSession = cookieStore.get("bb_session");

    if (!bbSession?.value) {
      return NextResponse.json(
        {
          connected: false,
          user: null,
          lastSync: null,
        },
        { headers: corsHeaders }
      );
    }

    const session = JSON.parse(bbSession.value);

    // Cookie now stores minimal data (counts, not full arrays)
    return NextResponse.json(
      {
        connected: true,
        user: session.user,
        lastSync: session.savedAt,
        studentId: session.studentId,
        courseCount: session.courseCount || session.courses?.length || 0,
        assignmentCount: session.assignmentCount || session.assignments?.length || 0,
        attendanceStats: session.attendanceStats || null,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error checking Blackboard status:", error);
    return NextResponse.json(
      {
        connected: false,
        user: null,
        lastSync: null,
      },
      { headers: corsHeaders }
    );
  }
}
