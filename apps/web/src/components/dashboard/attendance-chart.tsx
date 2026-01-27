"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Loader2, UserCheck, Link2 } from "lucide-react";
import Link from "next/link";

// Chrome extension types
declare const chrome: {
  runtime: {
    sendMessage: (
      extensionId: string,
      message: { action: string },
      callback: (response: AttendanceResponse | null) => void,
    ) => void;
    lastError?: { message: string };
  };
};

interface AttendanceStats {
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

interface AttendanceResponse {
  connected: boolean;
  attendanceStats?: AttendanceStats | null;
}

const chartConfig = {
  present: {
    label: "Present",
    color: "hsl(142, 76%, 36%)", // Green
  },
  absent: {
    label: "Absent",
    color: "hsl(0, 72%, 51%)", // Red
  },
};

export function AttendanceChart() {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check localStorage for cached attendance data
  const checkLocalStorage = useCallback((): AttendanceStats | null => {
    try {
      const cachedSession = localStorage.getItem("esprit_bb_session");
      if (cachedSession) {
        const parsed = JSON.parse(cachedSession);
        if (parsed.attendanceStats) {
          return parsed.attendanceStats;
        }
        // Calculate from attendance array if stats not available
        if (parsed.attendance && Array.isArray(parsed.attendance)) {
          const present = parsed.attendance.filter(
            (a: { status: string }) => a.status === "Present",
          ).length;
          const absent = parsed.attendance.filter(
            (a: { status: string }) => a.status === "Absent",
          ).length;
          const total = parsed.attendance.length;
          return {
            present,
            absent,
            total,
            percentage: total > 0 ? Math.round((present / total) * 100) : 0,
          };
        }
      }
    } catch {
      // No cached data
    }
    return null;
  }, []);

  const fetchAttendance = useCallback(async () => {
    // First check localStorage for cached data
    const cachedStats = checkLocalStorage();
    if (cachedStats) {
      setStats(cachedStats);
      setLoading(false);
    }

    // Try to get fresh data from extension
    const extensionId = localStorage.getItem("extensionId");
    if (!extensionId || typeof chrome === "undefined" || !chrome.runtime) {
      if (!cachedStats) {
        setError("Connect Blackboard to see attendance");
      }
      setLoading(false);
      return;
    }

    chrome.runtime.sendMessage(
      extensionId,
      { action: "GET_BB_STATUS" },
      (response: AttendanceResponse | null) => {
        if (chrome.runtime.lastError || !response?.connected) {
          if (!cachedStats) {
            setError("Connect Blackboard to see attendance");
          }
          setLoading(false);
          return;
        }

        if (response.attendanceStats) {
          setStats(response.attendanceStats);
          setError(null);
        }
        setLoading(false);
      },
    );
  }, [checkLocalStorage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAttendance();
  }, [fetchAttendance]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col justify-center items-center h-[200px] text-muted-foreground">
          <Link2 className="h-8 w-8 mb-2" />
          <p className="text-sm text-center mb-3">
            Connect Blackboard to see your attendance
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/integration">
              <Link2 className="h-4 w-4 mr-2" />
              Connect Blackboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show integration prompt if no attendance data (total is 0)
  if (stats.total === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col justify-center items-center h-[200px] text-muted-foreground">
          <Link2 className="h-8 w-8 mb-2" />
          <p className="text-sm text-center mb-3">
            No attendance data found. Connect Blackboard to sync.
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/integration">
              <Link2 className="h-4 w-4 mr-2" />
              Connect Blackboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: "present", value: stats.present, fill: chartConfig.present.color },
    { name: "absent", value: stats.absent, fill: chartConfig.absent.color },
  ];

  // Calculate unknown/other
  const unknown = stats.total - stats.present - stats.absent;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          Attendance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[200px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                strokeWidth={2}
                stroke="hsl(var(--background))"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              {/* Center text */}
              <text
                x="50%"
                y="45%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-3xl font-bold"
              >
                {stats.percentage}%
              </text>
              <text
                x="50%"
                y="58%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground text-xs"
              >
                Present
              </text>
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Legend */}
        <div className="flex justify-center gap-6 mt-2">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: chartConfig.present.color }}
            />
            <span className="text-sm text-muted-foreground">
              Present:{" "}
              <span className="font-semibold text-foreground">
                {stats.present}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: chartConfig.absent.color }}
            />
            <span className="text-sm text-muted-foreground">
              Absent:{" "}
              <span className="font-semibold text-foreground">
                {stats.absent}
              </span>
            </span>
          </div>
          {unknown > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-muted" />
              <span className="text-sm text-muted-foreground">
                Unknown:{" "}
                <span className="font-semibold text-foreground">{unknown}</span>
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
