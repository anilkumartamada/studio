import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { History as HistoryIcon } from "lucide-react";

export default function HistoryPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Call History</CardTitle>
        <CardDescription>
          Review your past conversations and report any issues.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <HistoryIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold">No Call History</h3>
          <p className="text-muted-foreground">
            Your past calls will appear here once you've had a conversation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
