"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, Megaphone } from "lucide-react";

interface Event {
    id: string;
    month: string;
    day: string;
    title: string;
    time: string;
    location: string;
    colorClass: string;
}

const events: Event[] = [
    {
        id: "1",
        month: "Oct",
        day: "25",
        title: "Robotics Club Meetup",
        time: "5:00 PM",
        location: "Tech Lab 3",
        colorClass: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/30",
    },
    {
        id: "2",
        month: "Oct",
        day: "28",
        title: "Career Fair 2023",
        time: "10:00 AM",
        location: "Main Hall",
        colorClass: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800/30",
    },
];

export function UpcomingEvents() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-lg font-bold">Upcoming</CardTitle>
                <a
                    href="#"
                    className="text-xs font-bold text-primary hover:underline"
                >
                    See All
                </a>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Event list */}
                {events.map((event) => (
                    <EventItem key={event.id} event={event} />
                ))}

                {/* Internship Banner */}
                <div className="mt-5 pt-4 border-t border-border">
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg border border-orange-100 dark:border-orange-800/30 cursor-pointer hover:shadow-sm transition-shadow">
                        <div className="bg-card p-1.5 rounded-full shadow-sm">
                            <Megaphone className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground">
                                New Internship Posted
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                                Software Intern @ TechCorp
                            </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function EventItem({ event }: { event: Event }) {
    return (
        <div className="flex gap-3 items-start group cursor-pointer">
            <div
                className={`${event.colorClass} w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 border`}
            >
                <span className="text-[10px] font-bold uppercase">{event.month}</span>
                <span className="text-lg font-bold leading-none">{event.day}</span>
            </div>
            <div>
                <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {event.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {event.time} • {event.location}
                </p>
            </div>
        </div>
    );
}
