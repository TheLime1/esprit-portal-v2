"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Briefcase,
  MapPin,
  Calendar,
  ExternalLink,
  Loader2,
  AlertCircle,
  Clock,
  Search,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Internship {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  closingDate: string;
  link: string;
  description: string;
  imageUrl: string;
  pubDate: string;
  addedBy: string;
}

interface InternshipsResponse {
  success: boolean;
  items: Internship[];
  total: number;
  lastUpdated: string;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
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
    // Parse DD/MM/YYYY format
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

export default function InternshipsPage() {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [filteredInternships, setFilteredInternships] = useState<Internship[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchInternships = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/internships");

        if (!response.ok) {
          throw new Error("Failed to fetch internships");
        }

        const data: InternshipsResponse = await response.json();

        if (!data.success) {
          throw new Error(
            (data.error as string) || "Failed to load internships",
          );
        }

        setInternships(data.items);
        setFilteredInternships(data.items);
      } catch (err) {
        console.error("Error fetching internships:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load internships",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchInternships();
  }, []);

  // Filter internships when filters change
  useEffect(() => {
    let filtered = [...internships];

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(
        (item) => item.type.toLowerCase() === typeFilter.toLowerCase(),
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.company.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query),
      );
    }

    setFilteredInternships(filtered);
  }, [internships, typeFilter, searchQuery]);

  // Get unique types for filter
  const types = Array.from(new Set(internships.map((i) => i.type))).sort();

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Briefcase className="h-8 w-8 text-primary" />
              Internships & Jobs
            </h1>
            <p className="text-muted-foreground mt-1">
              Browse the latest opportunities from ESPRIT Connect
            </p>
          </div>

          {!loading && !error && (
            <Badge variant="secondary" className="w-fit">
              {internships.length} opportunities
            </Badge>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map((type) => (
                <SelectItem key={type} value={type.toLowerCase()}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive/50">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">
                  Failed to load internships
                </p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Internships Grid */}
        {!loading && !error && (
          <>
            {filteredInternships.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No internships found</p>
                  <p className="text-sm mt-1">Try adjusting your filters</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInternships.map((internship) => (
                  <InternshipCard key={internship.id} internship={internship} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InternshipCard({ internship }: { internship: Internship }) {
  const closingSoon = isClosingSoon(internship.closingDate);

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/30 overflow-hidden">
      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Header */}
          <div>
            <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {internship.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              {internship.company}
            </p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={getTypeColor(internship.type)}>
              {internship.type}
            </Badge>
            {closingSoon && (
              <Badge variant="destructive" className="animate-pulse">
                Closing Soon!
              </Badge>
            )}
          </div>

          {/* Meta Info */}
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              <span>{internship.location || "Location not specified"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>Closes: {internship.closingDate || "Not specified"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>Posted: {formatDate(internship.pubDate)}</span>
            </div>
          </div>

          {/* Action Button */}
          <a
            href={internship.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Button
              className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all"
              variant="outline"
            >
              View Details
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
