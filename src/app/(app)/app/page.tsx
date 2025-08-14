// This will be the main video calling page.
// For now, it's a placeholder. The WebRTC logic will be implemented in a future step.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";

export default function AppPage() {
  return (
    <div className="flex h-full items-center justify-center">
       <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Connect with Strangers</CardTitle>
          <CardDescription>Click the button below to start a random video call.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex justify-center">
                <div className="relative">
                    <div className="absolute -inset-0.5 animate-pulse rounded-full bg-gradient-to-r from-primary via-accent to-secondary opacity-75 blur"></div>
                    <Button size="lg" className="relative h-24 w-24 rounded-full">
                        <Video className="h-12 w-12" />
                    </Button>
                </div>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
                You will be connected with a random person for a video and text chat. Please be respectful.
            </p>
        </CardContent>
       </Card>
    </div>
  );
}
