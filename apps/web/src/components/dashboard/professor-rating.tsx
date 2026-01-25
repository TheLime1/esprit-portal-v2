"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Professor {
    id: string;
    name: string;
    course: string;
    imageUrl: string;
    defaultRating: number;
}

const professors: Professor[] = [
    {
        id: "1",
        name: "Prof. J. Smith",
        course: "Physics 101",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuDIQNR_ObmqzIsc0FAkCVhZooK1lXX662Em_S18b3RJmtMUoOjHvx8FX22lCh-aG8IOTJlH1ItS0l442j63zM1AlUnYRS_VdDOBOSBnwv4tfLcz3W5etjgEESbm0-AOlfH6T1s87RZYww-lYTTxYZSRhckASDDxQkk8QkITiTXLfPbeNC6-DxxcdCQicF7twHe50_jJsKYM_IIu78J34sTBpNwiG9-OSo_nA5AjCadbmyAxYiFfKg2c5ny-8P4xp4bMhUFLc1q59bg",
        defaultRating: 4,
    },
    {
        id: "2",
        name: "Prof. A. Davis",
        course: "History 202",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuCaiy30vg482Lr_jE6R9tHRQjbxS3oxAGQufbVXxqASWjdnxyulRhbsHeoD2Cm0c6VqLwuNCTL0S2UmvPGcVsqzTa2Lwa0FzK2mzVXubHHTJF5NWkkSyc57izW0z4VBQ1LSrlelZbKW7DoFje0cPlRwIzPuZVw5H4leKZbodWWFK1OvpkwibAlUzqR-I1tMK6Ws_0yZfq1z0Aa3q5VJu3uV51q-Wipm9pCsHH13tw7aEGiCM5wfqTgscjBTbwXceU0u5BaEGVbirTg",
        defaultRating: 3,
    },
];

export function ProfessorRating() {
    return (
        <Card className="overflow-hidden">
            <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-lg font-bold">Rate Recent Lectures</CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {professors.map((professor) => (
                    <ProfessorCard key={professor.id} professor={professor} />
                ))}
            </CardContent>
        </Card>
    );
}

function ProfessorCard({ professor }: { professor: Professor }) {
    const [rating, setRating] = useState(professor.defaultRating);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    const displayRating = hoveredRating || rating;

    return (
        <div
            className="border border-border rounded-lg p-4 hover:border-primary/30 transition-colors group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={professor.imageUrl} alt={professor.name} />
                    <AvatarFallback>
                        {professor.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-sm text-foreground">
                        {professor.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{professor.course}</p>
                </div>
            </div>
            <div className="flex items-center justify-between">
                <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            className="p-0.5 transition-transform hover:scale-110"
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            onClick={() => setRating(star)}
                        >
                            <Star
                                className={cn(
                                    "h-5 w-5 transition-colors",
                                    star <= displayRating
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-muted-foreground/30"
                                )}
                            />
                        </button>
                    ))}
                </div>
                <button
                    className={cn(
                        "text-xs font-medium text-primary transition-opacity",
                        isHovered ? "opacity-100" : "opacity-0"
                    )}
                >
                    Submit
                </button>
            </div>
        </div>
    );
}
