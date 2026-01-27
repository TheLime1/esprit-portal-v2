import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const bbSession = cookieStore.get("bb_session");

    if (!bbSession?.value) {
      return NextResponse.json(
        { success: false, error: "Not connected to Blackboard" },
        { status: 401 }
      );
    }

    const session = JSON.parse(bbSession.value);

    if (!session.courses) {
      return NextResponse.json(
        { success: false, error: "No courses found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      courses: session.courses,
      lastSync: session.savedAt,
    });
  } catch (error) {
    console.error("Error fetching Blackboard courses:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}
