"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Medal } from "lucide-react";

export function GradesRanking() {
    return (
        <Card className="relative overflow-hidden group">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Medal className="h-28 w-28 text-primary -rotate-12" />
            </div>

            <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold relative z-10">
                    Grades & Ranking
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6 relative z-10">
                {/* Stats cards */}
                <div className="flex gap-4">
                    {/* GPA Card */}
                    <div className="flex-1 bg-gradient-to-br from-primary to-primary/80 rounded-lg p-4 text-primary-foreground shadow-lg shadow-primary/20">
                        <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-wider mb-1">
                            GPA
                        </p>
                        <p className="text-4xl font-bold tracking-tight">3.8</p>
                        <div className="flex items-center gap-1 mt-2 text-xs bg-white/20 w-fit px-2 py-0.5 rounded text-primary-foreground font-medium">
                            <TrendingUp className="h-3 w-3" />
                            +0.2%
                        </div>
                    </div>

                    {/* Rank Card */}
                    <div className="flex-1 bg-card border border-border rounded-lg p-4 flex flex-col justify-between">
                        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                            Rank
                        </p>
                        <div>
                            <p className="text-2xl font-bold text-foreground">#12</p>
                            <p className="text-xs text-muted-foreground">of 150</p>
                        </div>
                    </div>
                </div>

                {/* View Report Button */}
                <Button variant="outline" className="w-full">
                    View Detailed Report
                </Button>
            </CardContent>
        </Card>
    );
}
