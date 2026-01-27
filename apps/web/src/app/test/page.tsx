"use client";

import { useState, useEffect } from "react";
import {
  Sidebar,
  AlertBanner,
  Header,
  Timetable,
  ProfessorRating,
  GradesRanking,
  FindRoom,
  UpcomingEvents,
} from "@/components/dashboard";

export default function TestDashboardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Avoid SSR issues with components that use useTheme
  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground h-screen overflow-hidden flex">
      {/* Sidebar */}
      <Sidebar userName="Test User" className="3A-TEST" />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Alert Banner */}
        <AlertBanner message="Example alert for blackboard" timeLeft="" />

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            <div className="max-w-7xl mx-auto space-y-8">
              {/* Page Header */}
              <Header userName="Alex" date="Tuesday, October 24th" />

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
                  {/* Grades & Ranking */}
                  <GradesRanking />

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
        </div>
      </main>
    </div>
  );
}
