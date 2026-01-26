"use client";

import { Calendar } from "lucide-react";

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
    </div>
  );
}
