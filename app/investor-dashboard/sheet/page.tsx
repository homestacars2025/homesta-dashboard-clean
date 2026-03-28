"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight } from "lucide-react"

// Mock transaction data
const MOCK_TRANSACTIONS = [
  {
    date: "2026-01-05",
    car: "Renault Clio",
    type: "دخول",
    category: "إيجار",
    amount: 5000,
    description: "إيجار شهري",
  },
  {
    date: "2026-01-10",
    car: "Toyota Corolla",
    type: "خروج",
    category: "بنزين",
    amount: 500,
    description: "تعبئة وقود",
  },
  {
    date: "2026-01-15",
    car: "Hyundai Accent",
    type: "دخول",
    category: "إيجار",
    amount: 4500,
    description: "إيجار نصف شهري",
  },
  {
    date: "2026-01-20",
    car: "Renault Clio",
    type: "خروج",
    category: "صيانة",
    amount: 1200,
    description: "صيانة دورية",
  },
  {
    date: "2026-01-25",
    car: "Toyota Corolla",
    type: "خروج",
    category: "تغيير زيت",
    amount: 300,
    description: "تغيير زيت المحرك",
  },
]

const SHEET_NAMES: Record<string, string> = {
  cars: "شيت السيارات",
  "buy-sell": "شيت بيع / شراء",
  "company-expenses": "شيت مصاريف الشركة",
  "personal-expenses": "شيت مصاريف شخصية",
}

export default function SheetView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const investor = searchParams.get("investor")
  const month = searchParams.get("month")
  const type = searchParams.get("type") || "cars"

  const sheetName = SHEET_NAMES[type] || "شيت"

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <div>
                  <CardTitle className="text-2xl">{sheetName}</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    {investor} - {month}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    {type === "cars" && <TableHead className="text-right">السيارة</TableHead>}
                    <TableHead className="text-right">نوع العملية</TableHead>
                    <TableHead className="text-right">التصنيف</TableHead>
                    <TableHead className="text-right">القيمة</TableHead>
                    <TableHead className="text-right">التوضيح</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_TRANSACTIONS.map((transaction, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-right">{transaction.date}</TableCell>
                      {type === "cars" && <TableCell className="text-right">{transaction.car}</TableCell>}
                      <TableCell className="text-right">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            transaction.type === "دخول" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}
                        >
                          {transaction.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{transaction.category}</TableCell>
                      <TableCell className="text-right font-medium">
                        {transaction.amount.toLocaleString()} ر.س
                      </TableCell>
                      <TableCell className="text-right text-slate-600">{transaction.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
