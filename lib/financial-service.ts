import { getSupabaseBrowserClient } from "./supabase-client"

export async function getInvestors() {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("investors")
    .select("id, company_name")
    .eq("is_active", true)
    .order("company_name")

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[v0] Failed to load investors:", error)
    }
    return []
  }

  return (data || []).map((investor) => ({
    id: String(investor.id),
    name: investor.company_name || "Unknown",
  }))
}

export async function getAvailableMonths() {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("financial_transactions")
    .select("month_key")
    .order("month_key", { ascending: false })

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[v0] Failed to load months:", error)
    }
    return []
  }

  // Get distinct months
  const uniqueMonths = [...new Set(data?.map((row) => row.month_key) || [])]
  return uniqueMonths
}

export async function getFinancialTransactions(investorId: string, dateFrom: string, dateTo: string) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("investor_id", investorId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: false })

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[v0] Failed to load transactions:", error)
    }
    return []
  }

  return data || []
}

export async function getFinancialSummary(investorId: string, dateFrom: string, dateTo: string) {
  if (process.env.NODE_ENV === "development") {
    console.log("[v0] getFinancialSummary called with:", { investorId, dateFrom, dateTo })
  }

  const transactions = await getFinancialTransactions(investorId, dateFrom, dateTo)

  if (process.env.NODE_ENV === "development") {
    console.log("[v0] Transactions retrieved:", transactions.length, "records")
    console.log("[v0] Sample transaction:", transactions[0])
  }

  const carIncome = transactions
    .filter((t) => t.sheet_type === "car" && t.direction === "IN")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Total Cars Rent Income = sum of Total Balance of ALL car rental sheets ONLY.
  // Total Balance per car sheet = IN - OUT. Excludes personal_expenses,
  // company_expenses, and buy_sell sheets.
  const carSheetIn = transactions
    .filter((t) => t.sheet_type === "car" && t.direction === "IN")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const carSheetOut = transactions
    .filter((t) => t.sheet_type === "car" && t.direction === "OUT")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const totalCarsRentIncome = carSheetIn - carSheetOut

  const buySell = transactions
    .filter((t) => t.sheet_type === "buy_sell")
    .reduce((sum, t) => sum + (t.direction === "IN" ? Number(t.amount) : -Number(t.amount)), 0)

  const companyExpenses = transactions
    .filter((t) => t.sheet_type === "company_expenses" && t.direction === "OUT")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const personalExpenses = transactions
    .filter((t) => t.sheet_type === "personal_expenses" && t.direction === "OUT")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalIncome = transactions.filter((t) => t.direction === "IN").reduce((sum, t) => sum + Number(t.amount), 0)

  const totalExpenses = transactions.filter((t) => t.direction === "OUT").reduce((sum, t) => sum + Number(t.amount), 0)

  const petrolExpenses = transactions
    .filter((t) => t.direction === "OUT" && t.category?.toLowerCase() === "petrol")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const oilExpenses = transactions
    .filter((t) => t.direction === "OUT" && t.category?.toLowerCase() === "oil")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const washingExpenses = transactions
    .filter(
      (t) => t.direction === "OUT" && (t.category?.toLowerCase() === "washing" || t.category?.toLowerCase() === "wash"),
    )
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const maintenanceExpenses = transactions
    .filter((t) => t.direction === "OUT" && t.category?.toLowerCase() === "maintenance")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const summary = {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    carIncome,
    totalCarsRentIncome,
    buySell,
    companyExpenses,
    personalExpenses,
    petrolExpenses,
    oilExpenses,
    washingExpenses,
    maintenanceExpenses,
    maintenance: maintenanceExpenses,
    fuel: petrolExpenses,
    oilChange: oilExpenses,
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[v0] Calculated summary:", summary)
  }

  return summary
}

export async function getCarsForInvestor(investorId: string) {
  const supabase = getSupabaseBrowserClient()

  console.log("[getCarsForInvestor] called with investorId:", investorId)

  // Explicit relational select for model_group
  const { data, error } = await (supabase as any)
    .from("cars")
    .select(`
      id,
      plate_number,
      investor_id,
      model_group_id,
      model_group (
        id,
        name
      )
    `)
    .eq("investor_id", investorId)

  console.log("[getCarsForInvestor] SUPABASE RAW DATA:", data)
  console.log("[getCarsForInvestor] SUPABASE ERROR:", error)

  if (error) {
    console.error("[getCarsForInvestor] Failed to load cars:", error)
    return []
  }

  // Sort by model_group.name ASC (cars without model go last)
  const sorted = (data || []).sort((a: any, b: any) => {
    const nameA = a.model_group?.name || "zzz"
    const nameB = b.model_group?.name || "zzz"
    return nameA.localeCompare(nameB)
  })

  console.log("[getCarsForInvestor] FINAL CARS RESULT:", sorted)

  return sorted
}

export async function createTransaction(data: {
  investorId: string
  carId: number | null
  sheetType: string
  category: string
  direction: "IN" | "OUT"
  amount: number
  date: string
  notes: string
  monthKey: string
}) {
  const supabase = getSupabaseBrowserClient()

  if (process.env.NODE_ENV === "development") {
    console.log("[v0] createTransaction called with data:", {
      investorId: data.investorId,
      carId: data.carId,
      sheetType: data.sheetType,
      category: data.category,
      direction: data.direction,
      amount: data.amount,
      date: data.date,
      monthKey: data.monthKey,
      hasNotes: !!data.notes,
    })
  }

  if (!data.investorId) throw new Error("investor_id is required")
  if (!data.monthKey) throw new Error("month_key is required")
  if (!data.sheetType) throw new Error("sheet_type is required")
  if (!data.category) throw new Error("category is required")
  if (!data.direction) throw new Error("direction is required")
  if (!data.amount || isNaN(data.amount)) throw new Error("valid amount is required")
  if (!data.date) throw new Error("date is required")

  const sheetTypeMap: Record<string, "car" | "buy_sell" | "company_expenses" | "personal_expenses"> = {
    "Car Sheet": "car",
    "Buy & Sell": "buy_sell",
    "Company Expenses": "company_expenses",
    "Personal Expenses": "personal_expenses",
  }

  const mappedSheetType = sheetTypeMap[data.sheetType]
  if (!mappedSheetType) {
    throw new Error(`Invalid sheet type: ${data.sheetType}`)
  }

  const insertData = {
    investor_id: data.investorId,
    car_id: data.carId,
    sheet_type: mappedSheetType,
    category: data.category,
    direction: data.direction, // Keep uppercase IN/OUT
    amount: data.amount,
    date: data.date,
    month_key: data.monthKey,
    note: data.notes,
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[v0] EXACT INSERT PAYLOAD:", JSON.stringify(insertData, null, 2))
  }

  const { data: result, error: insertError } = await supabase.from("financial_transactions").insert(insertData).select("*")

  if (insertError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[v0] Supabase insert error:", insertError)
      console.error("[v0] Error code:", insertError.code)
      console.error("[v0] Error message:", insertError.message)
    }

    throw new Error(`Database insert failed: ${insertError.message}`)
  }

  if (!result || result.length === 0) {
    throw new Error("Transaction was not created. Check RLS policies.")
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[v0] ✅ Transaction created successfully with ID:", result[0].id)
  }

  return result[0]
}

export async function getTopCarsForMonth(investorId: string, dateFrom: string, dateTo: string) {
  const supabase = getSupabaseBrowserClient()

  // Get all car transactions for the month
  const { data: transactions, error } = await supabase
    .from("financial_transactions")
    .select("car_id, direction, amount, category")
    .eq("investor_id", investorId)
    .eq("sheet_type", "car")
    .gte("date", dateFrom)
    .lte("date", dateTo)

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[v0] Failed to load car transactions:", error)
    }
    return []
  }

  // Group by car_id and calculate net income
  const carStats: Record<number, { income: number; expenses: number; bookings: number }> = {}

  for (const t of transactions || []) {
    if (!t.car_id) continue

    if (!carStats[t.car_id]) {
      carStats[t.car_id] = { income: 0, expenses: 0, bookings: 0 }
    }

    if (t.direction === "IN") {
      carStats[t.car_id].income += Number(t.amount)
      if (t.category === "Rent Collection") {
        carStats[t.car_id].bookings += 1
      }
    } else {
      carStats[t.car_id].expenses += Number(t.amount)
    }
  }

  // Get car details
  const carIds = Object.keys(carStats).map(Number)
  if (carIds.length === 0) return []

  // model_group table only has: id, name
  const { data: cars, error: carsError } = await supabase
    .from("cars")
    .select("id, plate_number, model_group(name)")
    .in("id", carIds)

  if (carsError) {
    console.error("[v0] Failed to load car details:", carsError)
    return []
  }

  // Combine and sort by net income
  const carsWithStats = (cars || []).map((car: any) => {
    const modelName = car.model_group?.name || "Unknown Model"
    return {
      id: car.id,
      name: modelName ? `${car.plate_number} - ${modelName}` : car.plate_number,
      plateNumber: car.plate_number,
      modelName: modelName,
      income: carStats[car.id]?.income || 0,
      expenses: carStats[car.id]?.expenses || 0,
      netIncome: (carStats[car.id]?.income || 0) - (carStats[car.id]?.expenses || 0),
      bookings: carStats[car.id]?.bookings || 0,
    }
  })

  // Sort by net income descending and take top 3
  // (Sorted by profit for ranking, not by model name here)
  return carsWithStats.sort((a, b) => b.netIncome - a.netIncome).slice(0, 3)
}

export async function getExpenseBreakdown(investorId: string, dateFrom: string, dateTo: string) {
  const transactions = await getFinancialTransactions(investorId, dateFrom, dateTo)

  const expenses = transactions.filter((t) => t.direction === "OUT")

  // Group by category
  const categoryTotals: Record<string, number> = {}

  for (const t of expenses) {
    const category = t.category || "Other"
    categoryTotals[category] = (categoryTotals[category] || 0) + Number(t.amount)
  }

  // Convert to sorted array
  const breakdown = Object.entries(categoryTotals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  return breakdown
}
