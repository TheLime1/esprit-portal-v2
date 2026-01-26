"use client";

import { Users } from "lucide-react";

export default function ClubsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-8">
      <div className="text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="p-6 rounded-full bg-primary/10">
            <Users className="w-16 h-16 text-primary" />
          </div>
        </div>

        {/* SOON text */}
        <h1 className="text-7xl md:text-9xl font-black tracking-tight text-foreground animate-pulse">
          SOON
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-muted-foreground max-w-md mx-auto">
          We&apos;re working on bringing you the best clubs experience at ESPRIT
        </p>

        {/* Decorative elements */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <span
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-purple-500 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-pink-500 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
