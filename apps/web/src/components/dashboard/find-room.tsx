"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Building2,
    Search,
    Loader2,
    AlertCircle,
    CheckCircle2,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Sun,
    Sunset
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RoomData {
    days: string[];
    rooms: string[];
    buildings: string[];
    occupied: string[];
    empty: string[];
    warning: string[];
}

// French day names
const DAYS_ENGLISH: { [key: string]: string } = {
    "Lundi": "Monday",
    "Mardi": "Tuesday",
    "Mercredi": "Wednesday",
    "Jeudi": "Thursday",
    "Vendredi": "Friday",
    "Samedi": "Saturday",
};

function getCurrentFrenchDay(): string {
    const daysOfWeek = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    return daysOfWeek[new Date().getDay()];
}

export function FindRoom() {
    const [roomData, setRoomData] = useState<RoomData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<"morning" | "afternoon">("morning");
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
                    setRoomData(prev => prev || data);
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
                building: selectedBuilding
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
        : (roomData?.empty || []).slice(0, 8);

    const displayedWarnings = expanded
        ? roomData?.warning || []
        : (roomData?.warning || []).slice(0, 4);

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Search className="h-5 w-5 text-primary" />
                    Find Empty Room
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                <form className="space-y-3" onSubmit={handleSearch}>
                    {/* Day Select */}
                    <Select value={selectedDay} onValueChange={setSelectedDay}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(DAYS_ENGLISH).map(([fr, en]) => (
                                <SelectItem key={fr} value={fr}>
                                    {en}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Time Slot Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            type="button"
                            variant={selectedTimeSlot === "morning" ? "default" : "outline"}
                            size="sm"
                            className={cn(
                                "flex items-center gap-1.5",
                                selectedTimeSlot === "morning" && "shadow-sm"
                            )}
                            onClick={() => setSelectedTimeSlot("morning")}
                        >
                            <Sun className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">9-12 AM</span>
                        </Button>
                        <Button
                            type="button"
                            variant={selectedTimeSlot === "afternoon" ? "default" : "outline"}
                            size="sm"
                            className={cn(
                                "flex items-center gap-1.5",
                                selectedTimeSlot === "afternoon" && "shadow-sm"
                            )}
                            onClick={() => setSelectedTimeSlot("afternoon")}
                        >
                            <Sunset className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">1-4 PM</span>
                        </Button>
                    </div>

                    {/* Building Select */}
                    <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
                        <SelectTrigger>
                            <Building2 className="h-4 w-4 text-muted-foreground mr-2" />
                            <SelectValue placeholder="Building" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Buildings</SelectItem>
                            {(roomData?.buildings || []).map(building => (
                                <SelectItem key={building} value={building}>
                                    Building {building}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Search Button */}
                    <Button
                        type="submit"
                        className="w-full font-bold shadow-sm shadow-primary/30"
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
                    <div className="space-y-3 pt-2 border-t border-border">
                        {/* Empty Rooms */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Available
                                </h4>
                                <Badge variant="secondary" className="text-xs">
                                    {roomData.empty.length}
                                </Badge>
                            </div>

                            {roomData.empty.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">
                                    No empty rooms found
                                </p>
                            ) : (
                                <ScrollArea className={cn("w-full", expanded ? "h-[150px]" : "")}>
                                    <div className="flex flex-wrap gap-1.5">
                                        {displayedRooms.map(room => (
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
                                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                    May Have Exam
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {displayedWarnings.map(room => (
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
                        {(roomData.empty.length > 8 || roomData.warning.length > 4) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-muted-foreground text-xs"
                                onClick={() => setExpanded(!expanded)}
                            >
                                {expanded ? (
                                    <>
                                        <ChevronUp className="mr-1 h-3 w-3" />
                                        Less
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="mr-1 h-3 w-3" />
                                        Show All ({roomData.empty.length + roomData.warning.length})
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
