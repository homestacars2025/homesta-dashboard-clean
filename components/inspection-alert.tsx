"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Calendar, Car } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { format, differenceInDays } from "date-fns"

type CarInspection = {
  car_id: number
  inspection_expiry: string
  car: {
    id: number
    plate_number: string
    model_group: { name: string } | null
  }
  daysRemaining: number
}

export function InspectionAlert() {
  const [upcomingInspections, setUpcomingInspections] = useState<CarInspection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadInspectionData = async () => {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) {
        if (isMounted) setLoading(false)
        return
      }

      try {
        const today = new Date()
        
        const { data, error } = await supabase
          .from("cars_registration")
          .select("car_id, inspection_expiry, car:cars(id, plate_number, model_group:model_group(name))")
          .not("inspection_expiry", "is", null)
          .order("inspection_expiry", { ascending: true })
          .limit(10)

        if (!isMounted) return
        if (error) throw error

        if (data) {
          const withDays = data
            .filter((item: any) => item.car)
            .map((item: any) => ({
              ...item,
              daysRemaining: differenceInDays(new Date(item.inspection_expiry), today),
            }))
            .filter((item: any) => item.daysRemaining >= -30)
            .slice(0, 3)

          setUpcomingInspections(withDays)
        }
      } catch (error: any) {
        if (error?.name === "AbortError") return
        if (isMounted) console.error("Failed to load inspection data:", error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadInspectionData()

    return () => {
      isMounted = false
    }
  }, [])

  const getUrgencyColor = (daysRemaining: number) => {
    if (daysRemaining < 0) return "bg-red-500 text-white"
    if (daysRemaining <= 7) return "bg-red-100 text-red-700"
    if (daysRemaining <= 30) return "bg-amber-100 text-amber-700"
    return "bg-emerald-100 text-emerald-700"
  }

  const getUrgencyBorder = (daysRemaining: number) => {
    if (daysRemaining < 0) return "border-red-300"
    if (daysRemaining <= 7) return "border-red-200"
    if (daysRemaining <= 30) return "border-amber-200"
    return "border-emerald-200"
  }

  if (loading) {
    return (
      <Card className="shadow-lg border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            Vehicle Inspection Alert
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-500 border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (upcomingInspections.length === 0) {
    return (
      <Card className="shadow-lg border-emerald-200 bg-emerald-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-emerald-700">
            <Calendar className="h-5 w-5" />
            Vehicle Inspection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-emerald-600">All vehicles have valid inspections.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
          <AlertTriangle className="h-5 w-5" />
          Vehicle Inspection Alert
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingInspections.map((item) => (
          <Link
            key={item.car_id}
            href={`/dashboard/cars/${item.car.id}`}
            className={`block p-3 rounded-lg border ${getUrgencyBorder(item.daysRemaining)} hover:shadow-md transition-shadow bg-white`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100">
                  <Car className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{item.car.plate_number}</p>
                  <p className="text-xs text-slate-500">{item.car.model_group?.name || "No model group"}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(item.daysRemaining)}`}>
                  {item.daysRemaining < 0 
                    ? `Expired ${Math.abs(item.daysRemaining)}d ago`
                    : item.daysRemaining === 0
                    ? "Due Today"
                    : `${item.daysRemaining} days left`
                  }
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  {format(new Date(item.inspection_expiry), "dd MMM yyyy")}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
