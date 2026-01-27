"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Link2,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Chrome extension types - eslint-disable-next-line
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const chrome: any;

interface Assignment {
  id: string;
  name: string;
  courseId: string;
  courseName?: string;
  due?: string;
  scorePossible?: number;
  score?: number | null;
  status: "NotSubmitted" | "NeedsGrading" | "Graded" | "InProgress";
  isPastDue: boolean;
  daysUntilDue?: number;
}

interface AssignmentsResponse {
  success: boolean;
  assignments: Assignment[];
  deadlineAlert: {
    assignment: string;
    course: string;
    timeLeft: string;
    dueDate: string;
  } | null;
  total: number;
  pending: number;
  error?: string;
}

export default function HomeworkPage() {
  const [data, setData] = useState<AssignmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "graded">("all");

  // Check localStorage for cached assignments first (instant)
  // Checks both esprit_bb_assignments and esprit_bb_session as fallback
  const checkLocalStorage = useCallback(() => {
    try {
      // Debug: log what keys exist
      console.log("🔍 Checking localStorage for BB data...");
      console.log(
        "  - esprit_bb_assignments:",
        localStorage.getItem("esprit_bb_assignments") ? "exists" : "missing",
      );
      console.log(
        "  - esprit_bb_session:",
        localStorage.getItem("esprit_bb_session") ? "exists" : "missing",
      );
      console.log(
        "  - extensionId:",
        localStorage.getItem("extensionId") || "missing",
      );

      // First try the dedicated assignments cache
      const cachedBBData = localStorage.getItem("esprit_bb_assignments");
      if (cachedBBData) {
        const parsed = JSON.parse(cachedBBData);
        if (
          parsed.assignments &&
          Array.isArray(parsed.assignments) &&
          parsed.assignments.length > 0
        ) {
          console.log(
            "✅ Found assignments in esprit_bb_assignments:",
            parsed.assignments.length,
          );
          return parsed as AssignmentsResponse;
        }
      }

      // Fallback: try esprit_bb_session which contains all BB data
      const cachedSession = localStorage.getItem("esprit_bb_session");
      if (cachedSession) {
        const parsed = JSON.parse(cachedSession);
        if (
          parsed.assignments &&
          Array.isArray(parsed.assignments) &&
          parsed.assignments.length > 0
        ) {
          console.log(
            "✅ Found assignments in esprit_bb_session:",
            parsed.assignments.length,
          );
          return {
            success: true,
            assignments: parsed.assignments,
            deadlineAlert: null,
            total: parsed.assignments.length,
            pending: parsed.assignments.filter(
              (a: Assignment) => a.status !== "Graded",
            ).length,
          } as AssignmentsResponse;
        }
      }
    } catch {
      // No cached data available, continue with normal flow
    }
    return null;
  }, []);

  // Try to fetch and cache full BB data from extension
  const fetchAndCacheFullBBData = useCallback((extensionId: string) => {
    return new Promise<void>((resolve) => {
      chrome.runtime.sendMessage(
        extensionId,
        { action: "GET_BB_STATUS" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (response: any) => {
          if (chrome.runtime.lastError || !response?.connected) {
            resolve();
            return;
          }

          // Cache full BB data to localStorage
          if (response.user) {
            const sessionData = {
              user: response.user,
              courses: response.courses || [],
              assignments: response.assignments || [],
              attendance: response.attendance || [],
              attendanceStats: response.attendanceStats,
              savedAt: response.lastSync || new Date().toISOString(),
            };
            localStorage.setItem(
              "esprit_bb_session",
              JSON.stringify(sessionData),
            );
            console.log("✅ Cached full BB data to esprit_bb_session");

            // Also cache assignments separately
            if (response.assignments && response.assignments.length > 0) {
              const assignmentsData = {
                success: true,
                assignments: response.assignments,
                deadlineAlert: null,
                total: response.assignments.length,
                pending: response.assignments.filter(
                  (a: Assignment) => a.status !== "Graded",
                ).length,
              };
              localStorage.setItem(
                "esprit_bb_assignments",
                JSON.stringify(assignmentsData),
              );
              console.log("✅ Cached assignments to esprit_bb_assignments");
            }
          }
          resolve();
        },
      );
    });
  }, []);

  const fetchAssignments = useCallback(async () => {
    // First, show cached data instantly
    let cachedData = checkLocalStorage();
    if (cachedData) {
      setData(cachedData);
      setError(null); // Clear any previous error since we have cached data
      setLoading(false);
    }

    try {
      // Get extension ID from localStorage
      const extensionId = localStorage.getItem("extensionId");

      if (!extensionId) {
        // No extension ID - can only show cached data
        if (!cachedData) {
          setError(
            "Extension not connected. Please log in first to connect the extension.",
          );
        }
        setLoading(false);
        return;
      }

      if (chrome === undefined || !chrome.runtime) {
        // Chrome API not available - can only show cached data
        if (!cachedData) {
          setError(
            "Chrome extension API not available. Please use Chrome browser.",
          );
        }
        setLoading(false);
        return;
      }

      // If no cached data, try to fetch and cache full BB data first
      if (!cachedData) {
        await fetchAndCacheFullBBData(extensionId);
        // Check localStorage again after fetching
        cachedData = checkLocalStorage();
        if (cachedData) {
          setData(cachedData);
          setError(null);
          setLoading(false);
          return;
        }
      }

      // Ask extension for assignments from local storage (may have fresher data)
      chrome.runtime.sendMessage(
        extensionId,
        { action: "GET_BB_ASSIGNMENTS" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (response: any) => {
          if (chrome.runtime.lastError) {
            if (!cachedData) {
              setError("Failed to communicate with extension");
            }
            setLoading(false);
            return;
          }

          if (!response?.success) {
            if (!cachedData) {
              setError(response?.error || "Not connected to Blackboard");
            }
            setLoading(false);
            return;
          }

          setData(response);
          setError(null);

          // Cache the assignments in localStorage for instant display next time
          localStorage.setItem(
            "esprit_bb_assignments",
            JSON.stringify(response),
          );

          // Also update esprit_bb_session with assignments for consistency
          try {
            const existingSession = localStorage.getItem("esprit_bb_session");
            if (existingSession) {
              const parsed = JSON.parse(existingSession);
              parsed.assignments = response.assignments;
              localStorage.setItem("esprit_bb_session", JSON.stringify(parsed));
            }
          } catch {
            // Ignore errors
          }

          setLoading(false);
        },
      );
    } catch (err) {
      if (!cachedData) {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
      setLoading(false);
    }
  }, [checkLocalStorage, fetchAndCacheFullBBData]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssignments();
  }, [fetchAssignments]);

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (assignment: Assignment) => {
    if (assignment.status === "Graded") {
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Graded
        </Badge>
      );
    }
    if (assignment.isPastDue) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Overdue
        </Badge>
      );
    }
    if (assignment.daysUntilDue !== undefined && assignment.daysUntilDue <= 2) {
      return (
        <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30">
          <Clock className="h-3 w-3 mr-1" />
          Due Soon
        </Badge>
      );
    }
    if (assignment.status === "InProgress") {
      return (
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">
          In Progress
        </Badge>
      );
    }
    return <Badge variant="secondary">Not Submitted</Badge>;
  };

  const filteredAssignments = data?.assignments.filter((a) => {
    if (filter === "pending") return a.status !== "Graded";
    if (filter === "graded") return a.status === "Graded";
    return true;
  });

  // Not connected state
  if (!loading && error?.includes("Not connected")) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center">
              <Link2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              Connect Blackboard to See Homework
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Your homework and assignments will appear here once you connect
              your Blackboard account.
            </p>
            <Button asChild>
              <Link href="/dashboard/integration">
                <Link2 className="h-4 w-4 mr-2" />
                Go to Integrations
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-primary" />
              Homework
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your assignments and deadlines from Blackboard
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchAssignments}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Deadline Alert */}
        {data?.deadlineAlert && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-orange-700 dark:text-orange-300">
                  Upcoming Deadline
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  <strong>{data.deadlineAlert.assignment}</strong> from{" "}
                  {data.deadlineAlert.course} is due in{" "}
                  <strong>{data.deadlineAlert.timeLeft}</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {data && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="text-center p-4">
              <div className="text-3xl font-bold text-primary">
                {data.total}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Assignments
              </div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-3xl font-bold text-orange-500">
                {data.pending}
              </div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-3xl font-bold text-green-500">
                {data.total - data.pending}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </Card>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
          >
            Pending
          </Button>
          <Button
            variant={filter === "graded" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("graded")}
          >
            Graded
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && !error.includes("Not connected") && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive font-medium">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchAssignments}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Assignments List */}
        {!loading && !error && filteredAssignments && (
          <div className="space-y-3">
            {filteredAssignments.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-medium">All caught up!</h3>
                <p className="text-muted-foreground">
                  No{" "}
                  {filter === "pending"
                    ? "pending "
                    : filter === "graded"
                      ? "graded "
                      : ""}
                  assignments to show.
                </p>
              </Card>
            ) : (
              filteredAssignments.map((assignment) => (
                <Card
                  key={assignment.id}
                  className={cn(
                    "transition-all hover:shadow-md",
                    assignment.isPastDue &&
                      assignment.status !== "Graded" &&
                      "border-destructive/50",
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">
                            {assignment.name}
                          </h3>
                          {getStatusBadge(assignment)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            {assignment.courseName || "Unknown Course"}
                          </span>
                          {assignment.due && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDueDate(assignment.due)}
                            </span>
                          )}
                          {assignment.scorePossible && (
                            <span>
                              {assignment.score !== null
                                ? `${assignment.score}/${assignment.scorePossible}`
                                : `${assignment.scorePossible} pts`}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" asChild>
                        <a
                          href={`https://esprit.blackboard.com/webapps/blackboard/execute/announcement?method=search&course_id=${assignment.courseId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
