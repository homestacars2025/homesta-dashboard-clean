"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { format } from "date-fns"
import { ArrowLeft, Users, Calendar, TrendingUp, TrendingDown, FileText, RefreshCw, AlertCircle, Car } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useCurrency } from "@/lib/currency-context"
import { withSessionRetry } from "@/lib/with-session-retry"

interface BookingWithBalance {
  id: number
  booking_number: string
  start_date: string
  end_date: string
  customer: {
    first_name: string
    last_name: string
  } | null
  balance: number
}

interface CarInfo {
  id: number
  plate_number: string
  model_group: { name: string; brand: string; model: string } | null
}

const FETCH_TIMEOUT = 10000

export default function CarBookingsPage() {
  const router = useRouter()
  const params = useParams()
  const carId = params.carId as string
  const { user, isLoading: authLoading, initialAuthChecked } = useAuth()
  const { toast } = useToast()
  const { formatMoney } = useCurrency()
  
  const [car, setCar] = useState<CarInfo | null>(null)
  const [bookings, setBookings] = useState<BookingWithBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const fetchingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // SECURITY: Only admin can access
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role !== "admin") {
        router.replace("/general")
      }
    }
  }, [user, authLoading, router])

  const loadBookings = useCallback(async () => {
    if (fetchingRef.current || !carId) return
    fetchingRef.current = true

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setLoading(true)
    setError(null)

    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }, FETCH_TIMEOUT)

    try {
      const supabase = getSupabaseBrowserClient()

      // Load car info (withSessionRetry auto-refreshes token on 401)
      const { data: carData, error: carError } = await withSessionRetry(() =>
        supabase.from("cars").select("id, plate_number, model_group(name, brand, model)").eq("id", parseInt(carId)).single()
      )

      if (carError) throw carError
      setCar(carData)

      // Load bookings for this car
      const { data: bookingsData, error: bookingsError } = await withSessionRetry(() =>
        supabase
          .from("bookings")
          .select(`
            id,
            booking_number,
            start_date,
            end_date,
            customers!bookings_customer_id_fkey(first_name, last_name)
          `)
          .eq("car_id", parseInt(carId))
          .order("start_date", { ascending: false })
      )

      if (bookingsError) throw bookingsError

      // Load ledger data for all bookings
      const bookingIds = (bookingsData || []).map(b => b.id)
      const { data: ledgerData } = await withSessionRetry(() =>
        supabase
          .from("customer_accounting_ledger")
          .select("booking_id, amount, direction")
          .in("booking_id", bookingIds.length > 0 ? bookingIds : [0])
      )

      // Calculate balance for each booking
      const bookingsWithBalance: BookingWithBalance[] = (bookingsData || []).map(booking => {
        const bookingLedger = (ledgerData || []).filter(l => l.booking_id === booking.id)
        const balance = bookingLedger.reduce((sum, entry) => {
          return entry.direction === "IN" ? sum + Number(entry.amount) : sum - Number(entry.amount)
        }, 0)

        return {
          ...booking,
          balance
        }
      })

      setBookings(bookingsWithBalance)
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("Request timed out. Please try again.")
        toast({
          title: "Request Timeout",
          description: "The request took too long. Please click Retry.",
          variant: "destructive"
        })
      } else {
        setError("Failed to load bookings. Please try again.")
        toast({
          title: "Error",
          description: "Failed to load booking data.",
          variant: "destructive"
        })
      }
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
      fetchingRef.current = false
    }
  }, [carId, toast])

  useEffect(() => {
    if (initialAuthChecked && user?.role === "admin" && carId) {
      loadBookings()
    } else if (initialAuthChecked && !user) {
      setLoading(false)
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [initialAuthChecked, user, carId, loadBookings])

  // Calculate totals
  const totalPositive = bookings.reduce((sum, b) => b.balance > 0 ? sum + b.balance : sum, 0)
  const totalNegative = bookings.reduce((sum, b) => b.balance < 0 ? sum + Math.abs(b.balance) : sum, 0)

  if (authLoading || (loading && !error)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#5BC0F8] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading bookings...</p>
        </div>
      </div>
    )
  }

  if (user?.role !== "admin") {
    return null
  }

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
              onClick={loadBookings}
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
            onClick={() => router.push("/accounting/customer")} 
            className="mb-2 -ml-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vehicles
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#5BC0F8]/10">
              <Car className="h-6 w-6 text-[#5BC0F8]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{car?.plate_number}</h1>
              <p className="text-slate-500 text-sm">{car?.model_group?.brand} {car?.model_group?.model}</p>
            </div>
          </div>
        </div>
        <Button
          onClick={loadBookings}
          variant="outline"
          className="border-slate-200 hover:border-[#5BC0F8] rounded-xl h-10 px-4 bg-transparent"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Reload Data
        </Button>
      </div>

      {/* Summary Cards */}
      {bookings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-slate-800">Summary</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-slate-50 to-white">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-slate-600" />
                  </div>
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-full">Total</span>
                </div>
                <p className="text-slate-500 text-xs mb-1">Total Bookings</p>
                <p className="text-2xl font-bold text-slate-800">{bookings.length}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-emerald-50 to-white">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Income</span>
                </div>
                <p className="text-slate-500 text-xs mb-1">Total Credits</p>
                <p className="text-2xl font-bold text-emerald-600">{formatMoney(totalPositive)}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-rose-50 to-white">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-rose-600" />
                  </div>
                  <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-full">Expense</span>
                </div>
                <p className="text-slate-500 text-xs mb-1">Total Debits</p>
                <p className="text-2xl font-bold text-rose-600">{formatMoney(totalNegative)}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Bookings Table */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-violet-500 rounded-full"></div>
          <h2 className="text-lg font-semibold text-slate-800">Bookings History</h2>
        </div>
        <Card className="border-0 shadow-lg bg-white overflow-hidden">
          <CardContent className="p-0">
            {bookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">No Bookings Found</h3>
                <p className="text-slate-500 text-sm">This car has no booking history yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="text-slate-600 font-semibold">Booking Number</TableHead>
                    <TableHead className="text-slate-600 font-semibold">Customer</TableHead>
                    <TableHead className="text-slate-600 font-semibold">Period</TableHead>
                    <TableHead className="text-right text-slate-600 font-semibold">Balance</TableHead>
                    <TableHead className="text-right text-slate-600 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => (
                    <TableRow
                      key={booking.id}
                      className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                      onClick={() => router.push(`/accounting/customer/${booking.id}`)}
                    >
                      <TableCell>
                        <span className="font-semibold text-slate-800">#{booking.booking_number}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <Users className="h-4 w-4 text-slate-500" />
                          </div>
                          <span className="text-slate-600">
                            {booking.customer
                              ? `${booking.customer.first_name} ${booking.customer.last_name}`
                              : "N/A"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {format(new Date(booking.start_date), "MMM dd")} - {format(new Date(booking.end_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center gap-1 font-semibold px-2 py-1 rounded-full text-sm ${
                          booking.balance > 0 
                            ? "bg-emerald-50 text-emerald-600" 
                            : booking.balance < 0 
                              ? "bg-rose-50 text-rose-600" 
                              : "bg-slate-100 text-slate-600"
                        }`}>
                          {booking.balance > 0 && <TrendingUp className="h-3 w-3" />}
                          {booking.balance < 0 && <TrendingDown className="h-3 w-3" />}
                          {formatMoney(Math.abs(booking.balance))}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="h-8 px-3 text-white font-medium rounded-lg shadow-sm"
                          style={{ backgroundColor: "#5BC0F8" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4AB0E8")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5BC0F8")}
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/accounting/customer/${booking.id}`)
                          }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
