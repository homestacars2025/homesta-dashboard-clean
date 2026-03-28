"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, CalendarDays } from "lucide-react"

const MOCK_INVESTORS = ["ALFAHD GROUP", "HOMESTA INVEST", "TEST INVESTOR"]

const MOCK_MONTHS = ["2026-01", "2026-02", "2026-03"]

export default function InvestorDashboard() {
  const router = useRouter()
  const [selectedInvestor, setSelectedInvestor] = useState<string>("")
  const [selectedMonth, setSelectedMonth] = useState<string>("")

  const handleViewReport = () => {
    if (selectedInvestor && selectedMonth) {
      router.push(`/investor-dashboard/report?investor=${encodeURIComponent(selectedInvestor)}&month=${selectedMonth}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-bold text-slate-800">لوحة التحكم المالية للمستثمرين</CardTitle>
          <p className="text-sm text-slate-600 mt-2">اختر المستثمر والشهر لعرض التقرير المالي</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              اسم المستثمر
            </label>
            <Select value={selectedInvestor} onValueChange={setSelectedInvestor}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="اختر المستثمر" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_INVESTORS.map((investor) => (
                  <SelectItem key={investor} value={investor}>
                    {investor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              الشهر
            </label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="اختر الشهر" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_MONTHS.map((month) => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleViewReport}
            disabled={!selectedInvestor || !selectedMonth}
            className="w-full h-12 text-base"
          >
            عرض التقرير
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
