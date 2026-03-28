"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Car,
  Wrench,
  Fuel,
  Droplet,
  Plus,
  ShoppingCart,
  Building,
  User,
} from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

// Mock data
const MOCK_SUMMARY = {
  totalIncome: 125000,
  carIncome: 95000,
  totalExpenses: 45000,
  netProfit: 80000,
  maintenanceExpenses: 15000,
  fuelExpenses: 12000,
  oilChangeExpenses: 5000,
}

const INCOME_VS_EXPENSES = [
  { name: "الدخل", value: 125000, color: "#10b981" },
  { name: "المصاريف", value: 45000, color: "#ef4444" },
]

const DAILY_PROFIT = [
  { day: "1", profit: 2500 },
  { day: "5", profit: 3200 },
  { day: "10", profit: 2800 },
  { day: "15", profit: 4100 },
  { day: "20", profit: 3500 },
  { day: "25", profit: 3900 },
  { day: "30", profit: 4200 },
]

export default function MonthlyReport() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const investor = searchParams.get("investor")
  const month = searchParams.get("month")

  const navigateToSheet = (sheetType: string) => {
    router.push(
      `/investor-dashboard/sheet?investor=${encodeURIComponent(investor || "")}&month=${month}&type=${sheetType}`,
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{investor}</h1>
            <p className="text-slate-600 mt-1">التقرير الشهري - {month}</p>
          </div>
          <Button
            onClick={() =>
              router.push(
                `/investor-dashboard/add-transaction?investor=${encodeURIComponent(investor || "")}&month=${month}`,
              )
            }
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            إضافة عملية
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">إجمالي الدخل</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{MOCK_SUMMARY.totalIncome.toLocaleString()} ر.س</div>
              <TrendingUp className="h-5 w-5 mt-2 opacity-80" />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">دخل السيارات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{MOCK_SUMMARY.carIncome.toLocaleString()} ر.س</div>
              <Car className="h-5 w-5 mt-2 opacity-80" />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">إجمالي المصاريف</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{MOCK_SUMMARY.totalExpenses.toLocaleString()} ر.س</div>
              <TrendingDown className="h-5 w-5 mt-2 opacity-80" />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90">صافي الربح</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{MOCK_SUMMARY.netProfit.toLocaleString()} ر.س</div>
              <DollarSign className="h-5 w-5 mt-2 opacity-80" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">مصاريف الصيانة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">
                {MOCK_SUMMARY.maintenanceExpenses.toLocaleString()} ر.س
              </div>
              <Wrench className="h-4 w-4 mt-2 text-slate-500" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">مصاريف البنزين</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{MOCK_SUMMARY.fuelExpenses.toLocaleString()} ر.س</div>
              <Fuel className="h-4 w-4 mt-2 text-slate-500" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">تغيير الزيت</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">
                {MOCK_SUMMARY.oilChangeExpenses.toLocaleString()} ر.س
              </div>
              <Droplet className="h-4 w-4 mt-2 text-slate-500" />
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>الدخل مقابل المصاريف</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={INCOME_VS_EXPENSES}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value.toLocaleString()}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {INCOME_VS_EXPENSES.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>تطور الربح خلال الشهر</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={DAILY_PROFIT}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="profit" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Sheet Navigation */}
        <Card>
          <CardHeader>
            <CardTitle>الأوراق المالية</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button onClick={() => navigateToSheet("cars")} variant="outline" className="h-24 flex flex-col gap-2">
              <Car className="h-8 w-8" />
              <span>شيت السيارات</span>
            </Button>
            <Button onClick={() => navigateToSheet("buy-sell")} variant="outline" className="h-24 flex flex-col gap-2">
              <ShoppingCart className="h-8 w-8" />
              <span>شيت بيع / شراء</span>
            </Button>
            <Button
              onClick={() => navigateToSheet("company-expenses")}
              variant="outline"
              className="h-24 flex flex-col gap-2"
            >
              <Building className="h-8 w-8" />
              <span>شيت مصاريف الشركة</span>
            </Button>
            <Button
              onClick={() => navigateToSheet("personal-expenses")}
              variant="outline"
              className="h-24 flex flex-col gap-2"
            >
              <User className="h-8 w-8" />
              <span>شيت مصاريف شخصية</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
