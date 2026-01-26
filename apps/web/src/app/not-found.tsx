"use client";

import Link from "next/link";
import { Home, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="text-center space-y-8 max-w-2xl">
        {/* 404 Number */}
        <div className="relative">
          <h1 className="text-[12rem] md:text-[16rem] font-black leading-none tracking-tighter text-foreground select-none">
            404
          </h1>
          {/* Glowing effect */}
          <div className="absolute inset-0 text-[12rem] md:text-[16rem] font-black leading-none tracking-tighter text-foreground blur-2xl opacity-30 -z-10">
            404
          </div>
        </div>

        {/* Message */}
        <div className="space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Oops! Page not found
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Looks like you wandered into uncharted territory. This page
            doesn&apos;t exist or has been moved.
          </p>
        </div>

        {/* Search icon animation */}
        <div className="flex justify-center">
          <div className="relative">
            <Search className="w-16 h-16 text-muted-foreground/30 animate-pulse" />
            <span className="absolute -top-1 -right-1 text-2xl">❓</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
          <button
            onClick={() =>
              typeof window !== "undefined" && window.history.back()
            }
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border bg-card text-foreground font-semibold hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>

        {/* Fun decorative dots */}
        <div className="flex items-center justify-center gap-3 pt-8">
          <span
            className="w-3 h-3 rounded-full bg-primary/60 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-3 h-3 rounded-full bg-purple-500/60 animate-bounce"
            style={{ animationDelay: "100ms" }}
          />
          <span
            className="w-3 h-3 rounded-full bg-pink-500/60 animate-bounce"
            style={{ animationDelay: "200ms" }}
          />
          <span
            className="w-3 h-3 rounded-full bg-orange-500/60 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
