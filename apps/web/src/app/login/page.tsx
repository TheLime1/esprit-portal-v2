"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Check if cached data is stale (older than 4 hours)
function isDataStale(timestamp: string | undefined): boolean {
  if (!timestamp) return true;
  const fetchedTime = new Date(timestamp).getTime();
  const now = Date.now();
  const hoursDiff = (now - fetchedTime) / (1000 * 60 * 60);
  return hoursDiff >= 4;
}

export default function LoginPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            // Update localStorage with fresh data
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

  // Check for existing login on mount - instant redirect if data exists
  useEffect(() => {
    const existingUser = localStorage.getItem("esprit_user");
    const existingData = localStorage.getItem("esprit_student_data");

    if (existingUser && existingData) {
      try {
        const userData = JSON.parse(existingUser);
        const studentData = JSON.parse(existingData);

        // User is logged in - redirect immediately to dashboard
        if (userData.id && userData.name) {
          console.log("✅ User already logged in, redirecting to dashboard...");

          // Check if data is stale and trigger background refresh
          const lastFetched =
            studentData.lastFetched || studentData.cacheTimestamp;
          if (isDataStale(lastFetched)) {
            console.log("📊 Data is stale, will refresh in background...");
            triggerBackgroundRefresh();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckingAuth(false);
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Get extension ID from environment or localStorage
      let extensionId: string | undefined =
        process.env.NEXT_PUBLIC_EXTENSION_ID;

      if (globalThis.window !== undefined) {
        extensionId =
          extensionId || localStorage.getItem("extensionId") || undefined;
      }

      // If no extension ID is set, prompt the user
      if (!extensionId || extensionId === "YOUR_EXTENSION_ID") {
        const userInput = prompt(
          "Please enter your Extension ID:\n\n" +
            "1. Go to chrome://extensions\n" +
            "2. Enable Developer Mode\n" +
            "3. Find 'Esprit Extension'\n" +
            "4. Copy the ID (under the extension name)\n\n" +
            "Extension ID:",
        );

        if (!userInput) {
          setError("Extension ID is required");
          setLoading(false);
          return;
        }

        extensionId = userInput;
        localStorage.setItem("extensionId", extensionId);
      }

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
              // Clear invalid extension ID
              localStorage.removeItem("extensionId");
              setLoading(false);
              return;
            }

            if (response.success) {
              setResult(response.data);
              setError(null);

              // IMPORTANT: Save the extensionId so other pages can communicate with extension
              if (extensionId) {
                localStorage.setItem("extensionId", extensionId);
                console.log("✅ extensionId saved:", extensionId);
              }

              // Store data in localStorage for dashboard pages
              if (response.data) {
                // Store student data
                const userData = {
                  id: response.data.id,
                  name: response.data.name,
                  className: response.data.className,
                };
                localStorage.setItem("esprit_user", JSON.stringify(userData));
                console.log("✅ esprit_user saved:", userData);

                // Store grades
                if (response.data.allGrades) {
                  localStorage.setItem(
                    "esprit_grades",
                    JSON.stringify(response.data.allGrades),
                  );
                  console.log("✅ esprit_grades saved");
                }

                // Store credits
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

                // Store full student data
                localStorage.setItem(
                  "esprit_student_data",
                  JSON.stringify(response.data),
                );
                console.log("✅ esprit_student_data saved");

                // Redirect to dashboard immediately after successful login
                console.log("✅ Login successful, redirecting to dashboard...");
                router.push("/dashboard");
              }
            } else {
              setError(response.error || "Login failed");
            }
            setLoading(false);
          },
        );
      } else {
        setError(
          "Chrome extension API not available. Please use Chrome or Edge browser.",
        );
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  // Show loading while checking if user is already logged in
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking login status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 bg-card">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Esprit Portal
          </h1>
          <p className="text-foreground/60">Login with your credentials</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
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
              required
              className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your student ID"
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
              required
              className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading ? "Logging in..." : "Login via Extension"}
          </Button>
        </form>

        {error && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <h3 className="font-semibold text-green-500 mb-2">
              Login Successful!
            </h3>
            <div className="text-sm text-foreground/80">
              <p>Data saved to database</p>
              <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto max-h-64">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="mt-6 text-sm text-foreground/60 text-center">
          <p>Make sure the Esprit Portal extension is installed and enabled</p>
        </div>
      </Card>
    </div>
  );
}
