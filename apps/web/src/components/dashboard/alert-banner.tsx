"use client";

import { Clock, Link2 } from "lucide-react";
import Link from "next/link";

interface AlertBannerProps {
  readonly message: string;
  readonly timeLeft?: string;
  readonly variant?: "deadline" | "integration";
}

export function AlertBanner({
  message,
  timeLeft,
  variant = "deadline",
}: AlertBannerProps) {
  if (variant === "integration") {
    return (
      <Link
        href="/dashboard/integration"
        className="bg-muted w-full px-6 py-2 flex items-center justify-center gap-2 border-b hover:bg-muted/80 transition-colors"
      >
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <p className="text-muted-foreground text-sm font-medium">{message}</p>
        <span className="text-xs text-primary underline ml-1">
          Connect now →
        </span>
      </Link>
    );
  }

  return (
    <div className="bg-primary/10 w-full px-6 py-2 flex items-center justify-center gap-2 border-b border-primary/20">
      <Clock className="h-4 w-4 text-primary" />
      <p className="text-primary text-sm font-medium">
        {message}{" "}
        {timeLeft && <span className="font-semibold">{timeLeft}</span>}
      </p>
    </div>
  );
}
