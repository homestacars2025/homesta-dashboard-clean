"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { useVisibilityRefresh } from "@/hooks/use-visibility-refresh"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Car,
  DollarSign,
  Edit2,
  Save,
  X,
  RefreshCw,
  Clock,
  Info,
  Calendar,
  Percent,
} from "lucide-react"
import { createBrowserClient } from "@supabase/ssr"

// Brand Colors
const BRAND = {
  primary: "#0A2540",
  secondary: "#1E88E5",
  accent: "#E53935",
  background: "#F8FAFC",
}

// Types (unchanged)
interface ExchangeRate {
  id: string
  code: string
  name: string
  rate: number
}

interface DiscountBucket {
  id: string
  key: string
  label: string
  minDays: number
  maxDays: number
  discount: number
}

interface ModelPricing {
  id: string
  brand_id: string
  name: string
  thumbnail_url: string | null
  brand_name: string
  base_price_usd: number
  car_count: number
}

// Color mapping for exchange rate cards
const RATE_COLORS: Record<string, string> = {
  USD: "#10B981", // emerald
  EUR: "#3B82F6", // blue
}

// Default discount buckets - will be replaced by database values
// Table: car_pricing_tiers | Columns: id, min_days, max_days, discount_percent
const DEFAULT_BUCKETS: DiscountBucket[] = []

// Fallback rates when database is unavailable (these are not used unless DB fails)
const FALLBACK_RATES: ExchangeRate[] = [
  { id: "fallback-usd", code: "USD", name: "US Dollar", rate: 32.5 },
  { id: "fallback-eur", code: "EUR", name: "Euro", rate: 35.2 },
]

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className || ""}`} />
)

function PricingPageContent() {
  const { user } = useAuth()
  
  // Check if user is an investor - they can only view, not edit
  const isInvestor = user?.role === "investor"
  
  const isMountedRef = useRef(true)
  const supabaseRef = useRef(
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  )

  const [loading, setLoading] = useState(true)
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>(FALLBACK_RATES)
  const [discountBuckets, setDiscountBuckets] = useState<DiscountBucket[]>(DEFAULT_BUCKETS)
  const [models, setModels] = useState<ModelPricing[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  
  // Editing states
  const [editingRateId, setEditingRateId] = useState<string | null>(null)
  const [tempRate, setTempRate] = useState<number>(0)
  const [modelPrices, setModelPrices] = useState<Record<string, number>>({})
  const [displayCurrency, setDisplayCurrency] = useState<"TRY" | "USD" | "EUR">("TRY")
  
  // Discount rule editing states
  const [editingBucketId, setEditingBucketId] = useState<string | null>(null)
  const [tempBucket, setTempBucket] = useState<{ minDays: number; maxDays: number; discount: number }>({ minDays: 0, maxDays: 0, discount: 0 })
  const [isAddingRule, setIsAddingRule] = useState(false)
  const [newRule, setNewRule] = useState<{ minDays: number; maxDays: number; discount: number }>({ minDays: 1, maxDays: 7, discount: 0 })
  const [ruleError, setRuleError] = useState<string | null>(null)

  const supabase = supabaseRef.current
  const isFetchingRef = useRef(false)
  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    loadData()
    return () => { isMountedRef.current = false }
  }, [])

  // Refresh data when tab becomes visible - pass isFetchingRef to skip if fetch in progress
  useVisibilityRefresh(() => {
    loadData()
  }, isFetchingRef)

  // ALL LOGIC FUNCTIONS UNCHANGED
  const loadData = async () => {
    if (!isMountedRef.current) return
    isFetchingRef.current = true
    if (!hasLoadedOnceRef.current) setLoading(true)

    try {
      // Fetch exchange rates from database - columns: id, currency, rate_to_try, updated_at
      const { data: ratesData, error: ratesError } = await supabase
        .from("exchange_rates")
        .select("id, currency, rate_to_try, updated_at")
        .order("currency")

      if (!ratesError && ratesData && ratesData.length > 0) {
        const mappedRates: ExchangeRate[] = ratesData.map(r => ({
          id: String(r.id),
          code: r.currency,
          name: r.currency,
          rate: r.rate_to_try,
        }))
        setExchangeRates(mappedRates)
      } else {
        setExchangeRates(FALLBACK_RATES)
      }

      // Fetch discount rules from car_pricing_tiers table
      // Columns: id, min_days, max_days, discount_percent
      const { data: tiersData, error: tiersError } = await supabase
        .from("car_pricing_tiers")
        .select("id, min_days, max_days, discount_percent")
        .order("min_days")

      if (!tiersError && tiersData && tiersData.length > 0) {
        const bucketKeys = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
        const mappedBuckets: DiscountBucket[] = tiersData.map((t, index) => ({
          id: String(t.id),
          key: bucketKeys[index] || String(index + 1),
          label: `${t.min_days}-${t.max_days} days`,
          minDays: t.min_days,
          maxDays: t.max_days,
          discount: t.discount_percent || 0,
        }))
        setDiscountBuckets(mappedBuckets)
      }

      // Fetch model groups with total_cars count
      const { data: modelGroupsData, error: modelGroupsError } = await supabase
        .from("model_group")
        .select("id, name, brand, model, image_url, total_cars")
        .order("name")

      if (modelGroupsError) throw modelGroupsError

      if (!isMountedRef.current) return

      const mappedModels: ModelPricing[] = (modelGroupsData || []).map(mg => ({
        id: String(mg.id),
        brand_id: "",
        name: mg.name,
        thumbnail_url: mg.image_url,
        brand_name: mg.brand || "Unknown",
        base_price_usd: 0, // Will need to add pricing to model_group table
        car_count: mg.total_cars || 0,
      }))

      setModels(mappedModels)

      const prices: Record<string, number> = {}
      mappedModels.forEach(m => { prices[m.id] = m.base_price_usd })
      setModelPrices(prices)
      hasLoadedOnceRef.current = true
    } catch (err) {
  // Silently handle errors
  } finally {
    setLoading(false)
    isFetchingRef.current = false
  }
  }

  const updateExchangeRate = async (id: string, newRate: number) => {
    // Update in database - id is integer in DB so parse it
    const numericId = parseInt(id, 10)
    const { error } = await supabase
      .from("exchange_rates")
      .update({ rate_to_try: newRate, updated_at: new Date().toISOString() })
      .eq("id", numericId)

    if (!error) {
      // Update local state immediately for instant UI feedback
      setExchangeRates(prev => prev.map(r => r.id === id ? { ...r, rate: newRate } : r))
    }
    setEditingRateId(null)
  }

  // Validate discount rule (min < max, no overlap, discount 0-100)
  const validateRule = (minDays: number, maxDays: number, discount: number, excludeId?: string): string | null => {
    if (minDays >= maxDays) {
      return "Min days must be less than max days"
    }
    if (discount < 0 || discount > 100) {
      return "Discount must be between 0 and 100"
    }
    // Check for overlapping ranges
    for (const bucket of discountBuckets) {
      if (excludeId && bucket.id === excludeId) continue
      if ((minDays >= bucket.minDays && minDays <= bucket.maxDays) ||
          (maxDays >= bucket.minDays && maxDays <= bucket.maxDays) ||
          (minDays <= bucket.minDays && maxDays >= bucket.maxDays)) {
        return `Range overlaps with existing rule (${bucket.minDays}-${bucket.maxDays} days)`
      }
    }
    return null
  }

  // Save full discount rule (min_days, max_days, discount_percent)
  const saveDiscountRule = async (id: string, minDays: number, maxDays: number, discount: number) => {
    const error = validateRule(minDays, maxDays, discount, id)
    if (error) {
      setRuleError(error)
      return false
    }
    setRuleError(null)

    const numericId = parseInt(id, 10)
    if (isNaN(numericId)) return false

    const { error: dbError } = await supabase
      .from("car_pricing_tiers")
      .update({ 
        min_days: minDays,
        max_days: maxDays,
        discount_percent: discount 
      })
      .eq("id", numericId)

    if (!dbError) {
      setDiscountBuckets(prev => prev.map(b => 
        b.id === id ? { ...b, minDays, maxDays, discount, label: `${minDays}-${maxDays} days` } : b
      ))
      setEditingBucketId(null)
      return true
    }
    setRuleError("Failed to save to database")
    return false
  }

  // Add new discount rule
  const addNewRule = async () => {
    const error = validateRule(newRule.minDays, newRule.maxDays, newRule.discount)
    if (error) {
      setRuleError(error)
      return
    }
    setRuleError(null)

    const { data, error: dbError } = await supabase
      .from("car_pricing_tiers")
      .insert({
        min_days: newRule.minDays,
        max_days: newRule.maxDays,
        discount_percent: newRule.discount
      })
      .select("*")
      .single()

    if (!dbError && data) {
      const bucketKeys = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
      const newBucket: DiscountBucket = {
        id: String(data.id),
        key: bucketKeys[discountBuckets.length] || String(discountBuckets.length + 1),
        label: `${newRule.minDays}-${newRule.maxDays} days`,
        minDays: newRule.minDays,
        maxDays: newRule.maxDays,
        discount: newRule.discount,
      }
      setDiscountBuckets(prev => [...prev, newBucket].sort((a, b) => a.minDays - b.minDays))
      setIsAddingRule(false)
      setNewRule({ minDays: 1, maxDays: 7, discount: 0 })
    } else {
      setRuleError("Failed to add rule to database")
    }
  }

  // Delete discount rule
  const deleteRule = async (id: string) => {
    const numericId = parseInt(id, 10)
    if (isNaN(numericId)) return

    const { error } = await supabase
      .from("car_pricing_tiers")
      .delete()
      .eq("id", numericId)

    if (!error) {
      setDiscountBuckets(prev => prev.filter(b => b.id !== id))
    }
  }

  // Quick update discount only (for the input field)
  const updateDiscountOnly = async (id: string, newDiscount: number) => {
    const clampedDiscount = Math.min(100, Math.max(0, newDiscount))
    setDiscountBuckets(prev => prev.map(b => b.id === id ? { ...b, discount: clampedDiscount } : b))
    
    const numericId = parseInt(id, 10)
    if (isNaN(numericId)) return

    await supabase
      .from("car_pricing_tiers")
      .update({ discount_percent: clampedDiscount })
      .eq("id", numericId)
  }

  const updateModelPrice = (modelId: string, newPrice: number) => {
    setModelPrices(prev => ({ ...prev, [modelId]: Math.max(0, newPrice) }))
  }

  // Save base_price_usd to all cars with this model_group_id
  const saveModelPrice = async (modelId: string, newPrice: number) => {
    const clampedPrice = Math.max(0, newPrice)
    
    // Update all cars with this model_group_id
    const { error } = await supabase
      .from("cars")
      .update({ base_price_usd: clampedPrice })
      .eq("model_group_id", parseInt(modelId))

    if (!error) {
      setModelPrices(prev => ({ ...prev, [modelId]: clampedPrice }))
      // Update models state as well
      setModels(prev => prev.map(m => 
        m.id === modelId ? { ...m, base_price_usd: clampedPrice } : m
      ))
    }
  }

  const calculateDailyPrice = (baseUsd: number, discountPercent: number, toTry: boolean = false) => {
    const discounted = baseUsd * (1 - discountPercent / 100)
    if (toTry) {
      const usdRate = exchangeRates.find(r => r.code === "USD")?.rate || 1
      return discounted * usdRate
    }
    return discounted
  }

  const calculateTotalPrice = (baseUsd: number, discountPercent: number, minDays: number, maxDays: number, toTry: boolean = false) => {
    const dailyPrice = calculateDailyPrice(baseUsd, discountPercent, toTry)
    const days = minDays
    return dailyPrice * days
  }

  // Convert TRY total to selected currency for display only
  const convertTotalForDisplay = (totalTry: number): { value: number; symbol: string } => {
    const usdRate = exchangeRates.find(r => r.code === "USD")?.rate || 32.5
    const eurRate = exchangeRates.find(r => r.code === "EUR")?.rate || 35.2

    switch (displayCurrency) {
      case "USD":
        return { value: totalTry / usdRate, symbol: "$" }
      case "EUR":
        return { value: totalTry / eurRate, symbol: "€" }
      default:
        return { value: totalTry, symbol: "TL" }
    }
  }

  const filteredModels = models.filter(m => {
    const q = searchQuery.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.brand_name.toLowerCase().includes(q)
  })

  const updateDiscount = (id: string, newDiscount: number) => {
    setDiscountBuckets(prev => prev.map(b => b.id === id ? { ...b, discount: newDiscount } : b))
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen" style={{ backgroundColor: "#F8FAFC" }}>
          <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
          
          {/* Modern Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: BRAND.primary }}>Pricing</h1>
              <p className="text-slate-500 mt-1 text-sm">Manage exchange rates, discounts, and model pricing</p>
            </div>
            <Button 
              onClick={loadData} 
              variant="ghost" 
              size="sm" 
              className="gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* SECTION 1: Exchange Rates - Modern Card Grid */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: BRAND.primary }}>Exchange Rates</h2>
                <p className="text-sm text-slate-500 mt-0.5">Live currency conversion rates to TRY</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <Skeleton className="h-28 w-full rounded-xl" />
                  </div>
                ))
              ) : (
                exchangeRates.filter(r => r.code !== "LYD").map(rate => {
                  const isEditing = editingRateId === rate.id
                  const currencySymbol = rate.code === "USD" ? "$" : rate.code === "EUR" ? "EUR" : rate.code

                  return (
                    <div 
                      key={rate.id} 
                      className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: RATE_COLORS[rate.code] || "#6B7280" }}
                          >
                            {currencySymbol}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{rate.code}</p>
                            <p className="text-xs text-slate-500">to Turkish Lira</p>
                          </div>
                        </div>
                        {/* Hide edit button for investors - they can only view */}
                        {!isEditing && !isInvestor && (
                          <button 
                            onClick={() => { setEditingRateId(rate.id); setTempRate(rate.rate) }} 
                            className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-all"
                          >
                            <Edit2 className="h-4 w-4 text-slate-400" />
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={tempRate}
                            onChange={e => setTempRate(parseFloat(e.target.value) || 0)}
                            className="h-12 text-2xl font-bold rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-0"
                            autoFocus
                          />
                          <button 
                            onClick={() => updateExchangeRate(rate.id, tempRate)} 
                            className="h-12 w-12 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90"
                            style={{ backgroundColor: BRAND.secondary }}
                          >
                            <Save className="h-5 w-5" />
                          </button>
                          <button 
                            onClick={() => setEditingRateId(null)} 
                            className="h-12 w-12 rounded-xl flex items-center justify-center border-2 border-slate-200 hover:bg-slate-50 transition-all"
                          >
                            <X className="h-5 w-5 text-slate-500" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                            {rate.rate.toFixed(2)}
                          </span>
                          <span className="text-lg text-slate-400 font-medium">TL</span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* SECTION 2: Discount Rules - Modern Table Style */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: BRAND.primary }}>Discount Tiers</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {isInvestor ? "View duration-based discount percentages" : "Configure duration-based discount percentages"}
                </p>
              </div>
              {/* Hide Add Tier button for investors */}
              {!isInvestor && (
              <button
                onClick={() => { setIsAddingRule(true); setRuleError(null) }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-all hover:opacity-90"
                style={{ backgroundColor: BRAND.primary }}
              >
                <span className="text-lg leading-none">+</span>
                Add Tier
              </button>
              )}
            </div>

            {/* Error Message */}
            {ruleError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center text-xs">!</span>
                {ruleError}
              </div>
            )}

            {/* Add New Rule Form - Inline Style */}
            {isAddingRule && (
              <div className="mb-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[100px]">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 block">Min Days</label>
                    <Input
                      type="number"
                      value={newRule.minDays}
                      onChange={e => setNewRule(prev => ({ ...prev, minDays: parseInt(e.target.value) || 0 }))}
                      className="h-11 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-0"
                      min={1}
                    />
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 block">Max Days</label>
                    <Input
                      type="number"
                      value={newRule.maxDays}
                      onChange={e => setNewRule(prev => ({ ...prev, maxDays: parseInt(e.target.value) || 0 }))}
                      className="h-11 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-0"
                      min={1}
                    />
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 block">Discount</label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={newRule.discount}
                        onChange={e => setNewRule(prev => ({ ...prev, discount: parseInt(e.target.value) || 0 }))}
                        className="h-11 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-0 pr-8"
                        min={0}
                        max={100}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addNewRule}
                      className="h-11 px-5 rounded-xl text-white font-medium transition-all hover:opacity-90"
                      style={{ backgroundColor: BRAND.secondary }}
                    >
                      Save Tier
                    </button>
                    <button
                      onClick={() => { setIsAddingRule(false); setRuleError(null) }}
                      className="h-11 px-4 rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            ) : discountBuckets.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
                <div className="h-14 w-14 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Percent className="h-7 w-7 text-slate-400" />
                </div>
                <p className="font-medium text-slate-700">No discount tiers yet</p>
                <p className="text-sm text-slate-500 mt-1">Create your first tier to offer duration-based discounts</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <div className="col-span-1">Tier</div>
                  <div className="col-span-3">Duration Range</div>
                  <div className="col-span-5">Discount</div>
                  <div className="col-span-3 text-right">Actions</div>
                </div>
                
                {/* Table Rows */}
                <div className="divide-y divide-slate-100">
                  {discountBuckets.map(bucket => {
                    const isEditing = editingBucketId === bucket.id

                    return (
                      <div key={bucket.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/50 transition-colors">
                        {isEditing ? (
                          /* Edit Mode - Full Row */
                          <>
                            <div className="col-span-1">
                              <span 
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                                style={{ backgroundColor: BRAND.primary }}
                              >
                                {bucket.key}
                              </span>
                            </div>
                            <div className="col-span-3 flex items-center gap-2">
                              <Input
                                type="number"
                                value={tempBucket.minDays}
                                onChange={e => setTempBucket(prev => ({ ...prev, minDays: parseInt(e.target.value) || 0 }))}
                                className="h-9 w-20 rounded-lg border-slate-200 text-center"
                                min={1}
                              />
                              <span className="text-slate-400">to</span>
                              <Input
                                type="number"
                                value={tempBucket.maxDays}
                                onChange={e => setTempBucket(prev => ({ ...prev, maxDays: parseInt(e.target.value) || 0 }))}
                                className="h-9 w-20 rounded-lg border-slate-200 text-center"
                                min={1}
                              />
                              <span className="text-slate-500 text-sm">days</span>
                            </div>
                            <div className="col-span-5">
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={tempBucket.discount}
                                  onChange={e => setTempBucket(prev => ({ ...prev, discount: parseInt(e.target.value) || 0 }))}
                                  className="h-9 w-24 rounded-lg border-slate-200 text-center font-semibold"
                                  min={0}
                                  max={100}
                                />
                                <span className="text-slate-500 font-medium">%</span>
                              </div>
                            </div>
                            <div className="col-span-3 flex justify-end gap-2">
                              <button
                                onClick={() => saveDiscountRule(bucket.id, tempBucket.minDays, tempBucket.maxDays, tempBucket.discount)}
                                className="h-9 px-4 rounded-lg text-white text-sm font-medium transition-all hover:opacity-90"
                                style={{ backgroundColor: BRAND.secondary }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setEditingBucketId(null); setRuleError(null) }}
                                className="h-9 px-3 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </>
                        ) : (
                          /* Display Mode */
                          <>
                            <div className="col-span-1">
                              <span 
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                                style={{ backgroundColor: BRAND.primary }}
                              >
                                {bucket.key}
                              </span>
                            </div>
                            <div className="col-span-3">
                              <span className="text-slate-900 font-medium">{bucket.minDays} - {bucket.maxDays}</span>
                              <span className="text-slate-500 ml-1">days</span>
                            </div>
                            <div className="col-span-5">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    type="number"
                                    value={bucket.discount}
                                    onChange={e => updateDiscountOnly(bucket.id, parseInt(e.target.value) || 0)}
                                    className="h-10 w-20 text-center font-bold text-lg rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-0"
                                    min={0}
                                    max={100}
                                  />
                                  <span className="text-lg font-semibold" style={{ color: BRAND.accent }}>%</span>
                                </div>
                                {bucket.discount > 0 && (
                                  <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg font-medium">
                                    Save {bucket.discount}%
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Hide edit/delete buttons for investors */}
                            {!isInvestor && (
                            <div className="col-span-3 flex justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingBucketId(bucket.id)
                                  setTempBucket({ minDays: bucket.minDays, maxDays: bucket.maxDays, discount: bucket.discount })
                                  setRuleError(null)
                                }}
                                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-all"
                              >
                                <Edit2 className="h-4 w-4 text-slate-400" />
                              </button>
                              <button
                                onClick={() => deleteRule(bucket.id)}
                                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 transition-all"
                              >
                                <X className="h-4 w-4 text-red-400" />
                              </button>
                            </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          {/* SECTION 3: Model Pricing */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: BRAND.primary }}>Model Pricing</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  View pricing breakdown by model and duration
                  {displayCurrency !== "TRY" && (
                    <span className="ml-2 text-blue-600">Converting to {displayCurrency}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Modern Segmented Currency Selector */}
                <div className="relative flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
                  {(["TRY", "USD", "EUR"] as const).map(currency => (
                    <button
                      key={currency}
                      onClick={() => setDisplayCurrency(currency)}
                      className={`relative px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                        displayCurrency === currency
                          ? "text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                      style={displayCurrency === currency ? { backgroundColor: BRAND.primary } : {}}
                    >
                      {currency === "TRY" && "TL"}
                      {currency === "USD" && "$"}
                      {currency === "EUR" && "EUR"}
                    </button>
                  ))}
                </div>
                {/* Modern Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search models..." 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                    className="pl-11 h-11 bg-white border-0 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
                </div>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
                <div className="h-14 w-14 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Car className="h-7 w-7 text-slate-400" />
                </div>
                <p className="font-medium text-slate-700">No models found</p>
                <p className="text-sm text-slate-500 mt-1">Add car models in the Cars page first</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredModels.map(model => {
                  const basePrice = modelPrices[model.id] || 50
                  return (
                    <div 
                      key={model.id} 
                      className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all duration-300 overflow-hidden"
                    >
                      {/* Model Header */}
                      <div className="flex items-center justify-between p-5 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                          {model.thumbnail_url ? (
                            <img 
                              src={model.thumbnail_url || "/placeholder.svg"} 
                              alt={model.name} 
                              className="w-16 h-12 object-cover rounded-xl"
                            />
                          ) : (
                            <div className="w-16 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                              <Car className="h-5 w-5 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-900">{model.name}</p>
                            <p className="text-sm text-slate-500">{model.brand_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {model.car_count} units
                          </span>
                          <div className="flex items-baseline gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl">
                            <span className="text-lg font-bold text-emerald-700">${basePrice}</span>
                            <span className="text-xs text-emerald-600">/day</span>
                          </div>
                        </div>
                      </div>

                      {/* Duration Cards - Horizontal Scroll */}
                      <div className="p-5 bg-slate-50/50">
                        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                          {discountBuckets.map(b => {
                            const dailyTry = calculateDailyPrice(basePrice, b.discount, true)
                            const totalTry = calculateTotalPrice(basePrice, b.discount, b.minDays, b.maxDays, true)
                            
                            return (
                              <div 
                                key={b.id} 
                                className="flex-shrink-0 w-40 bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
                              >
                                {/* Duration Label */}
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-xs font-medium text-slate-600">{b.label}</span>
                                  {b.discount > 0 && (
                                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                      -{b.discount}%
                                    </span>
                                  )}
                                </div>

                                {/* TOTAL PRICE */}
                                <div className="mb-2">
                                  {(() => {
                                    const converted = convertTotalForDisplay(totalTry)
                                    return (
                                      <p className="text-xl font-bold tracking-tight" style={{ color: BRAND.primary }}>
                                        {converted.symbol}{converted.value.toLocaleString(displayCurrency === "TRY" ? "tr-TR" : "en-US", { maximumFractionDigits: 0 })}
                                      </p>
                                    )
                                  })()}
                                  <p className="text-xs text-slate-400">Total for {b.minDays} days</p>
                                </div>

                                {/* Per Day */}
                                <div className="pt-2 border-t border-slate-100">
                                  <span className="text-sm font-medium text-slate-600">
                                    {dailyTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
                                  </span>
                                  <span className="text-xs text-slate-400"> / day</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Info Note - Subtle */}
          <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 rounded-xl border border-slate-100">
            <Info className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-600">Formula:</span> final_price = base_price_usd × (1 - discount_percent / 100)
            </p>
          </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingPageContent />
    </Suspense>
  )
}
