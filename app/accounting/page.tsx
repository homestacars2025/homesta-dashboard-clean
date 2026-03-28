"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  Car,
  Wallet,
  Gauge,
  AlertTriangle,
  RefreshCw,
  Trophy,
  Target,
  Clock,
  Users,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { format } from "date-fns"
import { getInvestors } from "@/lib/financial-service"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { withTimeout } from "@/lib/utils"
import { useVisibilityRefresh } from "@/hooks/use-visibility-refresh"
import { useCurrency } from "@/lib/currency-context"

interface DebugState {
  supabaseStatus: "checking" | "connected" | "error" | "not-configured"
  pendingRequests: string[]
  failedQueries: { query: string; error: string }[]
  lastUpdate: string
}

export default function AccountingPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const { formatMoney, symbol } = useCurrency()
  
  // INVESTOR RESTRICTION: Redirect investors to their own page
  // Staff should not access this page at all (handled by sidebar)
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "investor" && user.investorId) {
        // Redirect investor to their own accounting page
        router.replace(`/accounting/investor/${user.investorId}`)
      } else if (user.role === "staff") {
        // Staff should not access accounting - redirect to general
        router.replace("/general")
      }
    }
  }, [user, authLoading, router])
  
  const [selectedInvestor, setSelectedInvestor] = useState<string>("")
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [investors, setInvestors] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [homestaIncome, setHomestaIncome] = useState(0)
  const [alfahdIncome, setAlfahdIncome] = useState(0)
  const [bestCar, setBestCar] = useState<{ plate: string; count: number } | null>(null)
  const [topCars, setTopCars] = useState<{ plate: string; modelName: string; total: number }[]>([])
  const [monthProgress, setMonthProgress] = useState(0)
  const [dataLoading, setDataLoading] = useState(false)
  const [customerAccountingBalance, setCustomerAccountingBalance] = useState(0)

  const [showDebug, setShowDebug] = useState(false)
  const isFetchingRef = useRef(false)
  const [debugState, setDebugState] = useState<DebugState>({
    supabaseStatus: "checking",
    pendingRequests: [],
    failedQueries: [],
    lastUpdate: new Date().toISOString(),
  })
  const [initError, setInitError] = useState<string | null>(null)

  const addPendingRequest = useCallback((name: string) => {
    setDebugState((prev) => ({
      ...prev,
      pendingRequests: [...prev.pendingRequests, name],
      lastUpdate: new Date().toISOString(),
    }))
  }, [])

  const removePendingRequest = useCallback((name: string) => {
    setDebugState((prev) => ({
      ...prev,
      pendingRequests: prev.pendingRequests.filter((r) => r !== name),
      lastUpdate: new Date().toISOString(),
    }))
  }, [])

  const addFailedQuery = useCallback((query: string, error: string) => {
    setDebugState((prev) => ({
      ...prev,
      failedQueries: [...prev.failedQueries, { query, error }],
      lastUpdate: new Date().toISOString(),
    }))
  }, [])

  useEffect(() => {
    const checkSupabase = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        if (!supabase) {
          setDebugState((prev) => ({ ...prev, supabaseStatus: "not-configured" }))
          setInitError("Supabase client not configured. Check environment variables.")
          setLoading(false)
          return false
        }
        setDebugState((prev) => ({ ...prev, supabaseStatus: "connected" }))
        return true
      } catch (error: any) {
        setDebugState((prev) => ({ ...prev, supabaseStatus: "error" }))
        setInitError(error?.message || "Failed to initialize Supabase")
        setLoading(false)
        return false
      }
    }

    checkSupabase().then((isConnected) => {
      if (isConnected) {
        loadInvestors()
        calculateMonthProgress()
      }
    })
  }, [])

  // Refresh data when tab becomes visible - pass isFetchingRef to skip if fetch in progress
  useVisibilityRefresh(() => {
    if (loading || debugState.supabaseStatus !== "connected") return
    loadDashboardMetrics(currentMonth)
  }, isFetchingRef)

  useEffect(() => {
    if (!loading && debugState.supabaseStatus === "connected") {
      loadDashboardMetrics(currentMonth)
    }
    
    // Safety timeout — loading must end after 10 seconds max
    const safetyTimeout = setTimeout(() => {
      setDataLoading(false)
    }, 10000)
    
    return () => clearTimeout(safetyTimeout)
  }, [currentMonth, investors, loading, debugState.supabaseStatus])

  function calculateMonthProgress() {
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const progress = (now.getDate() / daysInMonth) * 100
    setMonthProgress(Math.round(progress))
  }

  async function loadInvestors() {
    addPendingRequest("loadInvestors")

    const timeoutId = setTimeout(() => {
      removePendingRequest("loadInvestors")
      addFailedQuery("loadInvestors", "Request timeout after 10 seconds")
      setLoading(false)
    }, 10000)

    try {
      const data = await getInvestors()
      clearTimeout(timeoutId)
      setInvestors(data)
    } catch (error: any) {
      clearTimeout(timeoutId)
      addFailedQuery("loadInvestors", error?.message || "Unknown error")
    } finally {
      removePendingRequest("loadInvestors")
      setLoading(false)
    }
  }

  async function loadDashboardMetrics(month: Date) {
    isFetchingRef.current = true
    setDataLoading(true)
  
    setDebugState((prev) => ({
      ...prev,
      failedQueries: prev.failedQueries.filter((q) => !q.query.startsWith("metrics_")),
    }))

    try {
  const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setDataLoading(false)
      isFetchingRef.current = false
      return
    }

      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
      const fromStr = format(monthStart, "yyyy-MM-dd")
      const toStr = format(monthEnd, "yyyy-MM-dd")

      const queries = [
        // Homesta Commission query
        (async () => {
          addPendingRequest("metrics_commission")
          try {
            const { data, error } = await supabase
              .from("financial_transactions")
              .select("amount")
              .gte("date", fromStr)
              .lte("date", toStr)
              .eq("category", "Commission")

            if (error) throw error
            setHomestaIncome((data || []).reduce((sum, t) => sum + Number(t.amount), 0))
          } catch (error: any) {
            addFailedQuery("metrics_commission", error?.message || "Failed to load commission data")
            setHomestaIncome(0)
          } finally {
            removePendingRequest("metrics_commission")
          }
        })(),

        // Alfahd income query
        (async () => {
          addPendingRequest("metrics_alfahd")
          try {
            const alfahdInvestor = investors.find((inv) => inv.name.toLowerCase().includes("alfahd"))
            if (!alfahdInvestor) {
              setAlfahdIncome(0)
              return
            }

            const { data, error } = await supabase
              .from("financial_transactions")
              .select("amount, direction")
              .gte("date", fromStr)
              .lte("date", toStr)
              .eq("investor_id", alfahdInvestor.id)

            if (error) throw error
            setAlfahdIncome(
              (data || []).reduce((sum, t) => {
                return sum + (t.direction === "IN" ? Number(t.amount) : -Number(t.amount))
              }, 0),
            )
          } catch (error: any) {
            addFailedQuery("metrics_alfahd", error?.message || "Failed to load Alfahd data")
            setAlfahdIncome(0)
          } finally {
            removePendingRequest("metrics_alfahd")
          }
        })(),

        // Best car query
        (async () => {
          addPendingRequest("metrics_bestcar")
          try {
            const { data: rentalTransactions, error } = await supabase
              .from("financial_transactions")
              .select("car_id")
              .gte("date", fromStr)
              .lte("date", toStr)
              .eq("category", "Rent Collection")
              .eq("direction", "IN")
              .not("car_id", "is", null)

            if (error) throw error

            if (!rentalTransactions || rentalTransactions.length === 0) {
              setBestCar(null)
              return
            }

            const carCounts: Record<number, number> = {}
            rentalTransactions.forEach((t) => {
              if (t.car_id) {
                carCounts[t.car_id] = (carCounts[t.car_id] || 0) + 1
              }
            })

            let topCarId: number | null = null
            let topCount = 0
            Object.entries(carCounts).forEach(([carId, count]) => {
              if (count > topCount) {
                topCarId = Number.parseInt(carId)
                topCount = count
              }
            })

            if (topCarId) {
              const { data: carData, error: carError } = await supabase
                .from("cars")
                .select("plate_number")
                .eq("id", topCarId)
                .single()

              if (carError) throw carError
              setBestCar({ plate: carData?.plate_number || "Unknown", count: topCount })
            } else {
              setBestCar(null)
            }
          } catch (error: any) {
            addFailedQuery("metrics_bestcar", error?.message || "Failed to load best car data")
            setBestCar(null)
          } finally {
            removePendingRequest("metrics_bestcar")
          }
        })(),

        // Customer Accounting Total Balance query
        (async () => {
          addPendingRequest("metrics_customer_balance")
          try {
            // Load all bookings and ledger data
            const [bookingsResult, ledgerResult] = await Promise.all([
              supabase.from("bookings").select("id, car_id"),
              supabase.from("customer_accounting_ledger").select("booking_id, amount, direction")
            ])

            if (bookingsResult.error) throw bookingsResult.error

            // Calculate total balance across all bookings
            const totalBalance = (ledgerResult.data || []).reduce((sum, entry) => {
              return entry.direction === "IN" ? sum + Number(entry.amount) : sum - Number(entry.amount)
            }, 0)

            setCustomerAccountingBalance(totalBalance)
          } catch (error: any) {
            addFailedQuery("metrics_customer_balance", error?.message || "Failed to load customer accounting balance")
            setCustomerAccountingBalance(0)
          } finally {
            removePendingRequest("metrics_customer_balance")
          }
        })(),

        // Top 5 cars by NET PROFIT (IN - OUT) - filtered by selected month
        (async () => {
          addPendingRequest("metrics_topcars")
          try {
            const { data: carTransactions, error } = await supabase
              .from("financial_transactions")
              .select("car_id, amount, direction, date")
              .not("car_id", "is", null)
              .gte("date", fromStr)
              .lte("date", toStr)

            if (error) throw error

            if (!carTransactions || carTransactions.length === 0) {
              setTopCars([])
              return
            }

            // Calculate NET PROFIT per car: SUM(IN) - SUM(OUT)
            const carNetProfit: Record<number, number> = {}
            carTransactions.forEach((t) => {
              if (t.car_id) {
                const amount = Number(t.amount)
                if (t.direction === "IN") {
                  carNetProfit[t.car_id] = (carNetProfit[t.car_id] || 0) + amount
                } else if (t.direction === "OUT") {
                  carNetProfit[t.car_id] = (carNetProfit[t.car_id] || 0) - amount
                }
              }
            })

            const sortedCarIds = Object.entries(carNetProfit)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([carId]) => Number(carId))

            if (sortedCarIds.length > 0) {
              const { data: carsData, error: carsError } = await supabase
                .from("cars")
                .select("id, plate_number, model_group(name)")
                .in("id", sortedCarIds)

              if (carsError) throw carsError

              const topCarsList = sortedCarIds.map((carId) => {
                const car = carsData?.find((c: any) => c.id === carId)
                return {
                  plate: car?.plate_number || "Unknown",
                  modelName: (car as any)?.model_group?.name || "Unknown Model",
                  total: carNetProfit[carId] || 0,
                }
              })

              setTopCars(topCarsList)
            } else {
              setTopCars([])
            }
          } catch (error: any) {
            addFailedQuery("metrics_topcars", error?.message || "Failed to load top cars data")
            setTopCars([])
          } finally {
            removePendingRequest("metrics_topcars")
          }
        })(),
      ]

      await withTimeout(Promise.allSettled(queries), 15000)
    } catch (error: any) {
  addFailedQuery("metrics_general", error?.message || "Failed to load dashboard metrics")
    } finally {
      setDataLoading(false)
      isFetchingRef.current = false
    }
  }

  const navigateMonth = (direction: "prev" | "next") => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(newMonth.getMonth() + (direction === "next" ? 1 : -1))
    setCurrentMonth(newMonth)
  }

  const handleViewReport = () => {
    if (!selectedInvestor) {
      alert("Please select an investor")
      return
    }

    const monthKey = format(new Date(), "yyyy-MM")
    const investorName = investors.find((inv) => inv.id === selectedInvestor)?.name || ""
    setIsModalOpen(false)
    router.push(
      `/accounting/report?investor_id=${selectedInvestor}&investor=${encodeURIComponent(investorName)}&month=${monthKey}`,
    )
  }

  const getProgressColor = (progress: number) => {
    if (progress <= 33) {
      return "#4AA3FF"
    } else if (progress <= 66) {
      const ratio = (progress - 33) / 33
      const r = Math.round(74 + (255 - 74) * ratio)
      const g = Math.round(163 + (165 - 163) * ratio)
      const b = Math.round(255 - 255 * ratio)
      return `rgb(${r}, ${g}, ${b})`
    } else {
      const ratio = (progress - 66) / 34
      const r = 255
      const g = Math.round(165 - 165 * ratio)
      const b = 0
      return `rgb(${r}, ${g}, ${b})`
    }
  }

  if (initError) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="p-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-center text-slate-800">Connection Error</h2>
            <p className="text-slate-600 text-center">{initError}</p>
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-[#4AA3FF] hover:bg-[#3A8FE0] text-white font-semibold rounded-[10px] px-4 py-3 h-auto"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4AA3FF] mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading accounting data...</p>
          {debugState.pendingRequests.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">Loading: {debugState.pendingRequests.join(", ")}</p>
          )}
        </div>
      </div>
    )
  }

  // Calculate net profit (Homesta + Alfahd)
  const netProfit = homestaIncome + alfahdIncome
  const isPositiveProfit = netProfit >= 0

  return (
    <div className="space-y-8">
      {/* Header with Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financial Dashboard</h1>
          <p className="text-slate-500 text-sm">Real-time insights and performance metrics</p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => router.push("/accounting/customer")}
            className="h-10 px-5 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all"
            style={{ backgroundColor: "#1a1a1a" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#333333")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1a1a1a")}
          >
            Customer Accounting
          </Button>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                className="h-10 px-5 font-medium rounded-xl shadow-md hover:shadow-lg transition-all border-2 border-slate-200 bg-transparent text-slate-800 hover:border-slate-300 hover:bg-slate-50"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Investor Reports
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl text-center">Select Investor</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Investor / Company</label>
                  <Select value={selectedInvestor} onValueChange={setSelectedInvestor}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select investor" />
                    </SelectTrigger>
                    <SelectContent>
                      {investors.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-slate-500 text-center">No investors found</div>
                      ) : (
                        investors.map((investor) => (
                          <SelectItem key={investor.id} value={investor.id}>
                            {investor.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-slate-500 text-center">
                  Report will open for the current month. Use arrows to navigate between months.
                </p>
                  <Button
                    onClick={handleViewReport}
                    disabled={!selectedInvestor}
                    className="w-full h-10 px-5 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                    style={{ backgroundColor: "#5BC0F8" }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "#4AB0E8" }}
                    onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "#5BC0F8" }}
                  >
                    View Financial Report
                  </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            onClick={() => router.push("/accounting/add")}
            className="h-10 px-5 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all"
            style={{ backgroundColor: "#5BC0F8" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4AB0E8")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5BC0F8")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Global Summary Strip - Premium Gradient Card */}
      <Card className={`border-0 shadow-lg overflow-hidden ${isPositiveProfit ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-rose-500 to-red-600"}`}>
        <CardContent className="p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            {/* Main KPI - Net Profit */}
            <div className="text-white">
              <p className="text-white/80 text-sm font-medium mb-1">Net Profit</p>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold">
                  {formatMoney(netProfit, { showSign: true })}
                </span>
                <span className="flex items-center gap-1 text-sm px-2 py-1 rounded-full bg-white/20">
                  {isPositiveProfit ? <TrendingUp className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {format(currentMonth, "MMMM yyyy")}
                </span>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="flex flex-wrap gap-6 lg:gap-10">
              <div className="text-white text-center">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <p className="text-white/60 text-xs">Homesta Income</p>
                <p className="text-xl font-bold">{formatMoney(homestaIncome)}</p>
              </div>
              <div className="text-white text-center">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-2">
                  <Wallet className="h-6 w-6" />
                </div>
                <p className="text-white/60 text-xs">Investor Income</p>
                <p className="text-xl font-bold">{formatMoney(alfahdIncome)}</p>
              </div>
              <div className="text-white text-center">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-2">
                  <Users className="h-6 w-6" />
                </div>
                <p className="text-white/60 text-xs">Customer Balance</p>
                <p className={`text-xl font-bold ${customerAccountingBalance < 0 ? "text-rose-200" : ""}`}>
                  {formatMoney(customerAccountingBalance, { showSign: true })}
                </p>
              </div>
              <div className="text-white text-center">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-2">
                  <Car className="h-6 w-6" />
                </div>
                <p className="text-white/60 text-xs">Best Car</p>
                <p className="text-xl font-bold">{bestCar?.plate || "N/A"}</p>
              </div>
              <div className="text-white text-center">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-2">
                  <Gauge className="h-6 w-6" />
                </div>
                <p className="text-white/60 text-xs">Month Progress</p>
                <p className="text-xl font-bold">{monthProgress}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateMonth("prev")}
          className="h-10 w-10 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </Button>
        <div className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="text-lg font-semibold text-slate-800 min-w-[180px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateMonth("next")}
          className="h-10 w-10 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </Button>
      </div>

      {/* Debug Panel */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDebug(!showDebug)}
          className="bg-white/90 backdrop-blur-sm shadow-lg text-xs rounded-xl border-slate-200"
        >
          {showDebug ? "Hide Debug" : "Debug"}
        </Button>
      </div>

      {showDebug && (
        <Card className="fixed bottom-16 right-4 w-80 z-50 shadow-2xl border-slate-200 rounded-2xl overflow-hidden">
          <CardHeader className="py-3 px-4 bg-slate-50">
            <CardTitle className="text-sm font-semibold">Debug Panel</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div>
              <span className="font-medium">Supabase Status: </span>
              <span
                className={
                  debugState.supabaseStatus === "connected"
                    ? "text-green-600"
                    : debugState.supabaseStatus === "error"
                      ? "text-red-600"
                      : debugState.supabaseStatus === "not-configured"
                        ? "text-orange-600"
                        : "text-slate-500"
                }
              >
                {debugState.supabaseStatus}
              </span>
            </div>
            <div>
              <span className="font-medium">Pending Requests: </span>
              {debugState.pendingRequests.length === 0 ? (
                <span className="text-green-600">None</span>
              ) : (
                <ul className="mt-1 text-orange-600">
                  {debugState.pendingRequests.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <span className="font-medium">Failed Queries: </span>
              {debugState.failedQueries.length === 0 ? (
                <span className="text-green-600">None</span>
              ) : (
                <ul className="mt-1 text-red-600">
                  {debugState.failedQueries.map((q, i) => (
                    <li key={i}>
                      • {q.query}: {q.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="text-slate-400">Last update: {new Date(debugState.lastUpdate).toLocaleTimeString()}</div>
          </CardContent>
        </Card>
      )}

      {debugState.failedQueries.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-800 font-medium">Some data failed to load. Dashboard showing partial results.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadDashboardMetrics(currentMonth)}
            className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-xl"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {dataLoading && (
        <div className="text-center text-slate-500">
          <span className="animate-pulse text-sm font-medium">Loading metrics...</span>
        </div>
      )}

      {/* Main Metrics Grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-[#5BC0F8] rounded-full"></div>
          <h2 className="text-lg font-semibold text-slate-800">Performance Metrics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Homesta Income Card */}
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-white overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Commission</span>
              </div>
              <p className="text-slate-500 text-xs mb-1">Homesta Income</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatMoney(homestaIncome)}
              </p>
              <p className="text-xs text-slate-400 mt-1">This month earnings</p>
            </CardContent>
          </Card>

          {/* Investor Income Card */}
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-emerald-50 to-white overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Net</span>
              </div>
              <p className="text-slate-500 text-xs mb-1">Investor Income</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatMoney(alfahdIncome)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Alfahd net income</p>
            </CardContent>
          </Card>

          {/* Best Car Card */}
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-purple-50 to-white overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Target className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Top</span>
              </div>
              <p className="text-slate-500 text-xs mb-1">Best Performer</p>
              {bestCar ? (
                <>
                  <p className="text-2xl font-bold text-purple-600">{bestCar.plate}</p>
                  <p className="text-xs text-slate-400 mt-1">{bestCar.count} rental(s) this month</p>
                </>
              ) : (
                <p className="text-slate-400 text-sm">No data</p>
              )}
            </CardContent>
          </Card>

          {/* Month Progress Card */}
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-amber-50 to-white overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Progress</span>
              </div>
              <p className="text-slate-500 text-xs mb-1">Month Progress</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-amber-600">{monthProgress}%</p>
                <div className="flex-1 h-2 bg-amber-100 rounded-full overflow-hidden mb-1">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${monthProgress}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Day {new Date().getDate()}/{new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top Performing Cars Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
          <h2 className="text-lg font-semibold text-slate-800">Top Performing Cars</h2>
          <span className="text-xs text-slate-400 ml-2">Net profit this month</span>
        </div>
        <Card className="border-0 shadow-lg bg-white overflow-hidden">
          <CardContent className="p-0">
            {topCars.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {topCars.map((car, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center gap-4 p-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div 
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm ${
                        idx === 0 
                          ? 'bg-gradient-to-br from-amber-400 to-amber-500' 
                          : idx === 1 
                            ? 'bg-gradient-to-br from-slate-300 to-slate-400' 
                            : idx === 2 
                              ? 'bg-gradient-to-br from-amber-600 to-amber-700' 
                              : 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600'
                      }`}
                    >
                      {idx === 0 ? <Trophy className="h-5 w-5" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-slate-800">{car.plate}</p>
                      <p className="text-xs text-slate-500">{car.modelName}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${car.total >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatMoney(car.total)}
                      </p>
                      <p className="text-xs text-slate-400">Total profit</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Car className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">No Data Available</h3>
                <p className="text-slate-500 text-sm">Revenue data will appear here once transactions are recorded</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
