import { getSupabaseBrowserClient } from "@/lib/supabase-client"

export interface PricingBucket {
  id: string
  bucket_key: string
  label: string
  min_days: number
  max_days: number
  discount_percent: number
  is_active: boolean
}

export interface CarBasePrice {
  id: string
  car_id: number
  base_price_per_day: number
  currency: string
  is_active: boolean
}

export interface CarWithPricing {
  car_id: number
  brand: string
  model: string
  plate_number: string
  status: string
  base_price_per_day: number | null
  pricing_id: string | null
  is_active: boolean
}

export interface PriceCalculation {
  days: number
  bucket: PricingBucket | null
  base_price_per_day: number
  discounted_price_per_day: number
  discount_percent: number
  total_price: number
}

class PricingService {
  // Get all pricing buckets
  async getBuckets(): Promise<PricingBucket[]> {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return []

    const { data, error } = await supabase
      .from("pricing_policy_buckets")
      .select("*")
      .order("min_days", { ascending: true })

    if (error) {
      console.error("[PricingService] Error loading buckets:", error)
      return []
    }

    return data || []
  }

  // Update a bucket's discount percent
  async updateBucketDiscount(bucketId: string, discountPercent: number): Promise<boolean> {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return false

    const { error } = await supabase
      .from("pricing_policy_buckets")
      .update({
        discount_percent: discountPercent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bucketId)

    if (error) {
      console.error("[PricingService] Error updating bucket:", error)
      return false
    }

    return true
  }

  // Get all cars with their base pricing
  async getCarsWithPricing(): Promise<CarWithPricing[]> {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return []

    // Get all cars
    const { data: cars, error: carsError } = await supabase
      .from("cars")
      .select("id, brand, model, plate_number, status")
      .order("brand", { ascending: true })

    if (carsError) {
      console.error("[PricingService] Error loading cars:", carsError)
      return []
    }

    // Get all base pricing
    const { data: pricing, error: pricingError } = await supabase.from("car_base_pricing").select("*")

    if (pricingError) {
      console.error("[PricingService] Error loading pricing:", pricingError)
    }

    // Create pricing map
    const pricingMap = new Map<number, CarBasePrice>()
    if (pricing) {
      pricing.forEach((p: any) => pricingMap.set(p.car_id, p))
    }

    // Merge data
    return (cars || []).map((car: any) => {
      const carPricing = pricingMap.get(car.id)
      return {
        car_id: car.id,
        brand: car.model_group?.brand || "",
        model: car.model_group?.model || "",
        plate_number: car.plate_number,
        status: car.status,
        base_price_per_day: carPricing?.base_price_per_day || null,
        pricing_id: carPricing?.id || null,
        is_active: carPricing?.is_active ?? true,
      }
    })
  }

  // Set or update base price for a car
  async setCarBasePrice(carId: number, basePrice: number): Promise<boolean> {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return false

    // Check if pricing exists
    const { data: existing } = await supabase.from("car_base_pricing").select("id").eq("car_id", carId).single()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from("car_base_pricing")
        .update({
          base_price_per_day: basePrice,
          updated_at: new Date().toISOString(),
        })
        .eq("car_id", carId)

      if (error) {
        console.error("[PricingService] Error updating price:", error)
        return false
      }
    } else {
      // Insert new
      const { error } = await supabase.from("car_base_pricing").insert({
        car_id: carId,
        base_price_per_day: basePrice,
        currency: "TRY",
        is_active: true,
      })

      if (error) {
        console.error("[PricingService] Error inserting price:", error)
        return false
      }
    }

    return true
  }

  // Get base price for a specific car
  async getCarBasePrice(carId: number): Promise<number | null> {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return null

    const { data, error } = await supabase
      .from("car_base_pricing")
      .select("base_price_per_day")
      .eq("car_id", carId)
      .eq("is_active", true)
      .single()

    if (error || !data) {
      return null
    }

    return data.base_price_per_day
  }

  // Find the matching bucket for a given number of days
  findBucketForDays(buckets: PricingBucket[], days: number): PricingBucket | null {
    return buckets.find((b) => days >= b.min_days && days <= b.max_days && b.is_active) || null
  }

  // Calculate price for a booking
  calculatePrice(basePricePerDay: number, days: number, buckets: PricingBucket[]): PriceCalculation {
    const bucket = this.findBucketForDays(buckets, days)
    const discountPercent = bucket?.discount_percent || 0
    const discountedPricePerDay = basePricePerDay * (1 - discountPercent / 100)
    const totalPrice = days * discountedPricePerDay

    return {
      days,
      bucket,
      base_price_per_day: basePricePerDay,
      discounted_price_per_day: discountedPricePerDay,
      discount_percent: discountPercent,
      total_price: totalPrice,
    }
  }

  // Calculate price for a car and date range
  async calculateBookingPrice(carId: number, startDate: string, endDate: string): Promise<PriceCalculation | null> {
    const basePrice = await this.getCarBasePrice(carId)
    if (!basePrice) return null

    const buckets = await this.getBuckets()
    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    if (days < 5) {
      return null // Minimum 5 days policy
    }

    return this.calculatePrice(basePrice, days, buckets)
  }
}

export const pricingService = new PricingService()
