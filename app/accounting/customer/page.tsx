"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { ArrowLeft, Car, ChevronRight, Search, RefreshCw, AlertCircle, FileText, TrendingUp, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useCurrency } from "@/lib/currency-context"
import { withSessionRetry } from "@/lib/with-session-retry"

interface CarWithStats {
  id: number
  plate_number: string
  model_group: { name: string; brand: string; model: string } | null
  bookingsCount: number
  totalBalance: number
}

const FETCH_TIMEOUT = 10000 // 10 seconds

export default function CustomerAccountingPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, initialAuthChecked } = useAuth()
  const { toast } = useToast()
  const { formatMoney } = useCurrency()
  const [cars, setCars] = useState<CarWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Refs to prevent double fetch and handle cleanup
  const fetchingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // SECURITY: Only admin can access customer accounting
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role !== "admin") {
        router.replace("/general")
      }
    }
  }, [user, authLoading, router])

  // Load cars with stats - with AbortController and timeout
  const loadCarsWithStats = useCallback(async () => {
    // Prevent double fetch
    if (fetchingRef.current) return
    fetchingRef.current = true

    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setLoading(true)
    setError(null)

    // Create timeout promise
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }, FETCH_TIMEOUT)

    try {
      const supabase = getSupabaseBrowserClient()

      // No manual session check needed -- the useEffect already gates
      // on `initialAuthChecked && user`, so the session is guaranteed
      // valid at this point. If a query fails due to an expired token,
      // we attempt a silent refresh below instead of showing an error.

      // Load cars (withSessionRetry auto-refreshes token on 401)
      const { data: carsData, error: carsError } = await withSessionRetry(() =>
        supabase.from("cars").select("id, plate_number, model_group(name, brand, model)").order("plate_number")
      )

      if (carsError) throw carsError

      // Load all bookings and ledger data in parallel
      const [bookingsResult, ledgerResult] = await Promise.all([
        withSessionRetry(() => supabase.from("bookings").select("id, car_id")),
        withSessionRetry(() => supabase.from("customer_accounting_ledger").select("booking_id, amount, direction"))
      ])

      if (bookingsResult.error) throw bookingsResult.error

      // Build stats for each car
      const carsWithStats: CarWithStats[] = (carsData || []).map(car => {
        const carBookings = (bookingsResult.data || []).filter(b => b.car_id === car.id)
        const bookingIds = carBookings.map(b => b.id)
        
        const carLedgerEntries = (ledgerResult.data || []).filter(l => bookingIds.includes(l.booking_id))
        const totalBalance = carLedgerEntries.reduce((sum, entry) => {
          return entry.direction === "IN" ? sum + Number(entry.amount) : sum - Number(entry.amount)
        }, 0)

        return {
          ...car,
          bookingsCount: carBookings.length,
          totalBalance
        }
      })

      setCars(carsWithStats)
    } catch (err: any) {
      // Handle abort / timeout
      if (err?.name === "AbortError") {
        setError("Request timed out. Please try again.")
        toast({
          title: "Request Timeout",
          description: "The request took too long. Please click Retry to try again.",
          variant: "destructive"
        })
      } else {
        setError("Failed to load data. Please try again.")
        toast({
          title: "Error",
          description: "Failed to load customer accounting data.",
          variant: "destructive"
        })
      }
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
      fetchingRef.current = false
    }
  }, [toast])

  // Initial load -- gate on initialAuthChecked + user (same pattern as all dashboard pages)
  useEffect(() => {
    if (initialAuthChecked && user?.role === "admin") {
      loadCarsWithStats()
    } else if (initialAuthChecked && !user) {
      setLoading(false)
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [initialAuthChecked, user, loadCarsWithStats])

  // Filter cars by search
  const filteredCars = cars.filter(car =>
    car.plate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (car.model_group?.brand || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (car.model_group?.model || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculate global totals for summary card (using existing data)
  const totalCars = cars.length
  const totalBookings = cars.reduce((sum, car) => sum + car.bookingsCount, 0)
  const totalBalance = cars.reduce((sum, car) => sum + car.totalBalance, 0)
  const isPositiveBalance = totalBalance >= 0

  // Handle card click - navigate to car's bookings
  const handleCarClick = (carId: number) => {
    router.push(`/accounting/customer/car/${carId}`)
  }

  if (authLoading || (loading && !error)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#5BC0F8] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading customer accounting...</p>
        </div>
      </div>
    )
  }

  if (user?.role !== "admin") {
    return null
  }

  // Error state with retry
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="p-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-center text-slate-800">Error Loading Data</h2>
            <p className="text-slate-600 text-center">{error}</p>
            <Button
              onClick={loadCarsWithStats}
              className="w-full h-10 text-white font-medium rounded-lg"
              style={{ backgroundColor: "#5BC0F8" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4AB0E8")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5BC0F8")}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Button 
            variant="ghost" 
            onClick={() => router.push("/accounting")} 
            className="mb-2 -ml-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-slate-800">Customer Accounting</h1>
          <p className="text-slate-500 text-sm">Select a vehicle to view booking transactions</p>
        </div>
        <Button
          onClick={loadCarsWithStats}
          variant="outline"
          className="border-slate-200 hover:border-[#5BC0F8] rounded-xl h-10 px-4 bg-transparent"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Reload Data
        </Button>
      </div>

      {/* Summary Header Card */}
      {cars.length > 0 && (
        <Card className={`border-0 shadow-lg overflow-hidden ${isPositiveBalance ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-rose-500 to-red-600"}`}>
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Main KPI - Total Balance */}
              <div className="text-white">
                <p className="text-white/80 text-sm font-medium mb-1">Total Balance</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold">
                    {formatMoney(totalBalance, { showSign: true })}
                  </span>
                  <span className="flex items-center gap-1 text-sm px-2 py-1 rounded-full bg-white/20">
                    {isPositiveBalance ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isPositiveBalance ? "Credit" : "Debit"}
                  </span>
                </div>
              </div>

              {/* Secondary Stats */}
              <div className="flex gap-8">
                <div className="text-white text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-2">
                    <Car className="h-6 w-6" />
                  </div>
                  <p className="text-white/60 text-xs">Total Cars</p>
                  <p className="text-2xl font-bold">{totalCars}</p>
                </div>
                <div className="text-white text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-2">
                    <FileText className="h-6 w-6" />
                  </div>
                  <p className="text-white/60 text-xs">Total Bookings</p>
                  <p className="text-2xl font-bold">{totalBookings}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          type="text"
          placeholder="Search by plate number, brand, or model..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 border-slate-200 focus:border-[#5BC0F8] focus:ring-[#5BC0F8] rounded-xl"
        />
      </div>

      {/* Cars Grid */}
      {filteredCars.length === 0 ? (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
                <Car className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                {searchQuery ? "No Matching Vehicles" : "No Vehicles Found"}
              </h3>
              <p className="text-slate-500 max-w-sm">
                {searchQuery 
                  ? "Try adjusting your search terms to find vehicles"
                  : "There are no vehicles in the system yet"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCars.map((car) => (
            <Card
              key={car.id}
              className="group cursor-pointer border-slate-200 hover:border-[#5BC0F8] transition-all duration-200 hover:shadow-lg hover:-translate-y-1 rounded-[14px] overflow-hidden bg-white"
              onClick={() => handleCarClick(car.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-[#5BC0F8]/10">
                    <Car className="h-6 w-6 text-[#5BC0F8]" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-[#5BC0F8] group-hover:translate-x-1 transition-all" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-800 group-hover:text-[#5BC0F8] transition-colors">
                    {car.plate_number}
                  </h3>
                  <p className="text-sm text-slate-500">{car.model_group?.brand} {car.model_group?.model}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                  <div>
                    <p className="text-slate-400 text-xs">Bookings</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{car.bookingsCount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-xs">Total Balance</p>
                    <p className={`font-semibold mt-0.5 ${car.totalBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatMoney(Math.abs(car.totalBalance))}
                      <span className="text-xs ml-1">{car.totalBalance >= 0 ? "IN" : "OUT"}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
