import { createBrowserClient } from "@supabase/ssr"

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Types
export interface ExchangeRate {
  id: string
  currency_code: string
  currency_name: string
  rate_to_try: number
  updated_at: string
}

export interface PricingDiscount {
  id: string
  bucket_key: string
  label: string
  min_days: number
  max_days: number
  discount_percent: number
  is_active: boolean
}

export interface CarPricing {
  id: number
  brand: string
  model: string
  plate_number: string
  status: string
  daily_price_usd: number | null
}

export interface CalculatedPrice {
  bucket_key: string
  label: string
  days_range: string
  discount_percent: number
  price_usd: number
  price_try: number
}

// Service functions
export const pricingServiceV3 = {
  // Exchange Rates - Returns defaults if table doesn't exist
  async getExchangeRates(): Promise<ExchangeRate[]> {
    const defaults: ExchangeRate[] = [
      { id: "default-usd", currency_code: "USD", currency_name: "US Dollar", rate_to_try: 32.50, updated_at: new Date().toISOString() },
      { id: "default-eur", currency_code: "EUR", currency_name: "Euro", rate_to_try: 35.20, updated_at: new Date().toISOString() },
      { id: "default-lyd", currency_code: "LYD", currency_name: "Libyan Dinar", rate_to_try: 6.70, updated_at: new Date().toISOString() },
    ]
    try {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .order("currency_code")

      if (error) {
        // Table doesn't exist - silently return defaults
        return defaults
      }
      return data && data.length > 0 ? data : defaults
    } catch (e) {
      console.error("[v0] Exception loading exchange rates:", e)
      return defaults
    }
  },

  async updateExchangeRate(id: string, rate: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("exchange_rates")
        .update({ rate_to_try: rate, updated_at: new Date().toISOString() })
        .eq("id", id)

      if (error) {
        console.error("[v0] Error updating exchange rate:", error.message)
        return false
      }
      return true
    } catch (e) {
      console.error("[v0] Exception updating exchange rate:", e)
      return false
    }
  },

  // Pricing Discounts - Returns defaults if table doesn't exist
  async getPricingDiscounts(): Promise<PricingDiscount[]> {
    const defaults: PricingDiscount[] = [
      { id: "default-a", bucket_key: "A", label: "Short Term", min_days: 3, max_days: 7, discount_percent: 0, is_active: true },
      { id: "default-b", bucket_key: "B", label: "Weekly", min_days: 8, max_days: 14, discount_percent: 5, is_active: true },
      { id: "default-c", bucket_key: "C", label: "Bi-Weekly", min_days: 15, max_days: 29, discount_percent: 10, is_active: true },
      { id: "default-d", bucket_key: "D", label: "Monthly", min_days: 30, max_days: 59, discount_percent: 15, is_active: true },
      { id: "default-e", bucket_key: "E", label: "Quarterly", min_days: 60, max_days: 89, discount_percent: 20, is_active: true },
      { id: "default-f", bucket_key: "F", label: "Long Term", min_days: 90, max_days: 180, discount_percent: 25, is_active: true },
    ]
    try {
      const { data, error } = await supabase
        .from("pricing_discounts")
        .select("*")
        .eq("is_active", true)
        .order("min_days")

      if (error) {
        // Table doesn't exist - silently return defaults
        return defaults
      }
      return data && data.length > 0 ? data : defaults
    } catch (e) {
      console.error("[v0] Exception loading pricing discounts:", e)
      return defaults
    }
  },

  async updateDiscount(id: string, discount_percent: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("pricing_discounts")
        .update({ discount_percent, updated_at: new Date().toISOString() })
        .eq("id", id)

      if (error) {
        console.error("[v0] Error updating discount:", error.message)
        return false
      }
      return true
    } catch (e) {
      console.error("[v0] Exception updating discount:", e)
      return false
    }
  },

  // Cars with pricing - handles missing daily_price_usd column gracefully
  async getCarsWithPricing(): Promise<CarPricing[]> {
    try {
      // First try with daily_price_usd column
      const { data, error } = await supabase
        .from("cars")
        .select("id, brand, model, plate_number, status, daily_price_usd")
        .order("brand")

      if (error) {
        // If column doesn't exist, query without it and return cars with null price
        if (error.message.includes("daily_price_usd") || error.message.includes("does not exist")) {
          const { data: basicData, error: basicError } = await supabase
            .from("cars")
            .select("id, brand, model, plate_number, status")
            .order("brand")
          
          if (basicError) {
            console.error("[v0] Error loading cars:", basicError.message)
            return []
          }
          // Return cars with null price
          return (basicData || []).map(car => ({ ...car, daily_price_usd: null }))
        }
        console.error("[v0] Error loading cars:", error.message)
        return []
      }
      return data || []
    } catch (e) {
      console.error("[v0] Exception loading cars:", e)
      return []
    }
  },

  async updateCarPrice(carId: number, priceUsd: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("cars")
        .update({ daily_price_usd: priceUsd })
        .eq("id", carId)

      if (error) {
        console.error("[v0] Error updating car price:", error.message)
        return false
      }
      return true
    } catch (e) {
      console.error("[v0] Exception updating car price:", e)
      return false
    }
  },

  // Price calculation
  calculatePrices(
    dailyPriceUsd: number,
    discounts: PricingDiscount[],
    usdToTry: number
  ): CalculatedPrice[] {
    return discounts.map((d) => {
      const discountedPriceUsd = dailyPriceUsd * (1 - d.discount_percent / 100)
      const priceTry = discountedPriceUsd * usdToTry

      return {
        bucket_key: d.bucket_key,
        label: d.label,
        days_range: `${d.min_days}-${d.max_days}`,
        discount_percent: d.discount_percent,
        price_usd: Math.round(discountedPriceUsd * 100) / 100,
        price_try: Math.round(priceTry),
      }
    })
  },

  // Calculate total for booking
  calculateBookingTotal(
    dailyPriceUsd: number,
    days: number,
    discounts: PricingDiscount[],
    usdToTry: number
  ): { daily_usd: number; daily_try: number; total_usd: number; total_try: number; discount_percent: number } {
    // Find applicable discount
    const applicable = discounts.find((d) => days >= d.min_days && days <= d.max_days)
    const discountPercent = applicable?.discount_percent || 0

    const dailyUsd = dailyPriceUsd * (1 - discountPercent / 100)
    const dailyTry = dailyUsd * usdToTry
    const totalUsd = dailyUsd * days
    const totalTry = dailyTry * days

    return {
      daily_usd: Math.round(dailyUsd * 100) / 100,
      daily_try: Math.round(dailyTry),
      total_usd: Math.round(totalUsd * 100) / 100,
      total_try: Math.round(totalTry),
      discount_percent: discountPercent,
    }
  },
}
