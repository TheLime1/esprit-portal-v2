"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertBanner,
  Header,
  Timetable,
  ProfessorRating,
  FindRoom,
  UpcomingEvents,
} from "@/components/dashboard";

interface UserData {
  name: string;
  className: string;
}

interface DeadlineAlert {
  assignment: string;
  course: string;
  timeLeft: string;
  dueDate: string;
}

export default function DashboardPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [deadlineAlert, setDeadlineAlert] = useState<DeadlineAlert | null>(
    null,
  );

  // Check localStorage for cached deadline alert first
  // Checks both esprit_bb_assignments and esprit_bb_session as fallback
  const checkLocalStorage = useCallback(() => {
    try {
      // First check dedicated assignments cache
      const cachedAssignments = localStorage.getItem("esprit_bb_assignments");
      if (cachedAssignments) {
        const parsed = JSON.parse(cachedAssignments);
        if (parsed.deadlineAlert) {
          return parsed.deadlineAlert;
        }
      }

      // Fallback: calculate from esprit_bb_session assignments
      const cachedSession = localStorage.getItem("esprit_bb_session");
      if (cachedSession) {
        const parsed = JSON.parse(cachedSession);
        if (parsed.assignments && Array.isArray(parsed.assignments)) {
          // Find nearest deadline
          const now = new Date();
          const pendingWithDue = parsed.assignments.filter(
            (a: { status: string; due?: string }) =>
              a.status !== "Graded" && a.due && new Date(a.due) > now,
          );
          pendingWithDue.sort(
            (a: { due: string }, b: { due: string }) =>
              new Date(a.due).getTime() - new Date(b.due).getTime(),
          );

          const nearestDeadline = pendingWithDue[0];
          if (nearestDeadline?.due) {
            const dueDate = new Date(nearestDeadline.due);
            const diffMs = dueDate.getTime() - now.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(
              (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
            );

            let timeLeft = "";
            if (diffDays > 0) {
              timeLeft = `${diffDays} day${diffDays > 1 ? "s" : ""} ${diffHours}h`;
            } else if (diffHours > 0) {
              timeLeft = `${diffHours} hour${diffHours > 1 ? "s" : ""}`;
            } else {
              timeLeft = "Less than 1 hour";
            }

            return {
              assignment: nearestDeadline.name,
              course: nearestDeadline.courseName,
              timeLeft,
              dueDate: nearestDeadline.due,
            };
          }
        }
      }
    } catch {
      // No cached data available, continue with normal flow
    }
    return null;
  }, []);

  const fetchDeadlineAlert = useCallback(async () => {
    // First check localStorage for cached data (instant)
    const cachedAlert = checkLocalStorage();
    if (cachedAlert) {
      setDeadlineAlert(cachedAlert);
    }

    // Then try to get fresh data from extension
    const extensionId = localStorage.getItem("extensionId");
    if (extensionId && typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage(
        extensionId,
        { action: "GET_BB_ASSIGNMENTS" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (response: any) => {
          if (
            !chrome.runtime.lastError &&
            response?.success &&
            response.deadlineAlert
          ) {
            setDeadlineAlert(response.deadlineAlert);
            // Cache for next time
            localStorage.setItem(
              "esprit_bb_assignments",
              JSON.stringify(response),
            );
          }
        },
      );
    }
  }, [checkLocalStorage]);

  useEffect(() => {
    const storedUser = localStorage.getItem("esprit_user");
    if (storedUser) {
      try {
        setUserData(JSON.parse(storedUser));
      } catch {
        // Layout handles redirect
      }
    }

    // Fetch deadline alert from Blackboard
    fetchDeadlineAlert();
  }, [fetchDeadlineAlert]);

  // Extract first name for the welcome message
  const firstName = userData?.name?.split(" ")[0] || "Student";

  // Get current date
  const today = new Date();
  const dateString = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Build alert message
  const alertMessage = deadlineAlert
    ? `📚 "${deadlineAlert.assignment}" due in`
    : "Example alert for blackboard";
  const alertTimeLeft = deadlineAlert?.timeLeft || "";

  return (
    <>
      {/* Alert Banner */}
      <AlertBanner message={alertMessage} timeLeft={alertTimeLeft} />

      {/* Content */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Page Header */}
          <Header userName={firstName} date={dateString} />

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (Wide) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Timeline / Schedule */}
              <Timetable />

              {/* Professor Rating Section */}
              <ProfessorRating />
            </div>

            {/* Right Column (Narrow) */}
            <div className="space-y-6">
              {/* Find Empty Classroom */}
              <FindRoom />

              {/* Upcoming Events */}
              <UpcomingEvents />
            </div>
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-10" />
      </div>
    </>
  );
}
