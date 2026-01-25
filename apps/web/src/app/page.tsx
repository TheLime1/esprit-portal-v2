"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn, Eye } from "lucide-react";

declare global {
  interface Window {
    chrome?: typeof chrome;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);

  const handleExtensionLogin = async () => {
    if (!showCredentials) {
      setShowCredentials(true);
      return;
    }

    if (!studentId || !password) {
      setError("Please enter your student ID and password");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get extension ID from environment or localStorage
      let extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;

      if (typeof window !== "undefined") {
        extensionId = extensionId || localStorage.getItem("extensionId") || undefined;
      }

      // If no extension ID is set, prompt the user
      if (!extensionId || extensionId === "YOUR_EXTENSION_ID") {
        const userInput = prompt(
          "Please enter your Extension ID:\n\n" +
          "1. Go to chrome://extensions\n" +
          "2. Enable Developer Mode\n" +
          "3. Find 'Esprit Extension'\n" +
          "4. Copy the ID (under the extension name)\n\n" +
          "Extension ID:"
        );

        if (!userInput) {
          setError("Extension ID is required");
          setIsLoading(false);
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
                "Error: " + chrome.runtime.lastError.message
              );
              // Clear invalid extension ID
              localStorage.removeItem("extensionId");
              setIsLoading(false);
              return;
            }

            if (response?.success && response.data) {
              console.log("Login response data:", response.data);

              // Store user data in localStorage for the dashboard
              localStorage.setItem(
                "esprit_user",
                JSON.stringify({
                  name: response.data.name || "Unknown",
                  className: response.data.className || "N/A",
                })
              );

              // Store the full student data (includes grades)
              localStorage.setItem("esprit_student_data", JSON.stringify(response.data));

              // Store allGrades directly from response (returned by login)
              if (response.data.allGrades) {
                localStorage.setItem("esprit_grades", JSON.stringify(response.data.allGrades));
                console.log("Grades stored in localStorage:", response.data.allGrades);
              }

              // Navigate to dashboard
              router.push("/dashboard");
              setIsLoading(false);
            } else {
              setError(response?.error || "Login failed");
              setIsLoading(false);
            }
          }
        );
      } else {
        setError(
          "Chrome extension API not available. Please use Chrome or Edge browser."
        );
        setIsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to extension");
      setIsLoading(false);
    }
  };

  const handleViewMockup = () => {
    // Set mock data
    localStorage.setItem(
      "esprit_user",
      JSON.stringify({
        name: "Alex Morgan",
        className: "Computer Science - 3A",
      })
    );
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image
              src="/logo_square.svg"
              alt="Esprit Portal Logo"
              width={80}
              height={80}
              className="rounded-xl"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Esprit Portal v2</CardTitle>
            <CardDescription className="text-base mt-1">
              by ESPRIT@ds
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          {showCredentials && (
            <div className="space-y-3">
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
                />
              </div>
            </div>
          )}

          <Button
            onClick={handleExtensionLogin}
            className="w-full font-semibold"
            size="lg"
            disabled={isLoading}
          >
            <LogIn className="h-5 w-5 mr-2" />
            {isLoading
              ? "Logging in..."
              : showCredentials
                ? "Login"
                : "Login with Extension"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            onClick={handleViewMockup}
            variant="outline"
            className="w-full font-semibold"
            size="lg"
          >
            <Eye className="h-5 w-5 mr-2" />
            View Dashboard with Mock Data
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Make sure the ESPRIT@ds browser extension is installed and enabled to use the login feature.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
