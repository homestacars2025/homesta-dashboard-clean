"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save, Car, FileText, Upload, Eye, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import Link from "next/link"
import Image from "next/image"

type ModelGroup = {
  id: number
  name: string
  brand: string
  model: string
  transmission: string
  fuel: string
  seats: number
  luggage: number
  category: string
  daily_km: number
  monthly_km: number
  deposit: number
  min_age: number
  image_url: string | null
}

type CarRegistration = {
  id: number
  car_id: number
  manufacture_year: number | null
  car_package: string | null
  insurance_expiry: string | null
  inspection_expiry: string | null
  purchase_contract_url: string | null
  purchase_invoice_url: string | null
  insurance_file_url: string | null
  ruhsat_url: string | null
  purchase_date: string | null
}

export default function EditCarPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const carId = params.carId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([])
  const [investors, setInvestors] = useState<{ id: number; company_name: string }[]>([])
  const [selectedModelGroupId, setSelectedModelGroupId] = useState<string>("")
  const [selectedModelGroup, setSelectedModelGroup] = useState<ModelGroup | null>(null)
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>("")
  const [registration, setRegistration] = useState<CarRegistration>({
    id: 0,
    car_id: parseInt(carId),
    manufacture_year: null,
    car_package: null,
    insurance_expiry: null,
    inspection_expiry: null,
    purchase_contract_url: null,
    purchase_invoice_url: null,
    insurance_file_url: null,
    ruhsat_url: null,
    purchase_date: null,
  })
  const [hasRegistration, setHasRegistration] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [carPlateNumber, setCarPlateNumber] = useState<string>("")

  // Document upload config
  const docConfig = {
    purchase_contract_url: { folder: "contracts", prefix: "SS" },
    purchase_invoice_url: { folder: "invoices", prefix: "F" },
    insurance_file_url: { folder: "insurance", prefix: "S" },
    ruhsat_url: { folder: "registrations", prefix: "R" },
  }

  // Handle PDF upload
  const handleFileUpload = async (field: keyof typeof docConfig, file: File) => {
    if (!file.type.includes("pdf")) {
      toast({ title: "Error", description: "Only PDF files are allowed", variant: "destructive" })
      return
    }

    const plateNumber = carPlateNumber?.replace(/\s+/g, "") || "UNKNOWN"
    const { folder, prefix } = docConfig[field]
    const fileName = `${prefix}-${plateNumber}.pdf`
    const filePath = `${folder}/${fileName}`

    setUploading(field)
    const supabase = getSupabaseBrowserClient()

    try {
      const { error: uploadError } = await supabase.storage
        .from("doc")
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from("doc").getPublicUrl(filePath)
      setRegistration(prev => ({ ...prev, [field]: urlData.publicUrl }))
      toast({ title: "Success", description: "File uploaded successfully" })
    } catch (error: any) {
      toast({ title: "Upload Error", description: error.message, variant: "destructive" })
    } finally {
      setUploading(null)
    }
  }

  // Load model groups and investors
  const loadModelGroups = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const [{ data: groups }, { data: invs }] = await Promise.all([
      supabase.from("model_group").select("*").order("name", { ascending: true }),
      supabase.from("investors").select("id, company_name").order("company_name", { ascending: true })
    ])
    setModelGroups(groups || [])
    setInvestors(invs || [])
    return groups || []
  }, [])

  // Load car and registration data
  const loadCarData = useCallback(async (modelGroupsList: ModelGroup[]) => {
    const supabase = getSupabaseBrowserClient()

    // Load car
    const { data: carData, error: carError } = await (supabase
      .from("cars")
      .select("id, model_group_id, plate_number, investor_id")
      .eq("id", parseInt(carId))
      .single() as unknown as Promise<{ data: any; error: any }>)

    if (carError || !carData) {
      toast({ title: "Error", description: "Car not found", variant: "destructive" })
      router.push("/dashboard/cars")
      return
    }

    // Set model group
    if (carData.model_group_id) {
      setSelectedModelGroupId(String(carData.model_group_id))
      const mg = modelGroupsList.find(g => g.id === carData.model_group_id)
      if (mg) setSelectedModelGroup(mg)
    }

    // Set investor
    if (carData.investor_id) {
      setSelectedInvestorId(String(carData.investor_id))
    }

    // Store plate number from car (for file naming)
    if (carData.plate_number) {
      setCarPlateNumber(carData.plate_number)
    }

    // Load registration
    const { data: regData } = await supabase
      .from("cars_registration")
      .select("*")
      .eq("car_id", parseInt(carId))
      .single()

    if (regData) {
      setRegistration(regData)
      setHasRegistration(true)
    }

    setLoading(false)
  }, [carId, router, toast])

  useEffect(() => {
    const init = async () => {
      const groups = await loadModelGroups()
      await loadCarData(groups)
    }
    init()
  }, [loadModelGroups, loadCarData])

  // Handle model group change
  const handleModelGroupChange = (value: string) => {
    setSelectedModelGroupId(value)
    const mg = modelGroups.find(g => g.id === parseInt(value))
    setSelectedModelGroup(mg || null)
  }

  // Handle save
  const handleSave = async () => {
    setSaving(true)
    const supabase = getSupabaseBrowserClient()

    try {
      // Update car model_group_id and investor_id
      const { error: carError } = await (supabase as any)
        .from("cars")
        .update({
          model_group_id: selectedModelGroupId ? parseInt(selectedModelGroupId) : null,
          investor_id: selectedInvestorId && selectedInvestorId !== "none" ? selectedInvestorId : null
        })
        .eq("id", parseInt(carId))

      if (carError) throw carError

      // Update or insert registration - only columns that exist in cars_registration table
      const regPayload = {
        car_id: parseInt(carId),
        manufacture_year: registration.manufacture_year,
        car_package: registration.car_package,
        insurance_expiry: registration.insurance_expiry || null,
        inspection_expiry: registration.inspection_expiry || null,
        purchase_contract_url: registration.purchase_contract_url,
        purchase_invoice_url: registration.purchase_invoice_url,
        insurance_file_url: registration.insurance_file_url,
        ruhsat_url: registration.ruhsat_url,
        purchase_date: registration.purchase_date || null,
      }

      if (hasRegistration) {
        const { error: regError } = await (supabase as any)
          .from("cars_registration")
          .update(regPayload)
          .eq("car_id", parseInt(carId))
        if (regError) throw regError
      } else {
        const { error: regError } = await ((supabase as any)
          .from("cars_registration")
          .insert(regPayload))
        if (regError) throw regError
      }

      toast({ title: "Success", description: "Car updated successfully" })
      router.push("/dashboard/cars")
    } catch (error: any) {
      console.error("Save error:", error)
      toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4ba6ea]" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/cars">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Edit Car</h1>
              <p className="text-slate-500">Update car specifications and registration</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-[#4ba6ea] hover:bg-[#3a95d9]">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Section 1: Car Specifications */}
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-[#4ba6ea]/10 to-transparent border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Car className="w-5 h-5 text-[#4ba6ea]" />
              Car Specifications
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Model Group Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Model Group</Label>
              <Select value={selectedModelGroupId} onValueChange={handleModelGroupChange}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-[#4ba6ea]">
                  <SelectValue placeholder="Select model group" />
                </SelectTrigger>
                <SelectContent>
                  {modelGroups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Group Details */}
            {selectedModelGroup && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                {selectedModelGroup.image_url && (
                  <div className="col-span-2 lg:col-span-4 flex justify-center mb-4">
                    <Image
                      src={selectedModelGroup.image_url}
                      alt={selectedModelGroup.name}
                      width={300}
                      height={180}
                      className="rounded-xl object-cover shadow-sm"
                    />
                  </div>
                )}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Brand</p>
                  <p className="font-semibold text-slate-900">{selectedModelGroup.brand || "-"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Model</p>
                  <p className="font-semibold text-slate-900">{selectedModelGroup.model || "-"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Transmission</p>
                  <p className="font-semibold text-slate-900">{selectedModelGroup.transmission || "-"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Fuel</p>
                  <p className="font-semibold text-slate-900">{selectedModelGroup.fuel || "-"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Seats</p>
                  <p className="font-semibold text-slate-900">{selectedModelGroup.seats || "-"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Luggage</p>
                  <p className="font-semibold text-slate-900">{selectedModelGroup.luggage || "-"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Category</p>
                  <p className="font-semibold text-slate-900">{selectedModelGroup.category || "-"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Min Age</p>
                  <p className="font-semibold text-slate-900">{selectedModelGroup.min_age || "-"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Daily KM</p>
                  <p className="font-semibold text-slate-900">{selectedModelGroup.daily_km || "-"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Monthly KM</p>
                  <p className="font-semibold text-slate-900">{selectedModelGroup.monthly_km || "-"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Deposit</p>
                  <p className="font-semibold text-slate-900">{selectedModelGroup.deposit ? `$${selectedModelGroup.deposit}` : "-"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Car Registration Information */}
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-[#4ba6ea]/10 to-transparent border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-[#4ba6ea]" />
              Car Registration Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Investor - Full width at top */}
              <div className="md:col-span-2 space-y-2">
                <Label className="text-sm font-semibold">Investor</Label>
                <Select value={selectedInvestorId || "none"} onValueChange={(v) => setSelectedInvestorId(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-[#4ba6ea]">
                    <SelectValue placeholder="Select investor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {investors.map((inv) => (
                      <SelectItem key={inv.id} value={String(inv.id)}>{inv.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Manufacture Year</Label>
                <Input
                  type="number"
                  value={registration.manufacture_year || ""}
                  onChange={(e) => setRegistration({ ...registration, manufacture_year: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="2023"
                  className="h-11 rounded-xl border-slate-200 focus-visible:ring-[#4ba6ea]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Car Package</Label>
                <Input
                  value={registration.car_package || ""}
                  onChange={(e) => setRegistration({ ...registration, car_package: e.target.value })}
                  placeholder="e.g., Sport, Premium"
                  className="h-11 rounded-xl border-slate-200 focus-visible:ring-[#4ba6ea]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Purchase Date</Label>
                <Input
                  type="date"
                  value={registration.purchase_date || ""}
                  onChange={(e) => setRegistration({ ...registration, purchase_date: e.target.value })}
                  className="h-11 rounded-xl border-slate-200 focus-visible:ring-[#4ba6ea]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Insurance Expiry</Label>
                <Input
                  type="date"
                  value={registration.insurance_expiry || ""}
                  onChange={(e) => setRegistration({ ...registration, insurance_expiry: e.target.value })}
                  className="h-11 rounded-xl border-slate-200 focus-visible:ring-[#4ba6ea]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Inspection Expiry</Label>
                <Input
                  type="date"
                  value={registration.inspection_expiry || ""}
                  onChange={(e) => setRegistration({ ...registration, inspection_expiry: e.target.value })}
                  className="h-11 rounded-xl border-slate-200 focus-visible:ring-[#4ba6ea]"
                />
              </div>
              {/* Document Uploads Section */}
              <div className="md:col-span-2 pt-4 border-t">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Documents (PDF only)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Purchase Contract */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Purchase Contract</Label>
                    <div className="flex items-center gap-2">
                      {registration.purchase_contract_url ? (
                        <>
                          <a href={registration.purchase_contract_url} target="_blank" rel="noopener noreferrer">
                            <Button type="button" variant="outline" size="sm" className="rounded-lg">
                              <Eye className="w-4 h-4 mr-1" /> View PDF
                            </Button>
                          </a>
                          <label className="cursor-pointer">
                            <Button type="button" variant="outline" size="sm" className="rounded-lg pointer-events-none">
                              {uploading === "purchase_contract_url" ? "Uploading..." : "Replace"}
                            </Button>
                            <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("purchase_contract_url", e.target.files[0])} />
                          </label>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRegistration(prev => ({ ...prev, purchase_contract_url: null }))}>
                            <X className="w-4 h-4 text-slate-400" />
                          </Button>
                        </>
                      ) : (
                        <label className="cursor-pointer flex-1">
                          <div className="h-11 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 text-slate-500 hover:border-[#4ba6ea] hover:text-[#4ba6ea] transition-colors">
                            <Upload className="w-4 h-4" />
                            <span className="text-sm">{uploading === "purchase_contract_url" ? "Uploading..." : "Upload PDF"}</span>
                          </div>
                          <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("purchase_contract_url", e.target.files[0])} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Purchase Invoice */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Purchase Invoice</Label>
                    <div className="flex items-center gap-2">
                      {registration.purchase_invoice_url ? (
                        <>
                          <a href={registration.purchase_invoice_url} target="_blank" rel="noopener noreferrer">
                            <Button type="button" variant="outline" size="sm" className="rounded-lg">
                              <Eye className="w-4 h-4 mr-1" /> View PDF
                            </Button>
                          </a>
                          <label className="cursor-pointer">
                            <Button type="button" variant="outline" size="sm" className="rounded-lg pointer-events-none">
                              {uploading === "purchase_invoice_url" ? "Uploading..." : "Replace"}
                            </Button>
                            <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("purchase_invoice_url", e.target.files[0])} />
                          </label>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRegistration(prev => ({ ...prev, purchase_invoice_url: null }))}>
                            <X className="w-4 h-4 text-slate-400" />
                          </Button>
                        </>
                      ) : (
                        <label className="cursor-pointer flex-1">
                          <div className="h-11 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 text-slate-500 hover:border-[#4ba6ea] hover:text-[#4ba6ea] transition-colors">
                            <Upload className="w-4 h-4" />
                            <span className="text-sm">{uploading === "purchase_invoice_url" ? "Uploading..." : "Upload PDF"}</span>
                          </div>
                          <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("purchase_invoice_url", e.target.files[0])} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Insurance File */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Insurance Document</Label>
                    <div className="flex items-center gap-2">
                      {registration.insurance_file_url ? (
                        <>
                          <a href={registration.insurance_file_url} target="_blank" rel="noopener noreferrer">
                            <Button type="button" variant="outline" size="sm" className="rounded-lg">
                              <Eye className="w-4 h-4 mr-1" /> View PDF
                            </Button>
                          </a>
                          <label className="cursor-pointer">
                            <Button type="button" variant="outline" size="sm" className="rounded-lg pointer-events-none">
                              {uploading === "insurance_file_url" ? "Uploading..." : "Replace"}
                            </Button>
                            <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("insurance_file_url", e.target.files[0])} />
                          </label>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRegistration(prev => ({ ...prev, insurance_file_url: null }))}>
                            <X className="w-4 h-4 text-slate-400" />
                          </Button>
                        </>
                      ) : (
                        <label className="cursor-pointer flex-1">
                          <div className="h-11 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 text-slate-500 hover:border-[#4ba6ea] hover:text-[#4ba6ea] transition-colors">
                            <Upload className="w-4 h-4" />
                            <span className="text-sm">{uploading === "insurance_file_url" ? "Uploading..." : "Upload PDF"}</span>
                          </div>
                          <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("insurance_file_url", e.target.files[0])} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Ruhsat */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Ruhsat (Registration)</Label>
                    <div className="flex items-center gap-2">
                      {registration.ruhsat_url ? (
                        <>
                          <a href={registration.ruhsat_url} target="_blank" rel="noopener noreferrer">
                            <Button type="button" variant="outline" size="sm" className="rounded-lg">
                              <Eye className="w-4 h-4 mr-1" /> View PDF
                            </Button>
                          </a>
                          <label className="cursor-pointer">
                            <Button type="button" variant="outline" size="sm" className="rounded-lg pointer-events-none">
                              {uploading === "ruhsat_url" ? "Uploading..." : "Replace"}
                            </Button>
                            <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("ruhsat_url", e.target.files[0])} />
                          </label>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRegistration(prev => ({ ...prev, ruhsat_url: null }))}>
                            <X className="w-4 h-4 text-slate-400" />
                          </Button>
                        </>
                      ) : (
                        <label className="cursor-pointer flex-1">
                          <div className="h-11 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 text-slate-500 hover:border-[#4ba6ea] hover:text-[#4ba6ea] transition-colors">
                            <Upload className="w-4 h-4" />
                            <span className="text-sm">{uploading === "ruhsat_url" ? "Uploading..." : "Upload PDF"}</span>
                          </div>
                          <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload("ruhsat_url", e.target.files[0])} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
