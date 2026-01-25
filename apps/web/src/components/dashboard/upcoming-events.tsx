"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Briefcase,
  ExternalLink,
  MapPin,
  Calendar,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface Internship {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  closingDate: string;
  link: string;
  description: string;
}

function getTypeColor(type: string): string {
  switch (type.toLowerCase()) {
    case "internship":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "contract":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30";
    case "permanent":
      return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30";
    default:
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30";
  }
}

function isClosingSoon(closingDate: string): boolean {
  try {
    const parts = closingDate.split("/");
    if (parts.length !== 3) return false;
    const date = new Date(
      parseInt(parts[2]),
      parseInt(parts[1]) - 1,
      parseInt(parts[0]),
    );
    const now = new Date();
    const daysLeft = Math.ceil(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysLeft <= 7 && daysLeft >= 0;
  } catch {
    return false;
  }
}

export function UpcomingEvents() {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInternships = async () => {
      try {
        const response = await fetch("/api/internships");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.items && data.items.length > 0) {
            // Get the latest 3 internships
            setInternships(data.items.slice(0, 3));
          }
        }
      } catch (err) {
        console.error("Failed to fetch internships:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInternships();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          Latest Opportunities
        </CardTitle>
        <Link
          href="/dashboard/internships"
          className="text-xs font-bold text-primary hover:underline"
        >
          See All
        </Link>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : internships.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No internships available
          </div>
        ) : (
          internships.map((internship) => (
            <InternshipItem key={internship.id} internship={internship} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function InternshipItem({ internship }: { internship: Internship }) {
  const closingSoon = isClosingSoon(internship.closingDate);

  return (
    <Link href={internship.link} target="_blank" rel="noopener noreferrer">
      <div className="group p-3 rounded-lg border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer hover:bg-muted/50">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {internship.title}
          </h4>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
        </div>

        <p className="text-xs font-medium text-foreground/80 mb-2">
          {internship.company}
        </p>

        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{internship.location}</span>
          </div>
          {closingSoon && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
              <Clock className="h-2.5 w-2.5 mr-1" />
              Closing Soon
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Badge
            variant="outline"
            className={`text-[10px] px-2 py-0 h-5 ${getTypeColor(internship.type)}`}
          >
            {internship.type}
          </Badge>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{internship.closingDate}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
