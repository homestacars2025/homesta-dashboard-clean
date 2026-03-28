import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <CardTitle>Account Pending Approval</CardTitle>
              <CardDescription>Your registration has been received</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium">
              Your account is inactive. An administrator must activate your account.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              An administrator will review your registration and complete your profile setup. Once approved, you'll be
              able to log in and access the dashboard.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-4 border-t">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Approval typically takes 1-2 business days</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button asChild className="flex-1">
              <Link href="/login">Back to Login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
