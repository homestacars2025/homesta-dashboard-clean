"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { dataService } from "@/lib/data-service"
import { useAuth } from "@/lib/auth-context"
import type { Car, CarPricingAvailability, Operation } from "@/lib/types"
import { ArrowLeft, Calendar, Gauge, DollarSign } from "lucide-react"
import Image from "next/image"

const statusConfig = {
  WORKING: { label: "Working", className: "bg-green-100 text-green-700 border-green-200" },
  PARKING: { label: "Parking", className: "bg-red-100 text-red-700 border-red-200" },
  SERVICE: { label: "Service", className: "bg-gray-100 text-gray-700 border-gray-200" },
  SELLING: { label: "Selling", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  OUT_OF_SERVICE: { label: "Out of Service", className: "bg-gray-100 text-gray-700 border-gray-200" },
  UNKNOWN: { label: "Unknown", className: "bg-gray-100 text-gray-500 border-gray-200" },
}

export default function ModelCarsListPage() {
  const params = useParams()
  const router = useRouter()
  const modelGroup = decodeURIComponent(params.modelGroup as string)

  const [cars, setCars] = useState<Car[]>([])
  const [carsData, setCarsData] = useState<
    Map<string, { pricing: CarPricingAvailability | null; latestOp: Operation | null }>
  >(new Map())
  const { initialAuthChecked, user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!initialAuthChecked) return
    if (!user) {
      setIsLoading(false)
      return
    }
    const loadCars = async () => {
      try {
        console.log("[v0] Loading cars for model:", modelGroup)
        const carsInModel = await dataService.getCarsByModelGroup(modelGroup)
        console.log("[v0] Loaded cars:", carsInModel)
        setCars(carsInModel || [])

        // Load pricing and latest operation for each car
        const dataMap = new Map()
        for (const car of carsInModel || []) {
          Promise.all([
            (async () => {
              try {
                // Get pricing from mock data
                const mockCarPricing = (await import("@/lib/mock-data")).mockCarPricing
                return mockCarPricing.find((p) => p.car_id === car.id) || null
              } catch {
                return null
              }
            })(),
            dataService.getLatestOperation(car.id).catch(() => null),
          ]).then(([pricing, latestOp]) => {
            dataMap.set(car.id, { pricing, latestOp })
            setCarsData(new Map(dataMap))
          })
        }
      } catch (error) {
        console.error("[v0] Failed to load cars:", error)
        setCars([])
      } finally {
        setIsLoading(false)
      }
    }

    loadCars()
  }, [modelGroup])

  if (isLoading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-600">Loading cars...</p>
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
          <div className="flex flex-col gap-4">
            <Button
              variant="ghost"
              className="w-fit text-gray-600 hover:text-gray-900"
              onClick={() => router.push("/dashboard/cars")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cars overview
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{modelGroup}</h1>
              <p className="text-gray-600 mt-1">All cars in this model</p>
            </div>
          </div>

          {/* Cars List */}
          <div className="space-y-4">
            {cars.map((car) => {
              const carData = carsData.get(car.id)
              const status = statusConfig[car.status as keyof typeof statusConfig] || statusConfig.UNKNOWN

              return (
                <Card
                  key={car.id}
                  className="cursor-pointer transition-all hover:shadow-md"
                  onClick={() => router.push(`/dashboard/cars/${car.id}`)}
                >
                  <CardContent className="pt-6">
                    <div className="flex gap-6">
                      {/* Car Image */}
                      <div className="relative h-32 w-48 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                        <Image
                          src={car.thumbnail_url || "/placeholder.svg?height=128&width=192&query=car"}
                          alt={`${(car as any).model_group?.brand || "Unknown"} ${(car as any).model_group?.model || "Car"}`}
                          fill
                          className="object-cover"
                        />
                      </div>

                      {/* Car Info */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-lg text-gray-900">{car.plate_number || "Unknown Plate"}</h3>
                            <p className="text-sm text-gray-600">
                              {(car as any).model_group?.brand || "Unknown"} {(car as any).model_group?.model || "Model"} • {(car as any).year || "Unknown Year"}
                            </p>
                          </div>
                          <Badge className={status.className}>{status.label}</Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          {carData?.latestOp?.mileage != null && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Gauge className="h-4 w-4" />
                              <span>{carData.latestOp.mileage.toLocaleString()} km</span>
                            </div>
                          )}

                          {carData?.pricing?.status === "ACTIVE" && carData.pricing.daily_price != null && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <DollarSign className="h-4 w-4" />
                              <span>₺{carData.pricing.daily_price}/day</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-gray-600">
                            <Calendar className="h-4 w-4" />
                            <span>{car.transmission || "Unknown"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {cars.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-600">No cars yet in this model.</p>
                <p className="text-sm text-gray-500 mt-2">Cars will appear here once they are added to the system.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
