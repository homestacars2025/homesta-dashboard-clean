"use client"

import { useState, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { Plus, Pencil, Trash2 } from "lucide-react"
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
  total_cars: number | null
}

const defaultForm = {
  name: "",
  brand: "",
  customBrand: "",
  model: "",
  customModel: "",
  transmission: "",
  fuel: "",
  seats: "",
  luggage: "",
  category: "",
  daily_km: "",
  monthly_km: "",
  deposit: "",
  min_age: "",
}

const TRANSMISSIONS = ["Automatic", "Manual"]
const FUELS = ["Petrol", "Diesel", "Hybrid", "Electric", "Other"]
const BRANDS = ["Hyundai", "Fiat", "Renault", "Dacia", "Chery", "Volkswagen", "Other"]
const CATEGORIES = ["Economy", "Middle", "Luxury", "SUV", "Van", "Electric"]

const MODELS_BY_BRAND: Record<string, string[]> = {
  Fiat: ["Egea", "Other"],
  Renault: ["Clio", "Taliant", "Megane", "Other"],
  Hyundai: ["Accent", "i20", "Other"],
  Chery: ["Tiggo 7 Pro Max", "Other"],
  Volkswagen: ["Passat", "Polo", "Golf", "Other"],
  Dacia: ["Duster", "Sandero", "Other"],
}

export default function ModelGroupsPage() {
  const { toast } = useToast()
  const [groups, setGroups] = useState<ModelGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState(defaultForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false)

  // Auto-generate name from brand + model
  const getAutoName = (brand: string, customBrand: string, model: string, customModel: string) => {
    const brandVal = brand === "Other" ? customBrand : brand
    const modelVal = model === "Other" ? customModel : model
    if (brandVal && modelVal) return `${brandVal} ${modelVal}`
    if (brandVal) return brandVal
    return ""
  }

  // Compress and resize image
  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = document.createElement("img")
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!
      
      img.onload = () => {
        let width = img.width
        let height = img.height
        const maxWidth = 1200
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        
        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.75)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setImageFile(null)
      setImagePreview(null)
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const loadGroups = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("model_group")
      .select("*")
      .order("name")

    if (error) {
      toast({ title: "Error", description: "Failed to load model groups.", variant: "destructive" })
    } else {
      setGroups(data || [])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const handleOpenForm = (group?: ModelGroup) => {
    if (group) {
      setEditingId(group.id)
      const isCustomBrand = group.brand && !BRANDS.includes(group.brand)
      const brandModels = MODELS_BY_BRAND[group.brand] || []
      const isCustomModel = group.model && !brandModels.includes(group.model)
      setFormData({
        name: group.name || "",
        brand: isCustomBrand ? "Other" : (group.brand || ""),
        customBrand: isCustomBrand ? group.brand : "",
        model: isCustomModel ? "Other" : (group.model || ""),
        customModel: isCustomModel ? group.model : "",
        transmission: group.transmission || "",
        fuel: group.fuel || "",
        seats: group.seats?.toString() || "",
        luggage: group.luggage?.toString() || "",
        category: group.category || "",
        daily_km: group.daily_km?.toString() || "",
        monthly_km: group.monthly_km?.toString() || "",
        deposit: group.deposit?.toString() || "",
        min_age: group.min_age?.toString() || "",
      })
    } else {
      setEditingId(null)
      setFormData(defaultForm)
    }
    setImageFile(null)
    setImagePreview(null)
    setNameManuallyEdited(false)
    setIsFormOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const supabase = getSupabaseBrowserClient()
      let imageUrl: string | null = null

      if (imageFile) {
        const compressed = await compressImage(imageFile)
        const filename = formData.name.trim().toLowerCase().replace(/\s+/g, "-") + ".jpg"
        const path = `model-groups/${filename}`
        const { error: uploadError } = await supabase.storage.from("model-group").upload(path, compressed, { upsert: true })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from("model-group").getPublicUrl(path)
        imageUrl = urlData.publicUrl
      }

      const brandValue = formData.brand === "Other" ? formData.customBrand.trim() : formData.brand
      const modelValue = formData.model === "Other" ? formData.customModel.trim() : formData.model.trim()

      const payload = {
        name: formData.name.trim(),
        brand: brandValue || null,
        model: modelValue || null,
        transmission: formData.transmission || null,
        fuel: formData.fuel || null,
        seats: formData.seats ? parseInt(formData.seats) : null,
        luggage: formData.luggage ? parseInt(formData.luggage) : null,
        category: formData.category || null,
        daily_km: formData.daily_km ? parseInt(formData.daily_km) : null,
        monthly_km: formData.monthly_km ? parseInt(formData.monthly_km) : null,
        deposit: formData.deposit ? parseInt(formData.deposit) : null,
        min_age: formData.min_age ? parseInt(formData.min_age) : null,
        ...(imageUrl && { image_url: imageUrl }),
      }

      if (editingId) {
        const { error } = await supabase.from("model_group").update(payload).eq("id", editingId)
        if (error) throw error
        toast({ title: "Success", description: "Model group updated." })
      } else {
        const { error } = await supabase.from("model_group").insert(payload)
        if (error) throw error
        toast({ title: "Success", description: "Model group created." })
      }

      setIsFormOpen(false)
      loadGroups()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this model group?")) return
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("model_group").delete().eq("id", id)
    if (error) {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" })
    } else {
      toast({ title: "Deleted", description: "Model group removed." })
      loadGroups()
    }
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Model Groups</h1>
            <Button 
              onClick={() => handleOpenForm()} 
              className="bg-[#4ba6ea] hover:bg-[#3a95d9] text-white shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Model Group
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4ba6ea]" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No model groups found.</div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Image</TableHead>
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Brand</TableHead>
                    <TableHead className="font-semibold">Model</TableHead>
                    <TableHead className="font-semibold">Trans.</TableHead>
                    <TableHead className="font-semibold">Fuel</TableHead>
                    <TableHead className="font-semibold text-center">Seats</TableHead>
                    <TableHead className="font-semibold text-center">Luggage</TableHead>
                    <TableHead className="font-semibold">Category</TableHead>
                    <TableHead className="font-semibold text-right">Daily KM</TableHead>
                    <TableHead className="font-semibold text-right">Monthly KM</TableHead>
                    <TableHead className="font-semibold text-right">Deposit</TableHead>
                    <TableHead className="font-semibold text-center">Min Age</TableHead>
                    <TableHead className="font-semibold text-center">Total Cars</TableHead>
                    <TableHead className="font-semibold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((g) => (
                    <TableRow key={g.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell>
                        {g.image_url ? (
                          <Image 
                            src={g.image_url} 
                            alt={g.name} 
                            width={64} 
                            height={44} 
                            className="rounded-lg object-cover shadow-sm" 
                          />
                        ) : (
                          <div className="w-16 h-11 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                            No img
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">{g.name}</TableCell>
                      <TableCell className="text-gray-600">{g.brand || "-"}</TableCell>
                      <TableCell className="text-gray-600">{g.model || "-"}</TableCell>
                      <TableCell className="text-gray-600">{g.transmission || "-"}</TableCell>
                      <TableCell className="text-gray-600">{g.fuel || "-"}</TableCell>
                      <TableCell className="text-center text-gray-600">{g.seats ?? "-"}</TableCell>
                      <TableCell className="text-center text-gray-600">{g.luggage ?? "-"}</TableCell>
                      <TableCell className="text-gray-600">{g.category || "-"}</TableCell>
                      <TableCell className="text-right text-gray-600">{g.daily_km ?? "-"}</TableCell>
                      <TableCell className="text-right text-gray-600">{g.monthly_km ?? "-"}</TableCell>
                      <TableCell className="text-right text-gray-600">{g.deposit ?? "-"}</TableCell>
                      <TableCell className="text-center text-gray-600">{g.min_age ?? "-"}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          (g.total_cars ?? 0) === 0 
                            ? "bg-gray-100 text-gray-500" 
                            : "bg-[#4ba6ea]/10 text-[#4ba6ea]"
                        }`}>
                          {g.total_cars ?? 0} cars
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleOpenForm(g)}
                            className="h-8 w-8 hover:bg-[#4ba6ea]/10 hover:text-[#4ba6ea]"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(g.id)}
                            className="h-8 w-8 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">
                  {editingId ? "Edit Model Group" : "Add Model Group"}
                </DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Brand</Label>
                  <Select value={formData.brand} onValueChange={(v) => {
                    const newData = { ...formData, brand: v, customBrand: "", model: "", customModel: "" }
                    if (!nameManuallyEdited) {
                      newData.name = getAutoName(v, "", "", "")
                    }
                    setFormData(newData)
                  }}>
                    <SelectTrigger className="focus:ring-[#4ba6ea]">
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANDS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.brand === "Other" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Custom Brand</Label>
                    <Input 
                      value={formData.customBrand} 
                      onChange={(e) => {
                        const newData = { ...formData, customBrand: e.target.value }
                        if (!nameManuallyEdited) {
                          newData.name = getAutoName("Other", e.target.value, formData.model, formData.customModel)
                        }
                        setFormData(newData)
                      }}
                      placeholder="Enter brand name"
                      className="focus-visible:ring-[#4ba6ea]"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Model</Label>
                  {formData.brand && formData.brand !== "Other" && MODELS_BY_BRAND[formData.brand] ? (
                    formData.model === "Other" ? (
                      <Input 
                        value={formData.customModel} 
                        onChange={(e) => {
                          const newData = { ...formData, customModel: e.target.value }
                          if (!nameManuallyEdited) {
                            newData.name = getAutoName(formData.brand, formData.customBrand, "Other", e.target.value)
                          }
                          setFormData(newData)
                        }}
                        placeholder="Enter model name"
                        className="focus-visible:ring-[#4ba6ea]"
                      />
                    ) : (
                      <Select value={formData.model} onValueChange={(v) => {
                        const newData = { ...formData, model: v, customModel: "" }
                        if (!nameManuallyEdited) {
                          newData.name = getAutoName(formData.brand, formData.customBrand, v, "")
                        }
                        setFormData(newData)
                      }}>
                        <SelectTrigger className="focus:ring-[#4ba6ea]">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {MODELS_BY_BRAND[formData.brand].map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )
                  ) : (
                    <Input 
                      value={formData.model} 
                      onChange={(e) => {
                        const newData = { ...formData, model: e.target.value }
                        if (!nameManuallyEdited) {
                          newData.name = getAutoName(formData.brand, formData.customBrand, e.target.value, "")
                        }
                        setFormData(newData)
                      }}
                      placeholder="Enter model name"
                      className="focus-visible:ring-[#4ba6ea]"
                    />
                  )}
                </div>

                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">Name *</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value })
                      setNameManuallyEdited(true)
                    }}
                    placeholder="Auto generated (you can edit)"
                    className="focus-visible:ring-[#4ba6ea] bg-[#4ba6ea]/5 border-[#4ba6ea]/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Transmission</Label>
                  <Select value={formData.transmission} onValueChange={(v) => setFormData({ ...formData, transmission: v })}>
                    <SelectTrigger className="focus:ring-[#4ba6ea]">
                      <SelectValue placeholder="Select transmission" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSMISSIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Fuel</Label>
                  <Select value={formData.fuel} onValueChange={(v) => setFormData({ ...formData, fuel: v })}>
                    <SelectTrigger className="focus:ring-[#4ba6ea]">
                      <SelectValue placeholder="Select fuel type" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUELS.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="focus:ring-[#4ba6ea]">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Seats</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.seats} 
                    onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                    className="focus-visible:ring-[#4ba6ea]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Luggage</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.luggage} 
                    onChange={(e) => setFormData({ ...formData, luggage: e.target.value })}
                    className="focus-visible:ring-[#4ba6ea]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Daily KM</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.daily_km} 
                    onChange={(e) => setFormData({ ...formData, daily_km: e.target.value })}
                    className="focus-visible:ring-[#4ba6ea]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Monthly KM</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.monthly_km} 
                    onChange={(e) => setFormData({ ...formData, monthly_km: e.target.value })}
                    className="focus-visible:ring-[#4ba6ea]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Deposit</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.deposit} 
                    onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
                    className="focus-visible:ring-[#4ba6ea]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Age</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.min_age} 
                    onChange={(e) => setFormData({ ...formData, min_age: e.target.value })}
                    className="focus-visible:ring-[#4ba6ea]"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">Image</Label>
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange}
                    className="focus-visible:ring-[#4ba6ea]"
                  />
                  {imagePreview && (
                    <div className="mt-2">
                      <Image 
                        src={imagePreview} 
                        alt="Preview" 
                        width={200} 
                        height={140} 
                        className="rounded-lg object-cover border"
                      />
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="bg-[#4ba6ea] hover:bg-[#3a95d9] text-white"
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
