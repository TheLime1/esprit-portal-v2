"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Link2,
  BookOpen,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Info,
  ClipboardList,
  Calendar,
} from "lucide-react";

interface AttendanceStats {
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

interface BlackboardStatus {
  connected: boolean;
  user: {
    id: string;
    name: string;
    username: string;
    email?: string;
  } | null;
  lastSync: string | null;
  courseCount?: number;
  assignmentCount?: number;
  attendanceStats?: AttendanceStats | null;
}

export default function IntegrationPage() {
  const [bbStatus, setBbStatus] = useState<BlackboardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // Check localStorage for cached BB status first (instant)
  const checkLocalStorage = useCallback(() => {
    try {
      const cachedBBData = localStorage.getItem("esprit_bb_session");
      if (cachedBBData) {
        const parsed = JSON.parse(cachedBBData);
        if (parsed.user) {
          return {
            connected: true,
            user: parsed.user,
            lastSync: parsed.savedAt || null,
            courseCount: parsed.courses?.length || 0,
            assignmentCount: parsed.assignments?.length || 0,
            attendanceStats: parsed.attendanceStats || null,
          };
        }
      }
    } catch {
      // No cached data available, continue with normal flow
    }
    return null;
  }, []);

  const fetchStatus = useCallback(async () => {
    // First, show cached data instantly
    const cachedStatus = checkLocalStorage();
    if (cachedStatus) {
      setBbStatus(cachedStatus);
      setLoading(false);
    }

    try {
      // Get extension ID from localStorage
      const extensionId = localStorage.getItem("extensionId");

      if (!extensionId || typeof chrome === "undefined" || !chrome.runtime) {
        if (!cachedStatus) {
          setBbStatus({ connected: false, user: null, lastSync: null });
          setLoading(false);
        }
        return;
      }

      // Ask extension for Blackboard status (may have fresher data)
      chrome.runtime.sendMessage(
        extensionId,
        { action: "GET_BB_STATUS" },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            if (!cachedStatus) {
              setBbStatus({ connected: false, user: null, lastSync: null });
            }
          } else {
            const newStatus = {
              connected: response.connected,
              user: response.user || null,
              lastSync: response.lastSync || null,
              courseCount: response.courseCount,
              assignmentCount: response.assignmentCount,
              attendanceStats: response.attendanceStats,
            };
            setBbStatus(newStatus);

            // Cache the status in localStorage for instant display next time
            if (response.connected && response.user) {
              // Store full data (not placeholders) for use by other pages
              localStorage.setItem(
                "esprit_bb_session",
                JSON.stringify({
                  user: response.user,
                  courses: response.courses || [],
                  assignments: response.assignments || [],
                  attendance: response.attendance || [],
                  attendanceStats: response.attendanceStats,
                  savedAt: response.lastSync,
                }),
              );

              // Also store assignments separately for homework page
              if (response.assignments && response.assignments.length > 0) {
                localStorage.setItem(
                  "esprit_bb_assignments",
                  JSON.stringify({
                    success: true,
                    assignments: response.assignments,
                    total: response.assignments.length,
                    pending: response.assignments.filter(
                      (a: { status: string }) => a.status !== "Graded",
                    ).length,
                  }),
                );
              }
            }
          }
          setLoading(false);
        },
      );
    } catch (error) {
      console.error("Error fetching Blackboard status:", error);
      if (!cachedStatus) {
        setBbStatus({ connected: false, user: null, lastSync: null });
      }
      setLoading(false);
    }
  }, [checkLocalStorage]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/blackboard/sync", { method: "DELETE" });
      // Clear all Blackboard localStorage caches
      localStorage.removeItem("esprit_bb_session");
      localStorage.removeItem("esprit_bb_assignments");
      setBbStatus({ connected: false, user: null, lastSync: null });
    } catch (error) {
      console.error("Error disconnecting:", error);
    } finally {
      setDisconnecting(false);
    }
  };

  const formatLastSync = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Link2 className="h-8 w-8 text-primary" />
            Integrations
          </h1>
          <p className="text-muted-foreground mt-2">
            Connect external services to enhance your Esprit Portal experience
          </p>
        </div>

        {/* Blackboard Integration Card */}
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg overflow-hidden relative">
                  <Image
                    src="/blackboard.jpeg"
                    alt="Blackboard"
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <CardTitle className="text-xl">Blackboard</CardTitle>
                  <CardDescription>
                    Sync courses, assignments, and homework deadlines
                  </CardDescription>
                </div>
              </div>
              {loading ? (
                <Badge variant="secondary" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking...
                </Badge>
              ) : bbStatus?.connected ? (
                <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : bbStatus?.connected ? (
              /* Connected State */
              <>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Logged in as
                    </span>
                    <span className="font-medium">{bbStatus.user?.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="text-sm">
                      {bbStatus.user?.email || bbStatus.user?.username}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      <BookOpen className="h-4 w-4 inline mr-1" />
                      Courses synced
                    </span>
                    <span className="font-medium">
                      {bbStatus.courseCount || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      <ClipboardList className="h-4 w-4 inline mr-1" />
                      Assignments
                    </span>
                    <span className="font-medium">
                      {bbStatus.assignmentCount || 0}
                    </span>
                  </div>
                  {bbStatus.attendanceStats && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        Attendance
                      </span>
                      <span className="font-medium">
                        {bbStatus.attendanceStats.percentage}%
                        <span className="text-xs text-muted-foreground ml-1">
                          ({bbStatus.attendanceStats.present}/
                          {bbStatus.attendanceStats.total})
                        </span>
                      </span>
                    </div>
                  )}
                  {bbStatus.lastSync && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Last sync
                      </span>
                      <span className="text-sm">
                        {formatLastSync(bbStatus.lastSync)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={fetchStatus}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Status
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              /* Not Connected State */
              <>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        How to connect Blackboard
                      </p>
                      <ol className="text-sm text-blue-600 dark:text-blue-400 space-y-1 list-decimal list-inside">
                        <li>Install the Esprit Portal browser extension</li>
                        <li>
                          Go to{" "}
                          <a
                            href="https://esprit.blackboard.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline font-medium"
                          >
                            esprit.blackboard.com
                          </a>{" "}
                          and log in
                        </li>
                        <li>
                          The extension will automatically sync your session
                        </li>
                        <li>Come back here to see your connected status</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" asChild>
                    <a
                      href="https://esprit.blackboard.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Blackboard
                    </a>
                  </Button>
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={fetchStatus}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check Connection
                  </Button>
                </div>
              </>
            )}

            {/* What you get section */}
            <div className="border-t pt-6">
              <h4 className="font-medium mb-3">
                What you get with Blackboard integration:
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Automatic course sync from Blackboard
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Homework and assignment tracking
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Deadline alerts on your dashboard
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Never miss a submission again
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Future Integrations */}
        <div className="grid gap-4">
          <h2 className="text-xl font-semibold">Coming Soon</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Google Calendar</CardTitle>
                    <CardDescription className="text-xs">
                      Sync your schedule to Google Calendar
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
            <Card className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Discord</CardTitle>
                    <CardDescription className="text-xs">
                      Get deadline notifications in Discord
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
