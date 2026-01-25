"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar } from "lucide-react";

interface HeaderProps {
    userName: string;
    date: string;
}

export function Header({ userName, date }: HeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h2 className="text-3xl font-bold text-foreground tracking-tight">
                    Welcome back, {userName}
                </h2>
                <p className="text-muted-foreground mt-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {date}
                </p>
            </div>
            <div className="flex gap-3">
                <Button variant="outline" className="gap-2 shadow-sm">
                    <Bell className="h-5 w-5" />
                    Notifications
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 font-bold">
                        3
                    </Badge>
                </Button>
            </div>
        </div>
    );
}
