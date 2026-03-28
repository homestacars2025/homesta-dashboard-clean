"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileText,
  Image as ImageIcon,
  Receipt,
  Upload,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"

type TrafficFine = {
  id: number
  status: "unpaid" | "paid"
  car_id: string | null  // UUID in database (references cars.id)
  plate_number: string
  violation_number: string
  customer_id: string | null  // UUID in database
  customer_name: string | null
  notification_date: string | null
  amount: number | null
  location: string | null
  violation_date: string | null
  violation_time: string | null
  article: string | null
  description: string | null
  fine_image_url: string | null
  fine_pdf_url: string | null
  payment_receipt_url: string | null
  created_at: string
}

type Car = {
  id: string  // UUID
  plate_number: string
}

type Customer = {
  id: string  // UUID
  first_name: string | null
  last_name: string | null
}

type FineFormData = {
  car_id: string  // UUID - selected from dropdown
  customer_id: string  // UUID - selected from dropdown
  violation_number: string
  notification_date: string
  amount: string
  location: string
  violation_date: string
  violation_time: string
  article: string
  description: string
}

const defaultFormData: FineFormData = {
  car_id: "",
  customer_id: "",
  violation_number: "",
  notification_date: "",
  amount: "",
  location: "",
  violation_date: "",
  violation_time: "",
  article: "",
  description: "",
}

export default function TrafficFinesPage() {
  const { toast } = useToast()
  const [fines, setFines] = useState<TrafficFine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingFine, setEditingFine] = useState<TrafficFine | null>(null)
  const [formData, setFormData] = useState<FineFormData>(defaultFormData)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [fineToDelete, setFineToDelete] = useState<TrafficFine | null>(null)
  const [fineImageFile, setFineImageFile] = useState<File | null>(null)
  const [finePdfFile, setFinePdfFile] = useState<File | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [fineToMarkPaid, setFineToMarkPaid] = useState<TrafficFine | null>(null)
  const [paymentReceiptFile, setPaymentReceiptFile] = useState<File | null>(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [cars, setCars] = useState<Car[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true)
  const isMountedRef = useRef(true)

  const loadFines = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowserClient()

      const { data, error } = await supabase
        .from("traffic_fines")
        .select("*")
        .order("created_at", { ascending: false })

      if (!isMountedRef.current) return

      if (error) {
        console.error("Error loading fines:", error)
        toast({
          title: "Error",
          description: "Failed to load traffic fines.",
          variant: "destructive",
        })
        return
      }

      setFines(data || [])
    } catch (error) {
      console.error("Failed to load fines:", error)
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  // Load cars and customers for dropdowns
  const loadDropdownData = useCallback(async () => {
    setIsLoadingDropdowns(true)
    try {
      const supabase = getSupabaseBrowserClient()

      // Load cars
      const { data: carsData, error: carsError } = await supabase
        .from("cars")
        .select("id, plate_number")
        .order("plate_number")

      if (carsError) {
        console.error("Error loading cars:", carsError)
      } else {
        setCars(carsData || [])
      }

      // Load customers
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, first_name, last_name")
        .order("first_name")

      if (customersError) {
        console.error("Error loading customers:", customersError)
      } else {
        setCustomers(customersData || [])
      }
    } catch (error) {
      console.error("Failed to load dropdown data:", error)
    } finally {
      setIsLoadingDropdowns(false)
    }
  }, [])



  useEffect(() => {
    isMountedRef.current = true
    loadFines()
    loadDropdownData()
    return () => {
      isMountedRef.current = false
    }
  }, [loadFines, loadDropdownData])

  const filteredFines = fines.filter((fine) => {
    const matchesSearch =
      fine.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fine.violation_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fine.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fine.location?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus =
      statusFilter === "all" || fine.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleOpenForm = (fine?: TrafficFine) => {
    if (fine) {
      setEditingFine(fine)
      setFormData({
        car_id: fine.car_id || "",
        customer_id: fine.customer_id || "",
        violation_number: fine.violation_number || "",
        notification_date: fine.notification_date || "",
        amount: fine.amount?.toString() || "",
        location: fine.location || "",
        violation_date: fine.violation_date || "",
        violation_time: fine.violation_time || "",
        article: fine.article || "",
        description: fine.description || "",
      })
    } else {
      setEditingFine(null)
      setFormData(defaultFormData)
    }
    setFineImageFile(null)
    setFinePdfFile(null)
    setIsFormOpen(true)
  }

  // Get selected car from dropdown
  const selectedCar = cars.find(c => c.id === formData.car_id)

  // Validation: car must be selected AND violation_number must be filled
  const canUploadFiles = !!selectedCar && formData.violation_number.trim() !== ""

  // Get sequence number for a plate (count of existing fines + 1)
  const getSequenceNumber = async (plateNumber: string): Promise<number> => {
    const supabase = getSupabaseBrowserClient()
    const { count, error } = await supabase
      .from("traffic_fines")
      .select("*", { count: "exact", head: true })
      .eq("plate_number", plateNumber)

    if (error) {
      console.error("Error getting sequence:", error)
      return 1
    }
    return (count || 0) + 1
  }

  // Upload file to Supabase Storage bucket "cezalar"
  // Folder structure: CZ-R/ (images), CZ-D/ (documents), CZ-F/ (receipts)
  // File naming: CZ-{type}-{plate_number}-{sequence}.{ext}
  const uploadFile = async (
    file: File, 
    plateNumber: string, 
    sequence: number,
    fileType: "fine_image" | "fine_pdf" | "payment_receipt"
  ): Promise<string | null> => {
    if (!plateNumber.trim()) {
      console.error("Upload error: plate_number is required")
      return null
    }

    const supabase = getSupabaseBrowserClient()
    const cleanPlate = plateNumber.trim().replace(/\s+/g, "")
    
    // Determine folder, prefix, and extension based on file type
    let folder: string
    let prefix: string
    let ext: string
    
    switch (fileType) {
      case "fine_image":
        folder = "CZ-R"
        prefix = "CZ-R"
        ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        break
      case "fine_pdf":
        folder = "CZ-D"
        prefix = "CZ-D"
        ext = "pdf"
        break
      case "payment_receipt":
        folder = "CZ-F"
        prefix = "CZ-F"
        ext = "pdf"
        break
    }
    
    // Build file path: {folder}/{prefix}-{plate}-{sequence}.{ext}
    const filename = `${prefix}-${cleanPlate}-${sequence}.${ext}`
    const filePath = `${folder}/${filename}`
    
    const { error } = await supabase.storage
      .from("cezalar")
      .upload(filePath, file, { upsert: true })

    if (error) {
      console.error("Upload error:", error)
      toast({
        title: "Upload Error",
        description: `Failed to upload: ${error.message}`,
        variant: "destructive",
      })
      return null
    }

    const { data: urlData } = supabase.storage
      .from("cezalar")
      .getPublicUrl(filePath)

    return urlData.publicUrl
  }

  const handleSave = async () => {
    const violationNumber = formData.violation_number.trim()

    if (!selectedCar || !violationNumber) {
      toast({
        title: "Validation Error",
        description: "Car and violation number are required.",
        variant: "destructive",
      })
      return
    }

    const plateNumber = selectedCar.plate_number

    // Get selected customer
    const selectedCustomer = customers.find(c => c.id === formData.customer_id)
    const customerName = selectedCustomer 
      ? `${selectedCustomer.first_name || ""} ${selectedCustomer.last_name || ""}`.trim() 
      : null

    setIsSaving(true)

    try {
      const supabase = getSupabaseBrowserClient()

      let fineImageUrl: string | null = editingFine?.fine_image_url || null
      let finePdfUrl: string | null = editingFine?.fine_pdf_url || null

      // Get sequence number for this plate (only for new fines with file uploads)
      let sequence = 1
      if (!editingFine && (fineImageFile || finePdfFile)) {
        sequence = await getSequenceNumber(plateNumber)
      }

      // Upload files if provided
      if (fineImageFile) {
        setIsUploading(true)
        fineImageUrl = await uploadFile(fineImageFile, plateNumber, sequence, "fine_image")
        setIsUploading(false)
      }

      if (finePdfFile) {
        setIsUploading(true)
        finePdfUrl = await uploadFile(finePdfFile, plateNumber, sequence, "fine_pdf")
        setIsUploading(false)
      }

      // Build the data object with car_id and customer_id
      const fineData = {
        car_id: formData.car_id || null,
        plate_number: plateNumber,
        violation_number: violationNumber,
        customer_id: formData.customer_id || null,
        customer_name: customerName,
        notification_date: formData.notification_date || null,
        amount: formData.amount ? parseFloat(formData.amount) : null,
        location: formData.location.trim() || null,
        violation_date: formData.violation_date || null,
        violation_time: formData.violation_time || null,
        article: formData.article.trim() || null,
        description: formData.description.trim() || null,
        fine_image_url: fineImageUrl,
        fine_pdf_url: finePdfUrl,
      }

      if (editingFine) {
        const { error } = await supabase
          .from("traffic_fines")
          .update(fineData)
          .eq("id", editingFine.id)

        if (error) throw error

        toast({
          title: "Fine Updated",
          description: "Traffic fine has been updated successfully.",
        })
      } else {
        const { error } = await supabase
          .from("traffic_fines")
          .insert({ ...fineData, status: "unpaid" })

        if (error) throw error

        toast({
          title: "Fine Added",
          description: "Traffic fine has been added successfully.",
        })
      }

      setIsFormOpen(false)
      setFormData(defaultFormData)
      setEditingFine(null)
      setFineImageFile(null)
      setFinePdfFile(null)
      loadFines()
    } catch (error: any) {
      console.error("Error saving fine:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to save traffic fine. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
      setIsUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!fineToDelete) return

    try {
      const supabase = getSupabaseBrowserClient()

      const { error } = await supabase
        .from("traffic_fines")
        .delete()
        .eq("id", fineToDelete.id)

      if (error) throw error

      toast({
        title: "Fine Deleted",
        description: "Traffic fine has been deleted.",
      })

      setDeleteConfirmOpen(false)
      setFineToDelete(null)
      loadFines()
    } catch (error) {
      console.error("Error deleting fine:", error)
      toast({
        title: "Error",
        description: "Failed to delete traffic fine.",
        variant: "destructive",
      })
    }
  }

  const handleMarkAsPaid = async () => {
    if (!fineToMarkPaid || !paymentReceiptFile) {
      toast({
        title: "Validation Error",
        description: "Please upload a payment receipt.",
        variant: "destructive",
      })
      return
    }

    setIsProcessingPayment(true)

    try {
      const supabase = getSupabaseBrowserClient()

      // Get sequence for this fine's plate number
      const sequence = await getSequenceNumber(fineToMarkPaid.plate_number)

      // Upload payment receipt to CZ-F folder
      const receiptUrl = await uploadFile(
        paymentReceiptFile, 
        fineToMarkPaid.plate_number, 
        sequence, 
        "payment_receipt"
      )

      if (!receiptUrl) {
        throw new Error("Failed to upload receipt")
      }

      // Update fine status and receipt URL
      const { error } = await supabase
        .from("traffic_fines")
        .update({
          status: "paid",
          payment_receipt_url: receiptUrl,
        })
        .eq("id", fineToMarkPaid.id)

      if (error) throw error

      toast({
        title: "Payment Recorded",
        description: "Fine has been marked as paid.",
      })

      setPaymentDialogOpen(false)
      setFineToMarkPaid(null)
      setPaymentReceiptFile(null)
      loadFines()
    } catch (error) {
      console.error("Error marking as paid:", error)
      toast({
        title: "Error",
        description: "Failed to record payment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessingPayment(false)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return "—"
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—"
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(amount)
  }

  return (
    <ProtectedRoute allowedRoles={["admin", "staff"]}>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Traffic Fines</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage and track traffic violation fines
            </p>
          </div>
          <Button onClick={() => handleOpenForm()} className="gap-2 bg-[#4ba6ea] hover:bg-[#3a8fd4]">
            <Plus className="h-4 w-4" />
            Add Fine
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by plate, violation, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 focus-visible:ring-[#4ba6ea]"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] focus:ring-[#4ba6ea]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fines</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Plate Number</TableHead>
                  <TableHead>Violation #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Notification Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Violation Date</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Loading traffic fines...
                    </TableCell>
                  </TableRow>
                ) : filteredFines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <AlertTriangle className="h-10 w-10 text-gray-300" />
                        <p className="text-gray-500 font-medium">No traffic fines found</p>
                        <p className="text-gray-400 text-sm">
                          {searchQuery || statusFilter !== "all"
                            ? "Try adjusting your filters"
                            : "Add a traffic fine to get started"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFines.map((fine) => (
                    <TableRow key={fine.id} className="hover:bg-[#4ba6ea]/10 transition-colors">
                      <TableCell>
                        {fine.status === "paid" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Paid
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-100">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Unpaid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{fine.plate_number}</TableCell>
                      <TableCell>{fine.violation_number}</TableCell>
                      <TableCell>{fine.customer_name || "—"}</TableCell>
                      <TableCell>{formatDate(fine.notification_date)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(fine.amount)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{fine.location || "—"}</TableCell>
                      <TableCell>
                        {fine.violation_date ? (
                          <span>
                            {formatDate(fine.violation_date)}
                            {fine.violation_time && (
                              <span className="text-gray-400 text-xs ml-1">{fine.violation_time}</span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {fine.fine_image_url && (
                            <a
                              href={fine.fine_image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded hover:bg-gray-100"
                              title="View Image"
                            >
                              <ImageIcon className="h-4 w-4 text-blue-500" />
                            </a>
                          )}
                          {fine.fine_pdf_url && (
                            <a
                              href={fine.fine_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded hover:bg-gray-100"
                              title="View PDF"
                            >
                              <FileText className="h-4 w-4 text-red-500" />
                            </a>
                          )}
                          {fine.payment_receipt_url && (
                            <a
                              href={fine.payment_receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded hover:bg-gray-100"
                              title="View Receipt"
                            >
                              <Receipt className="h-4 w-4 text-emerald-500" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {fine.status === "unpaid" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setFineToMarkPaid(fine)
                                setPaymentReceiptFile(null)
                                setPaymentDialogOpen(true)
                              }}
                              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            >
                              Mark as Paid
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenForm(fine)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setFineToDelete(fine)
                                  setDeleteConfirmOpen(true)
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Summary */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex-1">
            <p className="text-sm font-medium text-rose-700">Unpaid Fines</p>
            <p className="text-2xl font-bold text-rose-900 mt-1">
              {fines.filter((f) => f.status === "unpaid").length}
            </p>
            <p className="text-sm text-rose-600 mt-1">
              Total: {formatCurrency(
                fines
                  .filter((f) => f.status === "unpaid")
                  .reduce((sum, f) => sum + (f.amount || 0), 0)
              )}
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex-1">
            <p className="text-sm font-medium text-emerald-700">Paid Fines</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">
              {fines.filter((f) => f.status === "paid").length}
            </p>
            <p className="text-sm text-emerald-600 mt-1">
              Total: {formatCurrency(
                fines
                  .filter((f) => f.status === "paid")
                  .reduce((sum, f) => sum + (f.amount || 0), 0)
              )}
            </p>
          </div>
        </div>

        {/* Add/Edit Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFine ? "Edit Traffic Fine" : "Add Traffic Fine"}</DialogTitle>
              <DialogDescription>
                {editingFine
                  ? "Update the traffic fine details below."
                  : "Enter the traffic fine details below."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Row 1: Car (Plate Number) & Violation Number (Required) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plate Number *</Label>
                  <Select
                    value={formData.car_id}
                    onValueChange={(value) => setFormData({ ...formData, car_id: value })}
                    disabled={isLoadingDropdowns}
                  >
                    <SelectTrigger className="focus:ring-[#4ba6ea]">
                      <SelectValue placeholder={isLoadingDropdowns ? "Loading cars..." : "Select a car"} />
                    </SelectTrigger>
                    <SelectContent>
                      {cars.map((car) => (
                        <SelectItem key={car.id} value={car.id}>
                          {car.plate_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="violation_number">Violation Number *</Label>
                  <Input
                    id="violation_number"
                    value={formData.violation_number}
                    onChange={(e) => setFormData({ ...formData, violation_number: e.target.value })}
                    placeholder="e.g., TRF-2024-001"
                  />
                </div>
              </div>

              {/* Row 2: Customer & Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer (optional)</Label>
                  <Select
                    value={formData.customer_id}
                    onValueChange={(value) => setFormData({ ...formData, customer_id: value === "_none" ? "" : value })}
                    disabled={isLoadingDropdowns}
                  >
                    <SelectTrigger className="focus:ring-[#4ba6ea]">
                      <SelectValue placeholder={isLoadingDropdowns ? "Loading customers..." : "Select a customer"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">No customer</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {`${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Unknown"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (TRY)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g., 1500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="notification_date">Notification Date</Label>
                  <Input
                    id="notification_date"
                    type="date"
                    value={formData.notification_date}
                    onChange={(e) => setFormData({ ...formData, notification_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="violation_date">Violation Date</Label>
                  <Input
                    id="violation_date"
                    type="date"
                    value={formData.violation_date}
                    onChange={(e) => setFormData({ ...formData, violation_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="violation_time">Violation Time</Label>
                  <Input
                    id="violation_time"
                    type="time"
                    value={formData.violation_time}
                    onChange={(e) => setFormData({ ...formData, violation_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="article">Article</Label>
                  <Input
                    id="article"
                    value={formData.article}
                    onChange={(e) => setFormData({ ...formData, article: e.target.value })}
                    placeholder="e.g., KTK 51/2-a"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Istanbul, Fatih, Vatan Caddesi"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional details about the violation..."
                  rows={3}
                />
              </div>

              {/* File Uploads - enabled only after plate & violation are filled */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fine Image (optional)</Label>
                  <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                    canUploadFiles 
                      ? "hover:border-[#4ba6ea] hover:bg-[#4ba6ea]/5" 
                      : "bg-gray-50 cursor-not-allowed"
                  }`}>
                    <input
                      type="file"
                      id="fine_image"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setFineImageFile(e.target.files?.[0] || null)}
                      disabled={!canUploadFiles}
                    />
                    <label
                      htmlFor="fine_image"
                      className={`flex flex-col items-center gap-2 ${canUploadFiles ? "cursor-pointer" : "cursor-not-allowed"}`}
                    >
                      <ImageIcon className={`h-8 w-8 ${canUploadFiles ? "text-gray-400" : "text-gray-300"}`} />
                      <span className={`text-sm ${canUploadFiles ? "text-gray-500" : "text-gray-400"}`}>
                        {fineImageFile 
                          ? fineImageFile.name 
                          : canUploadFiles 
                            ? "Click to upload image" 
                            : "Select car & violation first"}
                      </span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fine PDF (optional)</Label>
                  <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                    canUploadFiles 
                      ? "hover:border-[#4ba6ea] hover:bg-[#4ba6ea]/5" 
                      : "bg-gray-50 cursor-not-allowed"
                  }`}>
                    <input
                      type="file"
                      id="fine_pdf"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => setFinePdfFile(e.target.files?.[0] || null)}
                      disabled={!canUploadFiles}
                    />
                    <label
                      htmlFor="fine_pdf"
                      className={`flex flex-col items-center gap-2 ${canUploadFiles ? "cursor-pointer" : "cursor-not-allowed"}`}
                    >
                      <FileText className={`h-8 w-8 ${canUploadFiles ? "text-gray-400" : "text-gray-300"}`} />
                      <span className={`text-sm ${canUploadFiles ? "text-gray-500" : "text-gray-400"}`}>
                        {finePdfFile 
                          ? finePdfFile.name 
                          : canUploadFiles 
                            ? "Click to upload PDF" 
                            : "Select car & violation first"}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving || isUploading} 
                className="bg-[#4ba6ea] hover:bg-[#3a8fd4]"
              >
                {isUploading ? "Uploading..." : isSaving ? "Saving..." : editingFine ? "Update" : "Add Fine"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Paid</DialogTitle>
              <DialogDescription>
                Upload the payment receipt to mark this fine as paid.
              </DialogDescription>
            </DialogHeader>
            {fineToMarkPaid && (
              <div className="space-y-4 py-4">
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Plate Number:</span> {fineToMarkPaid.plate_number}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Violation #:</span> {fineToMarkPaid.violation_number}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Amount:</span> {formatCurrency(fineToMarkPaid.amount)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Payment Receipt (PDF) *</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      type="file"
                      id="payment_receipt"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => setPaymentReceiptFile(e.target.files?.[0] || null)}
                    />
                    <label
                      htmlFor="payment_receipt"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="h-10 w-10 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        {paymentReceiptFile ? paymentReceiptFile.name : "Click to upload payment receipt"}
                      </span>
                      <span className="text-xs text-gray-400">PDF files only</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleMarkAsPaid}
                disabled={isProcessingPayment || !paymentReceiptFile}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isProcessingPayment ? "Processing..." : "Confirm Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Traffic Fine</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this traffic fine? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
