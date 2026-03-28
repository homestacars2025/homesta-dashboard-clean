"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  Plus,
  CalendarIcon,
  FileSpreadsheet,
  ArrowUpDown,
  Tag,
  DollarSign,
  FileText,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { useAuth } from "@/lib/auth-context"

const FIXED_SHEETS = ["Company Expenses", "Personal Expenses", "Buy & Sell"]

const getCategoryOptions = (sheetName: string, direction: "IN" | "OUT" | ""): string[] => {
  if (!direction) return []

  if (sheetName === "Personal Expenses") {
    return ["Other"]
  }

  if (sheetName === "Buy & Sell") {
    if (direction === "IN") {
      return ["Deposit", "Car Sale", "Other"]
    } else {
      return ["Car Purchase", "NOTER", "Sigorta", "Kasko", "Other"]
    }
  }

  if (sheetName === "Company Expenses") {
    if (direction === "IN") {
      return ["Other"]
    } else {
      return ["MTV", "MÜŞAVİR MALİ", "Rent", "Other"]
    }
  }

  if (!FIXED_SHEETS.includes(sheetName) && sheetName !== "") {
    if (direction === "IN") {
      return ["Rent Collection", "Other"]
    } else {
      return ["Petrol", "Oil", "Wash", "Maintenance", "Other"]
    }
  }

  return []
}

const isValidCategory = (sheetName: string, direction: "IN" | "OUT", category: string): boolean => {
  const validOptions = getCategoryOptions(sheetName, direction)
  return validOptions.includes(category)
}

type CarSheet = {
  id: number
  name: string
  investor_id: string | null
}

export default function AddTransactionPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, isLoading: authLoading, initialAuthChecked } = useAuth()

  // Keep the last confirmed admin role so the form does not flash away if
  // user briefly becomes null during a Supabase token refresh cycle on tab focus.
  const confirmedAdminRef = useRef(false)
  if (user?.role === "admin") confirmedAdminRef.current = true

  const [selectedSheet, setSelectedSheet] = useState<string>("")
  const [carSheets, setCarSheets] = useState<CarSheet[]>([])
  const [loadingCars, setLoadingCars] = useState(true)
  const [direction, setDirection] = useState<"IN" | "OUT" | "">("")
  const [amount, setAmount] = useState<string>("")
  const [date, setDate] = useState<Date | null>(null)
  const [description, setDescription] = useState<string>("")
  const [category, setCategory] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const categoryOptions = useMemo(() => getCategoryOptions(selectedSheet, direction), [selectedSheet, direction])

  // Redirect non-admins away — only fires when auth has fully resolved
  // and we have never confirmed this session as admin.
  useEffect(() => {
    if (!initialAuthChecked || authLoading) return
    if (user?.role !== "admin" && !confirmedAdminRef.current) {
      router.replace("/general")
    }
  }, [user, authLoading, initialAuthChecked, router])

  useEffect(() => {
    setCategory("")
  }, [selectedSheet, direction])

  // Load ALL cars for admin — no investor filtering.
  // Stable useCallback with no dependencies: never recreated, effect runs once.
  const loadCarSheets = useCallback(async () => {
    setLoadingCars(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await (supabase as any)
        .from("cars")
        .select("id, plate_number, investor_id, model_group:model_group_id(name)")
        .order("plate_number", { ascending: true })

      if (error) {
        console.error("[loadCarSheets] failed to load cars:", error)
        return
      }

      setCarSheets(
        (data || []).map((car: any) => ({
          id: car.id,
          investor_id: car.investor_id ?? null,
          name: `${car.plate_number || "NO PLATE"} - ${car.model_group?.name || "Unknown"}`,
        })),
      )
    } catch (error) {
      console.error("[loadCarSheets] exception:", error)
    } finally {
      setLoadingCars(false)
    }
  }, [])

  useEffect(() => {
    loadCarSheets()
  }, [loadCarSheets])

  // Reload on tab focus — loadCarSheets is stable, so this never re-attaches
  useEffect(() => {
    const handleFocus = () => {
      console.log("TAB FOCUSED - REFETCHING")
      loadCarSheets()
    }

    window.addEventListener("focus", handleFocus)
    return () => {
      window.removeEventListener("focus", handleFocus)
    }
  }, [loadCarSheets])

  const isFormValid = useMemo(() => {
    const hasCategory = !!category || categoryOptions.length === 1 || categoryOptions.length === 0
    return (
      !!selectedSheet &&
      !!direction &&
      !!amount &&
      Number.parseFloat(amount) > 0 &&
      !!date &&
      hasCategory
    )
  }, [selectedSheet, direction, amount, date, category, categoryOptions.length])

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return

    if (!selectedSheet) {
      toast({
        title: "Validation Error",
        description: "Please select a sheet.",
        variant: "destructive",
      })
      return
    }

    if (!isFormValid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    const finalCategory = category || (categoryOptions.length === 1 ? categoryOptions[0] : "Other")
    if (!isValidCategory(selectedSheet, direction as "IN" | "OUT", finalCategory)) {
      toast({
        title: "Validation Error",
        description: "Invalid category for selected sheet and direction.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) {
        throw new Error("Database connection not available")
      }

      let finalSheetType = ""
      let finalCarId: number | null = null
      let finalInvestorId: string | null = null

      if (selectedSheet === "Company Expenses") {
        finalSheetType = "company_expenses"
      } else if (selectedSheet === "Personal Expenses") {
        finalSheetType = "personal_expenses"
      } else if (selectedSheet === "Buy & Sell") {
        finalSheetType = "buy_sell"
      } else {
        finalSheetType = "car"
        const car = carSheets.find((c) => c.name === selectedSheet)
        finalCarId = car?.id ?? null
        finalInvestorId = car?.investor_id ?? null
      }

      const transactionDate = format(date!, "yyyy-MM-dd")
      const monthKey = transactionDate.substring(0, 7)

      const row1Payload = {
        investor_id: finalInvestorId,
        month_key: monthKey,
        sheet_type: finalSheetType,
        car_id: finalCarId,
        direction: direction,
        amount: Number.parseFloat(amount),
        date: transactionDate,
        note: description || `${selectedSheet}`,
        category: finalCategory,
      }

      const { error: row1Error } = await (supabase as any)
        .from("financial_transactions")
        .insert([row1Payload])
        .select("*")

      if (row1Error) {
        throw new Error(`Failed to create transaction: ${row1Error.message}`)
      }

      // Create commission row for Rent Collection
      if (finalCategory === "Rent Collection" && direction === "IN" && finalSheetType === "car") {
        const commissionAmount = Number.parseFloat(amount) * 0.25

        const row2Payload = {
          investor_id: finalInvestorId,
          month_key: monthKey,
          sheet_type: finalSheetType,
          car_id: finalCarId,
          direction: "OUT",
          amount: commissionAmount,
          date: transactionDate,
          note: "Homesta COM",
          category: "Commission",
        }

        const { error: row2Error } = await (supabase as any)
          .from("financial_transactions")
          .insert([row2Payload])
          .select("*")

        if (row2Error) {
          throw new Error(`Failed to create commission transaction: ${row2Error.message}`)
        }

        toast({
          title: "Success",
          description: "Rent collection and commission (25%) created successfully.",
        })
      } else {
        toast({
          title: "Success",
          description: "Transaction created successfully.",
        })
      }

      // Reset form
      setSelectedSheet("")
      setDirection("")
      setAmount("")
      setDate(null)
      setDescription("")
      setCategory("")

      router.push("/accounting")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create transaction.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    isSubmitting,
    selectedSheet,
    direction,
    amount,
    date,
    description,
    category,
    categoryOptions,
    carSheets,
    isFormValid,
    toast,
    router,
  ])

  if (authLoading || !initialAuthChecked || loadingCars) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#4AA3FF] mx-auto" />
          <p className="mt-4 text-slate-500 font-medium">Loading form...</p>
        </div>
      </div>
    )
  }

  // Use the ref as a fallback: if user is briefly null during a token refresh
  // cycle, keep rendering the form rather than blanking it.
  if (user?.role !== "admin" && !confirmedAdminRef.current) {
    return null
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-slate-50/50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">New Transaction</h1>
            <p className="text-slate-500 text-sm mt-1">Fill in the details to create a new financial record</p>
          </div>
          <Button
            variant="ghost"
            onClick={() => router.push("/accounting")}
            className="text-slate-600 hover:text-slate-800 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Main Form Card */}
        <Card className="border-0 shadow-lg shadow-slate-200/50 rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            {/* Section 1: Sheet Selection */}
            <div className="p-6 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5">Account Selection</h3>

              <div className="space-y-5">
                {/* Sheet Selection */}
                <div className="space-y-2">
                  <Label htmlFor="sheet" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-[#4AA3FF]" />
                    Target Sheet
                    <span className="text-red-400 text-xs">*</span>
                  </Label>
                  <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                    <SelectTrigger
                      id="sheet"
                      className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4AA3FF]/20 focus:border-[#4AA3FF] transition-all"
                    >
                      <SelectValue placeholder="Select target sheet..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Fixed Sheets
                      </div>
                      {FIXED_SHEETS.map((sheet) => (
                        <SelectItem key={sheet} value={sheet} className="rounded-lg">
                          {sheet}
                        </SelectItem>
                      ))}
                      {carSheets.length > 0 && (
                        <>
                          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2 border-t border-slate-100 pt-3">
                            Car Sheets
                          </div>
                          {carSheets.map((car) => (
                            <SelectItem key={car.id} value={car.name} className="rounded-lg">
                              {car.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section 2: Transaction Details */}
            <div className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-5">
                Transaction Details
              </h3>

              {/* Direction & Category Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Direction Field */}
                <div className="space-y-2">
                  <Label htmlFor="direction" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4 text-[#4AA3FF]" />
                    Direction
                    <span className="text-red-400 text-xs">*</span>
                  </Label>
                  <Select value={direction} onValueChange={(val) => setDirection(val as "IN" | "OUT")}>
                    <SelectTrigger
                      id="direction"
                      className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4AA3FF]/20 focus:border-[#4AA3FF] transition-all"
                    >
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="IN" className="rounded-lg">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          IN (Income)
                        </span>
                      </SelectItem>
                      <SelectItem value="OUT" className="rounded-lg">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          OUT (Expense)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category Field */}
                {selectedSheet && direction && categoryOptions.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Tag className="h-4 w-4 text-[#4AA3FF]" />
                      Category
                      <span className="text-red-400 text-xs">*</span>
                    </Label>
                    <Select
                      value={category}
                      onValueChange={setCategory}
                      defaultValue={categoryOptions.length === 1 ? categoryOptions[0] : undefined}
                    >
                      <SelectTrigger
                        id="category"
                        className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4AA3FF]/20 focus:border-[#4AA3FF] transition-all"
                      >
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {categoryOptions.map((cat) => (
                          <SelectItem key={cat} value={cat} className="rounded-lg">
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Commission Info Banner */}
              {category === "Rent Collection" && direction === "IN" && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 text-sm font-bold">%</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Auto Commission</p>
                    <p className="text-xs text-blue-600 mt-0.5">A 25% commission (OUT) will be automatically created</p>
                  </div>
                </div>
              )}

              {/* Amount & Date Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Amount Field */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-[#4AA3FF]" />
                    Amount (TRY)
                    <span className="text-red-400 text-xs">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4AA3FF]/20 focus:border-[#4AA3FF] transition-all pl-4 pr-12"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                      TRY
                    </span>
                  </div>
                </div>

                {/* Date Field */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-[#4AA3FF]" />
                    Date
                    <span className="text-red-400 text-xs">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-12 w-full justify-start text-left font-normal bg-white border-slate-200 rounded-xl hover:bg-slate-50 focus:ring-2 focus:ring-[#4AA3FF]/20 focus:border-[#4AA3FF] transition-all",
                          !date && "text-slate-400",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                        {date ? format(date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                      <Calendar mode="single" selected={date || undefined} onSelect={(d) => setDate(d || null)} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Notes Field */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#4AA3FF]" />
                  Notes
                  <span className="text-slate-400 text-xs font-normal">(Optional)</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Add any additional details about this transaction..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[100px] bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4AA3FF]/20 focus:border-[#4AA3FF] transition-all resize-none"
                />
              </div>
            </div>

            {/* Submit Section */}
            <div className="p-6 bg-gradient-to-br from-slate-50 to-white border-t border-slate-100">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!isFormValid || isSubmitting}
                className={cn(
                  "w-full h-14 text-base font-semibold rounded-xl transition-all duration-200",
                  isFormValid && !isSubmitting
                    ? "bg-[#4AA3FF] hover:bg-[#3A8FE0] active:bg-[#2F7AC2] text-white shadow-lg shadow-[#4AA3FF]/25 hover:shadow-xl hover:shadow-[#4AA3FF]/30"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed",
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Transaction...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-5 w-5" />
                    Create Transaction
                  </>
                )}
              </Button>

              {/* Form validation hint */}
              {!isFormValid && (
                <p className="text-center text-xs text-slate-400 mt-3">
                  Please fill in all required fields to enable submission
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
