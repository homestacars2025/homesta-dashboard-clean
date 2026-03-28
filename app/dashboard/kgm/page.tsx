"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { ChevronLeft, ChevronRight, Receipt, Loader2, Search, Check } from "lucide-react"

type Car = {
  id: string
  plate_number: string
  model_name: string
}

type KGMEntry = {
  id: number
  car_id: string
  plate_number: string
  date: string
  toll_amount: number
  note: string | null
  created_by: string | null
  created_by_name?: string
}

type InlineRow = {
  car_id: string
  plate_number: string
  model_name: string
  toll_amount: string
  note: string
  isSaving: boolean
  savedFeedback: boolean
}

type SearchResult = {
  date: string
  toll_amount: number
  note: string | null
  created_by_name: string
}

export default function KGMPage() {
  const { toast } = useToast()
  
  // Date state
  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth())
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  
  // Data state
  const [cars, setCars] = useState<Car[]>([])
  const [dayEntries, setDayEntries] = useState<KGMEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Inline editing state
  const [inlineRows, setInlineRows] = useState<InlineRow[]>([])
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  
  // Search Modal
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [searchCarId, setSearchCarId] = useState("")
  const [searchStartDate, setSearchStartDate] = useState("")
  const [searchEndDate, setSearchEndDate] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Get the selected date as YYYY-MM-DD string
  const getSelectedDateString = useCallback(() => {
    const year = selectedYear
    const month = String(selectedMonth + 1).padStart(2, "0")
    const day = String(selectedDay).padStart(2, "0")
    return `${year}-${month}-${day}`
  }, [selectedYear, selectedMonth, selectedDay])

  // Get days in the selected month
  const getDaysInMonth = () => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate()
  }

  // Format display date
  const formatDisplayDate = () => {
    const date = new Date(selectedYear, selectedMonth, selectedDay)
    return date.toLocaleDateString("en-US", { 
      weekday: "long", 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    })
  }

  // Load cars sorted by model_name then plate_number
  const loadCars = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    
    const { data, error } = await supabase
      .from("cars")
      .select(`
        id,
        plate_number,
        model_group(name)
      `)

    if (error) {
      console.error("Error loading cars:", error)
      return
    }

    // Map and sort by model_name then plate_number
    const mapped = (data || []).map((car: any) => ({
      id: car.id,
      plate_number: car.plate_number,
      model_name: car.model_group?.name || "Unknown"
    }))

    mapped.sort((a, b) => {
      const modelCompare = a.model_name.localeCompare(b.model_name)
      if (modelCompare !== 0) return modelCompare
      return a.plate_number.localeCompare(b.plate_number)
    })

    setCars(mapped)
  }, [])

  // Load KGM entries for the selected date with created_by name
  const loadDayData = useCallback(async () => {
    if (cars.length === 0) return

    setIsLoading(true)
    const supabase = getSupabaseBrowserClient()
    const dateStr = getSelectedDateString()

    const { data: entries, error } = await supabase
      .from("kgm")
      .select("id, car_id, plate_number, date, toll_amount, note, created_by")
      .eq("date", dateStr)

    if (error) {
      console.error("Error loading KGM data:", error)
      setIsLoading(false)
      return
    }

    // Fetch created_by names
    const creatorIds = [...new Set((entries || []).map((e: any) => e.created_by).filter(Boolean))]
    let profilesMap: Record<string, string> = {}

    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", creatorIds)

      if (profiles) {
        profilesMap = profiles.reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.full_name || "Unknown"
          return acc
        }, {})
      }
    }

    // Map entries with creator names
    const mappedEntries: KGMEntry[] = (entries || []).map((e: any) => ({
      ...e,
      created_by_name: e.created_by ? profilesMap[e.created_by] || "Unknown" : "-"
    }))

    setDayEntries(mappedEntries)
    
    // Initialize inline rows
    const rows: InlineRow[] = cars.map((car) => {
      const existing = mappedEntries.find((e) => e.car_id === car.id)
      return {
        car_id: car.id,
        plate_number: car.plate_number,
        model_name: car.model_name,
        toll_amount: existing ? existing.toll_amount.toString() : "",
        note: existing?.note || "",
        isSaving: false,
        savedFeedback: false
      }
    })
    
    setInlineRows(rows)
    setIsLoading(false)
  }, [cars, getSelectedDateString])

  // Initial load
  useEffect(() => {
    loadCars()
  }, [loadCars])

  // Load day data when cars or date changes
  useEffect(() => {
    if (cars.length > 0) {
      loadDayData()
    }
  }, [cars, selectedYear, selectedMonth, selectedDay, loadDayData])

  // Navigate to previous day
  const goToPreviousDay = () => {
    const current = new Date(selectedYear, selectedMonth, selectedDay)
    current.setDate(current.getDate() - 1)
    setSelectedYear(current.getFullYear())
    setSelectedMonth(current.getMonth())
    setSelectedDay(current.getDate())
  }

  // Navigate to next day
  const goToNextDay = () => {
    const current = new Date(selectedYear, selectedMonth, selectedDay)
    current.setDate(current.getDate() + 1)
    setSelectedYear(current.getFullYear())
    setSelectedMonth(current.getMonth())
    setSelectedDay(current.getDate())
  }

  // Update inline row value
  const updateInlineRow = (carId: string, field: "toll_amount" | "note", value: string) => {
    setInlineRows((prev) =>
      prev.map((row) =>
        row.car_id === carId ? { ...row, [field]: value } : row
      )
    )
  }

  // Save single row on blur or Enter
  const saveRow = async (carId: string) => {
    const row = inlineRows.find((r) => r.car_id === carId)
    if (!row) return

    // Skip if nothing to save
    const hasAmount = row.toll_amount.trim() !== ""
    const hasNote = row.note.trim() !== ""
    if (!hasAmount && !hasNote) return

    // Set saving state
    setInlineRows((prev) =>
      prev.map((r) => (r.car_id === carId ? { ...r, isSaving: true } : r))
    )

    try {
      const dateStr = getSelectedDateString()
      const entry = {
        car_id: row.car_id,
        plate_number: row.plate_number,
        date: dateStr,
        toll_amount: parseFloat(row.toll_amount) || 0,
        note: row.note.trim() || null,
      }

      // Call API to save single entry
      const response = await fetch("/api/kgm/save-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to save")
      }

      // Show saved feedback
      setInlineRows((prev) =>
        prev.map((r) =>
          r.car_id === carId ? { ...r, isSaving: false, savedFeedback: true } : r
        )
      )

      // Hide feedback after 2 seconds
      setTimeout(() => {
        setInlineRows((prev) =>
          prev.map((r) =>
            r.car_id === carId ? { ...r, savedFeedback: false } : r
          )
        )
      }, 2000)

      // Refresh day entries for accurate totals
      loadDayData()
    } catch (error: any) {
      console.error("Save error:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to save entry.",
        variant: "destructive",
      })
      setInlineRows((prev) =>
        prev.map((r) => (r.car_id === carId ? { ...r, isSaving: false } : r))
      )
    }
  }

  // Handle key down for Enter to save
  const handleKeyDown = (e: React.KeyboardEvent, carId: string) => {
    if (e.key === "Enter") {
      e.preventDefault()
      saveRow(carId)
      ;(e.target as HTMLInputElement).blur()
    }
  }

  // Handle search
  const handleSearch = async () => {
    if (!searchCarId || !searchStartDate || !searchEndDate) {
      toast({
        title: "Validation Error",
        description: "Please select a car and date range.",
        variant: "destructive",
      })
      return
    }

    setIsSearching(true)
    setHasSearched(true)
    const supabase = getSupabaseBrowserClient()

    try {
      const { data, error } = await supabase
        .from("kgm")
        .select("date, toll_amount, note, created_by")
        .eq("car_id", searchCarId)
        .gte("date", searchStartDate)
        .lte("date", searchEndDate)
        .order("date", { ascending: false })

      if (error) throw error

      // Get creator names
      const creatorIds = [...new Set((data || []).map((e: any) => e.created_by).filter(Boolean))]
      let profilesMap: Record<string, string> = {}

      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", creatorIds)

        if (profiles) {
          profilesMap = profiles.reduce((acc: Record<string, string>, p: any) => {
            acc[p.id] = p.full_name || "Unknown"
            return acc
          }, {})
        }
      }

      const results: SearchResult[] = (data || []).map((e: any) => ({
        date: e.date,
        toll_amount: e.toll_amount,
        note: e.note,
        created_by_name: e.created_by ? profilesMap[e.created_by] || "Unknown" : "-"
      }))

      const total = results.reduce((sum, r) => sum + (r.toll_amount || 0), 0)

      setSearchResults(results)
      setSearchTotal(total)
    } catch (error: any) {
      console.error("Search error:", error)
      toast({
        title: "Error",
        description: "Failed to search records.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  // Calculate total for the day
  const dayTotal = dayEntries.reduce((sum, entry) => sum + (entry.toll_amount || 0), 0)

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i)

  return (
    <ProtectedRoute allowedRoles={["admin", "staff"]}>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#4ba6ea]/10 rounded-lg">
                <Receipt className="h-6 w-6 text-[#4ba6ea]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">KGM Tolls Tracking</h1>
                <p className="text-sm text-slate-500">Daily toll tracking - click to edit, auto-saves</p>
              </div>
            </div>
            <Button 
              variant="outline"
              onClick={() => {
                setSearchCarId("")
                setSearchStartDate("")
                setSearchEndDate("")
                setSearchResults([])
                setSearchTotal(0)
                setHasSearched(false)
                setIsSearchModalOpen(true)
              }}
            >
              <Search className="h-4 w-4 mr-2" />
              Search Records
            </Button>
          </div>

          {/* Date Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                {/* Month/Year Selectors */}
                <div className="flex items-center gap-3">
                  <Select 
                    value={selectedMonth.toString()} 
                    onValueChange={(v) => {
                      setSelectedMonth(parseInt(v))
                      const daysInNewMonth = new Date(selectedYear, parseInt(v) + 1, 0).getDate()
                      if (selectedDay > daysInNewMonth) {
                        setSelectedDay(daysInNewMonth)
                      }
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select 
                    value={selectedYear.toString()} 
                    onValueChange={(v) => setSelectedYear(parseInt(v))}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Day Navigation */}
                <div className="flex items-center gap-4">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={goToPreviousDay}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="text-center min-w-[280px]">
                    <p className="text-lg font-semibold text-slate-800">{formatDisplayDate()}</p>
                  </div>

                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={goToNextDay}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Day Selector */}
                <Select 
                  value={selectedDay.toString()} 
                  onValueChange={(v) => setSelectedDay(parseInt(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: getDaysInMonth() }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        Day {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card className="bg-[#4ba6ea]/5 border-[#4ba6ea]/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total for Selected Day</p>
                  <p className="text-3xl font-bold text-[#4ba6ea]">
                    {dayTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TRY
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">
                    {dayEntries.length} / {cars.length} cars with entries
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inline Editable Table - Spreadsheet Style */}
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#4ba6ea]" />
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80">
                        <TableHead className="w-[150px] text-[15px] font-semibold py-4">Plate Number</TableHead>
                        <TableHead className="w-[180px] text-[15px] font-semibold py-4">Model</TableHead>
                        <TableHead className="w-[160px] text-[15px] font-semibold py-4">Amount (TRY)</TableHead>
                        <TableHead className="min-w-[300px] text-[15px] font-semibold py-4">Note</TableHead>
                        <TableHead className="w-[100px] text-[15px] font-semibold py-4 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inlineRows.map((row) => (
                        <TableRow 
                          key={row.car_id} 
                          className={`
                            transition-all duration-150
                            hover:bg-slate-50/70
                            ${editingRowId === row.car_id ? "bg-blue-50/50 ring-1 ring-inset ring-blue-200" : ""}
                          `}
                        >
                          <TableCell className="font-mono text-[15px] font-medium py-4">
                            {row.plate_number}
                          </TableCell>
                          <TableCell className="text-[15px] text-slate-600 py-4">
                            {row.model_name}
                          </TableCell>
                          <TableCell className="py-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={row.toll_amount}
                              onChange={(e) => updateInlineRow(row.car_id, "toll_amount", e.target.value)}
                              onFocus={() => setEditingRowId(row.car_id)}
                              onBlur={() => {
                                setEditingRowId(null)
                                saveRow(row.car_id)
                              }}
                              onKeyDown={(e) => handleKeyDown(e, row.car_id)}
                              className="w-[130px] text-[15px] h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                            />
                          </TableCell>
                          <TableCell className="py-3">
                            <Input
                              type="text"
                              placeholder="Enter note..."
                              value={row.note}
                              onChange={(e) => updateInlineRow(row.car_id, "note", e.target.value)}
                              onFocus={() => setEditingRowId(row.car_id)}
                              onBlur={() => {
                                setEditingRowId(null)
                                saveRow(row.car_id)
                              }}
                              onKeyDown={(e) => handleKeyDown(e, row.car_id)}
                              className="w-full text-[15px] h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                            />
                          </TableCell>
                          <TableCell className="py-3 text-center">
                            {row.isSaving ? (
                              <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
                            ) : row.savedFeedback ? (
                              <div className="flex items-center justify-center gap-1 text-green-600">
                                <Check className="h-4 w-4" />
                                <span className="text-sm font-medium">Saved</span>
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {inlineRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-slate-500 text-[15px]">
                            No cars found. Add cars to the system first.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search Modal */}
          <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
            <DialogContent className="max-w-5xl w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-xl">Search Toll Records</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-5 flex-1 overflow-hidden flex flex-col">
                {/* Search Form - 4 column layout */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pb-4 border-b">
                  <div className="space-y-2">
                    <Label className="font-medium">Plate Number</Label>
                    <Select value={searchCarId} onValueChange={setSearchCarId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a car" />
                      </SelectTrigger>
                      <SelectContent>
                        {cars.map((car) => (
                          <SelectItem key={car.id} value={car.id}>
                            {car.plate_number} - {car.model_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">Start Date</Label>
                    <Input
                      type="date"
                      value={searchStartDate}
                      onChange={(e) => setSearchStartDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">End Date</Label>
                    <Input
                      type="date"
                      value={searchEndDate}
                      onChange={(e) => setSearchEndDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Button 
                    onClick={handleSearch} 
                    disabled={isSearching}
                    className="bg-[#4ba6ea] hover:bg-[#3a8fd4] h-10"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </>
                    )}
                  </Button>
                </div>

                {/* Search Results */}
                {hasSearched && (
                  <div className="flex-1 overflow-auto space-y-4">
                    {/* Total */}
                    <Card className="bg-[#4ba6ea]/5 border-[#4ba6ea]/20">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-600">Total for Selected Period</p>
                          <p className="text-2xl font-bold text-[#4ba6ea]">
                            {searchTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TRY
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Results Table */}
                    {searchResults.length > 0 ? (
                      <div className="border rounded-lg shadow-sm overflow-auto max-h-[350px]">
                        <Table>
                          <TableHeader className="sticky top-0 bg-slate-50">
                            <TableRow>
                              <TableHead className="w-[140px] py-3 text-[15px]">Date</TableHead>
                              <TableHead className="w-[130px] text-right py-3 text-[15px]">Amount (TRY)</TableHead>
                              <TableHead className="min-w-[250px] py-3 text-[15px]">Note</TableHead>
                              <TableHead className="w-[150px] py-3 text-[15px]">Created By</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {searchResults.map((result, idx) => (
                              <TableRow key={idx} className="hover:bg-slate-50/70">
                                <TableCell className="py-3 text-[15px]">{new Date(result.date).toLocaleDateString("en-US")}</TableCell>
                                <TableCell className="text-right font-medium tabular-nums py-3 text-[15px]">
                                  {result.toll_amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-slate-600 py-3 max-w-[350px] truncate text-[15px]">{result.note || "-"}</TableCell>
                                <TableCell className="text-slate-600 py-3 text-[15px]">{result.created_by_name}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-slate-500 border rounded-lg bg-slate-50/50 text-[15px]">
                        No records found for the selected criteria.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSearchModalOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
