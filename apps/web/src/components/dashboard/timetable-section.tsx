"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  MapPin,
  Loader2,
  AlertCircle,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
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

interface TimetableItem {
  time: string;
  endTime: string;
  title: string;
  professor: string | null;
  location: string;
  status: "finished" | "now" | "upcoming";
}

// Constants
const DAYS_ORDER = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
const DAYS_ENGLISH: { [key: string]: string } = {
  Lundi: "Monday",
  Mardi: "Tuesday",
  Mercredi: "Wednesday",
  Jeudi: "Thursday",
  Vendredi: "Friday",
  Samedi: "Saturday",
  Dimanche: "Sunday",
};

// Helper functions
function parseTimeToMinutes(timeStr: string): number {
  const normalized = timeStr.replace(/H/g, ":").trim();
  const match = normalized.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function formatTime(timeStr: string): string {
  const normalized = timeStr.replace(/H/g, ":").trim();
  const match = normalized.match(/(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  const hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes} ${period}`;
}

function getCurrentFrenchDay(): string {
  const daysOfWeek = [
    "Dimanche",
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
  ];
  return daysOfWeek[new Date().getDay()];
}

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

export function TimetableSection() {
  const [timetableData, setTimetableData] = useState<TimetableData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(getCurrentFrenchDay());

  useEffect(() => {
    const fetchTimetable = async () => {
      try {
        setLoading(true);
        setError(null);

        const storedUser = localStorage.getItem("esprit_user");
        if (!storedUser) {
          setError("Please log in to view your timetable");
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
          throw new Error("Failed to fetch timetable");
        }

        const data = await response.json();
        setTimetableData(data);
      } catch (err) {
        console.error("Error fetching timetable:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load timetable",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTimetable();
  }, []);

  const getTimetableItems = (): TimetableItem[] => {
    if (!timetableData?.fullSchedule) return [];

    const daySchedule = timetableData.fullSchedule[selectedDay] || [];
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isToday = selectedDay === getCurrentFrenchDay();

    return daySchedule
      .filter((slot) => {
        const courseUpper = slot.course.toUpperCase();
        return (
          courseUpper !== "FREE" &&
          courseUpper !== "FREEWARNING" &&
          courseUpper !== "NOT-FREE"
        );
      })
      .map((slot) => {
        const [startTime, endTime] = slot.time.split("-").map((t) => t.trim());
        const startMinutes = parseTimeToMinutes(startTime);
        const endMinutes = parseTimeToMinutes(endTime);

        let status: "finished" | "now" | "upcoming" = "upcoming";
        if (isToday) {
          if (currentMinutes >= endMinutes) {
            status = "finished";
          } else if (
            currentMinutes >= startMinutes &&
            currentMinutes < endMinutes
          ) {
            status = "now";
          }
        }

        return {
          time: formatTime(startTime),
          endTime: formatTime(endTime),
          title: extractCourseName(slot.course),
          professor: extractProfessorName(slot.course),
          location: slot.room === "En Ligne" ? "Online" : `Room ${slot.room}`,
          status,
        };
      });
  };

  const timetableItems = getTimetableItems();

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Your Timetable
          </CardTitle>
        </CardHeader>
        <CardContent className="p-12 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Your Timetable
          </CardTitle>
        </CardHeader>
        <CardContent className="p-12 flex flex-col items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-8 w-8" />
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (timetableData?.status === "no_schedule") {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Your Timetable
          </CardTitle>
        </CardHeader>
        <CardContent className="p-12 flex flex-col items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-8 w-8" />
          <p>No schedule found for your class</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Your Timetable
            </CardTitle>
            {timetableData?.classCode && (
              <Badge variant="secondary" className="text-xs">
                {timetableData.classCode}
              </Badge>
            )}
          </div>
          {timetableData?.metadata?.period && (
            <p className="text-xs text-muted-foreground">
              Period: {timetableData.metadata.period}
            </p>
          )}
        </div>
      </CardHeader>

      {/* Day Selector */}
      <div className="flex gap-1 p-3 border-b border-border overflow-x-auto bg-muted/30">
        {DAYS_ORDER.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              selectedDay === day
                ? "bg-primary text-primary-foreground shadow-sm"
                : "hover:bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {DAYS_ENGLISH[day] || day}
          </button>
        ))}
      </div>

      <CardContent className="p-6">
        {timetableItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mb-3 opacity-50" />
            <p className="font-medium">No classes scheduled</p>
            <p className="text-sm">Enjoy your free day!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {timetableItems.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "p-4 rounded-xl border-l-4 transition-all",
                  item.status === "now"
                    ? "bg-primary/5 border-primary shadow-sm"
                    : item.status === "finished"
                      ? "bg-muted/50 border-muted-foreground/30"
                      : "bg-card border-border border",
                )}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h4
                      className={cn(
                        "font-semibold",
                        item.status === "now"
                          ? "text-primary"
                          : "text-foreground",
                      )}
                    >
                      {item.title}
                    </h4>
                    {item.professor && (
                      <p
                        className={cn(
                          "text-sm flex items-center gap-1",
                          item.status === "now"
                            ? "text-primary/80"
                            : "text-muted-foreground",
                        )}
                      >
                        <User className="h-4 w-4" />
                        {item.professor}
                      </p>
                    )}
                    <p
                      className={cn(
                        "text-sm flex items-center gap-1",
                        item.status === "now"
                          ? "text-primary/80"
                          : "text-muted-foreground",
                      )}
                    >
                      <MapPin className="h-4 w-4" />
                      {item.location}
                    </p>
                    <p
                      className={cn(
                        "text-sm flex items-center gap-1",
                        item.status === "now"
                          ? "text-primary/70"
                          : "text-muted-foreground",
                      )}
                    >
                      <Clock className="h-4 w-4" />
                      {item.time} - {item.endTime}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {item.status === "now" && (
                      <Badge className="bg-primary text-primary-foreground animate-pulse">
                        Now
                      </Badge>
                    )}
                    {item.status === "finished" && (
                      <Badge
                        variant="secondary"
                        className="text-muted-foreground"
                      >
                        Done
                      </Badge>
                    )}
                    {item.status === "upcoming" && (
                      <Badge variant="outline">Upcoming</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
