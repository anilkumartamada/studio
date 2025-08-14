import { Ban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BlockedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Ban className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="mt-4 text-2xl">Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You are blocked from this application due to a violation of our terms of service. If you believe this is a mistake, please contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
