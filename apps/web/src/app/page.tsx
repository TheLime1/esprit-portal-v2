"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn, Loader2, AlertTriangle } from "lucide-react";

// Check if cached data is stale (older than 4 hours)
function isDataStale(timestamp: string | undefined): boolean {
  if (!timestamp) return true;
  const fetchedTime = new Date(timestamp).getTime();
  const now = Date.now();
  const hoursDiff = (now - fetchedTime) / (1000 * 60 * 60);
  return hoursDiff >= 4;
}

// Check if extension is installed
async function checkExtensionInstalled(): Promise<boolean> {
  const extensionId = "ecoohmcojdcogincjmomppjjhddlfcjj";

  if (typeof chrome === "undefined" || !chrome.runtime) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        extensionId,
        { action: "PING" },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve(false);
          } else {
            resolve(true);
          }
        },
      );
      // Timeout after 2 seconds
      setTimeout(() => resolve(false), 2000);
    } catch {
      resolve(false);
    }
  });
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(
    null,
  );

  // Trigger background refresh via extension
  const triggerBackgroundRefresh = () => {
    const extensionId = localStorage.getItem("extensionId");
    if (extensionId && typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage(
        extensionId,
        { action: "BACKGROUND_REFRESH" },
        (
          response:
            | { success?: boolean; data?: Record<string, unknown> }
            | undefined,
        ) => {
          if (chrome.runtime.lastError) {
            console.log("Background refresh failed:", chrome.runtime.lastError);
            return;
          }
          if (response?.success && response.data) {
            localStorage.setItem(
              "esprit_user",
              JSON.stringify({
                id: response.data.id,
                name: response.data.name,
                className: response.data.className,
              }),
            );
            localStorage.setItem(
              "esprit_student_data",
              JSON.stringify(response.data),
            );
            console.log("✅ Background refresh completed");
          }
        },
      );
    }
  };

  // Check for existing login on mount and detect extension
  useEffect(() => {
    const checkAuth = async () => {
      // Check if extension is installed
      const installed = await checkExtensionInstalled();
      setExtensionInstalled(installed);
      console.log("🔌 Extension installed:", installed);

      const existingUser = localStorage.getItem("esprit_user");
      const existingData = localStorage.getItem("esprit_student_data");

      if (existingUser && existingData) {
        try {
          const userData = JSON.parse(existingUser);

          if (userData.name) {
            console.log(
              "✅ User already logged in, redirecting to dashboard...",
            );

            try {
              const studentData = JSON.parse(existingData);
              const lastFetched =
                studentData.lastFetched || studentData.cacheTimestamp;
              if (isDataStale(lastFetched)) {
                console.log("📊 Data is stale, will refresh in background...");
                triggerBackgroundRefresh();
              }
            } catch {
              // Ignore parse errors
            }

            router.replace("/dashboard");
            return;
          }
        } catch {
          console.log("Invalid stored data, clearing...");
          localStorage.removeItem("esprit_user");
          localStorage.removeItem("esprit_student_data");
        }
      }
      setCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Checking login status...</p>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentId || !password) {
      setError("Please enter your student ID and password");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Hardcoded extension ID
      const extensionId = "ecoohmcojdcogincjmomppjjhddlfcjj";

      // Send message to extension
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage(
          extensionId,
          {
            action: "LOGIN",
            credentials: {
              id: studentId,
              password: password,
            },
          },
          (response) => {
            if (chrome.runtime.lastError) {
              setError(
                "Extension not found. Please install the Esprit Portal extension.\n" +
                  "Error: " +
                  chrome.runtime.lastError.message,
              );
              localStorage.removeItem("extensionId");
              setIsLoading(false);
              return;
            }

            if (response?.success && response.data) {
              console.log("✅ Login response data:", response.data);

              localStorage.setItem("extensionId", extensionId);
              console.log("✅ extensionId saved:", extensionId);

              // Check if this is an account with issues
              if (response.accountIssue) {
                console.log(
                  "⚠️ Account issue detected:",
                  response.accountIssue,
                );

                const userData = {
                  id: response.data.id || studentId,
                  name: null,
                  className: null,
                  accountIssue: response.accountIssue,
                  accountIssueMessage: response.accountIssueMessage,
                };
                localStorage.setItem("esprit_user", JSON.stringify(userData));
                router.push("/dashboard");
                setIsLoading(false);
                return;
              }

              // Store user data
              const userData = {
                id: response.data.id || studentId,
                name: response.data.name || "Unknown",
                className: response.data.className || "N/A",
              };
              localStorage.setItem("esprit_user", JSON.stringify(userData));
              console.log("✅ esprit_user saved:", userData);

              localStorage.setItem(
                "esprit_student_data",
                JSON.stringify(response.data),
              );
              console.log("✅ esprit_student_data saved");

              if (response.data.allGrades) {
                localStorage.setItem(
                  "esprit_grades",
                  JSON.stringify(response.data.allGrades),
                );
                console.log("✅ esprit_grades saved");
              }

              if (response.data.credits) {
                localStorage.setItem(
                  "esprit_credits",
                  JSON.stringify(response.data.credits),
                );
                console.log(
                  "✅ esprit_credits saved:",
                  response.data.credits.length,
                  "credits",
                );
              }

              router.push("/dashboard");
              setIsLoading(false);
            } else {
              setError(response?.error || "Login failed");
              setIsLoading(false);
            }
          },
        );
      } else {
        setError(
          "Chrome extension API not available. Please use Chrome or Edge browser.",
        );
        setIsLoading(false);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect to extension",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image
              src="/logo_school.png"
              alt="Esprit Portal Logo"
              width={80}
              height={80}
              className="rounded-xl"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              Esprit Portal v2
            </CardTitle>
            <CardDescription className="text-base mt-1">
              by ESPRIT@ds
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {extensionInstalled === false && (
            <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-sm p-3 rounded-lg border border-yellow-500/20 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Extension not detected</p>
                <p className="text-xs mt-1 opacity-80">
                  Please install the ESPRIT@ds browser extension to use this
                  portal.{" "}
                  <a
                    href="https://chromewebstore.google.com/detail/espritds/ecoohmcojdcogincjmomppjjhddlfcjj"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-100"
                  >
                    Install Extension
                  </a>
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label
                htmlFor="studentId"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Student ID
              </label>
              <input
                id="studentId"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter your student ID"
                required
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter your password"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full font-semibold"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  Login
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Make sure the ESPRIT@ds browser extension is installed and enabled.
          </p>

          <p className="text-[10px] text-center text-muted-foreground/60 mt-2">
            By logging in, you agree to our{" "}
            <a
              href="https://www.espritads.site/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-muted-foreground"
            >
              Privacy Policy
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
