"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
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
  RefreshCw,
  Wallet,
} from "lucide-react"
import { getFinancialSummary, getTopCarsForMonth, getExpenseBreakdown, getInvestors, getCarsForInvestor } from "@/lib/financial-service"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { format, addMonths, subMonths } from "date-fns"

export default function InvestorAccountingPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isLoading: authLoading } = useAuth()
  
  const investorId = params.investorId as string
  
  // SECURITY: Verify this investor belongs to the current user
  useEffect(() => {
    if (!authLoading && user) {
      // Only investors can access this page
      if (user.role !== "investor") {
        // Admins should use the main accounting page
        router.replace("/accounting")
        return
      }
      
      // Investor can only view their own data
      if (user.investorId !== investorId) {
        // Redirect to their own investor page
        router.replace(`/accounting/investor/${user.investorId}`)
        return
      }
    }
  }, [user, authLoading, investorId, router])

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [investorName, setInvestorName] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    carIncome: 0,
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
  const [totalCarsBalance, setTotalCarsBalance] = useState(0)

  const [topCars, setTopCars] = useState<
    Array<{
      id: number
      name: string
      plateNumber: string
      modelName: string
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
    if (!investorId || authLoading) return
    
    // Don't load if user doesn't have access
    if (user?.role === "investor" && user?.investorId !== investorId) return
    
    loadInvestorName()
    loadSummary()
  }, [investorId, currentMonth, authLoading, user])

  async function loadInvestorName() {
    try {
      const investors = await getInvestors()
      const investor = investors.find((inv) => inv.id === investorId)
      if (investor) {
        setInvestorName(investor.name)
      }
    } catch (error) {
      // Silently fail - name is not critical
    }
  }

  async function loadSummary() {
    setLoading(true)
    setError(null)

    try {
      const year = currentMonth.getFullYear()
      const monthNum = currentMonth.getMonth()
      const dateFrom = format(new Date(year, monthNum, 1), "yyyy-MM-dd")
      const dateTo = format(new Date(year, monthNum + 1, 0), "yyyy-MM-dd")

      // Get cars for this investor to calculate total cars balance
      const supabase = getSupabaseBrowserClient()
      const investorCars = await getCarsForInvestor(investorId)
      const carIds = investorCars.map(car => car.id)

      // Query all car transactions for this investor (ALL TIME, not filtered by month)
      let carsBalanceTotal = 0
      if (carIds.length > 0) {
        const { data: carTransactions } = await supabase
          .from("financial_transactions")
          .select("direction, amount")
          .eq("sheet_type", "car")
          .in("car_id", carIds)
        
        if (carTransactions) {
          carsBalanceTotal = carTransactions.reduce((sum, t) => {
            return t.direction === "IN" ? sum + Number(t.amount) : sum - Number(t.amount)
          }, 0)
        }
      }
      setTotalCarsBalance(carsBalanceTotal)

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

  // Show loading while checking auth
  if (authLoading) {
    return (
      <ProtectedRoute allowedRoles={["investor"]}>
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4AA3FF] border-t-transparent mx-auto"></div>
            <p className="mt-4 text-slate-600 font-medium">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error) {
    return (
      <ProtectedRoute allowedRoles={["investor"]}>
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <Card className="max-w-md w-full border-red-200">
            <CardContent className="p-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-center text-slate-800">Error Loading Data</h2>
              <p className="text-slate-600 text-center">{error}</p>
              <Button
                onClick={() => loadSummary()}
                className="w-full bg-[#4AA3FF] hover:bg-[#3A8FE0] text-white font-semibold rounded-[10px] px-4 py-3 h-auto"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    )
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["investor"]}>
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4AA3FF] border-t-transparent mx-auto"></div>
            <p className="mt-4 text-slate-600 font-medium">Loading your financial data...</p>
          </div>
        </div>
      </ProtectedRoute>
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
    <ProtectedRoute allowedRoles={["investor"]}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Financial Summary</h1>
            <p className="text-slate-500 text-sm">{investorName || "Loading..."}</p>
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
                    {isPositive ? "+" : "-"}₺{Math.abs(summary.netProfit).toLocaleString()}
                  </span>
                  <span
                    className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full ${isPositive ? "bg-white/20" : "bg-white/20"}`}
                  >
                    {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {isPositive ? "Profit" : "Loss"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div>
                  <p className="text-white/60 text-xs">Total Cars Income</p>
                  <p className="text-xl font-semibold">₺{summary.carIncome.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Cars Balance Card - Sum of all car sheets balances */}
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-[#5BC0F8] to-[#4AA3FF]">
          <CardContent className="p-8">
            <div className="flex items-center justify-between text-white">
              <div>
                <p className="text-white/80 text-sm font-medium mb-1">Total Cars Balance</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold">
                    {totalCarsBalance >= 0 ? "+" : "-"}₺{Math.abs(totalCarsBalance).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="flex items-center gap-1 text-sm px-2 py-1 rounded-full bg-white/20">
                    {totalCarsBalance >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    All Cars
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Wallet className="h-7 w-7 text-white" />
                </div>
              </div>
            </div>
            <p className="text-white/60 text-xs mt-4">Sum of all car sheets balances (IN - OUT) • All time</p>
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
                <p className="text-xl font-bold text-slate-800">₺{Math.abs(summary.buySell).toLocaleString()}</p>
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
                <p className="text-xl font-bold text-slate-800">₺{summary.companyExpenses.toLocaleString()}</p>
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
                <p className="text-xl font-bold text-slate-800">₺{summary.personalExpenses.toLocaleString()}</p>
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
                <p className="text-xl font-bold text-slate-800">₺{summary.carIncome.toLocaleString()}</p>
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
                      ₺{summary.petrolExpenses.toLocaleString()}
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
                    <p className="text-lg font-bold text-slate-800 truncate">₺{summary.oilExpenses.toLocaleString()}</p>
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
                      ₺{summary.washingExpenses.toLocaleString()}
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
                      ₺{summary.maintenanceExpenses.toLocaleString()}
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
                          <p className="text-xs text-slate-500">{car.modelName || "Unknown Model"}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${car.netIncome >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {car.netIncome >= 0 ? "+" : ""}₺{car.netIncome.toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-400">net income</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No car data for this month</p>
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
                    <div className="space-y-3">
                      {expenseBreakdown.map((item, index) => {
                        const percentage = totalExpensesAmount > 0 ? (item.amount / totalExpensesAmount) * 100 : 0
                        const isTop = index === 0

                        return (
                          <div key={item.category} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className={`${isTop ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                                {item.category}
                                {isTop && " (Highest)"}
                              </span>
                              <span className="font-medium text-slate-800">₺{item.amount.toLocaleString()}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${isTop ? "bg-rose-500" : "bg-slate-300"}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No expenses this month</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
