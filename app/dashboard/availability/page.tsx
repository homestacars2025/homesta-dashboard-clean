"use client"

import type React from "react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useVisibilityRefresh } from "@/hooks/use-visibility-refresh"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Search, ChevronLeft, ChevronRight, X, CarIcon, Calendar, Wrench, DollarSign, RefreshCw } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, isSameDay } from "date-fns"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"

// Types based on database schema
type CarAvailability = {
  car_id: number
  plate_number: string
  model_group_name: string | null
  model_group_image_url: string | null
  status: string | null
}

type CalendarBlock = {
  id?: number
  car_id: number
  start_date: string
  end_date: string
  block_type: string
  plate_number?: string
  model_group_name?: string
}

// Unified status colors matching dashboard
const getStatusBadgeColor = (status: string | null) => {
  const s = status?.toLowerCase()
  switch (s) {
    case "working":
      return "bg-green-100 text-green-700"
    case "parking":
      return "bg-red-100 text-red-700"
    case "maintenance":
      return "bg-gray-100 text-gray-700"
    case "selling":
      return "bg-yellow-100 text-yellow-700"
    case "replacement":
      return "bg-orange-100 text-orange-700"
    default:
      return "bg-gray-100 text-gray-500"
  }
}

const getStatusLabel = (status: string | null) => {
  if (!status) return "-"
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

// Preview color based on hovered action
// EXACT COLOR MAPPING: booking=green, maintenance=grey, selling=red, replacement=orange
const getPreviewStyle = (action: "booking" | "maintenance" | "selling" | "replacement" | null) => {
  const baseClasses = "h-11 w-11 min-w-[44px] max-w-[48px] rounded-xl transition-all duration-200 cursor-pointer text-center text-xs font-semibold border-2 relative shadow-sm"
  
  switch (action) {
    case "booking":
      // GREEN for booking
      return `${baseClasses} bg-green-100 border-green-400 text-green-800`
    case "maintenance":
      // GREY for maintenance
      return `${baseClasses} bg-gray-100 border-gray-400 text-gray-700`
    case "selling":
      // RED for selling
      return `${baseClasses} bg-red-100 border-red-400 text-red-700`
    case "replacement":
      // ORANGE for replacement
      return `${baseClasses} bg-orange-100 border-orange-400 text-orange-800`
    default:
      // Neutral preview - light gray with dashed border
      return `${baseClasses} bg-gray-50 border-gray-300 border-dashed text-gray-700`
  }
}

// Calendar block colors based on block_type from car_calender table ONLY
// EXACT COLOR MAPPING:
// - NO record = RED (parking)
// - booked_confirmed = GREEN
// - selling = RED
// - maintenance = GREY
// - replacement = ORANGE
const getBlockStyle = (blockType: string) => {
  const baseClasses = "h-11 w-11 min-w-[44px] max-w-[48px] rounded-xl transition-all cursor-pointer text-center text-xs font-semibold border relative"
  
  const type = blockType?.toLowerCase() || ""
  
  switch (type) {
    case "booked_confirmed":
      // GREEN for confirmed bookings
      return `${baseClasses} bg-green-100 border-green-300 text-green-800 hover:bg-green-200`
    case "maintenance":
      // GREY for maintenance
      return `${baseClasses} bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200`
    case "selling":
      // RED for selling
      return `${baseClasses} bg-red-100 border-red-300 text-red-700 hover:bg-red-200`
    case "replacement":
      // ORANGE for replacement
      return `${baseClasses} bg-orange-100 border-orange-300 text-orange-800 hover:bg-orange-200`
    default:
      // RED for parking (no record = parking)
      return `${baseClasses} bg-red-100 border-red-300 text-red-700 hover:bg-red-200`
  }
}

export default function AvailabilityPage() {
  const { user, initialAuthChecked } = useAuth()
  const router = useRouter()

  const isInvestor = user?.role === "investor"
  const investorId = user?.investorId

  // State
  const [isReady, setIsReady] = useState(false) // Track if state is fully initialized
  const [cars, setCars] = useState<CarAvailability[]>([])
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const [currentMonth, setCurrentMonth] = useState(() => new Date()) // Use initializer

  const [selection, setSelection] = useState<{
    carId: number
    startDate: Date | null
    endDate: Date | null
  } | null>(null)

  const [showBlockModal, setShowBlockModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState<CalendarBlock | null>(null)

  const [blockForm, setBlockForm] = useState({
    car_id: 0,
    start_date: "",
    end_date: "",
    block_type: "maintenance" as "maintenance" | "selling" | "replacement",
    notes: "",
  })

  // Hovered action for preview color
  const [hoveredAction, setHoveredAction] = useState<"booking" | "maintenance" | "selling" | "replacement" | null>(null)

  const reqRef = useRef(0)
  const loadDataRef = useRef<() => void>(() => {})
  const isFetchingRef = useRef(false)
  const hasLoadedOnceRef = useRef(false)

  // Load data from car_availability view and car_calendar table
  const loadData = useCallback(async () => {
    if (!initialAuthChecked || !user) return
    // Guard: ensure currentMonth is valid before fetching
    if (!(currentMonth instanceof Date) || isNaN(currentMonth.getTime())) {
      return
    }
    const reqId = ++reqRef.current
    isFetchingRef.current = true
    if (!hasLoadedOnceRef.current) setLoading(true)
    setError(null)

    const safetyTimer = setTimeout(() => {
      if (reqId === reqRef.current) {
        setLoading(false)
        setError("Request timed out. Please retry.")
      }
    }, 10000)

    try {
      const supabase = getSupabaseBrowserClient()
      const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd")
      const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd")

      // Proper data source separation:
      // 1. cars table + model_group JOIN for: id, plate_number, model_group_name, image_url
      // 2. car_availability view ONLY for: status

      // 1. Query cars table with model_group join
      const { data: carsData, error: carsError } = await supabase
        .from("cars")
        .select("id, plate_number, model_group_id, model_group(id, name, image_url)")
        .order("plate_number", { ascending: true })

      if (carsError) throw carsError

      const carIds = (carsData || []).map((c: any) => c.id)

      // 2. Query car_availability view ONLY for status
      const { data: availabilityData } = await supabase
        .from("car_availability")
        .select("id, status")
        .in("id", carIds)

      // Create status map
      const statusMap = new Map<number, string | null>()
      ;(availabilityData || []).forEach((a: { id: number; status: string | null }) => {
        statusMap.set(a.id, a.status)
      })

      // Merge data - image_url from model_group, status from car_availability
      const carsWithImages = (carsData || []).map((car: any) => ({
        car_id: car.id,
        plate_number: car.plate_number,
        model_group_name: car.model_group?.name || null,
        model_group_image_url: car.model_group?.image_url || null,
        status: statusMap.get(car.id) || null
      }))

      // Fetch ALL blocks from car_calender table ONLY
      // This includes: booked_confirmed, maintenance, selling, replacement
      // NO data from bookings table - calendar relies 100% on car_calender
      let fetchedBlocks: any[] = []
      
      try {
        const { data: calenderData, error: calenderError } = await supabase
          .from("car_calender")
          .select("id, car_id, start_date, end_date, block_type")
          .in("car_id", carIds)
          .lte("start_date", endDate)
          .gte("end_date", startDate)

        console.log("[v0] car_calender RAW query result:", { data: calenderData, error: calenderError, carIds, startDate, endDate })

        if (calenderError) {
          // Log error but don't throw - calendar should still render with empty blocks
          console.error("[v0] car_calender query error:", calenderError)
        } else {
          // Convert car_calender records to calendar block format
          fetchedBlocks = (calenderData || []).map((c: any) => ({
            id: c.id,
            car_id: c.car_id,
            start_date: c.start_date,
            end_date: c.end_date,
            block_type: c.block_type
          }))
          console.log("[v0] Fetched blocks from car_calender:", fetchedBlocks)
        }
      } catch (calErr) {
        // Gracefully handle car_calender errors - show empty calendar
        console.error("[v0] car_calender fetch failed:", calErr)
      }

      if (reqId !== reqRef.current) return

      setCars(carsWithImages)
      setCalendarBlocks(fetchedBlocks)
      console.log("[v0] State setCalendarBlocks called with:", fetchedBlocks)
      hasLoadedOnceRef.current = true
    } catch (err: any) {
      if (reqId !== reqRef.current) return
      console.error("Error loading data:", err)
      if (!hasLoadedOnceRef.current) {
        setError("Failed to load calendar data. Please try again.")
        toast({
          title: "Error",
          description: "Failed to load calendar data",
          variant: "destructive",
        })
      }
    } finally {
      clearTimeout(safetyTimer)
      if (reqId === reqRef.current) {
        setLoading(false)
        isFetchingRef.current = false
      }
    }
  }, [currentMonth, initialAuthChecked, user, toast])

  // Keep ref updated to latest loadData for visibility refresh
  useEffect(() => {
    loadDataRef.current = loadData
  }, [loadData])

  // Mark component as ready once auth is checked and currentMonth is valid
  useEffect(() => {
    if (initialAuthChecked && currentMonth instanceof Date && !isNaN(currentMonth.getTime())) {
      setIsReady(true)
    }
  }, [initialAuthChecked, currentMonth])

  useEffect(() => {
    if (isReady && user) {
      loadData()
    } else if (initialAuthChecked && !user) {
      setLoading(false)
    }
  }, [loadData, isReady, user])

  // Refresh data when tab becomes visible - pass isFetchingRef to skip if fetch in progress
  useVisibilityRefresh(() => {
    if (!isReady || !user) return
    if (!(currentMonth instanceof Date) || isNaN(currentMonth.getTime())) return
    loadDataRef.current()
  }, isFetchingRef)

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    })
  }, [currentMonth])

  // Debug: Log when calendarBlocks state changes
  useEffect(() => {
    console.log("[v0] calendarBlocks STATE updated:", calendarBlocks)
  }, [calendarBlocks])

  // Get block for a specific car and date
  // Checks if dateStr is between start_date and end_date (inclusive)
  // IMPORTANT: Convert car_id to number (UI may pass string, DB returns number)
  const getBlockForCell = useCallback(
    (carId: number, date: Date): CalendarBlock | null => {
      // Convert cell date to YYYY-MM-DD string
      const cellDateStr = date.toISOString().split("T")[0]
      // Ensure carId is a number (UI might pass string)
      const carIdNum = Number(carId)
      
      // Find block where this date falls between start_date and end_date (inclusive)
      const block = calendarBlocks.find((b) => {
        // Convert block.car_id to number for type-safe comparison
        const blockCarIdNum = Number(b.car_id)
        
        // Debug: log both car_id values and their types
        console.log("[v0] car_id comparison:", { carIdNum, blockCarIdNum, carIdType: typeof carId, blockCarIdType: typeof b.car_id, match: carIdNum === blockCarIdNum })
        
        // Check car_id match first
        if (carIdNum !== blockCarIdNum) return false
        
        // Convert block dates to YYYY-MM-DD strings for proper comparison
        const startStr = new Date(b.start_date).toISOString().split("T")[0]
        const endStr = new Date(b.end_date).toISOString().split("T")[0]
        
        const dateMatch = cellDateStr >= startStr && cellDateStr <= endStr
        
        // Debug log for date comparison
        console.log("[v0] Date match:", { cellDateStr, startStr, endStr, dateMatch, block_type: b.block_type })
        
        return dateMatch
      }) || null
      
      // Debug log result
      console.log(`[v0] getBlockForCell RESULT: date=${cellDateStr}, carId=${carIdNum}, foundBlock:`, block?.block_type || "NO_RECORD")
      
      return block
    },
    [calendarBlocks]
  )

  // Check if cell is selected - must be defined before getCellStyle
  const isCellSelected = useCallback(
    (carId: number, date: Date): boolean => {
      if (!selection || selection.carId !== carId || !selection.startDate) return false

      if (!selection.endDate) {
        return isSameDay(date, selection.startDate)
      }

      const start = selection.startDate <= selection.endDate ? selection.startDate : selection.endDate
      const end = selection.startDate <= selection.endDate ? selection.endDate : selection.startDate

      return date >= start && date <= end
    },
    [selection]
  )

  // Get cell style based on block and preview state
  const getCellStyle = useCallback(
    (carId: number, date: Date) => {
      const block = getBlockForCell(carId, date)
      const isSelected = isCellSelected(carId, date)
      const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")

      const todayRing = isToday ? "ring-2 ring-blue-400 ring-offset-1" : ""

      // If cell is selected, use preview color based on hovered action
      if (isSelected) {
        return `${getPreviewStyle(hoveredAction)} ${todayRing}`
      }

      if (block) {
        return `${getBlockStyle(block.block_type)} ${todayRing}`
      }

      // Default = Parking (RED) - no record in car_calendar means parking
      return `h-11 w-11 min-w-[44px] max-w-[48px] rounded-xl transition-all duration-200 cursor-pointer text-center text-xs font-semibold border relative ${todayRing} bg-red-100 border-red-300 text-red-700 hover:bg-red-200`
    },
    [getBlockForCell, hoveredAction, isCellSelected]
  )

  const handleCellClick = (carId: number, date: Date) => {
    const block = getBlockForCell(carId, date)

    // If there's a block, show detail modal
    if (block) {
      setSelectedBlock(block)
      setShowDetailModal(true)
      return
    }

    // Handle selection for available dates
    if (!selection || !selection.startDate || selection.carId !== carId) {
      setSelection({ carId, startDate: date, endDate: null })
      return
    }

    if (selection.startDate && !selection.endDate && selection.carId === carId) {
      const start = selection.startDate <= date ? selection.startDate : date
      const end = selection.startDate <= date ? date : selection.startDate

      // Check if any day in range has a block
      const hasBlockedDays = eachDayOfInterval({ start, end }).some((day) => {
        return getBlockForCell(carId, day) !== null
      })

      if (hasBlockedDays) {
        toast({
          title: "Selection contains blocked days",
          description: "Please select only available days",
          variant: "destructive",
        })
        setSelection(null)
        return
      }

      setSelection({ carId, startDate: start, endDate: end })
    }
  }

  const clearSelection = () => {
    setSelection(null)
    setHoveredAction(null)
  }

  // Calculate selected days count
  const selectedDaysCount = useMemo(() => {
    if (!selection || !selection.startDate || !selection.endDate) return 0
    const start = selection.startDate <= selection.endDate ? selection.startDate : selection.endDate
    const end = selection.startDate <= selection.endDate ? selection.endDate : selection.startDate
    return eachDayOfInterval({ start, end }).length
  }, [selection])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selection) {
        clearSelection()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selection])

  // Create booking action
  const handleCreateBooking = async () => {
    if (!selection || !selection.startDate || !selection.endDate) return

    const selectedCar = cars.find((c) => c.car_id === selection.carId)
    if (!selectedCar) return

    const start = selection.startDate <= selection.endDate ? selection.startDate : selection.endDate
    const end = selection.startDate <= selection.endDate ? selection.endDate : selection.startDate

    // Navigate to bookings page with pre-filled data
    const params = new URLSearchParams({
      new: "1",
      car_id: selection.carId.toString(),
      start_date: format(start, "yyyy-MM-dd"),
      end_date: format(end, "yyyy-MM-dd"),
    })
    router.push(`/dashboard/bookings?${params.toString()}`)
  }

  // Create block action (maintenance, selling, replacement)
  const handleCreateBlock = (blockType: "maintenance" | "selling" | "replacement") => {
    if (!selection || !selection.startDate || !selection.endDate) return

    const start = selection.startDate <= selection.endDate ? selection.startDate : selection.endDate
    const end = selection.startDate <= selection.endDate ? selection.endDate : selection.startDate

    setBlockForm({
      car_id: selection.carId,
      start_date: format(start, "yyyy-MM-dd"),
      end_date: format(end, "yyyy-MM-dd"),
      block_type: blockType,
      notes: "",
    })
    setShowBlockModal(true)
  }

  // Submit block to car_calender table
  const handleSubmitBlock = async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      
      const { data, error } = await supabase
        .from("car_calender")
        .insert({
          car_id: blockForm.car_id,
          start_date: blockForm.start_date,
          end_date: blockForm.end_date,
          block_type: blockForm.block_type,
        })
        .select()

      if (error) throw error

      toast({ 
        title: "Block created", 
        description: `${blockForm.block_type.charAt(0).toUpperCase() + blockForm.block_type.slice(1)} block created successfully.` 
      })
      setShowBlockModal(false)
      clearSelection()
      loadData() // Refresh calendar
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Failed to create block", 
        variant: "destructive" 
      })
    }
  }

  // Delete block from car_calender table
  const handleDeleteBlock = async (blockId: number | undefined, blockType?: string) => {
    if (!blockId) return

    try {
      const supabase = getSupabaseBrowserClient()
      
      const { error } = await supabase
        .from("car_calender")
        .delete()
        .eq("id", blockId)

      if (error) throw error

      toast({ 
        title: "Block deleted", 
        description: "Block has been removed successfully." 
      })
      setShowDetailModal(false)
      setSelectedBlock(null)
      loadData() // Refresh calendar
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Failed to delete block", 
        variant: "destructive" 
      })
    }
  }

  // Filter and sort cars based on status from car_availability view
  // Sort by model_group_name ASC, then plate_number ASC
  const filteredCars = useMemo(() => {
    let result = [...cars]

    if (searchQuery) {
      result = result.filter(
        (car) =>
          car.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          car.model_group_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((car) => car.status?.toLowerCase() === statusFilter.toLowerCase())
    }

    // Sort by model_group_name ASC, then plate_number ASC
    result.sort((a, b) => {
      const modelA = (a.model_group_name || "").toLowerCase()
      const modelB = (b.model_group_name || "").toLowerCase()
      if (modelA !== modelB) {
        return modelA.localeCompare(modelB)
      }
      return (a.plate_number || "").localeCompare(b.plate_number || "")
    })

    return result
  }, [cars, searchQuery, statusFilter])

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-10" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-80" />
              <Skeleton className="h-10 w-40" />
            </div>
            <div className="bg-white rounded-lg border p-4">
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => loadData()}>Retry</Button>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Availability Calendar</h1>
              <p className="text-gray-600 mt-1">Daily vehicle availability & status management</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-4 py-2 bg-gray-100 rounded-lg font-medium text-sm min-w-[140px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by plate or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-lg"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="working">Working</SelectItem>
                <SelectItem value="parking">Parking</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="selling">Selling</SelectItem>
                <SelectItem value="replacement">Replacement</SelectItem>
              </SelectContent>
            </Select>

            {/* Legend - EXACT colors from car_calender block_type */}
            {/* parking/no record=RED, booked_confirmed=GREEN, maintenance=GREY, selling=RED, replacement=ORANGE */}
            <div className="flex items-center gap-4 ml-auto text-xs flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-400" />
                <span className="text-gray-600">Parking/Selling</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-400" />
                <span className="text-gray-600">Booked</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-gray-400" />
                <span className="text-gray-600">Maintenance</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-orange-400" />
                <span className="text-gray-600">Replacement</span>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
            {/* Selection Action Bar */}
            {selection && selection.startDate && selection.endDate && (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white shadow-2xl rounded-2xl border border-gray-200 p-4 z-50 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-600 font-medium">
                    {format(selection.startDate, "MMM d")} - {format(selection.endDate, "MMM d")}
                  </span>
                  <span className="text-xs text-gray-400">
                    Selected: {selectedDaysCount} {selectedDaysCount === 1 ? "day" : "days"}
                  </span>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <Button 
                  onClick={handleCreateBooking} 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700 rounded-lg transition-all duration-200"
                  onMouseEnter={() => setHoveredAction("booking")}
                  onMouseLeave={() => setHoveredAction(null)}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Booking
                </Button>
                <Button
                  onClick={() => handleCreateBlock("maintenance")}
                  size="sm"
                  variant="outline"
                  className="border-gray-300 hover:bg-gray-100 hover:border-gray-400 rounded-lg transition-all duration-200"
                  onMouseEnter={() => setHoveredAction("maintenance")}
                  onMouseLeave={() => setHoveredAction(null)}
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  Maintenance
                </Button>
                <Button
                  onClick={() => handleCreateBlock("selling")}
                  size="sm"
                  variant="outline"
                  className="border-red-300 hover:bg-red-100 hover:border-red-400 rounded-lg transition-all duration-200"
                  onMouseEnter={() => setHoveredAction("selling")}
                  onMouseLeave={() => setHoveredAction(null)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Selling
                </Button>
                <Button
                  onClick={() => handleCreateBlock("replacement")}
                  size="sm"
                  variant="outline"
                  className="border-orange-300 hover:bg-orange-100 hover:border-orange-400 rounded-lg transition-all duration-200"
                  onMouseEnter={() => setHoveredAction("replacement")}
                  onMouseLeave={() => setHoveredAction(null)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Replacement
                </Button>
                <div className="h-8 w-px bg-gray-200" />
                <Button
                  onClick={clearSelection}
                  size="sm"
                  variant="ghost"
                  className="text-gray-500 hover:text-gray-700 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </Button>
                <span className="text-[10px] text-gray-400 absolute -bottom-5 left-1/2 -translate-x-1/2">Press ESC to cancel</span>
              </div>
            )}

            <div className="min-w-max" style={{ minWidth: `calc(260px + ${calendarDays.length} * 52px)` }}>
              <table className="w-full border-collapse" style={{ borderSpacing: "0 8px" }}>
                <thead className="sticky top-0 bg-white z-10">
                  <tr>
                    <th className="sticky left-0 bg-white border-b border-r p-4 text-left font-semibold text-sm w-64 z-20">
                      Vehicle
                    </th>
                    {calendarDays.map((day) => (
                      <th key={day.toISOString()} className="border-b p-2 text-center min-w-[52px]">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-base font-bold text-gray-900">{format(day, "d")}</span>
                          <span className="text-[10px] text-gray-500 uppercase font-medium">{format(day, "EEE")}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCars.map((car) => (
                    <tr key={car.car_id} className="border-b hover:bg-gray-50/30">
                      <td className="sticky left-0 bg-white border-r p-4 w-64 z-10">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {car.model_group_image_url ? (
                              <img 
                                src={car.model_group_image_url} 
                                alt={car.model_group_name || "Car"} 
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <CarIcon className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 leading-tight truncate">
                              {car.plate_number}
                            </p>
                            <p className="text-xs text-gray-500 leading-tight truncate">
                              {car.model_group_name || "-"}
                            </p>
                            <Badge
                              className={`text-[10px] px-2 py-0.5 w-fit mt-1 border-0 rounded-full font-medium ${getStatusBadgeColor(car.status)}`}
                            >
                              {getStatusLabel(car.status)}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      {calendarDays.map((day) => {
                        const block = getBlockForCell(car.car_id, day)

                        return (
                          <td key={day.toString()} onClick={() => handleCellClick(car.car_id, day)} className="p-1">
                            <div className={getCellStyle(car.car_id, day)}>
                              <div className="flex items-center justify-center h-full">
                                <span className="text-xs font-semibold">{format(day, "d")}</span>
                              </div>
                              {block && block.block_type.includes("booked") && (
                                <div className="absolute top-0 right-0 bg-gray-900 text-white text-[8px] px-1 rounded-bl-md rounded-tr-xl font-medium">
                                  B
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Block Detail Modal */}
          <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Block Details</DialogTitle>
              </DialogHeader>
              {selectedBlock && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Block Type</p>
                    <p className="font-medium capitalize">{selectedBlock.block_type.replace("_", " ")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Vehicle</p>
                    <p className="font-medium">{cars.find(c => c.car_id === selectedBlock.car_id)?.plate_number || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Dates</p>
                    <p className="font-medium">
                      {format(new Date(selectedBlock.start_date), "MMM dd, yyyy")} -{" "}
                      {format(new Date(selectedBlock.end_date), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-2 pt-4">
                    {/* Only show delete for manual blocks (maintenance, selling, replacement) */}
                    {selectedBlock.block_type && !selectedBlock.block_type.includes("booked") ? (
                      <Button
                        onClick={() => handleDeleteBlock(selectedBlock.id, selectedBlock.block_type)}
                        variant="outline"
                        className="flex-1 border-red-300 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        Delete Block
                      </Button>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        Booking blocks must be managed from the Bookings page
                      </p>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Create Block Modal */}
          <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Create {blockForm.block_type.charAt(0).toUpperCase() + blockForm.block_type.slice(1)} Block</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Car</Label>
                  <p className="font-medium">{cars.find((c) => c.car_id === blockForm.car_id)?.plate_number}</p>
                </div>
                <div>
                  <Label>Dates</Label>
                  <p className="font-medium">
                    {blockForm.start_date} - {blockForm.end_date}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={blockForm.notes}
                    onChange={(e) => setBlockForm({ ...blockForm, notes: e.target.value })}
                    placeholder="Add notes (optional)"
                    className="rounded-lg"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBlockModal(false)} className="rounded-lg">
                  Cancel
                </Button>
                <Button onClick={handleSubmitBlock} className="rounded-lg">Create Block</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
