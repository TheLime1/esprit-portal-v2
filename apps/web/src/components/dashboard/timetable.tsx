"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimetableItem {
    time: string;
    title: string;
    location: string;
    status: "finished" | "now" | "upcoming";
}

const timetableData: TimetableItem[] = [
    {
        time: "09:00",
        title: "Intro to Computer Science",
        location: "Room 302 • Lecture Hall A",
        status: "finished",
    },
    {
        time: "11:00",
        title: "Calculus II",
        location: "Room 104 • Main Building",
        status: "now",
    },
    {
        time: "14:00",
        title: "Physics Lab",
        location: "Lab B • Science Wing",
        status: "upcoming",
    },
];

export function Timetable() {
    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                <CardTitle className="text-lg font-bold">Today&apos;s Timetable</CardTitle>
                <button className="text-primary text-sm font-medium hover:text-primary/80 transition-colors">
                    View Full Week
                </button>
            </CardHeader>
            <CardContent className="p-5">
                <div className="grid grid-cols-[60px_1fr] gap-x-4">
                    {timetableData.map((item, index) => (
                        <TimelineItem
                            key={index}
                            item={item}
                            isLast={index === timetableData.length - 1}
                        />
                    ))}
                </div>
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
                                    "font-semibold",
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
