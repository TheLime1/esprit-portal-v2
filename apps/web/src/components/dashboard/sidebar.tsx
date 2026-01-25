"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Calendar,
  Users,
  PartyPopper,
  Briefcase,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: GraduationCap, label: "Grades", href: "/dashboard/grades" },
  { icon: Calendar, label: "Schedule", href: "/dashboard/schedule" },
  { icon: BookOpen, label: "Courses", href: "/dashboard/courses" },
  { icon: Users, label: "Clubs", href: "#" },
  { icon: PartyPopper, label: "Events", href: "#" },
  { icon: Briefcase, label: "Internships", href: "/dashboard/internships" },
];

interface SidebarProps {
  userName: string;
  className: string;
}

export function Sidebar({ userName, className }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  // Generate initials from user name
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = () => {
    localStorage.removeItem("esprit_user");
    window.location.href = "/";
  };

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col justify-between h-full shrink-0 z-20 shadow-sm hidden md:flex">
      <div className="p-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <Image
            src="/logo_school.png"
            alt="Esprit Portal Logo"
            width={48}
            height={48}
            className="w-10 h-10 rounded-lg"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Esprit Portal v2
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              by ESPRIT@ds
            </p>
          </div>
        </div>
        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href) && item.href !== "#";

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn("h-5 w-5", isActive && "fill-primary/20")}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Section */}
      <div className="p-6 border-t border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-foreground truncate">
              {userName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {className}
            </p>
          </div>
        </div>

        {/* Theme Toggle & Logout Row */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors py-2 px-3 rounded-lg hover:bg-muted"
            title={
              theme === "light" ? "Switch to dark mode" : "Switch to light mode"
            }
          >
            {theme === "light" ? (
              <>
                <Moon className="h-4 w-4" />
                Dark
              </>
            ) : (
              <>
                <Sun className="h-4 w-4" />
                Light
              </>
            )}
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-border" />

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors py-2 px-3 rounded-lg hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </div>
    </aside>
  );
}
