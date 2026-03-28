import { DashboardLayout } from "@/components/dashboard-layout"
import type React from "react"

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}
