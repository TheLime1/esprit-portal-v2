"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  Clock,
  MapPin,
  Loader2,
  AlertCircle,
  Search,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sun,
  Sunset,
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

interface RoomData {
  days: string[];
  buildings: string[];
  empty: string[];
  warning: string[];
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
  // Course format: "COURSE NAME M. FirstName LastName |"
  const match = courseStr.match(/M\.\s*([^|]+?)\s*\|?$/);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function extractClassName(rawClassName: string): string {
  // Handle formats like "4SAE11 / SAE" -> "4SAE11"
  // Or "4ERP-BI3 / BI" -> "4ERP-BI3"
  const parts = rawClassName.split("/");
  return parts[0].trim();
}

export default function SchedulePage() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Schedule</h1>
          <p className="text-muted-foreground mt-1">
            View your timetable and find empty classrooms
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Timetable (2/3 width) */}
          <div className="lg:col-span-2">
            <TimetableSection />
          </div>

          {/* Right Column - Find Empty Room (1/3 width) */}
          <div>
            <FindEmptyRoomSection />
          </div>
        </div>
      </div>
    </div>
  );
}

// Timetable Section Component
function TimetableSection() {
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

        // Extract clean class name (e.g., "4SAE11 / SAE" -> "4SAE11")
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

// Find Empty Room Section Component
function FindEmptyRoomSection() {
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<
    "morning" | "afternoon"
  >("morning");
  const [selectedDay, setSelectedDay] = useState<string>(getCurrentFrenchDay());
  const [selectedBuilding, setSelectedBuilding] = useState<string>("all");
  const [showResults, setShowResults] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Fetch initial data for building list
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await fetch("/api/rooms/free?day=Lundi&time=09:00");
        if (response.ok) {
          const data = await response.json();
          setRoomData((prev) => prev || data);
        }
      } catch {
        // Fail silently for initial fetch
      }
    };
    fetchInitialData();
  }, []);

  const searchRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Morning: 09:00, Afternoon: 14:00
      const time = selectedTimeSlot === "morning" ? "09:00" : "14:00";

      const params = new URLSearchParams({
        day: selectedDay,
        time: time,
        building: selectedBuilding,
      });

      const response = await fetch(`/api/rooms/free?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch rooms");
      }

      const data = await response.json();
      setRoomData(data);
      setShowResults(true);
    } catch (err) {
      console.error("Error fetching rooms:", err);
      setError(err instanceof Error ? err.message : "Failed to find rooms");
    } finally {
      setLoading(false);
    }
  }, [selectedDay, selectedTimeSlot, selectedBuilding]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchRooms();
  };

  const displayedRooms = expanded
    ? roomData?.empty || []
    : (roomData?.empty || []).slice(0, 12);

  const displayedWarnings = expanded
    ? roomData?.warning || []
    : (roomData?.warning || []).slice(0, 6);

  return (
    <Card className="overflow-hidden sticky top-4">
      <CardHeader className="pb-4 border-b border-border">
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <Search className="h-5 w-5 text-primary" />
          Find Empty Room
        </CardTitle>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        <form className="space-y-4" onSubmit={handleSearch}>
          {/* Day Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Day
            </label>
            <Select value={selectedDay} onValueChange={setSelectedDay}>
              <SelectTrigger>
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DAYS_ENGLISH)
                  .slice(0, 6)
                  .map(([fr, en]) => (
                    <SelectItem key={fr} value={fr}>
                      {en}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Slot Buttons */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Time Slot
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={selectedTimeSlot === "morning" ? "default" : "outline"}
                className={cn(
                  "flex items-center gap-2 h-12",
                  selectedTimeSlot === "morning" && "shadow-sm",
                )}
                onClick={() => setSelectedTimeSlot("morning")}
              >
                <Sun className="h-4 w-4" />
                <span className="font-medium">9AM - 12PM</span>
              </Button>
              <Button
                type="button"
                variant={
                  selectedTimeSlot === "afternoon" ? "default" : "outline"
                }
                className={cn(
                  "flex items-center gap-2 h-12",
                  selectedTimeSlot === "afternoon" && "shadow-sm",
                )}
                onClick={() => setSelectedTimeSlot("afternoon")}
              >
                <Sunset className="h-4 w-4" />
                <span className="font-medium">1PM - 4PM</span>
              </Button>
            </div>
          </div>

          {/* Building Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Building
            </label>
            <Select
              value={selectedBuilding}
              onValueChange={setSelectedBuilding}
            >
              <SelectTrigger>
                <Building2 className="h-4 w-4 text-muted-foreground mr-2" />
                <SelectValue placeholder="Select building" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buildings</SelectItem>
                {(roomData?.buildings || []).map((building) => (
                  <SelectItem key={building} value={building}>
                    Building {building}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Button */}
          <Button
            type="submit"
            className="w-full font-bold shadow-sm"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search Rooms
              </>
            )}
          </Button>
        </form>

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {showResults && roomData && !loading && (
          <div className="space-y-4 pt-4 border-t border-border">
            {/* Empty Rooms */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Available
                </h4>
                <Badge variant="secondary" className="text-xs">
                  {roomData.empty.length} rooms
                </Badge>
              </div>

              {roomData.empty.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No empty rooms found
                </p>
              ) : (
                <ScrollArea
                  className={cn("w-full", expanded ? "max-h-[250px]" : "")}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {displayedRooms.map((room) => (
                      <Badge
                        key={room}
                        variant="outline"
                        className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 text-xs"
                      >
                        {room}
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Warning Rooms */}
            {roomData.warning.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  May Have Exam/Soutenance
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {displayedWarnings.map((room) => (
                    <Badge
                      key={room}
                      variant="outline"
                      className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 text-xs"
                    >
                      {room}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Expand/Collapse Button */}
            {(roomData.empty.length > 12 || roomData.warning.length > 6) && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="mr-1 h-4 w-4" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-4 w-4" />
                    Show All ({roomData.empty.length +
                      roomData.warning.length}{" "}
                    rooms)
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
