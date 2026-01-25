"use client";

import { useEffect, useState } from "react";
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

export default function DashboardPage() {
    const [userData, setUserData] = useState<UserData | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem("esprit_user");
        if (storedUser) {
            try {
                setUserData(JSON.parse(storedUser));
            } catch {
                // Layout handles redirect
            }
        }
    }, []);

    // Extract first name for the welcome message
    const firstName = userData?.name?.split(" ")[0] || "Student";

    // Get current date
    const today = new Date();
    const dateString = today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    return (
        <>
            {/* Alert Banner */}
            <AlertBanner message="Physics Lab Report due in" timeLeft="4h 20m" />

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
