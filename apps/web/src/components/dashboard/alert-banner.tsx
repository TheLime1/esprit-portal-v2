"use client";

import { Clock } from "lucide-react";

interface AlertBannerProps {
    message: string;
    timeLeft?: string;
}

export function AlertBanner({ message, timeLeft }: AlertBannerProps) {
    return (
        <div className="bg-primary/10 w-full px-6 py-2 flex items-center justify-center gap-2 border-b border-primary/20">
            <Clock className="h-4 w-4 text-primary" />
            <p className="text-primary text-sm font-medium">
                {message} {timeLeft && <span className="font-semibold">{timeLeft}</span>}
            </p>
        </div>
    );
}
