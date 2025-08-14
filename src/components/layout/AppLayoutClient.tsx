"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Sparkles,
  Video,
} from "lucide-react";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";

export default function AppLayoutClient({ children }: { children: ReactNode }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
        return;
      }
      if (userData?.status === "blocked") {
        router.replace("/blocked");
        return;
      }
      if (userData?.role === "user" && pathname.startsWith("/admin")) {
        router.replace("/app");
        return;
      }
      if (userData?.role === "admin" && !pathname.startsWith("/admin")) {
        router.replace("/admin");
      }
    }
  }, [user, userData, loading, router, pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !userData) {
    return null; // or a login redirect, though useEffect handles it
  }

  const navItems = [
    {
      href: "/app",
      icon: Video,
      label: "Video Chat",
      admin: false,
    },
    {
      href: "/history",
      icon: History,
      label: "Call History",
      admin: false,
    },
    {
      href: "/admin",
      icon: LayoutDashboard,
      label: "Admin Dashboard",
      admin: true,
    },
  ];

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">Connectile</h2>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map(
              (item) =>
                (userData.role === "admin" ? true : !item.admin) && (
                  <SidebarMenuItem key={item.href}>
                    <Link href={item.href} className="w-full">
                      <SidebarMenuButton
                        isActive={pathname === item.href}
                        className="w-full"
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                )
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex w-full items-center justify-start gap-2 p-2"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {userData.email?.[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{userData.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {userData.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {userData.role}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="w-full flex-1">
            <h1 className="text-lg font-semibold md:text-xl">
              {
                navItems.find((item) => item.href === pathname)?.label
              }
            </h1>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
