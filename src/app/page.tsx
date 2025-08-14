"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading, userData } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else {
        if (userData?.status === "blocked") {
          router.replace("/blocked");
        } else if (userData?.role === "admin") {
          router.replace("/admin");
        } else {
          router.replace("/app");
        }
      }
    }
  }, [user, loading, userData, router]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
