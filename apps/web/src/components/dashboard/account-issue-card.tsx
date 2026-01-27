"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  School,
  Save,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Chrome extension types
declare const chrome: {
  runtime: {
    sendMessage: (
      extensionId: string,
      message: { action: string; className?: string },
      callback: (
        response: { success: boolean; data?: unknown; error?: string } | null,
      ) => void,
    ) => void;
    lastError?: { message: string };
  };
};

interface AccountIssueCardProps {
  issueType: "payment" | "admin" | "dossier";
  issueMessage?: string;
  onClassSet?: (className: string) => void;
}

const ISSUE_DETAILS = {
  payment: {
    title: "Payment Required",
    description:
      "Your tuition fees are pending. Please proceed with payment to access all features.",
    icon: "💳",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    borderColor: "border-yellow-200 dark:border-yellow-800",
  },
  admin: {
    title: "Administrative Issue",
    description:
      "Please contact the student services department to regularize your administrative situation.",
    icon: "📋",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
    borderColor: "border-orange-200 dark:border-orange-800",
  },
  dossier: {
    title: "Missing Documents",
    description:
      "You haven't submitted your physical dossier yet. Please submit your documents to the administration.",
    icon: "📁",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-200 dark:border-red-800",
  },
};

export function AccountIssueCard({
  issueType,
  issueMessage,
  onClassSet,
}: AccountIssueCardProps) {
  const [className, setClassName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const details = ISSUE_DETAILS[issueType];

  // Check if class was already set
  useEffect(() => {
    const storedUser = localStorage.getItem("esprit_user");
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        if (userData.className && userData.className !== "N/A") {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setClassName(userData.className);

          setSaved(true);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const handleSaveClass = async () => {
    if (!className.trim()) {
      setError("Please enter your class name");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const extensionId = localStorage.getItem("extensionId");

      if (extensionId && typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage(
          extensionId,
          { action: "SET_MANUAL_CLASS", className: className.trim() },
          (response) => {
            if (chrome.runtime.lastError || !response?.success) {
              // Still save to localStorage directly if extension fails
              const storedUser = localStorage.getItem("esprit_user");
              if (storedUser) {
                const userData = JSON.parse(storedUser);
                userData.className = className.trim();
                userData.manualClass = className.trim();
                localStorage.setItem("esprit_user", JSON.stringify(userData));
              }
            }

            // Update localStorage
            const storedUser = localStorage.getItem("esprit_user");
            if (storedUser) {
              const userData = JSON.parse(storedUser);
              userData.className = className.trim();
              userData.manualClass = className.trim();
              localStorage.setItem("esprit_user", JSON.stringify(userData));
            }

            setSaved(true);
            setIsSaving(false);
            onClassSet?.(className.trim());
          },
        );
      } else {
        // No extension - just save to localStorage
        const storedUser = localStorage.getItem("esprit_user");
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.className = className.trim();
          userData.manualClass = className.trim();
          localStorage.setItem("esprit_user", JSON.stringify(userData));
        }

        setSaved(true);
        setIsSaving(false);
        onClassSet?.(className.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save class");
      setIsSaving(false);
    }
  };

  return (
    <Card className={cn("border-2", details.borderColor, details.bgColor)}>
      <CardHeader className="pb-3">
        <CardTitle
          className={cn(
            "text-lg font-bold flex items-center gap-2",
            details.color,
          )}
        >
          <AlertTriangle className="h-5 w-5" />
          <span className="mr-1">{details.icon}</span>
          {details.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {issueMessage || details.description}
        </p>

        <div className="p-3 rounded-lg bg-background/50 border border-border">
          <p className="text-sm font-medium mb-2">
            ⚠️ Due to this issue, the following features are unavailable:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Grades & Results</li>
            <li>Credits History</li>
          </ul>
          <p className="text-sm font-medium mt-3">
            ✅ These features are still available:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Timetable (set your class below)</li>
            <li>Blackboard Integration</li>
            <li>Professor Ratings</li>
          </ul>
        </div>

        {/* Manual Class Entry */}
        <div className="space-y-3 pt-2">
          <Label htmlFor="className" className="flex items-center gap-2">
            <School className="h-4 w-4" />
            Set Your Class (for Timetable)
          </Label>
          <div className="flex gap-2">
            <Input
              id="className"
              placeholder="e.g., 4TWIN1, 3SE2, 5NIDS1"
              value={className}
              onChange={(e) => {
                setClassName(e.target.value);
                setSaved(false);
              }}
              disabled={isSaving}
              className="flex-1"
            />
            <Button
              onClick={handleSaveClass}
              disabled={isSaving || (saved && className.trim() !== "")}
              variant={saved ? "secondary" : "default"}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Enter your class code exactly as it appears (e.g., 4TWIN1, 3SE2).
            This is needed to display your timetable.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
