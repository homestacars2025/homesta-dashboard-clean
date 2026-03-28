"use client"

import { Calendar } from "@/components/ui/calendar"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Plus,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Edit,
  Trash2,
  User,
  CarIcon,
  Search,
  Download,
  FileDown,
  ArrowUpDown,
  XCircle,
  FileText,
  Car,
  Shield,
  MapPin,
  Fuel,
  Calendar as CalendarIcon,
  Phone,
  Globe,
  Loader2,
} from "lucide-react"
import { format, addMonths, startOfMonth, endOfMonth } from "date-fns"
import { useRouter, useSearchParams } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { dataService } from "@/lib/data-service"
import { withTimeout, checkSupabaseConnectivity, safeSupabaseCall } from "@/lib/utils"
import { useVisibilityRefresh } from "@/hooks/use-visibility-refresh"
import type { Location } from "@/lib/database.types"
import { useToast } from "@/hooks/use-toast"

type BookingStatus = "pending" | "confirmed" | "cancelled"
type BookingType = "STANDARD"
type FuelLevel = "ZERO" | "QUARTER" | "HALF" | "THREE_QUARTERS" | "FULL"

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahrain",
  "Bangladesh",
  "Belarus",
  "Belgium",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Brazil",
  "Bulgaria",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "Estonia",
  "Ethiopia",
  "Finland",
  "France",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kuwait",
  "Kyrgyzstan",
  "Latvia",
  "Lebanon",
  "Libya",
  "Lithuania",
  "Luxembourg",
  "Malaysia",
  "Malta",
  "Mexico",
  "Moldova",
  "Mongolia",
  "Morocco",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palestine",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Thailand",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "UAE",
  "Ukraine",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Venezuela",
  "Vietnam",
  "Yemen",
]

interface BookingRow {
  id: number
  booking_number: string
  status: BookingStatus
  car_id: number
  customer_id: string | null // Change from number to string (UUID)
  start_date: string
  end_date: string
  insurance_type: string
  pickupLocation: string | null
  dropoffLocation: string | null
  additional_driver_id: string | null // Change from number to string (UUID)
  fuel_level: FuelLevel | null
  notes: string | null
  created_at: string
  kabis_reported: boolean
  invoice_issued: boolean
}

interface BookingWithDetails extends BookingRow {
  car: {
    plate_number: string
  }
  customer: {
    id: string // Changed from number to string (UUID)
    first_name: string
    last_name: string
  } | null // Changed to allow null
}

interface Customer {
  id: string // Change from number to string (UUID)
  id_number: string
  first_name: string
  last_name: string
  nationality: string | null
  id_type: string | null
  driving_license_number: string | null
  phone: string | null
  address: string | null
  notes: string | null
}

interface CarData {
  id: number
  plate_number: string
  model_group: { name: string } | null
}

export default function BookingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { initialAuthChecked, user } = useAuth()
  const [isReady, setIsReady] = useState(false) // Track if state is fully initialized
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [selectedMonth, setSelectedMonth] = useState(() => new Date()) // Use initializer to ensure consistent state
  const [statusFilter, setStatusFilter] = useState<"ALL" | BookingStatus>("ALL")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingBooking, setEditingBooking] = useState<BookingWithDetails | null>(null)
  const [bookingToDelete, setBookingToDelete] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [selectedBookings, setSelectedBookings] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<"booking_number" | "start_date" | "end_date" | "customer" | "kabis_reported" | "invoice_issued" | null>("start_date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const [cars, setCars] = useState<CarData[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [locationsLoading, setLocationsLoading] = useState(true)
  const [locationsError, setLocationsError] = useState<string | null>(null)
  const [insuranceTypes, setInsuranceTypes] = useState<{ label: string; value: string }[]>([])
  const [fuelLevelOptions, setFuelLevelOptions] = useState<{ label: string; value: FuelLevel }[]>([])
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null)

  const [formData, setFormData] = useState({
    // Customer info (Main Driver)
    customer_first_name: "",
    customer_last_name: "",
    customer_phone: "",
    customer_id_number: "",
    customer_id_type: "PASSPORT",
    customer_nationality: "",
    customer_driving_license_number: "",
    customer_address: "",
    customer_notes: "",
    // Additional Driver info
    has_additional_driver: false,
    additional_driver_first_name: "",
    additional_driver_last_name: "",
    additional_driver_phone: "",
    additional_driver_id_number: "",
    additional_driver_id_type: "PASSPORT",
    additional_driver_nationality: "",
    additional_driver_driving_license_number: "",
    additional_driver_address: "",
  // Booking info
  car_id: "",
  booking_status: "pending" as BookingStatus,
  booking_number: "",
  // Rental details
    insurance_type: "",
    additional_service: "",
    start_date: "",
    end_date: "",
    pickup_location: "",
    dropoff_location: "",
    fuel_level: "",
    notes: "",
    // Financial info
    rental_amount: "",
    paid_amount: "",
    deposit_amount: "",
    financial_note: "",
  })

  // Mark component as ready once auth is checked and selectedMonth is valid
  useEffect(() => {
    if (initialAuthChecked && selectedMonth instanceof Date && !isNaN(selectedMonth.getTime())) {
      setIsReady(true)
    }
  }, [initialAuthChecked, selectedMonth])

  // Load bookings for the selected month — only after auth is ready
  useEffect(() => {
    if (isReady && user) {
      loadBookings()
    } else if (initialAuthChecked && !user) {
      setIsLoading(false)
    }
  }, [selectedMonth, isReady, user])

  // Refs must be declared before useVisibilityRefresh which uses isFetchingRef
  const bookingsReqRef = useRef(0)
  const loadBookingsRef = useRef<() => void>(() => {})
  const isFetchingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const hasLoadedOnceRef = useRef(false)

  // Refresh data when tab becomes visible - use ref to always call latest version
  // Pass isFetchingRef to skip refresh if a fetch is already in progress
  useVisibilityRefresh(() => {
    if (!isReady || !user) return
    if (!(selectedMonth instanceof Date) || isNaN(selectedMonth.getTime())) return
    loadBookingsRef.current()
  }, isFetchingRef)

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const carId = searchParams.get("car_id") || ""
      const startDate = searchParams.get("start_date") || ""
      const endDate = searchParams.get("end_date") || ""

      setFormData((prev) => ({
        ...prev,
        car_id: carId,
        start_date: startDate,
        end_date: endDate,
      }))
      setIsAddDialogOpen(true)

      router.replace("/dashboard/bookings", { scroll: false })
    }
  }, [])

  // Load cars and insurance types when dialog opens
  useEffect(() => {
    if (isAddDialogOpen || editingBooking) {
      loadData()
    }
  }, [isAddDialogOpen, editingBooking])

  const loadBookings = useCallback(async () => {
    // Guard: ensure selectedMonth is valid before fetching
    if (!(selectedMonth instanceof Date) || isNaN(selectedMonth.getTime())) {
      return
    }
    
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    
    const reqId = ++bookingsReqRef.current
    isFetchingRef.current = true
    if (!hasLoadedOnceRef.current) setIsLoading(true)
    setLoadError(null)
    // Safety timeout: loading MUST end within 10 seconds
    const safetyTimer = setTimeout(() => {
      if (reqId === bookingsReqRef.current) {
        setIsLoading(false)
        setLoadError("Request timed out. Please retry.")
      }
    }, 10000)
    try {
      const supabase = getSupabaseBrowserClient()
      const startDate = format(startOfMonth(selectedMonth), "yyyy-MM-dd")
      const endDate = format(endOfMonth(selectedMonth), "yyyy-MM-dd")

      // Date overlap: show bookings that overlap with selected month
      // (start_date <= endDate AND end_date >= startDate)
      const [bookingsResult, carsResult, customersResult]: any[] = await withTimeout(
        Promise.all([
          supabase
            .from("bookings")
            .select("*")
            .lte("start_date", endDate)
            .gte("end_date", startDate)
            .order("start_date", { ascending: false }),
          supabase.from("cars").select("id, plate_number, model_group:model_group_id(brand, model)"),
          supabase.from("customers").select("id, first_name, last_name"),
        ]),
      )

      if (bookingsResult.error) throw bookingsResult.error

      const carsMap = new Map((carsResult.data || []).map((c: any) => [c.id, {
        ...c,
        brand: c.model_group?.brand || "",
        model: c.model_group?.model || "",
      }]))
      const customersMap = new Map((customersResult.data || []).map((c: any) => [c.id, c]))

      const bookingsWithDetails = (bookingsResult.data || []).map((booking: any) => ({
        ...booking,
        car: carsMap.get(booking.car_id) || { plate_number: "Unknown" },
        customer: booking.customer_id
          ? customersMap.get(booking.customer_id) || { id: "-1", first_name: "Customer", last_name: "Missing" }
          : null,
      }))

      if (reqId !== bookingsReqRef.current) return
      setBookings(bookingsWithDetails as BookingWithDetails[])
      hasLoadedOnceRef.current = true
    } catch (error: any) {
      if (error?.name === "AbortError") return
      if (reqId !== bookingsReqRef.current) return
      const isTimeout = error?.message?.startsWith("TIMEOUT")
      if (!hasLoadedOnceRef.current) {
        setLoadError(isTimeout ? "Request timed out. Please retry." : "Failed to load bookings. Please try again.")
        toast({
          title: isTimeout ? "Timeout" : "Error",
          description: isTimeout ? "Network timeout — please retry." : "Failed to load bookings.",
          variant: "destructive",
        })
      }
    } finally {
      clearTimeout(safetyTimer)
      if (reqId === bookingsReqRef.current) {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    }
  }, [selectedMonth, toast])

  // Keep ref updated to latest loadBookings for visibility refresh
  useEffect(() => {
    loadBookingsRef.current = loadBookings
  }, [loadBookings])

  const loadData = async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: carsData } = await withTimeout(
        supabase.from("cars").select("id, plate_number, model_group_id, model_group(name)")
          .order("model_group_id", { ascending: true })
          .order("plate_number", { ascending: true }) as unknown as Promise<{ data: any[] | null; error: any }>
      )
      setCars(carsData || [])

      setLocationsLoading(true)
      setLocationsError(null)
      try {
        const locationsData = await withTimeout(dataService.getLocations())
        setLocations(locationsData || [])
      } catch (error) {
        setLocationsError("Unable to load locations")
      } finally {
        setLocationsLoading(false)
      }

      // Set static options inside try block so they always get set
      setInsuranceTypes([
        { label: "Trafik Sigorta", value: "TRAFFIC" },
        { label: "Full Kasko", value: "FULL_KASKO" },
      ])
      setFuelLevelOptions([
        { label: "0%", value: "ZERO" },
        { label: "25%", value: "QUARTER" },
        { label: "50%", value: "HALF" },
        { label: "75%", value: "THREE_QUARTERS" },
        { label: "100%", value: "FULL" },
      ])
    } catch {
      // Data loading for dialog failed, not critical
    }
  }

  const handleTcBlur = async () => {
    if (!formData.customer_id_number || editingBooking) return // Don't fetch if in edit mode or no ID

    const existingCustomer = await dataService.findCustomerByIdNumber(formData.customer_id_number)

    if (existingCustomer) {
      setExistingCustomer(existingCustomer)
      setFormData((prev) => ({
        ...prev,
        customer_first_name: existingCustomer.first_name,
        customer_last_name: existingCustomer.last_name,
        customer_nationality: existingCustomer.nationality || "",
        customer_id_type: existingCustomer.id_type || "PASSPORT",
        customer_driving_license_number: existingCustomer.driving_license_number || "",
        customer_phone: existingCustomer.phone || "",
        customer_address: existingCustomer.address || "",
        customer_notes: existingCustomer.notes || "",
      }))
    } else {
      setExistingCustomer(null)
      // Clear fields if customer not found and not in edit mode
      setFormData((prev) => ({
        ...prev,
        customer_first_name: "",
        customer_last_name: "",
        customer_nationality: "",
        customer_id_type: "PASSPORT",
        customer_driving_license_number: "",
        customer_phone: "",
        customer_address: "",
        customer_notes: "",
      }))
    }
  }

  const handleEdit = async (booking: BookingWithDetails) => {
    try {
      if (!booking || !booking.id) {
        toast({
          title: "Error",
          description: "Invalid booking data",
          variant: "destructive",
        })
        return
      }

      if (booking.customer_id && booking.customer_id !== null && booking.customer_id !== "-1") {
        const supabase = getSupabaseBrowserClient()
        const { data: customer, error } = await (supabase
          .from("customers")
          .select("*")
          .eq("id", booking.customer_id)
          .single() as unknown as Promise<{ data: any; error: any }>)

        if (error) {
          toast({
            title: "Warning",
            description: "Customer details not found. You can add or update them.",
            variant: "default",
          })
        }

        let additionalDriver = null
        if (booking.additional_driver_id) {
          const { data: addDriver, error: addDriverError } = await (supabase
            .from("customers")
            .select("*")
            .eq("id", booking.additional_driver_id)
            .single() as unknown as Promise<{ data: any; error: any }>)

          if (!addDriverError && addDriver) {
            additionalDriver = addDriver
          }
        }

        setFormData({
          customer_first_name: customer?.first_name || "",
          customer_last_name: customer?.last_name || "",
          customer_phone: customer?.phone || "",
          customer_id_number: customer?.id_number || "",
          customer_id_type: customer?.id_type || "PASSPORT",
          customer_nationality: customer?.nationality || "",
          customer_driving_license_number: customer?.driving_license_number || "",
          customer_address: customer?.address || "",
          customer_notes: customer?.notes || "",
          has_additional_driver: !!booking.additional_driver_id,
          additional_driver_first_name: additionalDriver?.first_name || "",
          additional_driver_last_name: additionalDriver?.last_name || "",
          additional_driver_phone: additionalDriver?.phone || "",
          additional_driver_id_number: additionalDriver?.id_number || "",
          additional_driver_id_type: additionalDriver?.id_type || "PASSPORT",
          additional_driver_nationality: additionalDriver?.nationality || "",
          additional_driver_driving_license_number: additionalDriver?.driving_license_number || "",
          additional_driver_address: additionalDriver?.address || "",
  car_id: String(booking.car_id || ""),
  booking_status: booking.status || "pending",
  booking_number: booking.booking_number || "",
  insurance_type: booking.insurance_type || "",
  additional_service: (booking as any).additional_service || "",
  start_date: booking.start_date || "",
  end_date: booking.end_date || "",
  pickup_location: booking.pickupLocation || "",
  dropoff_location: booking.dropoffLocation || "",
  fuel_level: booking.fuel_level || "",
          notes: booking.notes || "",
          // Financial info
          rental_amount: "",
          paid_amount: "",
          deposit_amount: "",
          financial_note: "",
        })
      } else {
        setFormData({
          customer_first_name: "",
          customer_last_name: "",
          customer_phone: "",
          customer_id_number: "",
          customer_id_type: "PASSPORT",
          customer_nationality: "",
          customer_driving_license_number: "",
          customer_address: "",
          customer_notes: "",
          has_additional_driver: false,
          additional_driver_first_name: "",
          additional_driver_last_name: "",
          additional_driver_phone: "",
          additional_driver_id_number: "",
          additional_driver_id_type: "PASSPORT",
          additional_driver_nationality: "",
          additional_driver_driving_license_number: "",
          additional_driver_address: "",
  car_id: String(booking.car_id),
  booking_status: booking.status,
  booking_number: booking.booking_number || "",
  insurance_type: booking.insurance_type,
          start_date: booking.start_date,
          end_date: booking.end_date,
          pickup_location: booking.pickupLocation || "",
          dropoff_location: booking.dropoffLocation || "",
          fuel_level: booking.fuel_level || "",
          notes: booking.notes || "",
          // Financial info
          rental_amount: "",
          paid_amount: "",
          deposit_amount: "",
          financial_note: "",
        })
      }

      setEditingBooking(booking)
      setIsAddDialogOpen(true)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load booking for editing",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!bookingToDelete) return

    setIsDeleting(true)
    try {
      const success = await dataService.deleteBooking(bookingToDelete)

      if (success) {
        toast({
          title: "Success",
          description: "Booking deleted successfully",
        })
        await loadBookings()
      } else {
        throw new Error("Deletion failed on server.")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setBookingToDelete(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // MINIMAL validation - only truly required fields
    if (!formData.car_id || formData.car_id === "") {
      toast({ title: "Error", description: "Please select a car", variant: "destructive" })
      return
    }
    if (!formData.start_date || formData.start_date === "") {
      toast({ title: "Error", description: "Please select a start date", variant: "destructive" })
      return
    }
    if (!formData.end_date || formData.end_date === "") {
      toast({ title: "Error", description: "Please select an end date", variant: "destructive" })
      return
    }
    if (!formData.customer_id_number || formData.customer_id_number.trim() === "") {
      toast({ title: "Error", description: "Please enter customer ID number", variant: "destructive" })
      return
    }
    if (!formData.customer_first_name || formData.customer_first_name.trim() === "") {
      toast({ title: "Error", description: "Please enter customer first name", variant: "destructive" })
      return
    }
    if (!formData.customer_last_name || formData.customer_last_name.trim() === "") {
      toast({ title: "Error", description: "Please enter customer last name", variant: "destructive" })
      return
    }
    if (!formData.customer_phone || formData.customer_phone.trim() === "") {
      toast({ title: "Error", description: "Please enter customer phone", variant: "destructive" })
      return
    }

    if (editingBooking) {
      setIsSubmitting(true)

      try {
        let customerIdToUpdate = editingBooking.customer_id

        if (
          !customerIdToUpdate ||
          customerIdToUpdate === null ||
          customerIdToUpdate === "null" ||
          customerIdToUpdate === ""
        ) {
          const existingCustomer = await dataService.findCustomerByIdNumber(formData.customer_id_number)

          if (existingCustomer) {
            customerIdToUpdate = existingCustomer.id
            await dataService.updateCustomer(customerIdToUpdate, {
              first_name: formData.customer_first_name,
              last_name: formData.customer_last_name,
              phone: formData.customer_phone,
              nationality: formData.customer_nationality || null,
              id_type: formData.customer_id_type,
              driving_license_number: formData.customer_driving_license_number || null,
              address: formData.customer_address || null,
              notes: formData.customer_notes || null,
            })
          } else {
            const customerData = {
              id_number: formData.customer_id_number,
              first_name: formData.customer_first_name,
              last_name: formData.customer_last_name,
              phone: formData.customer_phone,
              nationality: formData.customer_nationality || undefined,
              id_type: formData.customer_id_type,
              driving_license_number: formData.customer_driving_license_number || undefined,
              address: formData.customer_address || undefined,
              notes: formData.customer_notes || undefined,
            }
            customerIdToUpdate = await dataService.createCustomer(customerData)
          }
        } else {
          const customerUpdateData = {
            first_name: formData.customer_first_name,
            last_name: formData.customer_last_name,
            phone: formData.customer_phone,
            id_number: formData.customer_id_number,
            nationality: formData.customer_nationality || null,
            id_type: formData.customer_id_type,
            driving_license_number: formData.customer_driving_license_number || null,
            address: formData.customer_address || null,
            notes: formData.customer_notes || null,
          }
          await dataService.updateCustomer(customerIdToUpdate, customerUpdateData)
        }

        let additionalDriverIdToUpdate: string | null = null
        if (formData.has_additional_driver) {
          const existingAdditionalDriver = await dataService.findCustomerByIdNumber(
            formData.additional_driver_id_number,
          )

          if (existingAdditionalDriver) {
            additionalDriverIdToUpdate = existingAdditionalDriver.id
            await dataService.updateCustomer(additionalDriverIdToUpdate, {
              first_name: formData.additional_driver_first_name,
              last_name: formData.additional_driver_last_name,
              phone: formData.additional_driver_phone,
              id_number: formData.additional_driver_id_number,
              nationality: formData.additional_driver_nationality || null,
              id_type: formData.additional_driver_id_type,
              driving_license_number: formData.additional_driver_driving_license_number || null,
              address: formData.additional_driver_address || null,
            })
          } else {
            additionalDriverIdToUpdate = await dataService.createCustomer({
              id_number: formData.additional_driver_id_number,
              first_name: formData.additional_driver_first_name,
              last_name: formData.additional_driver_last_name,
              phone: formData.additional_driver_phone,
              nationality: formData.additional_driver_nationality,
              id_type: formData.additional_driver_id_type,
              driving_license_number: formData.additional_driver_driving_license_number,
              address: formData.additional_driver_address,
            })
          }
        }

        // NOTE: additional_service column does NOT exist in bookings table yet
        const bookingUpdateData = {
          car_id: Number.parseInt(formData.car_id),
          customer_id: customerIdToUpdate,
          start_date: formData.start_date,
          end_date: formData.end_date,
          status: formData.booking_status,
          insurance_type: formData.insurance_type || null,
          pickup_location: formData.pickup_location || null,
          dropoff_location: formData.dropoff_location || null,
          notes: formData.notes || null,
        }

        console.log("FINAL BOOKINGS UPDATE PAYLOAD:", bookingUpdateData)
        await dataService.updateBooking(editingBooking.id, bookingUpdateData)

        toast({
          title: "Success",
          description: "Booking updated successfully",
        })

        resetForm()
        setEditingBooking(null)
        setIsAddDialogOpen(false)
        await loadBookings()
      } catch (error: any) {
        const msg = error?.message || "Failed to update booking"
        toast({
          title: msg.includes("CONNECTION_LOST") ? "Connection Lost" : "Error",
          description: msg.includes("CONNECTION_LOST")
            ? "The operation timed out. Please check your connection and try again."
            : msg,
          variant: "destructive",
        })
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // CREATE MODE
      console.log("=== CREATE BOOKING START ===")
      console.log("Form data:", JSON.stringify(formData, null, 2))
      
      // Validate required fields before submission
      if (!formData.car_id || formData.car_id === "") {
        console.log("VALIDATION FAILED: No car selected")
        toast({ title: "Error", description: "Please select a car", variant: "destructive" })
        return
      }
      if (!formData.start_date || formData.start_date === "") {
        console.log("VALIDATION FAILED: No start date")
        toast({ title: "Error", description: "Please select a start date", variant: "destructive" })
        return
      }
      if (!formData.end_date || formData.end_date === "") {
        console.log("VALIDATION FAILED: No end date")
        toast({ title: "Error", description: "Please select an end date", variant: "destructive" })
        return
      }
      
      console.log("Validation passed, setting isSubmitting=true")
      setIsSubmitting(true)

      try {
        let customerId: string

        console.log("Looking up customer by ID number:", formData.customer_id_number)
        const existingCustomer = await dataService.findCustomerByIdNumber(formData.customer_id_number)
        console.log("Customer lookup result:", existingCustomer)

        if (existingCustomer) {
          customerId = existingCustomer.id
          console.log("Using existing customer ID:", customerId)
        } else {
          console.log("Creating new customer...")
          const customerData = {
            id_number: formData.customer_id_number,
            first_name: formData.customer_first_name,
            last_name: formData.customer_last_name,
            phone: formData.customer_phone,
            nationality: formData.customer_nationality || undefined,
            id_type: formData.customer_id_type,
            driving_license_number: formData.customer_driving_license_number || undefined,
            address: formData.customer_address || undefined,
            notes: formData.customer_notes || undefined,
          }

          customerId = await dataService.createCustomer(customerData)
          console.log("Created new customer with ID:", customerId)
        }

        if (!customerId || typeof customerId !== "string" || customerId.length === 0) {
          console.log("INVALID CUSTOMER ID:", customerId)
          throw new Error("Invalid customer ID - cannot create booking without valid customer")
        }
        console.log("Customer ID validated:", customerId)

        let additionalDriverId: string | null = null
        if (formData.has_additional_driver) {
          // First, check if the additional driver already exists by ID number
          const existingAdditionalDriver = await dataService.findCustomerByIdNumber(
            formData.additional_driver_id_number,
          )

          if (existingAdditionalDriver) {
            // If found, use their existing ID
            additionalDriverId = existingAdditionalDriver.id
          } else {
            // If not found, create a new customer record for the additional driver
            const additionalDriverData = {
              id_number: formData.additional_driver_id_number,
              first_name: formData.additional_driver_first_name,
              last_name: formData.additional_driver_last_name,
              phone: formData.additional_driver_phone,
              nationality: formData.additional_driver_nationality || undefined,
              id_type: formData.additional_driver_id_type,
              driving_license_number: formData.additional_driver_driving_license_number || undefined,
              address: formData.additional_driver_address || undefined,
            }
            additionalDriverId = await dataService.createCustomer(additionalDriverData)
          }
        }

        const carId = Number.parseInt(formData.car_id)
        if (isNaN(carId) || carId <= 0) {
          throw new Error("Invalid car selection")
        }

        // ONLY send allowed fields to bookings table:
        // car_id, start_date, end_date, insurance_type, pickup_location, 
        // dropoff_location, notes, status, customer_id, additional_service
        // NOTE: additional_service column does NOT exist in bookings table yet
        const bookingData = {
          car_id: carId,
          customer_id: customerId,
          start_date: formData.start_date,
          end_date: formData.end_date,
          status: formData.booking_status,
          insurance_type: formData.insurance_type || null,
          pickup_location: formData.pickup_location || null,
          dropoff_location: formData.dropoff_location || null,
          notes: formData.notes || null,
        }

        console.log("FINAL BOOKINGS PAYLOAD:", JSON.stringify(bookingData, null, 2))
        console.log("Calling dataService.createBooking...")
        
        try {
          const result = await dataService.createBooking(bookingData)
          console.log("createBooking SUCCESS:", result)
        } catch (insertError: any) {
          console.error("BOOKING INSERT ERROR:", insertError)
          console.error("Error message:", insertError?.message)
          console.error("Error stack:", insertError?.stack)
          throw insertError
        }

        // Only close modal and refresh on success
        console.log("Booking created, showing success toast")
        toast({ title: "Success", description: "Booking created successfully" })
        setIsAddDialogOpen(false)
        await loadBookings()
      } catch (error: any) {
        // Handle specific business errors with user-friendly messages
        if (error?.message?.startsWith("CAR_NOT_AVAILABLE")) {
          const conflictDetails = error.message.replace("CAR_NOT_AVAILABLE", "").trim()
          toast({
            title: "Car not available",
            description: `This car is already booked for the selected dates. Please choose different dates or another car.${conflictDetails ? " " + conflictDetails : ""}`,
            variant: "destructive",
          })
          return // Keep modal open, early return to prevent generic error toast
        }
        
        const errorMsg = error?.message || "Unknown error"
        console.error("CATCH BLOCK ERROR:", error)
        console.error("Error message:", errorMsg)
        toast({
          title: errorMsg.includes("CONNECTION_LOST") ? "Connection Lost" : "Booking Error",
          description: errorMsg.includes("CONNECTION_LOST")
            ? "The operation timed out. Please check your connection and try again."
            : errorMsg,
          variant: "destructive",
        })
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const resetForm = () => {
    setFormData({
      customer_first_name: "",
      customer_last_name: "",
      customer_phone: "",
      customer_id_number: "",
      customer_id_type: "PASSPORT",
      customer_nationality: "",
      customer_driving_license_number: "",
      customer_address: "",
      customer_notes: "",
      // Reset additional driver fields
      has_additional_driver: false,
      additional_driver_first_name: "",
      additional_driver_last_name: "",
      additional_driver_phone: "",
      additional_driver_id_number: "",
      additional_driver_id_type: "PASSPORT",
      additional_driver_nationality: "",
      additional_driver_driving_license_number: "",
      additional_driver_address: "",
  car_id: "",
  booking_status: "pending",
  booking_number: "",
  insurance_type: "",
  additional_service: "",
  start_date: "",
  end_date: "",
  pickup_location: "",
  dropoff_location: "",
  fuel_level: "",
      notes: "",
      // Financial info
      rental_amount: "",
      paid_amount: "",
      deposit_amount: "",
      financial_note: "",
    })
    setExistingCustomer(null)
    setEditingBooking(null)
  }

  const totalBookings = bookings?.length || 0
  const confirmedCount = bookings?.filter((b) => b.status === "confirmed").length || 0
  const pendingCount = bookings?.filter((b) => b.status === "pending").length || 0
  const cancelledCount = bookings?.filter((b) => b.status === "cancelled").length || 0

  const stats = {
    total: totalBookings,
    confirmed: confirmedCount,
    pending: pendingCount,
    cancelled: cancelledCount,
  }

  const filteredBookings = (bookings || [])
    .filter((booking) => {
      const matchesStatus = statusFilter === "ALL" || booking.status === statusFilter
      const matchesSearch =
        searchQuery === "" ||
        booking.booking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.car?.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${booking.customer?.first_name || ""} ${booking.customer?.last_name || ""}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      return matchesStatus && matchesSearch
    })
    .sort((a, b) => {
      if (!sortField) return 0 // No sorting

      let compareValue = 0

      switch (sortField) {
        case "booking_number":
          compareValue = (a.booking_number || "").localeCompare(b.booking_number || "")
          break
        case "start_date":
          compareValue = new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
          break
        case "end_date":
          compareValue = new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
          break
        case "customer":
          const customerA = `${a.customer?.first_name || ""} ${a.customer?.last_name || ""}`.trim()
          const customerB = `${b.customer?.first_name || ""} ${b.customer?.last_name || ""}`.trim()
          compareValue = customerA.localeCompare(customerB)
          break
        case "kabis_reported":
          // TRUE (1) first, FALSE (0) last
          compareValue = (b.kabis_reported ? 1 : 0) - (a.kabis_reported ? 1 : 0)
          break
        case "invoice_issued":
          // TRUE (1) first, FALSE (0) last
          compareValue = (b.invoice_issued ? 1 : 0) - (a.invoice_issued ? 1 : 0)
          break
      }

      return sortDirection === "asc" ? compareValue : -compareValue
    })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-700 border-green-200"
      case "pending":
        return "bg-amber-100 text-amber-700 border-amber-200"
      case "cancelled":
        return "bg-red-100 text-red-700 border-red-200"
      case "completed":
        return "bg-blue-100 text-blue-700 border-blue-200"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle2 className="h-3 w-3" />
      case "pending":
        return <Clock className="h-3 w-3" />
      case "cancelled":
        return <XCircle className="h-3 w-3" />
      case "completed":
        return <CheckCircle2 className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
    }
  }

  const handleConfirmBooking = async (bookingId: number) => {
    try {
      const success = await dataService.confirmBooking(bookingId)
      if (success) {
        toast({
          title: "Success",
          description: "Booking confirmed.",
        })
        await loadBookings()
      } else {
        throw new Error("Confirmation failed on server.")
      }
    } catch (error: any) {
  toast({
        title: "Error",
        description: error.message || "Failed to confirm booking. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBookings(filteredBookings.map((b) => b.id))
    } else {
      setSelectedBookings([])
    }
  }

  const handleSelectBooking = (bookingId: number, checked: boolean) => {
    if (checked) {
      setSelectedBookings([...selectedBookings, bookingId])
    } else {
      setSelectedBookings(selectedBookings.filter((id) => id !== bookingId))
    }
  }

  const handleExport = async (exportFormat: "csv" | "pdf", selectedOnly: boolean) => {
    const dataToExport = filteredBookings.filter((b) => selectedBookings.includes(b.id))

    if (dataToExport.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select bookings to export",
        variant: "destructive",
      })
      return
    }

    if (exportFormat === "pdf") {
      try {
        // Dynamically import jsPDF and autoTable
        const { default: jsPDF } = await import("jspdf")
        const autoTable = (await import("jspdf-autotable")).default

        const doc = new jsPDF()

        // Add title
        doc.setFontSize(18)
        doc.setFont("helvetica", "bold")
        doc.text("Homesta Cars", 14, 20)

        // Add month label
        doc.setFontSize(12)
        doc.setFont("helvetica", "normal")
        const monthLabel = format(selectedMonth, "MMMM yyyy")
        doc.text(monthLabel, 14, 28)

        // Prepare table data with Kabis and Invoice indicators
        const tableData = dataToExport.map((booking) => [
          booking.booking_number || "-",
          `${booking.customer?.first_name || ""} ${booking.customer?.last_name || ""}`.trim() || "-",
          `${(booking.car as any)?.model_group?.brand || ""} ${(booking.car as any)?.model_group?.model || ""}`.trim() || "-",
          booking.car?.plate_number || "-",
          format(new Date(booking.start_date), "dd/MM/yyyy"),
          format(new Date(booking.end_date), "dd/MM/yyyy"),
          booking.kabis_reported ? "●" : "●", // Green or Red indicator
          booking.invoice_issued ? "●" : "●", // Green or Red indicator
        ])

        // Add table
        autoTable(doc, {
          head: [["Booking Number", "Customer Name", "Car", "Plate", "Start Date", "End Date", "Kabis", "Invoice"]],
          body: tableData,
          startY: 35,
          theme: "grid",
          headStyles: {
            fillColor: [91, 192, 248], // #5BC0F8
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: "bold",
          },
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          columnStyles: {
            0: { cellWidth: 28 }, // Booking Number
            1: { cellWidth: 32 }, // Customer Name
            2: { cellWidth: 32 }, // Car
            3: { cellWidth: 22 }, // Plate
            4: { cellWidth: 22 }, // Start Date
            5: { cellWidth: 22 }, // End Date
            6: { cellWidth: 12, halign: "center" }, // Kabis (centered)
            7: { cellWidth: 12, halign: "center" }, // Invoice (centered)
          },
          didParseCell: (data) => {
            // Color the Kabis column (index 6)
            if (data.column.index === 6 && data.section === "body") {
              const booking = dataToExport[data.row.index]
              if (booking.kabis_reported) {
                data.cell.styles.textColor = [34, 197, 94] // Green (#22c55e)
              } else {
                data.cell.styles.textColor = [239, 68, 68] // Red (#ef4444)
              }
            }
            // Color the Invoice column (index 7)
            if (data.column.index === 7 && data.section === "body") {
              const booking = dataToExport[data.row.index]
              if (booking.invoice_issued) {
                data.cell.styles.textColor = [34, 197, 94] // Green (#22c55e)
              } else {
                data.cell.styles.textColor = [239, 68, 68] // Red (#ef4444)
              }
            }
          },
        })

        // Save the PDF
        doc.save(`Homesta-Cars-Bookings-${monthLabel.replace(" ", "-")}.pdf`)

        toast({
          title: "Success",
          description: `Exported ${dataToExport.length} booking(s) to PDF`,
        })
  } catch (error) {
  toast({
          title: "Error",
          description: "Failed to export PDF. Please try again.",
          variant: "destructive",
        })
      }
    } else {
      // CSV export placeholder
      toast({
        title: "Export Started",
        description: `Exporting ${dataToExport.length} booking(s) as CSV...`,
      })
      if (process.env.NODE_ENV === "development") {
        console.log(`[v0] CSV export not yet implemented`)
      }
    }
  }

  const toggleSort = (field: "booking_number" | "start_date" | "end_date" | "customer" | "kabis_reported" | "invoice_issued") => {
    if (sortField === field) {
      // Cycle: ASC → DESC → NONE
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else {
        setSortField(null) // Clear sorting
      }
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleToggleKabis = async (bookingId: number, currentValue: boolean) => {
    const supabase = getSupabaseBrowserClient()
    const newValue = !currentValue

    const { error } = await supabase
      .from("bookings")
      .update({ kabis_reported: newValue })
      .eq("id", bookingId)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update Kabis status",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Updated successfully",
      description: `Kabis status updated to ${newValue ? "reported" : "not reported"}`,
    })

    // Reload bookings to reflect the change
    await loadBookings()
  }

  const handleToggleInvoice = async (bookingId: number, currentValue: boolean) => {
    const supabase = getSupabaseBrowserClient()
    const newValue = !currentValue

    const { error } = await supabase
      .from("bookings")
      .update({ invoice_issued: newValue })
      .eq("id", bookingId)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update Invoice status",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Updated successfully",
      description: `Invoice status updated to ${newValue ? "issued" : "not issued"}`,
    })

    // Reload bookings to reflect the change
    await loadBookings()
  }

  return (
 <ProtectedRoute allowedRoles={["admin", "staff"]}>
  <DashboardLayout>
        <div className="p-6 space-y-6">
          {loadError && !isLoading && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                  <XCircle className="h-12 w-12 text-red-500" />
                  <div>
                    <h3 className="font-semibold text-red-900">Failed to Load Bookings</h3>
                    <p className="text-sm text-red-700 mt-1">{loadError}</p>
                  </div>
                  <Button onClick={() => loadBookings()} variant="outline" size="sm">
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show content only if no error or still loading */}
          {(!loadError || isLoading) && (
            <>
              {/* Header */}
              <div className="flex flex-col sm:flex-col md:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
                    <p className="text-gray-600 mt-1">Monthly bookings control center</p>
                  </div>
                  <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-white">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[120px] text-center">
                      {format(selectedMonth, "MMMM yyyy")}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Dialog
                  open={isAddDialogOpen}
                  onOpenChange={(isOpen) => {
                    setIsAddDialogOpen(isOpen)
                    if (!isOpen) {
                      resetForm()
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      className="h-10 px-5 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all"
                      style={{ backgroundColor: "#5BC0F8" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4AB0E8")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5BC0F8")}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Booking
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto border-0 shadow-lg shadow-slate-200/50 rounded-2xl p-0">
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 rounded-t-2xl">
                      <DialogTitle className="text-2xl font-bold text-slate-800 tracking-tight">
                        {editingBooking ? "Edit Booking" : "New Booking"}
                      </DialogTitle>
                      <p className="text-slate-500 text-sm mt-1">Complete the rental information and customer details</p>
                    </div>

                    <form onSubmit={handleSubmit} id="booking-form">
                      {/* Section 1: Booking Status */}
                      <div className="p-6 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5">
                          Booking Status
                        </h3>
                        <div className="max-w-xs">
                          <Label htmlFor="booking_status" className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-[#5BC0F8]" />
                            Status
                            <span className="text-red-400 text-xs">*</span>
                          </Label>
                          <Select
                            value={formData.booking_status}
                            onValueChange={(value) =>
                              setFormData({ ...formData, booking_status: value as BookingStatus })
                            }
                          >
                            <SelectTrigger id="booking_status" className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
<SelectItem value="pending" className="rounded-lg">Pending</SelectItem>
                            <SelectItem value="confirmed" className="rounded-lg">Confirmed</SelectItem>
                            <SelectItem value="cancelled" className="rounded-lg">Cancelled</SelectItem>
                              {editingBooking && <SelectItem value="cancelled" className="rounded-lg">Cancelled</SelectItem>}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Section 2: Rental Details */}
                      <div className="p-6 space-y-5 border-b border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5">
                          Rental Information
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* Car Selection */}
                          <div className="space-y-2">
                            <Label htmlFor="car_id" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <Car className="h-4 w-4 text-[#5BC0F8]" />
                              Select Car
                              <span className="text-red-400 text-xs">*</span>
                            </Label>
                            <Select
                              value={formData.car_id}
                              onValueChange={(value) => setFormData({ ...formData, car_id: value })}
                            >
                              <SelectTrigger id="car_id" className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all">
                                <SelectValue placeholder="Choose a car" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {cars.map((car) => (
                                  <SelectItem key={car.id} value={String(car.id)} className="rounded-lg">
                                    {car.model_group?.name ? `${car.plate_number} (${car.model_group.name})` : car.plate_number}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Insurance Type */}
                          <div className="space-y-2">
                            <Label htmlFor="insurance_type" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <Shield className="h-4 w-4 text-[#5BC0F8]" />
                              Insurance Type
                            </Label>
                            <Select
                              value={formData.insurance_type}
                              onValueChange={(value) => setFormData({ ...formData, insurance_type: value })}
                            >
                              <SelectTrigger id="insurance_type" className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all">
                                <SelectValue placeholder="Select insurance" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {insuranceTypes.map((type) => (
                                  <SelectItem key={type.value} value={type.value} className="rounded-lg">
                                    {type.label}
                                  </SelectItem>
                                ))}
                          </SelectContent>
                          </Select>
                          </div>

                          {/* Additional Service */}
                          <div className="space-y-2">
                            <Label htmlFor="additional_service" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <Plus className="h-4 w-4 text-[#5BC0F8]" />
                              Additional Service
                            </Label>
                            <Select
                              value={formData.additional_service || "none"}
                              onValueChange={(value) => setFormData({ ...formData, additional_service: value === "none" ? "" : value })}
                            >
                              <SelectTrigger id="additional_service" className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all">
                                <SelectValue placeholder="Select additional service" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="none" className="rounded-lg">None</SelectItem>
                                <SelectItem value="Extra Driver" className="rounded-lg">Extra Driver</SelectItem>
                                <SelectItem value="Baby Seat" className="rounded-lg">Baby Seat</SelectItem>
                                <SelectItem value="Unlimited KM" className="rounded-lg">Unlimited KM</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Start Date */}
                          <div className="space-y-2">
                            <Label htmlFor="start_date" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4 text-[#5BC0F8]" />
                              Start Date
                              <span className="text-red-400 text-xs">*</span>
                            </Label>
                            <Input
                              id="start_date"
                              type="date"
                              value={formData.start_date}
                              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                              className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                            />
                          </div>

                          {/* End Date */}
                          <div className="space-y-2">
                            <Label htmlFor="end_date" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4 text-[#5BC0F8]" />
                              End Date
                              <span className="text-red-400 text-xs">*</span>
                            </Label>
                            <Input
                              id="end_date"
                              type="date"
                              value={formData.end_date}
                              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                              className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                            />
                          </div>

                          {/* Pickup Location */}
                          <div className="space-y-2">
                            <Label htmlFor="pickup_location" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-[#5BC0F8]" />
                              Pickup Location
                            </Label>
                            <Select
                              value={formData.pickup_location}
                              onValueChange={(value) => setFormData({ ...formData, pickup_location: value })}
                            >
                              <SelectTrigger id="pickup_location" className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all">
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {locations.map((loc) => (
                                  <SelectItem key={loc.id} value={loc.name} className="rounded-lg">
                                    {loc.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Dropoff Location */}
                          <div className="space-y-2">
                            <Label htmlFor="dropoff_location" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-[#5BC0F8]" />
                              Dropoff Location
                            </Label>
                            <Select
                              value={formData.dropoff_location}
                              onValueChange={(value) => setFormData({ ...formData, dropoff_location: value })}
                            >
                              <SelectTrigger id="dropoff_location" className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all">
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {locations.map((loc) => (
                                  <SelectItem key={loc.id} value={loc.name} className="rounded-lg">
                                    {loc.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>


                        </div>
                      </div>

                      {/* Section 3: Customer Information */}
                      <div className="p-6 bg-gradient-to-br from-slate-50 to-white space-y-5 border-b border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5">
                          Customer Personal Information
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {/* ID/Passport Number */}
                          <div className="space-y-2">
                            <Label htmlFor="customer_id_number" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <User className="h-4 w-4 text-[#5BC0F8]" />
                              ID / Passport Number
                              <span className="text-red-400 text-xs">*</span>
                            </Label>
                            <Input
                              id="customer_id_number"
                              value={formData.customer_id_number}
                              onChange={(e) => setFormData({ ...formData, customer_id_number: e.target.value })}
                              onBlur={handleTcBlur}
                              className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                              placeholder="Enter ID or passport number"
                            />
                          </div>

                          {/* ID Type */}
                          <div className="space-y-2">
                            <Label htmlFor="customer_id_type" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <FileText className="h-4 w-4 text-[#5BC0F8]" />
                              ID Type
                            </Label>
                            <Select
                              value={formData.customer_id_type}
                              onValueChange={(value) => setFormData({ ...formData, customer_id_type: value })}
                            >
                              <SelectTrigger id="customer_id_type" className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="PASSPORT" className="rounded-lg">Passport</SelectItem>
                                <SelectItem value="NATIONAL_ID" className="rounded-lg">National ID</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* First Name */}
                          <div className="space-y-2">
                            <Label htmlFor="customer_first_name" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <User className="h-4 w-4 text-[#5BC0F8]" />
                              First Name
                              <span className="text-red-400 text-xs">*</span>
                            </Label>
                            <Input
                              id="customer_first_name"
                              value={formData.customer_first_name}
                              onChange={(e) => setFormData({ ...formData, customer_first_name: e.target.value })}
                              className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                              placeholder="Enter first name"
                            />
                          </div>

                          {/* Last Name */}
                          <div className="space-y-2">
                            <Label htmlFor="customer_last_name" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <User className="h-4 w-4 text-[#5BC0F8]" />
                              Last Name
                              <span className="text-red-400 text-xs">*</span>
                            </Label>
                            <Input
                              id="customer_last_name"
                              value={formData.customer_last_name}
                              onChange={(e) => setFormData({ ...formData, customer_last_name: e.target.value })}
                              className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                              placeholder="Enter last name"
                            />
                          </div>

                          {/* Phone Number */}
                          <div className="space-y-2">
                            <Label htmlFor="customer_phone" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <Phone className="h-4 w-4 text-[#5BC0F8]" />
                              Phone Number
                              <span className="text-red-400 text-xs">*</span>
                            </Label>
                            <Input
                              id="customer_phone"
                              value={formData.customer_phone}
                              onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                              className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                              placeholder="Enter phone number"
                            />
                          </div>

                          {/* Nationality */}
                          <div className="space-y-2">
                            <Label htmlFor="customer_nationality" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <Globe className="h-4 w-4 text-[#5BC0F8]" />
                              Nationality
                            </Label>
                            <Select
                              value={formData.customer_nationality}
                              onValueChange={(value) => setFormData({ ...formData, customer_nationality: value })}
                            >
                              <SelectTrigger id="customer_nationality" className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all">
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {COUNTRIES.map((country) => (
                                  <SelectItem key={country} value={country} className="rounded-lg">
                                    {country}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Driving License Number */}
                          <div className="space-y-2">
                            <Label htmlFor="customer_driving_license_number" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <FileText className="h-4 w-4 text-[#5BC0F8]" />
                              Driving License Number
                            </Label>
                            <Input
                              id="customer_driving_license_number"
                              value={formData.customer_driving_license_number}
                              onChange={(e) => setFormData({ ...formData, customer_driving_license_number: e.target.value })}
                              className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                              placeholder="Enter license number"
                            />
                          </div>

                          {/* Address */}
                          <div className="space-y-2">
                            <Label htmlFor="customer_address" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-[#5BC0F8]" />
                              Address
                            </Label>
                            <Input
                              id="customer_address"
                              value={formData.customer_address}
                              onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                              className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                              placeholder="Enter address"
                            />
                          </div>
                        </div>

                        {/* Customer Notes */}
                        <div className="space-y-2">
                          <Label htmlFor="customer_notes" className="text-sm font-medium text-slate-700">
                            Customer Notes
                          </Label>
                          <Textarea
                            id="customer_notes"
                            value={formData.customer_notes}
                            onChange={(e) => setFormData({ ...formData, customer_notes: e.target.value })}
                            rows={3}
                            className="resize-none rounded-xl border-slate-200 focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                            placeholder="Add any customer notes..."
                          />
                        </div>
                      </div>

                      {/* Section 4: Additional Driver */}
                      <div className="p-6 space-y-5 border-b border-slate-100">
                        <div className="space-y-4">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id="has_additional_driver"
                              checked={formData.has_additional_driver}
                              onCheckedChange={(checked) =>
                                setFormData({ ...formData, has_additional_driver: checked as boolean })
                              }
                              className="h-5 w-5"
                            />
                            <Label htmlFor="has_additional_driver" className="text-base font-semibold cursor-pointer">
                              Add Additional Driver
                            </Label>
                          </div>

                          {formData.has_additional_driver && (
                            <div className="bg-blue-50/50 rounded-xl p-6 space-y-5 border border-blue-200/50">
                              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                                <User className="h-4 w-4 text-[#5BC0F8]" />
                                Additional Driver Details
                              </h4>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                  <Label htmlFor="additional_driver_id_number" className="text-sm font-medium text-slate-700">
                                    ID / Passport Number <span className="text-red-400 text-xs">*</span>
                                  </Label>
                                  <Input
                                    id="additional_driver_id_number"
                                    value={formData.additional_driver_id_number}
                                    onChange={(e) => setFormData({ ...formData, additional_driver_id_number: e.target.value })}
                                    className="h-12 bg-white border-slate-200 rounded-xl"
                                    placeholder="Enter ID or passport number"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="additional_driver_id_type" className="text-sm font-medium text-slate-700">
                                    ID Type
                                  </Label>
                                  <Select
                                    value={formData.additional_driver_id_type}
                                    onValueChange={(value) => setFormData({ ...formData, additional_driver_id_type: value })}
                                  >
                                    <SelectTrigger id="additional_driver_id_type" className="h-12 bg-white border-slate-200 rounded-xl">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      <SelectItem value="PASSPORT" className="rounded-lg">Passport</SelectItem>
                                      <SelectItem value="NATIONAL_ID" className="rounded-lg">National ID</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="additional_driver_first_name" className="text-sm font-medium text-slate-700">
                                    First Name <span className="text-red-400 text-xs">*</span>
                                  </Label>
                                  <Input
                                    id="additional_driver_first_name"
                                    value={formData.additional_driver_first_name}
                                    onChange={(e) => setFormData({ ...formData, additional_driver_first_name: e.target.value })}
                                    className="h-12 bg-white border-slate-200 rounded-xl"
                                    placeholder="Enter first name"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="additional_driver_last_name" className="text-sm font-medium text-slate-700">
                                    Last Name <span className="text-red-400 text-xs">*</span>
                                  </Label>
                                  <Input
                                    id="additional_driver_last_name"
                                    value={formData.additional_driver_last_name}
                                    onChange={(e) => setFormData({ ...formData, additional_driver_last_name: e.target.value })}
                                    className="h-12 bg-white border-slate-200 rounded-xl"
                                    placeholder="Enter last name"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="additional_driver_phone" className="text-sm font-medium text-slate-700">
                                    Phone Number
                                  </Label>
                                  <Input
                                    id="additional_driver_phone"
                                    value={formData.additional_driver_phone}
                                    onChange={(e) => setFormData({ ...formData, additional_driver_phone: e.target.value })}
                                    className="h-12 bg-white border-slate-200 rounded-xl"
                                    placeholder="Enter phone number"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="additional_driver_nationality" className="text-sm font-medium text-slate-700">
                                    Nationality
                                  </Label>
                                  <Select
                                    value={formData.additional_driver_nationality}
                                    onValueChange={(value) => setFormData({ ...formData, additional_driver_nationality: value })}
                                  >
                                    <SelectTrigger id="additional_driver_nationality" className="h-12 bg-white border-slate-200 rounded-xl">
                                      <SelectValue placeholder="Select country" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      {COUNTRIES.map((country) => (
                                        <SelectItem key={country} value={country} className="rounded-lg">
                                          {country}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="additional_driver_driving_license_number" className="text-sm font-medium text-slate-700">
                                    Driving License Number
                                  </Label>
                                  <Input
                                    id="additional_driver_driving_license_number"
                                    value={formData.additional_driver_driving_license_number}
                                    onChange={(e) => setFormData({ ...formData, additional_driver_driving_license_number: e.target.value })}
                                    className="h-12 bg-white border-slate-200 rounded-xl"
                                    placeholder="Enter license number"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="additional_driver_address" className="text-sm font-medium text-slate-700">
                                    Address
                                  </Label>
                                  <Input
                                    id="additional_driver_address"
                                    value={formData.additional_driver_address}
                                    onChange={(e) => setFormData({ ...formData, additional_driver_address: e.target.value })}
                                    className="h-12 bg-white border-slate-200 rounded-xl"
                                    placeholder="Enter address"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 5: Financial Information */}
                      <div className="p-6 space-y-5 border-t border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                          Financial Information
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="rental_amount" className="text-sm font-medium text-slate-700">
                              Rental Amount
                            </Label>
                            <Input
                              id="rental_amount"
                              type="number"
                              step="0.01"
                              value={formData.rental_amount}
                              onChange={(e) => setFormData({ ...formData, rental_amount: e.target.value })}
                              className="h-11 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="paid_amount" className="text-sm font-medium text-slate-700">
                              Paid Amount
                            </Label>
                            <Input
                              id="paid_amount"
                              type="number"
                              step="0.01"
                              value={formData.paid_amount}
                              onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                              className="h-11 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="deposit_amount" className="text-sm font-medium text-slate-700">
                              Deposit Amount
                            </Label>
                            <Input
                              id="deposit_amount"
                              type="number"
                              step="0.01"
                              value={formData.deposit_amount}
                              onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                              className="h-11 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="financial_note" className="text-sm font-medium text-slate-700">
                              Financial Note
                            </Label>
                            <Input
                              id="financial_note"
                              value={formData.financial_note}
                              onChange={(e) => setFormData({ ...formData, financial_note: e.target.value })}
                              className="h-11 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                              placeholder="Optional note"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 6: Notes */}
                      <div className="p-6 space-y-5 border-t border-slate-200">
                        <div className="space-y-2">
                          <Label htmlFor="notes" className="text-sm font-medium text-slate-700">
                            Booking Notes
                          </Label>
                          <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="resize-none bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                            placeholder="Add any booking notes or special requirements..."
                          />
                        </div>
                      </div>
                    </form>

                    <DialogFooter className="sticky bottom-0 px-6 py-4 border-t bg-white rounded-b-2xl shadow-lg shadow-slate-900/5">
                      <div className="flex gap-3 w-full justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddDialogOpen(false)
                            resetForm()
                          }}
                          disabled={isSubmitting}
                          className="h-12 px-8 rounded-xl border-slate-300 hover:bg-slate-50 transition-all bg-transparent"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          form="booking-form"
                          disabled={isSubmitting}
                          className="h-12 px-8 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                          style={{ backgroundColor: "#5BC0F8" }}
                          onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = "#4AB0E8")}
                          onMouseLeave={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = "#5BC0F8")}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : editingBooking ? (
                            "Update Booking"
                          ) : (
                            "Create Booking"
                          )}
                        </Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>


              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-100 uppercase tracking-wide">
                      Total Bookings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.total}</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-100 uppercase tracking-wide flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.confirmed}</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-orange-100 uppercase tracking-wide flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      Pending
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.pending}</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-none shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-100 uppercase tracking-wide flex items-center gap-1.5">
                      <XCircle className="h-4 w-4" />
                      Cancelled
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.cancelled}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row gap-4 mb-6">
                    {/* Search */}
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search by booking number, customer, or plate..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Status Filter */}
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => setStatusFilter(value as "ALL" | BookingStatus)}
                    >
                      <SelectTrigger className="w-full lg:w-[180px]">
                        <SelectValue placeholder="Filter by Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Statuses</SelectItem>
<SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Export Button */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="gap-2 bg-transparent"
                          disabled={selectedBookings.length === 0}
                        >
                          <Download className="h-4 w-4" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          onClick={() => handleExport("csv", true)}
                          disabled={selectedBookings.length === 0}
                        >
                          <FileDown className="h-4 w-4 mr-2" />
                          Export selected ({selectedBookings.length}) CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleExport("pdf", true)}
                          disabled={selectedBookings.length === 0}
                        >
                          <FileDown className="h-4 w-4 mr-2" />
                          Export selected ({selectedBookings.length}) PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-gray-50 z-10">
                          <TableRow className="hover:bg-gray-50">
                            <TableHead className="w-12">
                              <Checkbox
                                checked={
                                  filteredBookings.length > 0 && selectedBookings.length === filteredBookings.length
                                }
                                onCheckedChange={handleSelectAll}
                              />
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 -ml-3"
                                onClick={() => toggleSort("booking_number")}
                              >
                                Booking Number
                                {sortField === "booking_number" ? (
                                  sortDirection === "asc" ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                                )}
                              </Button>
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Car</TableHead>
                            <TableHead>Plate</TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 -ml-3"
                                onClick={() => toggleSort("customer")}
                              >
                                Customer
                                {sortField === "customer" ? (
                                  sortDirection === "asc" ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                                )}
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 -ml-3"
                                onClick={() => toggleSort("start_date")}
                              >
                                Start Date
                                {sortField === "start_date" ? (
                                  sortDirection === "asc" ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                                )}
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 -ml-3"
                                onClick={() => toggleSort("end_date")}
                              >
                                End Date
                                {sortField === "end_date" ? (
                                  sortDirection === "asc" ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                                )}
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 -ml-3"
                                onClick={() => toggleSort("kabis_reported")}
                              >
                                Kabis
                                {sortField === "kabis_reported" ? (
                                  sortDirection === "asc" ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                                )}
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 -ml-3"
                                onClick={() => toggleSort("invoice_issued")}
                              >
                                Invoice
                                {sortField === "invoice_issued" ? (
                                  sortDirection === "asc" ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                                )}
                              </Button>
                            </TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredBookings.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                                No bookings found
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredBookings.map((booking) => (
                              <TableRow
                                key={booking.id}
                                className={`hover:bg-gray-50 ${selectedBookings.includes(booking.id) ? "bg-blue-50" : ""}`}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedBookings.includes(booking.id)}
                                    onCheckedChange={(checked) => handleSelectBooking(booking.id, checked as boolean)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{booking.booking_number}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`${getStatusColor(booking.status)} text-xs`}>
                                    {getStatusIcon(booking.status)}
                                    <span className="ml-1">{booking.status}</span>
                                  </Badge>
                                </TableCell>
                                <TableCell>{`${(booking.car as any).model_group?.brand || ""} ${(booking.car as any).model_group?.model || ""}`.trim() || "-"}</TableCell>
                                <TableCell className="font-mono text-sm">{booking.car.plate_number}</TableCell>
                                <TableCell>
                                  {booking.customer
                                    ? `${booking.customer.first_name} ${booking.customer.last_name}`
                                    : "N/A"}
                                </TableCell>
                                <TableCell>{format(new Date(booking.start_date), "MMM dd, yyyy")}</TableCell>
                                <TableCell>{format(new Date(booking.end_date), "MMM dd, yyyy")}</TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center">
                                    <Switch
                                      checked={booking.kabis_reported}
                                      onCheckedChange={() => handleToggleKabis(booking.id, booking.kabis_reported)}
                                      className={booking.kabis_reported ? "data-[state=checked]:bg-green-500" : "data-[state=unchecked]:bg-red-500"}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center">
                                    <Switch
                                      checked={booking.invoice_issued}
                                      onCheckedChange={() => handleToggleInvoice(booking.id, booking.invoice_issued)}
                                      className={booking.invoice_issued ? "data-[state=checked]:bg-green-500" : "data-[state=unchecked]:bg-red-500"}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-end gap-1">
                                    {booking.status === "pending" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleConfirmBooking(booking.id)}
                                        className="text-xs h-8"
                                      >
                                        Confirm
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEdit(booking)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setBookingToDelete(booking.id)}
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Results info */}
                  <div className="mt-4 text-sm text-gray-600">
                    Showing {filteredBookings.length} of {bookings.length} bookings
                    {selectedBookings.length > 0 && ` • ${selectedBookings.length} selected`}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!bookingToDelete} onOpenChange={() => setBookingToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Booking</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this booking? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
