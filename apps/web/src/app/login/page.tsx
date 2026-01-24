"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Check if extension is installed
      const extensionId = "YOUR_EXTENSION_ID"; // Will be replaced after building the extension

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
                "Extension not found. Please install the Esprit Portal extension.",
              );
              setLoading(false);
              return;
            }

            if (response.success) {
              setResult(response.data);
              setError(null);
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
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

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
