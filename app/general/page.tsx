"use client"

import { useState, useEffect, useRef } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Car,
  CalendarCheck,
  TrendingUp,
  DollarSign,
  Wrench,
  ParkingCircle,
  AlertTriangle,
  Gauge,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  CalendarDays,
} from "lucide-react"
import { format, endOfMonth, startOfMonth, addDays, differenceInDays, startOfDay } from "date-fns"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { useAuth } from "@/lib/auth-context"
import { dataService } from "@/lib/data-service"
import { withTimeout } from "@/lib/utils"
import { useVisibilityRefresh } from "@/hooks/use-visibility-refresh"
import { getVehicleTodayStatus } from "@/lib/vehicle-status"

// Brand colors
const BRAND = {
  primary: "#4AA3FF",
  secondary: "#5BC0F8",
}

// Status colors matching the Cars page exactly
const STATUS_COLORS = {
  working: { bg: "bg-emerald-100", text: "text-emerald-600", icon: TrendingUp },
  parking: { bg: "bg-rose-100", text: "text-rose-600", icon: ParkingCircle },
  service: { bg: "bg-amber-100", text: "text-amber-600", icon: Wrench },
  selling: { bg: "bg-purple-100", text: "text-purple-600", icon: AlertTriangle },
}

export default function GeneralDashboard() {
  const { isLoading: authLoading, initialAuthChecked, user } = useAuth()
  const [loading, setLoading] = useState(true)
  
  // Cars data (from Cars page)
  const [carStats, setCarStats] = useState({
    total: 0,
    working: 0,
    parking: 0,
    service: 0,
    selling: 0,
  })
  
  // Bookings data (from Bookings page)
  const [bookingStats, setBookingStats] = useState({
    total: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
  })
  
  // Closest 3 vehicle returns (today, tomorrow, or day after tomorrow)
  const [closestReturns, setClosestReturns] = useState<
    { plate: string; brand: string; model: string; returnDate: string; daysUntil: number }[]
  >([])
  
  // Exchange rates (from Pricing page)
  const [exchangeRates, setExchangeRates] = useState<{ usd: number; eur: number }>({
    usd: 0,
    eur: 0,
  })
  
  // Latest operations (from Operations page)
  const [latestOperations, setLatestOperations] = useState<
    { id: number; type: string; plate: string; date: string }[]
  >([])
  
  // Accounting summary
  const [accountingData, setAccountingData] = useState({
    homestaIncome: 0,
    monthProgress: 0,
  })
  const isFetchingRef = useRef(false)

  useEffect(() => {
    if (initialAuthChecked && user) {
      loadDashboardData()
    } else if (initialAuthChecked && !user) {
      setLoading(false)
    }
  }, [initialAuthChecked, user])

  // Refresh data when tab becomes visible - pass isFetchingRef to skip if fetch in progress
  useVisibilityRefresh(() => {
    if (!initialAuthChecked || !user) return
    loadDashboardData()
  }, isFetchingRef)

  const loadDashboardData = async () => {
    isFetchingRef.current = true
    setLoading(true)
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    setLoading(false)
    isFetchingRef.current = false
    return
  }

    const now = new Date()
    const todayDate = startOfDay(now)
    const todayStr = format(todayDate, "yyyy-MM-dd")
    const dayAfterTomorrowStr = format(addDays(todayDate, 2), "yyyy-MM-dd")
    const monthStartDate = format(startOfMonth(now), "yyyy-MM-dd")
    const monthEndDate = format(endOfMonth(now), "yyyy-MM-dd")

    // Safety timeout: loading MUST end within 12 seconds no matter what
    const safetyTimer = setTimeout(() => {
      setLoading(false)
    }, 12000)

    try {
      // Fire ALL independent queries in parallel. Each is wrapped in
      // withTimeout(8s) so a single hanging Supabase call can't block
      // the entire batch. Promise.allSettled ensures partial failures
      // don't prevent other sections from rendering.
      const [
        carsResult,
        availBookingsResult,
        blocksResult,
        monthBookingsResult,
        returnsResult,
        ratesResult,
        opsResult,
        commissionResult,
      ] = await Promise.allSettled([
        withTimeout(supabase.from("cars").select("id")),
        withTimeout(dataService.getBookingsForAvailability(todayStr, todayStr)),
        withTimeout(dataService.getBlocks()),
        withTimeout(supabase.from("bookings").select("status, start_date")
          .gte("start_date", monthStartDate).lte("start_date", monthEndDate)),
        withTimeout(dataService.getBookingsForAvailability(todayStr, dayAfterTomorrowStr)),
        withTimeout(supabase.from("exchange_rates").select("currency, rate_to_try")
          .in("currency", ["USD", "EUR"])),
        withTimeout(supabase.from("operations").select("id, type, date, cars(plate_number)")
          .eq("is_deleted", false).order("date", { ascending: false }).limit(5)),
        withTimeout(supabase.from("financial_transactions").select("amount")
          .eq("category", "Commission").gte("date", monthStartDate).lte("date", monthEndDate)),
      ])

      // 1. Cars stats - dynamic computation from bookings + blocks
      if (carsResult.status === "fulfilled" && availBookingsResult.status === "fulfilled" && blocksResult.status === "fulfilled") {
        const carsData = carsResult.value.data
        const bookingsData = availBookingsResult.value
        const blocksData = blocksResult.value
        if (carsData) {
          let working = 0, parking = 0, selling = 0, service = 0
          carsData.forEach((car) => {
            const status = getVehicleTodayStatus(car.id, bookingsData, blocksData)
            if (status === "WORKING") working++
            else if (status === "PARKING") parking++
            else if (status === "SELLING") selling++
            else if (status === "SERVICE") service++
          })
          setCarStats({ total: carsData.length, working, parking, service, selling })
        }
      }

      // 2. Booking stats
      if (monthBookingsResult.status === "fulfilled") {
        const bookingsData = monthBookingsResult.value.data
        if (bookingsData) {
          setBookingStats({
            total: bookingsData.length,
            confirmed: bookingsData.filter((b) => b.status === "confirmed").length,
            pending: bookingsData.filter((b) => b.status === "pending").length,
            cancelled: bookingsData.filter((b) => b.status === "cancelled").length,
          })
        }
      }

      // 3. Closest 3 vehicle returns
      if (returnsResult.status === "fulfilled") {
        const availabilityBookings = returnsResult.value
        const activeReturns = availabilityBookings
          .filter((b: any) => {
            const isActive = b.start_date <= todayStr && b.end_date >= todayStr
            const isReturningWithin3Days = b.end_date >= todayStr && b.end_date <= dayAfterTomorrowStr
            return isActive && isReturningWithin3Days
          })
          .sort((a: any, b: any) => a.end_date.localeCompare(b.end_date))
          .slice(0, 3)
        setClosestReturns(
          activeReturns.map((b: any) => ({
            plate: b.car?.plate_number || "Unknown",
            brand: b.car?.brand || "",
            model: b.car?.model || "",
            returnDate: b.end_date,
            daysUntil: differenceInDays(startOfDay(new Date(b.end_date)), todayDate),
          }))
        )
      }

      // 4. Exchange rates
      if (ratesResult.status === "fulfilled") {
        const ratesData = ratesResult.value.data
        if (ratesData) {
          setExchangeRates({
            usd: ratesData.find((r) => r.currency === "USD")?.rate_to_try || 0,
            eur: ratesData.find((r) => r.currency === "EUR")?.rate_to_try || 0,
          })
        }
      }

      // 5. Latest operations
      if (opsResult.status === "fulfilled") {
        const opsData = opsResult.value.data
        if (opsData) {
          setLatestOperations(
            opsData.map((op: any) => ({
              id: op.id, type: op.type,
              plate: op.cars?.plate_number || "Unknown", date: op.date,
            }))
          )
        }
      }

      // 6. Accounting commission + month progress
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const monthProgress = Math.round((now.getDate() / daysInMonth) * 100)
      let commissionTotal = 0
      if (commissionResult.status === "fulfilled") {
        commissionTotal = (commissionResult.value.data || []).reduce((sum, t) => sum + Number(t.amount), 0)
      }
      setAccountingData({ homestaIncome: commissionTotal, monthProgress })

    } catch (error) {
      console.error("[v0] Error loading dashboard data:", error)
  } finally {
    clearTimeout(safetyTimer)
    setLoading(false)
    isFetchingRef.current = false
  }
  }

  const getOperationLabel = (type: string): string => {
    const labels: Record<string, string> = {
      RECEIVING: "Receiving",
      DELIVERY: "Delivery",
      RETURN: "Return",
      CAR_WASH: "Car Wash",
      SERVICE: "Service",
      OIL_CHANGE: "Oil Change",
    }
    return labels[type] || type
  }

  const getOperationColor = (type: string): string => {
    const colors: Record<string, string> = {
      RECEIVING: "text-red-600",
      DELIVERY: "text-green-600",
      RETURN: "text-blue-600",
      CAR_WASH: "text-cyan-600",
      SERVICE: "text-amber-600",
      OIL_CHANGE: "text-purple-600",
    }
    return colors[type] || "text-gray-600"
  }

  if (authLoading || loading) {
    return (
 <ProtectedRoute allowedRoles={["admin", "staff"]}>
  <DashboardLayout>
  <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-[#4AA3FF] mx-auto" />
              <p className="mt-4 text-slate-600 font-medium">Loading dashboard...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
 <ProtectedRoute allowedRoles={["admin", "staff"]}>
  <DashboardLayout>
  <div className="space-y-6">
          {/* Header with Today's Date */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                General Overview
              </h1>
              <p className="text-slate-500 mt-1">Real-time summary of all systems</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white shadow-md border border-slate-100">
              <CalendarDays className="h-5 w-5 text-slate-500" />
              <span className="text-lg font-semibold text-slate-700">
                {format(new Date(), "EEEE, dd MMMM yyyy")}
              </span>
            </div>
          </div>

          {/* Section 1: Cars Status (EXACT style from Cars page) */}
          <section>
            <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Car className="h-5 w-5" style={{ color: BRAND.primary }} />
              Fleet Status
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Total Cars - exact match from Cars page */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Cars</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{carStats.total}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-sky-100">
                    <Car className="w-5 h-5 text-sky-600" />
                  </div>
                </div>
              </div>

              {/* Working - exact match from Cars page */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-emerald-200 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Working</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{carStats.working}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-100">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
              </div>

              {/* Parking - exact match from Cars page */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-rose-200 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Parking</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{carStats.parking}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-100">
                    <ParkingCircle className="w-5 h-5 text-rose-600" />
                  </div>
                </div>
              </div>

              {/* Service - exact match from Cars page */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Service</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{carStats.service}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-200">
                    <Wrench className="w-5 h-5 text-slate-600" />
                  </div>
                </div>
              </div>

              {/* Selling - exact match from Cars page */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-amber-200 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Selling</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{carStats.selling}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-100">
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Monthly Summary (moved to top for executive view) */}
          <section>
            <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" style={{ color: BRAND.primary }} />
              Monthly Summary
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Homesta Commission */}
              <div className="p-6 rounded-xl bg-gradient-to-br from-[#4AA3FF]/10 to-[#5BC0F8]/10 border border-[#4AA3FF]/20 shadow-sm">
                <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">
                  Homesta Commission (This Month)
                </p>
                <p className="text-4xl font-bold mt-2" style={{ color: BRAND.primary }}>
                  ₺{accountingData.homestaIncome.toLocaleString("tr-TR")}
                </p>
              </div>

              {/* Month Progress Gauge */}
              <div className="p-6 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 shadow-sm">
                <p className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-4">
                  End of Month Indicator
                </p>
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={BRAND.primary}
                        strokeWidth="3"
                        strokeDasharray={`${accountingData.monthProgress}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold" style={{ color: BRAND.primary }}>
                        {accountingData.monthProgress}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">
                      Day {new Date().getDate()} of{" "}
                      {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {format(new Date(), "MMMM yyyy")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Bookings Summary (matching Bookings page) */}
          <section>
            <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" style={{ color: BRAND.primary }} />
              Bookings Summary
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-blue-100 uppercase tracking-wide">Total Bookings</p>
                  <p className="text-3xl font-bold mt-1">{bookingStats.total}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-green-100" />
                    <p className="text-sm font-medium text-green-100 uppercase tracking-wide">Confirmed</p>
                  </div>
                  <p className="text-3xl font-bold mt-1">{bookingStats.confirmed}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-none shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-100" />
                    <p className="text-sm font-medium text-amber-100 uppercase tracking-wide">Pending</p>
                  </div>
                  <p className="text-3xl font-bold mt-1">{bookingStats.pending}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-none shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-red-100" />
                    <p className="text-sm font-medium text-red-100 uppercase tracking-wide">Cancelled</p>
                  </div>
                  <p className="text-3xl font-bold mt-1">{bookingStats.cancelled}</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Grid for remaining sections */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Section 3: Closest Returns (today, tomorrow, day after tomorrow) */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-700">
                  <Clock className="h-5 w-5" style={{ color: BRAND.primary }} />
                  Closest Returns
                </CardTitle>
              </CardHeader>
              <CardContent>
                {closestReturns.length > 0 ? (
                  <div className="space-y-3">
                    {closestReturns.map((car, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">{car.plate}</p>
                          <p className="text-sm text-slate-500">
                            {car.brand} {car.model}
                          </p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <p className="text-sm font-medium text-slate-600">
                            {format(new Date(car.returnDate), "MMM dd")}
                          </p>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              car.daysUntil === 0
                                ? "bg-red-100 text-red-600"
                                : car.daysUntil === 1
                                  ? "bg-amber-100 text-amber-600"
                                  : "bg-blue-100 text-blue-600"
                            }`}
                          >
                            {car.daysUntil === 0 ? "Today" : car.daysUntil === 1 ? "Tomorrow" : "In 2 days"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm text-center py-4">No upcoming returns</p>
                )}
              </CardContent>
            </Card>

            {/* Section 4: Exchange Rates (from Pricing) */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-700">
                  <DollarSign className="h-5 w-5" style={{ color: BRAND.primary }} />
                  Exchange Rates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                        $
                      </div>
                      <span className="font-semibold text-slate-700">USD</span>
                    </div>
                    <span className="text-2xl font-bold text-emerald-600">
                      {exchangeRates.usd.toFixed(2)} TL
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                        €
                      </div>
                      <span className="font-semibold text-slate-700">EUR</span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">
                      {exchangeRates.eur.toFixed(2)} TL
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Latest Operations (from Operations) */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-700">
                  <Wrench className="h-5 w-5" style={{ color: BRAND.primary }} />
                  Latest Operations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {latestOperations.length > 0 ? (
                  <div className="space-y-2">
                    {latestOperations.map((op) => (
                      <div
                        key={op.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${getOperationColor(op.type)}`}>
                            {getOperationLabel(op.type)}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-sm text-slate-600">{op.plate}</span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {format(new Date(op.date), "MMM dd")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm text-center py-4">No recent operations</p>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
