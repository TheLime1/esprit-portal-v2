"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Clock, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeSlot {
    time: string;
    course: string;
    room: string;
}

interface TimetableData {
    classCode: string;
    status: "in_session" | "not_in_session" | "no_schedule";
    room?: {
        roomId: string;
        name: string;
        building: string;
    };
    session?: {
        start: string;
        end: string;
        course: string;
    };
    nextSession?: {
        day: string;
        start: string;
        end: string;
        room: string;
        course: string;
    };
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
    location: string;
    status: "finished" | "now" | "upcoming";
}

// French day names
const DAYS_ORDER = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DAYS_ENGLISH: { [key: string]: string } = {
    "Lundi": "Monday",
    "Mardi": "Tuesday",
    "Mercredi": "Wednesday",
    "Jeudi": "Thursday",
    "Vendredi": "Friday",
    "Samedi": "Saturday",
    "Dimanche": "Sunday"
};

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
    const daysOfWeek = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    return daysOfWeek[new Date().getDay()];
}

function extractCourseName(courseStr: string): string {
    // Course format: "COURSE NAME M. Professor Name |"
    // Extract just the course name before "M."
    const match = courseStr.match(/^(.+?)\s*M\./);
    if (match) {
        return match[1].trim();
    }
    // If no professor info, return as-is (but trim trailing |)
    return courseStr.replace(/\|$/, "").trim();
}

function extractClassName(rawClassName: string): string {
    // Handle formats like "4SAE11 / SAE" -> "4SAE11"
    // Or "4ERP-BI3 / BI" -> "4ERP-BI3"
    const parts = rawClassName.split("/");
    return parts[0].trim();
}

export function Timetable() {
    const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<string>(getCurrentFrenchDay());
    const [viewMode, setViewMode] = useState<"today" | "week">("today");

    useEffect(() => {
        const fetchTimetable = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get user data from localStorage
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

                // Fetch timetable from API
                const response = await fetch(`/api/classes/${encodeURIComponent(cleanClassName)}/location?day=${selectedDay}`);

                if (!response.ok) {
                    throw new Error("Failed to fetch timetable");
                }

                const data = await response.json();
                setTimetableData(data);
            } catch (err) {
                console.error("Error fetching timetable:", err);
                setError(err instanceof Error ? err.message : "Failed to load timetable");
            } finally {
                setLoading(false);
            }
        };

        fetchTimetable();
    }, [selectedDay]);

    // Convert schedule data to timetable items
    const getTimetableItems = (): TimetableItem[] => {
        if (!timetableData?.fullSchedule) return [];

        const daySchedule = timetableData.fullSchedule[selectedDay] || [];
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const isToday = selectedDay === getCurrentFrenchDay();

        return daySchedule
            .filter(slot => {
                // Filter out FREE, FREEWARNING, NOT-FREE
                const courseUpper = slot.course.toUpperCase();
                return courseUpper !== "FREE" && courseUpper !== "FREEWARNING" && courseUpper !== "NOT-FREE";
            })
            .map(slot => {
                const [startTime, endTime] = slot.time.split("-").map(t => t.trim());
                const startMinutes = parseTimeToMinutes(startTime);
                const endMinutes = parseTimeToMinutes(endTime);

                let status: "finished" | "now" | "upcoming" = "upcoming";
                if (isToday) {
                    if (currentMinutes >= endMinutes) {
                        status = "finished";
                    } else if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
                        status = "now";
                    }
                }

                return {
                    time: formatTime(startTime),
                    endTime: formatTime(endTime),
                    title: extractCourseName(slot.course),
                    location: slot.room === "En Ligne" ? "Online" : `Room ${slot.room}`,
                    status
                };
            });
    };

    const timetableItems = getTimetableItems();

    if (loading) {
        return (
            <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Today&apos;s Timetable
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 flex justify-center items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Today&apos;s Timetable
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 flex flex-col items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-8 w-8" />
                    <p>{error}</p>
                </CardContent>
            </Card>
        );
    }

    if (timetableData?.status === "no_schedule") {
        return (
            <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Timetable
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8 flex flex-col items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-8 w-8" />
                    <p>No schedule found for your class</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                <div className="flex flex-col gap-1">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        {viewMode === "today" ? `${DAYS_ENGLISH[selectedDay] || selectedDay}'s Timetable` : "Weekly Timetable"}
                    </CardTitle>
                    {timetableData?.classCode && (
                        <span className="text-xs text-muted-foreground">Class: {timetableData.classCode}</span>
                    )}
                </div>
                <button
                    className="text-primary text-sm font-medium hover:text-primary/80 transition-colors"
                    onClick={() => setViewMode(viewMode === "today" ? "week" : "today")}
                >
                    {viewMode === "today" ? "View Full Week" : "View Today"}
                </button>
            </CardHeader>

            {viewMode === "week" && (
                <div className="flex gap-1 p-3 border-b border-border overflow-x-auto">
                    {DAYS_ORDER.map(day => (
                        <button
                            key={day}
                            onClick={() => setSelectedDay(day)}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                                selectedDay === day
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-muted text-muted-foreground"
                            )}
                        >
                            {DAYS_ENGLISH[day]?.slice(0, 3) || day.slice(0, 3)}
                        </button>
                    ))}
                </div>
            )}

            <CardContent className="p-5">
                {timetableItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Clock className="h-12 w-12 mb-3 opacity-50" />
                        <p className="font-medium">No classes scheduled</p>
                        <p className="text-sm">Enjoy your free day!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-[70px_1fr] gap-x-4">
                        {timetableItems.map((item, index) => (
                            <TimelineItem
                                key={index}
                                item={item}
                                isLast={index === timetableItems.length - 1}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function TimelineItem({
    item,
    isLast,
}: {
    item: TimetableItem;
    isLast: boolean;
}) {
    const isActive = item.status === "now";
    const isFinished = item.status === "finished";

    return (
        <>
            {/* Time column */}
            <div className="flex flex-col items-center">
                <span
                    className={cn(
                        "text-xs font-semibold",
                        isActive ? "text-primary font-bold" : "text-muted-foreground"
                    )}
                >
                    {item.time}
                </span>
                <div
                    className={cn(
                        "w-px h-full my-2 relative",
                        isActive ? "bg-primary/30" : "bg-border"
                    )}
                >
                    <div
                        className={cn(
                            "absolute top-0 left-1/2 -translate-x-1/2 rounded-full",
                            isActive
                                ? "w-3 h-3 bg-primary border-2 border-background shadow-sm"
                                : "w-2 h-2 bg-muted-foreground/40"
                        )}
                    />
                </div>
            </div>

            {/* Content column */}
            <div className={cn(!isLast && "pb-6")}>
                <div
                    className={cn(
                        "p-4 rounded-lg border-l-4 transition-all",
                        isActive
                            ? "bg-primary/5 border-primary shadow-sm"
                            : isFinished
                                ? "bg-muted/50 border-muted-foreground/30"
                                : "bg-card border-border border"
                    )}
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <h4
                                className={cn(
                                    "font-semibold text-sm",
                                    isActive ? "text-primary font-bold" : "text-foreground"
                                )}
                            >
                                {item.title}
                            </h4>
                            <p
                                className={cn(
                                    "text-sm mt-1 flex items-center gap-1",
                                    isActive ? "text-primary/80" : "text-muted-foreground"
                                )}
                            >
                                <MapPin className="h-4 w-4" />
                                {item.location}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {item.time} - {item.endTime}
                            </p>
                        </div>
                        {item.status === "now" && (
                            <Badge className="bg-primary text-primary-foreground animate-pulse-slow">
                                Now
                            </Badge>
                        )}
                        {item.status === "finished" && (
                            <Badge variant="secondary" className="text-muted-foreground">
                                Finished
                            </Badge>
                        )}
                        {item.status === "upcoming" && (
                            <span className="text-muted-foreground text-xs font-medium">
                                Upcoming
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
