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
    return (
        <div className="bg-background text-foreground h-screen overflow-hidden flex">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Alert Banner */}
                <AlertBanner message="Physics Lab Report due in" timeLeft="4h 20m" />

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
