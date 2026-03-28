"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Car,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Fuel,
  Droplets,
  Sparkles,
  Wrench,
  Building2,
  User,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Trophy,
  Medal,
  Award,
  PieChart,
  BarChart3,
} from "lucide-react"
import { getFinancialSummary, getTopCarsForMonth, getExpenseBreakdown } from "@/lib/financial-service"
import { format, addMonths, subMonths } from "date-fns"
import { useCurrency } from "@/lib/currency-context"

export default function ReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { formatMoney } = useCurrency()

  const { investorId, investorName, initialMonth } = useMemo(
    () => ({
      investorId: searchParams.get("investor_id") || "",
      investorName: searchParams.get("investor") || "",
      initialMonth: searchParams.get("month") || format(new Date(), "yyyy-MM"),
    }),
    [searchParams],
  )

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const [year, month] = initialMonth.split("-").map(Number)
    return new Date(year, month - 1, 1)
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    carIncome: 0,
    totalCarsRentIncome: 0,
    maintenance: 0,
    fuel: 0,
    oilChange: 0,
    buySell: 0,
    companyExpenses: 0,
    personalExpenses: 0,
    petrolExpenses: 0,
    oilExpenses: 0,
    washingExpenses: 0,
    maintenanceExpenses: 0,
  })

  const [topCars, setTopCars] = useState<
    Array<{
      id: number
      name: string
      plateNumber: string
      income: number
      expenses: number
      netIncome: number
      bookings: number
    }>
  >([])

  const [expenseBreakdown, setExpenseBreakdown] = useState<
    Array<{
      category: string
      amount: number
    }>
  >([])

  useEffect(() => {
    if (!investorId) {
      setLoading(false)
      setError("Missing required parameter: investor_id")
      return
    }

    loadSummary()
  }, [investorId, currentMonth])

  async function loadSummary() {
    setLoading(true)
    setError(null)

    try {
      const year = currentMonth.getFullYear()
      const monthNum = currentMonth.getMonth()
      const dateFrom = format(new Date(year, monthNum, 1), "yyyy-MM-dd")
      const dateTo = format(new Date(year, monthNum + 1, 0), "yyyy-MM-dd")

      const [summaryData, carsData, expensesData] = await Promise.all([
        getFinancialSummary(investorId, dateFrom, dateTo),
        getTopCarsForMonth(investorId, dateFrom, dateTo),
        getExpenseBreakdown(investorId, dateFrom, dateTo),
      ])

      setSummary(summaryData)
      setTopCars(carsData)
      setExpenseBreakdown(expensesData)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load financial data"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prevMonth) => (direction === "prev" ? subMonths(prevMonth, 1) : addMonths(prevMonth, 1)))
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-center text-slate-800">Error Loading Report</h2>
            <p className="text-slate-600 text-center">{error}</p>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => window.location.reload()}
                className="flex-1 bg-[#4AA3FF] hover:bg-[#3A8FE0] text-white font-semibold rounded-xl h-12"
              >
                Retry
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-12 bg-transparent"
                onClick={() => router.push("/accounting")}
              >
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4AA3FF] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading financial data...</p>
        </div>
      </div>
    )
  }

  const isPositive = summary.netProfit >= 0

  const totalExpensesAmount = expenseBreakdown.reduce((sum, item) => sum + item.amount, 0)
  const topExpense = expenseBreakdown[0]

  const rankIcons = [
    <Trophy key="1" className="h-5 w-5 text-yellow-500" />,
    <Medal key="2" className="h-5 w-5 text-slate-400" />,
    <Award key="3" className="h-5 w-5 text-amber-600" />,
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-slate-100"
                onClick={() => router.push("/accounting")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Investor Summary</h1>
                <p className="text-slate-500 text-sm">{investorName}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="rounded-xl bg-transparent"
              onClick={() =>
                router.push(
                  `/accounting/sheet/all?investor_id=${investorId}&investor=${encodeURIComponent(investorName)}&month=${format(currentMonth, "yyyy-MM")}`,
                )
              }
            >
              View All Sheets
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Month Navigation */}
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth("prev")}
              className="rounded-xl hover:bg-slate-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="px-6 py-2 min-w-[180px] text-center">
              <span className="text-xl font-semibold text-slate-800">{format(currentMonth, "MMMM yyyy")}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth("next")}
              className="rounded-xl hover:bg-slate-100"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Main Overview Card */}
        <Card
          className={`border-0 shadow-lg overflow-hidden ${isPositive ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-rose-500 to-red-600"}`}
        >
          <CardContent className="p-8">
            <div className="flex items-center justify-between text-white">
              <div>
                <p className="text-white/80 text-sm font-medium mb-1">Net Profit / Loss</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold">
                    {formatMoney(summary.netProfit, { showSign: true })}
                  </span>
                  <span
                    className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full ${isPositive ? "bg-white/20" : "bg-white/20"}`}
                  >
                    {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {isPositive ? "Profit" : "Loss"}
                  </span>
                </div>
              </div>
              <div className="text-right space-y-2">
                <div>
                  <p className="text-white/60 text-xs">Total Income</p>
                  <p className="text-xl font-semibold">{formatMoney(summary.totalIncome)}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs">Total Expenses</p>
                  <p className="text-xl font-semibold">{formatMoney(summary.totalExpenses)}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs">Total Cars Rent Income</p>
                  <p className="text-xl font-semibold">{formatMoney(summary.totalCarsRentIncome)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operations Overview */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-slate-800">Operations Overview</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Car Purchase & Sale */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-indigo-600" />
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${summary.buySell >= 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"}`}
                  >
                    {summary.buySell >= 0 ? (
                      <TrendingUp className="h-3 w-3 inline mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 inline mr-1" />
                    )}
                    {summary.buySell >= 0 ? "Gain" : "Loss"}
                  </span>
                </div>
                <p className="text-slate-500 text-xs mb-1">Car Purchase & Sale</p>
                <p className="text-xl font-bold text-slate-800">{formatMoney(Math.abs(summary.buySell))}</p>
              </CardContent>
            </Card>

            {/* Company Expenses */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-orange-600" />
                  </div>
                  <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-full">Expense</span>
                </div>
                <p className="text-slate-500 text-xs mb-1">Company Expenses</p>
                <p className="text-xl font-bold text-slate-800">{formatMoney(summary.companyExpenses)}</p>
              </CardContent>
            </Card>

            {/* Personal Expenses */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-red-600" />
                  </div>
                  <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-full">Expense</span>
                </div>
                <p className="text-slate-500 text-xs mb-1">Personal Expenses</p>
                <p className="text-xl font-bold text-slate-800">{formatMoney(summary.personalExpenses)}</p>
              </CardContent>
            </Card>

            {/* Cars Rental Income */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Car className="h-5 w-5 text-emerald-600" />
                  </div>
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    Income
                  </span>
                </div>
                <p className="text-slate-500 text-xs mb-1">Cars Rental Income</p>
                <p className="text-xl font-bold text-slate-800">{formatMoney(summary.carIncome)}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Vehicle Running Costs */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-slate-800">Vehicle Running Costs</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Fuel */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-amber-50 to-white">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Fuel className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-500 text-xs">Fuel Expenses</p>
                    <p className="text-lg font-bold text-slate-800 truncate">
                      {formatMoney(summary.petrolExpenses)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Oil */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-slate-50 to-white">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
                    <Droplets className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-500 text-xs">Oil Expenses</p>
                    <p className="text-lg font-bold text-slate-800 truncate">{formatMoney(summary.oilExpenses)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Washing */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-cyan-50 to-white">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-500 text-xs">Washing Expenses</p>
                    <p className="text-lg font-bold text-slate-800 truncate">
                      {formatMoney(summary.washingExpenses)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Maintenance */}
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-orange-50 to-white">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-500 text-xs">Maintenance</p>
                    <p className="text-lg font-bold text-slate-800 truncate">
                      {formatMoney(summary.maintenanceExpenses)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Monthly Insights */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-violet-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-slate-800">Monthly Insights</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top 3 Cars Widget */}
            <Card className="border-0 shadow-lg bg-white overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Top Performing Cars</h3>
                      <p className="text-white/70 text-xs">Ranked by net income this month</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {topCars.length > 0 ? (
                    topCars.map((car, index) => (
                      <div
                        key={car.id}
                        className={`flex items-center gap-4 p-3 rounded-xl ${
                          index === 0
                            ? "bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200"
                            : "bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-center w-8 h-8">{rankIcons[index]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate text-sm">{car.plateNumber}</p>
                          <p className="text-xs text-slate-500">
                            {car.bookings} booking{car.bookings !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${car.netIncome >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {formatMoney(car.netIncome, { showSign: true })}
                          </p>
                          <p className="text-xs text-slate-400">net income</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <Car className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No car data this month</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Expense Breakdown Widget */}
            <Card className="border-0 shadow-lg bg-white overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <PieChart className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Expense Breakdown</h3>
                      <p className="text-white/70 text-xs">Where your money goes</p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  {expenseBreakdown.length > 0 ? (
                    <>
                      {/* Top Expense Highlight */}
                      {topExpense && (
                        <div className="mb-4 p-4 bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl border border-rose-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-rose-600 font-medium mb-1">Highest Expense Category</p>
                              <p className="text-lg font-bold text-slate-800">{topExpense.category}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-rose-600">{formatMoney(topExpense.amount)}</p>
                              <p className="text-xs text-slate-500">
                                {totalExpensesAmount > 0
                                  ? `${Math.round((topExpense.amount / totalExpensesAmount) * 100)}% of total`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Other Categories */}
                      <div className="space-y-2">
                        {expenseBreakdown.slice(1, 5).map((item) => (
                          <div key={item.category} className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-slate-600">{item.category}</span>
                                <span className="text-sm font-medium text-slate-800">
                                  {formatMoney(item.amount)}
                                </span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-rose-400 to-pink-400 rounded-full transition-all duration-500"
                                  style={{
                                    width:
                                      totalExpensesAmount > 0 ? `${(item.amount / totalExpensesAmount) * 100}%` : "0%",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No expense data this month</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        {/* End Monthly Insights */}
      </div>
    </div>
  )
}
