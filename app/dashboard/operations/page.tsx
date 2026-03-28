"use client"

import { Label } from "@/components/ui/label"
import {
  Plus,
  Search,
  Download,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Edit,
  FileText,
  X,
  ZoomIn,
  ZoomOut,
  Car,
  User,
  Gauge,
} from "lucide-react"

import { useState, useEffect, useCallback, useRef } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { format, addMonths } from "date-fns"
import { dataService } from "@/lib/data-service"
import { withTimeout } from "@/lib/utils"
import { useVisibilityRefresh } from "@/hooks/use-visibility-refresh"
import { useAuth } from "@/lib/auth-context"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// Operation type configuration
const operationConfig = {
  DELIVERY: {
    label: "Delivery",
    badgeClasses: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  RECEIVING: {
    label: "Receiving",
    badgeClasses: "bg-red-100 text-red-800 hover:bg-red-100",
  },
  CAR_WASH: {
    label: "Car Wash",
    badgeClasses: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  },
  SERVICE: {
    label: "Service",
    badgeClasses: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  },
  OIL_CHANGE: {
    label: "Oil Change",
    badgeClasses: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  },
}

type OperationType = keyof typeof operationConfig

export default function OperationsPage() {
  const { toast } = useToast()
  const { initialAuthChecked, user } = useAuth()
  const [isReady, setIsReady] = useState(false) // Track if state is fully initialized
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date()) // Use initializer
  const [operations, setOperations] = useState<any[]>([])
  const [filteredOperations, setFilteredOperations] = useState<any[]>([])
  const [cars, setCars] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingOperation, setEditingOperation] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [staffProfiles, setStaffProfiles] = useState<{ id: string; display_name: string }[]>([])
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [customerSearchValue, setCustomerSearchValue] = useState("")
  const [showPhotoGallery, setShowPhotoGallery] = useState(false)
  const [currentPhotos, setCurrentPhotos] = useState<any[]>([])
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)

  const [newOperation, setNewOperation] = useState({
    type: "RECEIVING" as OperationType,
    car_id: 0,
    customer_id: null as number | null,
    performed_by: "" as string,
    current_km: "",
    note: "",
    operation_date: new Date().toISOString().split("T")[0],
    cleanliness: "",
    images: [] as File[],
  })

  // Mark component as ready once auth is checked and selectedMonth is valid
  useEffect(() => {
    if (initialAuthChecked && selectedMonth instanceof Date && !isNaN(selectedMonth.getTime())) {
      setIsReady(true)
    }
  }, [initialAuthChecked, selectedMonth])

  useEffect(() => {
    if (isReady && user) {
      loadData()
    } else if (initialAuthChecked && !user) {
      setLoading(false)
    }
  }, [selectedMonth, isReady, user])

  // Refs must be declared before useVisibilityRefresh which uses isFetchingRef
  const opsReqRef = useRef(0)
  const loadDataRef = useRef<() => void>(() => {})
  const isFetchingRef = useRef(false)
  const hasLoadedOnceRef = useRef(false)

  // Refresh data when tab becomes visible - pass isFetchingRef to skip if fetch in progress
  useVisibilityRefresh(() => {
    if (!isReady || !user) return
    if (!(selectedMonth instanceof Date) || isNaN(selectedMonth.getTime())) return
    loadDataRef.current()
  }, isFetchingRef)

  // Keyboard navigation for photo gallery
  useEffect(() => {
    if (!showPhotoGallery || selectedPhotoIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && selectedPhotoIndex > 0) {
        setSelectedPhotoIndex(selectedPhotoIndex - 1)
        setZoomLevel(1)
      } else if (e.key === 'ArrowRight' && selectedPhotoIndex < currentPhotos.length - 1) {
        setSelectedPhotoIndex(selectedPhotoIndex + 1)
        setZoomLevel(1)
      } else if (e.key === 'Escape') {
        setSelectedPhotoIndex(null)
        setZoomLevel(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showPhotoGallery, selectedPhotoIndex, currentPhotos.length])

  useEffect(() => {
    if (showAddModal || showEditModal) {
      loadCars()
      loadCustomers()
      loadStaffProfiles()
    }
  }, [showAddModal, showEditModal])

  useEffect(() => {
    filterOperations()
  }, [operations, searchQuery, selectedType])

  const loadData = useCallback(async () => {
    // Guard: ensure selectedMonth is valid before fetching
    if (!(selectedMonth instanceof Date) || isNaN(selectedMonth.getTime())) {
      return
    }

    const reqId = ++opsReqRef.current
    isFetchingRef.current = true
    if (!hasLoadedOnceRef.current) setLoading(true)
    const safetyTimer = setTimeout(() => {
      if (reqId === opsReqRef.current) setLoading(false)
    }, 10000)
    try {
      const monthFilter = {
        year: selectedMonth.getFullYear(),
        month: selectedMonth.getMonth() + 1,
      }
      
      const [operationsData, carsData, customersData] = await withTimeout(
        Promise.all([
          dataService.getOperations(monthFilter),
          dataService.getCars(),
          dataService.getCustomers(),
        ]),
      )
      if (reqId !== opsReqRef.current) return
      setOperations(operationsData)
      setFilteredOperations(operationsData)
      setCars(carsData)
      setCustomers(customersData)
      hasLoadedOnceRef.current = true
    } catch (error: any) {
      if (reqId !== opsReqRef.current) return
      const isTimeout = error?.message?.startsWith("TIMEOUT")
      if (!hasLoadedOnceRef.current) {
        toast({
          title: isTimeout ? "Timeout" : "Error",
          description: isTimeout ? "Network timeout — please retry." : "Failed to load operations data",
          variant: "destructive",
        })
      }
    } finally {
      clearTimeout(safetyTimer)
      if (reqId === opsReqRef.current) {
        setLoading(false)
        isFetchingRef.current = false
      }
    }
  }, [selectedMonth, toast])

  // Keep ref updated to latest loadData for visibility refresh
  useEffect(() => {
    loadDataRef.current = loadData
  }, [loadData])

  const loadCars = async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from("cars")
        .select("id, plate_number, model_group(name)")
        .order("plate_number")

      if (error) throw error
      setCars(data || [])
    } catch (error) {
      console.error("[v0] Error loading cars:", error)
    }
  }

  const loadCustomers = async () => {
    try {
      const data = await dataService.getCustomers()
      setCustomers(data)
    } catch (error) {
      console.error("[v0] Error loading customers:", error)
    }
  }

  const loadStaffProfiles = async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("role", ["staff", "admin"])
        .order("full_name", { ascending: true })

      if (error) throw error
      setStaffProfiles(
        (data || []).map((p: any) => ({
          id: p.id,
          display_name: p.full_name || p.email || "Unknown",
        }))
      )
    } catch (error) {
      console.error("[v0] Error loading staff profiles:", error)
    }
  }

  const filterOperations = () => {
    let filtered = [...operations]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (op) =>
          op.cars?.plate_number?.toLowerCase().includes(query) ||
          op.note?.toLowerCase().includes(query) ||
          op.id.toString().includes(query)
      )
    }

    if (selectedType && selectedType !== "all") {
      filtered = filtered.filter((op) => op.type === selectedType)
    }

    setFilteredOperations(filtered)
  }

  const handleViewPhotos = async (operationId: number) => {
    setLoadingPhotos(true)
    setShowPhotoGallery(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('operation_photos')
        .select('*')
        .eq('operation_id', operationId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('[v0] Error fetching photos:', error)
        toast({
          title: "Error",
          description: "Failed to load photos",
          variant: "destructive",
        })
        setCurrentPhotos([])
      } else {
        setCurrentPhotos(data || [])
      }
    } catch (error) {
      console.error('[v0] Error fetching photos:', error)
      setCurrentPhotos([])
    } finally {
      setLoadingPhotos(false)
    }
  }

  const handleDownloadAll = async () => {
    for (const photo of currentPhotos) {
      const link = document.createElement('a')
      link.href = photo.file_url
      link.download = `photo-${photo.id}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    toast({
      title: "Success",
      description: `Downloaded ${currentPhotos.length} photo(s)`,
    })
  }

  const handleSubmit = async () => {
    if (!newOperation.car_id) {
      toast({
        title: "Error",
        description: "Please select a vehicle",
        variant: "destructive",
      })
      return
    }

    if (!newOperation.performed_by) {
      toast({
        title: "Error",
        description: "Please select who performed the operation",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      console.log("[v0] handleSubmit - Starting operation creation")
      console.log("[v0] handleSubmit - Images array:", newOperation.images)
      console.log("[v0] handleSubmit - Images count:", newOperation.images?.length || 0)
      
      // Step 1: Create operation first to get operation_id
      const createdOperation = await dataService.createOperation({
        car_id: newOperation.car_id,
        customer_id: newOperation.customer_id,
        performed_by: newOperation.performed_by,
        operation_type: newOperation.type,
        operation_date: newOperation.operation_date,
        current_kilometer: newOperation.current_km ? Number(newOperation.current_km) : 0,
        cleanliness_status: newOperation.cleanliness || null,
        note: newOperation.note || null,
      })
      console.log("[v0] handleSubmit - Operation created with ID:", createdOperation.id)

      // Step 2: Upload photos if any using server action
      let uploadedCount = 0
      if (newOperation.images && newOperation.images.length > 0) {
        console.log("[v0] handleSubmit - Starting photo upload for", newOperation.images.length, "files")
        
        // Serialize files to pass through server action
        const serializedFiles = await Promise.all(
          newOperation.images.map(async (file) => {
            const arrayBuffer = await file.arrayBuffer()
            return {
              name: file.name,
              type: file.type,
              size: file.size,
              arrayBuffer: Array.from(new Uint8Array(arrayBuffer)),
            }
          })
        )
        console.log("[v0] handleSubmit - Files serialized, count:", serializedFiles.length)
        
        const { uploadOperationPhotos } = await import('@/app/actions/upload-operation-photos')
        const result = await uploadOperationPhotos(
          createdOperation.id,
          serializedFiles
        )
        console.log("[v0] handleSubmit - Upload result:", result)
        uploadedCount = result.uploadedCount
      } else {
        console.log("[v0] handleSubmit - No images to upload")
      }

      toast({
        title: "Success",
        description: `Operation created successfully${uploadedCount > 0 ? ` with ${uploadedCount} photo(s)` : ""}`,
      })

      setShowAddModal(false)
      setNewOperation({
        type: "RECEIVING",
        car_id: 0,
        customer_id: null,
        performed_by: "",
        current_km: "",
        note: "",
        operation_date: new Date().toISOString().split("T")[0],
        cleanliness: "",
        images: [],
      })
      loadData()
    } catch (error: any) {
      console.error("[v0] Error creating operation:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create operation",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredOperations.map((op) => op.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id))
    }
  }

  const handleEdit = () => {
    if (selectedIds.length !== 1) {
      toast({
        title: "Selection Error",
        description: "Please select exactly one operation to edit",
        variant: "destructive",
      })
      return
    }

    const operationToEdit = operations.find((op) => op.id === selectedIds[0])
    if (operationToEdit) {
      setEditingOperation({
        ...operationToEdit,
        cleanliness: operationToEdit.cleanliness_status || "",
      })
      setShowEditModal(true)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingOperation) return

    setSubmitting(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from("operations")
        .update({
          operation_type: editingOperation.operation_type,
          operation_date: editingOperation.operation_date,
          car_id: editingOperation.car_id,
          customer_id: editingOperation.customer_id || null,
          current_km: editingOperation.current_km ? Number(editingOperation.current_km) : 0,
          cleanliness_status: editingOperation.cleanliness || null,
          note: editingOperation.note || null,
        })
        .eq("id", editingOperation.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Operation updated successfully",
      })

      setShowEditModal(false)
      setEditingOperation(null)
      setSelectedIds([])
      loadData()
    } catch (error: any) {
      console.error("Error updating operation:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update operation",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedIds.length} operation(s)?`)) return

    setSubmitting(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from("operations")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", selectedIds)

      if (error) throw error

      toast({
        title: "Success",
        description: `${selectedIds.length} operation(s) deleted successfully`,
      })

      setSelectedIds([])
      loadData()
    } catch (error: any) {
      console.error("Error deleting operations:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete operations",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadPDF = () => {
    toast({
      title: "Coming Soon",
      description: "PDF download functionality will be available soon",
    })
  }

  // Calculate stats from operations data
  const stats = {
    total: operations.length,
    byType: Object.keys(operationConfig).reduce((acc, type) => {
      acc[type] = operations.filter((op) => op.type === type).length
      return acc
    }, {} as Record<string, number>),
  }

  const allSelected = filteredOperations.length > 0 && selectedIds.length === filteredOperations.length

  return (
 <ProtectedRoute allowedRoles={["admin", "staff"]}>
  <DashboardLayout>
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-4">Operations</h1>
              {/* Month Selector */}
              <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-white">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}
                  className="h-8 w-8 p-0"
                >
                  <Car className="h-4 w-4" /> {/* Use Car icon */}
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
                  <Car className="h-4 w-4" /> {/* Use Car icon */}
                </Button>
              </div>
            </div>
            <Button
              onClick={() => setShowAddModal(true)}
              className="h-10 px-5 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: "#5BC0F8" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4AB0E8")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5BC0F8")}
            >
              <Car className="h-4 w-4 mr-2" /> {/* Use Car icon */}
              Add New Operation
            </Button>
          </div>

          {/* Dashboard Cards */}
          <div className="flex flex-wrap gap-8 items-center justify-center md:justify-start">
            <button
              onClick={() => setSelectedType("all")}
              className={`flex flex-col items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 hover:scale-110 hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] cursor-pointer ${
                selectedType === "all" ? "ring-4 ring-cyan-300/40 scale-105" : ""
              }`}
            >
              <div className="text-3xl font-bold">{stats.total}</div>
              <div className="text-xs text-center mt-1 px-2">Total Operations</div>
            </button>

            {Object.entries(operationConfig).map(([type, config]) => {
              const circleGradient =
                type === "DELIVERY"
                  ? "bg-gradient-to-br from-emerald-400 to-green-500"
                  : type === "RECEIVING"
                    ? "bg-gradient-to-br from-rose-400 to-red-500"
                    : type === "CAR_WASH"
                      ? "bg-gradient-to-br from-sky-400 to-blue-500"
                      : type === "SERVICE"
                        ? "bg-gradient-to-br from-slate-400 to-gray-500"
                        : "bg-gradient-to-br from-orange-400 to-orange-600"

              const isActive = selectedType === type

              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(isActive ? "all" : type)}
                  className={`flex flex-col items-center justify-center w-32 h-32 rounded-full ${circleGradient} text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 hover:scale-110 hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] cursor-pointer ${
                    isActive ? "ring-4 ring-offset-2 ring-white/40 scale-105" : ""
                  }`}
                >
                  <div className="text-3xl font-bold">{stats.byType[type] || 0}</div>
                  <div className="text-xs text-center mt-1 px-2">{config.label}</div>
                </button>
              )
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Car className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" /> {/* Use Car icon */}
              <Input
                placeholder="Search operations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(operationConfig).map(([type, config]) => (
                  <SelectItem key={type} value={type}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Operations Archive Table */}
          <Card>
            <CardHeader>
              <CardTitle>Operations Archive</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Car className="h-8 w-8 animate-spin text-gray-400" /> {/* Use Car icon */}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12">
                        <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
                      </TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Operation Type</TableHead>
                      <TableHead>Plate Number</TableHead>
                      <TableHead>Performed By</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Kilometer</TableHead>
                      <TableHead>Cleanliness</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Photos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOperations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                          No operations found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOperations.map((op) => {
                        const customerName = op.customers
                          ? `${op.customers.first_name} ${op.customers.last_name}`
                          : "N/A"
                        
                        return (
                          <TableRow key={op.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.includes(op.id)}
                                onCheckedChange={(checked) => handleSelectOne(op.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell>{format(new Date(op.operation_date), "MMM d, yyyy")}</TableCell>
                            <TableCell>
                              <Badge className={operationConfig[op.type as OperationType]?.badgeClasses}>
                                {operationConfig[op.type as OperationType]?.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">{op.car?.plate_number || "N/A"}</TableCell>
                            <TableCell>{op.performer?.full_name || op.performer?.email || "-"}</TableCell>
                            <TableCell>{customerName}</TableCell>
                            <TableCell>{op.current_km ? `${op.current_km.toLocaleString()} km` : "N/A"}</TableCell>
                            <TableCell>
                              {op.cleanliness_status === "clean" ? (
                                <Badge className="bg-green-100 text-green-800">Clean</Badge>
                              ) : op.cleanliness_status === "not_clean" ? (
                                <Badge className="bg-red-100 text-red-800">Not Clean</Badge>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={op.note || ""}>
                              {op.note || <span className="text-slate-400">-</span>}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-blue-600 hover:text-blue-700 bg-transparent"
                                onClick={() => handleViewPhotos(op.id)}
                              >
                                <Car className="h-4 w-4 mr-1" /> {/* Use Car icon */}
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Bottom Action Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg py-4 px-6 z-50">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">
                {selectedIds.length} operation(s) selected
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleDownloadPDF} disabled={submitting} className="bg-transparent">
                  <Car className="h-4 w-4 mr-2" /> {/* Use Car icon */}
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={handleEdit}
                  disabled={submitting || selectedIds.length !== 1}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50 bg-transparent"
                >
                  <Car className="h-4 w-4 mr-2" /> {/* Use Car icon */}
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBulkDelete}
                  disabled={submitting}
                  className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
                >
                  <Car className="h-4 w-4 mr-2" /> {/* Use Car icon */}
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add Operation Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto border-0 shadow-lg shadow-slate-200/50 rounded-2xl p-0">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 rounded-t-2xl">
              <DialogTitle className="text-2xl font-bold text-slate-800 tracking-tight">New Operation</DialogTitle>
              <p className="text-slate-500 text-sm mt-1">Fill in the details to create a new operation record</p>
            </div>

            {/* Section 1: Basic Info */}
            <div className="p-6 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5">Basic Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Date Field */}
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Car className="h-4 w-4 text-[#5BC0F8]" /> {/* Use Car icon */}
                    Date
                    <span className="text-red-400 text-xs">*</span>
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={newOperation.operation_date}
                    onChange={(e) => setNewOperation({ ...newOperation, operation_date: e.target.value })}
                    className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                  />
                </div>

                {/* Operation Type Field */}
                <div className="space-y-2">
                  <Label htmlFor="operation-type" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Car className="h-4 w-4 text-[#5BC0F8]" /> {/* Use Car icon */}
                    Operation Type
                    <span className="text-red-400 text-xs">*</span>
                  </Label>
                  <Select
                    value={newOperation.type}
                    onValueChange={(value) => {
                      const newType = value as OperationType
                      // Clear customer_id and cleanliness if switching to non-delivery/receiving type
                      if (newType !== 'DELIVERY' && newType !== 'RECEIVING') {
                        setNewOperation({ ...newOperation, type: newType, customer_id: null, cleanliness: '' })
                      } else {
                        setNewOperation({ ...newOperation, type: newType })
                      }
                    }}
                  >
                    <SelectTrigger
                      id="operation-type"
                      className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                    >
                      <SelectValue placeholder="Select operation type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {Object.entries(operationConfig).map(([type, config]) => (
                        <SelectItem key={type} value={type} className="rounded-lg">
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section 2: Vehicle Info */}
            <div className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5">
                Vehicle Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Plate Number Field */}
                <div className="space-y-2">
                  <Label htmlFor="plate" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Car className="h-4 w-4 text-[#5BC0F8]" /> {/* Use Car icon */}
                    Plate Number
                    <span className="text-red-400 text-xs">*</span>
                  </Label>
                  <Select
                    value={newOperation.car_id.toString()}
                    onValueChange={(value) => setNewOperation({ ...newOperation, car_id: Number(value) })}
                  >
                    <SelectTrigger
                      id="plate"
                      className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                    >
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {cars.map((car) => (
                        <SelectItem key={car.id} value={car.id.toString()} className="rounded-lg">
                          {car.plate_number} - {car.model_group?.brand} {car.model_group?.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Performed By Field */}
                <div className="space-y-2">
                  <Label htmlFor="performed-by" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <User className="h-4 w-4 text-[#5BC0F8]" />
                    Performed By
                    <span className="text-red-400 text-xs">*</span>
                  </Label>
                  <Select
                    value={newOperation.performed_by}
                    onValueChange={(value) => setNewOperation({ ...newOperation, performed_by: value })}
                  >
                    <SelectTrigger
                      id="performed-by"
                      className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                    >
                      <SelectValue placeholder="Select person" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {staffProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id} className="rounded-lg">
                          {profile.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Customer Name Field - Only show for DELIVERY and RECEIVING */}
                {(newOperation.type === 'DELIVERY' || newOperation.type === 'RECEIVING') && (
                  <div className="space-y-2 animate-in fade-in-50 slide-in-from-top-2 duration-300">
                    <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <User className="h-4 w-4 text-[#5BC0F8]" />
                      Customer Name
                    </Label>
                    <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={customerSearchOpen}
                          className="h-12 w-full justify-between bg-white border-slate-200 rounded-xl hover:bg-slate-50 focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all bg-transparent"
                        >
                          {newOperation.customer_id
                            ? customers.find((customer) => customer.id === newOperation.customer_id)
                              ? `${customers.find((c) => c.id === newOperation.customer_id)?.first_name} ${customers.find((c) => c.id === newOperation.customer_id)?.last_name}`
                              : "Select customer"
                            : "Select customer"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 rounded-xl" align="start">
                        <Command className="rounded-xl">
                          <CommandInput
                            placeholder="Search customer..."
                            value={customerSearchValue}
                            onValueChange={setCustomerSearchValue}
                          />
                          <CommandList>
                            <CommandEmpty>
                              <p className="text-sm text-slate-500 py-2">No customer found.</p>
                            </CommandEmpty>
                            <CommandGroup>
                              {customers.map((customer) => (
                                <CommandItem
                                  key={customer.id}
                                  value={`${customer.first_name} ${customer.last_name}`}
                                  onSelect={() => {
                                    setNewOperation({ ...newOperation, customer_id: customer.id })
                                    setCustomerSearchValue(`${customer.first_name} ${customer.last_name}`)
                                    setCustomerSearchOpen(false)
                                  }}
                                  className="rounded-lg"
                                >
                                  {newOperation.customer_id === customer.id ? (
                                    <span className="mr-2 h-4 w-4 opacity-100">✓</span>
                                  ) : (
                                    <span className="mr-2 h-4 w-4 opacity-0"></span>
                                  )}
                                  {customer.first_name} {customer.last_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Car Cleanliness Field - Only show for DELIVERY and RECEIVING */}
                {(newOperation.type === 'DELIVERY' || newOperation.type === 'RECEIVING') && (
                  <div className="space-y-2 animate-in fade-in-50 slide-in-from-top-2 duration-300">
                    <Label htmlFor="cleanliness" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Car className="h-4 w-4 text-[#5BC0F8]" />
                      Car Cleanliness
                    </Label>
                    <Select
                      value={newOperation.cleanliness}
                      onValueChange={(value) => setNewOperation({ ...newOperation, cleanliness: value })}
                    >
                      <SelectTrigger
                        id="cleanliness"
                        className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                      >
                        <SelectValue placeholder="Select cleanliness" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="clean" className="rounded-lg">Clean</SelectItem>
                        <SelectItem value="not_clean" className="rounded-lg">Not Clean</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Current Kilometer Field */}
                <div className="space-y-2">
                  <Label htmlFor="kilometer" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-[#5BC0F8]" /> {/* Use Gauge icon */}
                    Current Kilometer
                  </Label>
                  <Input
                    id="kilometer"
                    type="number"
                    placeholder="Enter current kilometer"
                    value={newOperation.current_km}
                    onChange={(e) => setNewOperation({ ...newOperation, current_km: e.target.value })}
                    className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Note */}
            <div className="p-6 bg-gradient-to-br from-slate-50 to-white border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5">Note</h3>
              <div className="space-y-2">
                <Label htmlFor="note" className="text-sm font-medium text-slate-700">
                  Explanation / Note (optional)
                </Label>
                <textarea
                  id="note"
                  rows={3}
                  placeholder="Add any notes or explanation for this operation..."
                  value={newOperation.note}
                  onChange={(e) => setNewOperation({ ...newOperation, note: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all resize-y"
                />
              </div>
            </div>

            {/* Section 4: Photos Upload */}
            <div className="p-6 bg-gradient-to-br from-slate-50 to-white border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5">Photos Upload</h3>

              <div className="space-y-2">
                <Label htmlFor="photos" className="text-sm font-medium text-slate-700">
                  Select Photos
                </Label>
                <div className="relative">
                  <Input
                    id="photos"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      setNewOperation({ ...newOperation, images: files })
                    }}
                    className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#5BC0F8]/20 focus:border-[#5BC0F8] transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#5BC0F8]/10 file:text-[#5BC0F8] hover:file:bg-[#5BC0F8]/20 cursor-pointer"
                  />
                </div>
                {newOperation.images && newOperation.images.length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl mt-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Car className="h-4 w-4 text-blue-600" /> {/* Use Car icon */}
                    </div>
                    <p className="text-sm font-medium text-blue-800">
                      {newOperation.images.length} photo{newOperation.images.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false)
                  setCustomerSearchValue("")
                }}
                disabled={submitting}
                className="h-11 px-6 rounded-xl border-slate-200 hover:bg-slate-50 font-medium transition-all bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="h-11 px-6 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all"
                style={{ backgroundColor: "#5BC0F8" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4AB0E8")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5BC0F8")}
              >
                {submitting ? (
                  <>
                    <Car className="h-4 w-4 mr-2 animate-spin" /> {/* Use Car icon */}
                    Creating...
                  </>
                ) : (
                  <>
                    <Car className="h-4 w-4 mr-2" /> {/* Use Car icon */}
                    Create Operation
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Operation Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl text-center">Edit Operation</DialogTitle>
            </DialogHeader>
            {editingOperation && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Date *</label>
                  <Input
                    type="date"
                    value={editingOperation.operation_date}
                    onChange={(e) => setEditingOperation({ ...editingOperation, operation_date: e.target.value })}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Operation Type *</label>
                  <Select
                    value={editingOperation.operation_type}
                    onValueChange={(value) =>
                      setEditingOperation({ ...editingOperation, operation_type: value as OperationType })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select operation type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(operationConfig).map(([type, config]) => (
                        <SelectItem key={type} value={type}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Plate Number *</label>
                  <Select
                    value={editingOperation.car_id?.toString()}
                    onValueChange={(value) => setEditingOperation({ ...editingOperation, car_id: Number(value) })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {cars.map((car) => (
                        <SelectItem key={car.id} value={car.id.toString()}>
                          {car.plate_number} - {car.model_group?.brand} {car.model_group?.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Customer Name</label>
                  <Select
                    value={editingOperation.customer_id?.toString() || ""}
                    onValueChange={(value) =>
                      setEditingOperation({ ...editingOperation, customer_id: value ? Number(value) : null })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select customer (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.first_name} {customer.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Car Cleanliness</label>
                  <Select
                    value={editingOperation.cleanliness || ""}
                    onValueChange={(value) => setEditingOperation({ ...editingOperation, cleanliness: value })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select cleanliness" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clean">Clean</SelectItem>
                      <SelectItem value="not_clean">Not Clean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Current Kilometer</label>
                  <Input
                    type="number"
                    placeholder="Enter current kilometer"
                    value={editingOperation.current_km || ""}
                    onChange={(e) => setEditingOperation({ ...editingOperation, current_km: e.target.value })}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Photos</label>
                  <Input type="file" accept="image/*" multiple className="h-11" />
                </div>
              </div>
            )}
            <DialogFooter className="gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false)
                  setEditingOperation(null)
                }}
                disabled={submitting}
                className="rounded-[10px] px-6 py-3 h-auto font-semibold bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-[10px] px-6 py-3 h-auto"
              >
                {submitting ? (
                  <>
                    <Car className="h-4 w-4 mr-2 animate-spin" /> {/* Use Car icon */}
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Professional Full-Screen Lightbox Gallery */}
        {showPhotoGallery && (
          <div className="fixed inset-0 z-50 bg-black">
            {loadingPhotos ? (
              <div className="flex items-center justify-center h-full">
                <Car className="h-16 w-16 animate-spin text-white" /> {/* Use Car icon */}
              </div>
            ) : currentPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white">
                <Car className="h-24 w-24 mb-6 opacity-30" /> {/* Use Car icon */}
                <p className="text-2xl font-semibold mb-2">No photos available</p>
                <p className="text-gray-400 mb-8">Photos uploaded for this operation will appear here</p>
                <Button
                  onClick={() => {
                    setShowPhotoGallery(false)
                    setSelectedPhotoIndex(null)
                    setCurrentPhotos([])
                    setZoomLevel(1)
                  }}
                  className="bg-white text-black hover:bg-gray-100"
                >
                  Close
                </Button>
              </div>
            ) : (
              <>
                {/* Top Bar */}
                <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
                  <div className="flex items-center justify-between p-4 md:p-6">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setShowPhotoGallery(false)
                          setSelectedPhotoIndex(null)
                          setCurrentPhotos([])
                          setZoomLevel(1)
                        }}
                        className="text-white hover:bg-white/10 rounded-full bg-transparent"
                      >
                        <X className="h-6 w-6" />
                      </Button>
                      <div className="text-white">
                        <p className="text-sm text-gray-300">Operation Photos</p>
                        <p className="text-lg font-semibold">
                          {selectedPhotoIndex !== null ? `${selectedPhotoIndex + 1} / ${currentPhotos.length}` : `${currentPhotos.length} photo${currentPhotos.length !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleDownloadAll}
                        className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/20 hidden md:flex"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download All
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Main Image Display */}
                {selectedPhotoIndex !== null ? (
                  <div className="h-full flex flex-col">
                    {/* Large Image Area */}
                    <div className="flex-1 flex items-center justify-center p-4 md:p-8 pt-24 pb-32">
                      <div className="relative max-w-full max-h-full flex items-center justify-center">
                        <img
                          src={currentPhotos[selectedPhotoIndex].file_url || "/placeholder.svg"}
                          alt={`Photo ${selectedPhotoIndex + 1}`}
                          className="max-w-full max-h-[calc(100vh-16rem)] object-contain transition-transform duration-300"
                          style={{ transform: `scale(${zoomLevel})` }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {/* Navigation Arrows */}
                      {selectedPhotoIndex > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedPhotoIndex(selectedPhotoIndex - 1)
                            setZoomLevel(1)
                          }}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 rounded-full h-14 w-14 backdrop-blur-sm bg-black/30 border border-white/20 bg-transparent"
                        >
                          <ChevronLeft className="h-8 w-8" />
                        </Button>
                      )}
                      {selectedPhotoIndex < currentPhotos.length - 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedPhotoIndex(selectedPhotoIndex + 1)
                            setZoomLevel(1)
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 rounded-full h-14 w-14 backdrop-blur-sm bg-black/30 border border-white/20 bg-transparent"
                        >
                          <ChevronRight className="h-8 w-8" />
                        </Button>
                      )}

                      {/* Zoom Controls */}
                      <div className="absolute right-4 bottom-36 flex flex-col gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setZoomLevel(Math.min(zoomLevel + 0.5, 3))}
                          disabled={zoomLevel >= 3}
                          className="text-white hover:bg-white/10 rounded-full backdrop-blur-sm bg-black/30 border border-white/20 bg-transparent"
                        >
                          <ZoomIn className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setZoomLevel(Math.max(zoomLevel - 0.5, 1))}
                          disabled={zoomLevel <= 1}
                          className="text-white hover:bg-white/10 rounded-full backdrop-blur-sm bg-black/30 border border-white/20 bg-transparent"
                        >
                          <ZoomOut className="h-5 w-5" />
                        </Button>
                        <a
                          href={currentPhotos[selectedPhotoIndex].file_url}
                          download
                          className="flex items-center justify-center h-10 w-10 text-white hover:bg-white/10 rounded-full backdrop-blur-sm bg-black/30 border border-white/20 transition-colors"
                        >
                          <Download className="h-5 w-5" />
                        </a>
                      </div>
                    </div>

                    {/* Thumbnail Navigation */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                      <div className="p-4 overflow-x-auto">
                        <div className="flex gap-2 md:gap-3 justify-center min-w-max mx-auto">
                          {currentPhotos.map((photo, index) => (
                            <button
                              key={photo.id}
                              onClick={() => {
                                setSelectedPhotoIndex(index)
                                setZoomLevel(1)
                              }}
                              className={`relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden transition-all duration-300 ${
                                selectedPhotoIndex === index
                                  ? 'ring-4 ring-white scale-110'
                                  : 'ring-2 ring-white/30 hover:ring-white/60 opacity-70 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={photo.file_url || "/placeholder.svg"}
                                alt={`Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Grid View */
                  <div className="h-full overflow-y-auto pt-24 pb-8 px-4 md:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 max-w-7xl mx-auto">
                      {currentPhotos.map((photo, index) => (
                        <button
                          key={photo.id}
                          onClick={() => setSelectedPhotoIndex(index)}
                          className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer transition-transform duration-300 hover:scale-105"
                        >
                          <img
                            src={photo.file_url || "/placeholder.svg"}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                            <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
