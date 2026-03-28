"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { dataService } from "@/lib/data-service"
import { withTimeout } from "@/lib/utils"
import { useVisibilityRefresh } from "@/hooks/use-visibility-refresh"
import { useAuth } from "@/lib/auth-context"
import type { DashboardStats, BookingWithCar, MaintenanceWithCar } from "@/lib/types"
import { Car, Calendar, Wrench, DollarSign, TrendingUp, Clock, ArrowRight, RefreshCw } from "lucide-react"
import Link from "next/link"
import { format, isValid } from "date-fns"

export default function DashboardPage() {
  const { initialAuthChecked, user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentBookings, setRecentBookings] = useState<BookingWithCar[]>([])
  const [upcomingMaintenance, setUpcomingMaintenance] = useState<MaintenanceWithCar[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const fetchIdRef = useRef(0)
  const mountedRef = useRef(true)
  const loadDashboardRef = useRef<() => void>(() => {})
  const isFetchingRef = useRef(false)
  // Only show the full-screen spinner on the very first load.
  // Background refreshes (tab focus) update state silently so existing
  // data stays visible instead of being replaced by a blank spinner.
  const hasLoadedOnceRef = useRef(false)

  const loadDashboard = useCallback(async () => {
    if (!initialAuthChecked || !user) {
      console.log("[dashboard] loadDashboard: skipping — initialAuthChecked:", initialAuthChecked, "user:", !!user)
      return
    }

    // Increment fetch ID so stale responses are ignored
    const currentFetchId = ++fetchIdRef.current
    isFetchingRef.current = true
    const isBackground = hasLoadedOnceRef.current
    console.log(`[dashboard] loadDashboard: starting fetch #${currentFetchId} (${isBackground ? "background refresh" : "first load"})`)

    // Only blank the screen on the very first load; subsequent refreshes
    // (e.g. returning to a tab) update data silently in the background.
    if (!hasLoadedOnceRef.current) setIsLoading(true)
    setLoadError(false)

    // Safety timeout: force loading to end after 10 seconds no matter what
    const safetyTimer = setTimeout(() => {
      if (fetchIdRef.current === currentFetchId && mountedRef.current) {
        console.warn(`[dashboard] safety timeout hit for fetch #${currentFetchId}`)
        setIsLoading(false)
        // Only show the error screen if we have never successfully loaded data
        if (!hasLoadedOnceRef.current) setLoadError(true)
      }
    }, 10000)

    try {
      const [statsData, bookingsData, maintenanceData] = await withTimeout(
        Promise.all([
          dataService.getDashboardStats(),
          dataService.getBookingsWithCars(),
          dataService.getMaintenanceWithCars(),
        ]),
      )

      // Only update state if this is still the latest fetch and component is mounted
      if (fetchIdRef.current === currentFetchId && mountedRef.current) {
        console.log(`[dashboard] fetch #${currentFetchId} succeeded — updating data`)
        hasLoadedOnceRef.current = true
        setStats(statsData)
        setRecentBookings(bookingsData.slice(0, 3))
        setUpcomingMaintenance(
          maintenanceData.filter((m) => m.status === "scheduled" || m.status === "in-progress").slice(0, 3),
        )
        setLoadError(false)
      } else {
        console.log(`[dashboard] fetch #${currentFetchId} result discarded (stale or unmounted)`)
      }
    } catch (error) {
      if (fetchIdRef.current === currentFetchId && mountedRef.current) {
        console.error(`[dashboard] fetch #${currentFetchId} failed:`, error)
        setLoadError(true)
      }
    } finally {
      clearTimeout(safetyTimer)
      if (fetchIdRef.current === currentFetchId && mountedRef.current) {
        console.log(`[dashboard] fetch #${currentFetchId} done — isLoading=false`)
        setIsLoading(false)
        isFetchingRef.current = false
      }
    }
  }, [initialAuthChecked, user])

  // Keep ref updated to latest loadDashboard for visibility refresh
  useEffect(() => {
    loadDashboardRef.current = loadDashboard
  }, [loadDashboard])

  useEffect(() => {
    mountedRef.current = true
    console.log("[dashboard] auth state changed — initialAuthChecked:", initialAuthChecked, "user:", user ? user.id : "null")
    if (initialAuthChecked && user) {
      loadDashboard()
    } else if (initialAuthChecked && !user) {
      // Auth resolved but no user — stop the loading spinner.
      // ProtectedRoute will handle the redirect to /login.
      console.log("[dashboard] auth resolved with no user — stopping loading, ProtectedRoute will redirect")
      setIsLoading(false)
    }
    return () => {
      mountedRef.current = false
    }
  }, [initialAuthChecked, user, loadDashboard])

  // Refresh data when tab becomes visible - pass isFetchingRef to skip if fetch in progress
  useVisibilityRefresh(() => {
    console.log("[dashboard] tab visible — initialAuthChecked:", initialAuthChecked, "user:", user ? user.id : "null")
    if (!initialAuthChecked || !user) {
      console.log("[dashboard] tab visible: skipping data refresh — auth not ready or no user")
      return
    }
    loadDashboardRef.current()
  }, isFetchingRef)

  if (isLoading) {
    return (
 <ProtectedRoute allowedRoles={["admin"]}>
  <DashboardLayout>
  <div className="flex items-center justify-center min-h-[400px]">

            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (loadError && !stats) {
    return (
 <ProtectedRoute allowedRoles={["admin"]}>
  <DashboardLayout>
  <div className="flex items-center justify-center min-h-[400px]">

            <div className="text-center">
              <p className="text-muted-foreground mb-4">Failed to load dashboard data.</p>
              <Button onClick={loadDashboard} variant="outline" className="gap-2 bg-transparent">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
 <ProtectedRoute allowedRoles={["admin"]}>
  <DashboardLayout>
  <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back! Here's your fleet overview</p>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Fleet</CardTitle>
                <Car className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stats?.total_fleet ?? 0}</div>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="text-green-600 font-medium">{stats?.available_cars ?? 0} available</span>
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Active Bookings</CardTitle>
                <Calendar className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stats?.active_bookings ?? 0}</div>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">{stats?.occupancy_rate ?? 0}%</span> occupancy rate
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Maintenance Due</CardTitle>
                <Wrench className="h-5 w-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stats?.maintenance_due ?? 0}</div>
                <p className="text-sm text-gray-600 mt-1">requires attention</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Revenue (Month)</CardTitle>
                <DollarSign className="h-5 w-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">${(stats?.revenue_month ?? 0).toLocaleString()}</div>
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span className="font-medium">+12%</span> from last month
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Bookings */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Bookings</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Latest rental activity</p>
                </div>
                <Link href="/dashboard/bookings">
                  <Button variant="ghost" size="sm">
                    View All
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentBookings.map((booking) => (
                    <div key={booking.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Car className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">
                              {booking.car.model_group?.brand} {booking.car.model_group?.model}
                            </p>
                            <p className="text-sm text-gray-600">{booking.customer_name}</p>
                          </div>
                          <Badge
                            variant={
                              booking.booking_status === "confirmed"
                                ? "default"
                                : booking.booking_status === "pending"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="flex-shrink-0"
                          >
                            {booking.booking_status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>
                            {booking.pickup_date && isValid(new Date(booking.pickup_date))
                              ? format(new Date(booking.pickup_date), "MMM d")
                              : "N/A"}{" "}
                            -{" "}
                            {booking.return_date && isValid(new Date(booking.return_date))
                              ? format(new Date(booking.return_date), "MMM d")
                              : "N/A"}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="font-medium text-gray-700">${booking.total_amount ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Maintenance */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Upcoming Maintenance</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Scheduled service tasks</p>
                </div>
                <Link href="/dashboard/operations">
                  <Button variant="ghost" size="sm">
                    View All
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingMaintenance.map((maintenance) => (
                    <div key={maintenance.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                      <div
                        className={`h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          maintenance.status === "in-progress" ? "bg-orange-100" : "bg-gray-100"
                        }`}
                      >
                        <Wrench
                          className={`h-6 w-6 ${
                            maintenance.status === "in-progress" ? "text-orange-600" : "text-gray-600"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">
                              {maintenance.car.model_group?.brand} {maintenance.car.model_group?.model}
                            </p>
                            <p className="text-sm text-gray-600">{maintenance.description}</p>
                          </div>
                          <Badge
                            variant={maintenance.status === "in-progress" ? "default" : "secondary"}
                            className="flex-shrink-0"
                          >
                            {maintenance.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>
                            {maintenance.scheduled_date && isValid(new Date(maintenance.scheduled_date))
                              ? format(new Date(maintenance.scheduled_date), "MMM d, h:mm a")
                              : "Not scheduled"}
                          </span>
                          {maintenance.technician && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span>{maintenance.technician}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Frequently used shortcuts</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <Link href="/dashboard/bookings">
                  <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4 bg-transparent">
                    <Calendar className="h-6 w-6 text-blue-600" />
                    <span className="font-medium">New Booking</span>
                  </Button>
                </Link>
                <Link href="/dashboard/fleet">
                  <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4 bg-transparent">
                    <Car className="h-6 w-6 text-green-600" />
                    <span className="font-medium">Manage Fleet</span>
                  </Button>
                </Link>
                <Link href="/dashboard/operations">
                  <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4 bg-transparent">
                    <Wrench className="h-6 w-6 text-orange-600" />
                    <span className="font-medium">Schedule Maintenance</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
