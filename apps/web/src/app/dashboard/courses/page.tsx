"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  User,
  MapPin,
  Loader2,
  AlertCircle,
  Clock,
  GraduationCap,
  Link2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TimeSlot {
  time: string;
  course: string;
  room: string;
}

interface TimetableData {
  classCode: string;
  status: "in_session" | "not_in_session" | "no_schedule";
  fullSchedule?: {
    [day: string]: TimeSlot[];
  };
  metadata?: {
    year: string;
    period: string;
    primary_room: string;
  };
}

interface CourseInfo {
  name: string;
  professor: string | null;
  rooms: string[];
  days: string[];
  times: string[];
}

interface BBCourse {
  id: string;
  courseId: string;
  name: string;
  url?: string;
}

interface BBCoursesResponse {
  success: boolean;
  courses: BBCourse[];
  lastSync?: string;
}

// French day names
const DAYS_ENGLISH: { [key: string]: string } = {
  Lundi: "Monday",
  Mardi: "Tuesday",
  Mercredi: "Wednesday",
  Jeudi: "Thursday",
  Vendredi: "Friday",
  Samedi: "Saturday",
};

function extractCourseName(courseStr: string): string {
  const match = courseStr.match(/^(.+?)\s*M\./);
  if (match) {
    return match[1].trim();
  }
  return courseStr.replace(/\|$/, "").trim();
}

function extractProfessorName(courseStr: string): string | null {
  const match = courseStr.match(/M\.\s*([^|]+?)\s*\|?$/);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function extractClassName(rawClassName: string): string {
  const parts = rawClassName.split("/");
  return parts[0].trim();
}

// Generate a consistent color based on course name
function getCourseColor(courseName: string): string {
  const colors = [
    "from-blue-500/10 to-blue-600/5 border-blue-500/30",
    "from-purple-500/10 to-purple-600/5 border-purple-500/30",
    "from-green-500/10 to-green-600/5 border-green-500/30",
    "from-orange-500/10 to-orange-600/5 border-orange-500/30",
    "from-pink-500/10 to-pink-600/5 border-pink-500/30",
    "from-cyan-500/10 to-cyan-600/5 border-cyan-500/30",
    "from-yellow-500/10 to-yellow-600/5 border-yellow-500/30",
    "from-indigo-500/10 to-indigo-600/5 border-indigo-500/30",
  ];

  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function CoursesPage() {
  const [timetableData, setTimetableData] = useState<TimetableData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"schedule" | "blackboard">(
    "schedule",
  );
  const [bbCourses, setBbCourses] = useState<BBCourse[]>([]);
  const [bbLoading, setBbLoading] = useState(false);
  const [bbConnected, setBbConnected] = useState(false);

  // Check localStorage for cached Blackboard courses first (instant)
  const checkLocalStorage = useCallback(() => {
    try {
      console.log("🔍 Checking localStorage for BB courses...");
      const cachedBBData = localStorage.getItem("esprit_bb_session");
      if (cachedBBData) {
        const parsed = JSON.parse(cachedBBData);
        if (
          parsed.courses &&
          Array.isArray(parsed.courses) &&
          parsed.courses.length > 0
        ) {
          console.log(
            "✅ Found courses in esprit_bb_session:",
            parsed.courses.length,
          );
          return parsed.courses as BBCourse[];
        }
      }
      console.log("❌ No courses found in localStorage");
    } catch {
      // No cached data available, continue with normal flow
    }
    return null;
  }, []);

  // Try to fetch and cache full BB data from extension
  const fetchAndCacheFullBBData = useCallback(
    (extensionId: string): Promise<BBCourse[]> => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          extensionId,
          { action: "GET_BB_STATUS" },
          (response: {
            connected: boolean;
            user?: { id: string; name: string; username: string };
            courses?: BBCourse[];
            assignments?: unknown[];
            attendance?: unknown[];
            attendanceStats?: unknown;
            lastSync?: string;
          }) => {
            if (chrome.runtime.lastError || !response?.connected) {
              console.log("❌ Extension not connected or error");
              resolve([]);
              return;
            }

            // Cache full BB data to localStorage
            if (response.user) {
              const sessionData = {
                user: response.user,
                courses: response.courses || [],
                assignments: response.assignments || [],
                attendance: response.attendance || [],
                attendanceStats: response.attendanceStats,
                savedAt: response.lastSync || new Date().toISOString(),
              };
              localStorage.setItem(
                "esprit_bb_session",
                JSON.stringify(sessionData),
              );
              console.log("✅ Cached full BB data to esprit_bb_session");

              // Also cache assignments separately for homework page
              if (response.assignments && response.assignments.length > 0) {
                const assignmentsData = {
                  success: true,
                  assignments: response.assignments,
                  deadlineAlert: null,
                  total: response.assignments.length,
                  pending: response.assignments.filter(
                    (a: { status: string }) => a.status !== "Graded",
                  ).length,
                };
                localStorage.setItem(
                  "esprit_bb_assignments",
                  JSON.stringify(assignmentsData),
                );
                console.log("✅ Cached assignments to esprit_bb_assignments");
              }

              resolve(response.courses || []);
              return;
            }
            resolve([]);
          },
        );
      });
    },
    [],
  );

  const fetchBlackboardCourses = useCallback(async () => {
    // First, show cached data instantly
    let cachedCourses = checkLocalStorage();
    if (cachedCourses && cachedCourses.length > 0) {
      setBbCourses(cachedCourses);
      setBbConnected(true);
      setBbLoading(false);
    } else {
      setBbLoading(true);
    }

    try {
      // Get extension ID from localStorage
      const extensionId = localStorage.getItem("extensionId");

      if (!extensionId || typeof chrome === "undefined" || !chrome.runtime) {
        console.log("❌ No extensionId or chrome API not available");
        setBbLoading(false);
        return;
      }

      // If no cached data, try to fetch and cache full BB data first
      if (!cachedCourses || cachedCourses.length === 0) {
        console.log("📥 Fetching full BB data from extension...");
        const courses = await fetchAndCacheFullBBData(extensionId);
        if (courses.length > 0) {
          setBbCourses(courses);
          setBbConnected(true);
          setBbLoading(false);
          return;
        }
      }

      // Ask extension for courses from local storage (may have fresher data)
      chrome.runtime.sendMessage(
        extensionId,
        { action: "GET_BB_COURSES" },
        (response: {
          success: boolean;
          courses?: BBCourse[];
          lastSync?: string;
        }) => {
          if (chrome.runtime.lastError || !response?.success) {
            console.log("Blackboard not connected");
            setBbLoading(false);
            return;
          }

          const courses = response.courses || [];
          setBbCourses(courses);
          setBbConnected(courses.length > 0);
          setBbLoading(false);

          // Cache courses in esprit_bb_session for instant display next time
          if (courses.length > 0) {
            try {
              const existingData = localStorage.getItem("esprit_bb_session");
              const parsed = existingData ? JSON.parse(existingData) : {};
              parsed.courses = courses;
              parsed.savedAt = response.lastSync || new Date().toISOString();
              localStorage.setItem("esprit_bb_session", JSON.stringify(parsed));
            } catch {
              // Ignore localStorage errors
            }
          }
        },
      );
    } catch (err) {
      console.log("Blackboard not connected:", err);
      setBbLoading(false);
    }
  }, [checkLocalStorage, fetchAndCacheFullBBData]);

  useEffect(() => {
    const fetchTimetable = async () => {
      try {
        setLoading(true);
        setError(null);

        const storedUser = localStorage.getItem("esprit_user");
        if (!storedUser) {
          setError("Please log in to view your courses");
          setLoading(false);
          return;
        }

        const userData = JSON.parse(storedUser);
        if (!userData.className) {
          setError("Class information not available");
          setLoading(false);
          return;
        }

        const cleanClassName = extractClassName(userData.className);
        const response = await fetch(
          `/api/classes/${encodeURIComponent(cleanClassName)}/location`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch courses");
        }

        const data = await response.json();
        setTimetableData(data);
      } catch (err) {
        console.error("Error fetching courses:", err);
        setError(err instanceof Error ? err.message : "Failed to load courses");
      } finally {
        setLoading(false);
      }
    };

    fetchTimetable();
    fetchBlackboardCourses();
  }, [fetchBlackboardCourses]);

  // Extract unique courses from the schedule
  const getCourses = (): CourseInfo[] => {
    if (!timetableData?.fullSchedule) return [];

    const coursesMap = new Map<string, CourseInfo>();

    Object.entries(timetableData.fullSchedule).forEach(([day, slots]) => {
      slots.forEach((slot) => {
        const courseUpper = slot.course.toUpperCase();
        if (
          courseUpper === "FREE" ||
          courseUpper === "FREEWARNING" ||
          courseUpper === "NOT-FREE"
        ) {
          return;
        }

        const courseName = extractCourseName(slot.course);
        const professor = extractProfessorName(slot.course);
        const key = courseName.toLowerCase();

        if (coursesMap.has(key)) {
          const existing = coursesMap.get(key)!;
          if (!existing.rooms.includes(slot.room)) {
            existing.rooms.push(slot.room);
          }
          if (!existing.days.includes(day)) {
            existing.days.push(day);
          }
          if (!existing.times.includes(slot.time)) {
            existing.times.push(slot.time);
          }
        } else {
          coursesMap.set(key, {
            name: courseName,
            professor,
            rooms: [slot.room],
            days: [day],
            times: [slot.time],
          });
        }
      });
    });

    return Array.from(coursesMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  };

  const courses = getCourses();

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border-destructive/50">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">
                  Failed to load courses
                </p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" />
              My Courses
            </h1>
            <p className="text-muted-foreground mt-1">
              {viewMode === "schedule"
                ? `All courses for ${timetableData?.classCode || "your class"}`
                : "Courses from Blackboard"}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <Button
                size="sm"
                variant={viewMode === "schedule" ? "default" : "ghost"}
                onClick={() => setViewMode("schedule")}
              >
                Schedule
              </Button>
              <Button
                size="sm"
                variant={viewMode === "blackboard" ? "default" : "ghost"}
                onClick={() => setViewMode("blackboard")}
                disabled={!bbConnected}
                className="gap-1"
              >
                <Link2 className="h-3.5 w-3.5" />
                Blackboard
                {!bbConnected && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    Not connected
                  </Badge>
                )}
              </Button>
            </div>

            <Badge variant="secondary" className="w-fit">
              {viewMode === "schedule" ? courses.length : bbCourses.length}{" "}
              courses
            </Badge>
            {viewMode === "schedule" && timetableData?.metadata?.period && (
              <Badge variant="outline" className="w-fit">
                {timetableData.metadata.period.split(" - ")[0]}
              </Badge>
            )}
          </div>
        </div>

        {/* Blackboard Connection Prompt */}
        {viewMode === "blackboard" && !bbConnected && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Link2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Connect Blackboard</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Connect your Blackboard account to see your courses here
              </p>
              <Button asChild>
                <Link href="/dashboard/integration">Go to Integrations</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Blackboard Courses View */}
        {viewMode === "blackboard" && bbConnected && (
          <>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchBlackboardCourses}
                disabled={bbLoading}
              >
                {bbLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
            {bbCourses.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No Blackboard courses found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bbCourses.map((course) => (
                  <BlackboardCourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Schedule-based Courses Grid */}
        {viewMode === "schedule" && (
          <>
            {courses.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No courses found</p>
                  <p className="text-sm mt-1">
                    Your schedule appears to be empty
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map((course, index) => (
                  <CourseCard key={index} course={course} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: CourseInfo }) {
  const colorClass = getCourseColor(course.name);

  return (
    <Card
      className={cn(
        "group hover:shadow-lg transition-all duration-300 overflow-hidden border-l-4",
        colorClass,
      )}
    >
      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Course Name */}
          <div>
            <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {course.name}
            </h3>
          </div>

          {/* Professor */}
          {course.professor && (
            <div className="flex items-center gap-2 text-sm">
              <div className="p-1.5 rounded-full bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="text-foreground font-medium">
                {course.professor}
              </span>
            </div>
          )}

          {/* Schedule Info */}
          <div className="space-y-2 text-sm text-muted-foreground">
            {/* Days */}
            <div className="flex items-start gap-2">
              <GraduationCap className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {course.days.map((day) => (
                  <Badge key={day} variant="outline" className="text-xs">
                    {DAYS_ENGLISH[day] || day}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Times */}
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {course.times.slice(0, 2).map((time, idx) => (
                  <span key={idx} className="text-xs">
                    {time.replace(/H/g, ":")}
                    {idx < Math.min(course.times.length, 2) - 1 && ", "}
                  </span>
                ))}
                {course.times.length > 2 && (
                  <span className="text-xs text-muted-foreground">
                    +{course.times.length - 2} more
                  </span>
                )}
              </div>
            </div>

            {/* Rooms */}
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {course.rooms.map((room, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {room === "En Ligne" ? "Online" : room}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BlackboardCourseCard({ course }: { course: BBCourse }) {
  const colorClass = getCourseColor(course.name);

  return (
    <Card
      className={cn(
        "group hover:shadow-lg transition-all duration-300 overflow-hidden border-l-4",
        colorClass,
      )}
    >
      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Course Name */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
              {course.name}
            </h3>
            {course.url && (
              <a
                href={course.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            )}
          </div>

          {/* Course ID */}
          <div className="flex items-center gap-2 text-sm">
            <div className="p-1.5 rounded-full bg-primary/10">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <span className="text-muted-foreground font-mono text-xs">
              {course.courseId}
            </span>
          </div>

          {/* Blackboard Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1">
              <Link2 className="h-3 w-3" />
              Blackboard
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
