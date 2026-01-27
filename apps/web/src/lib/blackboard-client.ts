/**
 * Blackboard API Client for Next.js
 * 
 * This client proxies requests to Blackboard's REST API.
 * Since the web app can't directly access Blackboard cookies,
 * we rely on the extension to capture and sync cookies to Supabase.
 */

const BB_DOMAIN = "https://esprit.blackboard.com";
const API_V1 = `${BB_DOMAIN}/learn/api/public/v1`;
const API_V2 = `${BB_DOMAIN}/learn/api/public/v2`;

export interface BBCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
}

export interface BBUser {
  id: string;
  userName: string;
  name?: {
    given: string;
    family: string;
  };
  contact?: {
    email: string;
  };
}

export interface BBCourse {
  id: string;
  courseId: string;
  name: string;
  description?: string;
  externalAccessUrl?: string;
  instructors?: BBInstructor[];
}

export interface BBInstructor {
  userId: string;
  role: string;
  name?: string;
}

export interface BBAssignment {
  id: string;
  name: string;
  courseId: string;
  courseName?: string;
  due?: string;
  scorePossible?: number;
  score?: number | null;
  status: "NotSubmitted" | "NeedsGrading" | "Graded" | "InProgress";
  isPastDue: boolean;
  daysUntilDue?: number;
}

export interface BBSession {
  user: {
    id: string;
    name: string;
    username: string;
    email?: string;
  };
  courses: BBCourse[];
  cookies: BBCookie[];
  savedAt: string;
}

/**
 * Build cookie header string from cookie array
 */
function buildCookieHeader(cookies: BBCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * Make authenticated request to Blackboard API
 */
async function bbFetch(
  endpoint: string,
  cookies: BBCookie[],
  version: "v1" | "v2" = "v1"
): Promise<Response> {
  const baseUrl = version === "v2" ? API_V2 : API_V1;
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Cookie: buildCookieHeader(cookies),
    },
  });

  return response;
}

/**
 * Get paginated results from Blackboard API
 */
async function getPaginated<T>(
  endpoint: string,
  cookies: BBCookie[],
  version: "v1" | "v2" = "v1"
): Promise<T[]> {
  const allResults: T[] = [];
  let currentOffset = 0;
  const limit = 100;

  while (true) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const paginatedEndpoint = `${endpoint}${separator}offset=${currentOffset}&limit=${limit}`;

    const response = await bbFetch(paginatedEndpoint, cookies, version);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("AUTH_EXPIRED");
      }
      throw new Error(`API_ERROR_${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];
    allResults.push(...results);

    // Check for next page
    if (!data.paging?.nextPage || results.length < limit) {
      break;
    }

    currentOffset += limit;
  }

  return allResults;
}

/**
 * Validate session and get current user
 */
export async function validateSession(
  cookies: BBCookie[]
): Promise<BBUser | null> {
  try {
    const response = await bbFetch("/users/me", cookies);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Get user's enrolled courses
 */
export async function getEnrolledCourses(
  cookies: BBCookie[],
  userId: string
): Promise<BBCourse[]> {
  // Get course memberships
  const memberships = await getPaginated<{ courseId: string }>(
    `/users/${userId}/courses`,
    cookies
  );

  const courses: BBCourse[] = [];

  for (const membership of memberships) {
    const courseId = membership.courseId;
    if (!courseId) continue;

    try {
      const response = await bbFetch(`/courses/${courseId}`, cookies);
      if (response.ok) {
        const course = await response.json();
        if (course.externalAccessUrl) {
          courses.push(course);
        }
      }
    } catch (e) {
      console.warn(`Could not fetch course ${courseId}:`, e);
    }
  }

  return courses;
}

/**
 * Get course instructors
 */
export async function getCourseInstructors(
  cookies: BBCookie[],
  courseId: string
): Promise<BBInstructor[]> {
  const members = await getPaginated<{
    userId: string;
    courseRoleId: string;
    name?: string;
  }>(`/courses/${courseId}/users`, cookies);

  const instructorRoles = [
    "Instructor",
    "TeachingAssistant",
    "Grader",
    "CourseBuilder",
  ];

  return members
    .filter((m) => instructorRoles.includes(m.courseRoleId))
    .map((m) => ({
      userId: m.userId,
      role: m.courseRoleId,
      name: m.name,
    }));
}

/**
 * Get assignments for a course with due dates
 */
export async function getCourseAssignments(
  cookies: BBCookie[],
  courseId: string,
  userId: string
): Promise<BBAssignment[]> {
  interface GradebookColumn {
    id: string;
    name: string;
    grading?: {
      type?: string;
      due?: string;
    };
    score?: {
      possible?: number;
    };
  }

  const columns = await getPaginated<GradebookColumn>(
    `/courses/${courseId}/gradebook/columns`,
    cookies,
    "v2"
  );

  const assignments: BBAssignment[] = [];

  for (const column of columns) {
    const grading = column.grading || {};

    // Skip calculated columns (like total score)
    if (grading.type === "Calculated") continue;

    let score: number | null = null;
    let status: BBAssignment["status"] = "NotSubmitted";

    // Try to get user's grade for this assignment
    try {
      const gradeResponse = await bbFetch(
        `/courses/${courseId}/gradebook/columns/${column.id}/users/${userId}`,
        cookies
      );

      if (gradeResponse.ok) {
        const grade = await gradeResponse.json();
        score = grade.score ?? null;
        status =
          grade.status || (score !== null ? "Graded" : "NotSubmitted");
      }
    } catch {
      // No grade record
    }

    const dueDate = grading.due ? new Date(grading.due) : null;
    const now = new Date();
    const isPastDue = dueDate ? now > dueDate : false;

    let daysUntilDue: number | undefined;
    if (dueDate && !isPastDue) {
      daysUntilDue = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    assignments.push({
      id: column.id,
      name: column.name,
      courseId: courseId,
      due: grading.due,
      scorePossible: column.score?.possible,
      score: score,
      status: status,
      isPastDue: isPastDue,
      daysUntilDue: daysUntilDue,
    });
  }

  return assignments;
}

/**
 * Get all assignments across all courses
 */
export async function getAllAssignments(
  cookies: BBCookie[],
  userId: string,
  courses: BBCourse[]
): Promise<BBAssignment[]> {
  const allAssignments: BBAssignment[] = [];

  for (const course of courses) {
    try {
      const assignments = await getCourseAssignments(
        cookies,
        course.id,
        userId
      );

      // Add course name to each assignment
      assignments.forEach((a) => {
        a.courseName = course.name;
      });

      allAssignments.push(...assignments);
    } catch (e) {
      console.warn(`Could not fetch assignments for ${course.name}:`, e);
    }
  }

  // Sort by due date (nearest first, null dates at end)
  allAssignments.sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return new Date(a.due).getTime() - new Date(b.due).getTime();
  });

  return allAssignments;
}

/**
 * Get the nearest upcoming deadline
 */
export function getNearestDeadline(assignments: BBAssignment[]): BBAssignment | null {
  const now = new Date();
  
  const upcoming = assignments.filter(
    (a) => a.due && new Date(a.due) > now && a.status !== "Graded"
  );

  if (upcoming.length === 0) return null;

  // Already sorted by due date
  return upcoming[0];
}

/**
 * Format time until deadline
 */
export function formatTimeUntil(dueDate: string): string {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();

  if (diffMs < 0) return "Overdue";

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""}`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""}`;
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
  }
}
