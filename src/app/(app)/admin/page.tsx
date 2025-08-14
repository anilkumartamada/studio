import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function AdminPage() {
  // In a real app, this would fetch reports from Firestore
  const reports: any[] = [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Dashboard</CardTitle>
        <CardDescription>
          Review user reports and take moderation actions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">No Reports</h3>
            <p className="text-muted-foreground">
              User reports will appear here when they are submitted.
            </p>
          </div>
        ) : (
          <div>
            {/* Table of reports would go here */}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
