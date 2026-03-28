"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Edit, Trash2, Car as CarIcon, ParkingCircle, Wrench, TrendingUp, DollarSign, RefreshCw, Calendar, Shield, ClipboardCheck, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"

type CarWithYear = {
  car_id: number
  plate_number: string
  model_group_name: string | null
  status: string | null
  manufacture_year: number | null
}

type ModelGroup = {
  id: number
  name: string
}

type Investor = {
  id: string
  company_name: string
}

// upcoming_returns view: car_id, plate_number, model_group_name, start_date, end_date, days_left
type UpcomingReturn = {
  car_id: number
  plate_number: string
  model_group_name: string | null
  start_date: string
  end_date: string
  days_left: number
}

// upcoming_insurance view: car_id, plate_number, model_group_name, target_date, days_left
type UpcomingInsurance = {
  car_id: number
  plate_number: string
  model_group_name: string | null
  target_date: string
  days_left: number
}

// upcoming_inspection view: car_id, plate_number, model_group_name, target_date, days_left
type UpcomingInspection = {
  car_id: number
  plate_number: string
  model_group_name: string | null
  target_date: string
  days_left: number
}

export default function CarsPage() {
  const { toast } = useToast()
  const { authVersion } = useAuth()

  // ── Diagnostic: detect remounts ──────────────────────────────────────────
  // If you see "MOUNT" in the logs after data was already loaded, the component
  // is being remounted and state is resetting to []. Remove these after diagnosis.
  useEffect(() => {
    console.log("[cars] COMPONENT MOUNTED")
    return () => {
      console.log("[cars] COMPONENT UNMOUNTING")
    }
  }, [])
  const [cars, setCars] = useState<CarWithYear[]>([])
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([])
  const [investors, setInvestors] = useState<Investor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Upcoming alerts state
  const [upcomingReturns, setUpcomingReturns] = useState<UpcomingReturn[]>([])
  const [upcomingInsurance, setUpcomingInsurance] = useState<UpcomingInsurance[]>([])
  const [upcomingInspection, setUpcomingInspection] = useState<UpcomingInspection[]>([])
  const [alertsModalType, setAlertsModalType] = useState<"returns" | "insurance" | "inspection" | null>(null)
  const [allAlerts, setAllAlerts] = useState<(UpcomingReturn | UpcomingInsurance | UpcomingInspection)[]>([])

  // Create dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newCar, setNewCar] = useState({
    model_group_id: "",
    plate_number: "",
    investor_id: "",
  })

  // Only show the full-screen spinner on the very first load.
  // Tab-focus refreshes update data silently in the background.
  const hasLoadedOnceRef = useRef(false)

  // Generation counter — each loadCars call claims the current generation.
  // If a newer call starts before this one finishes, the stale result is
  // discarded. This prevents an in-flight query (started with an expired
  // token) from overwriting data fetched by a later successful call.
  const fetchGenRef = useRef(0)

  // Load cars using proper data source separation:
  // - cars table + model_group JOIN for: id, plate_number, model_group_name
  // - car_availability view ONLY for: status
  const loadCars = useCallback(async () => {
    // Claim this generation. If a newer call starts before this one
    // finishes, the stale checks below will discard this result.
    const gen = ++fetchGenRef.current
    const isBackground = hasLoadedOnceRef.current
    console.log(`[cars] loadCars: starting gen=${gen} (${isBackground ? "background refresh" : "first load"})`)
    // Only show the spinner before the first successful load.
    // On tab-focus refreshes we already have data — update it silently.
    if (!hasLoadedOnceRef.current) setLoading(true)
    const supabase = getSupabaseBrowserClient()

    // 1. Query cars table with model_group join
    const { data: carsData, error: carsError } = await supabase
      .from("cars")
      .select("id, plate_number, model_group_id, model_group(id, name)")
      .order("plate_number", { ascending: true })

    // Stale check: a newer loadCars call has started — discard this result.
    if (gen !== fetchGenRef.current) {
      console.log(`[cars] loadCars: gen=${gen} is stale after cars query, discarding`)
      return
    }

    if (carsError) {
      console.error(`[cars] loadCars: gen=${gen} carsError:`, carsError)
      // Only show an error toast if we've never loaded successfully before
      if (!hasLoadedOnceRef.current) {
        toast({ title: "Error", description: "Failed to load cars", variant: "destructive" })
        setLoading(false)
      }
      return
    }

    const carIds = (carsData || []).map((c: any) => c.id)

    // 2. Query car_availability view ONLY for status
    const { data: availabilityData } = await supabase
      .from("car_availability")
      .select("id, status")
      .in("id", carIds)

    if (gen !== fetchGenRef.current) {
      console.log(`[cars] loadCars: gen=${gen} is stale after availability query, discarding`)
      return
    }

    // Create status map
    const statusMap = new Map<number, string | null>()
    ;(availabilityData || []).forEach((a: { id: number; status: string | null }) => {
      statusMap.set(a.id, a.status)
    })

    // 3. Fetch manufacture_year from cars_registration
    const { data: regData } = await supabase
      .from("cars_registration")
      .select("car_id, manufacture_year")
      .in("car_id", carIds)

    if (gen !== fetchGenRef.current) {
      console.log(`[cars] loadCars: gen=${gen} is stale after registration query, discarding`)
      return
    }

    const yearMap = new Map<number, number | null>()
    ;(regData || []).forEach((r: { car_id: number; manufacture_year: number | null }) => {
      yearMap.set(r.car_id, r.manufacture_year)
    })

    // Merge all data sources
    const carsWithYear = (carsData || []).map((car: any) => ({
      car_id: car.id,
      plate_number: car.plate_number,
      model_group_name: car.model_group?.name || null,
      status: statusMap.get(car.id) || null,
      manufacture_year: yearMap.get(car.id) || null
    }))

    console.log(`[cars] loadCars: gen=${gen} succeeded — setting ${carsWithYear.length} cars (fetchGenRef.current=${fetchGenRef.current})`)
    setCars(carsWithYear)
    hasLoadedOnceRef.current = true
    setLoading(false)
    console.log(`[cars] loadCars: gen=${gen} — setCars and setLoading(false) called`)
  }, [toast])

  // Load model groups for dropdown
  const loadModelGroups = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase
      .from("model_group")
      .select("id, name")
      .order("name", { ascending: true })
    setModelGroups(data || [])
  }, [])

  // Load investors for dropdown
  const loadInvestors = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase
      .from("investors")
      .select("id, company_name")
      .order("company_name", { ascending: true })
    setInvestors(data || [])
  }, [])

  // Load upcoming returns from upcoming_returns view
  // Columns: car_id, plate_number, model_group_name, start_date, end_date, days_left
  const loadUpcomingReturns = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("upcoming_returns")
      .select("car_id, plate_number, model_group_name, end_date, days_left")
      .order("days_left", { ascending: true })
      .limit(5)
    
    if (error) {
      console.error("Error loading upcoming returns:", error)
      setUpcomingReturns([])
      return
    }
    setUpcomingReturns(data || [])
  }, [])

  // Load upcoming insurance from upcoming_insurance view
  // Columns: car_id, plate_number, model_group_name, target_date, days_left
  const loadUpcomingInsurance = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("upcoming_insurance")
      .select("car_id, plate_number, model_group_name, target_date, days_left")
      .order("days_left", { ascending: true })
      .limit(5)
    
    if (error) {
      console.error("Error loading upcoming insurance:", error)
      setUpcomingInsurance([])
      return
    }
    setUpcomingInsurance(data || [])
  }, [])

  // Load upcoming inspection from upcoming_inspection view
  // Columns: car_id, plate_number, model_group_name, target_date, days_left
  const loadUpcomingInspection = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("upcoming_inspection")
      .select("car_id, plate_number, model_group_name, target_date, days_left")
      .order("days_left", { ascending: true })
      .limit(5)
    
    if (error) {
      console.error("Error loading upcoming inspection:", error)
      setUpcomingInspection([])
      return
    }
    setUpcomingInspection(data || [])
  }, [])

  // Load all alerts for modal - each view has different date column
  const loadAllAlerts = useCallback(async (type: "returns" | "insurance" | "inspection") => {
    const supabase = getSupabaseBrowserClient()
    
    if (type === "returns") {
      const { data } = await supabase
        .from("upcoming_returns")
        .select("car_id, plate_number, model_group_name, end_date, days_left")
        .order("days_left", { ascending: true })
      setAllAlerts(data || [])
    } else if (type === "insurance") {
      const { data } = await supabase
        .from("upcoming_insurance")
        .select("car_id, plate_number, model_group_name, target_date, days_left")
        .order("days_left", { ascending: true })
      setAllAlerts(data || [])
    } else {
      const { data } = await supabase
        .from("upcoming_inspection")
        .select("car_id, plate_number, model_group_name, target_date, days_left")
        .order("days_left", { ascending: true })
      setAllAlerts(data || [])
    }
  }, [])

  const openAlertsModal = (type: "returns" | "insurance" | "inspection") => {
    setAlertsModalType(type)
    loadAllAlerts(type)
  }

  // Get urgency badge style based on days_left
  const getUrgencyBadge = (days_left: number) => {
    if (days_left < 0) return { bg: "bg-red-100", text: "text-red-700", label: "Expired" }
    if (days_left === 0) return { bg: "bg-red-50", text: "text-red-600", label: "Today" }
    if (days_left <= 3) return { bg: "bg-red-50", text: "text-red-600", label: `${days_left} days left` }
    if (days_left <= 7) return { bg: "bg-orange-50", text: "text-orange-600", label: `${days_left} days left` }
    return { bg: "bg-green-50", text: "text-green-600", label: `${days_left} days left` }
  }

  const loadAll = useCallback(() => {
    loadCars()
    loadUpcomingReturns()
    loadUpcomingInsurance()
    loadUpcomingInspection()
  }, [loadCars, loadUpcomingReturns, loadUpcomingInsurance, loadUpcomingInspection])

  // Dropdown data: load once on mount, never reload.
  // These are stable reference data (model groups, investors) used only
  // in the Create dialog — no need to refresh on auth events.
  useEffect(() => {
    loadModelGroups()
    loadInvestors()
  }, [loadModelGroups, loadInvestors])

  // ── Single source of truth for data loading ─────────────────────────────
  // authVersion increments after every confirmed auth stabilisation:
  //   • checkSession completes (initial page load)
  //   • SIGNED_IN or TOKEN_REFRESHED completes (tab return / background refresh)
  //
  // This means loadAll is called exactly ONCE per auth event — never during
  // a concurrent token refresh, never from both mount and auth simultaneously.
  //
  // window.focus is intentionally absent: if the token is still valid on
  // tab return, Supabase fires TOKEN_REFRESHED proactively and authVersion
  // will increment then. If the token is expired, SIGNED_IN fires and
  // authVersion increments. Either way this effect handles it — no extra
  // triggers needed.
  useEffect(() => {
    if (authVersion > 0) {
      console.log(`[cars] authVersion=${authVersion} → loadAll`)
      loadAll()
    }
  }, [authVersion, loadAll])

  // Compute status counts from loaded data (no extra queries)
  const statusCounts = useMemo(() => {
    return {
      total: cars.length,
      working: cars.filter(c => c.status?.toLowerCase() === "working").length,
      parking: cars.filter(c => c.status?.toLowerCase() === "parking").length,
      maintenance: cars.filter(c => c.status?.toLowerCase() === "maintenance").length,
      selling: cars.filter(c => c.status?.toLowerCase() === "selling").length,
      replacement: cars.filter(c => c.status?.toLowerCase() === "replacement").length,
    }
  }, [cars])

  // Create new car
  const handleCreate = async () => {
    if (!newCar.model_group_id || !newCar.plate_number.trim() || !newCar.investor_id) {
      toast({ title: "Error", description: "Model group, plate number, and investor are required", variant: "destructive" })
      return
    }

    setIsCreating(true)
    const supabase = getSupabaseBrowserClient()

    const { error } = await supabase.from("cars").insert({
      plate_number: newCar.plate_number.trim(),
      investor_id: newCar.investor_id,
      model_group_id: parseInt(newCar.model_group_id),
    })

    if (error) {
      console.error("Error creating car:", error)
      toast({ title: "Error", description: `Failed to create car: ${error.message}`, variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Car created successfully" })
      setIsCreateOpen(false)
      setNewCar({ model_group_id: "", plate_number: "", investor_id: "" })
      loadCars()
    }
    setIsCreating(false)
  }

  // Delete car
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this car?")) return

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("cars").delete().eq("id", id)

    if (error) {
      toast({ title: "Error", description: "Failed to delete car", variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Car deleted" })
      loadCars()
    }
  }

  // Filter cars
  const filteredCars = useMemo(() => {
    if (!searchQuery.trim()) return cars
    const query = searchQuery.toLowerCase()
    return cars.filter((car) =>
      car.plate_number?.toLowerCase().includes(query) ||
      car.model_group_name?.toLowerCase().includes(query)
    )
  }, [cars, searchQuery])

  // ── Diagnostic: log every render ─────────────────────────────────────────
  // Shows cars/loading/filteredCars on every render so we can see if state
  // is cleared AFTER a successful setCars call. Remove after diagnosis.
  console.log(`[cars] RENDER: cars=${cars.length}, loading=${loading}, filteredCars=${filteredCars.length}, authVersion=${authVersion}`)

  // Status card config with specified colors
  const statusCards = [
    { key: "total", label: "Total Cars", count: statusCounts.total, icon: CarIcon, bg: "bg-blue-50", iconBg: "bg-blue-100", iconColor: "text-blue-700" },
    { key: "working", label: "Working", count: statusCounts.working, icon: TrendingUp, bg: "bg-green-50", iconBg: "bg-green-100", iconColor: "text-green-700" },
    { key: "parking", label: "Parking", count: statusCounts.parking, icon: ParkingCircle, bg: "bg-red-50", iconBg: "bg-red-100", iconColor: "text-red-700" },
    { key: "maintenance", label: "Maintenance", count: statusCounts.maintenance, icon: Wrench, bg: "bg-gray-50", iconBg: "bg-gray-100", iconColor: "text-gray-700" },
    { key: "selling", label: "Selling", count: statusCounts.selling, icon: DollarSign, bg: "bg-yellow-50", iconBg: "bg-yellow-100", iconColor: "text-yellow-700" },
    { key: "replacement", label: "Replacement", count: statusCounts.replacement, icon: RefreshCw, bg: "bg-orange-50", iconBg: "bg-orange-100", iconColor: "text-orange-700" },
  ]

  // Get status badge styling with specified colors
  const getStatusBadge = (status: string | null) => {
    const s = status?.toLowerCase()
    switch (s) {
      case "working":
        return <Badge className="bg-green-100 text-green-700 border-0 font-medium rounded-full px-3">Working</Badge>
      case "parking":
        return <Badge className="bg-red-100 text-red-700 border-0 font-medium rounded-full px-3">Parking</Badge>
      case "maintenance":
        return <Badge className="bg-gray-100 text-gray-700 border-0 font-medium rounded-full px-3">Maintenance</Badge>
      case "selling":
        return <Badge className="bg-yellow-100 text-yellow-700 border-0 font-medium rounded-full px-3">Selling</Badge>
      case "replacement":
        return <Badge className="bg-orange-100 text-orange-700 border-0 font-medium rounded-full px-3">Replacement</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-500 border-0 font-medium rounded-full px-3">{status || "-"}</Badge>
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Cars</h1>
            <p className="text-slate-500 text-sm">Manage your fleet</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#4ba6ea] hover:bg-[#3a95d9] rounded-xl shadow-sm transition-all">
                <Plus className="w-4 h-4 mr-2" />
                Add Car
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Add New Car</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Model Group *</Label>
                  <Select value={newCar.model_group_id} onValueChange={(v) => setNewCar({ ...newCar, model_group_id: v })}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select model group" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelGroups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plate Number *</Label>
                  <Input
                    value={newCar.plate_number}
                    onChange={(e) => setNewCar({ ...newCar, plate_number: e.target.value })}
                    placeholder="34 ABC 123"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Investor *</Label>
                  <Select value={newCar.investor_id} onValueChange={(v) => setNewCar({ ...newCar, investor_id: v })}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select investor" />
                    </SelectTrigger>
                    <SelectContent>
                      {investors.map((inv) => (
                        <SelectItem key={inv.id} value={String(inv.id)}>{inv.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={isCreating || !newCar.model_group_id || !newCar.plate_number.trim() || !newCar.investor_id}
                  className="w-full bg-[#4ba6ea] hover:bg-[#3a95d9] rounded-xl"
                >
                  {isCreating ? "Creating..." : "Create Car"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Status Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statusCards.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.key} className={`${card.bg} border-0 shadow-sm rounded-2xl transition-all hover:shadow-md hover:-translate-y-0.5`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">{card.count}</p>
                    </div>
                    <div className={`p-2.5 ${card.iconBg} rounded-xl`}>
                      <Icon className={`w-5 h-5 ${card.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Upcoming Alerts Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Upcoming Alerts</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Car Return Dates */}
            <Card className="border-0 shadow-sm rounded-2xl bg-white hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-slate-700 text-sm">Upcoming Returns</h3>
                </div>
                <div className="space-y-2">
                  {upcomingReturns.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No upcoming returns</p>
                  ) : (
                    upcomingReturns.map((item, idx) => {
                      const badge = getUrgencyBadge(item.days_left)
                      return (
                        <div key={idx} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-700 truncate">{item.plate_number}</p>
                            <p className="text-xs text-slate-400 truncate">{item.model_group_name || "-"}</p>
                          </div>
                          <div className="text-right ml-2">
                            <span className={`text-xs font-semibold ${badge.text} ${badge.bg} px-2 py-1 rounded-lg inline-block`}>
                              {badge.label}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(item.end_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full mt-2 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 rounded-xl h-8"
                  onClick={() => openAlertsModal("returns")}
                >
                  View All <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* Insurance Expiry */}
            <Card className="border-0 shadow-sm rounded-2xl bg-white hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-emerald-100 rounded-xl">
                    <Shield className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-slate-700 text-sm">Insurance Expiry</h3>
                </div>
                <div className="space-y-2">
                  {upcomingInsurance.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No upcoming expiries</p>
                  ) : (
                    upcomingInsurance.map((item, idx) => {
                      const badge = getUrgencyBadge(item.days_left)
                      return (
                        <div key={idx} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-700 truncate">{item.plate_number}</p>
                            <p className="text-xs text-slate-400 truncate">{item.model_group_name || "-"}</p>
                          </div>
                          <div className="text-right ml-2">
                            <span className={`text-xs font-semibold ${badge.text} ${badge.bg} px-2 py-1 rounded-lg inline-block`}>
                              {badge.label}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(item.target_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full mt-2 text-xs text-slate-500 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-xl h-8"
                  onClick={() => openAlertsModal("insurance")}
                >
                  View All <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* Inspection Expiry */}
            <Card className="border-0 shadow-sm rounded-2xl bg-white hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <ClipboardCheck className="w-4 h-4 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-slate-700 text-sm">Inspection Expiry</h3>
                </div>
                <div className="space-y-2">
                  {upcomingInspection.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No upcoming expiries</p>
                  ) : (
                    upcomingInspection.map((item, idx) => {
                      const badge = getUrgencyBadge(item.days_left)
                      return (
                        <div key={idx} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-700 truncate">{item.plate_number}</p>
                            <p className="text-xs text-slate-400 truncate">{item.model_group_name || "-"}</p>
                          </div>
                          <div className="text-right ml-2">
                            <span className={`text-xs font-semibold ${badge.text} ${badge.bg} px-2 py-1 rounded-lg inline-block`}>
                              {badge.label}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(item.target_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full mt-2 text-xs text-slate-500 hover:text-amber-600 hover:bg-amber-50/50 rounded-xl h-8"
                  onClick={() => openAlertsModal("inspection")}
                >
                  View All <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Alerts Modal */}
        <Dialog open={alertsModalType !== null} onOpenChange={() => setAlertsModalType(null)}>
          <DialogContent className="rounded-2xl max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {alertsModalType === "returns" && <><Calendar className="w-5 h-5 text-blue-600" /> All Upcoming Returns</>}
                {alertsModalType === "insurance" && <><Shield className="w-5 h-5 text-emerald-600" /> All Insurance Expiries</>}
                {alertsModalType === "inspection" && <><ClipboardCheck className="w-5 h-5 text-amber-600" /> All Inspection Expiries</>}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {allAlerts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No items found</p>
              ) : (
                allAlerts.map((item, idx) => {
                  const badge = getUrgencyBadge(item.days_left)
                  // Returns use end_date, insurance/inspection use target_date
                  const dateValue = alertsModalType === "returns" 
                    ? (item as UpcomingReturn).end_date 
                    : (item as UpcomingInsurance | UpcomingInspection).target_date
                  return (
                    <div key={idx} className="flex items-center justify-between py-3 px-3 bg-slate-50 rounded-xl">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 truncate">{item.plate_number}</p>
                        <p className="text-xs text-slate-400 truncate">{item.model_group_name || "-"}</p>
                      </div>
                      <div className="text-right ml-3">
                        <span className={`text-xs font-semibold ${badge.text} ${badge.bg} px-2 py-1 rounded-lg inline-block`}>
                          {badge.label}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {dateValue ? new Date(dateValue).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Search */}
        <Card className="border-0 shadow-sm rounded-2xl bg-white">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by plate number or model group..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl border-slate-200 focus-visible:ring-[#4ba6ea]/20"
              />
            </div>
          </CardContent>
        </Card>

        {/* Cars Table */}
        <Card className="border-0 shadow-sm overflow-hidden rounded-2xl bg-white">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4ba6ea]" />
              </div>
            ) : filteredCars.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <CarIcon className="w-12 h-12 mb-4 text-slate-300" />
                <p className="text-sm">No cars found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 border-b border-slate-100">
                    <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide py-4">Plate Number</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide py-4">Model Group</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide py-4">Year</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wide py-4">Status</TableHead>
                    <TableHead className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide py-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCars.map((car) => (
                    <TableRow key={car.car_id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                      <TableCell className="font-medium text-slate-800 py-4">{car.plate_number}</TableCell>
                      <TableCell className="text-slate-600 py-4">{car.model_group_name || "-"}</TableCell>
                      <TableCell className="text-slate-600 py-4">{car.manufacture_year || "-"}</TableCell>
                      <TableCell className="py-4">{getStatusBadge(car.status)}</TableCell>
                      <TableCell className="text-right py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/dashboard/cars/${car.car_id}/edit`}>
                            <Button variant="ghost" size="icon" className="hover:bg-slate-100 rounded-lg h-8 w-8">
                              <Edit className="w-4 h-4 text-slate-500" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" className="hover:bg-red-50 rounded-lg h-8 w-8" onClick={() => handleDelete(car.car_id)}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
