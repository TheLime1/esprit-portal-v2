import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAllAssignments,
  getNearestDeadline,
  formatTimeUntil,
  type BBCookie,
  type BBCourse,
} from "@/lib/blackboard-client";

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
    const bbCookies: BBCookie[] = session.cookies || [];
    const courses: BBCourse[] = session.courses || [];
    const userId = session.user?.id;

    if (!userId || bbCookies.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid session data" },
        { status: 400 }
      );
    }

    // Fetch all assignments from Blackboard
    const assignments = await getAllAssignments(bbCookies, userId, courses);

    // Get nearest deadline for alert
    const nearestDeadline = getNearestDeadline(assignments);
    let deadlineAlert = null;

    if (nearestDeadline && nearestDeadline.due) {
      deadlineAlert = {
        assignment: nearestDeadline.name,
        course: nearestDeadline.courseName,
        timeLeft: formatTimeUntil(nearestDeadline.due),
        dueDate: nearestDeadline.due,
      };
    }

    return NextResponse.json({
      success: true,
      assignments,
      deadlineAlert,
      total: assignments.length,
      pending: assignments.filter((a) => a.status !== "Graded").length,
    });
  } catch (error) {
    console.error("Error fetching Blackboard assignments:", error);

    // Check if it's an auth error
    if (error instanceof Error && error.message === "AUTH_EXPIRED") {
      return NextResponse.json(
        { success: false, error: "Blackboard session expired. Please reconnect." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}
