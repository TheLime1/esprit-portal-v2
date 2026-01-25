"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  RefreshCw,
  Loader2,
  AlertCircle,
  Award,
  Calendar,
  TrendingUp,
  BookOpen,
} from "lucide-react";

// Credit record from esprit-ts (key-value based on table headers)
interface Credit {
  [key: string]: string;
}

interface CreditsData {
  credits: Credit[] | null;
  lastFetched?: string;
}

// Mock data for demonstration (fallback) - matches actual ESPRIT portal structure
// Note: Credits page shows modules that need to be retaken (failed modules for students with yearly avg >10/20)
const mockCredits: Credit[] = [
  {
    "Année universitaire": "2024",
    "Unité d'enseignement": "Théorie des langages",
    Module: "Théorie des langages",
    Code_module: "AP-10",
    moy_ue: "2,55",
    moy_module: "2,55",
  },
  {
    "Année universitaire": "2024",
    "Unité d'enseignement": "Méthodes numériques pour l'ingénieur",
    Module: "Analyse Numérique",
    Code_module: "MS-3821",
    moy_ue: "5,95",
    moy_module: "2,55",
  },
  {
    "Année universitaire": "2024",
    "Unité d'enseignement": "Techniques d'estimation pour l'ingénieur",
    Module: "Techniques d'estimation pour l'ingénieur",
    Code_module: "MS-07",
    moy_ue: "0,20",
    moy_module: "0,20",
  },
  {
    "Année universitaire": "2023",
    "Unité d'enseignement": "Mathématiques de base 3",
    Module: "Mathématiques de Base 3",
    Code_module: "MS-03",
    moy_ue: "3,15",
    moy_module: "3,15",
  },
  {
    "Année universitaire": "2024",
    "Unité d'enseignement": "Méthodes numériques pour l'ingénieur",
    Module: "Machine Learning Fundamentals",
    Code_module: "EECI-343",
    moy_ue: "5,95",
    moy_module: "12,75",
  },
];

// Helper to get credit value with case-insensitive key matching
function getCreditValue(credit: Credit, patterns: string[]): string {
  for (const key of Object.keys(credit)) {
    const keyLower = key.toLowerCase();
    for (const pattern of patterns) {
      if (keyLower.includes(pattern.toLowerCase())) {
        return credit[key] || "";
      }
    }
  }
  return "";
}

// Parse European number format (comma as decimal separator)
function parseEuropeanNumber(value: string): number {
  if (!value) return 0;
  return Number.parseFloat(value.replace(",", ".")) || 0;
}

// Calculate statistics from credits
// Note: Credits are makeup exams for FAILED modules (students with yearly avg >10 but some modules <8)
function calculateCreditsStats(credits: Credit[]): {
  totalModules: number;
  failedModules: number;
  averageScore: number;
  uniqueYears: string[];
} {
  const passingThreshold = 8; // Passing grade for modules at ESPRIT is 8/20
  let totalScore = 0;
  let failedModules = 0;
  const yearsSet = new Set<string>();

  credits.forEach((credit) => {
    const moduleAvg = parseEuropeanNumber(
      getCreditValue(credit, ["moy_module", "moyenne"]),
    );
    const year = getCreditValue(credit, ["année", "annee", "year"]);

    totalScore += moduleAvg;
    if (moduleAvg < passingThreshold) failedModules++;
    if (year) yearsSet.add(year);
  });

  return {
    totalModules: credits.length,
    failedModules,
    averageScore: credits.length > 0 ? totalScore / credits.length : 0,
    uniqueYears: Array.from(yearsSet).sort().reverse(),
  };
}

// Get color based on module average (8/20 is passing grade at ESPRIT)
function getScoreColor(score: string): string {
  const numScore = parseEuropeanNumber(score);
  if (numScore >= 8) return "text-green-500"; // Passed
  if (numScore >= 5) return "text-yellow-500"; // Close to passing
  return "text-red-500"; // Failed
}

export default function CreditsPage() {
  const [creditsData, setCreditsData] = useState<CreditsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  useEffect(() => {
    const loadCreditsFromStorage = () => {
      setIsLoading(true);

      try {
        // Try to load credits from localStorage (set during login)
        const storedCredits = localStorage.getItem("esprit_credits");

        if (storedCredits) {
          const parsedCredits = JSON.parse(storedCredits);
          console.log("Loaded credits from localStorage:", parsedCredits);
          setCreditsData({
            credits: parsedCredits,
            lastFetched: new Date().toISOString(),
          });
          setIsUsingMockData(false);
        } else {
          // Check if we have student data with credits
          const studentData = localStorage.getItem("esprit_student_data");
          if (studentData) {
            const parsed = JSON.parse(studentData);
            if (parsed.credits && parsed.credits.length > 0) {
              console.log("Using credits from student data:", parsed.credits);
              setCreditsData({
                credits: parsed.credits,
                lastFetched: parsed.lastFetched,
              });
              setIsUsingMockData(false);
            } else {
              console.log("No credits in student data, using mock data");
              setCreditsData({
                credits: mockCredits,
                lastFetched: new Date().toISOString(),
              });
              setIsUsingMockData(true);
            }
          } else {
            console.log("No stored data found, using mock data");
            setCreditsData({
              credits: mockCredits,
              lastFetched: new Date().toISOString(),
            });
            setIsUsingMockData(true);
          }
        }
      } catch (err) {
        console.error("Error loading credits:", err);
        setCreditsData({
          credits: mockCredits,
          lastFetched: new Date().toISOString(),
        });
        setIsUsingMockData(true);
      }

      setIsLoading(false);
    };

    loadCreditsFromStorage();
  }, []);

  const refreshCredits = async () => {
    setIsLoading(true);

    try {
      const extensionId = localStorage.getItem("extensionId");

      if (extensionId && typeof window !== "undefined" && "chrome" in window) {
        const chromeObj = window.chrome as {
          runtime?: {
            sendMessage: (
              id: string,
              msg: unknown,
              cb: (res: {
                success?: boolean;
                data?: Credit[];
                error?: string;
              }) => void,
            ) => void;
          };
        };
        if (chromeObj?.runtime) {
          chromeObj.runtime.sendMessage(
            extensionId,
            { action: "GET_CREDITS" },
            (response) => {
              if (response?.success && response.data) {
                localStorage.setItem(
                  "esprit_credits",
                  JSON.stringify(response.data),
                );
                setCreditsData({
                  credits: response.data,
                  lastFetched: new Date().toISOString(),
                });
                setIsUsingMockData(false);
                console.log("Refreshed credits:", response.data);
              } else {
                console.log("Failed to refresh credits:", response?.error);
              }
              setIsLoading(false);
            },
          );
          return;
        }
      }
      setIsLoading(false);
    } catch (err) {
      console.error("Error refreshing credits:", err);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading credits...</p>
        </div>
      </div>
    );
  }

  const credits = creditsData?.credits || [];
  const stats = calculateCreditsStats(credits);

  // Get headers from first credit entry
  const headers = credits.length > 0 ? Object.keys(credits[0]) : [];

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent flex items-center gap-3">
              <GraduationCap className="h-10 w-10 text-primary" />
              Credit Exams
            </h1>
            <p className="text-muted-foreground mt-2">
              Modules requiring makeup exams (credits) - Passing grade: 8/20
            </p>
          </div>
          <Button
            variant="outline"
            onClick={refreshCredits}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>

        {/* Data Source Indicator */}
        {isUsingMockData && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <p className="text-sm text-yellow-500">
              Showing mock data. Login with the extension to see your actual
              modules requiring credit exams.
            </p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Modules */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                  <Award className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Modules</p>
                  <p className="text-3xl font-bold text-primary">
                    {stats.totalModules}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Failed Modules */}
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                  <TrendingUp className="h-7 w-7 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Modules Needing Retake
                  </p>
                  <p className="text-3xl font-bold text-red-500">
                    {stats.failedModules} / {stats.totalModules}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Years */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Calendar className="h-7 w-7 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Academic Years
                  </p>
                  <p className="text-3xl font-bold text-blue-500">
                    {stats.uniqueYears.length > 0
                      ? stats.uniqueYears.join(", ")
                      : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Average Score Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Average Module Score (8/20 to pass)
                </span>
                <span
                  className={cn(
                    "font-medium",
                    stats.averageScore >= 8
                      ? "text-green-500"
                      : stats.averageScore >= 5
                        ? "text-yellow-500"
                        : "text-red-500",
                  )}
                >
                  {stats.averageScore.toFixed(2)} / 20
                </span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    stats.averageScore >= 8
                      ? "bg-gradient-to-r from-green-500 to-green-400"
                      : stats.averageScore >= 5
                        ? "bg-gradient-to-r from-yellow-500 to-yellow-400"
                        : "bg-gradient-to-r from-red-500 to-red-400",
                  )}
                  style={{
                    width: `${Math.min(100, (stats.averageScore / 20) * 100)}%`,
                  }}
                />
              </div>
              {/* Passing threshold indicator */}
              <div className="relative">
                <div
                  className="absolute h-2 w-0.5 bg-white/50 -top-6"
                  style={{ left: "40%" }}
                  title="Passing grade: 8/20"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credits Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Modules Requiring Credit Exams
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              These modules scored below 8/20 and require makeup exams
            </p>
          </CardHeader>
          <CardContent>
            {credits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4" />
                <p>No credit history available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {headers.map((header) => (
                        <th
                          key={`header-${header}`}
                          className="text-left py-4 px-4 font-semibold text-muted-foreground"
                        >
                          {header}
                        </th>
                      ))}
                      <th className="text-center py-4 px-4 font-semibold text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {credits.map((credit, rowIdx) => {
                      const moduleAvg = getCreditValue(credit, [
                        "moy_module",
                        "moyenne",
                      ]);
                      const isPassing = parseEuropeanNumber(moduleAvg) >= 8; // 8/20 is passing grade
                      const module = getCreditValue(credit, ["module"]);

                      return (
                        <tr
                          key={`row-${rowIdx}-${module}`}
                          className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                        >
                          {headers.map((header, colIdx) => {
                            const value = credit[header] || "";
                            const isAvgCol =
                              header.toLowerCase().includes("moy") ||
                              header.toLowerCase().includes("moyenne");

                            return (
                              <td
                                key={`cell-${rowIdx}-${colIdx}`}
                                className={cn(
                                  "py-4 px-4",
                                  isAvgCol && "font-semibold",
                                  isAvgCol && getScoreColor(value),
                                )}
                              >
                                {value}
                              </td>
                            );
                          })}
                          <td className="py-4 px-4 text-center">
                            <Badge
                              variant={isPassing ? "default" : "secondary"}
                              className={cn(
                                isPassing
                                  ? "bg-green-500/10 text-green-500 border-green-500/20"
                                  : "bg-red-500/10 text-red-500 border-red-500/20",
                              )}
                            >
                              {isPassing ? "Passed" : "Failed"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Module Cards View (Alternative display) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {credits.map((credit, idx) => {
            const year = getCreditValue(credit, [
              "année",
              "year",
              "universitaire",
            ]);
            const module = getCreditValue(credit, ["module"]);
            const unitName = getCreditValue(credit, [
              "unité",
              "enseignement",
              "teaching",
            ]);
            const moduleAvg = getCreditValue(credit, ["moy_module", "moyenne"]);
            const ueAvg = getCreditValue(credit, ["moy_ue"]);
            const code = getCreditValue(credit, ["code"]);
            const isPassing = parseEuropeanNumber(moduleAvg) >= 8; // 8/20 is passing grade at ESPRIT

            return (
              <Card
                key={`module-${idx}-${code || module}`}
                className={cn(
                  "transition-all duration-300 hover:shadow-lg border-l-4",
                  isPassing ? "border-l-green-500" : "border-l-red-500",
                )}
              >
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {year}
                        </Badge>
                        {code && (
                          <Badge variant="secondary" className="text-xs">
                            {code}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground">
                        {module || unitName || "Module"}
                      </h3>
                      {unitName && module && unitName !== module && (
                        <p className="text-sm text-muted-foreground">
                          {unitName}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        <span className={getScoreColor(moduleAvg)}>
                          {moduleAvg || "-"}
                        </span>
                        <span className="text-muted-foreground text-lg">
                          /20
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        module avg
                      </p>
                      {ueAvg && (
                        <p className="text-xs text-muted-foreground mt-1">
                          UE: {ueAvg}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Mini progress bar */}
                  <div className="mt-4">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-500",
                          isPassing ? "bg-green-500" : "bg-red-500",
                        )}
                        style={{
                          width: `${Math.min(100, (parseEuropeanNumber(moduleAvg) / 20) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Last Updated */}
        {creditsData?.lastFetched && !isUsingMockData && (
          <p className="text-sm text-muted-foreground text-center">
            Last updated: {new Date(creditsData.lastFetched).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
