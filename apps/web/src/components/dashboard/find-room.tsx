"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Clock, Building2, Search } from "lucide-react";

export function FindRoom() {
    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Search className="h-5 w-5 text-primary" />
                    Find Empty Room
                </CardTitle>
            </CardHeader>

            <CardContent>
                <form
                    className="space-y-3"
                    onSubmit={(e) => e.preventDefault()}
                >
                    {/* Time Select */}
                    <div className="relative">
                        <Select defaultValue="now">
                            <SelectTrigger className="pl-10">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Select time" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="now">Now (11:30 AM)</SelectItem>
                                <SelectItem value="12">12:00 PM</SelectItem>
                                <SelectItem value="13">01:00 PM</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Building Select */}
                    <div className="relative">
                        <Select defaultValue="science">
                            <SelectTrigger className="pl-10">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Select building" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="science">Science Wing</SelectItem>
                                <SelectItem value="library">Main Library</SelectItem>
                                <SelectItem value="engineering">Engineering Block</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Search Button */}
                    <Button className="w-full font-bold shadow-sm shadow-primary/30">
                        Search Rooms
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
