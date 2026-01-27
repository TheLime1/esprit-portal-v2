"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard";

interface UserData {
  name: string;
  className: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for user data in localStorage
    const storedUser = localStorage.getItem("esprit_user");
    if (storedUser) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUserData(JSON.parse(storedUser));
      } catch {
        router.push("/");
        return;
      }
    } else {
      router.push("/");
      return;
    }

    setIsLoading(false);
  }, [router]);

  if (isLoading || !userData) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground h-screen overflow-hidden flex">
      {/* Sidebar */}
      <Sidebar userName={userData.name} className={userData.className} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
