import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "chrome-extension://", // Any Chrome extension (validated by externally_connectable)
  "http://localhost:3000",
  "https://localhost:3000",
  "https://esprit-portal-v2.vercel.app",
  "https://portal.espritads.site",
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => 
    origin === allowed || origin.startsWith(allowed)
  );
}

function getCorsHeaders(origin: string | null): Record<string, string> | null {
  if (!isOriginAllowed(origin)) {
    return null; // Will trigger 403 response
  }
  
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (!corsHeaders) {
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403 }
    );
  }
  
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (!corsHeaders) {
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403 }
    );
  }
  
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
