"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Car, CarPricingAvailability, Operation, CarStatus, CarTransmission } from "@/lib/types"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Calendar,
  Gauge,
  Settings,
  Edit,
  Save,
  X,
  ExternalLink,
  Download,
  Trash2,
  Upload,
  Star,
  Plus,
} from "lucide-react"
import Image from "next/image"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { dataService } from "@/lib/data-service"

const statusConfig = {
  ACTIVE: { label: "Working", className: "bg-green-100 text-green-700 border-green-200" },
  PARKING: { label: "Parking", className: "bg-red-100 text-red-700 border-red-200" },
  SERVICE: { label: "Service", className: "bg-gray-100 text-gray-700 border-gray-200" },
  SELLING: { label: "Selling", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  OUT_OF_SERVICE: { label: "Out of Service", className: "bg-gray-100 text-gray-700 border-gray-200" },
}

export default function CarDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const carId = params.carId as string

  const [car, setCar] = useState<Car | null>(null)
  const [pricing, setPricing] = useState<CarPricingAvailability | null>(null)
  const [operations, setOperations] = useState<Operation[]>([])
  const [photos, setPhotos] = useState<{ id: string; image_url: string; is_primary: boolean }[]>([])
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [investorName, setInvestorName] = useState<string>("")

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedCar, setEditedCar] = useState<Partial<Car>>({})

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false)
  const [isUploadingDoc, setIsUploadingDoc] = useState<"insurance" | "ruhsat" | null>(null)
  const [isDeletingDoc, setIsDeletingDoc] = useState<"insurance" | "ruhsat" | null>(null)

  const [modelGroups, setModelGroups] = useState<{ id: number; name: string }[]>([])
  const [investors, setInvestors] = useState<{ id: number; company_name: string }[]>([])
  const [category, setCategory] = useState<string>("Other")

  const CATEGORY_OPTIONS = ["Eco", "Sedan", "Small suv", "Suv", "Vip", "Other"] as const

  useEffect(() => {
    if (isEditing) {
      const loadModelGroups = async () => {
        const supabase = getSupabaseBrowserClient()
        const { data } = await supabase
          .from("model_group")
          .select("id, name")
          .order("name", { ascending: true })
        setModelGroups(data || [])
      }
      const loadInvestors = async () => {
        const supabase = getSupabaseBrowserClient()
        const { data } = await supabase
          .from("investors")
          .select("id, company_name")
          .order("company_name", { ascending: true })
        setInvestors(data || [])
      }
      loadModelGroups()
      loadInvestors()
    }
  }, [isEditing])

  const loadCarDetails = async () => {
    setIsLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()

      const { data: carData, error: carError } = await (supabase
        .from("cars")
        .select("*, model_group:model_group(id, name, brand, model)")
        .eq("id", Number.parseInt(carId))
        .single() as unknown as Promise<{ data: any; error: any }>)

      if (carError) {
        console.error("[v0] Car fetch error:", carError)
        setError("Car not found or has been deleted.")
        setIsLoading(false)
        return
      }

      // Get brand and model from model_group
      const brandName = carData.model_group?.brand || "Unknown"
      const modelName = carData.model_group?.model || "Unknown"

      if (carData.investor_id) {
        try {
          const { data: investorData, error: investorError } = await supabase
            .from("investors")
            .select("profile_id, company_name")
            .eq("id", carData.investor_id)
            .single()

          if (!investorError && investorData) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", investorData.profile_id)
              .single()

            setInvestorName(profileData?.full_name || investorData.company_name || "Unknown")
          }
        } catch (err) {
          console.error("[v0] Investor fetch error:", err)
          // Continue loading car even if investor fetch fails
        }
      }

      // Load category from cars table (category is now directly on cars table)
      setCategory(carData.category || "Other")

      let sortedPhotos: any[] = []
      try {
        const { data: photosData, error: photosError } = await supabase
          .from("car_photos")
          .select("id, file_path, is_primary, sort_order")
          .eq("car_id", Number.parseInt(carId))
          .order("sort_order", { ascending: true })

        if (photosError) {
          console.error("[v0] Photos fetch error:", photosError)
        } else if (photosData) {
          sortedPhotos = photosData.sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1
            if (!a.is_primary && b.is_primary) return 1
            return (a.sort_order || 0) - (b.sort_order || 0)
          })
        }
      } catch (err) {
        console.error("[v0] Photos error:", err)
        // Continue with empty photos array
      }

      setCar({
        ...carData,
        brand: brandName,
        model: modelName,
      } as any)
      setEditedCar({
        ...carData,
        brand: brandName,
        model: modelName,
      } as any)
      setPhotos(sortedPhotos.map((p) => ({ id: String(p.id), image_url: p.file_path, is_primary: p.is_primary })))
      setCurrentPhotoIndex(0)
      setError(null)
    } catch (error) {
      console.error("[v0] Failed to load car details:", error)
      setError("Failed to load car details. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (carId) {
      loadCarDetails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carId])

  const handleEdit = () => {
    setIsEditing(true)
    setEditedCar(car!)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedCar(car!)
  }

  const handleSave = async () => {
    if (!car) return

    setIsSaving(true)
    try {
      const supabase = getSupabaseBrowserClient()

      // Ensure investor_id is properly typed as number or null
      const investorIdValue = (editedCar as any).investor_id
      const investorId = investorIdValue === null || investorIdValue === undefined || investorIdValue === "none" 
        ? null 
        : typeof investorIdValue === "number" ? investorIdValue : Number.parseInt(investorIdValue)

      // Only update columns that exist in the cars table:
      // id, created_at, plate_number, investor_id, model_group_id
      const updateData: any = {
        model_group_id: editedCar.model_group_id || null,
        plate_number: editedCar.plate_number,
        investor_id: investorId,
      }

      const { data, error } = await supabase
        .from("cars")
        .update(updateData)
        .eq("id", Number.parseInt(carId))
        .select("*")
        .single()

      if (error) {
        alert("Failed to update car: " + error.message)
        return
      }

      try {
        await loadCarDetails()
      } catch (err) {
        console.error("[v0] Reload error:", err)
        // Still show success even if reload fails
      }
      setIsEditing(false)
      alert("Car updated successfully!")
    } catch (error) {
      console.error("[v0] Failed to save car:", error)
      alert("Failed to save car. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !car) return

    setIsUploadingPhoto(true)
    try {
      const supabase = getSupabaseBrowserClient()
      let successCount = 0

      for (const file of Array.from(files)) {
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
        const storagePath = `car_${carId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from("car_photos")
          .upload(storagePath, file, { upsert: false })

        if (uploadError) {
          console.error("[v0] Photo upload error:", uploadError)
          continue
        }

        const { data: urlData } = supabase.storage.from("car_photos").getPublicUrl(storagePath)

        const { error: photoError } = await supabase.from("car_photos").insert({
          car_id: Number.parseInt(carId),
          file_path: urlData.publicUrl,
          is_primary: photos.length === 0 && successCount === 0,
          sort_order: photos.length + successCount,
        })

        if (photoError) {
          console.error("[v0] Photo DB insert error:", photoError)
          continue
        }

        successCount++
      }

      if (successCount > 0) {
        try {
          await loadCarDetails()
        } catch (err) {
          console.error("[v0] Reload error:", err)
        }
        alert(`Successfully uploaded ${successCount} photo(s)!`)
      } else {
        alert("Failed to upload photos. Please try again.")
      }
    } catch (error) {
      console.error("[v0] Failed to upload photos:", error)
      alert("Failed to upload photos. Please try again.")
    } finally {
      setIsUploadingPhoto(false)
      // Reset file input
      if (e.target) e.target.value = ""
    }
  }

  const handleDeletePhoto = async (photoId: string, imageUrl: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) return

    setIsDeletingPhoto(true)
    try {
      const supabase = getSupabaseBrowserClient()

      // Extract storage path from URL
      const urlParts = imageUrl.split("/car_photos/")
      if (urlParts.length > 1) {
        const storagePath = urlParts[1]
        await supabase.storage.from("car_photos").remove([storagePath])
      }

      // Delete from database
      const { error: dbError } = await supabase.from("car_photos").delete().eq("id", photoId)

      if (dbError) {
        console.error("[v0] DB delete error:", dbError)
        alert("Failed to delete photo: " + dbError.message)
        return
      }

      try {
        await loadCarDetails()
      } catch (err) {
        console.error("[v0] Reload error:", err)
      }
      alert("Photo deleted successfully!")
    } catch (error) {
      console.error("[v0] Failed to delete photo:", error)
      alert("Failed to delete photo. Please try again.")
    } finally {
      setIsDeletingPhoto(false)
    }
  }

  const handleSetPrimaryPhoto = async (photoId: string) => {
    if (!car) return

    try {
      const supabase = getSupabaseBrowserClient()

      await supabase.from("car_photos").update({ is_primary: false }).eq("car_id", Number.parseInt(carId))

      const { error } = await supabase.from("car_photos").update({ is_primary: true }).eq("id", photoId)

      if (error) {
        console.error("[v0] Set primary error:", error)
        alert("Failed to set primary photo: " + error.message)
        return
      }

      setPhotos((prevPhotos) => {
        const updatedPhotos = prevPhotos.map((photo) => ({
          ...photo,
          is_primary: photo.id === photoId,
        }))
        // Sort photos to put primary first
        return updatedPhotos.sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1
          if (!a.is_primary && b.is_primary) return 1
          return 0
        })
      })

      setCurrentPhotoIndex(0)
    } catch (error) {
      console.error("[v0] Failed to set primary photo:", error)
      alert("Failed to set primary photo. Please try again.")
    }
  }

  const handleDocumentUpload = async (type: "insurance" | "ruhsat", file: File) => {
    if (!car) return

    setIsUploadingDoc(type)
    try {
      const supabase = getSupabaseBrowserClient()
      const storagePath = `${type}/${carId}.pdf`

      // Upload to storage (replace if exists)
      const { error: uploadError } = await supabase.storage.from("car_doc").upload(storagePath, file, { upsert: true })

      if (uploadError) {
        console.error(`[v0] ${type} upload error:`, uploadError)
        alert(`Failed to upload ${type} document: ${uploadError.message}`)
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from("car_doc").getPublicUrl(storagePath)

      // Update cars_registration (insurance_file_url / ruhsat_url live there, not on cars)
      const fieldName = type === "insurance" ? "insurance_file_url" : "ruhsat_url"
      const { error: updateError } = await supabase
        .from("cars_registration")
        .update({ [fieldName]: urlData.publicUrl })
        .eq("car_id", Number.parseInt(carId))

      if (updateError) {
        console.error(`[v0] ${type} DB update error:`, updateError)
        alert(`Failed to save ${type} document: ${updateError.message}`)
        return
      }

      try {
        await loadCarDetails()
      } catch (err) {
        console.error("[v0] Reload error:", err)
      }
      alert(`${type === "insurance" ? "Insurance" : "Ruhsat"} document uploaded successfully!`)
    } catch (error) {
      console.error(`[v0] Failed to upload ${type}:`, error)
      alert(`Failed to upload ${type} document. Please try again.`)
    } finally {
      setIsUploadingDoc(null)
    }
  }

  const handleDocumentDelete = async (type: "insurance" | "ruhsat") => {
    if (!confirm(`Are you sure you want to delete the ${type} document?`)) return

    setIsDeletingDoc(type)
    try {
      const supabase = getSupabaseBrowserClient()
      const storagePath = `${type}/${carId}.pdf`

      // Delete from storage
      await supabase.storage.from("car_doc").remove([storagePath])

      // Update cars_registration to NULL (fields live there, not on cars)
      const fieldName = type === "insurance" ? "insurance_file_url" : "ruhsat_url"
      const { error: updateError } = await supabase
        .from("cars_registration")
        .update({ [fieldName]: null })
        .eq("car_id", Number.parseInt(carId))

      if (updateError) {
        console.error(`[v0] ${type} DB update error:`, updateError)
        alert(`Failed to delete ${type} document: ${updateError.message}`)
        return
      }

      try {
        await loadCarDetails()
      } catch (err) {
        console.error("[v0] Reload error:", err)
      }
      alert(`${type === "insurance" ? "Insurance" : "Ruhsat"} document deleted successfully!`)
    } catch (error) {
      console.error(`[v0] Failed to delete ${type}:`, error)
      alert(`Failed to delete ${type} document. Please try again.`)
    } finally {
      setIsDeletingDoc(null)
    }
  }

  const getDocumentUrl = (documentType: "insurance" | "ruhsat") => {
    const supabase = getSupabaseBrowserClient()
    const storagePath = `${documentType}/${carId}.pdf`

    const { data } = supabase.storage.from("car_doc").getPublicUrl(storagePath)
    return data.publicUrl
  }

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
  }

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-600">Loading car details...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error || !car) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                <h2 className="text-xl font-semibold text-red-900 mb-2">Car Not Found</h2>
                <p className="text-red-700">
                  {error || "The car you're looking for doesn't exist or has been deleted."}
                </p>
              </div>
              <Button onClick={() => router.push("/dashboard/cars")} className="bg-sky-500 hover:bg-sky-600">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Cars
              </Button>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const status = statusConfig[car.status] || statusConfig.SERVICE

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <Button
              variant="ghost"
              className="w-fit text-gray-600 hover:text-gray-900"
              onClick={() => router.push(`/dashboard/cars`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cars
            </Button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {(car as any).model_group?.brand} {(car as any).model_group?.model} – {car.plate_number}
                </h1>
                <p className="text-gray-600 mt-1">
                  {car.year} • {car.transmission}
                </p>
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button onClick={handleEdit} variant="outline">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleCancel} variant="outline">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-sky-500 hover:bg-sky-600">
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Photo Gallery */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Car Photos</h3>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                      disabled={isUploadingPhoto}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("photo-upload")?.click()}
                      disabled={isUploadingPhoto}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploadingPhoto ? "Uploading..." : "Add Photos"}
                    </Button>
                  </div>
                </div>

                {photos.length === 0 ? (
                  <div className="relative h-[400px] bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
                    <div className="text-center">
                      <Plus className="h-14 w-14 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-700 font-medium text-lg">No photos yet</p>
                      <p className="text-gray-500 text-sm mt-2">Click "Add Photos" to upload images</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative h-[400px] bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl overflow-hidden shadow-inner">
                      <Image
                        src={photos[currentPhotoIndex]?.image_url || "/classic-red-convertible.png"}
                        alt={`${(car as any).model_group?.brand || ""} ${(car as any).model_group?.model || ""}`}
                        fill
                        className="object-contain p-4"
                      />
                      {photos.length > 1 && (
                        <>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full"
                            onClick={prevPhoto}
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full"
                            onClick={nextPhoto}
                          >
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm">
                            {currentPhotoIndex + 1} / {photos.length}
                          </div>
                        </>
                      )}

                      <div className="absolute top-4 right-4 flex gap-2">
                        {!photos[currentPhotoIndex]?.is_primary && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white/90 hover:bg-white shadow-lg"
                            onClick={() => handleSetPrimaryPhoto(photos[currentPhotoIndex].id)}
                          >
                            <Star className="h-4 w-4 mr-1" />
                            Set Primary
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          className="bg-red-500/90 hover:bg-red-500 shadow-lg"
                          onClick={() =>
                            handleDeletePhoto(photos[currentPhotoIndex].id, photos[currentPhotoIndex].image_url)
                          }
                          disabled={isDeletingPhoto}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Thumbnail strip */}
                    {photos.length > 1 && (
                      <div className="flex gap-3 overflow-x-auto pb-2 px-1">
                        {photos.map((photo, index) => (
                          <button
                            key={photo.id}
                            onClick={() => setCurrentPhotoIndex(index)}
                            className={`relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                              index === currentPhotoIndex
                                ? "border-sky-500 shadow-lg scale-105"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <Image
                              src={photo.image_url || "/placeholder.svg"}
                              alt={`Thumbnail ${index + 1}`}
                              fill
                              className="object-cover"
                            />
                            {photo.is_primary && (
                              <div className="absolute top-1 right-1 bg-yellow-400 rounded-full p-1 shadow-md">
                                <Star className="h-3 w-3 text-white fill-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Car Info and Documents */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column - Key Specs */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Vehicle Information</h2>

                {!isEditing ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Investor</p>
                      <p className="font-medium text-gray-900">{investorName || "Unknown"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <Badge className={status.className}>{status.label}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Gearbox</p>
                      <p className="font-medium text-gray-900">{car.transmission || "Unknown"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Year</p>
                      <p className="font-medium text-gray-900">{car.year || "Unknown"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Model</p>
                      <p className="font-medium text-gray-900">{(car as any).model_group?.model || "Unknown"}</p>
                    </div>
                    {car.fuel && (
                      <div>
                        <p className="text-sm text-gray-600">Fuel Type</p>
                        <p className="font-medium text-gray-900">{car.fuel}</p>
                      </div>
                    )}
                              {(car as any).current_km && (
                                <div>
                                  <p className="text-sm text-gray-600">Current KM</p>
                                  <p className="font-medium text-gray-900">{(car as any).current_km.toLocaleString()}</p>
                                </div>
                              )}
                              {(car as any).base_price_usd !== undefined && (car as any).base_price_usd !== null && (
                                <div>
                                  <p className="text-sm text-gray-600">Base Price (USD)</p>
                                  <p className="font-medium text-gray-900">${(car as any).base_price_usd}</p>
                                </div>
                              )}
                              {investorName && (
                                <div>
                                  <p className="text-sm text-gray-600">Investor / Owner</p>
                                  <p className="font-medium text-gray-900">{investorName}</p>
                                </div>
                              )}
                            </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Model Group *</Label>
                      <Select
                        value={editedCar.model_group_id ? String(editedCar.model_group_id) : ""}
                        onValueChange={(value) => setEditedCar({ ...editedCar, model_group_id: value ? parseInt(value) : null })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select model group" />
                        </SelectTrigger>
                        <SelectContent>
                          {modelGroups.map((group) => (
                            <SelectItem key={group.id} value={String(group.id)}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={editedCar.status}
                          onValueChange={(value) => setEditedCar({ ...editedCar, status: value as CarStatus })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WORKING">Working</SelectItem>
                            <SelectItem value="PARKING">Parking</SelectItem>
                            <SelectItem value="SERVICE">Service</SelectItem>
                            <SelectItem value="SELLING">Selling</SelectItem>
                            <SelectItem value="OUT_OF_SERVICE">Out of Service</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Transmission</Label>
                        <Select
                          value={editedCar.transmission}
                          onValueChange={(value) =>
                            setEditedCar({ ...editedCar, transmission: value as CarTransmission })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AUTOMATIC">Automatic</SelectItem>
                            <SelectItem value="MANUAL">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Investor / Owner</Label>
                        <Select 
                          value={(editedCar as any).investor_id?.toString() || "none"} 
                          onValueChange={(value) => setEditedCar({ ...editedCar, investor_id: value === "none" ? null : Number.parseInt(value) } as any)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select investor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No investor</SelectItem>
                            {investors.map((investor) => (
                              <SelectItem key={investor.id} value={investor.id.toString()}>
                                {investor.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Input
                          type="number"
                          value={editedCar.year}
                          onChange={(e) => setEditedCar({ ...editedCar, year: Number.parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Plate Number</Label>
                        <Input
                          value={editedCar.plate_number}
                          onChange={(e) => setEditedCar({ ...editedCar, plate_number: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t space-y-3">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Inspection Due Date</Label>
                        <Input
                          type="date"
                          value={editedCar.inspection_due_date?.split("T")[0] || ""}
                          onChange={(e) => setEditedCar({ ...editedCar, inspection_due_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Insurance Expiry Date</Label>
                        <Input
                          type="date"
                          value={(editedCar as any).insurance_expiry_date?.split("T")[0] || ""}
                          onChange={(e) => setEditedCar({ ...editedCar, insurance_expiry_date: e.target.value } as any)}
                        />
                      </div>
                                <div className="space-y-2">
                                  <Label>Current KM</Label>
                                  <Input
                                    type="number"
                                    value={(editedCar as any).current_km || ""}
                                    onChange={(e) =>
                                      setEditedCar({ ...editedCar, current_km: Number.parseInt(e.target.value) || 0 } as any)
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Base Price (USD)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="e.g. 50"
                                    value={(editedCar as any).base_price_usd || ""}
                                    onChange={(e) =>
                                      setEditedCar({ ...editedCar, base_price_usd: Number.parseFloat(e.target.value) || 0 } as any)
                                    }
                                  />
                                  <p className="text-xs text-gray-500">Daily rental base price before discounts</p>
                                </div>
                              </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm">Insurance Exp:</span>
                        </div>
                        <span className="text-sm font-medium">
                          {(car as any).insurance_expiry_date
                            ? new Date((car as any).insurance_expiry_date).toLocaleDateString()
                            : "Not set"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Settings className="h-4 w-4" />
                          <span className="text-sm">Inspection Due:</span>
                        </div>
                        <span className="text-sm font-medium">
                          {car.inspection_due_date ? new Date(car.inspection_due_date).toLocaleDateString() : "Not set"}
                        </span>
                      </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Gauge className="h-4 w-4" />
                              <span className="text-sm">Current KM:</span>
                            </div>
                            <span className="text-sm font-medium">
                              {(car as any).current_km ? (car as any).current_km.toLocaleString() : "Not set"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-gray-600">
                              <span className="text-sm">Base Price:</span>
                            </div>
                            <span className="text-sm font-medium text-emerald-600">
                              {(car as any).base_price_usd ? `$${(car as any).base_price_usd}/day` : "Not set"}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
              </CardContent>
            </Card>

            {/* Right Column - Documents */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Documents</h2>

                {/* Insurance Policy */}
                <div className="space-y-2">
                  <Label>Insurance Policy</Label>
                  {(car as any).insurance_policy_url ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 bg-transparent"
                          onClick={() => {
                            const url = getDocumentUrl("insurance")
                            window.open(url, "_blank")
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open PDF
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const link = document.createElement("a")
                            link.href = getDocumentUrl("insurance")
                            link.download = `insurance-policy-${car.plate_number}.pdf`
                            link.click()
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleDocumentDelete("insurance")}
                          disabled={isDeletingDoc === "insurance"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleDocumentUpload("insurance", file)
                        }}
                        className="hidden"
                        id="insurance-replace-upload"
                        disabled={isUploadingDoc === "insurance"}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full bg-transparent"
                        onClick={() => document.getElementById("insurance-replace-upload")?.click()}
                        disabled={isUploadingDoc === "insurance"}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingDoc === "insurance" ? "Uploading..." : "Replace PDF"}
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleDocumentUpload("insurance", file)
                        }}
                        className="hidden"
                        id="insurance-upload"
                        disabled={isUploadingDoc === "insurance"}
                      />
                      <Button
                        variant="outline"
                        className="w-full bg-transparent"
                        onClick={() => document.getElementById("insurance-upload")?.click()}
                        disabled={isUploadingDoc === "insurance"}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingDoc === "insurance" ? "Uploading..." : "Upload Insurance Policy"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Ruhsat (Registration) */}
                <div className="space-y-2">
                  <Label>Ruhsat (Registration)</Label>
                  {(car as any).ruhsat_url ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 bg-transparent"
                          onClick={() => {
                            const url = getDocumentUrl("ruhsat")
                            window.open(url, "_blank")
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open PDF
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const link = document.createElement("a")
                            link.href = getDocumentUrl("ruhsat")
                            link.download = `ruhsat-${car.plate_number}.pdf`
                            link.click()
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleDocumentDelete("ruhsat")}
                          disabled={isDeletingDoc === "ruhsat"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleDocumentUpload("ruhsat", file)
                        }}
                        className="hidden"
                        id="ruhsat-replace-upload"
                        disabled={isUploadingDoc === "ruhsat"}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full bg-transparent"
                        onClick={() => document.getElementById("ruhsat-replace-upload")?.click()}
                        disabled={isUploadingDoc === "ruhsat"}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingDoc === "ruhsat" ? "Uploading..." : "Replace PDF"}
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleDocumentUpload("ruhsat", file)
                        }}
                        className="hidden"
                        id="ruhsat-upload"
                        disabled={isUploadingDoc === "ruhsat"}
                      />
                      <Button
                        variant="outline"
                        className="w-full bg-transparent"
                        onClick={() => document.getElementById("ruhsat-upload")?.click()}
                        disabled={isUploadingDoc === "ruhsat"}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingDoc === "ruhsat" ? "Uploading..." : "Upload Ruhsat"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center gap-3 text-gray-600">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">All documents are stored securely</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
