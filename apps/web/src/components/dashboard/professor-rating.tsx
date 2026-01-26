"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export function ProfessorRating() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-lg font-bold">
          Give Us More Feedback
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Send email to{" "}
          <a
            href="mailto:hi@espritads.site"
            className="text-primary hover:underline"
          >
            hi@espritads.site
          </a>
        </p>
      </CardHeader>
      <CardContent className="p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
          <div className="p-4 rounded-full bg-primary/10">
            <BookOpen className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Blackboard Integration
            </h3>
            <p className="text-muted-foreground">
              Coming soon to help you manage your courses better
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
