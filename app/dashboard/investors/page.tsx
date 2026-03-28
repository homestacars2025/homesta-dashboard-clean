"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { withTimeout } from "@/lib/utils"
import { useVisibilityRefresh } from "@/hooks/use-visibility-refresh"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { PhoneInput } from "@/components/ui/phone-input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Search, Plus, MoreHorizontal, Pencil, Trash2, Phone, MessageCircle, Mail, Briefcase, Shield } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type Investor = {
  id: number
  company_name: string
  investor_name: string | null
  is_active: boolean
  phone: string | null
  whatsapp: string | null
  email: string | null
  commission_rate: number | null
  created_at: string
}

type InvestorFormData = {
  company_name: string
  investor_name: string
  is_active: boolean
  phone: string
  whatsapp: string
  email: string
  commission_rate: string
}

const defaultFormData: InvestorFormData = {
  company_name: "",
  investor_name: "",
  is_active: true,
  phone: "",
  whatsapp: "",
  email: "",
  commission_rate: "",
}

// Format phone number for display with proper spacing
const formatPhoneDisplay = (phone: string): string => {
  if (!phone) return ""
  const clean = phone.replace(/\D/g, "")
  // Try to format with country code
  if (clean.startsWith("90") && clean.length >= 10) {
    return `+90 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 12)}`
  }
  if (clean.startsWith("218") && clean.length >= 10) {
    return `+218 ${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`
  }
  // Default formatting
  if (phone.startsWith("+")) return phone
  return `+${clean}`
}

export default function InvestorsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [investors, setInvestors] = useState<Investor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null)
  const [formData, setFormData] = useState<InvestorFormData>(defaultFormData)
  const [isSaving, setIsSaving] = useState(false)

  // Delete confirmation
  const [deleteInvestor, setDeleteInvestor] = useState<Investor | null>(null)
  const isFetchingRef = useRef(false)
  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    if (!user) {
      setIsLoading(false)
      return
    }
    if (user.role !== "admin") {
      setIsLoading(false)
      return
    }
    loadInvestors()
  }, [user])

  // Refresh data when tab becomes visible - pass isFetchingRef to skip if fetch in progress
  useVisibilityRefresh(() => {
    if (!user) return
    loadInvestors()
  }, isFetchingRef)

  const loadInvestors = async () => {
    try {
      isFetchingRef.current = true
      if (!hasLoadedOnceRef.current) setIsLoading(true)
      const supabase = getSupabaseBrowserClient()

      const { data, error } = await withTimeout(
        supabase
          .from("investors")
          .select("*")
          .order("company_name", { ascending: true })
      )

      if (error) throw error
      setInvestors(data || [])
      hasLoadedOnceRef.current = true
    } catch (error) {
      console.error("Error loading investors:", error)
      if (!hasLoadedOnceRef.current) {
        toast({
          title: "Error",
          description: "Failed to load investors. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }

  const filteredInvestors = investors.filter((inv) => {
    const matchesSearch =
      inv.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.investor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.email?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && inv.is_active === true) ||
      (statusFilter === "inactive" && inv.is_active === false)

    return matchesSearch && matchesStatus
  })

  const handleOpenForm = (investor?: Investor) => {
    if (investor) {
      setEditingInvestor(investor)
      setFormData({
        company_name: investor.company_name || "",
        investor_name: investor.investor_name || "",
        is_active: investor.is_active ?? true,
        phone: investor.phone || "",
        whatsapp: investor.whatsapp || "",
        email: investor.email || "",
        commission_rate: investor.commission_rate?.toString() || "",
      })
    } else {
      setEditingInvestor(null)
      setFormData(defaultFormData)
    }
    setIsFormOpen(true)
  }

  const handleSave = async () => {
    if (!formData.company_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Company name is required.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const supabase = getSupabaseBrowserClient()

      const investorData = {
        company_name: formData.company_name.trim(),
        investor_name: formData.investor_name.trim() || null,
        is_active: formData.is_active,
        phone: formData.phone.trim() || null,
        whatsapp: formData.whatsapp.trim() || null,
        email: formData.email.trim() || null,
        commission_rate: formData.commission_rate ? parseFloat(formData.commission_rate) : null,
      }

      if (editingInvestor) {
        const { error } = await supabase
          .from("investors")
          .update(investorData)
          .eq("id", editingInvestor.id)

        if (error) throw error

        toast({
          title: "Success",
          description: "Investor updated successfully.",
        })
      } else {
        const { error } = await supabase
          .from("investors")
          .insert([investorData])

        if (error) throw error

        toast({
          title: "Success",
          description: "Investor added successfully.",
        })
      }

      setIsFormOpen(false)
      setFormData(defaultFormData)
      setEditingInvestor(null)
      await loadInvestors()
    } catch (error) {
      console.error("Error saving investor:", error)
      toast({
        title: "Error",
        description: "Failed to save investor. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (investor: Investor, newValue: boolean) => {
    try {
      const supabase = getSupabaseBrowserClient()

      const { error } = await supabase
        .from("investors")
        .update({ is_active: newValue })
        .eq("id", investor.id)

      if (error) throw error

      // Update local state immediately
      setInvestors((prev) =>
        prev.map((inv) =>
          inv.id === investor.id ? { ...inv, is_active: newValue } : inv
        )
      )

      toast({
        title: "Status Updated",
        description: `${investor.company_name} is now ${newValue ? "active" : "inactive"}.`,
      })
    } catch (error) {
      console.error("Error updating investor status:", error)
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteInvestor) return

    try {
      const supabase = getSupabaseBrowserClient()

      const { error } = await supabase
        .from("investors")
        .delete()
        .eq("id", deleteInvestor.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Investor deleted successfully.",
      })

      setDeleteInvestor(null)
      await loadInvestors()
    } catch (error) {
      console.error("Error deleting investor:", error)
      toast({
        title: "Error",
        description: "Failed to delete investor. This investor may have linked cars or transactions.",
        variant: "destructive",
      })
    }
  }

  if (user?.role !== "admin") {
    return (
 <ProtectedRoute allowedRoles={["admin"]}>
  <DashboardLayout>
          <div className="flex items-center justify-center h-96">
            <Alert className="max-w-md">
              <Shield className="h-4 w-4" />
              <AlertDescription>Access denied. Only administrators can access this page.</AlertDescription>
            </Alert>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Investors</h1>
              <p className="text-muted-foreground mt-2">Manage investor accounts and commission rates</p>
            </div>
            <Button onClick={() => handleOpenForm()} className="gap-2 bg-[#4ba6ea] hover:bg-[#3a8fd4]">
              <Plus className="h-4 w-4" />
              Add Investor
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, company or email..."
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
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investor Name</TableHead>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Commission Rate</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Loading investors...
                      </TableCell>
                    </TableRow>
                  ) : filteredInvestors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-semibold mb-1">No investors found</p>
                        <p className="text-sm text-muted-foreground">
                          {searchQuery || statusFilter !== "all"
                            ? "Try adjusting your search or filter criteria."
                            : "Get started by adding your first investor."}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvestors.map((investor) => (
                      <TableRow key={investor.id} className="hover:bg-[#4ba6ea]/10 transition-colors">
                        <TableCell className="font-medium">
                          {investor.investor_name || "—"}
                        </TableCell>
                        <TableCell>{investor.company_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={investor.is_active}
                              onCheckedChange={(checked) => handleToggleActive(investor, checked)}
                              className={investor.is_active 
                                ? "data-[state=checked]:bg-emerald-500" 
                                : "data-[state=unchecked]:bg-rose-400"
                              }
                            />
                            <span className={`text-xs font-medium ${investor.is_active ? "text-emerald-600" : "text-rose-500"}`}>
                              {investor.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {investor.phone ? (
                            <a
                              href={`tel:${investor.phone}`}
                              className="flex items-center gap-1.5 text-[#4ba6ea] hover:text-[#3a8fd4] hover:underline font-medium"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {formatPhoneDisplay(investor.phone)}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {investor.whatsapp ? (
                            <a
                              href={`https://wa.me/${investor.whatsapp.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 hover:underline font-medium"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              {formatPhoneDisplay(investor.whatsapp)}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {investor.email ? (
                            <a
                              href={`mailto:${investor.email}`}
                              className="flex items-center gap-1.5 text-[#4ba6ea] hover:text-[#3a8fd4] hover:underline font-medium"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              {investor.email}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {investor.commission_rate != null ? (
                            <span className="font-medium">{investor.commission_rate}%</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenForm(investor)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteInvestor(investor)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Add/Edit Dialog */}
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingInvestor ? "Edit Investor" : "Add Investor"}</DialogTitle>
                <DialogDescription>
                  {editingInvestor
                    ? "Update the investor information below."
                    : "Enter the details for the new investor."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Enter company name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="investor_name">Investor Name</Label>
                    <Input
                      id="investor_name"
                      value={formData.investor_name}
                      onChange={(e) => setFormData({ ...formData, investor_name: e.target.value })}
                      placeholder="Enter investor name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="is_active">Status</Label>
                    <div className="flex items-center gap-3 h-10">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        className={formData.is_active 
                          ? "data-[state=checked]:bg-emerald-500" 
                          : "data-[state=unchecked]:bg-rose-400"
                        }
                      />
                      <span className={`text-sm font-medium ${formData.is_active ? "text-emerald-600" : "text-rose-500"}`}>
                        {formData.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commission_rate">Commission Rate (%)</Label>
                    <Input
                      id="commission_rate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.commission_rate}
                      onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                      placeholder="e.g., 15"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <PhoneInput
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    placeholder="Enter phone number"
                    defaultCountry="TR"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp Number</Label>
                  <PhoneInput
                    value={formData.whatsapp}
                    onChange={(value) => setFormData({ ...formData, whatsapp: value })}
                    placeholder="Enter WhatsApp number"
                    defaultCountry="TR"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="investor@example.com"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-[#4ba6ea] hover:bg-[#3a8fd4]">
                  {isSaving ? "Saving..." : editingInvestor ? "Update" : "Add Investor"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!deleteInvestor} onOpenChange={() => setDeleteInvestor(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Investor</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{deleteInvestor?.company_name}"? This action cannot be undone.
                  If this investor has linked cars or transactions, the deletion will fail.
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
