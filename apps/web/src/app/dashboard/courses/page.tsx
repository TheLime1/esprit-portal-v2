"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  User,
  MapPin,
  Loader2,
  AlertCircle,
  Clock,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  }, []);

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
              All courses for {timetableData?.classCode || "your class"}
            </p>
          </div>

          <div className="flex gap-2">
            <Badge variant="secondary" className="w-fit">
              {courses.length} courses
            </Badge>
            {timetableData?.metadata?.period && (
              <Badge variant="outline" className="w-fit">
                {timetableData.metadata.period.split(" - ")[0]}
              </Badge>
            )}
          </div>
        </div>

        {/* Courses Grid */}
        {courses.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No courses found</p>
              <p className="text-sm mt-1">Your schedule appears to be empty</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course, index) => (
              <CourseCard key={index} course={course} />
            ))}
          </div>
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
