import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex items-center gap-2 mb-8">
        <Sparkles className="h-8 w-8 text-primary" />
        <h1 className="text-4xl font-bold text-primary">Connectile</h1>
      </div>
      <div className="w-full max-w-sm">
        {children}
      </div>
    </main>
  );
}
