"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Award,
  RefreshCw,
  CheckCircle,
  Languages,
  Loader2,
  AlertCircle,
} from "lucide-react";

// Tab definitions based on esprit-ts endpoints
const gradeTabs = [
  {
    id: "regular",
    label: "Regular Grades",
    icon: BookOpen,
    description: "Incremental grades during semester",
  },
  {
    id: "principal",
    label: "Principal Result",
    icon: Award,
    description: "Final session verdict",
  },
  {
    id: "rattrapage-grades",
    label: "Rattrapage Grades",
    icon: RefreshCw,
    description: "Retake session grades",
  },
  {
    id: "rattrapage-result",
    label: "Rattrapage Result",
    icon: CheckCircle,
    description: "Retake final verdict",
  },
  {
    id: "language",
    label: "Language Levels",
    icon: Languages,
    description: "French & English proficiency",
  },
];

interface Grade {
  designation: string;
  coefficient: number | null;
  noteCC: number | null;
  noteTP: number | null;
  noteExam: number | null;
}

interface AllGradesData {
  regularGrades: Grade[] | null;
  principalResult: {
    moyenneGeneral: string | null;
    decision: string | null;
  } | null;
  rattrapageGrades: Grade[] | null;
  rattrapageResult: {
    moyenneGeneral: string | null;
    decision: string | null;
  } | null;
  languageLevels: { francais: string | null; anglais: string | null } | null;
  lastFetched?: string;
}

// Mock data for demonstration (fallback)
const mockData: AllGradesData = {
  regularGrades: [
    {
      designation: "Mathematics",
      coefficient: 3,
      noteCC: 14.5,
      noteTP: null,
      noteExam: 12.0,
    },
    {
      designation: "Physics",
      coefficient: 2,
      noteCC: 16.0,
      noteTP: 15.0,
      noteExam: 13.5,
    },
    {
      designation: "Computer Science",
      coefficient: 4,
      noteCC: 18.0,
      noteTP: 17.5,
      noteExam: 16.0,
    },
    {
      designation: "Electronics",
      coefficient: 2,
      noteCC: 13.0,
      noteTP: 14.0,
      noteExam: null,
    },
    {
      designation: "Networks",
      coefficient: 3,
      noteCC: 15.5,
      noteTP: 16.0,
      noteExam: 14.0,
    },
  ],
  principalResult: {
    moyenneGeneral: "14.75",
    decision: "Admis(e)",
  },
  rattrapageGrades: [
    {
      designation: "Physics",
      coefficient: 2,
      noteCC: null,
      noteTP: null,
      noteExam: 11.0,
    },
  ],
  rattrapageResult: {
    moyenneGeneral: "12.50",
    decision: "Admis(e) après rattrapage",
  },
  languageLevels: {
    francais: "B2",
    anglais: "C1",
  },
  lastFetched: new Date().toISOString(),
};

export default function GradesPage() {
  const [activeTab, setActiveTab] = useState("regular");
  const [gradesData, setGradesData] = useState<AllGradesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  useEffect(() => {
    loadGradesFromStorage();
  }, []);

  const loadGradesFromStorage = () => {
    setIsLoading(true);

    try {
      // Try to load grades from localStorage (set during login)
      const storedGrades = localStorage.getItem("esprit_grades");

      if (storedGrades) {
        const parsedGrades = JSON.parse(storedGrades);
        console.log("Loaded grades from localStorage:", parsedGrades);
        setGradesData(parsedGrades);
        setIsUsingMockData(false);
      } else {
        // Check if we have student data with grades
        const studentData = localStorage.getItem("esprit_student_data");
        if (studentData) {
          const parsed = JSON.parse(studentData);
          // If student data has grades, use them
          if (parsed.grades && parsed.grades.length > 0) {
            console.log("Using grades from student data:", parsed.grades);
            setGradesData({
              regularGrades: parsed.grades,
              principalResult: null,
              rattrapageGrades: null,
              rattrapageResult: null,
              languageLevels: null,
              lastFetched: parsed.lastFetched,
            });
            setIsUsingMockData(false);
          } else {
            console.log("No grades in student data, using mock data");
            setGradesData(mockData);
            setIsUsingMockData(true);
          }
        } else {
          console.log("No stored data found, using mock data");
          setGradesData(mockData);
          setIsUsingMockData(true);
        }
      }
    } catch (err) {
      console.error("Error loading grades:", err);
      setGradesData(mockData);
      setIsUsingMockData(true);
    }

    setIsLoading(false);
  };

  const refreshGrades = async () => {
    setIsLoading(true);

    try {
      const extensionId = localStorage.getItem("extensionId");

      if (extensionId && typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage(
          extensionId,
          { action: "GET_GRADES" },
          (response) => {
            if (response?.success && response.data) {
              localStorage.setItem(
                "esprit_grades",
                JSON.stringify(response.data),
              );
              setGradesData(response.data);
              setIsUsingMockData(false);
              console.log("Refreshed grades:", response.data);
            } else {
              console.log("Failed to refresh grades:", response?.error);
            }
            setIsLoading(false);
          },
        );
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Error refreshing grades:", err);
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (!gradesData) return null;

    switch (activeTab) {
      case "regular":
      case "rattrapage-grades":
        const grades =
          activeTab === "regular"
            ? gradesData.regularGrades
            : gradesData.rattrapageGrades;

        if (!grades || grades.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p>No grades available for this session</p>
            </div>
          );
        }

        return (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-4 font-semibold text-muted-foreground">
                    Module
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-muted-foreground">
                    Coef
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-muted-foreground">
                    CC
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-muted-foreground">
                    TP
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-muted-foreground">
                    Exam
                  </th>
                </tr>
              </thead>
              <tbody>
                {grades.map((grade, index) => (
                  <tr
                    key={index}
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-4 px-4 font-medium">
                      {grade.designation}
                    </td>
                    <td className="py-4 px-4 text-center text-muted-foreground">
                      {grade.coefficient}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {grade.noteCC !== null ? (
                        <span
                          className={cn(
                            "font-semibold",
                            Number(grade.noteCC) >= 10
                              ? "text-green-500"
                              : "text-red-500",
                          )}
                        >
                          {typeof grade.noteCC === "number"
                            ? grade.noteCC.toFixed(2)
                            : grade.noteCC}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {grade.noteTP !== null ? (
                        <span
                          className={cn(
                            "font-semibold",
                            Number(grade.noteTP) >= 10
                              ? "text-green-500"
                              : "text-red-500",
                          )}
                        >
                          {typeof grade.noteTP === "number"
                            ? grade.noteTP.toFixed(2)
                            : grade.noteTP}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {grade.noteExam !== null ? (
                        <span
                          className={cn(
                            "font-semibold",
                            Number(grade.noteExam) >= 10
                              ? "text-green-500"
                              : "text-red-500",
                          )}
                        >
                          {typeof grade.noteExam === "number"
                            ? grade.noteExam.toFixed(2)
                            : grade.noteExam}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "principal":
      case "rattrapage-result":
        const result =
          activeTab === "principal"
            ? gradesData.principalResult
            : gradesData.rattrapageResult;

        if (!result || (!result.moyenneGeneral && !result.decision)) {
          return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p>No results available for this session</p>
            </div>
          );
        }

        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                General Average
              </p>
              <p className="text-6xl font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">
                {result.moyenneGeneral || "N/A"}
              </p>
            </div>
            {result.decision && (
              <div
                className={cn(
                  "px-6 py-3 rounded-full font-semibold text-lg",
                  result.decision?.toLowerCase().includes("admis")
                    ? "bg-green-500/10 text-green-500 border border-green-500/20"
                    : "bg-red-500/10 text-red-500 border border-red-500/20",
                )}
              >
                {result.decision}
              </div>
            )}
          </div>
        );

      case "language":
        const languages = gradesData.languageLevels;

        if (!languages || (!languages.francais && !languages.anglais)) {
          return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p>No language levels available</p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-8">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-2xl">🇫🇷</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      French Level
                    </p>
                    <p className="text-4xl font-bold text-blue-500">
                      {languages.francais || "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                    <span className="text-2xl">🇬🇧</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      English Level
                    </p>
                    <p className="text-4xl font-bold text-red-500">
                      {languages.anglais || "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading grades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              Grades & Results
            </h1>
            <p className="text-muted-foreground mt-2">
              View your academic performance across all sessions
            </p>
          </div>
          <Button
            variant="outline"
            onClick={refreshGrades}
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
              Showing mock data. Login with the extension to see your real
              grades.
            </p>
          </div>
        )}

        {/* Tab Slider */}
        <div className="w-full overflow-x-auto pb-2">
          <div className="flex gap-2 min-w-max">
            {gradeTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 px-6 py-4 rounded-xl font-medium transition-all duration-300",
                    "border-2 min-w-[180px]",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                      : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isActive && "animate-pulse",
                    )}
                  />
                  <div className="text-left">
                    <p className="font-semibold whitespace-nowrap">
                      {tab.label}
                    </p>
                    <p
                      className={cn(
                        "text-xs whitespace-nowrap",
                        isActive
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {tab.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const tab = gradeTabs.find((t) => t.id === activeTab);
                const Icon = tab?.icon || BookOpen;
                return (
                  <>
                    <Icon className="h-5 w-5 text-primary" />
                    {tab?.label}
                  </>
                );
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent>{renderContent()}</CardContent>
        </Card>

        {/* Last Updated */}
        {gradesData?.lastFetched && !isUsingMockData && (
          <p className="text-sm text-muted-foreground text-center">
            Last updated: {new Date(gradesData.lastFetched).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
