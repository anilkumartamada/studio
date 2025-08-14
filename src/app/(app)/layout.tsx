import AppLayoutClient from "@/components/layout/AppLayoutClient";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
